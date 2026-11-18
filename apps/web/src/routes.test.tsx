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
