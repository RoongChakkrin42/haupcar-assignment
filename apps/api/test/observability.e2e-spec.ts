import { type INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './app.js';
import { pool } from './db.js';

describe('request ids and access logs', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('gives every response a request id, reusing a sane incoming one', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const reused = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', 'abc-123');
    expect(reused.headers['x-request-id']).toBe('abc-123');

    const junk = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', 'x'.repeat(500));
    expect(junk.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('logs method, path, status and duration — never query strings or tokens', async () => {
    const log = vi.spyOn(Logger.prototype, 'log');
    await request(app.getHttpServer())
      .get('/api/v1/files/abc.webp?exp=1&sig=SECRET-SIG')
      .set('Authorization', 'Bearer SECRET-TOKEN')
      .set('X-Request-Id', 'req-1');

    const line = log.mock.calls
      .map((c) => c[0])
      .find((m) => typeof m === 'object' && m?.requestId === 'req-1');
    expect(line).toEqual({
      requestId: 'req-1',
      method: 'GET',
      path: '/api/v1/files/abc.webp',
      status: 403,
      durationMs: expect.any(Number),
      ip: expect.any(String),
    });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/SECRET-SIG|SECRET-TOKEN/);
    log.mockRestore();
  });
});

describe('auth rate limit', () => {
  let app: INestApplication;
  beforeAll(async () => {
    process.env.AUTH_RATE_LIMIT = '3';
    app = await createTestApp();
  });
  afterAll(async () => {
    delete process.env.AUTH_RATE_LIMIT;
    await app.close();
    await pool.end();
  });

  const attempt = (ip: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'nobody@test.local', password: 'wrong-password' });

  it('blocks a client after too many login attempts, per client IP', async () => {
    for (let i = 0; i < 3; i++) expect((await attempt('203.0.113.7')).status).toBe(401);
    const blocked = await attempt('203.0.113.7');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();

    // Another client behind the same proxy is unaffected.
    expect((await attempt('198.51.100.9')).status).toBe(401);
  });

  it('does not limit ordinary API routes', async () => {
    for (let i = 0; i < 6; i++)
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });
});
