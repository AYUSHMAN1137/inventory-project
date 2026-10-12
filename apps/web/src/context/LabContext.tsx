import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  allocationsApi,
  dashboardApi,
  inventoryApi,
  kitsApi,
  managementApi,
  requestsApi,
} from '../lib/api';
import { useAuth } from './AuthContext';
import type {
  Allocation,
  Category,
  DashboardPayload,
  Item,
  Kit,
  LabProject,
  LabRequest,
  Location,
  ManagedUser,
} from '../types';

interface LabContextValue {
  items: Item[];
  categories: Category[];
  locations: Location[];
  kits: Kit[];
  requests: LabRequest[];
  allocations: Allocation[];
  projects: LabProject[];
  users: ManagedUser[];
  dashboard: DashboardPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshRequests: () => Promise<void>;
  refreshItems: () => Promise<void>;
  refreshAllocations: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
  categoryName: (id: string) => string;
  itemById: (id: string) => Item | undefined;
}

const LabContext = createContext<LabContextValue | null>(null);

export function LabProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [requests, setRequests] = useState<LabRequest[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [projects, setProjects] = useState<LabProject[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshItems = useCallback(async () => {
    const [itemRes, catRes, locRes] = await Promise.all([
      inventoryApi.listItems(),
      inventoryApi.listCategories(),
      inventoryApi.listLocations(),
    ]);
    setItems(itemRes.data);
    setCategories(catRes);
    setLocations(locRes);
  }, []);

  const refreshRequests = useCallback(async () => {
    const res = await requestsApi.list();
    setRequests(res.data);
  }, []);

  const refreshAllocations = useCallback(async () => {
    const res = await allocationsApi.list();
    setAllocations(res.data);
  }, []);

  const refreshDashboard = useCallback(async () => {
    const res = await dashboardApi.stats();
    setDashboard(res);
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([
        refreshItems(),
        refreshRequests(),
        refreshAllocations(),
        refreshDashboard(),
        kitsApi.list().then((r) => setKits(r.data)),
        managementApi.listProjects().then((r) => setProjects(r.data)).catch(() => setProjects([])),
        managementApi.listUsers().then((r) => setUsers(r.data)).catch(() => setUsers([])),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lab data');
    } finally {
      setLoading(false);
    }
  }, [refreshItems, refreshRequests, refreshAllocations, refreshDashboard]);

  // Load lab data only once the user is authenticated — and reload whenever the
  // signed-in identity changes (login, logout, or account switch).
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, refresh]);

  const categoryName = useCallback(
    (id: string) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised',
    [categories],
  );
  const itemById = useCallback((id: string) => items.find((i) => i.id === id), [items]);

  const value = useMemo<LabContextValue>(
    () => ({
      items,
      categories,
      locations,
      kits,
      requests,
      allocations,
      projects,
      users,
      dashboard,
      loading,
      error,
      refresh,
      refreshRequests,
      refreshItems,
      refreshAllocations,
      refreshDashboard,
      categoryName,
      itemById,
    }),
    [
      items,
      categories,
      locations,
      kits,
      requests,
      allocations,
      projects,
      users,
      dashboard,
      loading,
      error,
      refresh,
      refreshRequests,
      refreshItems,
      refreshAllocations,
      refreshDashboard,
      categoryName,
      itemById,
    ],
  );

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}

export function useLab() {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error('useLab must be used inside LabProvider');
  return ctx;
}
