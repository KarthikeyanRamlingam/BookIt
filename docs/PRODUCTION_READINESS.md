# BookIt production readiness

## Architecture

BookIt is a modular monolith with two independently deployable applications:

- `frontend/`: Next.js App Router client for discovery, booking, payments, check-in, and role-based dashboards.
- `backend/`: Express API organized by route, controller, middleware, domain rule, and service layers.
- PostgreSQL is the source of truth; Prisma owns the schema and migrations.
- Stripe, SMTP, Twilio, Web Push, and Google OAuth are optional external integrations.

This shape is appropriate for the current product. Splitting it into microservices would add operational cost before there is evidence that independent scaling is needed. Background notifications and reminders are the first workloads that should move to a durable queue when volume grows.

## Implemented hardening (2026-10-02)

- Business-scoped authorization for appointment cancellation and private calendar data.
- Rescheduling is limited to future slots for the same service and business.
- Booking history is append-only; cancelled appointment rows are no longer overwritten.
- Stripe redirects are allow-listed, and verification checks appointment metadata, currency, and amount.
- Waitlist routes are mounted and duplicate enrollment is protected at the database level.
- Token-queue category rules are centralized and shared by booking, availability, and check-in.
- Completion, attendance, reviews, and loyalty awards now use a consistent state flow.
- Request body limits, security headers, API/auth rate limiting, HttpOnly authentication cookies, production JWT validation, readiness checks, and graceful shutdown are present.
- The public shell and dashboard navigation are responsive, keyboard-visible, and reduced-motion aware.
- CI builds both applications and validates the Prisma schema.

## Deployment gate

The following items must be completed before handling real customer data:

1. Remove `bookit_backup.sql` and `backend/bookit_backup.sql` from Git, purge them from Git history, and rotate every credential, password, push subscription, and API secret represented by those dumps. Store encrypted backups outside the source repository.
2. Replace the current seven-day signed session cookie with short-lived access tokens plus rotating, server-revocable refresh sessions for higher-risk deployments. Logout and role-change revocation are already enforced; per-device session management is not.
3. Replace the in-memory rate-limit store with Redis when running more than one API instance.
4. Add integration tests against a disposable PostgreSQL database for booking races, cancellation, rescheduling, payment webhooks, and check-in transitions. CI currently verifies compilation and schema validity, not runtime behavior.
5. Run reminders/no-show processing as a single scheduled worker with a distributed lease. Do not run the in-process interval on every horizontally scaled API replica.
6. Configure managed PostgreSQL backups/PITR, TLS, observability, structured logs, error reporting, uptime alerts, and provider webhook alerts.
7. Add password reset, email verification, staff invitation acceptance, forced temporary-password change, account deletion/export, and an auditable administrator action log.
8. Complete legal/privacy work: terms, privacy notice, consent records, retention periods, and payment-provider disclosure.

## Recommended production topology

- CDN/edge: Next.js frontend.
- API: at least two stateless Express instances behind a load balancer.
- Data: managed PostgreSQL with connection pooling and point-in-time recovery.
- Shared state: Redis for throttling, job leases, and eventually a durable job queue.
- Worker: one deployment for reminders, notifications, and no-show processing.
- Secrets: deployment secret manager only; never `.env` files in images or source control.

## Release checklist

- Apply Prisma migrations with `prisma migrate deploy` before starting the new API.
- Confirm `/health` and `/health/ready` pass from the platform health checker.
- Register the exact production frontend origins in `FRONTEND_URLS`.
- Set `BACKEND_URL`, a 32+ character `JWT_SECRET`, Stripe webhook secret, and provider credentials.
- Run a test-mode booking/payment/check-in/cancellation journey after each deployment.
- Verify database restore procedures quarterly, not only backup creation.
