import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { createAdmin } from '../src/auth/create-admin.js';
import { users } from '../src/db/schema.js';
import { createTestApp, registerAndLogin } from './app.js';
import { db, pool, resetDb } from './db.js';

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

describe('POST /auth/register', () => {
  it('creates an owner and returns a token without the password hash', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: 'Somchai@Example.com', password: 'correct-horse-battery', name: 'Somchai' })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: expect.any(String),
      email: 'somchai@example.com',
      name: 'Somchai',
      phone: null,
      role: 'owner',
    });
  });

  it('stores a hash, never the plain password', async () => {
    const { user } = await registerAndLogin(app, { password: 'correct-horse-battery' });
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.passwordHash).not.toContain('correct-horse-battery');
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('cannot self-register as admin', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: 'x@test.local', password: 'correct-horse-battery', name: 'X', role: 'admin' })
      .expect(201);
    expect(res.body.user.role).toBe('owner');
  });

  it('rejects an email that is already taken, ignoring case', async () => {
    await registerAndLogin(app, { email: 'dup@test.local' });
    await http()
      .post('/api/v1/auth/register')
      .send({ email: 'DUP@test.local', password: 'correct-horse-battery', name: 'Dup' })
      .expect(409);
  });

  it.each([
    ['invalid email', { email: 'nope', password: 'correct-horse-battery', name: 'A' }],
    ['short password', { email: 'a@test.local', password: 'short', name: 'A' }],
    ['missing name', { email: 'a@test.local', password: 'correct-horse-battery' }],
  ])('rejects %s with 400', async (_, body) => {
    await http().post('/api/v1/auth/register').send(body).expect(400);
  });
});

describe('POST /auth/login', () => {
  it('returns a token that works for /auth/me', async () => {
    const { email, password } = await registerAndLogin(app);
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: email.toUpperCase(), password })
      .expect(200);

    const me = await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({ email, role: 'owner' });
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const { email } = await registerAndLogin(app);
    const wrong = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
    const unknown = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@test.local', password: 'wrong-password' })
      .expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });
});

describe('protected routes', () => {
  it('rejects requests without a token', async () => {
    await http().get('/api/v1/auth/me').expect(401);
  });

  it('rejects a forged token', async () => {
    await http().get('/api/v1/auth/me').set('Authorization', 'Bearer not.a.jwt').expect(401);
  });

  it('rejects a token for a user that no longer exists', async () => {
    const { token, user } = await registerAndLogin(app);
    await db.delete(users).where(eq(users.id, user.id));
    await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('keeps health public', async () => {
    await http().get('/api/v1/health').expect(200);
  });
});

describe('createAdmin', () => {
  it('creates an admin who can log in', async () => {
    await createAdmin(db, {
      email: 'admin@test.local',
      password: 'admin-password-123',
      name: 'Admin',
    });
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: 'admin-password-123' })
      .expect(200);
    expect(login.body.user.role).toBe('admin');
  });
});

describe('validation errors', () => {
  it('lists each invalid field by path', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: 'nope', password: 'x' })
      .expect(400);
    expect(res.body.issues.map((i: { path: string }) => i.path).sort()).toEqual([
      'email',
      'name',
      'password',
    ]);
    expect(res.body.issues[0]).toEqual({ path: expect.any(String), message: expect.any(String) });
  });
});
