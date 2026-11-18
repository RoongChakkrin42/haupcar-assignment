import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
