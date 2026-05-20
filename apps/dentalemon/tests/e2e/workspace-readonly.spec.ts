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
import { setupDentalOrg, createDentalPatient, APP, API } from './fixtures';

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
    await page.goto(`${APP}/${patientId}`);
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

    await page.goto(`${APP}/${patientId}`);
    await page.waitForLoadState('networkidle');

    // "View Invoice" appears in the workspace payment area / footer for completed visits
    await expect(page.getByText('View Invoice')).toBeVisible({ timeout: 8000 });
  });
});
