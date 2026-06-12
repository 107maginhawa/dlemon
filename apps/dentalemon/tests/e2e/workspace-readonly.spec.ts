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

async function patchVisitStatus(
  page: Parameters<typeof createDentalPatient>[0],
  visitId: string,
  status: 'active' | 'completed',
) {
  await page.evaluate(
    async ({ api, visitId, status }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`PATCH visit to ${status} failed: ${res.status} ${await res.text().catch(() => '')}`);
    },
    { api: API, visitId, status },
  );
}

/**
 * Seed a treatment on `toothNumber` and advance it diagnosed→planned→performed.
 * Two reasons: (1) the completion gate (VISIT_HAS_OPEN_TREATMENTS) rejects a visit with
 * open diagnosed/planned treatments, so it must reach `performed`; (2) FIX-007 — the
 * read-only tooth needs a treatment record so its id can be the amendment's
 * originalRecordId (the create validator only requires a UUID-FORMAT id; the backend
 * does not verify a tooth_treatment record exists, but using the real id is honest and
 * resolves the canAmend gate). Consent must already be signed (the →performed gate
 * requires it). Returns the treatment id.
 */
async function seedPerformedTreatment(
  page: Parameters<typeof createDentalPatient>[0],
  { visitId, patientId, toothNumber }: { visitId: string; patientId: string; toothNumber: number },
): Promise<string> {
  return page.evaluate(
    async ({ api, visitId, patientId, toothNumber }) => {
      const post = await fetch(`${api}/dental/visits/${visitId}/treatments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId,
          patientId,
          toothNumber,
          cdtCode: 'D2391',
          description: 'Resin composite, one surface',
          priceCents: 12000,
        }),
      });
      if (!post.ok) throw new Error(`create treatment failed: ${post.status} ${await post.text().catch(() => '')}`);
      const treatment = (await post.json()) as { id: string };
      for (const status of ['planned', 'performed'] as const) {
        const patch = await fetch(`${api}/dental/visits/${visitId}/treatments/${treatment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status }),
        });
        if (!patch.ok) throw new Error(`treatment →${status} failed: ${patch.status} ${await patch.text().catch(() => '')}`);
      }
      return treatment.id;
    },
    { api: API, visitId, patientId, toothNumber },
  );
}

async function createAndCompleteVisit(
  page: Parameters<typeof createDentalPatient>[0],
  patientId: string,
  branchId: string,
  memberId: string,
  opts: { seedToothTreatment?: number } = {},
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
  // (Also satisfies the →performed treatment gate below.)
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

  // Activate → (optionally seed a performed treatment) → complete
  await patchVisitStatus(page, visitId, 'active');
  let treatmentId: string | undefined;
  if (opts.seedToothTreatment != null) {
    treatmentId = await seedPerformedTreatment(page, {
      visitId,
      patientId,
      toothNumber: opts.seedToothTreatment,
    });
  }
  await patchVisitStatus(page, visitId, 'completed');

  return { visitId, treatmentId };
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

    // Complete visit via API, seeding a performed treatment on tooth 21 so the
    // read-only tooth has a real record to amend (FIX-007 gates "Add Amendment" on
    // a resolvable originalRecordId).
    await createAndCompleteVisit(page, patientId, branchId, memberId, { seedToothTreatment: 21 });

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

  // FIX-007 / FR1.16: an amendment filed on a locked record is VISIBLE — the
  // previously-orphaned listAmendments now drives a read-only list shown alongside the
  // original record. Proves both directions: a pre-filed amendment READS back in the
  // UI, and a new one can be FILED through the UI (the create-coherence fix — a real
  // originalRecordId, no empty-UUID 400).
  test('amendments read back in the read-only list, and a new one files via the UI', async ({
    page,
  }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Amendment Loop Patient',
      branchId,
    });
    const { visitId, treatmentId } = await createAndCompleteVisit(page, patientId, branchId, memberId, {
      seedToothTreatment: 21,
    });

    // Pre-file an amendment against the tooth's treatment record (the same record the
    // read-only slideout amends). Uses the real treatment id — a valid originalRecordId.
    await page.evaluate(
      async ({ api, visitId, patientId, treatmentId }) => {
        const res = await fetch(`${api}/dental/visits/${visitId}/amendments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            visitId,
            patientId,
            originalRecordType: 'tooth_treatment',
            originalRecordId: treatmentId,
            reason: 'correction',
            content: 'Seeded correction: distal caries noted on bitewing review.',
          }),
        });
        if (!res.ok) throw new Error(`seed amendment failed: ${res.status} ${await res.text().catch(() => '')}`);
      },
      { api: API, visitId, patientId, treatmentId },
    );

    await gotoApp(page, `/${patientId}`);
    await page.waitForLoadState('networkidle');

    // Open the read-only tooth → the previously-orphaned listAmendments now renders.
    await page.getByTestId('tooth-21').click();
    const slideout = page.getByTestId('tooth-slideout');
    await slideout.waitFor({ state: 'visible', timeout: 8000 });

    // READ: the pre-filed correction is visible in the read-only list (FR1.16).
    const list = slideout.getByTestId('amendments-list');
    await expect(
      list.getByText(/Seeded correction: distal caries noted on bitewing review\./),
    ).toBeVisible({ timeout: 8000 });
    await expect(list.getByText(/Tooth treatment/i)).toBeVisible();

    // WRITE: a new amendment can be filed through the real UI — the create path now
    // resolves a valid originalRecordId, so the form submits cleanly (no empty-UUID 400).
    await slideout.getByText('Add Amendment').click();
    await slideout.getByLabel(/Reason/).selectOption('clarification');
    await slideout
      .getByLabel(/Details/)
      .fill('Filed via UI: composite placed on the mesial surface, not distal.');
    await slideout.getByRole('button', { name: /save amendment/i }).click();

    // The form submits without error (the details field is gone; no failure banner)…
    await expect(slideout.getByLabel(/Details/)).toBeHidden({ timeout: 8000 });
    await expect(slideout.getByText(/failed to save amendment/i)).toHaveCount(0);
    // …and the new correction reads back in the list (write→read loop closed end-to-end).
    await expect(
      list.getByText(/Filed via UI: composite placed on the mesial surface, not distal\./),
    ).toBeVisible({ timeout: 8000 });
    await expect(list.getByTestId('amendment-row')).toHaveCount(2);
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
