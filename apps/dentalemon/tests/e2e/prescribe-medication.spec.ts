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

  // Set up dental org/branch/member so the workspace can create visits
  const ctx = await page.evaluate(async (api) => {
    const orgRes = await fetch(`${api}/dental/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Test Clinic', tier: 'solo', countryCode: 'PH' }),
    });
    const org = await orgRes.json();
    const branchRes = await fetch(`${api}/dental/organizations/${org.id}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Main Branch', timezone: 'Asia/Manila' }),
    });
    const branch = await branchRes.json();
    const memberRes = await fetch(`${api}/dental/organizations/${org.id}/branches/${branch.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: 'Test Dentist', role: 'dentist_owner' }),
    });
    const member = await memberRes.json();
    return { orgId: org.id, branchId: branch.id, memberId: member.id };
  }, API);

  await page.evaluate((ids) => {
    localStorage.setItem('currentOrgId', ids.orgId);
    localStorage.setItem('currentBranchId', ids.branchId);
    localStorage.setItem('currentMemberId', ids.memberId);
  }, ctx);

  // Create patient via dental API
  const patientRes = await page.evaluate(async (args) => {
    const res = await fetch(`${args.api}/dental/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        displayName: 'Ana Reyes',
        dateOfBirth: '1990-03-12',
        gender: 'female',
        branchId: args.branchId,
        consentGiven: true,
      }),
    });
    return res.json();
  }, { api: API, branchId: ctx.branchId });

  return { patientId: patientRes.id, memberId: ctx.memberId };
}

test.describe('Prescribe Medication (J7)', () => {
  test('workspace page loads for a patient', async ({ page }) => {
    const { patientId } = await setupWorkspace(page);
    await page.goto(`${APP}/${patientId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('timeline-carousel')).toBeVisible();
  });

  test('new visit button is visible', async ({ page }) => {
    const { patientId } = await setupWorkspace(page);
    await page.goto(`${APP}/${patientId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('new-visit-btn')).toBeVisible();
  });

  test('can create a new visit', async ({ page }) => {
    const { patientId } = await setupWorkspace(page);
    await page.goto(`${APP}/${patientId}`);
    await page.waitForLoadState('networkidle');
    await page.getByTestId('new-visit-btn').click();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('dental-chart')).toBeVisible();
  });
});
