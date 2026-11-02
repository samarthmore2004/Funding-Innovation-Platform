# API Reference (REST contract)

Base URL: `http://localhost:8000/api` (interactive Swagger UI at `http://localhost:8000/docs`, ReDoc at `/redoc`).

> This document was written first as the contract between the backend and the frontend and was kept in sync
> with the implementation (86 paths / 100 operations). The live OpenAPI schema is authoritative; a snapshot is
> committed as [`openapi.json`](openapi.json) — import it into **Postman** (*Import → File*) or any OpenAPI
> client. Some responses contain extra convenience fields not listed here (e.g. `funder_type_label`,
> `domain_labels` on funding details, `notes` on report previews, `actions` on audit-log pages).

* All request/response bodies are JSON unless stated otherwise.
* Authentication: `Authorization: Bearer <JWT>` header. Tokens come from `/api/auth/login`, `/api/auth/register`, the OAuth2 password endpoint `/api/auth/token`, or an optional social OAuth2 login.
* Errors use FastAPI's shape: `{"detail": "message"}` (or `{"detail": [ {loc, msg, type}, ... ]}` for 422 validation errors).
* Paginated endpoints return `{"items": [...], "total": int, "page": int, "page_size": int, "pages": int}`.
* Dates are ISO-8601 strings (`YYYY-MM-DD` for dates, full timestamps for datetimes, UTC).
* Roles: `researcher`, `startup_founder`, `innovation_manager`, `admin`.

## Shared enumerations

| Name | Values |
|---|---|
| role | `researcher`, `startup_founder`, `innovation_manager`, `admin` |
| funder_type | `government_grant`, `research_council`, `innovation_fund`, `startup_accelerator`, `venture_program`, `international_agency` |
| funding status | `open`, `forecasted`, `closed`, `rolling` |
| record_type (funding) | `verified` (fetched from an official source, has `source_url` + `verified_at`), `illustrative` (synthetic demo record, no official source), `imported` (uploaded by an admin), `internal` (created in-app by a manager/admin) |
| record_type (patent) | `illustrative`, `imported`, `live`, `user` |
| applicant type | `researcher`, `startup`, `university`, `enterprise`, `nonprofit`, `government` |
| organization_type | `university`, `research_institute`, `startup`, `enterprise`, `government`, `nonprofit`, `other` |
| career_stage | `student`, `early_career`, `mid_career`, `senior`, `industry` |
| project stage | `idea`, `research`, `prototype`, `pilot`, `market_ready` |
| market_size | `niche`, `medium`, `large`, `very_large` |
| notification type | `funding_match`, `funding_deadline`, `patent_alert`, `tech_alert`, `trend_update`, `commercialization`, `system` |
| saved funding status | `interested`, `preparing`, `submitted`, `awarded`, `rejected` |
| report type | `funding`, `patents`, `research_trends`, `innovation`, `commercialization` |
| report format | `csv`, `xlsx`, `pdf` |

Technology areas / research domains use a fixed taxonomy of keys (see `GET /api/profile/options`), e.g. `ai_ml`, `nlp`, `computer_vision`, `quantum`, `clean_energy`, `biotech`, `digital_health`, `robotics`, `iot_edge`, `cybersecurity`, `advanced_materials`, `climate_tech`, `semiconductors`, `agritech`, `blockchain_fintech`.

## Object shapes

```jsonc
// UserOut
{ "id": 1, "email": "a@b.com", "full_name": "A B", "role": "researcher", "organization": "X University",
  "is_active": true, "auth_provider": "local", "created_at": "...", "last_login_at": "...",
  "notification_preferences": { "in_app": true, "deadline_reminder_days": 14,
     "alert_types": ["funding_match","funding_deadline","patent_alert","tech_alert","trend_update","commercialization","system"] } }

// TokenOut
{ "access_token": "jwt", "token_type": "bearer", "expires_in": 28800, "user": UserOut }

// ProfileOut
{ "id": 1, "user_id": 1, "headline": "", "bio": "", "department": "", "organization_name": "", "organization_type": "university",
  "country": "India", "career_stage": "mid_career", "research_domains": ["ai_ml"], "keywords": ["federated learning"],
  "technology_areas": ["digital_health"], "orcid": "", "website": "", "google_scholar_url": "", "updated_at": "...",
  "completeness": 80,
  "stats": { "publications": 4, "patents": 1, "citations": 120, "h_index": 3, "history_entries": 2 } }

// PublicationOut
{ "id": 1, "title": "", "abstract": "", "authors": ["..."], "venue": "", "year": 2023, "publication_date": "2023-05-01",
  "doi": "10.x/y", "url": "https://doi.org/...", "citation_count": 10, "domain": "ai_ml", "keywords": ["..."],
  "pub_type": "journal-article", "source": "openalex|crossref|manual|imported", "external_id": "W123", "is_own": false }

// PatentOut
{ "id": 1, "patent_number": "ILLUS-AI-0001", "title": "", "abstract": "", "assignee": "", "inventors": ["..."],
  "filing_date": "2021-03-04", "grant_date": null, "status": "granted|pending|expired", "classification": "G06N 3/08",
  "technology_domain": "ai_ml", "citation_count": 12, "jurisdiction": "US", "keywords": [], "source": "illustrative-generator",
  "record_type": "illustrative", "url": null, "is_own": false }

// FundingOut
{ "id": 1, "title": "", "organization": "", "funder_type": "government_grant", "description": "", "domains": ["ai_ml"],
  "keywords": [], "eligibility_text": "", "applicant_types": ["university","nonprofit"], "eligible_countries": ["United States"],
  "career_stages": [], "min_amount": null, "max_amount": 500000, "currency": "USD", "open_date": "2026-01-01",
  "deadline": "2027-02-10", "status": "open", "source_name": "Grants.gov", "source_url": "https://www.grants.gov/search-results-detail/320753",
  "record_type": "verified", "verified_at": "2026-10-27T10:00:00Z", "external_id": "320753", "days_until_deadline": 106,
  "created_at": "..." }

// EligibilityOut
{ "status": "eligible|partially_eligible|ineligible|unknown", "score": 0.75,
  "checks": [ { "criterion": "Applicant type", "passed": true, "detail": "..." } ] }   // passed may be null = not enough info

// RecommendationOut
{ "funding": FundingOut, "match_score": 78.4, "similarity": 0.31, "eligibility": EligibilityOut,
  "matched_terms": ["machine learning", "health"], "reasons": ["Strong topical overlap: machine learning, health", "..."] }

// ProjectOut
{ "id": 1, "owner_id": 2, "owner_name": "", "title": "", "description": "", "domain": "ai_ml", "keywords": [],
  "stage": "prototype", "trl": 4, "market_size": "large", "target_market": "", "patents_filed": 1, "patents_granted": 0,
  "team_size": 4, "has_industry_partner": false, "latest_score": ScoreOut|null, "created_at": "...", "updated_at": "..." }

// ScoreOut
{ "id": 10, "project_id": 1, "overall": 67.2, "band": "Promising",           // High (>=75) | Promising (>=60) | Developing (>=40) | Early (<40)
  "components": [ { "key": "research_novelty", "label": "Research Novelty", "weight": 0.30, "value": 72.0, "weighted": 21.6,
                    "explanation": "...", "factors": [ { "name": "...", "value": 0.42, "detail": "..." } ] }, ... 5 items ],
  "weights": { "research_novelty": 0.30, "patent_strength": 0.20, "technology_maturity": 0.15, "market_potential": 0.20, "funding_relevance": 0.15 },
  "explanation": "summary sentence", "disclaimer": "Heuristic decision-support score ...", "created_at": "..." }

// NotificationOut
{ "id": 1, "type": "funding_deadline", "title": "", "message": "", "link": "/app/funding/12", "priority": "low|normal|high",
  "is_read": false, "created_at": "..." }

// TechAreaOut
{ "key": "quantum", "name": "Quantum Computing & Technologies", "description": "",
  "publication_count": 12000, "publication_cagr": 8.1, "patent_count": 40, "patent_cagr": 22.0, "funding_count": 6,
  "maturity_index": 34.0, "maturity_stage": "Emerging|Growing|Maturing|Established",
  "emerging_score": 81.0, "adoption_index": 25.0, "opportunity_score": 70.0, "assignee_count": 9, "top_assignees": ["..."] }
```

## Endpoints

### System
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | – | `{status, database, version, time}` |

### Authentication (`/api/auth`)
| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| POST | `/register` | – | `{email, password, full_name, role (not admin), organization?}` | 201 `TokenOut` |
| POST | `/login` | – | `{email, password}` | `TokenOut` (401 bad credentials, 403 inactive, 429 too many attempts) |
| POST | `/token` | – | form `username`, `password` (OAuth2 password flow, used by Swagger "Authorize") | `{access_token, token_type}` |
| GET | `/me` | user | – | `UserOut` |
| POST | `/change-password` | user | `{current_password, new_password}` | `{detail}` |
| GET | `/oauth/providers` | – | – | `{providers: [{name: "google"|"github", label, enabled}]}` |
| GET | `/oauth/{provider}/login` | – | – | 302 to provider (404 if not configured) |
| GET | `/oauth/{provider}/callback` | – | `code`, `state` | 302 to `{FRONTEND_URL}/oauth/callback#access_token=...` (or `#error=...`) |

Password rules: 8–72 characters, at least one letter and one digit.

### Account (`/api/users`)
| Method | Path | Body | Response |
|---|---|---|---|
| PATCH | `/me` | `{full_name?, organization?, notification_preferences?}` | `UserOut` |
| GET | `/me/export` | – | JSON file download of all personal data |
| POST | `/me/delete` | `{password}` | `{detail}` – anonymises and deactivates the account |

### Research profile (`/api/profile`)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/options` | – | `{domains: [{key, name}], technology_areas: [{key,name}], organization_types: [..], career_stages: [..], countries: [..], applicant_types: [..]}` |
| GET | `` (i.e. `/api/profile`) | – | `ProfileOut` (created empty on first access) |
| PUT | `` | ProfileOut fields (all optional except lists default `[]`) | `ProfileOut` |
| GET | `/publications` | – | `[PublicationOut]` (own) |
| POST | `/publications` | `{title, abstract?, authors?, venue?, year?, publication_date?, doi?, url?, citation_count?, domain?, keywords?, pub_type?}` | 201 `PublicationOut` |
| PUT | `/publications/{id}` | same | `PublicationOut` |
| DELETE | `/publications/{id}` | – | 204 |
| GET | `/publications/lookup?doi=` | – | `{found, source: "crossref"|"openalex", publication: {...PublicationIn}}`; 404 if not found, 503 if external API unavailable |
| GET/POST | `/patents`, PUT/DELETE `/patents/{id}` | `{patent_number?, title, abstract?, assignee?, inventors?, filing_date?, grant_date?, status?, classification?, technology_domain?, citation_count?, jurisdiction?, url?}` | `PatentOut` (`record_type: "user"`) |
| GET/POST | `/history`, PUT/DELETE `/history/{id}` | `{kind: position|project|grant|education|award, title, role?, institution?, start_year?, end_year?, description?}` | `{id, kind, title, role, institution, start_year, end_year, description}` |

### Funding discovery (`/api/funding`)
| Method | Path | Auth | Query / Body | Response |
|---|---|---|---|---|
| GET | `` | user | `q, funder_type, domain, country, status, record_type, applicant_type, deadline_after, deadline_before, min_amount, include_closed (bool, default false), sort (deadline|amount|newest|title|relevance), page (1), page_size (12, max 100)` | paginated `FundingOut` |
| GET | `/facets` | user | – | `{funder_types: [{value,label,count}], domains: [{value,label,count}], countries: [{value,count}], statuses: [{value,count}], record_types: [{value,count}]}` |
| GET | `/saved` | user | – | `[{id, funding: FundingOut, status, notes, created_at, updated_at}]` |
| PATCH | `/saved/{saved_id}` | user | `{status?, notes?}` | saved item |
| GET | `/{id}` | user | – | `FundingOut` + `{eligibility: EligibilityOut, match: {match_score, similarity, matched_terms}, saved: savedItem|null}` |
| POST | `/{id}/save` | user | `{status?: "interested", notes?}` | saved item |
| DELETE | `/{id}/save` | user | – | 204 |
| POST | `` | innovation_manager, admin | FundingOut fields (record_type forced to `internal`) | 201 `FundingOut` |
| PUT | `/{id}` | innovation_manager, admin | same | `FundingOut` |
| DELETE | `/{id}` | admin | – | 204 |

### Recommendations (`/api/recommendations`)
| Method | Path | Query / Body | Response |
|---|---|---|---|
| GET | `` | `limit (10), include_ineligible (false), funder_type?, min_score (0)` | `{generated_at, profile_completeness, profile_terms: [str], items: [RecommendationOut], notes: [str]}` |
| GET | `/project/{project_id}` | `limit` | same shape, matched against the innovation project text |
| POST | `/feedback` | `{funding_id, action: "clicked"|"saved"|"dismissed"}` | `{detail}` |

### Research trend intelligence (`/api/research`)
| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/overview` | – | `{total_publications, total_citations, avg_citations, domains_covered, year_range: [min,max], top_domain, sources: [{source, count}]}` |
| GET | `/trends` | `domains` (comma list, default = user's domains or top 5), `start_year`, `end_year` | `{domains: [{key,name}], series: [{year, <key>: count...}], growth: [{domain, name, cagr, total, recent, trend: "rising"|"stable"|"declining"}], source: "openalex_snapshot"|"local_corpus", retrieved_at}` |
| GET | `/emerging-topics` | `domain?, limit (15)` | `{items: [{term, recent_count, previous_count, growth_rate, score, domains: [str]}], window: {recent: [y1,y2], previous: [y0,y1]}, method}` |
| GET | `/hotspots` | `limit (8)` | `{items: [{label, top_terms, size, avg_citations, recent_share, hotspot_score, domain, sample_titles}], method}` |
| GET | `/citations` | `domain?` | `{by_year: [{year, publications, citations, avg_citations}], by_domain: [{domain, name, publications, citations, avg_citations}], distribution: [{bucket, count}], top_cited: [PublicationOut]}` |
| GET | `/publications` | `q, domain, year_from, year_to, sort (citations|year|title), page, page_size` | paginated `PublicationOut` |
| GET | `/live-trend` | `query` (required), `start_year`, `end_year` | `{query, source: "openalex"|"local_fallback", series: [{year, count}], total, fetched_at, note}` |
| GET | `/my-analytics` | – | `{total_publications, total_citations, h_index, i10_index, by_year: [{year, publications, citations}], top: [PublicationOut], by_domain: [{domain, count}]}` |

### Patent landscape (`/api/patents`)
| Method | Path | Query | Response |
|---|---|---|---|
| GET | `` | `q, assignee, classification, domain, status, year_from, year_to, sort (filing_date|citations|title), page, page_size` | paginated `PatentOut` |
| GET | `/facets` | – | `{domains: [{value,label,count}], assignees: [{value,count}], classifications: [{value,count}], statuses: [{value,count}], record_types: [{value,count}]}` |
| GET | `/analytics/trends` | `domain?` | `{domains: [{key,name}], series: [{year, total, <key>: n}]}` |
| GET | `/analytics/assignees` | `domain?, limit (10)` | `{items: [{assignee, patents, citations, avg_citations, top_domain, domains: {key: n}, first_year, last_year, recent_share}]}` |
| GET | `/analytics/competitors` | `assignees` (comma list, 2–5) | `{assignees: [str], by_year: [{year, <assignee>: n}], by_domain: [{domain, name, <assignee>: n}], summary: [{assignee, patents, citations, avg_citations, top_classifications: [str], growth}]}` |
| GET | `/analytics/clusters` | `domain?, k?` (auto 3–8 by silhouette) | `{k, silhouette, clusters: [{id, label, top_terms, size, top_assignees, avg_citations}], points: [{id, x, y, cluster, title, assignee}]}` |
| GET | `/analytics/innovation-map` | – | `{domains: [{key,name}], assignees: [str], cells: [{domain, assignee, count}]}` |
| GET | `/live-search` | `q` | `{source: "patentsview", items: [PatentOut], note}`; 503 with explanation if `PATENTSVIEW_API_KEY` is not configured |
| GET | `/{id}` | – | `PatentOut` + `{similar: [PatentOut]}` |

### Technology intelligence (`/api/technology`)
| Method | Path | Response |
|---|---|---|
| GET | `/areas` | `{items: [TechAreaOut], notes: [str]}` |
| GET | `/areas/{key}` | `TechAreaOut` + `{publication_series: [{year,count}], patent_series: [{year,count}], top_assignee_details: [{assignee, patents, recent_patents}], funding: [FundingOut], top_publications: [PublicationOut], keywords: [str]}` |
| GET | `/emerging` | `{items: [TechAreaOut sorted by emerging_score desc]}` |
| GET | `/opportunities` | `{items: [{key, name, opportunity_score, research_momentum, patent_density, funding_availability, rationale: [str]}]}` |
| GET | `/adoption` | `{areas: [{key,name}], series: [{year, <key>: cumulative patent filings}], assignee_diversity: [{key, name, assignees}]}` |
| GET | `/competitive?area=` | `{area, name, assignees: [{assignee, patents, recent_patents, share, momentum}]}` |

### Innovation scoring (`/api/innovation`)
| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/weights` | user | – | `{weights, labels, formula, disclaimer}` |
| GET | `/projects?scope=mine|all` | user (`all` → manager/admin) | – | `[ProjectOut]` |
| POST | `/projects` | user | `{title, description, domain, keywords, stage, trl (1-9), market_size, target_market?, patents_filed, patents_granted, team_size?, has_industry_partner}` | 201 `ProjectOut` |
| GET | `/projects/{id}` | owner, manager, admin | – | `ProjectOut` + `{score_history: [ScoreOut]}` |
| PUT | `/projects/{id}` | owner, admin | as POST | `ProjectOut` |
| DELETE | `/projects/{id}` | owner, admin | – | 204 |
| PATCH | `/projects/{id}/stage` | owner, manager, admin | `{stage}` | `ProjectOut` |
| POST | `/projects/{id}/score` | owner, manager, admin | – | `ScoreOut` (persisted) |
| POST | `/score-preview` | user | project body | `ScoreOut` (not persisted, what-if analysis) |
| GET | `/portfolio` | user (managers/admins see all projects, others their own) | – | `{projects_count, scored_count, avg_score, by_stage: [{stage, count, avg_score}], by_domain: [{domain, name, count, avg_score}], score_distribution: [{bucket, count}], top_projects: [ProjectOut], pipeline: {idea: [ProjectOut], research: [...], prototype: [...], pilot: [...], market_ready: [...]}}` |

**Formula** — `Innovation Score = 0.30·Research Novelty + 0.20·Patent Strength + 0.15·Technology Maturity + 0.20·Market Potential + 0.15·Funding Relevance`, each component normalised to 0–100. It is a heuristic decision-support score, not a validated prediction of commercial success.

### Commercialization (`/api/commercialization`)
| Method | Path | Response |
|---|---|---|
| GET | `/overview` | `{items: [{project_id, title, overall, band, top_pathway, top_pathway_title, fit_score}]}` (own projects; all for manager/admin) |
| GET | `/projects/{id}` | `{project: ProjectOut, score: ScoreOut, summary, pathways: [{key: "licensing"|"startup"|"productization"|"industry_partnership"|"grant_research", title, fit_score, recommended, rationale: [str], next_steps: [str]}], productization_ideas: [{title, description}], licensing_targets: [{assignee, patents, relevance}], partners: [{name, type: "industry"|"academic", reason}], funding: [RecommendationOut], risks: [str]}` |

### Dashboard (`/api/dashboard`)
`GET /api/dashboard` returns the payload for the caller's role (`view` is one of `researcher`, `startup`, `manager`, `admin`). Admins and managers may pass `?view=researcher|startup|manager|admin` (admin only for `admin`) to preview another dashboard.

```jsonc
// common
{ "view": "researcher", "user": UserOut, "kpis": [ { "key": "...", "label": "...", "value": 12, "hint": "..." } ] , ... }
// researcher view adds
"recommendations": [RecommendationOut x5], "research_trends": { domains, series, growth }, "publication_analytics": /research/my-analytics payload,
"patent_insights": { "top_assignees": [...assignee items], "recent_patents": [PatentOut x5] }, "innovation": { "projects": [ProjectOut], "avg_score": 61.2 },
"upcoming_deadlines": [FundingOut]
// startup view adds
"funding_opportunities": [RecommendationOut x6], "technology_opportunities": [opportunity items x5], "patent_intelligence": { "competitors": [...assignee items], "recent_patents": [PatentOut x5] },
"commercialization": [overview items], "upcoming_deadlines": [FundingOut]
// manager view adds
"portfolio": /innovation/portfolio payload, "technology_trends": [TechAreaOut x6],
"funding_analytics": { "by_funder_type": [{type, label, count, total_max_amount}], "deadlines_by_month": [{month: "2026-11", count}], "by_record_type": [{value, count}], "by_status": [{value, count}] }
// admin view adds
"platform": /admin/analytics payload, "recommendation_monitoring": /admin/recommendation-monitoring payload, "system": /admin/system payload
```

### Notifications (`/api/notifications`)
| Method | Path | Query/Body | Response |
|---|---|---|---|
| GET | `` | `unread_only, type, page, page_size` | paginated `NotificationOut` + `unread_count` |
| GET | `/unread-count` | – | `{unread_count}` |
| POST | `/{id}/read` | – | `NotificationOut` |
| POST | `/read-all` | – | `{updated}` |
| DELETE | `/{id}` | – | 204 |
| POST | `/refresh` | – | `{created, by_type: {type: n}}` – runs the alert engine for the current user |

### Reports & export (`/api/reports`)
| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/types` | – | `[{key, title, description, formats: ["csv","xlsx","pdf"], params: [str]}]` |
| GET | `/history` | – | `[{id, report_type, format, filename, row_count, created_at}]` |
| GET | `/{type}/preview` | `domain?, project_id?` | `{title, generated_at, summary: [{label, value}], columns: [str], rows: [[...]], total_rows}` |
| GET | `/{type}/download` | `format (csv|xlsx|pdf), domain?, project_id?` | file download (`Content-Disposition: attachment`) |

### Administration (`/api/admin`, admin role only)
| Method | Path | Query/Body | Response |
|---|---|---|---|
| GET | `/users` | `q, role, is_active, page, page_size` | paginated `UserOut` + `{projects_count}` |
| PATCH | `/users/{id}` | `{role?, is_active?}` | `UserOut` (admins cannot demote/deactivate themselves) |
| GET | `/analytics` | – | `{users_total, active_users, users_by_role: [{role, count}], registrations_by_day: [{date, count}], logins_by_day: [{date, count}], projects_total, funding_total, publications_total, patents_total, reports_generated, reports_by_type: [{type, count}], notifications_total, recommendations_served}` |
| GET | `/recommendation-monitoring` | – | `{served_total, unique_users, avg_match_score, feedback: {clicked, saved, dismissed}, engagement_rate, by_day: [{date, count, avg_score}], top_recommended: [{funding_id, title, count}], evaluation: {precision_at_k, recall_at_k, k, eligibility_accuracy, personas, method}, recent: [{user_email, funding_title, match_score, created_at}]}` |
| GET | `/datasets` | – | `{datasets: [{key, label, count, by_source: [{source, count}], by_record_type: [{value,count}], last_updated, description, importable: bool}], imports: [ImportOut]}` |
| GET | `/datasets/{key}/template` | – | CSV template download (`funding`, `publications`, `patents`) |
| POST | `/datasets/{key}/import` | multipart `file` (.csv or .json) | `ImportOut {id, dataset, filename, source, status: "completed"|"partial"|"failed", rows_total, rows_imported, rows_failed, errors: [str], created_at, user_email}` |
| POST | `/datasets/funding/sync-grantsgov` | `{keywords?: [str], limit_per_keyword?: 10}` | `ImportOut` (live Grants.gov; returns failed import with message when offline) |
| POST | `/datasets/publications/sync-openalex` | `{query, domain, limit?: 25}` | `ImportOut` |
| GET | `/audit-logs` | `action, q, page, page_size` | paginated `{id, user_email, action, entity_type, entity_id, detail, ip_address, created_at}` |
| GET | `/system` | – | `{version, environment, database: {dialect, ok}, uptime_seconds, metrics: {requests_total, errors_total, avg_latency_ms, p95_latency_ms, by_route: [{route, count, avg_ms, p95_ms, errors}]}, jobs: [{name, last_run_at, last_status, last_detail, interval_minutes, enabled}], integrations: [{name, enabled, detail}], config: {...non-secret settings}}` |
| POST | `/jobs/{name}/run` | – (`alerts`, `grantsgov_sync`) | `{name, status, detail, started_at, finished_at}` |
| POST | `/notifications/broadcast` | `{title, message, roles?: [role]}` | `{created}` |
