import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, setCsrfToken } from '../lib/api';
import type { UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (collegeId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the session from the server (e.g. after a password change). */
  reload: () => Promise<void>;
  isAdmin: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount using the HttpOnly cookie.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await authApi.me();
        if (!cancelled) {
          if (profile.csrfToken) setCsrfToken(profile.csrfToken);
          setUser(profile);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (collegeId: string, password: string) => {
    setError(null);
    try {
      const profile = await authApi.login(collegeId, password);
      setUser(profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  // Re-reads the current session so the UI can pick up server-side changes
  // (for example `mustChangePassword` being cleared after a password change).
  const reload = useCallback(async () => {
    setError(null);
    try {
      const profile = await authApi.me();
      if (profile.csrfToken) setCsrfToken(profile.csrfToken);
      setUser(profile);
    } catch {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      login,
      logout,
      reload,
      isAdmin: user?.role === 'ADMIN',
      isStudent: user?.role === 'STUDENT',
    }),
    [user, loading, error, login, logout, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
