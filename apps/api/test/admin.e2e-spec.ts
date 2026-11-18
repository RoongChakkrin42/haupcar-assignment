import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { vehicles } from '../src/db/schema.js';
import { createSubmittedVehicle, createTestApp, loginAdmin, registerAndLogin } from './app.js';
import { db, insertCarModel, pool, resetDb } from './db.js';

let app: INestApplication;
let admin: Awaited<ReturnType<typeof loginAdmin>>;
let owner: Awaited<ReturnType<typeof registerAndLogin>>;
let modelId: string;

const as = (token: string) => {
  const agent = request(app.getHttpServer());
  const auth = { Authorization: `Bearer ${token}` };
  return {
    get: (url: string) => agent.get(`/api/v1${url}`).set(auth),
    post: (url: string, body?: object) => agent.post(`/api/v1${url}`).set(auth).send(body),
    patch: (url: string, body: object) => agent.patch(`/api/v1${url}`).set(auth).send(body),
  };
};
const setStatus = (id: string, body: object, token = admin.token) =>
  as(token).post(`/admin/vehicles/${id}/status`, body);

beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await resetDb();
  admin = await loginAdmin(app);
  owner = await registerAndLogin(app, { name: 'Somchai' });
  modelId = (await insertCarModel()).id;
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('access', () => {
  it('is forbidden to owners and requires a token', async () => {
    const v = await createSubmittedVehicle(app, owner.token, modelId);
    await as(owner.token).get('/admin/vehicles').expect(403);
    await as(owner.token).get(`/admin/vehicles/${v.id}`).expect(403);
    await setStatus(v.id, { status: 'approved', version: v.version }, owner.token).expect(403);
    await request(app.getHttpServer()).get('/api/v1/admin/vehicles').expect(401);
  });
});

describe('GET /admin/vehicles', () => {
  it("lists every owner's vehicles with owner contact details", async () => {
    const other = await registerAndLogin(app);
    await createSubmittedVehicle(app, owner.token, modelId);
    await createSubmittedVehicle(app, other.token, modelId);

    const res = await as(admin.token).get('/admin/vehicles').expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items[0].owner).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      email: expect.any(String),
      phone: null,
    });
  });

  it('gives the review queue oldest first', async () => {
    const first = await createSubmittedVehicle(app, owner.token, modelId);
    const second = await createSubmittedVehicle(app, owner.token, modelId);
    await as(owner.token).post('/vehicles', { modelId, plateNumber: 'D1', plateProvince: 'ชลบุรี' }); // draft

    const res = await as(admin.token)
      .get('/admin/vehicles?status=pending_review&order=oldest')
      .expect(200);
    expect(res.body.items.map((v: { id: string }) => v.id)).toEqual([first.id, second.id]);
  });

  it('hides deleted vehicles', async () => {
    const v = await createSubmittedVehicle(app, owner.token, modelId);
    await db.update(vehicles).set({ deletedAt: new Date() }).where(eq(vehicles.id, v.id));
    expect((await as(admin.token).get('/admin/vehicles').expect(200)).body.total).toBe(0);
    await as(admin.token).get(`/admin/vehicles/${v.id}`).expect(404);
  });
});

describe('GET /admin/vehicles/:id', () => {
  it('shows documents and the status history', async () => {
    const v = await createSubmittedVehicle(app, owner.token, modelId);
    const res = await as(admin.token).get(`/admin/vehicles/${v.id}`).expect(200);
    expect(res.body.documents.map((d: { type: string }) => d.type)).toEqual(['registration']);
    expect(res.body.history).toEqual([
      {
        fromStatus: 'draft',
        toStatus: 'pending_review',
        reason: null,
        changedBy: { id: owner.user.id, name: 'Somchai', role: 'owner' },
        createdAt: expect.any(String),
      },
    ]);
  });
});

describe('POST /admin/vehicles/:id/status', () => {
  it('approves a pending vehicle and records who did it', async () => {
    const v = await createSubmittedVehicle(app, owner.token, modelId);
    const res = await setStatus(v.id, { status: 'approved', version: v.version }).expect(200);
    expect(res.body).toMatchObject({ status: 'approved', version: v.version + 1 });
    expect(res.body.history.at(-1)).toMatchObject({
      fromStatus: 'pending_review',
      toStatus: 'approved',
      changedBy: { id: admin.user.id, role: 'admin' },
    });
    expect((await as(owner.token).get(`/vehicles/${v.id}`).expect(200)).body.status).toBe(
      'approved',
    );
  });

  it('requires a reason to reject, and shows it to the owner', async () => {
    const v = await createSubmittedVehicle(app, owner.token, modelId);
    await setStatus(v.id, { status: 'rejected', version: v.version }).expect(400);
    await setStatus(v.id, { status: 'rejected', version: v.version, reason: '  ' }).expect(400);
    await setStatus(v.id, {
      status: 'rejected',
      version: v.version,
      reason: 'Registration photo is blurry',
    }).expect(200);

    const mine = (await as(owner.token).get(`/vehicles/${v.id}`).expect(200)).body;
    expect(mine).toMatchObject({
      status: 'rejected',
      statusReason: 'Registration photo is blurry',
    });
  });

  it('lets the owner fix and resubmit after a rejection, clearing the reason', async () => {
    const v = await createSubmittedVehicle(app, owner.token, modelId);
    await setStatus(v.id, { status: 'rejected', version: v.version, reason: 'Blurry' }).expect(200);
    const resubmitted = (await as(owner.token).post(`/vehicles/${v.id}/submit`).expect(200)).body;
    expect(resubmitted).toMatchObject({ status: 'pending_review', statusReason: null });
  });

  it('suspends and reinstates an approved vehicle', async () => {
    const v = await createSubmittedVehicle(app, owner.token, modelId);
    const approved = (await setStatus(v.id, { status: 'approved', version: v.version }).expect(200))
      .body;
    await setStatus(v.id, { status: 'suspended', version: approved.version }).expect(400); // reason needed
    const suspended = (
      await setStatus(v.id, {
        status: 'suspended',
        version: approved.version,
        reason: 'Insurance expired',
      }).expect(200)
    ).body;
    expect((await as(owner.token).get(`/vehicles/${v.id}`)).body.statusReason).toBe(
      'Insurance expired',
    );
    await setStatus(v.id, { status: 'approved', version: suspended.version }).expect(200);
  });

  it.each([
    ['approve a draft', 'draft', { status: 'approved' }],
    ['reject an approved vehicle', 'approved', { status: 'rejected', reason: 'x' }],
  ] as const)('refuses to %s', async (_, from, body) => {
    const v = await createSubmittedVehicle(app, owner.token, modelId);
    await db.update(vehicles).set({ status: from }).where(eq(vehicles.id, v.id));
    await setStatus(v.id, { ...body, version: v.version }).expect(409);
  });

  it('refuses statuses that are not admin decisions', async () => {
    const v = await createSubmittedVehicle(app, owner.token, modelId);
    await setStatus(v.id, { status: 'draft', version: v.version }).expect(400);
  });

  it('refuses to act on a stale view (owner edited meanwhile)', async () => {
    const v = await createSubmittedVehicle(app, owner.token, modelId);
    await as(owner.token)
      .patch(`/vehicles/${v.id}`, { version: v.version, plateNumber: 'NEW1' })
      .expect(200);
    const res = await setStatus(v.id, { status: 'approved', version: v.version }).expect(409);
    expect(res.body.message).toMatch(/modified/i);
  });

  it('returns 404 for an unknown vehicle', async () => {
    await setStatus('00000000-0000-4000-8000-000000000000', {
      status: 'approved',
      version: 1,
    }).expect(404);
  });
});
