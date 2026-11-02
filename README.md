# Research Funding & Innovation Intelligence Platform

A full-stack capstone platform that helps **researchers, startup founders, innovation managers and
administrators** discover funding, analyse research and patent landscapes, identify emerging technologies,
score innovations and plan commercialization — from one role-aware dashboard.

| Layer | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| Data & ML | pandas, NumPy, scikit-learn (TF-IDF, cosine similarity, K-means, SVD) |
| Database | PostgreSQL 16 (Docker/production) · SQLite (zero-setup development) |
| Frontend | React 19, Vite 8, Tailwind CSS 4, Recharts 3, React Router 7 |
| Security | bcrypt, JWT, OAuth2 password flow, optional Google/GitHub OAuth2, RBAC, audit log |
| Exports | CSV, Excel (openpyxl), PDF (ReportLab) |
| DevOps | Docker, Docker Compose, nginx, GitHub Actions |

## Features (all 12 modules of the specification)
1. **Authentication & roles** — registration, login, JWT, OAuth2 password flow, optional social login, four roles.
2. **Research profile** — domains, keywords, technology areas, organisation info, publications (DOI import via
   Crossref/OpenAlex), patents, research history, completeness and h-index.
3. **Funding discovery** — search, filters, facets, eligibility checklist, tracking pipeline, provenance badges
   (*verified* official records vs *illustrative* demo records).
4. **Personalised recommendations** — TF-IDF + cosine similarity + domain overlap + rule-based eligibility with
   human-readable reasons; project-based matching; feedback logging.
5. **Research trend intelligence** — OpenAlex publication trends & CAGR, emerging topics, research hotspots,
   citation analytics, live topic trends.
6. **Patent landscape** — search, filing trends, assignee & competitor analysis, clustering map, innovation
   heat-map, similar patents, CSV import (Google Patents / Lens).
7. **Technology intelligence** — maturity, emerging, adoption and opportunity (white-space) indices,
   competitive monitoring.
8. **Innovation scoring** — `0.30·Novelty + 0.20·Patent strength + 0.15·Maturity + 0.20·Market + 0.15·Funding`
   with component breakdown, factors, history and what-if preview. *Heuristic decision support — not a
   validated prediction of commercial success.*
9. **Commercialization** — licensing / startup / productization / partnership / grant-research pathways with fit
   scores, next steps, idea starters, licensing targets, partners, funding and risks.
10. **Dashboards** — researcher, startup, innovation-manager (portfolio & pipeline) and administrator views.
11. **Notifications & alerts** — funding matches, deadlines, patent activity, emerging technologies, research
    trends, commercialization signals and broadcasts; background scheduler.
12. **Reports & administration** — funding/patent/research/innovation/commercialization reports in CSV, Excel
    and PDF; user management, platform analytics, recommendation monitoring, dataset imports & live syncs, audit
    logs, system metrics and jobs.

## Quick start (Windows PowerShell)
> Keep the project in a short path such as `C:\Projects\research-funding-platform` (Windows 260-character limit).

**Fastest path** (from the project folder; needs Python 3.12+ and Node.js):
```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1       # venv, dependencies, migrations, seed, npm install
powershell -ExecutionPolicy Bypass -File .\start-dev.ps1   # starts API + frontend in two windows, opens the app
```

**Manual steps:**
```powershell
# 1) Backend
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
alembic upgrade head
python -m app.seed.seed
uvicorn app.main:app --reload --port 8000
```
```powershell
# 2) Frontend (new terminal)
cd frontend
npm install
npm run dev
```
* App: <http://localhost:5173> · API docs: <http://localhost:8000/docs> · Health: <http://localhost:8000/api/health>
* Demo accounts: `admin@example.com`, `researcher@example.com`, `founder@example.com`, `manager@example.com`
  — password is the `DEMO_USER_PASSWORD` value in [`.env.example`](.env.example) (demo only; disable with
  `SEED_DEMO_USERS=false`).

Full instructions: [docs/SETUP_WINDOWS.md](docs/SETUP_WINDOWS.md).

### Docker (PostgreSQL + API + frontend)
```powershell
Copy-Item .env.example .env   # set SECRET_KEY and POSTGRES_PASSWORD
docker compose up --build
```
Frontend <http://localhost:8080>, API <http://localhost:8000/docs>. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Tests
```powershell
cd backend; pytest                                   # 70 tests
python ..\tests\e2e_smoke.py --base-url http://localhost:8000   # live end-to-end smoke test
cd ..\frontend; npm run build                        # production build
```
Details and recorded results: [docs/TESTING.md](docs/TESTING.md).

## Data & transparency
* **Verified:** 93 open/forecasted opportunities from the official **Grants.gov** API (links + verification
  timestamps), 692 **OpenAlex** works and 210 OpenAlex yearly trend points (CC0).
* **Illustrative:** 49 synthetic funding calls (fictional "Example/Sample" funders) and 545 synthetic patents
  (`ILLUS-*` numbers, invented assignees) — labelled as such in the database, API, UI and reports.
* External APIs are optional; the app runs fully offline from the bundled snapshots.
See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Repository layout
```
backend/     FastAPI app (app/api, core, db, models, schemas, services, ml, seed), Alembic, scripts, tests
frontend/    React app (src/pages, components, layouts, auth, api), Dockerfile, nginx.conf
data/        taxonomy + real snapshots + illustrative datasets
docs/        architecture, API, data sources, setup, deployment, testing, report, demo, viva, progress
tests/       end-to-end smoke test (stdlib only)
docker-compose.yml, .env.example, .github/workflows/ci.yml
```

## Documentation
[Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Data sources](docs/DATA_SOURCES.md) ·
[Requirements checklist](docs/REQUIREMENTS_CHECKLIST.md) · [Windows setup](docs/SETUP_WINDOWS.md) ·
[Deployment](docs/DEPLOYMENT.md) · [Testing](docs/TESTING.md) · [Capstone report](docs/CAPSTONE_REPORT.md) ·
[Demo script](docs/DEMO_SCRIPT.md) · [Viva Q&A](docs/VIVA_QA.md) · [Progress](docs/PROGRESS.md) ·
[Frontend notes](docs/FRONTEND.md)

## Publish to GitHub
```powershell
cd C:\Projects\research-funding-platform
git init
git add .
git commit -m "Research Funding & Innovation Intelligence Platform"
git branch -M main
git remote add origin https://github.com/<your-user>/research-funding-platform.git
git push -u origin main
```
`.gitignore` excludes `.env`, virtual environments, `node_modules`, build output and local databases.

## Known limitations
See the end of [docs/CAPSTONE_REPORT.md](docs/CAPSTONE_REPORT.md#9-limitations) and
[docs/REQUIREMENTS_CHECKLIST.md](docs/REQUIREMENTS_CHECKLIST.md). In short: heuristic scores, illustrative patent
data unless real data is imported, U.S.-only verified funding, small keyless OpenAlex quota, single-instance
scheduler/metrics, Docker images not built on the development machine.

Live Link : https://funding-innovation-platform-1.onrender.com/
