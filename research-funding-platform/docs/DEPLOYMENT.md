# Deployment

## Docker Compose (recommended)
```powershell
Copy-Item .env.example .env
# edit .env: SECRET_KEY (32+ random chars), POSTGRES_PASSWORD, ENVIRONMENT=production, SEED_DEMO_USERS=false
docker compose up --build -d
docker compose logs -f backend
```
| Service | Image | Port | Notes |
|---|---|---|---|
| `db` | postgres:16-alpine | internal 5432 | data in the `pgdata` volume, health-checked |
| `backend` | built from `backend/Dockerfile` (context = repo root) | 8000 | entrypoint waits for the DB, runs `alembic upgrade head`, seeds idempotently (`SEED_ON_STARTUP=true`), starts uvicorn as a non-root user |
| `frontend` | built from `frontend/Dockerfile` (node build → nginx) | 8080 → 80 | serves the SPA and proxies `/api`, `/docs`, `/openapi.json` to the backend |

Useful commands:
```powershell
docker compose exec backend python -m app.seed.seed --reset   # reseed
docker compose exec backend pytest                             # (tests are not copied into the image by default)
docker compose down            # stop (keeps data)
docker compose down -v         # stop and delete the database volume
```
> Docker was **not available in the environment where this project was built**, so the images were not built
> there. The Dockerfiles follow standard patterns and the GitHub Actions workflow runs a PostgreSQL job
> (migrations + seed) and the frontend build on every push.

## Cloud deployment notes
### AWS
* **Simplest:** an EC2 instance (t3.small+) with Docker → `docker compose up -d`, security group open on 80/443,
  TLS via a reverse proxy (Caddy/nginx + Let's Encrypt) or an Application Load Balancer.
* **Managed:** push the two images to ECR; run them on ECS Fargate (or App Runner) with **Amazon RDS for
  PostgreSQL**; put secrets in Secrets Manager; set `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`,
  `FRONTEND_URL`, `OAUTH_REDIRECT_BASE_URL`. Run `alembic upgrade head` as a one-off task before rollout.
### Azure
* **App Service for Containers** (backend + frontend) with **Azure Database for PostgreSQL – Flexible Server**,
  secrets in Key Vault, or **Azure Container Apps** using the same images.
### Production checklist
- [ ] `ENVIRONMENT=production` (the API refuses weak/default `SECRET_KEY` values)
- [ ] `SEED_DEMO_USERS=false`; create the first administrator, e.g.
  `docker compose exec backend python -c "from app.db.session import SessionLocal; from app.models import User; from app.core.security import hash_password; db=SessionLocal(); db.add(User(email='you@org.com', full_name='Admin', role='admin', hashed_password=hash_password('<strong password>'))); db.commit()"`
- [ ] HTTPS everywhere; `CORS_ORIGINS` limited to the real frontend origin
- [ ] Run the scheduler in exactly one backend instance (`ENABLE_SCHEDULER=false` on the others)
- [ ] Database backups (RDS/Azure automated backups or `pg_dump` cron)
- [ ] Centralised logs (stdout → CloudWatch / Azure Monitor); optional Prometheus/Grafana in future work
- [ ] Optional keys: `OPENALEX_API_KEY`, `PATENTSVIEW_API_KEY`, Google/GitHub OAuth credentials

## Monitoring & logging
* Structured request logs (`rfip.http`), audit logs (`rfip.audit`), job logs (`rfip.jobs`) go to stdout.
* `GET /api/health` for liveness/readiness probes (also used by the Docker HEALTHCHECK).
* Admin → System shows uptime, request counts, average/p95 latency per route, error counts, job history and
  integration status (in-memory metrics, reset on restart).
