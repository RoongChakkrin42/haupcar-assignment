import { LogOut } from 'lucide-react';
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { homeFor, useAuth } from '@/features/auth/auth-context';
import { cn } from '@/lib/utils';
import { Brand } from './brand';
import { ListSkeleton } from './states';

export function AppLayout() {
  const { user, logout } = useAuth();
  const links =
    user?.role === 'admin'
      ? [{ to: '/admin', label: 'ตรวจรถ' }]
      : [{ to: '/vehicles', label: 'รถของฉัน' }];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-[1000] border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Brand to={user ? homeFor(user) : '/'} />
          <nav className="flex gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium',
                    isActive ? 'bg-muted' : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.name}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut /> ออกจากระบบ
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Suspense fallback={<ListSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
