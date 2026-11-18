# Haupcar

P2P car rental marketplace — vehicle registry (demo).

## Quick start

```sh
cp .env.example .env
pnpm install
pnpm db:up      # Postgres + PostGIS (dev DB `haupcar`, test DB `haupcar_test`)
pnpm db:migrate && pnpm db:seed   # schema + demo car models
pnpm db:create-admin admin@haupcar.local <password> Admin   # admins are CLI-only
pnpm test       # api (Vitest + real Postgres) + web (Vitest + jsdom)
pnpm dev        # api :3000, web :5173 (proxies /api → api)
```

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
