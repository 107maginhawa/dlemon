/**
 * E2E: Walk-In Appointment — Journey J4
 *
 * Flow: sign up + onboard org -> create patient -> create walk-in appointment ->
 *       verify walkIn=true in response
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect } from '@playwright/test';
import { setupDentalOrg, createDentalPatient, API } from './fixtures';

test.describe('Walk-In Appointment', () => {
  test('walk-in appointment has walkIn flag', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, { displayName: 'Walk-In Patient', branchId });

    const startAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const endAt = new Date(new Date(startAt).getTime() + 30 * 60 * 1000).toISOString();

    // Create walk-in appointment (current contract)
    const apptRes = await page.evaluate(async ({ api, patientId, providerId, branchId, startAt, endAt }) => {
      const res = await fetch(`${api}/dental/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId,
          providerId,
          branchId,
          startAt,
          endAt,
          visitType: 'emergency',
          walkIn: true,
          notes: 'Walk-In Consultation',
        }),
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, patientId, providerId: memberId, branchId, startAt, endAt });

    expect(apptRes.status).toBe(201);
    expect(apptRes.body.walkIn).toBe(true);
    expect(apptRes.body.patientId).toBe(patientId);
    expect(apptRes.body.visitType).toBe('emergency');

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
