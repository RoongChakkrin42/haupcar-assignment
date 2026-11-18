# Haupcar

[![CI](https://github.com/RoongChakkrin42/haupcar-assignment/actions/workflows/ci.yml/badge.svg)](https://github.com/RoongChakkrin42/haupcar-assignment/actions/workflows/ci.yml)

P2P car rental marketplace — vehicle registry (demo).

## Quick start

```sh
cp .env.example .env
pnpm install
pnpm db:up      # Postgres + PostGIS (dev DB `haupcar`, test DB `haupcar_test`)
pnpm db:migrate && pnpm db:seed   # schema + demo car models
pnpm db:create-admin admin@haupcar.local <password> Admin   # admins are CLI-only
pnpm test       # api (Vitest + real Postgres) + web (Vitest + jsdom)
pnpm dev        # shared (watch), api :3000, web :5173 (proxies /api → api)
```

End-to-end (Playwright, Chromium): `pnpm exec playwright install chromium` once, then
`pnpm test:e2e`. It recreates the `haupcar_e2e` database on every run and starts its own
API (:3100) and web (:5174), so it never touches your dev data or running dev servers.

If port 3000 is taken, run the API elsewhere and point the web proxy at it:
`PORT=3100 pnpm --filter @haupcar/api dev` and `API_PROXY=http://localhost:3100 pnpm --filter @haupcar/web dev`.

## Run the whole stack in Docker

Production-like build (nginx + API + its own PostGIS), no Node needed on the host:

```sh
cp .env.example .env   # set JWT_SECRET / FILE_SIGNING_SECRET; optional ADMIN_EMAIL / ADMIN_PASSWORD
docker compose --profile app up --build -d
open http://localhost:8080          # Swagger: http://localhost:8080/api/docs
```

On start, a one-off `migrate` container runs migrations, seeds car models and creates the admin
(`ADMIN_EMAIL`/`ADMIN_PASSWORD`, default `admin@haupcar.local` / `admin-password-123`) if missing.
Data and uploads live in the `app-db-data` and `app-uploads` volumes, separate from the dev
database. Stop with `docker compose --profile app down` (add `-v` to wipe that data).

## Layout

- `packages/shared` — Zod schemas, enums and types used by both the API (validation, OpenAPI) and the web app (forms, API types)
- `apps/api` — NestJS modular monolith (`auth`, `vehicles`, `files`)
- `apps/web` — React 19 + Vite, TanStack Query, React Hook Form, shadcn/ui, Leaflet. Owner pages (`/vehicles`) and admin review (`/admin`)

## API docs

Interactive OpenAPI docs: **http://localhost:3000/api/docs** (raw spec: `/api/docs-json`).
Log in with `POST /auth/login`, click **Authorize**, paste the `accessToken`.

Docs are generated from the same Zod schemas that validate requests, and tests fail if a
route is undocumented or a response doesn't match its documented schema.

Conventions: all routes under `/api/v1`, bearer JWT unless public, money in integer satang
(`120000` = ฿1,200), location as `{ lat, lng }`, owners only see their own vehicles (others → 404).

Uploads (photos, documents) go through the API: images are re-encoded to WebP ≤ 1600px with all
EXIF (incl. GPS) removed, then stored under `UPLOAD_DIR` (default `apps/api/uploads`, git-ignored).
Clients read them through signed URLs (`/api/v1/files/...`, valid ~1 hour) returned on each vehicle.

Admin review (`/admin/vehicles`, role `admin` only): FIFO queue via
`?status=pending_review&order=oldest`, then `POST /admin/vehicles/:id/status` with
`{ status, reason?, version }` — `pending_review → approved | rejected`, `approved → suspended`,
`suspended → approved`. Reject/suspend need a reason, which owners see as `statusReason`.
