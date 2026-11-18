import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/setup-app.js';

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = setupApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}

export async function registerAndLogin(
  app: INestApplication,
  body: { email?: string; password?: string; name?: string } = {},
) {
  const creds = {
    email: body.email ?? `owner-${crypto.randomUUID()}@test.local`,
    password: body.password ?? 'correct-horse-battery',
    name: body.name ?? 'Somchai',
  };
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send(creds)
    .expect(201);
  return { ...creds, token: res.body.accessToken as string, user: res.body.user };
}

/** A real JPEG carrying EXIF incl. GPS — what a phone camera produces. */
export function testJpeg({ width = 2400, height = 1800 } = {}) {
  return sharp({ create: { width, height, channels: 3, background: '#c33' } })
    .jpeg()
    .withExif({
      IFD0: { Copyright: 'owner phone' },
      IFD3: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'E' },
    })
    .toBuffer();
}

export const testPdf = () => Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

export async function uploadPhoto(app: INestApplication, token: string, vehicleId: string) {
  return request(app.getHttpServer())
    .post(`/api/v1/vehicles/${vehicleId}/photos`)
    .set('Authorization', `Bearer ${token}`)
    .attach('file', await testJpeg({ width: 400, height: 300 }), 'car.jpg');
}

export function uploadDocument(
  app: INestApplication,
  token: string,
  vehicleId: string,
  type = 'registration',
  file: Buffer = testPdf(),
  filename = 'doc.pdf',
) {
  return request(app.getHttpServer())
    .post(`/api/v1/vehicles/${vehicleId}/documents`)
    .set('Authorization', `Bearer ${token}`)
    .field('type', type)
    .attach('file', file, filename);
}

/** Adds what submit needs beyond the vehicle fields: one photo and the registration book. */
export async function addSubmitMedia(app: INestApplication, token: string, vehicleId: string) {
  expect((await uploadPhoto(app, token, vehicleId)).status).toBe(201);
  await uploadDocument(app, token, vehicleId).expect(201);
}
