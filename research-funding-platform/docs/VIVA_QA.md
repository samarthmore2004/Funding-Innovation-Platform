# Viva Questions & Answers

## Architecture & design
**1. Why a single FastAPI service rather than the microservices shown in the spec diagram?**
The modules share one database and one team; a modular monolith (one package per module, clear service layer)
is simpler to build, test and deploy. Boundaries are clean (`services/<module>.py`, separate routers), so modules
could be extracted into services behind an API gateway if load or team size required it.

**2. Why PostgreSQL *and* SQLite?**
PostgreSQL is the production/Docker database required by the brief. SQLite gives a zero-install development
setup on Windows. The schema avoids dialect-specific types (lists are `JSON` columns, timestamps are naive UTC)
and the same Alembic migration runs on both; the PostgreSQL DDL is committed in `docs/schema_postgresql.sql` and
CI applies the migration and seed to a real PostgreSQL service.

**3. How are migrations handled?**
Alembic with a naming convention for constraints (portable ALTERs) and `render_as_batch` on SQLite. The initial
revision `0001` creates 17 tables; `alembic upgrade head` is run by the Docker entrypoint before the seed.

**4. Why is MongoDB/Elasticsearch/FAISS not used although listed in the brief?**
The user brief for this build specified PostgreSQL + scikit-learn; the data is structured and small (hundreds to
thousands of rows), so TF-IDF in memory answers queries in milliseconds. FAISS/pgvector and Elasticsearch are
documented as scale-up options.

## Recommendation engine
**5. Explain the funding recommendation pipeline.**
Build a query text from the profile (keywords weighted ×2, taxonomy expansion of domains, publication titles),
vectorise opportunities with TF-IDF (uni+bi-grams, sublinear tf, domain stop-words), compute cosine similarity,
apply eligibility rules, then `match = 100(0.65·relevance + 0.15·domain_overlap + 0.20·eligibility)` where
`relevance = 1 − e^(−sim/0.12)`.

**6. Why the exponential relevance curve?**
TF-IDF cosine values for good matches are typically 0.1–0.4. A linear cap (e.g. sim/0.35) saturated many items
at 100 and destroyed ranking; the smooth curve keeps ordering information while mapping typical good matches to
0.6–0.95.

**7. How do you explain a recommendation?**
The top contributing n-grams are the largest entries of the element-wise product of the two TF-IDF vectors; we
also show domain overlap, deadline, amount and the eligibility checklist.

**8. How did you evaluate it?**
Offline, with one synthetic persona per technology area (taxonomy text) and relevance defined as area-tagged
active opportunities: precision@5 ≈ 0.95, recall@5 ≈ 0.97. Limitation: personas and tags share vocabulary, so
this measures consistency, not user satisfaction. Online feedback (clicked/saved/dismissed) is logged for future
evaluation.

**9. Cold start?**
Users with empty profiles get generic matches and an explicit note asking them to complete the profile;
completeness is shown as a percentage. Project-based matching uses the project text instead of the profile.

## Eligibility
**10. How does eligibility matching work?**
Deterministic rules on deadline/status, applicant type (from role + organisation type), country/region
(including EU membership) and career stage; each criterion is passed/failed/unknown. Failed → ineligible
(hidden by default), unknown → partially eligible. Grants.gov eligibility codes are mapped to applicant types.

## Innovation score
**11. State the formula.** `0.30·Research Novelty + 0.20·Patent Strength + 0.15·Technology Maturity +
0.20·Market Potential + 0.15·Funding Relevance`, each normalised to 0–100.

**12. How is research novelty computed?**
60 % textual novelty (1 − mean similarity to the 5 closest publications / 0.5), 25 % domain publication growth
(CAGR mapped from −5 %…+30 %), 15 % alignment with detected emerging terms.

**13. Is the score a prediction of success?**
No. It is a transparent heuristic for decision support; weights come from the brief, not from training data.
The UI shows every factor and a disclaimer. Validating it would need historical outcome data (funded/licensed/
spun-out projects).

**14. How did you test the score?**
Unit/API tests check weights sum to 1, overall = Σ weighted components, all components in 0–100, and
monotonicity (higher TRL → higher maturity; more granted patents → higher patent strength; larger market → higher
market potential).

## Analytics
**15. How are emerging topics detected?**
Document frequency of terms in the last five complete years vs the previous four, normalised by window size with
add-one smoothing; score = growth × √(recent count); generic academic words removed; minimum support 4 documents.

**16. How are patent clusters formed and evaluated?**
TF-IDF on titles/abstracts (patent boilerplate removed) → K-means for k = 3…8 → choose the best cosine
silhouette; plotted with truncated SVD. Silhouette ≈ 0.10 on the synthetic data — modest separation, typical for
short texts.

**17. What do the technology maturity and opportunity indices mean?**
Relative indicators: maturity rises with patent density, patent volume and the size of the existing literature,
and falls with very fast publication growth; opportunity (white space) rises with research momentum and funding availability and falls with patent
density. They compare areas inside the platform's data only.

## Data integrity
**18. Which data is real?**
Grants.gov opportunities (93, with official links and verification timestamps), OpenAlex works (692) and
OpenAlex yearly trend counts. Patents and some funding calls are illustrative and labelled everywhere.

**19. Why synthetic patents?**
No free keyless patent API exists (PatentsView, USPTO ODP and Lens need keys). Fabricating realistic patent
numbers would be misleading, so synthetic records use `ILLUS-*` numbers and invented assignees; real data can be
imported from Google Patents/Lens CSV or fetched live with a PatentsView key.

**20. What happens when external APIs are down?**
The app never depends on them at start-up (seeded from snapshots). Live features degrade gracefully: DOI lookup
returns a 503 with a "enter manually" message, live trends fall back to the local sample, syncs are logged as
failed while the snapshot remains in use.

## Security
**21. How are passwords stored?** bcrypt with 12 rounds (salted); inputs truncated to bcrypt's 72-byte limit
explicitly; policy requires 8–72 characters with letters and digits.

**22. How does authentication work?** Stateless HS256 JWT (sub, role, exp, jti) sent as a Bearer token; the
OAuth2 password endpoint lets Swagger authorise; optional Google/GitHub OAuth2 code flow with a signed `state`.

**23. How is RBAC enforced?** `require_roles(...)` FastAPI dependencies on routes plus object-level checks
(ownership for profile items/projects/notifications, manager/admin visibility for portfolios). Tests assert 403s.

**24. Other security controls?** Login throttling, audit logging, CORS allow-list, security headers, upload size
and row limits, escaped LIKE patterns, no secrets in the repo, refusal to start in production with a weak
secret, data export and account anonymisation for privacy.

## Engineering & deployment
**25. How is the project tested?** 70 pytest tests on an isolated seeded DB (external APIs disabled to test
fallbacks), an HTTP end-to-end smoke test (27 steps) and the frontend production build; CI runs tests on SQLite,
migration + seed on PostgreSQL and the frontend build.

**26. How would you deploy on AWS/Azure?** Push the backend/frontend images to ECR/ACR; run on ECS Fargate or
Azure Container Apps/App Service with RDS / Azure Database for PostgreSQL; secrets in Secrets Manager/Key Vault;
run `alembic upgrade head` as a release task; one instance runs the scheduler.

**27. How would you scale?** Multiple stateless API replicas (JWT), move the scheduler to a worker (Celery/RQ)
with Redis, cache analytics results, precompute embeddings, add read replicas, and move throttling/metrics to
Redis/Prometheus.

**28. What would you do with more time?** Embedding-based retrieval, learning-to-rank from feedback, more
official funding connectors, real patent ingestion, e-mail digests, WebSockets, load testing and a user study.
