/**
 * E2E: First Launch — Onboarding Journey (J1)
 *
 * Flow: sign up → create org → create branch → create member → create patient
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';

test.describe('First Launch Onboarding', () => {
  test('can set up clinic, dentist, and first patient', async ({ page }) => {
    const suffix = Date.now();

    // Sign up
    await page.goto('http://localhost:3003/auth/sign-up');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Name', { exact: true }).fill(`Onboard Owner ${suffix}`);
    await page.getByLabel('Email', { exact: true }).fill(`onboard-${suffix}@example.org`);
    const pwInput = page.locator('input[type="password"]');
    await pwInput.click();
    await pwInput.pressSequentially('E2eTestPass123!', { delay: 10 });
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

    // Create org via API
    const orgRes = await page.evaluate(async (api) => {
      const res = await fetch(`${api}/dental/organizations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: `Test Clinic ${Date.now()}`, tier: 'solo', countryCode: 'PH' }),
      });
      return { status: res.status, body: await res.json() };
    }, API);

    expect(orgRes.status).toBe(201);
    expect(orgRes.body.id).toBeTruthy();
    const orgId = orgRes.body.id;

    // Create branch
    const branchRes = await page.evaluate(async ({ api, orgId }) => {
      const res = await fetch(`${api}/dental/organizations/${orgId}/branches/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ organizationId: orgId, name: 'Main Branch', timezone: 'Asia/Manila' }),
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, orgId });

    expect(branchRes.status).toBe(201);
    const branchId = branchRes.body.id;

    // Create dentist-owner membership
    const memberRes = await page.evaluate(async ({ api, branchId }) => {
      const res = await fetch(`${api}/dental/org/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ branchId, displayName: 'Dr. Test Owner', role: 'dentist_owner', pin: '123456' }),
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, branchId });

    expect(memberRes.status).toBe(201);

    // Create first patient
    const patientRes = await page.evaluate(async (api) => {
      const res = await fetch(`${api}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: [{ use: 'official', family: 'Reyes', given: ['Maria'] }],
          birthDate: '1985-03-15',
          gender: 'female',
        }),
      });
      return { status: res.status, body: await res.json() };
    }, API);

    expect(patientRes.status).toBe(201);
    expect(patientRes.body.id).toBeTruthy();
  });
});
