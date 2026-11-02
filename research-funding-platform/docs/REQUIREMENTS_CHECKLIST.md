# Requirements Checklist (specification → implementation → verification)

Legend: ✅ implemented and verified by automated tests and/or live checks · ⚠️ implemented with a documented
limitation · ➖ intentionally out of scope (documented alternative)

Verification sources: **T** = backend pytest suite (70 tests), **E** = end-to-end smoke test on a live server
(27 steps), **B** = checked in the browser against the running stack, **D** = documented only.

Every user-facing module below (1–11 and the admin console) was also exercised in the browser against the live
API on 2026-10-27 (**B**); the walkthrough and the bugs it caught are listed in [TESTING.md](TESTING.md#browser-verification-built-app-served-by-vite-preview-against-the-live-api--seeded-sqlite).
Exceptions: social OAuth login, live PatentsView search and the Docker deployment could not be exercised here.

## 1. User authentication & role-based access
| Requirement | Implementation | Status |
|---|---|---|
| Registration & login | `POST /api/auth/register`, `/login`; `RegisterPage`, `LoginPage` | ✅ T E B |
| JWT authentication | `core/security.py` (HS256, expiry, jti), Bearer dependency | ✅ T |
| OAuth2 login | OAuth2 password flow `/api/auth/token` (Swagger *Authorize*); optional Google/GitHub authorization-code flow `services/oauth.py` | ⚠️ T — social login implemented but untested against live providers (needs client credentials) |
| Role-based access control | `require_roles`, object-level checks; roles researcher / startup founder / innovation manager / administrator | ✅ T E |
| User profile management | `PATCH /api/users/me`, change password, export data, delete account; `SettingsPage` | ✅ T |

## 2. Research profile management
| Requirement | Implementation | Status |
|---|---|---|
| Profile creation, organisation info | `GET/PUT /api/profile`, completeness score | ✅ T E |
| Research interests: domains, keywords, technology areas | shared 15-area taxonomy, validated | ✅ T |
| Publication management | CRUD `/api/profile/publications`, DOI import (Crossref → OpenAlex fallback) | ✅ T (DOI live lookup ⚠️ needs internet) |
| Patents | CRUD `/api/profile/patents` (CPC → domain mapping) | ✅ T |
| Academic profile tracking | h-index, i10, citations, publications by year (`/api/research/my-analytics`) | ✅ T |
| Research history | CRUD `/api/profile/history` | ✅ T |

## 3. Funding opportunity discovery
| Requirement | Implementation | Status |
|---|---|---|
| Opportunity collection | Grants.gov connector + snapshot (93 verified), illustrative calls (49), admin CSV/JSON import, manager-created internal calls | ✅ T E |
| Funding sources: government grants, research councils, innovation funds, accelerators, venture programmes, international agencies | `funder_type` enum + facets | ✅ T (non-U.S. sources are illustrative ⚠️) |
| Grant search | `/api/funding` search/filters/sort/pagination + facets | ✅ T E |
| Eligibility matching | `services/eligibility.py` (deadline, applicant type, country/EU, career stage) | ✅ T |
| Recommendation engine | `services/recommender.py` (TF-IDF + cosine + domain + eligibility) | ✅ T E |
| Funding alerts | `funding_match`, `funding_deadline` alerts (`services/alerts.py`) | ✅ T E |

## 4. Research trend intelligence
| Requirement | Implementation | Status |
|---|---|---|
| Publication trend analysis | OpenAlex yearly counts per area, CAGR, trend labels | ✅ T E |
| Emerging topic detection | windowed term-growth analysis | ✅ T E |
| Research hotspot identification | K-means clusters + hotspot score | ✅ T E |
| Domain trend monitoring | per-domain series & growth table; weekly trend alerts | ✅ T |
| Citation analytics | by year/domain, distribution, top cited | ✅ T |
| Sources: papers, publications, open repositories | OpenAlex (incl. preprints), Crossref | ✅ (Semantic Scholar ➖ not integrated) |

## 5. Patent landscape analysis
| Requirement | Implementation | Status |
|---|---|---|
| Patent search | `/api/patents` (text, assignee, CPC, domain, status, years) | ✅ T |
| Patent clustering | TF-IDF + K-means (silhouette-selected k) + SVD map | ✅ T E |
| Patent trend analysis | filings per year/domain | ✅ T |
| Competitor patent analysis | assignee ranking, 2–5 competitor comparison | ✅ T |
| Innovation mapping | domain × assignee heat-map, cluster map | ✅ T |
| Patent info: title, assignee, filing date, classification, domain, citations | `patents` table | ✅ |
| Real patent data | Google Patents / Lens CSV import; PatentsView live search with key | ⚠️ shipped patents are illustrative; PatentsView untested without key |

## 6. Technology intelligence
| Requirement | Implementation | Status |
|---|---|---|
| Emerging technology identification | emerging score (publication + patent growth) | ✅ T E |
| Technology maturity analysis | maturity index + stage | ✅ T |
| Technology adoption tracking | cumulative filings, assignee diversity, adoption index | ✅ T |
| Innovation opportunity discovery | white-space opportunity score + rationale | ✅ T E |
| Competitive technology monitoring | assignee share & momentum per area | ✅ T |

## 7. Innovation scoring engine
| Requirement | Implementation | Status |
|---|---|---|
| Innovation potential, research impact, technology readiness, commercial viability, funding attractiveness scoring | five components in `services/scoring.py` | ✅ T E |
| Weighted model 30/20/15/20/15 | `WEIGHTS` (test asserts exact values) | ✅ T |
| 0–100 normalisation, overall + breakdown + explanation | component factors, band, explanation, history, what-if | ✅ T E |
| Heuristic disclaimer | returned by API, shown in UI and reports | ✅ T |

## 8. Commercialization recommendations
| Requirement | Implementation | Status |
|---|---|---|
| Commercialization analysis | pathway fit scores from score components | ✅ T E |
| Productization recommendations | domain-specific idea starters | ✅ T |
| Licensing opportunities | licensing pathway + licensing targets (assignees with similar patents) | ✅ T (targets derive from illustrative patents ⚠️) |
| Startup creation recommendations | startup pathway + next steps | ✅ T |
| Industry partnership suggestions | partnership pathway + industry/academic partners | ✅ T |

## 9. Dashboards & analytics
| Requirement | Implementation | Status |
|---|---|---|
| Researcher dashboard (recommendations, trends, publication analytics, patent insights, innovation score) | `GET /api/dashboard` view `researcher` | ✅ T |
| Startup dashboard (funding, technology opportunities, patent intelligence, commercialization) | view `startup` | ✅ T |
| Innovation manager dashboard (portfolio, pipeline, technology trends, funding analytics) | view `manager`, `/api/innovation/portfolio`, Portfolio page | ✅ T |
| Admin dashboard (users, platform analytics, recommendation monitoring, system reports) | view `admin`, `/api/admin/*` | ✅ T E |

## 10. Notifications & alerts
| Requirement | Implementation | Status |
|---|---|---|
| New funding, patent monitoring, emerging technology, research trend, commercialization alerts, platform notifications | 7 alert types, dedupe keys, preferences, broadcasts | ✅ T E |
| Background processing | asyncio scheduler + job history + manual run | ✅ T (single-instance ⚠️) |
| Real-time delivery | 60-second polling (WebSockets ➖) | ⚠️ |

## 11. Reports & export
| Requirement | Implementation | Status |
|---|---|---|
| Funding, patent, research trend, innovation, commercialization reports | `services/reports.py` | ✅ T |
| PDF export / Excel export (+ CSV) | ReportLab / openpyxl / pandas | ✅ T E |

## 12. Integration, testing & deployment
| Requirement | Implementation | Status |
|---|---|---|
| Frontend–backend integration | axios client against the REST API, Vite proxy, nginx proxy; every page exercised in a browser against the live API, all routes checked at 375 px | ✅ B (see TESTING.md) |
| API validation & testing | Pydantic validation, 70 pytest tests, OpenAPI docs | ✅ T |
| End-to-end workflow testing | `tests/e2e_smoke.py` (27 steps) | ✅ E |
| Security testing | RBAC/negative tests, throttling, token tests | ✅ T |
| Performance | cached TF-IDF/cluster/evaluation results, metrics middleware | ✅ (no load test ➖) |
| Docker containerization | backend & frontend Dockerfiles, Compose with PostgreSQL | ⚠️ D — not built locally (Docker unavailable) |
| Production deployment (AWS/Azure) | documented in DEPLOYMENT.md | ⚠️ D |
| Monitoring & logging | request/audit/job logs, Admin → System metrics, health endpoint | ✅ T |
| Documentation & user guides | `README.md`, `docs/*` | ✅ |

## Security & compliance / system management (architecture diagram modules 11–12)
| Requirement | Implementation | Status |
|---|---|---|
| Data security, access control, audit logs | bcrypt, JWT, RBAC, `audit_logs` + admin viewer | ✅ T |
| Compliance / data privacy | personal data export, account anonymisation, provenance labels | ✅ T |
| System configuration, data management, API management, background jobs, monitoring | Admin → System/Datasets/Jobs, OpenAPI | ✅ T |

## Intentionally out of scope (spec's broader technology list)
MongoDB, Elasticsearch, FAISS/vector DB, Sentence-Transformers/Hugging Face, LangChain/OpenAI, XGBoost,
TensorFlow/PyTorch, Next.js, Kubernetes, Kafka/RabbitMQ, ELK/Prometheus/Grafana, native mobile app. The build
brief fixed the stack to FastAPI + React + PostgreSQL + scikit-learn; these are listed as future work in the
capstone report.
