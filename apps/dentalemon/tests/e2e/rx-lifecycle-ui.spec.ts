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

/**
 * E2E: GAP-5 (FR1.12/FR2.15) — allergy blocking-with-override.
 *
 * A patient has a recorded active allergy. Prescribing a conflicting drug must be
 * gated by an explicit confirm dialog BEFORE the prescription is created; only the
 * override creates it. Proves the client-side safety-floor source (the same
 * allergies the top bar shows) drives a true pre-submit block, not a post-save
 * advisory. The backend is unchanged.
 */
test.describe('Rx allergy blocking-with-override (GAP-5)', () => {
  test('a drug that conflicts with a recorded allergy is gated by a confirm dialog and created only on override', async ({
    page,
  }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'solo', label: 'RxAllergy' });

    const patientId = await page.evaluate(
      async (args) => {
        const res = await fetch(`${args.api}/dental/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            displayName: 'Allergy Patient',
            dateOfBirth: '1980-06-06',
            gender: 'female',
            branchId: args.branchId,
            consentGiven: true,
          }),
        });
        if (!res.ok) throw new Error(`Patient creation failed: ${res.status}`);
        return (await res.json()).id as string;
      },
      { api: API, branchId },
    );

    // Seed an ACTIVE allergy to Penicillin (no resolvedDate → active).
    await page.evaluate(
      async (args) => {
        const res = await fetch(`${args.api}/dental/clinical/medical-history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ patientId: args.patientId, entryType: 'allergy', displayName: 'Penicillin' }),
        });
        if (!res.ok) throw new Error(`Allergy seed failed: ${res.status}`);
      },
      { api: API, patientId },
    );

    // An active visit so the Rx sheet mounts and accepts a new prescription.
    await page.evaluate(
      async (args) => {
        const createRes = await fetch(`${args.api}/dental/visits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ patientId: args.patientId, branchId: args.branchId, dentistMemberId: args.memberId }),
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
      },
      { api: API, patientId, branchId, memberId },
    );

    await spaNavigate(page, `/${patientId}`);

    // The client holds the allergy (safety floor renders it) — the pre-submit source.
    await expect(page.getByText('Penicillin').first()).toBeVisible({ timeout: 8000 });

    // Open the Rx sheet and fill in a conflicting drug.
    const rxBtn = page.getByRole('button', { name: 'Write prescription' });
    await rxBtn.waitFor({ state: 'visible', timeout: 8000 });
    await rxBtn.click();
    const sheet = page.getByTestId('rx-sheet');
    await sheet.waitFor({ state: 'visible', timeout: 8000 });

    await sheet.getByLabel('Drug name').fill('Penicillin');
    await sheet.getByLabel('Dosage').fill('500mg');
    await sheet.getByLabel('Frequency selection').selectOption('TID (three times daily)');
    await sheet.getByRole('button', { name: /save prescription/i }).click();

    // BLOCK: the confirm dialog must appear and nothing is created yet.
    const dialog = page.getByTestId('allergy-confirm-dialog');
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await expect(dialog).toContainText('Penicillin');

    // OVERRIDE: explicit confirmation creates the prescription.
    await dialog.getByRole('button', { name: /prescribe anyway/i }).click();
    await expect(dialog).toBeHidden({ timeout: 8000 });

    // Verify it was actually created: reopen → Prescriptions tab → pending Penicillin row.
    await rxBtn.click();
    await sheet.waitFor({ state: 'visible', timeout: 8000 });
    await sheet.getByRole('tab', { name: /prescriptions/i }).click();
    await expect(sheet.getByText('Penicillin')).toBeVisible({ timeout: 8000 });
  });
});
