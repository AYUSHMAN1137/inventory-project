import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { AuthProvider } from './context/AuthContext';

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
}

afterEach(() => vi.restoreAllMocks());

describe('application shell', () => {
  it('shows a focused sign-in page for signed-out users', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(json({}, 401));
    render(<AuthProvider><App /></AuthProvider>);
    expect(await screen.findByRole('heading', { name: /lab inventory/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(screen.getByLabelText(/college id/i)).toBeInTheDocument();
    expect(screen.queryByText(/quick demo credentials/i)).not.toBeInTheDocument();
  });

  it('shows role-focused admin navigation and operational work', async () => {
    const user = { id: 'admin-1', collegeId: 'ADMIN001', name: 'Lab Admin', role: 'ADMIN', csrfToken: 'csrf' };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/auth/me')) return json(user);
      if (url.endsWith('/items')) return json({ data: [], meta: { total: 0 } });
      if (url.endsWith('/categories') || url.endsWith('/locations')) return json([]);
      if (url.endsWith('/kits') || url.endsWith('/requests') || url.endsWith('/allocations') || url.endsWith('/stock-movements')) return json({ data: [] });
      if (url.endsWith('/dashboard/stats')) return json({ metrics: { totalItemsCount: 0, activeProjectsCount: 0, totalUnits: 0, allocatedUnits: 0, availableUnits: 0, unavailableUnits: 0, lowStockCount: 0, pendingRequestsCount: 0 }, lowStockItems: [], recentMovements: [] });
      return json({});
    });
    render(<AuthProvider><App /></AuthProvider>);
    expect(await screen.findByRole('button', { name: /request queue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /issue desk/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /lab overview/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/laboratory operations command/i)).not.toBeInTheDocument());
  });
});
