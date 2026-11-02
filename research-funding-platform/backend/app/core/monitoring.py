"""Request logging, in-memory performance metrics and security headers."""
from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("rfip.http")
STARTED_AT = time.time()


class MetricsStore:
    def __init__(self, window: int = 500) -> None:
        self._lock = threading.Lock()
        self.window = window
        self.total = 0
        self.errors = 0
        self.durations: deque[float] = deque(maxlen=5000)
        self.routes: dict[str, dict] = defaultdict(lambda: {"count": 0, "errors": 0, "durations": deque(maxlen=window)})

    def record(self, route: str, duration_ms: float, status_code: int) -> None:
        with self._lock:
            self.total += 1
            self.durations.append(duration_ms)
            r = self.routes[route]
            r["count"] += 1
            r["durations"].append(duration_ms)
            if status_code >= 500:
                self.errors += 1
                r["errors"] += 1

    @staticmethod
    def _p95(values) -> float:
        if not values:
            return 0.0
        ordered = sorted(values)
        return round(ordered[min(len(ordered) - 1, int(0.95 * len(ordered)))], 1)

    def snapshot(self, top: int = 25) -> dict:
        with self._lock:
            durations = list(self.durations)
            routes = []
            for name, r in self.routes.items():
                d = list(r["durations"])
                routes.append({"route": name, "count": r["count"], "errors": r["errors"],
                               "avg_ms": round(sum(d) / len(d), 1) if d else 0.0, "p95_ms": self._p95(d)})
            routes.sort(key=lambda r: -r["count"])
            return {
                "requests_total": self.total, "errors_total": self.errors,
                "avg_latency_ms": round(sum(durations) / len(durations), 1) if durations else 0.0,
                "p95_latency_ms": self._p95(durations), "by_route": routes[:top],
            }


metrics = MetricsStore()


class RequestMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
        finally:
            elapsed = (time.perf_counter() - start) * 1000
            if request.url.path.startswith("/api"):
                # Recent FastAPI versions keep included routers nested, so the matched route template is relative
                # to the "/api" mount prefix; group metrics by the full template (e.g. /api/funding/{funding_id}).
                template = getattr(request.scope.get("route"), "path", None) or request.url.path
                if not template.startswith("/api"):
                    template = "/api" + template
                metrics.record(f"{request.method} {template}", elapsed, status_code)
                logger.info("%s %s -> %s (%.1f ms)", request.method, request.url.path, status_code, elapsed)
        response.headers["X-Response-Time-ms"] = f"{elapsed:.1f}"
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        return response


def uptime_seconds() -> int:
    return int(time.time() - STARTED_AT)
