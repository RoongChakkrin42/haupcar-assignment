import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { carModels, users, vehicles } from '../src/db/schema.js';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { casing: 'snake_case' });

export async function resetDb() {
  await db.execute(sql`truncate users, car_models, vehicles, vehicle_status_history cascade`);
}

let seq = 0;
const next = () => ++seq;

export async function insertUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const n = next();
  const [row] = await db
    .insert(users)
    .values({ email: `user${n}@test.local`, passwordHash: 'x', name: `User ${n}`, ...overrides })
    .returning();
  return row;
}

export async function insertCarModel(overrides: Partial<typeof carModels.$inferInsert> = {}) {
  const [row] = await db
    .insert(carModels)
    .values({
      make: 'Toyota',
      model: `Yaris ${next()}`,
      year: 2023,
      bodyType: 'hatchback',
      transmission: 'automatic',
      fuel: 'petrol',
      seats: 5,
      ...overrides,
    })
    .returning();
  return row;
}

export async function insertVehicle(overrides: Partial<typeof vehicles.$inferInsert> = {}) {
  const ownerId = overrides.ownerId ?? (await insertUser()).id;
  const modelId = overrides.modelId ?? (await insertCarModel()).id;
  const [row] = await db
    .insert(vehicles)
    .values({
      ownerId,
      modelId,
      plateNumber: `1กข${next()}`,
      plateProvince: 'กรุงเทพมหานคร',
      ...overrides,
    })
    .returning();
  return row;
}

/** Drizzle wraps driver errors; the pg error (code, constraint) is on `cause`. */
export async function pgError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    const err = (e as { cause?: { code?: string; constraint?: string } }).cause ?? e;
    return err as { code?: string; constraint?: string };
  }
  throw new Error('expected query to fail');
}
