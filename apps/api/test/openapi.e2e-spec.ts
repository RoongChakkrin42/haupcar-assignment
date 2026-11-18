import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { authTokenSchema, userSchema } from '../src/auth/auth.schemas.js';
import {
  carModelSchema,
  documentSchema,
  photoSchema,
  vehiclePageSchema,
  vehicleSchema,
} from '../src/vehicles/vehicles.schemas.js';
import {
  addSubmitMedia,
  createTestApp,
  registerAndLogin,
  uploadDocument,
  uploadPhoto,
} from './app.js';
import { insertCarModel, pool, resetDb } from './db.js';

let app: INestApplication;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(resetDb);
afterAll(async () => {
  await app.close();
  await pool.end();
});

type Operation = {
  summary?: string;
  responses: Record<string, { content?: Record<string, { schema?: object }> }>;
};

describe('OpenAPI document', () => {
  it('serves Swagger UI and the JSON spec without a token', async () => {
    await http().get('/api/docs').expect(200);
    await http().get('/api/docs-json').expect(200);
  });

  it('documents every route with a summary and a success response schema', async () => {
    const { body: spec } = await http().get('/api/docs-json').expect(200);
    const operations = Object.entries(
      spec.paths as Record<string, Record<string, Operation>>,
    ).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, op]) => ({
        route: `${method.toUpperCase()} ${path}`,
        op,
      })),
    );
    expect(operations.length).toBeGreaterThanOrEqual(10);

    const undocumented = operations.filter(({ op }) => {
      const success = Object.entries(op.responses).find(([status]) => status.startsWith('2'));
      if (!op.summary || !success) return true;
      return success[0] !== '204' && !Object.values(success[1].content ?? {}).some((c) => c.schema);
    });
    expect(undocumented.map((o) => o.route)).toEqual([]);
  });
});

describe('responses match the documented schemas', () => {
  it('auth, car models and vehicles', async () => {
    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email: 'docs@test.local', password: 'correct-horse-battery', name: 'Docs' })
      .expect(201);
    authTokenSchema.parse(reg.body);

    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'docs@test.local', password: 'correct-horse-battery' })
      .expect(200);
    authTokenSchema.parse(login.body);

    const { token } = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${token}` };
    userSchema.parse((await http().get('/api/v1/auth/me').set(auth).expect(200)).body);

    const { id: modelId } = await insertCarModel();
    carModelSchema
      .array()
      .parse((await http().get('/api/v1/car-models').set(auth).expect(200)).body);

    const created = await http()
      .post('/api/v1/vehicles')
      .set(auth)
      .send({
        modelId,
        plateNumber: '1กข1234',
        plateProvince: 'กรุงเทพมหานคร',
        location: { lat: 13.7, lng: 100.5 },
        pickupAddress: 'Siam',
        dailyPrice: 100000,
      })
      .expect(201);
    vehicleSchema.parse(created.body);
    const id = created.body.id;

    vehiclePageSchema.parse((await http().get('/api/v1/vehicles').set(auth).expect(200)).body);
    vehicleSchema.parse((await http().get(`/api/v1/vehicles/${id}`).set(auth).expect(200)).body);
    vehicleSchema.parse(
      (
        await http()
          .patch(`/api/v1/vehicles/${id}`)
          .set(auth)
          .send({ version: 1, color: 'ขาว' })
          .expect(200)
      ).body,
    );
    photoSchema.parse((await uploadPhoto(app, token, id)).body);
    documentSchema.parse(
      (
        await uploadDocument(app, token, id, 'insurance')
          .field('expiresOn', '2027-01-31')
          .expect(201)
      ).body,
    );
    await addSubmitMedia(app, token, id);
    vehicleSchema.parse(
      (await http().post(`/api/v1/vehicles/${id}/submit`).set(auth).expect(200)).body,
    );
  });
});
