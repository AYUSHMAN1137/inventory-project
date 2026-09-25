import { expect, test } from '@playwright/test';

const admin = { id: 'admin-1', collegeId: 'ADMIN001', name: 'Lab Admin', role: 'ADMIN', csrfToken: 'csrf-token' };

test('signed-out experience opens an accessible login dialog', async ({ page }) => {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Lab inventory' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('College ID')).toBeFocused();
});

test('admin sees operational navigation and can open inventory intake', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const url = route.request().url();
    if (url.endsWith('/auth/me')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(admin) });
    if (url.endsWith('/items')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], meta: { total: 0 } }) });
    if (url.endsWith('/requests')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    if (url.endsWith('/allocations')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    if (url.endsWith('/kits')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    if (url.endsWith('/locations')) return route.fulfill({ contentType: 'application/json', body: '[]' });
    if (url.endsWith('/dashboard/stats')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ metrics: { pendingRequestsCount: 0, approvedNotIssuedCount: 0, activeAllocationsCount: 0, allocatedUnits: 0, lowStockCount: 0 }, lowStockItems: [] }) });
    if (url.endsWith('/stock-movements')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    return route.fulfill({ contentType: 'application/json', body: '{}' });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Lab overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request queue' })).toBeVisible();
  await page.getByRole('button', { name: 'Inventory', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Receive stock' }).click();
  await expect(page.getByRole('heading', { name: 'Stock Receiving Intake' })).toBeVisible();
});

test('mobile viewport exposes navigation without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await expect(page.getByRole('heading', { name: 'Lab inventory' })).toBeVisible();
});
