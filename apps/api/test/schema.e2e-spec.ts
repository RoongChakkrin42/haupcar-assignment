import { eq, sql } from 'drizzle-orm';
import { carModels, vehicles } from '../src/db/schema.js';
import { seedCarModels } from '../src/db/seed.js';
import { db, insertUser, insertVehicle, pgError, pool, resetDb } from './db.js';

beforeEach(resetDb);
afterAll(() => pool.end());

describe('vehicles', () => {
  it('defaults to draft status, version 1', async () => {
    const v = await insertVehicle();
    expect(v.status).toBe('draft');
    expect(v.version).toBe(1);
  });

  it('rejects a duplicate plate in the same province', async () => {
    await insertVehicle({ plateNumber: '1กข1234', plateProvince: 'กรุงเทพมหานคร' });
    const err = await pgError(
      insertVehicle({ plateNumber: '1กข1234', plateProvince: 'กรุงเทพมหานคร' }),
    );
    expect(err).toMatchObject({ code: '23505', constraint: 'vehicles_plate_unique' });
  });

  it('allows the same plate in a different province', async () => {
    await insertVehicle({ plateNumber: '1กข1234', plateProvince: 'กรุงเทพมหานคร' });
    await expect(
      insertVehicle({ plateNumber: '1กข1234', plateProvince: 'เชียงใหม่' }),
    ).resolves.toBeDefined();
  });

  it('frees the plate and VIN once the vehicle is soft-deleted', async () => {
    const v = await insertVehicle({ plateNumber: '1กข1234', vin: 'VIN0001' });
    await db.update(vehicles).set({ deletedAt: new Date() }).where(eq(vehicles.id, v.id));
    await expect(insertVehicle({ plateNumber: '1กข1234', vin: 'VIN0001' })).resolves.toBeDefined();
  });

  it('rejects a duplicate VIN but allows many vehicles without one', async () => {
    await insertVehicle({ vin: 'VIN0001' });
    expect(await pgError(insertVehicle({ vin: 'VIN0001' }))).toMatchObject({
      code: '23505',
      constraint: 'vehicles_vin_unique',
    });
    await insertVehicle({ vin: null });
    await expect(insertVehicle({ vin: null })).resolves.toBeDefined();
  });

  it.each([0, -100])('rejects daily price %i', async (dailyPrice) => {
    expect(await pgError(insertVehicle({ dailyPrice }))).toMatchObject({
      code: '23514',
      constraint: 'vehicles_daily_price_positive',
    });
  });

  it('rejects negative mileage', async () => {
    expect(await pgError(insertVehicle({ mileageKm: -1 }))).toMatchObject({
      code: '23514',
      constraint: 'vehicles_mileage_non_negative',
    });
  });

  it('rejects an unknown owner', async () => {
    const err = await pgError(insertVehicle({ ownerId: '00000000-0000-0000-0000-000000000000' }));
    expect(err.code).toBe('23503');
  });

  it('rejects an unknown status', async () => {
    const err = await pgError(insertVehicle({ status: 'sold' as never }));
    expect(err.code).toBe('22P02');
  });

  it('finds vehicles near a point (PostGIS)', async () => {
    // Siam Paragon vs. Chiang Mai old city
    const near = await insertVehicle({ location: { x: 100.5348, y: 13.7462 } });
    await insertVehicle({ location: { x: 98.9853, y: 18.7883 } });
    const rows = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(
        sql`ST_DWithin(${vehicles.location}::geography, ST_SetSRID(ST_MakePoint(100.5300, 13.7400), 4326)::geography, 5000)`,
      );
    expect(rows).toEqual([{ id: near.id }]);
  });
});

describe('users', () => {
  it('rejects an email that differs only by case', async () => {
    await insertUser({ email: 'Somchai@Example.com' });
    expect(await pgError(insertUser({ email: 'somchai@example.com' }))).toMatchObject({
      code: '23505',
      constraint: 'users_email_unique',
    });
  });

  it('defaults role to owner', async () => {
    expect((await insertUser()).role).toBe('owner');
  });
});

describe('seedCarModels', () => {
  it('is idempotent', async () => {
    await seedCarModels(db);
    const [{ count: first }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(carModels);
    await seedCarModels(db);
    const [{ count: second }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(carModels);
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(first);
  });
});
