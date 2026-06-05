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
import { API, setupDentalOrg, createDentalPatient } from './fixtures';

async function setup(page: Page) {
  // Provision a real org + branch + owner member (org creation is admin-only —
  // self-service goes through /dental/onboarding), then seed a patient in the
  // branch. Returns branchId/memberId so the appointment can reference real ids.
  const { branchId, memberId } = await setupDentalOrg(page);
  const patientId = await createDentalPatient(page, {
    displayName: 'Maria Santos',
    branchId,
    dateOfBirth: '1985-03-15',
    gender: 'female',
  });
  return { patientId, branchId, memberId };
}

async function createAppointment(page: Page, opts: { patientId: string; branchId: string; memberId: string }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const scheduledAt = tomorrow.toISOString();

  const apptRes = await page.evaluate(async ({ api, opts, scheduledAt }) => {
    const res = await fetch(`${api}/dental/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        patientId: opts.patientId,
        branchId: opts.branchId,
        providerId: opts.memberId,
        startAt: scheduledAt,
        endAt: new Date(new Date(scheduledAt).getTime() + 30 * 60000).toISOString(),
        visitType: 'checkup',
        notes: 'Initial Check-up',
      }),
    });
    return { status: res.status, body: await res.json() };
  }, { api: API, opts, scheduledAt });

  return apptRes;
}

test.describe('Patient Check-In', () => {
  test('check-in creates a draft dental visit', async ({ page }) => {
    const { patientId, branchId, memberId } = await setup(page);

    // Create appointment
    const apptRes = await createAppointment(page, { patientId, branchId, memberId });
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
