/**
 * E2E: Walk-In Appointment — Journey J4
 *
 * Flow: sign up -> create patient -> create walk-in appointment ->
 *       verify walkIn=true in response
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function setup(page: Page) {
  const suffix = Date.now();

  // Sign up
  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`WalkIn Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(`walkin-e2e-${suffix}@example.org`);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially('E2eTestPass123!', { delay: 10 });
  await expect(pwInput).not.toHaveValue('');
  const signupResponsePromise = page.waitForResponse(
    (resp: any) => /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
    { timeout: 10000 },
  );
  await page.getByRole('button', { name: /create an account/i }).click();
  const response = await signupResponsePromise;
  if (response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up POST returned ${response.status()}: ${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

  // Create patient
  const patientRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        displayName: 'Russel Herrera',
        dateOfBirth: '1990-07-20',
        gender: 'male',
      }),
    });
    return res.json();
  }, API);

  return { patientId: patientRes.id };
}

test.describe('Walk-In Appointment', () => {
  test('walk-in appointment has walkIn flag', async ({ page }) => {
    const { patientId } = await setup(page);

    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const todayISO = new Date().toISOString().split('T')[0];

    // Create walk-in appointment
    const apptRes = await page.evaluate(async ({ api, patientId, scheduledAt }) => {
      const res = await fetch(`${api}/dental/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId,
          branchId: '00000000-0000-4000-8000-000000000001',
          dentistMemberId: '00000000-0000-4000-8000-000000000002',
          scheduledAt,
          durationMinutes: 30,
          serviceType: 'Walk-In Consultation',
          walkIn: true,
        }),
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, patientId, scheduledAt });

    expect(apptRes.status).toBe(201);
    expect(apptRes.body.walkIn).toBe(true);
    expect(apptRes.body.patientId).toBe(patientId);
    expect(apptRes.body.serviceType).toBe('Walk-In Consultation');

    // Verify appointment can be retrieved directly
    const getRes = await page.evaluate(async ({ api, appointmentId }) => {
      const res = await fetch(`${api}/dental/appointments/${appointmentId}`, {
        credentials: 'include',
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, appointmentId: apptRes.body.id });

    expect(getRes.status).toBe(200);
    expect(getRes.body.walkIn).toBe(true);
  });
});
