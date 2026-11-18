import { lazy } from 'react';
import { Navigate, type RouteObject, useRouteError } from 'react-router';
import { AppLayout } from '@/components/app-layout';
import { ErrorState } from '@/components/states';
import { homeFor, useAuth } from '@/features/auth/auth-context';
import { LoginPage, RegisterPage } from '@/features/auth/auth-pages';
import { RequireAuth } from '@/features/auth/require-auth';

// Signed-in areas load on demand (owner pages pull in Leaflet; admins never download them).
const MyVehiclesPage = lazy(() =>
  import('@/features/vehicles/my-vehicles-page').then((m) => ({ default: m.MyVehiclesPage })),
);
const NewVehiclePage = lazy(() =>
  import('@/features/vehicles/new-vehicle-page').then((m) => ({ default: m.NewVehiclePage })),
);
const VehicleDetailPage = lazy(() =>
  import('@/features/vehicles/vehicle-detail-page').then((m) => ({ default: m.VehicleDetailPage })),
);
const ReviewQueuePage = lazy(() =>
  import('@/features/admin/review-queue-page').then((m) => ({ default: m.ReviewQueuePage })),
);
const ReviewPage = lazy(() =>
  import('@/features/admin/review-page').then((m) => ({ default: m.ReviewPage })),
);

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? homeFor(user) : '/login'} replace />;
}

function RouteError() {
  const error = useRouteError();
  return (
    <div className="mx-auto max-w-xl p-8">
      <ErrorState error={error} onRetry={() => window.location.reload()} />
    </div>
  );
}

export const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      {
        path: '/vehicles',
        element: (
          <RequireAuth requiredRole="owner">
            <MyVehiclesPage />
          </RequireAuth>
        ),
      },
      {
        path: '/vehicles/new',
        element: (
          <RequireAuth requiredRole="owner">
            <NewVehiclePage />
          </RequireAuth>
        ),
      },
      {
        path: '/vehicles/:id',
        element: (
          <RequireAuth requiredRole="owner">
            <VehicleDetailPage />
          </RequireAuth>
        ),
      },
      {
        path: '/admin',
        element: (
          <RequireAuth requiredRole="admin">
            <ReviewQueuePage />
          </RequireAuth>
        ),
      },
      {
        path: '/admin/vehicles/:id',
        element: (
          <RequireAuth requiredRole="admin">
            <ReviewPage />
          </RequireAuth>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
