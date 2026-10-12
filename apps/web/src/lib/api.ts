// ---------------------------------------------------------------------------
// API client — talks to the live Express API at /api/v1 (proxied by Vite).
// Session cookie is HttpOnly; the CSRF token is held in memory and sent as
// x-csrf-token on every state-changing request (matches requireCsrf middleware).
// ---------------------------------------------------------------------------

import type {
  Allocation,
  Category,
  CreateItemPayload,
  CreateRequestPayload,
  DashboardPayload,
  DecisionPayload,
  IssuePayload,
  Item,
  Kit,
  LabProject,
  LabRequest,
  Location,
  ManagedUser,
  ReturnPayload,
  StockMovement,
  StockReceiptPayload,
  UserProfile,
} from '../types';

const BASE = '/api/v1';

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export function getCsrfToken() {
  return csrfToken;
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (method !== 'GET' && method !== 'HEAD' && csrfToken) {
    headers.set('x-csrf-token', csrfToken);
  }

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = (payload ?? {}) as ApiErrorBody;
    const message = body.error?.message ?? `Request failed (${response.status})`;
    const code = body.error?.code ?? 'REQUEST_FAILED';
    throw new ApiError(message, code, response.status);
  }

  return payload as T;
}

function query(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

export function newCommandId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ------------------------------------------------------------------ Auth ----

export const authApi = {
  async login(collegeId: string, password: string) {
    const res = await request<{ user: UserProfile; csrfToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ collegeId, password }),
    });
    setCsrfToken(res.csrfToken);
    return res.user;
  },
  me() {
    return request<UserProfile>('/auth/me');
  },
  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      setCsrfToken(null);
    }
  },
  async changePassword(payload: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    const res = await request<{ user: UserProfile; csrfToken: string }>('/auth/password', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    setCsrfToken(res.csrfToken);
    return res.user;
  },
};

// ------------------------------------------------------------- Inventory ----

export const inventoryApi = {
  listItems(params: { q?: string; categoryId?: string; nature?: string; availableOnly?: boolean } = {}) {
    return request<{ data: Item[]; meta: { total: number } }>(`/items${query(params)}`);
  },
  getItem(id: string) {
    return request<Item>(`/items/${id}`);
  },
  createItem(payload: CreateItemPayload) {
    return request<Item>('/items', { method: 'POST', body: JSON.stringify(payload) });
  },
  listCategories() {
    return request<Category[]>('/categories');
  },
  createCategory(payload: { name: string; description?: string }) {
    return request<Category>('/categories', { method: 'POST', body: JSON.stringify(payload) });
  },
  listLocations() {
    return request<Location[]>('/locations');
  },
  createLocation(payload: { name: string; type: string; parentId?: string | null }) {
    return request<Location>('/locations', { method: 'POST', body: JSON.stringify(payload) });
  },
  receiveStock(payload: StockReceiptPayload) {
    return request('/stock-receipts', { method: 'POST', body: JSON.stringify(payload) });
  },
  listMovements(limit = 50) {
    return request<{ data: StockMovement[] }>(`/stock-movements?limit=${limit}`);
  },
};

// -------------------------------------------------------------- Requests ----

export const requestsApi = {
  list() {
    return request<{ data: LabRequest[] }>('/requests');
  },
  create(payload: CreateRequestPayload) {
    return request<LabRequest>('/requests', { method: 'POST', body: JSON.stringify(payload) });
  },
  decide(id: string, payload: DecisionPayload) {
    return request<LabRequest>(`/requests/${id}/decision`, { method: 'POST', body: JSON.stringify(payload) });
  },
  cancel(id: string) {
    return request<LabRequest>(`/requests/${id}/cancel`, { method: 'POST' });
  },
};

// --------------------------------------------------------------- Issues -----

export const issuesApi = {
  issue(payload: IssuePayload) {
    return request('/issues', { method: 'POST', body: JSON.stringify(payload) });
  },
};

// -------------------------------------------------------------- Returns -----

export const returnsApi = {
  process(payload: ReturnPayload) {
    return request('/returns', { method: 'POST', body: JSON.stringify(payload) });
  },
};

// ---------------------------------------------------------------- Kits ------

export const kitsApi = {
  list() {
    return request<{ data: Kit[] }>('/kits');
  },
  create(payload: { name: string; description?: string; items: { itemId: string; quantity: number }[] }) {
    return request<Kit>('/kits', { method: 'POST', body: JSON.stringify(payload) });
  },
};

// ----------------------------------------------------------- Dashboard ------

export const dashboardApi = {
  stats() {
    return request<DashboardPayload>('/dashboard/stats');
  },
};

// --------------------------------------------------------- Allocations ------

export const allocationsApi = {
  list() {
    return request<{ data: Allocation[] }>('/allocations');
  },
};

// ---------------------------------------------------------- Management ------

export const managementApi = {
  listUsers() {
    return request<{ data: ManagedUser[] }>('/users');
  },
  createUser(payload: { collegeId: string; name: string; email?: string | null; role: string; temporaryPassword: string }) {
    return request<ManagedUser>('/users', { method: 'POST', body: JSON.stringify(payload) });
  },
  listProjects() {
    return request<{ data: LabProject[] }>('/projects');
  },
  createProject(payload: { name: string; description?: string; memberIds: string[] }) {
    return request<LabProject>('/projects', { method: 'POST', body: JSON.stringify(payload) });
  },
};

export const healthApi = {
  live() {
    return request<{ status: string; timestamp: string }>('/health/live');
  },
  ready() {
    return request<{ status: string }>('/health/ready');
  },
};
