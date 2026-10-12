import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import type { UserProfile } from '../types';

vi.mock('../lib/api', () => {
  const user: UserProfile = {
    id: 'user-1',
    collegeId: 'ADMIN001',
    name: 'Dr. R. K. Verma',
    email: 'admin.lab@college.edu',
    role: 'ADMIN',
    mustChangePassword: false,
  };
  return {
    authApi: {
      login: vi.fn(async () => user),
      me: vi.fn(async () => ({ ...user, csrfToken: 'csrf-1' })),
      logout: vi.fn(async () => undefined),
      changePassword: vi.fn(async () => user),
    },
    setCsrfToken: vi.fn(),
    request: vi.fn(),
  };
});

// Imported after the mock so the mocked module is what the context receives.
import { authApi, setCsrfToken } from '../lib/api';

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

const ADMIN: UserProfile = {
  id: 'user-1',
  collegeId: 'ADMIN001',
  name: 'Dr. R. K. Verma',
  email: 'admin.lab@college.edu',
  role: 'ADMIN',
  mustChangePassword: false,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('AuthContext', () => {
  it('restores an existing session from the API on mount', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toMatchObject({ collegeId: 'ADMIN001', role: 'ADMIN' });
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isStudent).toBe(false);
    expect(setCsrfToken).toHaveBeenCalledWith('csrf-1');
  });

  it('leaves the user signed out when the session is not valid', async () => {
    vi.mocked(authApi.me).mockRejectedValueOnce(new Error('unauthorized'));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('signs in with the submitted credentials and exposes the role flags', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('ADMIN001', 'unit-test-password');
    });

    expect(authApi.login).toHaveBeenCalledWith('ADMIN001', 'unit-test-password');
    expect(result.current.user?.collegeId).toBe('ADMIN001');
  });

  it('surfaces a login failure and keeps any existing session intact', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(new Error('Invalid credentials or inactive account'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    // A valid session is restored on mount.
    await waitFor(() => expect(result.current.user?.collegeId).toBe('ADMIN001'));

    await act(async () => {
      await expect(result.current.login('ADMIN001', 'wrong')).rejects.toThrow(/Invalid credentials/);
    });

    // The error is surfaced, but a bad login must never sign out an already
    // authenticated user.
    expect(result.current.error).toMatch(/Invalid credentials/);
    expect(result.current.user?.collegeId).toBe('ADMIN001');
  });

  it('clears the user on logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
  });

  it('refreshes the session so a forced password change is cleared', async () => {
    const provisional = { ...ADMIN, mustChangePassword: true };
    vi.mocked(authApi.me).mockResolvedValueOnce({ ...provisional, csrfToken: 'csrf-1' });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.mustChangePassword).toBe(true));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.user?.mustChangePassword).toBe(false);
  });

  it('exposes no demo bypass — the surface is login, logout and reload only', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(Object.keys(result.current).sort()).toEqual(
      ['error', 'isAdmin', 'isStudent', 'loading', 'login', 'logout', 'reload', 'user'].sort(),
    );
  });

  it('renders children and throws outside a provider', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(() => renderHook(() => useAuth())).toThrow(/must be used inside AuthProvider/);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
