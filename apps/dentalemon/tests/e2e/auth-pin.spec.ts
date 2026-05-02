/**
 * E2E: PIN authentication flow
 *
 * Journey J18: Staff selects profile → enters PIN → reaches dashboard
 * → inactivity lock → re-enters PIN → workspace restored
 *
 * Preconditions:
 *  - A practice owner has signed up (cloud account)
 *  - A dental org, branch, and staff member exist (seeded via API)
 *  - The staff member has a PIN set
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

/**
 * Sign up as practice owner and return session cookies
 */
async function signUpOwner(page: Page) {
  const suffix = Date.now();
  const email = `pin-e2e-owner-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`PIN Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially(password, { delay: 10 });
  await expect(pwInput).not.toHaveValue('');
  const signupResponse = page.waitForResponse(
    (resp: any) => /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
    { timeout: 10000 },
  ).catch(() => null);
  await page.getByRole('button', { name: /create an account/i }).click();
  const response = await signupResponse;
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up POST returned ${response.status()}: ${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

  return { email, password };
}

/**
 * Seed org, branch, and staff member via API (uses existing browser session)
 */
async function seedOrgAndStaff(page: Page): Promise<{ orgId: string; branchId: string; memberId: string }> {
  // Create org
  const orgRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/organizations/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'PIN Test Clinic', tier: 'solo', countryCode: 'PH' }),
    });
    return res.json();
  }, API);
  const orgId = orgRes.id;

  // Create branch
  const branchRes = await page.evaluate(async ({ api, orgId }: { api: string; orgId: string }) => {
    const res = await fetch(`${api}/dental/organizations/${orgId}/branches/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Main Clinic', timezone: 'Asia/Manila' }),
    });
    return res.json();
  }, { api: API, orgId });
  const branchId = branchRes.id;

  // Create staff member
  const memberRes = await page.evaluate(async ({ api, orgId, branchId }: { api: string; orgId: string; branchId: string }) => {
    const res = await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: 'Staff Ana Cruz', role: 'staff_full' }),
    });
    return res.json();
  }, { api: API, orgId, branchId });
  const memberId = memberRes.id;

  // Set PIN for staff member
  await page.evaluate(async ({ api, orgId, branchId, memberId }: { api: string; orgId: string; branchId: string; memberId: string }) => {
    await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members/${memberId}/set-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pin: '123456' }),
    });
  }, { api: API, orgId, branchId, memberId });

  return { orgId, branchId, memberId };
}

test.describe('PIN authentication flow', () => {
  test('owner can set up staff and staff can select profile', async ({ page }) => {
    await signUpOwner(page);
    const { memberId } = await seedOrgAndStaff(page);

    // Navigate to PIN select screen
    await page.goto(`${APP}/auth/pin-select`);
    await page.waitForLoadState('networkidle');

    // Should show the staff member card
    await expect(page.getByText('Staff Ana Cruz')).toBeVisible();
  });

  test('selecting a member card navigates to PIN entry', async ({ page }) => {
    await signUpOwner(page);
    await seedOrgAndStaff(page);

    await page.goto(`${APP}/auth/pin-select`);
    await page.waitForLoadState('networkidle');

    // Click the staff member card
    await page.getByRole('button', { name: /Sign in as Staff Ana Cruz/i }).click();

    // Should navigate to PIN entry screen
    await expect(page.getByText('Staff Ana Cruz')).toBeVisible();
    // PIN keypad should be visible
    await expect(page.getByLabel('1')).toBeVisible();
  });

  test('entering correct PIN reaches the dashboard', async ({ page }) => {
    await signUpOwner(page);
    await seedOrgAndStaff(page);

    await page.goto(`${APP}/auth/pin-select`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Sign in as Staff Ana Cruz/i }).click();

    // Enter PIN 1-2-3-4-5-6
    for (const digit of ['1', '2', '3', '4', '5', '6']) {
      await page.getByLabel(digit).click();
    }

    // Should redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('wrong PIN shows error message', async ({ page }) => {
    await signUpOwner(page);
    await seedOrgAndStaff(page);

    await page.goto(`${APP}/auth/pin-select`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Sign in as Staff Ana Cruz/i }).click();

    // Enter wrong PIN
    for (const digit of ['9', '9', '9', '9', '9', '9']) {
      await page.getByLabel(digit).click();
    }

    // Should show error
    await expect(page.getByText(/incorrect pin/i)).toBeVisible({ timeout: 3000 });
  });
});
