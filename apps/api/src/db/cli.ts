// Usage: pnpm db:migrate | pnpm db:seed | pnpm db:create-admin <email> <password> <name>
//        node dist/src/db/cli.js bootstrap   (container start: migrate + seed + ADMIN_EMAIL/ADMIN_PASSWORD admin)
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createAdmin, ensureAdmin } from '../auth/create-admin.js';
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
} else if (command === 'bootstrap') {
  await runMigrations(url);
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { casing: 'snake_case' });
  await seedCarModels(db);
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_NAME: name = 'Admin' } = process.env;
  if (email && password) {
    const { created } = await ensureAdmin(db, { email, password, name });
    console.log(created ? `admin ${email} created` : `admin ${email} already exists`);
  }
  await pool.end();
} else {
  throw new Error(`unknown command: ${command}`);
}
console.log(`${command}: done`);
