/**
 * E2E: Workspace read-only after visit checkout — AC-VISIT-02, BR-003
 *
 * Flow: sign up → create patient → create + complete visit via API →
 *       re-navigate to workspace → verify no edit buttons, slideout is read-only
 *
 * BR-003: Once a visit is completed (checked out), the dental chart and
 * treatment table must be read-only. Only amendments are permitted.
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect } from '@playwright/test';
import { setupDentalOrg, createDentalPatient, APP, API , gotoApp, signVisitConsent } from './fixtures';

async function createAndCompleteVisit(
  page: Parameters<typeof createDentalPatient>[0],
  patientId: string,
  branchId: string,
  memberId: string,
) {
  // Create visit
  const visitRes = await page.evaluate(
    async ({ api, patientId, branchId, memberId }) => {
      const res = await fetch(`${api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId, branchId, dentistMemberId: memberId }),
      });
      if (!res.ok) throw new Error(`Create visit failed: ${res.status}`);
      return res.json();
    },
    { api: API, patientId, branchId, memberId },
  );

  const visitId = visitRes.id as string;

  // BR-003/VISIT_CONSENT_REQUIRED: completing a visit needs a SIGNED consent.
  // A fresh org has no consent template, so create + attach + sign one first.
  await signVisitConsent(page, { branchId, visitId, patientId });

  // Seed the visit's dental chart so the completed (read-only) carousel slide
  // renders the actual teeth (tooth-21, …) instead of the empty-dentition card.
  // POST /dental/patients/:patientId/dentition auto-populates the FDI chart by DOB.
  await page.evaluate(
    async ({ api, patientId, visitId }) => {
      const res = await fetch(`${api}/dental/patients/${patientId}/dentition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, dateOfBirth: '1990-01-01' }),
      });
      if (!res.ok) throw new Error(`init dentition failed: ${res.status} ${await res.text().catch(() => '')}`);
    },
    { api: API, patientId, visitId },
  );

  // Activate → complete
  for (const status of ['active', 'completed'] as const) {
    await page.evaluate(
      async ({ api, visitId, status }) => {
        const res = await fetch(`${api}/dental/visits/${visitId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error(`PATCH visit to ${status} failed: ${res.status}`);
      },
      { api: API, visitId, status },
    );
  }

  return visitId;
}

test.describe('Workspace read-only after checkout (AC-VISIT-02, BR-003)', () => {
  test('completed visit shows read-only workspace — no mark-done, slideout shows Add Amendment', async ({
    page,
  }) => {
    // Setup org + patient
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Checkout ReadOnly Patient',
      branchId,
    });

    // Complete visit via API (no UI interaction needed)
    await createAndCompleteVisit(page, patientId, branchId, memberId);

    // Re-navigate to workspace
    await gotoApp(page, `/${patientId}`);
    await page.waitForLoadState('networkidle');

    // The timeline carousel should be visible
    await expect(page.getByTestId('timeline-carousel')).toBeVisible();

    // BR-003: "Mark Done" button must NOT be visible (readOnly=true on TreatmentTable)
    await expect(page.getByTestId('mark-done-btn')).not.toBeVisible();

    // Click any tooth to open the slideout
    await page.getByTestId('tooth-21').click();
    const slideout = page.getByTestId('tooth-slideout');
    await slideout.waitFor({ state: 'visible', timeout: 5000 });

    // In readOnly mode: stepper buttons are disabled, Save/Next are absent
    await expect(slideout.getByRole('button', { name: 'Save' })).not.toBeVisible();
    await expect(slideout.getByRole('button', { name: 'Save & Next' })).not.toBeVisible();

    // readOnly footer shows "Add Amendment" option
    await expect(slideout.getByText('Add Amendment')).toBeVisible();
  });

  test('completed visit footer shows "View Invoice" link', async ({ page }) => {
    // @AC-VISIT-02
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'View Invoice Patient',
      branchId,
    });

    await createAndCompleteVisit(page, patientId, branchId, memberId);

    await gotoApp(page, `/${patientId}`);
    await page.waitForLoadState('networkidle');

    // "View Invoice" appears in the workspace payment area / footer for completed visits.
    // Target the button (testid) — the patient is named "View Invoice Patient", whose
    // name span would otherwise collide with a bare getByText('View Invoice').
    await expect(page.getByTestId('continue-to-payment-btn')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('continue-to-payment-btn')).toHaveText(/View Invoice/);
  });
});
