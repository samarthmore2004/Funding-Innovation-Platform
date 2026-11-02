# Progress Log

_Last updated: 2026-10-27 — all phases complete; remaining limitations listed at the end._

## Phase status
| Phase | Status | Evidence |
|---|---|---|
| A — Inspect & plan | ✅ Done | 14-page spec + architecture diagram read; API contract in [`API.md`](API.md); checklist in [`REQUIREMENTS_CHECKLIST.md`](REQUIREMENTS_CHECKLIST.md) |
| B — Backend | ✅ Done | 86 REST paths / 100 operations, 17 tables, Alembic migration, RBAC, services for all 12 modules |
| C — Frontend | ✅ Done | React 19 / Vite 8 / Tailwind 4 SPA: 24 pages, role-aware layout, design system, Recharts charts; production build passes |
| D — Data & AI | ✅ Done | Real snapshots (Grants.gov 93, OpenAlex 692 works + 210 trend points), illustrative datasets, TF-IDF recommender + eligibility, scoring, analytics |
| E — Integration & debugging | ✅ Done | 70/70 pytest, E2E smoke 27/27 on a live server, full browser walkthrough for all roles, 375 px check of every route |
| F — Deployment & docs | ✅ Done (Docker not built locally) | Dockerfiles, Compose, CI workflow, setup scripts, full documentation set |

## Verification summary (2026-10-27, Windows 11, Python 3.13.15, Node 24.14.1)
* `pytest` (backend): **70 passed** in 51.65 s.
* `tests/e2e_smoke.py` against `uvicorn` + seeded SQLite: **27/27 steps passed**.
* `vite build`: **success**, no warnings (main bundle 82 kB gzip; every page lazy-loaded).
* PostgreSQL: migration compiled offline to PostgreSQL DDL ([`schema_postgresql.sql`](schema_postgresql.sql));
  a CI job applies it to PostgreSQL 16 — **not executed on this machine** (no PostgreSQL/Docker available).
* Browser: every page exercised against the live API as researcher, founder, manager and admin; downloads,
  imports, scoring, what-if, DOI lookup and admin actions checked; 42 route/tab/role combinations pass at 375 px.
* Offline recommender evaluation: precision@5 = 0.947, recall@5 = 0.973 (15 personas); eligibility rule
  consistency 12/12; patent clustering silhouette ≈ 0.10.

## Log
1. Read the specification PDF (text + embedded architecture diagram).
2. Probed public APIs: Grants.gov `search2` (keyless ✅), OpenAlex (keyless, ~$0.10/day shared budget ✅),
   Crossref (✅). Patent APIs (PatentsView, USPTO ODP, Lens) all require keys → illustrative patents + CSV import +
   optional PatentsView client.
3. Windows long-path limit (260 chars) hit in the build workspace → ran Python and Vite through the 8.3 short
   path; documented "keep the path short / enable long paths" in the setup guide and frontend README.
4. Built the backend (FastAPI 0.162 / Starlette 1.10 / SQLAlchemy 2.1 / pandas 3.1 / scikit-learn 1.9) while a
   parallel agent built the frontend against the API contract.
5. Generated Alembic revision `0001` (17 tables) and verified PostgreSQL DDL compilation offline.
6. Seeded data; sanity-checked analytics and fixed: saturated match scores (expansion on both sides + linear
   cap), generic emerging topics, template words in cluster labels, harsh freedom-to-operate penalty, uneven
   illustrative funding coverage.
7. FastAPI 0.162 keeps included routers nested → fixed the metrics middleware's route templates.
8. Wrote the pytest suite and the HTTP E2E smoke test.
9. Browser walkthrough of the integrated app found and fixed: honorific in greetings, HTML entities in Grants.gov
   titles, stale Grants.gov forecasts sorting first, a mislabelled column, an inaccurate CAGR subtitle, trend axis
   past the data, `""` for empty audit details, unlabeled pipeline buttons, zero-relevance "matches", disclaimer
   wording counted as matched terms, a maturity index that ignored literature volume, unrealistic statuses on old
   synthetic patents, and three phone-width overflow bugs. Added two regression tests.
10. Added `setup.ps1` / `start-dev.ps1`, exported `openapi.json` (Postman-importable), finalised documentation.

## Known limitations / manual steps
* **Docker** images and Compose stack were written but not built or run here (Docker not installed).
* **PostgreSQL** path verified by offline DDL generation and a CI job definition, not by a live run on this machine.
* **Social OAuth** (Google/GitHub) and **PatentsView** live search need credentials/keys; implemented but untested
  against the live services.
* **Patent data is illustrative**, so patent-derived analytics (clusters, competitors, adoption, patent strength,
  licensing targets) describe synthetic data until real exports are imported.
* **Verified funding is U.S. federal (Grants.gov)**; non-U.S. programmes in the demo are illustrative.
* Innovation Score and pathway fits are **heuristics**, not validated predictors.
* Scheduler, request metrics and login throttling are in-process (single API instance).
* No frontend unit tests or ESLint configuration; backend coverage could only be measured for 35 of 47 modules in
  this workspace (90 % on those) because of the path-length limit — run `pytest --cov=app` from a short path.
