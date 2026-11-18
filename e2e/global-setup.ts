import { execSync } from 'node:child_process';
import pg from 'pg';
import { ADMIN_DB_URL, E2E_DB_URL } from './env';

/** Fresh database per run: drop, recreate, migrate, seed car models, create the admin. */
export default async function globalSetup() {
  const name = new URL(E2E_DB_URL).pathname.slice(1);
  const admin = new pg.Client({ connectionString: ADMIN_DB_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  const env = { ...process.env, DATABASE_URL: E2E_DB_URL };
  const run = (cmd: string) => execSync(cmd, { env, stdio: 'inherit' });
  run('pnpm --filter @haupcar/api db:migrate');
  run('pnpm --filter @haupcar/api db:seed');
  run('pnpm --filter @haupcar/api db:create-admin admin@e2e.local admin-password-123 Admin');
}
