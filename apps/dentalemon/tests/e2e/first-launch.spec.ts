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
    await page.waitForLoadState('networkidle');

    // Verify email so subsequent API calls succeed, and create the caller's
    // Person record (required before onboarding).
    await page.evaluate(async (api) => {
      await fetch(`${api}/dev/verify-email`, { method: 'POST', credentials: 'include' });
      const r = await fetch(`${api}/persons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ firstName: 'Onboard', lastName: 'Owner' }),
      });
      if (!r.ok && r.status !== 409) {
        throw new Error(`person create failed (${r.status}): ${await r.text().catch(() => '')}`);
      }
    }, API);

    // Provision clinic + default branch + dentist_owner membership in ONE
    // self-service call. Direct org creation (POST /dental/organizations) is now
    // admin-only (EM-ORG-002) and 403s for a normal owner — the self-service path
    // is POST /dental/onboarding (the caller becomes org owner + dentist_owner).
    const onbRes = await page.evaluate(async (api) => {
      const res = await fetch(`${api}/dental/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          organizationName: `Test Clinic ${Date.now()}`,
          tier: 'solo',
          countryCode: 'PH',
          branchName: 'Main Branch',
          timezone: 'Asia/Manila',
          ownerDisplayName: 'Dr. Test Owner',
        }),
      });
      return { status: res.status, body: await res.json() };
    }, API);

    // Onboarding returns 200/201 with organizationId/branchId/membershipId.
    expect([200, 201]).toContain(onbRes.status);
    expect(onbRes.body.organizationId).toBeTruthy();
    expect(onbRes.body.branchId).toBeTruthy();
    expect(onbRes.body.membershipId).toBeTruthy();
    const branchId = onbRes.body.branchId;

    // Create first patient (include branchId for association)
    const patientRes = await page.evaluate(async ({ api, branchId }) => {
      const res = await fetch(`${api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: 'Maria Reyes',
          dateOfBirth: '1985-03-15',
          gender: 'female',
          branchId,
          consentGiven: true,
        }),
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, branchId });

    expect(patientRes.status).toBe(201);
    expect(patientRes.body.id).toBeTruthy();
  });
});
