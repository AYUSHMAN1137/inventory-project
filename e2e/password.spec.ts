import { expect, test, type Page } from '@playwright/test';
import { resetDatabase } from './reset-db';
import { goTo, login, logout, overlay } from './helpers';

// Each spec file starts from a known database state.
test.beforeAll(() => resetDatabase());

const tempPassword = 'TempPass123!';
const newPassword = 'RotatedPass456!';
const wrongPassword = 'WrongPass789!';

/** A unique College ID per test so tests never share state. */
function freshId(prefix: string) {
  return `${prefix}${Date.now().toString().slice(-7)}`;
}

/**
 * Provisions an account through the real admin UI and returns to a signed-out
 * state. The temporary password therefore only ever exists in this file.
 */
async function provisionAccount(page: Page, collegeId: string, name: string) {
  await login(page, 'admin');
  await goTo(page, 'Users & Projects');

  await page.getByRole('button', { name: 'Provision account' }).click();
  const panel = overlay(page);
  await panel.getByLabel('College ID').fill(collegeId);
  await panel.getByLabel('Full name').fill(name);
  await panel.getByLabel('Temporary password (min 10 characters)').fill(tempPassword);
  await panel.getByRole('button', { name: 'Create account' }).click();
  await expect(panel).toHaveCount(0);

  await logout(page);
}

/** Signs in through the real form. */
async function signIn(page: Page, collegeId: string, password: string) {
  await page.goto('/');
  await page.getByLabel('College ID').fill(collegeId);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** The three fields of the forced-change screen, addressed exactly. */
function changeFields(page: Page) {
  return {
    current: page.getByLabel('Temporary password', { exact: true }),
    next: page.getByLabel('New password', { exact: true }),
    confirm: page.getByLabel('Confirm new password', { exact: true }),
    submit: page.getByRole('button', { name: 'Update password' }),
  };
}

test.describe('Forced password change', () => {
  test('a provisioned account cannot use the app until the password is changed', async ({ page }) => {
    const collegeId = freshId('E2EGATE');
    await provisionAccount(page, collegeId, 'E2E Provisioned Account');

    // Signing in with the temporary password lands on the forced-change screen,
    // and no application chrome is reachable.
    await signIn(page, collegeId, tempPassword);
    await expect(page.getByRole('heading', { name: /new password/i })).toBeVisible();
    await expect(page.getByText('Password change required')).toBeVisible();
    await expect(page.getByText(collegeId)).toBeVisible();
    await expect(page.locator('aside')).toHaveCount(0);

    // The server blocks writes while the flag is set — the UI is not the only gate.
    const blocked = await page.evaluate(async () => {
      const res = await fetch('/api/v1/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `blocked-${Date.now()}` }),
      });
      return res.status;
    });
    expect(blocked).toBe(403);
  });

  test('the password can be changed, and the old one stops working', async ({ page }) => {
    const collegeId = freshId('E2EROT');
    await provisionAccount(page, collegeId, 'E2E Rotation Account');
    await signIn(page, collegeId, tempPassword);

    const f = changeFields(page);

    // A weak password cannot even be submitted — the policy is enforced in the form.
    await f.current.fill(tempPassword);
    await f.next.fill('short');
    await f.confirm.fill('short');
    await expect(f.submit).toBeDisabled();

    // A strong password with the wrong *current* password is refused server-side
    // and the account stays locked on the forced-change screen.
    await f.current.fill(wrongPassword);
    await f.next.fill(newPassword);
    await f.confirm.fill(newPassword);
    await f.submit.click();
    await expect(page.getByRole('alert')).toContainText(/temporary password|incorrect/i);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0);

    // Mismatched confirmation is refused before any request is sent.
    await f.current.fill(tempPassword);
    await f.next.fill(newPassword);
    await f.confirm.fill(`${newPassword}x`);
    await f.submit.click();
    await expect(page.getByRole('alert')).toContainText(/do not match/i);

    // The correct current password releases the account into the app.
    await f.confirm.fill(newPassword);
    await f.submit.click();
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
    await expect(page.getByText(collegeId)).toBeVisible();

    // The temporary password no longer authenticates.
    await logout(page);
    await signIn(page, collegeId, tempPassword);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/invalid credentials/i);

    // The rotated password does, and the account is not challenged again.
    await signIn(page, collegeId, newPassword);
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  });

  test('changing the password revokes every other session', async ({ browser }) => {
    const collegeId = freshId('E2EREV');
    const page = await browser.newPage();
    await provisionAccount(page, collegeId, 'E2E Revocation Account');
    await page.close();

    // Two independent browser contexts = two independent sessions.
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await signIn(pageA, collegeId, tempPassword);
    await signIn(pageB, collegeId, tempPassword);
    await expect(pageA.getByRole('heading', { name: /new password/i })).toBeVisible();
    await expect(pageB.getByRole('heading', { name: /new password/i })).toBeVisible();

    // A rotates the password.
    const fa = changeFields(pageA);
    await fa.current.fill(tempPassword);
    await fa.next.fill(newPassword);
    await fa.confirm.fill(newPassword);
    await fa.submit.click();
    await expect(pageA.getByRole('heading', { name: /Welcome back/ })).toBeVisible();

    // B's session is gone — a reload drops it back to the login screen.
    await pageB.reload();
    await expect(pageB.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await contextA.close();
    await contextB.close();
  });
});

test.describe('Demo shortcuts are gone', () => {
  test('the login screen has no one-click entry or bundled password', async ({ page }) => {
    await page.goto('/');

    // No button signs in without credentials being typed.
    const buttons = await page.getByRole('button').all();
    for (const button of buttons) {
      const text = ((await button.textContent()) ?? '').toLowerCase();
      expect(text).not.toMatch(/admin view|student view|demo|one click|quick enter/);
    }

    // The known seed password is not shipped in the client bundle.
    const sources = await page.evaluate(async () => {
      const scripts = [...document.querySelectorAll('script[src]')].map((s) => (s as HTMLScriptElement).src);
      const bodies = await Promise.all(
        scripts.map(async (src) => {
          try {
            return await (await fetch(src)).text();
          } catch {
            return '';
          }
        }),
      );
      return bodies.join('\n');
    });
    expect(sources).not.toContain('Password@123');
  });

  test('there is no role switcher in the shell', async ({ page }) => {
    await login(page, 'admin');
    const topbar = page.locator('header');
    await expect(topbar.getByRole('button', { name: /admin view|student view|switch role/i })).toHaveCount(0);
    // Signing out is still the only way to change identity.
    await expect(topbar.getByTitle('Sign out')).toBeVisible();
  });
});
