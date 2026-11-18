// Usage: node dist/src/db/cli.js migrate|seed   (or `pnpm db:migrate` / `pnpm db:seed`)
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { runMigrations } from './migrate.js';
import { seedCarModels } from './seed.js';

try {
  process.loadEnvFile('../../.env'); // scripts run with cwd = apps/api
} catch {
  // no .env — rely on real env vars
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const command = process.argv[2];
if (command === 'migrate') {
  await runMigrations(url);
} else if (command === 'seed') {
  const pool = new Pool({ connectionString: url });
  await seedCarModels(drizzle(pool, { casing: 'snake_case' }));
  await pool.end();
} else {
  throw new Error(`unknown command: ${command}`);
}
console.log(`${command}: done`);
