import { Navigate, type RouteObject, useRouteError } from 'react-router';
import { AppLayout } from '@/components/app-layout';
import { ErrorState } from '@/components/states';
import { ReviewPage } from '@/features/admin/review-page';
import { ReviewQueuePage } from '@/features/admin/review-queue-page';
import { homeFor, useAuth } from '@/features/auth/auth-context';
import { LoginPage, RegisterPage } from '@/features/auth/auth-pages';
import { RequireAuth } from '@/features/auth/require-auth';
import { MyVehiclesPage } from '@/features/vehicles/my-vehicles-page';
import { NewVehiclePage } from '@/features/vehicles/new-vehicle-page';
import { VehicleDetailPage } from '@/features/vehicles/vehicle-detail-page';

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
