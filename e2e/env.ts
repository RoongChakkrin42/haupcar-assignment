try {
  process.loadEnvFile('.env'); // playwright runs from the repo root
} catch {
  // no .env (e.g. CI) — rely on real env vars
}

/** Any existing DB on the server, used only to drop/create the E2E database. */
export const ADMIN_DB_URL =
  process.env.DATABASE_URL ?? 'postgres://haupcar:haupcar@localhost:5432/haupcar';
export const E2E_DB_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://haupcar:haupcar@localhost:5432/haupcar_e2e';
