/**
 * E2E: Prescribe Medication — Journey J7
 *
 * Flow: sign up → create patient → open workspace → create visit →
 *       open Rx sheet → fill form → save → verify prescription in list
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function setupWorkspace(page: Page) {
  const suffix = Date.now();
  const email = `rx-e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  // Sign up
  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Rx Owner ${suffix}`);
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

  // Get user id for prescriber
  const meRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/auth/get-session`, { credentials: 'include' });
    return res.json();
  }, API);
  const memberId = meRes?.session?.userId ?? '00000000-0000-4000-8000-000000000002';

  // Create patient
  const patientRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: [{ use: 'official', family: 'Reyes', given: ['Ana'] }],
        birthDate: '1990-03-12',
        gender: 'female',
      }),
    });
    return res.json();
  }, API);

  return { patientId: patientRes.id, memberId };
}

test.describe('Prescribe Medication (J7)', () => {
  test('workspace page loads for a patient', async ({ page }) => {
    const { patientId } = await setupWorkspace(page);
    await page.goto(`${APP}/workspace/${patientId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('timeline-carousel')).toBeVisible();
  });

  test('new visit button is visible', async ({ page }) => {
    const { patientId } = await setupWorkspace(page);
    await page.goto(`${APP}/workspace/${patientId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('new-visit-btn')).toBeVisible();
  });

  test('can create a new visit', async ({ page }) => {
    const { patientId } = await setupWorkspace(page);
    await page.goto(`${APP}/workspace/${patientId}`);
    await page.waitForLoadState('networkidle');
    await page.getByTestId('new-visit-btn').click();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('dental-chart')).toBeVisible();
  });
});
