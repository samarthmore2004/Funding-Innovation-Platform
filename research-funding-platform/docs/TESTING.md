# Testing

## Backend unit & API tests (pytest)
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest                                     # 70 tests
pytest --cov=app --cov-report=term-missing # with coverage
```
`tests/conftest.py` creates an isolated temporary SQLite database, applies the schema, seeds it from the real
snapshot files in `data/` (plus demo users/projects) and **disables external APIs** so the offline fallbacks are
exercised deterministically.

| File | Covers |
|---|---|
| `test_auth.py` | health, bcrypt hashing, register/login/me, validation (duplicate, weak password, admin self-registration), login throttling (429), invalid/expired tokens, OAuth2 password form endpoint, change password, OAuth providers disabled without credentials |
| `test_rbac_and_account.py` | admin-only endpoints, manager/admin funding curation, project scope rules, admin self-demotion guard, deactivated users, settings update/validation, personal-data export, account deletion |
| `test_profile.py` | profile auto-creation, completeness, taxonomy validation, publication CRUD + ownership isolation + h-index, DOI lookup fallback (503 offline), patent CPC → domain mapping, research history validation |
| `test_funding_and_recommendations.py` | search/pagination/sort/filters (funder type, domain, record type, text), provenance of verified vs illustrative records, facets/detail, save/track/unsave, 11 eligibility rule cases, match-score properties, recommendations ordering/eligibility/relevance to profile, empty-profile notes, feedback validation, offline precision/recall threshold |
| `test_scoring_and_commercialization.py` | weights exactly as specified, band thresholds, preview consistency (overall = Σ weighted components, disclaimer), monotonicity (TRL, IP, market size), project lifecycle + score history + permissions, portfolio, commercialization pathways |
| `test_analytics.py` | research overview/trends/emerging/hotspots/citations/search/my analytics, live-trend fallback, patent search/facets/trends/assignees/competitors/clusters/innovation map/similar, PatentsView 503 without key, technology indices/detail/emerging/opportunities/adoption/competitive, dashboards per role + view preview rules |
| `test_notifications_reports_admin.py` | alert generation + dedupe + read/delete, preference filtering, admin broadcast, report previews for all 5 types, CSV/XLSX/PDF downloads (content checks), report history, admin analytics/monitoring/system/jobs/audit logs, dataset imports (CSV partial failure, Google Patents export, JSON), graceful failure of Grants.gov sync offline |

Two regression tests were added after browser testing: HTML-entity unescaping and stale-forecast handling on
ingest, and the rule that zero-relevance opportunities are never offered as recommendations.

**Result (2026-10-27, Windows 11, Python 3.13.15, final code):** `70 passed in 51.65s`.

**Coverage:** in the build workspace coverage.py could only read 35 of the 47 modules (it canonicalises file
paths, and the longest ones exceeded Windows' 260-character limit there); on those 35 modules line coverage was
**90 %** (3,247 statements). The remaining modules (e.g. `research_analytics.py`, `patent_analytics.py`,
`commercialization.py`) are exercised by the API tests but were not measured. Run `pytest --cov=app` from a
short path (or rely on the CI job) for a complete figure.

## End-to-end smoke test (live server)
```powershell
# terminal 1
cd backend; uvicorn app.main:app --port 8000
# terminal 2
python tests\e2e_smoke.py --base-url http://localhost:8000
```
Registers a new founder, completes the profile, fetches recommendations, saves a funding call, calls the main
analytics endpoints, creates and scores a project (checks the formula), runs commercialization and alerts,
downloads PDF/XLSX/CSV reports, verifies RBAC and the admin endpoints.

**Result (2026-10-27, against `uvicorn` + SQLite):** `27/27 steps passed`.

## PostgreSQL verification
PostgreSQL and Docker were not available on the build machine. Verified instead:
* `alembic upgrade head --sql` with a `postgresql+psycopg://` URL compiles the full PostgreSQL DDL
  ([schema_postgresql.sql](schema_postgresql.sql), 17 tables).
* The GitHub Actions workflow (`.github/workflows/ci.yml`) contains a `backend-postgres` job that applies the
  migration and runs the seed against a PostgreSQL 16 service container.

## Frontend
```powershell
cd frontend
npm install
npm run build
```
**Result (2026-10-27, Vite 8.3.5):** build succeeds with no errors or warnings (`✓ built in ~1.6 s`; main bundle
262 kB / 82 kB gzip, Recharts chunk 342 kB / 101 kB gzip, every page lazy-loaded). No frontend unit tests or
ESLint configuration are included.

## Browser verification (built app served by `vite preview` against the live API + seeded SQLite)
Performed manually in a Chromium-based browser pane on 2026-10-27:

| Area | What was exercised | Result |
|---|---|---|
| Auth | Landing page, login as each demo role, redirect of signed-in users away from `/register`, 404 page | ✅ |
| Researcher | Dashboard KPIs/charts, recommendations (reasons, matched terms, hidden-ineligible note), funding search facets, verified Grants.gov detail (source link + retrieval time), research trends/emerging/hotspots/citations, patents (search, cluster map), technology areas + area detail, patent detail with similar patents | ✅ |
| Innovation | Project detail breakdown, **Re-score** (history grows), **what-if preview** (TRL 4→7 and +1 granted patent: 48.3 → 54.7, not saved), commercialization pathways | ✅ |
| Profile | Tabs, publications table, live **DOI lookup** via Crossref pre-filling the form (not saved) | ✅ |
| Notifications & reports | Notification centre; PDF/XLSX/CSV downloads through the real UI path (filenames, content types and sizes checked; the final browser save was intercepted) and report history | ✅ |
| Manager | Manager dashboard + view switcher (startup preview), portfolio pipeline stage move, "New internal program" form | ✅ |
| Admin | All seven admin tabs, CSV import with a failing row (partial result shown), role change, manual job run, audit-log entries for each | ✅ |
| Settings | Account/preferences/password sections, personal-data export (JSON) | ✅ |
| Responsive | Every route (auth pages, all four role dashboards, detail pages) plus the analytics and admin tabs — 42 route/tab/role combinations — rendered in a 375 px-wide frame: no horizontal page overflow after fixing three layout bugs | ✅ |

Issues found and fixed during this pass: honorific in the greeting ("Welcome back, Dr."), raw HTML entities in
Grants.gov titles, stale Grants.gov forecasts sorting first by deadline, mislabelled "most recent year" column,
an inaccurate CAGR subtitle and a trend axis that extended past the last year with data,
`""` shown for empty audit details, unlabeled first/last-stage pipeline buttons, zero-similarity "matches" on the
startup dashboard, disclaimer wording counted as matched terms, robotics classed as "Emerging" (maturity now
includes literature volume), unrealistic "pending" status on decade-old synthetic patents, and phone-width
overflow (grid items, an sr-only table header escaping its scroller, an unbroken config string).

Not verified in a browser: social OAuth login (no client credentials), live PatentsView search (no key), Docker
deployment (Docker unavailable on the build machine).
