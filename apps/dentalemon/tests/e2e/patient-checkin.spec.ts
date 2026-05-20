/**
 * E2E: Patient Check-In — Journey J11
 *
 * Flow: sign up -> create patient -> create appointment -> check-in ->
 *       verify status=checkedIn + visit created
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
  await page.getByLabel('Name', { exact: true }).fill(`CheckIn Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(`checkin-e2e-${suffix}@example.org`);
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
    throw new Error(`Sign-up POST returned \${response.status()}: \${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

  // Create patient
  const patientRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        displayName: 'Maria Santos',
        dateOfBirth: '1985-03-15',
        gender: 'female',
      }),
    });
    return res.json();
  }, API);

  return { patientId: patientRes.id };
}

async function createAppointment(page: Page, patientId: string) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const scheduledAt = tomorrow.toISOString();

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
        serviceType: 'Initial Check-up',
      }),
    });
    return { status: res.status, body: await res.json() };
  }, { api: API, patientId, scheduledAt });

  return apptRes;
}

test.describe('Patient Check-In', () => {
  test('check-in creates a draft dental visit', async ({ page }) => {
    const { patientId } = await setup(page);

    // Create appointment
    const apptRes = await createAppointment(page, patientId);
    expect(apptRes.status).toBe(201);
    const appointmentId = apptRes.body.id;
    expect(apptRes.body.status).toBe('scheduled');

    // Verify check-in is allowed (status = scheduled)
    expect(apptRes.body.status).toBe('scheduled');

    // Check in
    const checkInRes = await page.evaluate(async ({ api, appointmentId }) => {
      const res = await fetch(`${api}/dental/appointments/${appointmentId}/check-in`, {
        method: 'POST',
        credentials: 'include',
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, appointmentId });

    expect(checkInRes.status).toBe(200);
    expect(checkInRes.body.appointment.status).toBe('checked_in');
    expect(checkInRes.body.visitId).toBeTruthy();

    // Verify appointment now has status checkedIn
    const getApptRes = await page.evaluate(async ({ api, appointmentId }) => {
      const res = await fetch(`${api}/dental/appointments/${appointmentId}`, {
        credentials: 'include',
      });
      return res.json();
    }, { api: API, appointmentId });

    expect(getApptRes.status).toBe('checked_in');

    // Verify dental visit exists and is draft
    const visitRes = await page.evaluate(async ({ api, visitId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}`, {
        credentials: 'include',
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, visitId: checkInRes.body.visitId });

    expect(visitRes.status).toBe(200);
    expect(visitRes.body.status).toBe('draft');
  });
});
