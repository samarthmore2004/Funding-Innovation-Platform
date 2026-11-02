# Windows Setup (VS Code + PowerShell)

Tested on Windows 11 with Python 3.13 and Node.js 24 (Node 20.19+/22.12+ also works).

## 0. Prerequisites
* Python 3.12 or 3.13 — <https://www.python.org/downloads/> (tick *Add python.exe to PATH*). Check: `py -3.13 --version`
* Node.js LTS — <https://nodejs.org/>. Check: `node --version`
* Git — <https://git-scm.com/download/win>
* Optional: Docker Desktop (for the PostgreSQL stack), VS Code with the Python and ESLint extensions.

> **Keep the path short.** Windows limits paths to 260 characters unless *long paths* are enabled. Put the
> project somewhere like `C:\Projects\research-funding-platform`. (Or enable long paths once from an elevated
> PowerShell: `New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force`.)

## Shortcut: two scripts
From the project folder:
```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1        # once (add -Reset to re-seed, -SkipFrontend to skip npm)
powershell -ExecutionPolicy Bypass -File .\start-dev.ps1    # every time: API on :8000 + frontend on :5173
```
`setup.ps1` finds Python 3.12+ (`py -3.13`, `py -3.12` or `python`), creates `backend\.venv`, installs
dependencies, runs `alembic upgrade head` and the seed script, then runs `npm install`. The manual equivalent
follows.

## 1. Backend (FastAPI)
```powershell
cd C:\Projects\research-funding-platform\backend
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1          # if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
python -m pip install --upgrade pip
pip install -r requirements-dev.txt

# optional: configuration (defaults already work with SQLite)
Copy-Item ..\.env.example ..\.env     # then edit SECRET_KEY etc.

alembic upgrade head                  # creates backend\rfip.db (SQLite) with all 17 tables
python -m app.seed.seed               # loads data\ snapshots + demo users/projects (~15 s)
uvicorn app.main:app --reload --port 8000
```
* API docs (Swagger): <http://localhost:8000/docs> · ReDoc: <http://localhost:8000/redoc> · health:
  <http://localhost:8000/api/health>
* Re-seed from scratch: `python -m app.seed.seed --reset`

## 2. Frontend (React + Vite)
Open a second PowerShell window:
```powershell
cd C:\Projects\research-funding-platform\frontend
npm install
npm run dev            # http://localhost:5173 (proxies /api to http://localhost:8000)
```
Production build: `npm run build` (output in `frontend\dist`), preview with `npm run preview`.

## 3. Sign in
Demo accounts are created by the seed script (password = `DEMO_USER_PASSWORD` in `.env.example`):

| Role | E-mail |
|---|---|
| Administrator | `admin@example.com` |
| Researcher | `researcher@example.com` |
| Startup founder | `founder@example.com` |
| Innovation manager | `manager@example.com` |

You can also register new researcher / founder / manager accounts from the UI. Disable demo accounts in any
shared deployment (`SEED_DEMO_USERS=false`).

## 4. Tests
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest                                   # 70 tests, ~1 min (uses an isolated temporary SQLite DB)
pytest --cov=app --cov-report=term-missing

# end-to-end smoke test against the running API (standard library only)
python ..\tests\e2e_smoke.py --base-url http://localhost:8000
```

## 5. Using PostgreSQL locally (without Docker)
1. Install PostgreSQL 16 for Windows and create a database:
   ```powershell
   psql -U postgres -c "CREATE USER rfip WITH PASSWORD 'rfip-local';"
   psql -U postgres -c "CREATE DATABASE rfip OWNER rfip;"
   ```
2. In `.env` set `DATABASE_URL=postgresql+psycopg://rfip:rfip-local@localhost:5432/rfip`
3. `alembic upgrade head` then `python -m app.seed.seed`

## 6. Docker (PostgreSQL + API + frontend)
```powershell
cd C:\Projects\research-funding-platform
Copy-Item .env.example .env       # set SECRET_KEY and POSTGRES_PASSWORD
docker compose up --build
```
Frontend: <http://localhost:8080> · API docs: <http://localhost:8000/docs>. See [DEPLOYMENT.md](DEPLOYMENT.md).

## 7. Troubleshooting
| Symptom | Fix |
|---|---|
| `Activate.ps1 cannot be loaded` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `No module named app` | Run commands from the `backend` folder with the venv activated |
| `Database unavailable … alembic upgrade head` (HTTP 503) | Run `alembic upgrade head`, check `DATABASE_URL` |
| Empty dashboards | Run `python -m app.seed.seed` |
| `FileNotFoundError` / path errors during `pip install` | Path longer than 260 chars — move the project to a short path or enable long paths |
| Frontend shows network errors | Make sure the API is running on port 8000; Vite proxies `/api` there |
| Port 8000/5173 busy | `uvicorn ... --port 8001`, then start Vite with `$env:VITE_PROXY_TARGET="http://localhost:8001"; npm run dev` (or `$env:VITE_PORT=5174`) |
