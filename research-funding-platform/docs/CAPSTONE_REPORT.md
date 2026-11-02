# Capstone Report — Research Funding & Innovation Intelligence Platform

*Material for the written report and presentation. Figures quoted below were measured on the shipped dataset on
2026-10-27; re-run the commands in [TESTING.md](TESTING.md) to reproduce them.*

## Abstract
Researchers, startups and technology-transfer offices spend considerable effort finding relevant funding,
tracking research and patent trends and judging which innovations to commercialise. This project delivers a
web platform that centralises these tasks: it ingests official funding opportunities (Grants.gov), global
publication metadata (OpenAlex/Crossref) and patent records, and provides personalised funding
recommendations with rule-based eligibility checks, research-trend and patent-landscape analytics, technology
maturity/opportunity indicators, a transparent weighted Innovation Score and commercialization pathway
recommendations. The system is implemented with FastAPI, SQLAlchemy/Alembic (PostgreSQL or SQLite),
scikit-learn, pandas and a React/Tailwind front end, secured with bcrypt, JWT and role-based access control, and
packaged with Docker. An offline evaluation of the recommender gives precision@5 ≈ 0.95 using synthetic
personas; 70 automated API/unit tests and a 27-step end-to-end smoke test pass.

## 1. Introduction & problem statement
* Funding information is fragmented across portals with inconsistent eligibility rules and deadlines.
* Research and patent landscapes change quickly; small teams lack analysts to monitor them.
* Commercialisation decisions (license vs. spin-out vs. partnership) are often ad hoc.

**Objective (from the brief):** an AI-powered platform that helps researchers, startups, universities and
innovation centres identify relevant funding, analyse research trends, evaluate patent landscapes, discover
emerging technologies and generate commercialization recommendations through a central dashboard.

## 2. Requirements
Functional modules (12) and roles (researcher, startup founder, innovation manager, administrator) are mapped
one-to-one to implementation in [REQUIREMENTS_CHECKLIST.md](REQUIREMENTS_CHECKLIST.md). Non-functional goals:
security (hashing, JWT, RBAC, audit), explainability (every score shows its factors), reproducibility (offline
snapshots, deterministic generators, migrations, seeds), portability (SQLite ↔ PostgreSQL), and performance
(sub-second API responses for interactive pages).

## 3. Technology review & choices
| Need | Chosen | Alternatives considered |
|---|---|---|
| API | FastAPI (typed, async, OpenAPI docs) | Django REST, Flask |
| ORM / migrations | SQLAlchemy 2.0 + Alembic | Django ORM, raw SQL |
| Database | PostgreSQL (prod), SQLite (dev) | MongoDB (listed in the brief; unnecessary for structured data with JSON columns) |
| Text matching | TF-IDF + cosine (scikit-learn) | Sentence-Transformers + FAISS (heavier, less explainable; future work) |
| Clustering | K-means + silhouette, truncated SVD | HDBSCAN, UMAP |
| Front end | React 19 + Vite 8 + Tailwind 4 + Recharts 3 | Next.js (SSR not needed) |
| Exports | pandas, openpyxl, ReportLab | WeasyPrint (needs native libraries on Windows) |
| Deployment | Docker Compose, GitHub Actions | Kubernetes (overkill for the capstone) |

## 4. System design
See [ARCHITECTURE.md](ARCHITECTURE.md) for the component diagram, ER diagram, algorithms and trade-offs.
Highlights: 17-table relational schema with provenance fields; modular service layer (one module per platform
module); 86 REST endpoints documented with OpenAPI; role-specific dashboards assembled server-side.

## 5. Implementation summary
| Module | Key implementation points |
|---|---|
| Authentication & RBAC | Registration/login, OAuth2 password flow, optional Google/GitHub OAuth2, bcrypt, JWT, `require_roles`, login throttling, audit logging |
| Research profile | Profile, domains/keywords/technology areas (shared taxonomy), publications (DOI import via Crossref/OpenAlex), patents, research history, completeness & h-index |
| Funding discovery | Search/filter/sort/paginate, facets, provenance badges, eligibility checklist, tracking pipeline (interested → awarded), manager-created internal calls |
| Recommendation engine | TF-IDF + cosine + domain overlap + eligibility, explanations, feedback logging, project-based matching |
| Research intelligence | OpenAlex trend series & CAGR, emerging topics, K-means hotspots, citation analytics, live OpenAlex query with fallback |
| Patent landscape | Search, trends, assignee ranking, competitor comparison, clustering map, innovation heat-map, similar patents, CSV import of Google Patents/Lens exports |
| Technology intelligence | Maturity, emerging, adoption and opportunity indices; white-space rationale; competitive monitoring |
| Innovation scoring | Five data-driven components, weights exactly as specified, explanation & factor drill-down, history, what-if preview |
| Commercialization | Five pathways with fit scores, next steps, idea starters, licensing targets, partners, funding, risks |
| Notifications | Deduplicated alerts for matches, deadlines, patents, emerging tech, research trends, commercialization, broadcasts; scheduler + manual refresh |
| Reports | Five report types × CSV/XLSX/PDF, preview, history |
| Administration | Users & roles, platform analytics, recommendation monitoring & offline evaluation, datasets (import/sync/templates), audit log, system metrics, jobs |

## 6. Data
93 verified Grants.gov opportunities, 692 OpenAlex works, 210 OpenAlex trend points, plus clearly labelled
illustrative funding calls (49) and patents (545). See [DATA_SOURCES.md](DATA_SOURCES.md) for provenance rules.

## 7. Evaluation
| Metric (spec §8) | How it is measured here | Result (shipped data) |
|---|---|---|
| Recommendation precision / recall | Offline: 15 synthetic personas (one per area), relevant = area-tagged active opportunities, k = 5 | precision@5 ≈ 0.95, recall@5 ≈ 0.97 (Admin → Recommendation monitoring) |
| Eligibility matching accuracy | 12 hand-labelled rule scenarios + parametrised unit tests | 100 % rule consistency (tests) — not a field accuracy study |
| Patent clustering quality | Cosine silhouette of the chosen K-means model | ≈ 0.10 (low-to-moderate separation, typical for short TF-IDF texts; synthetic data) |
| Innovation scoring consistency | Overall = Σ weight × component (tests); monotonicity tests for TRL, IP and market size | Pass |
| API response time | In-app metrics (Admin → System) and the E2E smoke test | Typical 10–400 ms per request on a laptop; recommendation monitoring ≈ 0.9 s uncached |
| Concurrent users | Not load-tested (future work: Locust/k6) | – |

**Interpretation & threats to validity:** persona-based evaluation shares vocabulary with the taxonomy used to
tag opportunities, so it measures retrieval consistency rather than real user satisfaction. Patent analytics
run on synthetic data. A user study (click-through/saves, collected in `recommendation_feedback`) is the
natural next step.

## 8. Testing
70 pytest tests (auth, RBAC, profile, funding, recommender, eligibility, scoring, commercialization,
analytics, notifications, reports, admin/imports) on an isolated database seeded with the real snapshots; an
E2E smoke script exercising 27 steps over HTTP; frontend production build; and a manual browser walkthrough of
every page for all four roles against the live API, including a 375 px phone-width check of every route. The
walkthrough found and fixed over a dozen defects (data quality, labels, ranking and responsive layout) that the
automated tests had not caught — a useful lesson for the report. Details: [TESTING.md](TESTING.md).

## 9. Limitations
* Innovation Score and pathway fits are heuristics, not validated predictors.
* Patent data is illustrative unless real exports are imported or PatentsView is configured (untested live).
* Grants.gov covers U.S. federal funding only; non-U.S. programmes in the demo are illustrative.
* OpenAlex keyless quota is small; trend counts are keyword-query proxies.
* In-process scheduler and in-memory metrics/throttling assume a single API instance.
* No native mobile app, WebSockets, message broker, vector DB or LLM features (listed in the spec's broader
  stack) — documented as future work.

## 10. Future work
Sentence-embedding retrieval (Sentence-Transformers + FAISS/pgvector) with TF-IDF as explainable fallback;
learning-to-rank from feedback; more official funding connectors (EU Funding & Tenders, UKRI, national portals);
real patent ingestion (PatentsView bulk, Lens); Celery/Redis jobs and e-mail digests; WebSocket notifications;
Prometheus/Grafana; load testing; accessibility audit; LLM-assisted summaries with citations.

## 11. Conclusion
The platform meets the brief's functional scope with an end-to-end, tested implementation that is honest about
data provenance and the heuristic nature of its scores, and that can be deployed with Docker on AWS or Azure.

## Appendix — milestone mapping (8-week plan)
| Milestone | Deliverables in this repository |
|---|---|
| M1 (weeks 1–2): setup, auth, profiles, datasets | Repo structure, models/migrations, JWT/RBAC, profile module, OpenAlex/Grants.gov snapshots |
| M2 (weeks 3–4): funding engine, research intelligence | Recommender + eligibility, funding UI, trend/emerging/hotspot analytics and dashboards |
| M3 (weeks 5–6): patents, technology, scoring, commercialization | Patent landscape, technology indices, Innovation Score, commercialization pathways |
| M4 (weeks 7–8): dashboards, reports, testing, deployment | Role dashboards, alerts, CSV/XLSX/PDF reports, admin console, tests, Docker/CI, documentation |
