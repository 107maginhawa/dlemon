/**
 * E2E: Patient Registration flow
 *
 * Journey J12: Register new patient → view in list → open profile
 *
 * Preconditions:
 *  - Practice owner signed in (cloud account)
 *  - Dental org and branch exist (seeded via API)
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function signUpAndSeedOrg(page: Page) {
  const suffix = Date.now();
  const email = `patient-e2e-owner-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Patient Owner ${suffix}`);
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

  // Seed org
  const orgRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/organizations/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Patient Test Clinic', tier: 'solo', countryCode: 'PH' }),
    });
    return res.json();
  }, API);

  // Seed branch
  const branchRes = await page.evaluate(async ({ api, orgId }: { api: string; orgId: string }) => {
    const res = await fetch(`${api}/dental/organizations/${orgId}/branches/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Main Branch', timezone: 'Asia/Manila' }),
    });
    return res.json();
  }, { api: API, orgId: orgRes.id });

  // Set dental context in localStorage so the dashboard guard doesn't redirect to dental-onboarding
  await page.evaluate(({ orgId, branchId }: { orgId: string; branchId: string }) => {
    localStorage.setItem('currentOrgId', orgId);
    localStorage.setItem('currentBranchId', branchId);
  }, { orgId: orgRes.id, branchId: branchRes.id });

  return { email, password, orgId: orgRes.id, branchId: branchRes.id };
}

test.describe('Patient Registration flow', () => {
  test('navigates to patients page and shows empty state', async ({ page }) => {
    await signUpAndSeedOrg(page);
    await page.goto(`${APP}/patients`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('patient-list-empty')).toBeVisible();
  });

  test('register patient button opens registration modal', async ({ page }) => {
    await signUpAndSeedOrg(page);
    await page.goto(`${APP}/patients`);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('register-patient-btn').click();

    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel(/date of birth/i)).toBeVisible();
    await expect(page.getByTestId('consent-checkbox')).toBeVisible();
  });

  test('cancel button closes modal without registering', async ({ page }) => {
    await signUpAndSeedOrg(page);
    await page.goto(`${APP}/patients`);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('register-patient-btn').click();
    await expect(page.getByLabel(/full name/i)).toBeVisible();

    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByLabel(/full name/i)).not.toBeVisible();
  });

  test('form validation prevents submission with empty name', async ({ page }) => {
    await signUpAndSeedOrg(page);
    await page.goto(`${APP}/patients`);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('register-patient-btn').click();
    await page.getByTestId('consent-checkbox').check();
    await page.getByRole('button', { name: /register/i }).click();

    // Form should not submit — modal stays open
    await expect(page.getByLabel(/full name/i)).toBeVisible();
  });
});
