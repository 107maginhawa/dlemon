/**
 * E2E: Safety Floor Medical Alerts — AC-MED-02
 *
 * Flow: sign up → create patient → add active allergy via API →
 *       open workspace → verify red allergy badge in the safety floor top bar
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

async function setupPatientWithAllergy(page: Page, allergyName: string) {
  // Provision org+branch+owner via /dental/onboarding (org creation is admin-only
  // — EM-ORG-002), set a PIN, and unlock the PIN-gated workspace.
  const { branchId } = await signUpOnboardAndUnlock(page, {
    tier: 'solo',
    label: 'Safety',
  });

  // Create patient
  const patientRes = await page.evaluate(
    async (args) => {
      const res = await fetch(`${args.api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: 'Safety Patient',
          dateOfBirth: '1988-11-05',
          gender: 'female',
          branchId: args.branchId,
          consentGiven: true,
        }),
      });
      if (!res.ok) throw new Error(`Patient create failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return res.json();
    },
    { api: API, branchId },
  );

  // Add active allergy entry via medical history API
  const allergyRes = await page.evaluate(
    async (args) => {
      const res = await fetch(`${args.api}/dental/clinical/medical-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: args.patientId,
          entryType: 'allergy',
          displayName: args.allergyName,
          active: true,
          notes: 'Severe reaction',
        }),
      });
      return res.json();
    },
    { api: API, patientId: patientRes.id, allergyName },
  );

  return {
    patientId: patientRes.id,
    allergyId: allergyRes.id,
    branchId,
  };
}

test.describe('Safety Floor Medical Alerts (AC-MED-02)', () => {
  test('active allergy shows red badge in workspace top bar', async ({ page }) => {
    // [AC-MED-02] active allergies must be surfaced prominently in the workspace safety floor
    const allergyName = 'Penicillin';
    const { patientId } = await setupPatientWithAllergy(page, allergyName);

    await spaNavigate(page, `/${patientId}`);

    // The safety floor container uses bg-red-50 class and appears when safetyItems.length > 0
    // It renders allergy badges inside: bg-red-100 text-red-700 border-red-200
    const safetyFloor = page.locator('.bg-red-50.border.border-red-200').first();
    await safetyFloor.waitFor({ state: 'visible', timeout: 8000 });

    // The specific allergy badge must be present
    await expect(safetyFloor).toContainText(allergyName);
  });

  test('patient without allergies shows no safety floor', async ({ page }) => {
    // [AC-MED-02] safety floor must not appear for clean patient (no false positives)
    const { branchId } = await signUpOnboardAndUnlock(page, {
      tier: 'solo',
      label: 'Clean',
    });

    const patientRes = await page.evaluate(
      async (args) => {
        const res = await fetch(`${args.api}/dental/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            displayName: 'Clean Patient',
            dateOfBirth: '1990-01-01',
            gender: 'male',
            branchId: args.branchId,
            consentGiven: true,
          }),
        });
        if (!res.ok) throw new Error(`Patient create failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
        return res.json();
      },
      { api: API, branchId },
    );

    await spaNavigate(page, `/${patientRes.id}`);
    await page.getByTestId('timeline-carousel').waitFor({ state: 'visible', timeout: 8000 });

    // Safety floor container must not be visible for a patient with no active alerts
    const safetyFloor = page.locator('.bg-red-50.border.border-red-200').first();
    await expect(safetyFloor).not.toBeVisible();
  });

  test('resolved allergy does not appear in safety floor', async ({ page }) => {
    // [AC-MED-02] only active entries surface — resolved allergies must be silent
    const allergyName = 'Aspirin';
    const { patientId, allergyId } = await setupPatientWithAllergy(page, allergyName);

    // Resolve the allergy via API
    await page.evaluate(
      async (args) => {
        await fetch(`${args.api}/dental/clinical/medical-history/${args.allergyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ active: false, resolvedDate: new Date().toISOString() }),
        });
      },
      { api: API, allergyId },
    );

    await spaNavigate(page, `/${patientId}`);
    await page.getByTestId('timeline-carousel').waitFor({ state: 'visible', timeout: 8000 });

    // Safety floor must not appear since the allergy is resolved
    const safetyFloor = page.locator('.bg-red-50.border.border-red-200').first();
    await expect(safetyFloor).not.toBeVisible();
  });
});
