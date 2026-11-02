# Demo Script (≈ 12 minutes)

Before the demo: `alembic upgrade head`, `python -m app.seed.seed --reset`, start the API (`uvicorn app.main:app`)
and the frontend (`npm run dev`), open <http://localhost:5173>. Demo password: see `DEMO_USER_PASSWORD` in
`.env.example`.

## 1. Landing page (1 min)
* Show the 12 modules, role cards and the *Data transparency* section (verified vs illustrative data, heuristic
  score disclaimer).

## 2. Researcher journey — `researcher@example.com` (4 min)
1. **Dashboard:** KPIs (matches, publications, h-index, avg innovation score), top recommendations, research
   trends for the user's domains, publication analytics, patent insights, upcoming deadlines.
2. **Profile:** domains, keywords, technology areas; completeness meter; Publications tab → *Look up DOI*
   (e.g. `10.1038/s41586-024-08449-y`; needs internet) or add manually; Patents and Research history tabs.
3. **Recommendations:** match scores with reasons and matched terms; note the eligibility checklist; toggle
   *include ineligible* to show U.S.-only Grants.gov calls being filtered for an India-based researcher.
4. **Funding detail:** open a *Verified* record → official Grants.gov link and verification date; open an
   *Illustrative* record → warning banner. Save it and change its tracking status.
5. **Research trends:** domain trend lines (OpenAlex counts), growth table, emerging topics, hotspots, citation
   analytics; run a *live topic trend* (e.g. "graph neural networks").

## 3. Innovation scoring & commercialization (3 min)
1. **Innovation → projects:** open *Federated learning for privacy-preserving diabetic retinopathy screening*;
   show the score gauge, five-component breakdown (value × weight = contribution), factor details and the
   disclaimer. Click **Re-score** to add a run to the history. On the Innovation page open **What-if preview**,
   start from this project, raise TRL 4 → 7 and patents granted 0 → 1, then **Preview score** (48 → ~55, not saved).
2. **Commercialization:** pathway fit scores, recommended pathways, next steps, productization ideas,
   licensing targets, partners, matched funding and risk flags.

## 4. Startup founder — `founder@example.com` (1.5 min)
* Startup dashboard: startup-eligible funding (accelerators/venture programmes), technology opportunities
  (white space), competitor patent intelligence, commercialization overview.
* **Patents:** cluster map, competitor comparison (pick two assignees), innovation heat-map — point out the
  *illustrative data* banner.
* **Technology:** maturity stages, emerging/opportunity scores and rationale.

## 5. Innovation manager — `manager@example.com` (1 min)
* Portfolio KPIs, pipeline board (move a project from *prototype* to *pilot*), score distribution, technology
  trend monitoring, funding analytics (deadlines by month, funder types).
* Funding → **New internal program** opens the form for institutional calls (saved with record type *internal*).

## 6. Administrator — `admin@example.com` (1.5 min)
* Platform analytics (users by role, registrations, logins), **recommendation monitoring** (served
  recommendations, feedback, offline precision@5/recall@5, eligibility rule accuracy).
* Users: change a role / deactivate a user (show the audit log entry).
* Datasets: counts by source/record type, download the CSV template, import a small CSV (row errors are reported), **Run Grants.gov sync** (needs internet).
* System: uptime, request latency (avg/p95 per route), jobs (run *alerts* now), integrations.
* Broadcast a platform notification; switch to another user to see it in the bell.

## 7. Reports (0.5 min)
* Reports page: preview the Funding report, download PDF, Excel (multi-sheet) and CSV; show history.

## 8. Engineering (optional, 1 min)
* Swagger UI at `/docs` (Authorize with a demo account), `pytest` run (70 passing), `tests/e2e_smoke.py`
  (27/27), Docker Compose file, GitHub Actions workflow.
