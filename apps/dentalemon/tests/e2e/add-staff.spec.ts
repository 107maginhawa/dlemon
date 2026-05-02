/**
 * E2E: Staff Management (FR6.x)
 *
 * Business Rules:
 * - FR6.1: Create staff member with name, role, 6-digit PIN
 * - FR6.5: Staff list shows name, role badge, status, actions
 * - FR8.13: Only Dentist-Owner can access staff module
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function signUpAndSetupPractice(page: Page): Promise<{ orgId: string; branchId: string }> {
  const suffix = Date.now();
  const email = `staff-e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Staff Owner ${suffix}`);
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
  const res = await signupResponse;
  if (res && res.status() >= 400) {
    const body = await res.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up POST returned ${res.status()}: ${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

  // Create person profile to bypass onboarding redirect
  await page.evaluate(async (api) => {
    await fetch(`${api}/persons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ firstName: 'Staff', lastName: 'Owner' }),
    });
  }, API);

  // Seed org + branch
  const orgRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/organizations/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Staff Test Clinic', tier: 'clinic', countryCode: 'PH' }),
    });
    return res.json();
  }, API);
  const orgId = orgRes.id;

  const branchRes = await page.evaluate(async ({ api, orgId }: { api: string; orgId: string }) => {
    const res = await fetch(`${api}/dental/organizations/${orgId}/branches/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Main Branch', timezone: 'Asia/Manila' }),
    });
    return res.json();
  }, { api: API, orgId });
  const branchId = branchRes.id;

  await page.evaluate(({ orgId, branchId }: { orgId: string; branchId: string }) => {
    localStorage.setItem('currentOrgId', orgId);
    localStorage.setItem('currentBranchId', branchId);
    // Simulate dentist_owner logged in via PIN (FR8.13 access)
    localStorage.setItem('currentMemberRole', 'dentist_owner');
  }, { orgId, branchId });

  return { orgId, branchId };
}

test.describe('Staff Management', () => {
  test('FR6.5: staff page loads and shows staff list header', async ({ page }) => {
    await signUpAndSetupPractice(page);
    await page.goto(`${APP}/staff`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Staff Members' })).toBeVisible();
    await expect(page.getByRole('button', { name: /add staff/i })).toBeVisible();
  });

  test('FR6.1: "+ Add Staff" button opens creation modal', async ({ page }) => {
    await signUpAndSetupPractice(page);
    await page.goto(`${APP}/staff`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add staff/i }).click();
    await expect(page.getByTestId('staff-create-modal')).toBeVisible();

    // Should have required fields: name, role, PIN
    await expect(page.getByLabel(/display name/i)).toBeVisible();
    await expect(page.getByLabel(/pin.*6 digits/i)).toBeVisible();
  });

  test('FR6.1: form validates 6-digit PIN requirement', async ({ page }) => {
    await signUpAndSetupPractice(page);
    await page.goto(`${APP}/staff`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add staff/i }).click();
    await page.getByLabel(/display name/i).fill('Test Staff');
    await page.getByLabel(/pin.*6 digits/i).fill('123'); // Too short

    await page.getByRole('button', { name: /create staff member/i }).click();

    await expect(page.getByText(/pin must be exactly 6 digits/i)).toBeVisible();
  });

  test('FR6.1: creating a staff member adds to the list', async ({ page }) => {
    const { orgId, branchId } = await signUpAndSetupPractice(page);
    await page.goto(`${APP}/staff`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add staff/i }).click();
    await page.getByLabel(/display name/i).fill('Nurse Maria');

    // Select role: Staff - Full Operations
    await page.getByText('Staff - Full Operations').click();

    await page.getByLabel(/pin.*6 digits/i).fill('111111');
    await page.getByLabel(/confirm pin/i).fill('111111');

    const createResponse = page.waitForResponse(
      (resp: any) => resp.url().includes('/members') && resp.request().method() === 'POST',
      { timeout: 10000 },
    ).catch(() => null);

    await page.getByRole('button', { name: /create staff member/i }).click();
    await createResponse;

    // Staff member should appear in list
    await page.waitForTimeout(500); // allow list refresh
    await expect(page.getByText('Nurse Maria')).toBeVisible({ timeout: 5000 });
  });

  test('FR8.13: non-owner role sees access denied on staff page', async ({ page }) => {
    await signUpAndSetupPractice(page);

    // Override role to staff_full (not owner)
    await page.evaluate(() => {
      localStorage.setItem('currentMemberRole', 'staff_full');
    });

    await page.goto(`${APP}/staff`);
    await page.waitForLoadState('networkidle');

    // Should show access denied, not the staff list
    await expect(page.getByTestId('staff-access-denied')).toBeVisible();
    await expect(page.getByText(/access denied/i)).toBeVisible();
  });
});
