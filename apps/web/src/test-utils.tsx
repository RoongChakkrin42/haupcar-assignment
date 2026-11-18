import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { createMemoryRouter, type RouteObject, RouterProvider } from 'react-router';
import { AuthProvider } from '@/features/auth/auth-context';
import { tokenStore } from '@/lib/api';
import { server } from '@/test-setup';

export const owner = {
  id: 'u-owner',
  email: 'owner@test.local',
  name: 'Somchai',
  phone: null,
  role: 'owner' as const,
};
export const admin = {
  id: 'u-admin',
  email: 'admin@test.local',
  name: 'Admin',
  phone: null,
  role: 'admin' as const,
};

/** Logs in as `user` by seeding a token and answering /auth/me. */
export function signInAs(user: typeof owner | typeof admin) {
  tokenStore.set('test-token');
  server.use(http.get('/api/v1/auth/me', () => HttpResponse.json(user)));
}

export function renderRoutes(routes: RouteObject[], initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return { router, ...render(wrap(<RouterProvider router={router} />)) };
}
