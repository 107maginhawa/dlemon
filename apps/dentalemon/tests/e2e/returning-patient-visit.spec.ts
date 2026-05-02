/**
 * E2E: Returning Patient Visit flow
 *
 * Journey J3: open patient → enter workspace → select tooth → record condition
 * → add treatment → view breakdown → complete visit
 *
 * Preconditions:
 *  - Practice owner signed in (cloud account)
 *  - Patient exists (seeded via API or created in test)
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function signUpAndGetPatient(page: Page) {
  const suffix = Date.now();
  const email = `visit-e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  // Sign up
  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Visit Owner ${suffix}`);
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

  // Create a test patient via API
  const patientRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: [{ use: 'official', family: 'Santos', given: ['Maria'] }],
        birthDate: '1985-06-15',
        gender: 'female',
      }),
    });
    return res.json();
  }, API);

  return { email, password, patientId: patientRes.id };
}

test.describe('Returning Patient Visit', () => {
  test('navigates to workspace from patient list', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await page.goto(`${APP}/workspace/${patientId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('timeline-carousel')).toBeVisible();
  });

  test('workspace shows new visit button', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await page.goto(`${APP}/workspace/${patientId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('new-visit-btn')).toBeVisible();
  });

  test('dental chart renders 32 teeth', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await page.goto(`${APP}/workspace/${patientId}`);
    await page.waitForLoadState('networkidle');

    // Create a visit first
    await page.getByTestId('new-visit-btn').click();
    await page.waitForTimeout(500); // allow API call

    await expect(page.getByTestId('dental-chart')).toBeVisible();

    // Count tooth buttons
    const toothButtons = page.getByTestId(/^tooth-\d+$/);
    await expect(toothButtons).toHaveCount(32);
  });

  test('clicking a tooth opens slideout', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await page.goto(`${APP}/workspace/${patientId}`);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('new-visit-btn').click();
    await page.waitForTimeout(500);

    await page.getByTestId('tooth-21').click();
    await expect(page.getByTestId('tooth-slideout')).toBeVisible();
  });

  test('slideout can select condition and advance to surface step', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await page.goto(`${APP}/workspace/${patientId}`);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('new-visit-btn').click();
    await page.waitForTimeout(500);

    await page.getByTestId('tooth-21').click();
    await expect(page.getByTestId('tooth-slideout')).toBeVisible();

    // Select "caries" condition
    await page.getByRole('button', { name: 'Caries' }).first().click();

    // Click Next to advance to surface step
    await page.getByRole('button', { name: 'Next' }).click();

    // Should now show surface selector
    await expect(page.getByTestId('five-surface-selector')).toBeVisible();
  });
});
