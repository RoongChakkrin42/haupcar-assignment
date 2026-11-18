import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { vehicleStatusHistory, vehicles } from '../src/db/schema.js';
import { createTestApp, registerAndLogin } from './app.js';
import { db, insertCarModel, pool, resetDb } from './db.js';

let app: INestApplication;
let owner: Awaited<ReturnType<typeof registerAndLogin>>;
let other: Awaited<ReturnType<typeof registerAndLogin>>;
let modelId: string;

const api = (token: string) => {
  const agent = request(app.getHttpServer());
  const auth = { Authorization: `Bearer ${token}` };
  return {
    get: (url: string) => agent.get(`/api/v1${url}`).set(auth),
    post: (url: string, body?: object) => agent.post(`/api/v1${url}`).set(auth).send(body),
    patch: (url: string, body: object) => agent.patch(`/api/v1${url}`).set(auth).send(body),
    delete: (url: string) => agent.delete(`/api/v1${url}`).set(auth),
  };
};

const validVehicle = () => ({
  modelId,
  plateNumber: '1กข 1234',
  plateProvince: 'กรุงเทพมหานคร',
  vin: 'mr0fb8cd0p0123456',
  color: 'ขาว',
  mileageKm: 25000,
  location: { lat: 13.7462, lng: 100.5348 },
  pickupAddress: 'Siam Paragon',
  dailyPrice: 120000,
  description: 'Clean, non-smoking',
});

async function createVehicle(token = owner.token, body: object = validVehicle()) {
  const res = await api(token).post('/vehicles', body).expect(201);
  return res.body;
}

/** Puts a vehicle straight into a status — admin approval arrives in Step 6. */
async function forceStatus(id: string, status: 'approved' | 'rejected' | 'suspended') {
  await db.update(vehicles).set({ status }).where(eq(vehicles.id, id));
}

beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await resetDb();
  owner = await registerAndLogin(app);
  other = await registerAndLogin(app);
  modelId = (await insertCarModel({ make: 'Honda', model: 'City', year: 2024 })).id;
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('POST /vehicles', () => {
  it('creates a draft owned by the caller', async () => {
    const v = await createVehicle();
    expect(v).toMatchObject({
      id: expect.any(String),
      ownerId: owner.user.id,
      status: 'draft',
      version: 1,
      plateNumber: '1กข1234', // whitespace removed
      vin: 'MR0FB8CD0P0123456', // upper-cased
      location: { lat: 13.7462, lng: 100.5348 },
      dailyPrice: 120000,
      model: { id: modelId, make: 'Honda', model: 'City', year: 2024 },
    });
  });

  it('only needs model and plate for a draft', async () => {
    const v = await createVehicle(owner.token, {
      modelId,
      plateNumber: '2กข99',
      plateProvince: 'ชลบุรี',
    });
    expect(v).toMatchObject({ location: null, dailyPrice: null, vin: null });
  });

  it('ignores ownerId and status in the body', async () => {
    const v = await createVehicle(owner.token, {
      ...validVehicle(),
      ownerId: other.user.id,
      status: 'approved',
      version: 99,
    });
    expect(v).toMatchObject({ ownerId: owner.user.id, status: 'draft', version: 1 });
  });

  it('treats "1กข 1234" and "1กข-1234" as the same plate', async () => {
    await createVehicle();
    const res = await api(other.token)
      .post('/vehicles', { ...validVehicle(), plateNumber: '1กข-1234', vin: null })
      .expect(409);
    expect(res.body.message).toMatch(/plate/i);
  });

  it('rejects a duplicate VIN', async () => {
    await createVehicle();
    const res = await api(other.token)
      .post('/vehicles', { ...validVehicle(), plateNumber: '9ขค9999' })
      .expect(409);
    expect(res.body.message).toMatch(/vin/i);
  });

  it('rejects an unknown car model', async () => {
    await api(owner.token)
      .post('/vehicles', { ...validVehicle(), modelId: '00000000-0000-0000-0000-000000000000' })
      .expect(400);
  });

  it.each([
    ['price of 0', { dailyPrice: 0 }],
    ['fractional price', { dailyPrice: 99.5 }],
    ['negative mileage', { mileageKm: -1 }],
    ['latitude out of range', { location: { lat: 91, lng: 100 } }],
    ['empty plate', { plateNumber: ' ' }],
  ])('rejects %s with 400', async (_, patch) => {
    await api(owner.token)
      .post('/vehicles', { ...validVehicle(), ...patch })
      .expect(400);
  });

  it('requires a token', async () => {
    await request(app.getHttpServer()).post('/api/v1/vehicles').send(validVehicle()).expect(401);
  });
});

describe('GET /vehicles', () => {
  it("lists only the caller's vehicles, newest first", async () => {
    const a = await createVehicle(owner.token, {
      modelId,
      plateNumber: 'A1',
      plateProvince: 'ชลบุรี',
    });
    const b = await createVehicle(owner.token, {
      modelId,
      plateNumber: 'B2',
      plateProvince: 'ชลบุรี',
    });
    await createVehicle(other.token, { modelId, plateNumber: 'C3', plateProvince: 'ชลบุรี' });

    const res = await api(owner.token).get('/vehicles').expect(200);
    expect(res.body.items.map((v: { id: string }) => v.id)).toEqual([b.id, a.id]);
    expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
  });

  it('paginates', async () => {
    for (const p of ['A1', 'B2', 'C3']) {
      await createVehicle(owner.token, { modelId, plateNumber: p, plateProvince: 'ชลบุรี' });
    }
    const res = await api(owner.token).get('/vehicles?page=2&pageSize=2').expect(200);
    expect(res.body).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(res.body.items).toHaveLength(1);
  });

  it('filters by status', async () => {
    const a = await createVehicle(owner.token, {
      modelId,
      plateNumber: 'A1',
      plateProvince: 'ชลบุรี',
    });
    await createVehicle(owner.token, { modelId, plateNumber: 'B2', plateProvince: 'ชลบุรี' });
    await forceStatus(a.id, 'approved');

    const res = await api(owner.token).get('/vehicles?status=approved').expect(200);
    expect(res.body.items.map((v: { id: string }) => v.id)).toEqual([a.id]);
  });

  it('rejects an unknown status filter and oversized pages', async () => {
    await api(owner.token).get('/vehicles?status=sold').expect(400);
    await api(owner.token).get('/vehicles?pageSize=1000').expect(400);
  });
});

describe('GET /vehicles/:id', () => {
  it('returns the vehicle to its owner', async () => {
    const v = await createVehicle();
    await api(owner.token).get(`/vehicles/${v.id}`).expect(200);
  });

  it("returns 404 for someone else's vehicle", async () => {
    const v = await createVehicle();
    await api(other.token).get(`/vehicles/${v.id}`).expect(404);
  });

  it('returns 400 for a malformed id', async () => {
    await api(owner.token).get('/vehicles/not-a-uuid').expect(400);
  });
});

describe('PATCH /vehicles/:id', () => {
  it('updates fields and bumps the version', async () => {
    const v = await createVehicle();
    const res = await api(owner.token)
      .patch(`/vehicles/${v.id}`, { version: 1, dailyPrice: 150000, color: null })
      .expect(200);
    expect(res.body).toMatchObject({ dailyPrice: 150000, color: null, version: 2 });
  });

  it('rejects a stale version with 409', async () => {
    const v = await createVehicle();
    await api(owner.token).patch(`/vehicles/${v.id}`, { version: 1, color: 'ดำ' }).expect(200);
    const res = await api(owner.token)
      .patch(`/vehicles/${v.id}`, { version: 1, color: 'แดง' })
      .expect(409);
    expect(res.body.message).toMatch(/modified/i);
  });

  it('requires a version', async () => {
    const v = await createVehicle();
    await api(owner.token).patch(`/vehicles/${v.id}`, { color: 'ดำ' }).expect(400);
  });

  it("returns 404 for someone else's vehicle and leaves it untouched", async () => {
    const v = await createVehicle();
    await api(other.token).patch(`/vehicles/${v.id}`, { version: 1, dailyPrice: 1 }).expect(404);
    const [row] = await db.select().from(vehicles).where(eq(vehicles.id, v.id));
    expect(row.dailyPrice).toBe(120000);
  });

  it('cannot change owner or status', async () => {
    const v = await createVehicle();
    const res = await api(owner.token)
      .patch(`/vehicles/${v.id}`, { version: 1, ownerId: other.user.id, status: 'approved' })
      .expect(200);
    expect(res.body).toMatchObject({ ownerId: owner.user.id, status: 'draft' });
  });

  it('sends an approved vehicle back to review when a key field changes', async () => {
    const v = await createVehicle();
    await forceStatus(v.id, 'approved');
    const res = await api(owner.token)
      .patch(`/vehicles/${v.id}`, { version: 1, plateNumber: '7กข 7777' })
      .expect(200);
    expect(res.body.status).toBe('pending_review');

    const history = await db
      .select()
      .from(vehicleStatusHistory)
      .where(eq(vehicleStatusHistory.vehicleId, v.id));
    expect(history).toMatchObject([
      { fromStatus: 'approved', toStatus: 'pending_review', changedBy: owner.user.id },
    ]);
  });

  it('keeps an approved vehicle approved for price or description changes', async () => {
    const v = await createVehicle();
    await forceStatus(v.id, 'approved');
    const res = await api(owner.token)
      .patch(`/vehicles/${v.id}`, { version: 1, dailyPrice: 99000, description: 'new' })
      .expect(200);
    expect(res.body.status).toBe('approved');
  });

  it('keeps an approved vehicle approved when a key field is resent unchanged', async () => {
    const v = await createVehicle();
    await forceStatus(v.id, 'approved');
    const res = await api(owner.token)
      .patch(`/vehicles/${v.id}`, { version: 1, plateNumber: '1กข 1234' })
      .expect(200);
    expect(res.body.status).toBe('approved');
  });
});

describe('DELETE /vehicles/:id', () => {
  it('soft-deletes: hidden from the API but kept in the database', async () => {
    const v = await createVehicle();
    await api(owner.token).delete(`/vehicles/${v.id}`).expect(204);

    await api(owner.token).get(`/vehicles/${v.id}`).expect(404);
    expect((await api(owner.token).get('/vehicles').expect(200)).body.total).toBe(0);
    const [row] = await db.select().from(vehicles).where(eq(vehicles.id, v.id));
    expect(row.deletedAt).toBeInstanceOf(Date);
  });

  it("returns 404 for someone else's vehicle", async () => {
    const v = await createVehicle();
    await api(other.token).delete(`/vehicles/${v.id}`).expect(404);
  });
});

describe('POST /vehicles/:id/submit', () => {
  it('moves a complete draft to pending_review and records history', async () => {
    const v = await createVehicle();
    const res = await api(owner.token).post(`/vehicles/${v.id}/submit`).expect(200);
    expect(res.body).toMatchObject({ status: 'pending_review', version: 2 });

    const history = await db
      .select()
      .from(vehicleStatusHistory)
      .where(eq(vehicleStatusHistory.vehicleId, v.id));
    expect(history).toMatchObject([
      { fromStatus: 'draft', toStatus: 'pending_review', changedBy: owner.user.id },
    ]);
  });

  it('lists the missing fields when the draft is incomplete', async () => {
    const v = await createVehicle(owner.token, {
      modelId,
      plateNumber: '2กข99',
      plateProvince: 'ชลบุรี',
    });
    const res = await api(owner.token).post(`/vehicles/${v.id}/submit`).expect(422);
    expect(res.body.missing.sort()).toEqual(['dailyPrice', 'location', 'pickupAddress']);
  });

  it('allows resubmitting a rejected vehicle', async () => {
    const v = await createVehicle();
    await forceStatus(v.id, 'rejected');
    await api(owner.token).post(`/vehicles/${v.id}/submit`).expect(200);
  });

  it('refuses to submit twice', async () => {
    const v = await createVehicle();
    await api(owner.token).post(`/vehicles/${v.id}/submit`).expect(200);
    await api(owner.token).post(`/vehicles/${v.id}/submit`).expect(409);
  });

  it("returns 404 for someone else's vehicle", async () => {
    const v = await createVehicle();
    await api(other.token).post(`/vehicles/${v.id}/submit`).expect(404);
  });
});

describe('GET /car-models', () => {
  it('lists models for the picker', async () => {
    const res = await api(owner.token).get('/car-models').expect(200);
    expect(res.body).toContainEqual(
      expect.objectContaining({ id: modelId, make: 'Honda', model: 'City' }),
    );
  });
});
