import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { server } from '@/test-setup';
import { admin, owner, renderRoutes, signInAs } from '@/test-utils';
import { routes } from './routes';

test('signed-out visitors land on the login page', async () => {
  renderRoutes(routes, '/');
  expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
});

test('owners land on their vehicle list', async () => {
  signInAs(owner);
  server.use(
    http.get('/api/v1/vehicles', () =>
      HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }),
    ),
  );
  renderRoutes(routes, '/');
  expect(await screen.findByRole('heading', { name: 'รถของฉัน' })).toBeInTheDocument();
  expect(await screen.findByText('ยังไม่มีรถในระบบ')).toBeInTheDocument();
});

test('admins land on the review queue', async () => {
  signInAs(admin);
  server.use(
    http.get('/api/v1/admin/vehicles', () =>
      HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }),
    ),
  );
  renderRoutes(routes, '/');
  expect(await screen.findByRole('heading', { name: 'ตรวจรถ' })).toBeInTheDocument();
  expect(await screen.findByText('ไม่มีรถรอตรวจ')).toBeInTheDocument();
});

test('a new owner lands on the new-vehicle form after signing up', async () => {
  const user = (await import('@testing-library/user-event')).default;
  server.use(
    http.post('/api/v1/auth/register', () =>
      HttpResponse.json({ accessToken: 'new-token', user: owner }),
    ),
    http.get('/api/v1/auth/me', () => HttpResponse.json(owner)),
    http.get('/api/v1/car-models', () => HttpResponse.json([])),
  );
  const { router } = renderRoutes(routes, '/register');
  await user.type(await screen.findByLabelText('ชื่อ'), 'Somchai');
  await user.type(screen.getByLabelText('อีเมล'), 'owner@test.local');
  await user.type(screen.getByLabelText('รหัสผ่าน (อย่างน้อย 8 ตัว)'), 'correct-horse-battery');
  await user.click(screen.getByRole('button', { name: 'สมัครและเริ่มลงรถ' }));

  expect(await screen.findByRole('heading', { name: 'ลงรถคันใหม่' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/vehicles/new');
});
