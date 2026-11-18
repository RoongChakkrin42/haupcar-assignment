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

## API

All routes are under `/api/v1` and require `Authorization: Bearer <token>` unless marked public.

| Method | Path             | Auth   | Notes                                                            |
| ------ | ---------------- | ------ | ---------------------------------------------------------------- |
| GET    | `/health`        | public | API + DB check                                                   |
| POST   | `/auth/register` | public | `{ email, password (8–72), name, phone? }` → always role `owner` |
| POST   | `/auth/login`    | public | `{ email, password }` → `{ accessToken, user }`                  |
| GET    | `/auth/me`       | JWT    | current user                                                     |
