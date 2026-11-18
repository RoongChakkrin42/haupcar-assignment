import { screen } from '@testing-library/react';
import { admin, owner, renderRoutes, signInAs } from '@/test-utils';
import { RequireAuth } from './require-auth';

const routes = [
  { path: '/login', element: <p>login page</p> },
  {
    path: '/vehicles',
    element: (
      <RequireAuth>
        <p>owner area</p>
      </RequireAuth>
    ),
  },
  {
    path: '/admin',
    element: (
      <RequireAuth requiredRole="admin">
        <p>admin area</p>
      </RequireAuth>
    ),
  },
];

test('sends signed-out visitors to login, remembering where they were going', async () => {
  const { router } = renderRoutes(routes, '/vehicles');
  expect(await screen.findByText('login page')).toBeInTheDocument();
  expect(router.state.location.search).toBe('?next=%2Fvehicles');
});

test('lets a signed-in owner in', async () => {
  signInAs(owner);
  renderRoutes(routes, '/vehicles');
  expect(await screen.findByText('owner area')).toBeInTheDocument();
});

test('keeps owners out of admin pages', async () => {
  signInAs(owner);
  const { router } = renderRoutes(routes, '/admin');
  expect(await screen.findByText('owner area')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/vehicles');
});

test('lets admins into admin pages', async () => {
  signInAs(admin);
  renderRoutes(routes, '/admin');
  expect(await screen.findByText('admin area')).toBeInTheDocument();
});

test('logging out goes to login without remembering the page', async () => {
  signInAs(owner);
  const { AppLayout } = await import('@/components/app-layout');
  const { router } = renderRoutes(
    [
      { path: '/login', element: <p>login page</p> },
      {
        element: (
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        ),
        children: [{ path: '/vehicles', element: <p>owner area</p> }],
      },
    ],
    '/vehicles',
  );
  (await screen.findByRole('button', { name: /ออกจากระบบ/ })).click();
  expect(await screen.findByText('login page')).toBeInTheDocument();
  expect(router.state.location.search).toBe('');
});
