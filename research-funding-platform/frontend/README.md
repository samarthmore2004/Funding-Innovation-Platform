# Frontend — Research Funding & Innovation Intelligence Platform

React 19 + Vite 8 + Tailwind CSS 4 single-page app (JavaScript, no TypeScript). Charts use Recharts 3, icons
lucide-react, HTTP axios. It talks only to the FastAPI backend described in [`../docs/API.md`](../docs/API.md).

## Run (Windows PowerShell)

```powershell
cd frontend
npm install
npm run dev          # http://localhost:5173 — proxies /api, /docs, /redoc, /openapi.json to http://localhost:8000
```

Start the backend first (see the root `README.md`). Other scripts:

```powershell
npm run build        # production bundle in dist/
npm run preview      # serve dist/ on http://localhost:4173 (same /api proxy)
```

Environment variables:

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | build time (`.env`) | `/api` | API base URL seen by the browser. Keep `/api` behind the dev proxy or nginx. |
| `VITE_PROXY_TARGET` | dev/preview server | `http://localhost:8000` | Where the dev/preview server forwards `/api`. |
| `VITE_PORT` | dev server | `5173` | Dev server port. |

## Docker

`frontend/Dockerfile` builds the bundle with Node 22 and serves it with nginx 1.27; `nginx.conf` adds the SPA
fallback and proxies `/api/`, `/docs`, `/redoc` and `/openapi.json` to the `backend` service on port 8000.

## Windows path-length note

Windows limits classic paths to 260 characters. If the project lives in a very deep folder, Node can fail inside
`node_modules` (for example `ERR_PACKAGE_IMPORT_NOT_DEFINED ... #module-sync-enabled` from Vite). Keep the project
in a short path such as `C:\projects\research-funding-platform`, or enable long paths
(`LongPathsEnabled` = 1 under `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem`, then restart).

More detail: [`../docs/FRONTEND.md`](../docs/FRONTEND.md).
