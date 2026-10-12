import { expect, test } from '@playwright/test';
import { resetDatabase } from './reset-db';
import { confirmOverlay, goTo, login, overlay } from './helpers';

// Each spec file starts from a known database state.
test.beforeAll(() => resetDatabase());

test.describe('Kits & bundles', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
    await goTo(page, 'Kits & Bundles');
    await expect(page.getByRole('heading', { name: 'Kits & Bundles' })).toBeVisible();
  });

  test('lists the six seeded kits with a bill of materials', async ({ page }) => {
    for (const kit of [
      'Robotics Core Starter Kit',
      'IoT Sensor Node Kit',
      'Edge AI Vision Kit',
      'LiDAR Mapping Payload',
      'Prototyping & Soldering Bench Kit',
      'Mechatronics Motor Control Kit',
    ]) {
      await expect(page.getByRole('heading', { name: kit })).toBeVisible();
    }
    await expect(page.getByText(/bill of materials/i).first()).toBeVisible();
  });

  test('kit availability reflects live stock', async ({ page }) => {
    const robotics = page.locator('div.card', { hasText: 'Robotics Core Starter Kit' }).first();
    await expect(robotics.getByText(/All parts in stock|Partly unavailable/)).toBeVisible();
  });

  test('student can add a whole kit to the cart', async ({ page }) => {
    await page.getByTitle('Sign out').click();
    await login(page, 'student');
    await goTo(page, 'Kits & Bundles');

    const kit = page.locator('div.card', { hasText: 'IoT Sensor Node Kit' }).first();
    await kit.getByRole('button', { name: /Add all parts to cart|Add remaining parts/ }).click();

    // Redirects to the cart with the constituent parts present.
    await expect(page.getByRole('heading', { name: 'Request Cart' })).toBeVisible();
    await expect(page.getByText('ESP32-S3 DevKitC-1')).toBeVisible();
    await expect(page.getByText('BME280 Temp Humidity Pressure Sensor')).toBeVisible();
  });
});

test.describe('Lab layout explorer', () => {
  test('drills from room to cabinet to drawer contents', async ({ page }) => {
    await login(page, 'admin');
    await goTo(page, 'Lab Layout');
    await expect(page.getByRole('heading', { name: 'Lab Layout' })).toBeVisible();

    // Four seeded rooms.
    await expect(page.getByText('Robotics & Automation Lab (Room 501)').first()).toBeVisible();
    await expect(page.getByText('Embedded Systems Lab (Room 502)').first()).toBeVisible();
    await expect(page.getByText('IoT & Sensors Lab (Room 503)').first()).toBeVisible();
    await expect(page.getByText('Fabrication & Prototyping Room (Room 504)').first()).toBeVisible();

    await page.getByRole('button', { name: /Robotics & Automation Lab/ }).first().click();
    await expect(page.getByText('Cabinets in')).toBeVisible();

    await page.getByRole('button', { name: /Cabinet A — Microcontrollers/ }).first().click();
    // Drawer contents appear.
    await expect(page.getByText('Drawer 1 — Arduino Boards')).toBeVisible();
    await expect(page.getByText('Arduino Uno R3')).toBeVisible();
  });
});

test.describe('Stock intake', () => {
  test('records a bulk receipt and increases available stock', async ({ page }) => {
    await login(page, 'admin');

    // Read the baseline for a bulk item.
    await goTo(page, 'Inventory');
    await page.getByPlaceholder('Search by name, model or description…').fill('MB-102');
    const card = page.locator('div.card', { hasText: 'MB-102' }).first();
    await expect(card).toBeVisible();
    const before = Number((await card.locator('.mono').first().innerText()).split('/')[0].trim());

    await goTo(page, 'Stock Intake');
    await expect(page.getByRole('heading', { name: 'Stock Intake' })).toBeVisible();

    await page.locator('select').first().selectOption({ label: 'MB-102 830-Point Breadboard — Consumables & Hardware' });
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.locator('input[type=number]').first().fill('5');
    await page.getByRole('button', { name: 'Record receipt' }).click();

    await expect(page.getByText(/Recorded receipt of 5/)).toBeVisible();

    // Verify the stock actually increased.
    await page.getByTitle('Refresh data').click();
    await goTo(page, 'Inventory');
    await page.getByPlaceholder('Search by name, model or description…').fill('MB-102');
    const after = page.locator('div.card', { hasText: 'MB-102' }).first();
    const afterQty = Number((await after.locator('.mono').first().innerText()).split('/')[0].trim());
    expect(afterQty).toBe(before + 5);
  });

  test('creating a new catalogue item makes it searchable', async ({ page }) => {
    await login(page, 'admin');
    await goTo(page, 'Stock Intake');
    await page.getByRole('button', { name: 'New catalogue item' }).click();

    const name = `E2E Test Component ${Date.now()}`;
    const panel = overlay(page);
    await panel.getByLabel('Item name').fill(name);
    await panel.getByLabel('Category').selectOption({ index: 1 });
    await confirmOverlay(page, 'Create item');

    await goTo(page, 'Inventory');
    await page.getByPlaceholder('Search by name, model or description…').fill(name);
    await expect(page.getByText(name)).toBeVisible();
  });
});

test.describe('Users & projects', () => {
  test('lists accounts and projects with roles', async ({ page }) => {
    await login(page, 'admin');
    await goTo(page, 'Users & Projects');
    await expect(page.getByRole('heading', { name: 'Users & Projects' })).toBeVisible();

    const table = page.getByRole('table').first();
    await expect(table.getByText('ADMIN001')).toBeVisible();
    await expect(table.getByText('2024BCSE042')).toBeVisible();

    await page.getByRole('button', { name: /Projects \(/ }).click();
    await expect(page.getByRole('heading', { name: 'Autonomous Rover Team (DeepTech-2026)' })).toBeVisible();
    await expect(page.getByText('LEADER').first()).toBeVisible();
  });
});

test.describe('Responsive behaviour', () => {
  const MOBILE = { width: 390, height: 844 };

  /** Page must never scroll sideways. */
  const expectNoOverflow = async (page: import('@playwright/test').Page, where: string) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow on ${where}`).toBeLessThanOrEqual(1);
  };

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
  });

  test('login screen fits a phone viewport', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expectNoOverflow(page, 'login');
  });

  test('sidebar collapses behind a drawer and navigation still works', async ({ page }) => {
    await login(page, 'admin');

    // The drawer must be closed (and the desktop rail hidden) at this width.
    const drawer = page.getByTestId('mobile-nav');
    await expect(drawer).toHaveCount(0);
    await expectNoOverflow(page, 'dashboard');

    for (const label of ['Inventory', 'Request Queue', 'Kits & Bundles', 'Lab Layout', 'Audit Ledger', 'Users & Projects']) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(drawer).toBeVisible();
      // Only the drawer copy is visible at this width; the desktop rail exists
      // in the DOM but is hidden, so filter to the visible link.
      await drawer.getByRole('link', { name: new RegExp(`^${label}\\b`) }).first().click();
      // Selecting a destination closes the drawer.
      await expect(drawer).toHaveCount(0);
      await expectNoOverflow(page, label);
    }
  });

  test('wide tables scroll inside their container, not the page', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByTestId('mobile-nav').getByRole('link', { name: /^Inventory\b/ }).click();

    await expect(page.getByRole('heading', { name: 'Lab Inventory' })).toBeVisible();
    await expectNoOverflow(page, 'inventory grid');

    await page.getByTitle('Table view').click();
    await expect(page.getByRole('table').first()).toBeVisible();
    // The table is wider than the screen but contained by overflow-x-auto.
    const tableOverflowsViewport = await page.evaluate(
      () => (document.querySelector('table')?.scrollWidth ?? 0) > window.innerWidth,
    );
    expect(tableOverflowsViewport).toBe(true);
    await expectNoOverflow(page, 'inventory table');
  });

  test('student navigation also fits and collapses', async ({ page }) => {
    await login(page, 'student');
    await expect(page.getByTestId('mobile-nav')).toHaveCount(0);
    await expectNoOverflow(page, 'student dashboard');

    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByTestId('mobile-nav').getByRole('link', { name: /^My Requests\b/ }).click();
    await expect(page.getByRole('heading', { name: 'My Requests' })).toBeVisible();
    await expectNoOverflow(page, 'my requests');
  });
});
