# BookIt — Appointment Booking Platform

Full-stack scheduling platform for local service businesses. Next.js frontend,
Express/TypeScript + Prisma backend, PostgreSQL database.

## What's built

### Stage 1 — foundation
- **Data model** covering every feature in the spec: users/roles, businesses,
  staff, services, business hours, slots, appointments, payments, reviews,
  waitlist, coupons, referrals, notifications (see `backend/prisma/schema.prisma`).
- **Auth**: JWT-based register/login for customers and business owners, role
  middleware (`CUSTOMER` / `STAFF` / `ADMIN`).
- **Business & service management**: owners set weekly business hours and
  manage services.
- **Staff management**: owners add staff accounts.
- **Real-time availability + conflict-safe booking**: slots are generated
  from business hours; booking uses an atomic conditional update
  (`updateMany` + affected-row check inside a transaction) so two customers
  racing for the same slot can never both win it — no double-booking.
- **Cancel / reschedule**, QR check-in field on each appointment (`qrCode`),
  check-in endpoint.
- **Frontend**: landing page, login/register (customer or business owner),
  role-aware dashboard, public per-business booking page with live slot
  picking.

### Stage 2 — notifications, waitlist, payments
- **Notification service** (`src/services/notificationService.ts`): sends
  email via Nodemailer today, with SMS/WhatsApp already wired to Twilio (just
  add credentials to `.env`). Every notification is also logged as a
  `Notification` row regardless of whether the send succeeds, so there's a
  full audit trail.
- **Automatic emails** on booking confirmation, cancellation, and
  reschedule.
- **Waitlist**: customers can join a waitlist for a fully-booked service
  (`POST /api/waitlist`); when someone cancels, everyone waitlisted for that
  service on that day is automatically emailed and marked notified.
- **Payments (Stripe)**: `POST /api/payments/checkout/:appointmentId` creates
  a Stripe Checkout session for the service price; a webhook
  (`POST /api/payments/webhook`) marks the payment `PAID` and emails a
  receipt. Booking itself doesn't require upfront payment — pay-at-checkout
  is offered as a "Pay now" action after booking, which fits most
  salon/clinic/tutor workflows better than forcing prepayment. Razorpay can
  be added the same way if you'd rather support UPI/local payment methods.
- **Frontend**: "Pay now" button + paid badge on the dashboard, "Join
  waitlist" prompt on the booking page when a service has no open slots.

## What's stubbed in the schema but not yet wired up (next stages)

1. **Reviews & ratings** — `Review` model ready; need a
   "leave a review after COMPLETED appointment" endpoint + UI.
2. **Loyalty points, coupons, referrals** — models ready; need point-award
   logic on completed appointments, coupon validation at booking time, and
   referral-code redemption on signup.
3. **QR check-in UI** — backend endpoint exists (`POST /api/appointments/checkin/:qrCode`);
   need a staff-facing scanner page and a QR image on the customer's
   appointment view (the `qrcode` npm package is already in `package.json`).
4. **Analytics dashboard** — aggregate queries (revenue, peak hours, booking
   trends) over `Appointment`/`Payment`, charted on the admin dashboard.
5. **A staff-side dashboard UI** for managing services/staff/business hours
   (currently only reachable via the API directly — see "Try it" below).

Say the word and I'll build any of these next, in order or out of order.

## Local setup

### 1. Database
Install PostgreSQL locally, or run it in Docker:
```bash
docker run --name bookit-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=appointment_platform -p 5432:5432 -d postgres:16
```

### 2. Backend
```bash
cd backend
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
npm run prisma:migrate    # creates tables from schema.prisma
npm run dev                # http://localhost:4000
```
Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env` to create the platform administrator on first login. Use the **Platform administrator login** option on `/login`.

### 3. Frontend
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api" > .env.local
# Copy the VAPID public key into .env.local after generating it in the backend.
# NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
npm run dev                # http://localhost:3000
```

### 4. Appointment push reminders
From `backend`, generate a free VAPID key pair:
```bash
npx web-push generate-vapid-keys
```
Put the generated keys in the backend `.env` as `VAPID_PUBLIC_KEY` and
`VAPID_PRIVATE_KEY`, and put the public key in the frontend `.env.local` as
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Run the reminder job every 5 minutes:
```bash
npm run reminders
```
The job sends reminders at 1 hour and 30 minutes before confirmed appointments.

### 5. Try it
1. Go to `/register`, sign up as **business owner**, pick a slug (e.g. `glow-salon`).
2. Log into the dashboard, use the API (via Postman/curl for now — UI for this
   comes in a later stage) to add a service, set business hours, add staff,
   and generate slots:
   - `POST /api/services`
   - `PUT /api/businesses/hours`
   - `POST /api/staff`
   - `POST /api/slots/generate`
3. Visit `/book/glow-salon` as a customer, book a slot, then open the dashboard
  and click **Enable reminders** in a supported HTTPS browser.
4. From the dashboard, click **Pay now** to test the Stripe flow (needs
   `STRIPE_SECRET_KEY` in `.env` — use Stripe's test mode key and card
   `4242 4242 4242 4242`). To receive the webhook locally, run
   `stripe listen --forward-to localhost:4000/api/payments/webhook` and put
   the printed signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Add `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` (a free
   [Mailtrap](https://mailtrap.io) sandbox inbox works well for testing) to
   see booking/cancellation/waitlist emails actually arrive — without it,
   they're just logged to the console instead of sent.

## Deployment (once you're ready)

- **Frontend**: Vercel (native Next.js support, connect the `frontend` folder as the project root).
- **Backend**: Railway or Render — both give you a managed Postgres add-on
  and deploy straight from GitHub. AWS (ECS/RDS) is the heavier alternative
  once this needs to scale.
- Set `FRONTEND_URL` (backend) and `NEXT_PUBLIC_API_URL` (frontend) to the
  deployed URLs, and keep `JWT_SECRET` out of source control.

## Project structure
```
appointment-platform/
  backend/
    prisma/schema.prisma   # full data model
    src/
      config/db.ts          # Prisma client
      middleware/            # auth, role, error handler
      controllers/           # business logic per resource
      routes/                 # Express routers
      app.ts / server.ts
  frontend/
    app/                    # Next.js App Router pages
    lib/api.ts              # typed API client + session storage
```
