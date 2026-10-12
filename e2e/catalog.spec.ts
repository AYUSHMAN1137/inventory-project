import { expect, test } from '@playwright/test';
import { resetDatabase } from './reset-db';
import { confirmOverlay, goTo, login, overlay } from './helpers';

// Each spec file starts from a known database state.
test.beforeAll(() => resetDatabase());

test.describe('Inventory catalogue', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
    await goTo(page, 'Inventory');
    await expect(page.getByRole('heading', { name: 'Lab Inventory' })).toBeVisible();
  });

  test('loads the full seeded catalogue with counts', async ({ page }) => {
    // Don't hardcode the total: other specs may add catalogue items. Assert the
    // shape "N of N" and that known seeded items are present.
    await expect(page.getByText(/^\d+ of \d+ catalogue items/)).toBeVisible();
    await expect(page.getByText('Arduino Uno R3')).toBeVisible();
  });

  test('search narrows results and clearing restores them', async ({ page }) => {
    const search = page.getByPlaceholder('Search by name, model or description…');
    await search.fill('raspberry');
    await expect(page.getByText('Raspberry Pi 4 Model B (4GB)')).toBeVisible();
    await expect(page.getByText('Arduino Uno R3')).toHaveCount(0);

    await search.fill('');
    await expect(page.getByText('Arduino Uno R3')).toBeVisible();
  });

  test('category filter restricts results', async ({ page }) => {
    const optionLabel = await page
      .locator('select')
      .first()
      .locator('option', { hasText: 'Motors, Actuators & Drivers' })
      .first()
      .innerText();
    const expected = Number(/(\d+)/.exec(optionLabel)?.[1] ?? '0');
    await page.locator('select').first().selectOption({ label: optionLabel });

    // The header reads "<filtered> of <total> catalogue items".
    const header = page.getByText(/catalogue items/).first();
    await expect(header).toContainText(`${expected} of `);
    await expect(page.getByText('L298N Dual H-Bridge Motor Driver')).toBeVisible();
    await expect(page.getByText('Arduino Uno R3')).toHaveCount(0);
  });

  test('nature filter separates returnable from consumable', async ({ page }) => {
    await page.locator('select').nth(1).selectOption('CONSUMABLE');
    await expect(page.getByText('40-pin Male-to-Female Jumper Ribbon')).toBeVisible();
    await expect(page.getByText('Arduino Uno R3')).toHaveCount(0);

    await page.locator('select').nth(1).selectOption('RETURNABLE');
    await expect(page.getByText('Arduino Uno R3')).toBeVisible();
    await expect(page.getByText('40-pin Male-to-Female Jumper Ribbon')).toHaveCount(0);
  });

  test('switches between card and table views', async ({ page }) => {
    await page.getByTitle('Table view').click();
    await expect(page.getByRole('table').first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tracking' })).toBeVisible();

    await page.getByTitle('Card view').click();
    await expect(page.getByRole('columnheader', { name: 'Tracking' })).toHaveCount(0);
  });

  test('item detail drawer shows specs, storage and physical units', async ({ page }) => {
    // Target a known serialized item rather than relying on card order.
    await page.getByPlaceholder('Search by name, model or description…').fill('Arduino Uno');
    await page.getByRole('button', { name: 'Details' }).first().click();

    const panel = overlay(page);
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Physical units (6)')).toBeVisible();
    await expect(panel.getByText('ARD-001')).toBeVisible();
    await expect(panel.getByText('Storage location')).toBeVisible();
    await expect(panel.getByText(/Drawer 1/)).toBeVisible();
  });
});

test.describe('Student request workflow', () => {
  test('student adds items to the cart and submits a request', async ({ page }) => {
    await login(page, 'student');
    await goTo(page, 'Browse Inventory');

    // Add two distinct items from the catalogue.
    const addButtons = page.getByRole('button', { name: 'Add', exact: true });
    await addButtons.nth(0).click();
    await addButtons.nth(1).click();

    // The sidebar cart badge reflects both lines.
    await goTo(page, 'Request Cart');
    await expect(page.getByRole('heading', { name: 'Request Cart' })).toBeVisible();

    const purpose = `E2E automation check ${Date.now()}`;
    await page.locator('textarea').fill(purpose);
    await page.getByRole('button', { name: /Submit request/ }).click();

    // Success screen then redirect to My Requests.
    await expect(page.getByRole('heading', { name: 'Request submitted' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'My Requests' })).toBeVisible();
    await expect(page.getByText(purpose)).toBeVisible();
    await expect(page.getByText('Pending', { exact: false }).first()).toBeVisible();
  });

  test('cart quantity can be adjusted and a line removed', async ({ page }) => {
    await login(page, 'student');
    await goTo(page, 'Browse Inventory');
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await goTo(page, 'Request Cart');

    const qty = page.locator('input[type=number]').first();
    const before = Number(await qty.inputValue());
    await page.getByRole('button', { name: /^Increase quantity of/ }).first().click();
    await expect(qty).toHaveValue(String(before + 1));

    await page.getByRole('button', { name: /^Decrease quantity of/ }).first().click();
    await expect(qty).toHaveValue(String(before));

    await page.getByRole('button', { name: /^Remove .* from cart$/ }).first().click();
    await expect(page.getByText('Your request cart is empty')).toBeVisible();
  });

  test('submitting with no purpose is blocked with a validation message', async ({ page }) => {
    await login(page, 'student');
    await goTo(page, 'Browse Inventory');
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await goTo(page, 'Request Cart');

    await page.getByRole('button', { name: /Submit request/ }).click();
    await expect(page.getByText(/Please describe why you need these items/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Request Cart' })).toBeVisible();
  });
});

test.describe('Admin decision queue', () => {
  test('admin approves a pending request and it leaves the queue', async ({ page }) => {
    await login(page, 'admin');
    await goTo(page, 'Request Queue');

    const pendingText = page.getByText(/request[s]? awaiting your decision/);
    await expect(pendingText).toBeVisible();
    const before = Number((await pendingText.innerText()).match(/\d+/)?.[0] ?? '0');
    expect(before).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Review' }).first().click();
    const panel = overlay(page);
    await expect(panel.getByRole('heading', { name: 'Review Request' })).toBeVisible();
    await expect(panel.getByText(/Approving \d+ of \d+ units/)).toBeVisible();

    await confirmOverlay(page, 'Approve all');

    await expect(page.getByText(new RegExp(`${before - 1} request[s]? awaiting`))).toBeVisible();
  });

  test('admin can reject a request outright', async ({ page }) => {
    await login(page, 'admin');
    await goTo(page, 'Request Queue');
    await page.getByRole('button', { name: 'Review' }).first().click();

    const panel = overlay(page);
    await panel.getByRole('button', { name: 'Reject all' }).click();
    await expect(panel.getByText(/will reject the entire request/i)).toBeVisible();
    await confirmOverlay(page, 'Reject request');
  });
});
