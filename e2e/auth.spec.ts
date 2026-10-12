import { expect, test } from '@playwright/test';
import { resetDatabase } from './reset-db';
import { CREDENTIALS, goTo, login, logout, navLink } from './helpers';

// Each spec file starts from a known database state.
test.beforeAll(() => resetDatabase());

/** The signed-in user's name, scoped to the topbar to avoid ambiguity. */
const topbarName = (page: import('@playwright/test').Page, name: string) =>
  page.locator('header').getByText(name);

test.describe('Authentication & shell', () => {
  test('signed-out visitors see the login screen, not the app', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText('Complete visibility over every component')).toBeVisible();
    // No application chrome while signed out.
    await expect(navLink(page, 'Dashboard')).toHaveCount(0);
    await expect(page.getByText('Lab Operations Dashboard')).toHaveCount(0);
  });

  test('rejects invalid credentials without leaking the app', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('College ID').fill('ADMIN001');
    await page.getByLabel('Password').fill('wrong-password-123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByText(/invalid credentials|auth failed/i)).toBeVisible();
    await expect(navLink(page, 'Dashboard')).toHaveCount(0);
  });

  test('admin login reaches the operations dashboard with live data', async ({ page }) => {
    await login(page, 'admin');

    await expect(topbarName(page, CREDENTIALS.adminName)).toBeVisible();
    await expect(page.getByText('ADMIN001 · Admin')).toBeVisible();

    // Sidebar exposes the admin-only surfaces.
    for (const label of ['Dashboard', 'Inventory', 'Request Queue', 'Issue Desk', 'Returns Desk', 'Stock Intake', 'Audit Ledger']) {
      await expect(navLink(page, label)).toBeVisible();
    }
    // Real data loaded from the API, not an empty shell.
    await expect(page.getByText(/^\d+$/).first()).toBeVisible();
    await expect(page.getByText(/total units on record/)).toBeVisible();
  });

  test('session survives a full page reload (HttpOnly cookie)', async ({ page }) => {
    await login(page, 'admin');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Lab Operations Dashboard' })).toBeVisible();
    await expect(topbarName(page, CREDENTIALS.adminName)).toBeVisible();
  });

  test('logout returns to the login screen and clears the session', async ({ page }) => {
    await login(page, 'admin');
    await logout(page);

    // Reloading must not resurrect the session.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  });

  test('students do not receive admin navigation', async ({ page }) => {
    await login(page, 'student');
    await expect(topbarName(page, CREDENTIALS.studentName)).toBeVisible();
    await expect(page.getByText('2024BCSE042 · Student')).toBeVisible();

    for (const label of ['Request Queue', 'Issue Desk', 'Returns Desk', 'Stock Intake', 'Audit Ledger']) {
      await expect(navLink(page, label)).toHaveCount(0);
    }
    // Student surfaces are present instead.
    for (const label of ['Browse Inventory', 'My Requests', 'My Borrowed Items', 'Request Cart']) {
      await expect(navLink(page, label)).toBeVisible();
    }
  });

  test('a student cannot reach admin routes by typing the URL', async ({ page }) => {
    await login(page, 'student');
    await page.goto('/intake');
    // Redirected back to the student dashboard.
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Stock Intake' })).toHaveCount(0);
  });

  test('every admin navigation destination renders its own screen', async ({ page }) => {
    await login(page, 'admin');

    const screens: [string, string][] = [
      ['Dashboard', 'Lab Operations Dashboard'],
      ['Inventory', 'Lab Inventory'],
      ['Kits & Bundles', 'Kits & Bundles'],
      ['Lab Layout', 'Lab Layout'],
      ['Audit Ledger', 'Audit Ledger'],
      ['Users & Projects', 'Users & Projects'],
    ];
    for (const [link, heading] of screens) {
      await goTo(page, link);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
  });
});
