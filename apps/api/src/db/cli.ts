// Usage: pnpm db:migrate | pnpm db:seed | pnpm db:create-admin <email> <password> <name>
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createAdmin } from '../auth/create-admin.js';
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
} else if (command === 'create-admin') {
  const [email, password, name] = process.argv.slice(3);
  const pool = new Pool({ connectionString: url });
  console.log(
    await createAdmin(drizzle(pool, { casing: 'snake_case' }), { email, password, name }),
  );
  await pool.end();
} else {
  throw new Error(`unknown command: ${command}`);
}
console.log(`${command}: done`);
