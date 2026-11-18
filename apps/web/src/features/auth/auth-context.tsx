import type { AuthToken, RegisterInput, User } from '@haupcar/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, tokenStore } from '@/lib/api';

type Auth = {
  user: User | null;
  loading: boolean;
  /** True after the user pressed "log out" (vs. the session expiring). */
  signedOut: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(tokenStore.get);
  const [signedOut, setSignedOut] = useState(false);
  const me = useQuery({
    queryKey: ['me', token],
    queryFn: () => api<User>('/auth/me'),
    enabled: !!token,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const signOut = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  // api() fires this when the server rejects the token (expired or user deleted).
  useEffect(() => {
    window.addEventListener('auth:expired', signOut);
    return () => window.removeEventListener('auth:expired', signOut);
  }, [signOut]);

  const signIn = useCallback(
    ({ accessToken, user }: AuthToken) => {
      tokenStore.set(accessToken);
      queryClient.setQueryData(['me', accessToken], user);
      setToken(accessToken);
      setSignedOut(false);
      return user;
    },
    [queryClient],
  );

  const value = useMemo<Auth>(
    () => ({
      user: token ? (me.data ?? null) : null,
      loading: !!token && me.isPending,
      signedOut,
      login: (email, password) =>
        api<AuthToken>('/auth/login', { method: 'POST', body: { email, password } }).then(signIn),
      register: (input) =>
        api<AuthToken>('/auth/register', { method: 'POST', body: input }).then(signIn),
      logout: () => {
        setSignedOut(true);
        signOut();
      },
    }),
    [token, me.data, me.isPending, signedOut, signIn, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}

export const homeFor = (user: User) => (user.role === 'admin' ? '/admin' : '/vehicles');
