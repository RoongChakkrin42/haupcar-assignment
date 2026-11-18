import { HttpResponse, http } from 'msw';
import { server } from '@/test-setup';
import { ApiError, api, errorMessage, tokenStore } from './api';

test('sends the bearer token and parses JSON', async () => {
  tokenStore.set('t0k3n');
  server.use(
    http.get('/api/v1/auth/me', ({ request }) =>
      HttpResponse.json({ auth: request.headers.get('authorization') }),
    ),
  );
  expect(await api('/auth/me')).toEqual({ auth: 'Bearer t0k3n' });
});

test('returns undefined for 204', async () => {
  server.use(http.delete('/api/v1/vehicles/1', () => new HttpResponse(null, { status: 204 })));
  expect(await api('/vehicles/1', { method: 'DELETE' })).toBeUndefined();
});

test('throws ApiError carrying validation issues and missing fields', async () => {
  server.use(
    http.post('/api/v1/vehicles/1/submit', () =>
      HttpResponse.json({ message: 'Vehicle is incomplete', missing: ['photos'] }, { status: 422 }),
    ),
  );
  const err = await api('/vehicles/1/submit', { method: 'POST' }).catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status: 422, missing: ['photos'] });
});

test('clears the token and announces expiry on 401', async () => {
  tokenStore.set('expired');
  const onExpired = vi.fn();
  window.addEventListener('auth:expired', onExpired);
  server.use(
    http.get('/api/v1/auth/me', () =>
      HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
    ),
  );

  await expect(api('/auth/me')).rejects.toBeInstanceOf(ApiError);
  expect(tokenStore.get()).toBeNull();
  expect(onExpired).toHaveBeenCalled();
  window.removeEventListener('auth:expired', onExpired);
});

test.each([
  [
    409,
    'Vehicle was modified by someone else; reload and try again',
    'มีคนแก้ไขรถคันนี้ไปก่อนแล้ว โหลดหน้าใหม่แล้วลองอีกครั้ง',
  ],
  [409, 'Plate number is already registered in this province', 'ทะเบียนนี้ถูกลงไว้แล้วในจังหวัดนี้'],
  [409, 'Email is already registered', 'อีเมลนี้สมัครไว้แล้ว'],
  [401, 'Invalid email or password', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'],
  [413, 'Payload Too Large', 'ไฟล์ใหญ่เกิน 10 MB'],
  [429, 'ThrottlerException: Too Many Requests', 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่'],
  [500, 'boom', 'ระบบขัดข้อง ลองใหม่อีกครั้ง'],
])('translates %i "%s" for people', (status, message, thai) => {
  expect(errorMessage(new ApiError(status, message))).toBe(thai);
});

test('describes network failures', () => {
  expect(errorMessage(new TypeError('Failed to fetch'))).toBe(
    'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
  );
});
