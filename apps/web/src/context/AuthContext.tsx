import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '../types';
import { api, setCsrfToken } from '../lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (collegeId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api<User & { csrfToken: string }>('/auth/me')
      .then((current) => {
        setCsrfToken(current.csrfToken);
        setUser(current);
      })
      .catch(() => {
        setCsrfToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    isLoading,
    login: async (collegeId, password) => {
      const result = await api<{ user: User; csrfToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ collegeId, password }),
      });
      setCsrfToken(result.csrfToken);
      setUser(result.user);
    },
    logout: async () => {
      await api('/auth/logout', { method: 'POST' });
      setCsrfToken(null);
      setUser(null);
    },
  }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
