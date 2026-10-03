# BookIt deployment plan

This plan matches the current repository layout: a Next.js frontend in `frontend/`, an Express API in `backend/`, Prisma migrations, and PostgreSQL. It assumes Vercel for the frontend, Render for the API, and Supabase PostgreSQL. The providers are replaceable; the environment variables and release order remain the same.

## Target topology

| Component | Hosting | Production address | Notes |
| --- | --- | --- | --- |
| Next.js | Vercel project rooted at `frontend/` | `app.example.com` | Keep the frontend project root set to `frontend/` in the monorepo settings. |
| Express API | Render web service rooted at `backend/` | `api.example.com` | Use the repository `backend/Dockerfile`; health check `/health/ready`. |
| PostgreSQL | Supabase managed project | Provider connection string | Configure backups/PITR, TLS and connection limits before production data. |
| Scheduled jobs | One dedicated worker or one API instance | Private service | Do not run the in-process scheduler on every API replica. |

Use custom subdomains under the same registrable domain (for example `app.example.com` and `api.example.com`). The API authentication cookie is HttpOnly and uses `SameSite=Lax`; same-site subdomains avoid relying on third-party cookies. Keep HTTPS enabled and configure the API CORS allow-list with the exact frontend origin.

## Before the first deployment

1. **Resolve the database exposure gate.** `docs/PRODUCTION_READINESS.md` records that `bookit_backup.sql` and `backend/bookit_backup.sql` are in the repository. Remove the dumps from the current tree and Git history, rotate all credentials and personal data represented in them, and store protected backups outside Git. Do not proceed to production with those credentials active.
2. Review the migrations in `backend/prisma/migrations/`. Back up the target database, check that the migration history matches it, and rehearse the upgrade on a staging clone. Use `prisma migrate deploy`; it applies pending migrations without resetting data, but does not detect schema drift. Resolve drift before the release.
3. Set the Node runtime to Node 22, matching the Dockerfiles. CI is configured separately and must use the same major version as the deployed images.
4. Create a staging environment first, with separate database, OAuth client, Stripe test keys, email/SMS credentials and app domains. No production database should be used for previews.
5. Configure the frontend and API custom domains and HTTPS before enabling Google sign-in or payment callbacks. Register the exact callback/origin URLs at Google and Stripe.

## Hosting setup

### PostgreSQL (Supabase)

- Create separate staging and production projects.
- Copy the connection strings from the project’s **Connect** dialog; do not reuse example URLs or paste secret values into source control.
- Set `DATABASE_URL` to the runtime connection string suited to the API’s persistent connections. Set `DIRECT_URL` to a direct database connection for Prisma migrations. If the platform/network requires IPv4, select the provider’s session pooler option and use the exact username, host, port and database from its dialog.
- URL-encode special characters in passwords. Store both values in the hosting secret managers.
- Enable automated backups and point-in-time recovery if available; verify a restore into a separate database.

### API (Render)

- Create a Docker web service from the repository, with root directory `backend/` and Dockerfile `backend/Dockerfile` (or `Dockerfile` relative to the configured root, depending on the service form).
- Confirm the service starts the production `start` script, binds to `0.0.0.0`, and listens on the port injected by Render.
- Set the health check path to `/health/ready`; `/health` is a liveness response, while readiness checks the database.
- Add backend secrets and runtime settings from the matrix below. Configure Render’s deploy order/hook so `npx prisma migrate deploy` runs once before new API instances accept traffic.
- Keep the scheduled jobs disabled on horizontally scaled web instances. Initially use one separately controlled worker/scheduler after its single-instance behavior is verified.

### Frontend (Vercel)

- Import the monorepo as a Vercel project and set **Root Directory** to `frontend/`.
- Set `NEXT_PUBLIC_API_URL=https://api.example.com/api` for Preview and Production to their respective API environments. This variable is public by design and must contain no secret.
- Set the production domain to `app.example.com`; keep preview deployments isolated from production data and OAuth/payment credentials.
- Because Next.js standalone output is configured for the Docker deployment path, use Vercel’s native Next.js build integration for this project, not the frontend Dockerfile.

## Environment variables

| Variable | Where | Staging / production guidance |
| --- | --- | --- |
| `DATABASE_URL` | API | Runtime PostgreSQL connection string; secret. |
| `DIRECT_URL` | API and migration job | Direct PostgreSQL connection for Prisma; secret. |
| `JWT_SECRET` | API | Unique cryptographically random value, at least 32 characters; rotate staging and production independently. |
| `FRONTEND_URL` | API | Exact canonical frontend origin, e.g. `https://app.example.com`. |
| `FRONTEND_URLS` | API | Comma-separated exact allowed origins for production frontends only. Avoid wildcard origins with credentialed requests. |
| `BACKEND_URL` | API | Canonical API origin used by callback/email links, e.g. `https://api.example.com`. |
| `COOKIE_SAME_SITE` | API | `lax`; ensure production cookie configuration sets `Secure` over HTTPS. |
| `NEXT_PUBLIC_API_URL` | Frontend | `https://api.example.com/api`; public URL, no credentials. |
| Google OAuth client ID/secret | API and frontend as required by current integration | Use separate OAuth clients; authorize the deployed origin and exact callback. Client secret stays server-side. |
| Stripe secret and webhook secrets | API | Use test keys on staging; set the exact production webhook URL and validate signature delivery. |
| SMTP, SMS, push credentials | API | Configure only integrations enabled for the launch; secrets belong in provider secret storage. |
| `RUN_SCHEDULED_JOBS` | API | Leave off for replicated web service; enable only on the single designated worker if supported. |
| `CRON_SECRET` | API and scheduler | Long random secret shared by the scheduler and API; send it as `x-cron-secret` for internal job endpoints. |

Use the current `backend/.env.example` and `frontend/.env.example` as the authoritative variable names. Do not commit real `.env` files or paste secrets into deployment logs.

## Release sequence

1. Merge the reviewed application changes. CI should complete installation, schema validation, frontend/backend builds, and linting on Node 22.
2. Deploy the API to staging with scheduled jobs disabled. Run the one-time migration command against the staging database, then deploy the API image.
3. Verify `/health`, `/health/ready`, sign-in, service discovery after login, booking, cancellation, dashboard permissions, and all configured provider callbacks on staging.
4. Deploy the frontend to staging and verify credentialed API requests work across the two HTTPS subdomains. Check the browser network panel for CORS and cookie errors.
5. Take and verify a production database backup; run migrations once as a release step; deploy the API and then the frontend. Keep the prior images available for rollback.
6. Check readiness and error rates after rollout. Roll back application images if needed. If a migration is not backward-compatible, use its documented recovery plan; do not assume rolling back the app reverses data changes.
7. Enable one scheduler only after web instances and database health are stable. Call `POST /api/internal/no-show-sweep` and `POST /api/internal/refunds/retry` with the `x-cron-secret` header. Run the no-show sweep at least hourly and refund retries every 5–15 minutes. Keep one active schedule per environment.

## Launch blockers and follow-up

The production-readiness review remains the source for additional launch gates: replace in-memory rate limiting with Redis before multiple API instances, run reminders/no-show processing under a single worker lease, add runtime integration tests for booking/payment/check-in races, and complete account recovery, legal/privacy, audit and observability work. The current CI build is not a substitute for those runtime checks. Keep the initial API at one instance until shared rate limiting and worker coordination are in place.

## Provider references

- [Vercel monorepo root directories](https://vercel.com/docs/monorepos)
- [Render web services](https://render.com/docs/web-services)
- [Render health checks](https://render.com/docs/health-checks)
- [Supabase PostgreSQL connection options](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase connection pooling and limits](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits)
- [Prisma `migrate deploy`](https://docs.prisma.io/docs/cli/migrate/deploy)
- [Prisma deployment migration guidance](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-migrations-from-a-local-environment)
