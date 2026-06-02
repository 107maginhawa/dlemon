/**
 * E2E: Insurance / Revenue-Cycle (P1-26)
 *
 * Front-desk HMO flow at the UI level:
 *  - Billing → Insurance tab surfaces the claims worklist.
 *  - The worklist shows its empty state for a fresh branch (no claims yet).
 *  - The cash-patient Invoices tab is untouched (plan R3 — insurance is opt-in).
 *
 * Verifies UI-level behavior against the live API.
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function signUpAndSeed(page: Page) {
  const suffix = Date.now();
  const email = `insurance-e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Insurance Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially(password, { delay: 10 });
  await expect(pwInput).not.toHaveValue('');

  const signupResponse = page
    .waitForResponse(
      (resp: any) => /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
      { timeout: 10000 },
    )
    .catch(() => null);
  await page.getByRole('button', { name: /create an account/i }).click();
  const response = await signupResponse;
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up POST returned ${response.status()}: ${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

  await page.evaluate(async (api) => {
    await fetch(`${api}/persons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ firstName: 'Insurance', lastName: 'Owner' }),
    });
  }, API);

  const orgRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Insurance Test Clinic', tier: 'clinic', countryCode: 'PH' }),
    });
    return res.json();
  }, API);

  const branchRes = await page.evaluate(
    async ({ api, orgId }: { api: string; orgId: string }) => {
      const res = await fetch(`${api}/dental/organizations/${orgId}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: 'Main Branch', timezone: 'Asia/Manila' }),
      });
      return res.json();
    },
    { api: API, orgId: orgRes.id },
  );

  await page.evaluate(
    ({ orgId, branchId }: { orgId: string; branchId: string }) => {
      localStorage.setItem('currentOrgId', orgId);
      localStorage.setItem('currentBranchId', branchId);
      localStorage.setItem('currentMemberRole', 'dentist_owner');
    },
    { orgId: orgRes.id, branchId: branchRes.id },
  );

  await page.evaluate(
    async ({ api, orgId, branchId }: { api: string; orgId: string; branchId: string }) => {
      const sessionRes = await fetch(`${api}/auth/get-session`, { credentials: 'include' });
      const session = (await sessionRes.json()) as any;
      const personId = session?.user?.id;
      if (personId) {
        await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ displayName: 'Insurance Owner', role: 'dentist_owner', personId }),
        });
      }
    },
    { api: API, orgId: orgRes.id, branchId: branchRes.id },
  );

  return { orgId: orgRes.id, branchId: branchRes.id };
}

test.describe('Insurance / Revenue-Cycle (P1-26)', () => {
  test('Insurance tab surfaces the claims worklist (empty state for a fresh branch)', async ({ page }) => {
    await signUpAndSeed(page);
    await page.goto(`${APP}/billing`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: /insurance/i }).click();

    await expect(page.getByTestId('claims-worklist')).toBeVisible();
    await expect(page.getByTestId('claims-empty')).toBeVisible();
  });

  test('cash path untouched: Invoices tab still renders the invoice list', async ({ page }) => {
    await signUpAndSeed(page);
    await page.goto(`${APP}/billing`);
    await page.waitForLoadState('networkidle');

    // Default tab is Invoices — the cash-patient majority sees no insurance friction.
    await expect(page.getByTestId('billing-list')).toBeVisible();

    // Switching to Insurance then back keeps the invoice list intact.
    await page.getByRole('tab', { name: /insurance/i }).click();
    await expect(page.getByTestId('claims-worklist')).toBeVisible();
    await page.getByRole('tab', { name: /invoices/i }).click();
    await expect(page.getByTestId('billing-list')).toBeVisible();
  });
});
