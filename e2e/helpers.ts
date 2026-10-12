import { expect, type Locator, type Page } from '@playwright/test';

export const CREDENTIALS = {
  admin: { collegeId: 'ADMIN001', password: 'Password@123' },
  student: { collegeId: '2024BCSE042', password: 'Password@123' },
  student2: { collegeId: '2024BEEE088', password: 'Password@123' },
  adminName: 'Dr. R. K. Verma (Faculty In-Charge)',
  studentName: 'Ayush Sharma',
} as const;

/** Signs in through the real login form. */
export async function login(page: Page, who: 'admin' | 'student' | 'student2' = 'admin') {
  const creds = CREDENTIALS[who];
  await page.goto('/');
  const idField = page.getByLabel('College ID');
  await expect(idField).toBeVisible();
  await idField.fill(creds.collegeId);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Dashboard|Welcome back/ })).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByTitle('Sign out').click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
}

/**
 * Sidebar links carry badge counts (e.g. "Request Queue 3"), so match on a
 * prefix rather than the exact accessible name.
 */
export function navLink(page: Page, label: string): Locator {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Scope to the sidebar so dashboard CTAs with the same label don't collide.
  return page.locator('aside').getByRole('link', { name: new RegExp(`^${escaped}\\b`) });
}

/** Navigates using the sidebar link with the given label. */
export async function goTo(page: Page, label: string) {
  await navLink(page, label).click();
}

/** The modal/drawer overlay currently on screen. */
export function overlay(page: Page): Locator {
  return page.locator('.shadow-2xl').last();
}

/** Footer action area of the open overlay (excludes in-body helper buttons). */
export function overlayFooter(page: Page): Locator {
  return overlay(page).locator('> div').last();
}

/** Clicks a footer button in the open overlay and waits for the overlay to close. */
export async function confirmOverlay(page: Page, name: string | RegExp) {
  const panel = overlay(page);
  // Footer buttons live in the last direct child div; body helper buttons with
  // the same label (e.g. "Approve all") must not match.
  await panel.locator('> div').last().getByRole('button', { name, exact: true }).click();
  await expect(panel).toHaveCount(0);
}

/** Reads a KPI tile value by its label. */
export async function kpi(page: Page, label: string): Promise<string> {
  const tile = page.locator('div.card', { hasText: label }).first();
  return (await tile.locator('.kpi-value').first().innerText()).trim();
}
