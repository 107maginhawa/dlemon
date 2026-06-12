/**
 * E2E: Prescription list + dispense/cancel lifecycle (WF-016, FIX-006 / Batch C)
 *
 * Proves the previously-orphaned prescription list + lifecycle surface
 * (listPrescriptions / updatePrescription) is reachable from the real product
 * UI: open the Rx sheet → Prescriptions tab → a pending prescription shows a
 * Dispense affordance → dispensing flips it to "dispensed" and the action drops
 * (FSM pending → dispensed is terminal).
 *
 * A pending prescription is seeded via the API first, then every assertion is
 * driven through the rendered UI (no page.evaluate(fetch) for the behaviour
 * under test).
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

async function setupWithPendingRx(page: Page) {
  // Owner (dentist_owner) so the Dispense/Cancel affordances are permitted (canManage).
  const { branchId, memberId } = await signUpOnboardAndUnlock(page, {
    tier: 'solo',
    label: 'RxLifecycle',
  });

  const patientId = await page.evaluate(
    async (args) => {
      const res = await fetch(`${args.api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: 'Rx Patient',
          dateOfBirth: '1988-03-03',
          gender: 'male',
          branchId: args.branchId,
          consentGiven: true,
        }),
      });
      if (!res.ok) throw new Error(`Patient creation failed: ${res.status}`);
      return (await res.json()).id as string;
    },
    { api: API, branchId },
  );

  const visitId = await page.evaluate(
    async (args) => {
      const createRes = await fetch(`${args.api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: args.patientId,
          branchId: args.branchId,
          dentistMemberId: args.memberId,
        }),
      });
      if (!createRes.ok) throw new Error(`Visit creation failed: ${createRes.status}`);
      const visit = await createRes.json();
      const patchRes = await fetch(`${args.api}/dental/visits/${visit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'active' }),
      });
      if (!patchRes.ok) throw new Error(`Visit activation failed: ${patchRes.status}`);
      return visit.id as string;
    },
    { api: API, patientId, branchId, memberId },
  );

  // Seed a PENDING prescription — the only revocable/dispensable state.
  const prescriptionId = await page.evaluate(
    async (args) => {
      const res = await fetch(`${args.api}/dental/visits/${args.visitId}/prescriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId: args.visitId,
          patientId: args.patientId,
          prescriberMemberId: args.memberId,
          drugName: 'Amoxicillin',
          dosage: '500mg',
          frequency: 'TID',
        }),
      });
      if (!res.ok) throw new Error(`Prescription seed failed: ${res.status}`);
      return (await res.json()).id as string;
    },
    { api: API, visitId, patientId, memberId },
  );

  return { patientId, visitId, prescriptionId };
}

test.describe('Prescription lifecycle (WF-016, FIX-006)', () => {
  test('pending Rx is dispensable from the Prescriptions tab and flips to dispensed', async ({
    page,
  }) => {
    const { patientId, prescriptionId } = await setupWithPendingRx(page);
    await spaNavigate(page, `/${patientId}`);

    // Open the Rx sheet from the workspace top bar.
    const rxBtn = page.getByRole('button', { name: 'Write prescription' });
    await rxBtn.waitFor({ state: 'visible', timeout: 8000 });
    await rxBtn.click();

    const sheet = page.getByTestId('rx-sheet');
    await sheet.waitFor({ state: 'visible', timeout: 8000 });

    // Switch to the Prescriptions (list) tab — the surface the dead orphan ops now power.
    await sheet.getByRole('tab', { name: /prescriptions/i }).click();

    // The seeded prescription renders as pending with a Dispense affordance.
    const status = page.getByTestId(`rx-status-${prescriptionId}`);
    await expect(status).toHaveText(/pending/i, { timeout: 8000 });
    const dispenseBtn = page.getByRole('button', { name: /mark amoxicillin dispensed/i });
    await expect(dispenseBtn).toBeVisible();

    // Dispense through the UI → status flips to dispensed and the action drops (terminal).
    await dispenseBtn.click();
    await expect(status).toHaveText(/dispensed/i, { timeout: 8000 });
    await expect(page.getByRole('button', { name: /mark amoxicillin dispensed/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /cancel amoxicillin prescription/i })).toHaveCount(0);
  });
});
