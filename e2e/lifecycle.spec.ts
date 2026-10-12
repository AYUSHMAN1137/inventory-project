import { expect, test } from '@playwright/test';
import { resetDatabase } from './reset-db';
import type { Page } from '@playwright/test';
import { confirmOverlay, goTo, login, overlay } from './helpers';

// Each spec file starts from a known database state.
test.beforeAll(() => resetDatabase());

/**
 * Exercises the complete operational chain against the real backend:
 * student request → admin approval → physical issue → return with condition.
 * Stock numbers are asserted before and after each transition, because the
 * whole point of the system is that inventory only moves at handover.
 */

/** Reads the "available/total" stock pair for a named item from the catalogue. */
async function stockFor(page: Page, itemName: string) {
  await goTo(page, 'Inventory');
  await page.getByPlaceholder('Search by name, model or description…').fill(itemName);
  const card = page.locator('div.card', { hasText: itemName }).first();
  await expect(card).toBeVisible();
  const text = await card.locator('.mono').first().innerText();
  const [available, total] = text.split('/').map((n) => Number(n.trim()));
  return { available, total };
}

test.describe('Full lifecycle: request → approve → issue → return', () => {
  test('stock only moves at issue, and returns restore it', async ({ page }) => {
    const ITEM = 'Arduino Uno R3';

    // ---------------------------------------------------- baseline
    await login(page, 'admin');
    const start = await stockFor(page, ITEM);
    expect(start.total).toBe(6);

    // ------------------------------------------- student submits
    await goTo(page, 'Dashboard');
    await page.getByTitle('Sign out').click();
    await login(page, 'student');
    await goTo(page, 'Browse Inventory');
    await page.getByPlaceholder('Search by name, model or description…').fill(ITEM);
    const itemCard = page.locator('div.card', { hasText: ITEM }).first();
    await itemCard.getByRole('button', { name: 'Add', exact: true }).click();
    await goTo(page, 'Request Cart');

    const purpose = `Lifecycle E2E ${Date.now()}`;
    await page.locator('textarea').fill(purpose);
    await page.getByRole('button', { name: /Submit request/ }).click();
    await expect(page.getByRole('heading', { name: 'Request submitted' })).toBeVisible();
    await expect(page.getByText(purpose)).toBeVisible();

    // ------------------------------------------- admin approves
    await page.getByTitle('Sign out').click();
    await login(page, 'admin');

    // Approval alone must NOT change stock.
    const afterApprovalRequest = await stockFor(page, ITEM);
    expect(afterApprovalRequest.available).toBe(start.available);

    await goTo(page, 'Request Queue');
    const row = page.locator('tr', { hasText: purpose }).first();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Review' }).click();
    await confirmOverlay(page, 'Approve all');

    const afterApproval = await stockFor(page, ITEM);
    expect(afterApproval.available).toBe(start.available);

    // ----------------------------------------------- issue desk
    await goTo(page, 'Issue Desk');
    const issueCard = page.locator('div.card', { hasText: purpose }).first();
    await expect(issueCard).toBeVisible();
    await issueCard.getByRole('button', { name: 'Issue at counter' }).click();

    const issuePanel = overlay(page);
    await expect(issuePanel.getByText(/Stock is reduced only at this step/)).toBeVisible();
    await issuePanel.getByPlaceholder('2024BCSE042').fill('2024BCSE042');
    await issuePanel.getByRole('button', { name: /^ARD-00\d$/ }).first().click();
    await confirmOverlay(page, 'Confirm handover');

    // Stock decreased by exactly one.
    const afterIssue = await stockFor(page, ITEM);
    expect(afterIssue.available).toBe(start.available - 1);

    // ----------------------------------------------- returns desk
    await goTo(page, 'Returns Desk');
    const loanRow = page.locator('tr', { hasText: /Ayush Sharma|Lifecycle/ }).first();
    await expect(loanRow).toBeVisible();
    await loanRow.getByRole('button', { name: /Check in/ }).click();

    const returnPanel = overlay(page);
    await returnPanel.getByRole('button', { name: /Working — restock/ }).first().click();
    await confirmOverlay(page, 'Process return');

    // Working return restores availability.
    const afterReturn = await stockFor(page, ITEM);
    expect(afterReturn.available).toBe(start.available);
  });

});

test.describe('Ledger records the workflow', () => {
  test('audit ledger lists movements and exports CSV', async ({ page }) => {
    await login(page, 'admin');
    await goTo(page, 'Audit Ledger');

    await expect(page.getByRole('heading', { name: 'Audit Ledger' })).toBeVisible();
    // The lifecycle test above has produced ISSUE/RETURN rows in the table.
    const ledger = page.getByRole('table').first();
    await expect(ledger).toBeVisible();
    await expect(ledger.getByRole('cell', { name: /ISSUE|RETURN|RECEIPT/ }).first()).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/lab-audit-ledger-.*\.csv/);
  });
});
