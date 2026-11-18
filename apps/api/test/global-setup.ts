import { resolve } from 'node:path';
import { runMigrations } from '../src/db/migrate.js';

export default async function setup() {
  try {
    process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'));
  } catch {
    // no .env (e.g. CI) — rely on real env vars
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');
  await runMigrations(url);
}
