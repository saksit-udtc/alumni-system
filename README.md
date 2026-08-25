# ระบบจองโต๊ะงานคืนสู่เหย้า (Alumni Homecoming Table Reservation)

Next.js 14 (App Router, TypeScript) + Prisma + PostgreSQL 16 + MinIO, all
self-hosted via Docker Compose for on-prem deployment.

## Stack

- **App**: Next.js 14 App Router, TypeScript, Tailwind CSS
- **DB**: PostgreSQL 16 via Prisma ORM
- **Object storage**: MinIO (S3-compatible), presigned URLs, two buckets:
  `payment-slips` (private) and `floor-plans` (public-read)
- **Admin auth**: JWT (jsonwebtoken + bcrypt) in an httpOnly cookie, checked
  in `middleware.ts`
- **Background job**: node-cron running in its **own** small container
  (`cron/`), not inside the Next.js process — sweeps expired reservations
  every 5 minutes
- **Email**: nodemailer over generic SMTP env vars (no SaaS-specific API)

## Directory layout

```
alumni-nextjs/
  docker-compose.yml
  .env.example
  app/                     Next.js app
    prisma/schema.prisma
    src/app/...             pages + API routes
    src/lib/...              bookTable.ts, releaseReservation.ts, prisma.ts,
                              auth.ts, minio.ts, mailer.ts, qrcode.ts
    middleware.ts
    Dockerfile
  cron/                    standalone cron service, its own package.json +
                            Prisma schema (duplicated from app/, see note below)
    src/index.ts
    Dockerfile
```

## Local development

```bash
cd app
npm install
cp ../.env.example .env.local   # then edit DATABASE_URL to point at localhost
npx prisma migrate dev          # creates tables
npm run prisma:seed             # creates the first admin user (admin / change_me...)
npm run dev
```

You'll also need Postgres and MinIO running locally — easiest is to just
run `docker compose up postgres minio minio-init` and develop the app with
`npm run dev` against those two containers.

## Running everything with Docker Compose

```bash
cp .env.example .env   # fill in real secrets — JWT_SECRET, DB password, MinIO password, SMTP
docker compose up -d --build
```

This starts, in order:

1. `postgres` — Postgres 16
2. `minio` — object storage
3. `minio-init` — one-shot `mc` job that creates the `payment-slips` and
   `floor-plans` buckets and sets `floor-plans` to public-read (payment
   slips stay fully private — always served to admins via a short-lived
   presigned `GET` URL, never a public bucket policy)
4. `app` — runs `prisma migrate deploy` then starts Next.js on port 3000
5. `cron` — the expiry-sweep service, on its own schedule (default every 5
   minutes, configurable via `CRON_SCHEDULE`)

Create the first admin account once the containers are up:

```bash
docker compose exec app npx prisma db seed
```

(Or set `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` in `.env` before
seeding.) Change the seeded password immediately after first login — there
is no in-app password-change UI in this scaffold; use the
`AdminUser.passwordHash` column directly (bcrypt hash) or extend the app
with a change-password route.

## Migrations

- Dev: `npx prisma migrate dev --name <description>` inside `app/`
- Prod (what `docker-compose.yml`'s `app` command runs on every boot):
  `npx prisma migrate deploy`

The `cron/` service does **not** run migrations — it only reads/writes
through its own generated Prisma client against the same database, using a
schema file copied from `app/prisma/schema.prisma`. If you change the data
model, update both `app/prisma/schema.prisma` and `cron/prisma/schema.prisma`
and rebuild both images (see "Deviations" below for why they're separate
files instead of a shared package).

## Business logic — where each requirement lives

1. **Atomic booking** (`SELECT ... FOR UPDATE` + `prisma.$transaction`) —
   `app/src/lib/bookTable.ts`, called from `POST /api/reservations`
   (`app/src/app/api/reservations/route.ts`).
2. **Shared release logic** — `app/src/lib/releaseReservation.ts`, used by
   both the cron sweep (`cron/src/releaseReservation.ts`, a duplicated copy
   — see Deviations) and the admin reject-slip route
   (`app/src/app/api/admin/reservations/[id]/reject/route.ts`).
3. **Cron expiry sweep, every 5 min, separate container** —
   `cron/src/index.ts` + `cron/Dockerfile`, its own service in
   `docker-compose.yml`.
4. **Approve slip → confirmed + email QR (CID attachment, non-fatal on
   email failure)** —
   `app/src/app/api/admin/reservations/[id]/approve/route.ts` calling
   `app/src/lib/mailer.ts` (`sendConfirmationEmail`, wrapped in try/catch)
   and `app/src/lib/qrcode.ts` (`generateQrPngBuffer`).
5. **Unconfirm → awaiting_verify + push `reservedUntil` forward, seats
   untouched** —
   `app/src/app/api/admin/reservations/[id]/unconfirm/route.ts`.
6. **Check-in only if confirmed, admin-JWT protected** —
   `app/src/app/api/admin/checkin/[id]/route.ts` (gated by `middleware.ts`
   matcher on `/api/admin/**`).
7. **Souvenir toggle, independent of check-in, confirmed-only** —
   `app/src/app/api/admin/reservations/[id]/souvenir/route.ts`.
8. **Public alumni-matching floor-plan badges** (phone→Alumni join,
   dedup per table, no phone/email exposed) —
   `app/src/app/api/events/[id]/alumni-badges/route.ts`.
9. **Guest mutations verified via bookingCode + bookerPhone pair** —
   `app/src/app/api/reservations/[bookingCode]/upload-slip/route.ts` and
   `app/src/app/api/reservations/status/route.ts` (neither ever accepts a
   bare reservation id from the client).
10. **Consistent admin JWT gate** — primary enforcement in
    `app/middleware.ts` (matcher: `/admin/:path*`, `/api/admin/:path*`);
    every `/api/admin/**` route handler also calls `requireAdmin()`
    (`app/src/lib/apiHelpers.ts`) as defense-in-depth.
11. **Anti-IDOR (resource must belong to the given eventId)** —
    `bookTable.ts` checks the locked table's `eventId` against the request;
    `app/src/app/api/admin/events/[id]/tables/[tableId]/route.ts` loads the
    table scoped to `eventId` before any mutation; the bulk
    drag-drop-position route
    (`app/src/app/api/admin/events/[id]/tables/positions/route.ts`) verifies
    every table id in the batch belongs to that event before writing any of
    them.

## Deploy notes (on-prem, Cloudflare Tunnel — qa-ems-web pattern)

This app is designed to run the same way as this institution's other
self-hosted Docker apps (see the `qa-ems-web` project): on a Linux server
behind a Mikrotik NAT, with **no open inbound ports** — a `cloudflared`
tunnel exposes the `app` service (port 3000) to the internet instead of
nginx-proxy-manager/Let's Encrypt or router port-forwarding.

Suggested steps:

1. `docker compose up -d --build` on the server, confirm `app` responds on
   `http://localhost:3000` and `minio` on `9000/9001` (bind these to
   `127.0.0.1` only, as `docker-compose.yml` already does — never expose
   Postgres/MinIO ports to the LAN/WAN directly).
2. Install `cloudflared` on the host (not in a container, to match the
   qa-ems-web pattern) and create a tunnel pointing a subdomain
   (e.g. `homecoming.yourcollege.ac.th`) at `http://localhost:3000`.
3. If you want the public floor-plan images served under your own domain
   instead of a bare MinIO port, add a second tunnel route (or a path
   rule) forwarding `/minio-public/*` on the same hostname to
   `http://localhost:9000/floor-plans/*`, and set `MINIO_PUBLIC_URL`
   accordingly — or simply tunnel MinIO's `9000` under a separate
   subdomain and set `MINIO_PUBLIC_URL` to that.
4. Back up the `postgres_data` and `minio_data` named volumes on a
   schedule (`pg_dump` + `mc mirror`, or plain volume snapshots) —
   payment slips only exist in MinIO, there's no secondary copy.
5. Rotate `JWT_SECRET` only with a plan to force-logout all admins
   (changing it invalidates every existing cookie).

## Deviations from the original spec, and why

- **`output: "standalone"` was dropped from `next.config.js`.** The
  Docker image instead ships full `node_modules` + `.next` and runs
  `npm run start`, because the app container's compose command runs
  `npx prisma migrate deploy` at boot, which needs the full Prisma CLI —
  a standalone build's pruned `node_modules` doesn't reliably include it.
  Trade-off: a slightly larger image, in exchange for migrations working
  out of the box on `docker compose up`.
- **`cron/` has its own copy of `prisma/schema.prisma`** rather than a
  shared npm package. A real monorepo tool (npm/pnpm workspaces) would be
  cleaner, but the spec asked for `cron/` to have "its own small
  package.json" and to be a genuinely separate Docker service — duplicating
  the (small) schema file keeps that separation simple and avoids adding
  workspace tooling to a starter scaffold. The README calls out that both
  copies must be kept in sync; a production hardening pass would likely
  promote this to an actual shared workspace package.
- **`releaseReservation` logic is duplicated, not literally shared**, for
  the same reason — `app/src/lib/releaseReservation.ts` and
  `cron/src/releaseReservation.ts` implement the identical algorithm
  (lock → validate → restore seats → set status) but are two files because
  the two services are two separate npm packages with no shared module
  boundary in this scaffold.
- **Floor plans use a public-read MinIO bucket policy** (set by
  `minio-init`'s `mc anonymous set download`), while payment slips stay
  fully private behind presigned `GET` URLs. The spec explicitly left this
  choice to the implementer ("your call, document the choice") — floor
  plans are non-sensitive venue images shown to every guest, so serving
  them directly from MinIO avoids round-tripping every public page load
  through the Next.js server for a presigned URL.
- **The public `/status` page's QR preview** uses a placeholder
  `api.qrserver.com` image just so guests can visually confirm they have a
  QR code before arriving — this is a non-critical UI nicety, not part of
  the check-in flow itself (the real check-in QR is generated server-side
  with the `qrcode` package and emailed as a CID attachment per
  requirement #4; `api.qrserver.com` is never used for anything
  security-relevant). A stricter on-prem-only build should replace this
  with a server-rendered QR image instead.
- **Admin password changes aren't a UI feature in this scaffold** — only
  a `prisma/seed.ts` script bootstraps the first admin. This was implied
  scope ("core flows", not "every UI polish detail") rather than one of
  the 11 listed business rules, so it was left out to keep the scaffold
  focused; the `AdminUser` model and `hashPassword`/`verifyPassword`
  helpers in `auth.ts` are already there to build it on top of.
- **`npm install` / `docker compose up` were not run** in this
  environment (no network/Docker access here), per the task instructions.
  The code is structurally correct TypeScript reviewed by hand; it has not
  been compiled or executed.
