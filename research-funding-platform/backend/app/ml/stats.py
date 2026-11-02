"""Small numeric helpers used by the analytics services."""
from __future__ import annotations

import math


def cagr(series: dict[int, float], end_year: int, span: int = 5) -> float | None:
    """Compound annual growth rate (%) between (end_year - span) and end_year, using 2-year averages at
    both ends to dampen noise. Returns None when the start value is zero/missing."""
    def avg(y: int) -> float:
        vals = [series.get(y, 0.0), series.get(y - 1, 0.0)]
        return sum(vals) / 2

    start, end = avg(end_year - span), avg(end_year)
    if start <= 0:
        return None if end <= 0 else 100.0
    if end <= 0:
        return -100.0
    return round(100 * ((end / start) ** (1 / span) - 1), 2)


def minmax(values: dict[str, float | None]) -> dict[str, float]:
    """Min-max normalise to 0..1; missing values map to 0."""
    clean = {k: v for k, v in values.items() if v is not None and not math.isnan(v)}
    if not clean:
        return {k: 0.0 for k in values}
    lo, hi = min(clean.values()), max(clean.values())
    if hi == lo:
        return {k: (0.5 if k in clean else 0.0) for k in values}
    return {k: ((clean[k] - lo) / (hi - lo) if k in clean else 0.0) for k in values}


def clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def trend_label(growth: float | None) -> str:
    if growth is None:
        return "stable"
    if growth > 5:
        return "rising"
    if growth < -2:
        return "declining"
    return "stable"
