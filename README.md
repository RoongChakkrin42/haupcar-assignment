# Haupcar

P2P car rental marketplace — vehicle registry (demo).

## Quick start

```sh
cp .env.example .env
pnpm install
pnpm db:up      # Postgres + PostGIS (dev DB `haupcar`, test DB `haupcar_test`)
pnpm db:migrate && pnpm db:seed   # schema + demo car models
pnpm test       # api (Vitest + real Postgres) + web (Vitest + jsdom)
pnpm dev        # api :3000, web :5173 (proxies /api → api)
```
