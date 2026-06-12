/**
 * E2E: FIX-002 (Batch B) — carry-over affordance at the new-visit entry point.
 *
 * Product decision (product-decisions.md Q2): when a dentist starts a NEW visit for a
 * returning patient who has pending (diagnosed/planned) treatments from a previous visit,
 * offer to carry them into the new visit. Confirming invokes the canonical
 * POST /dental/visits/:id/carry-over endpoint; the carried treatment then appears in the
 * treatment table's "Carried Over" section (and as an amber ring on the chart).
 *
 * Mechanism is restore-dismissed (the visit-completion gate forbids completing a visit with
 * diagnosed/planned treatments, so a completed prior visit only ever yields DEFERRED
 * (dismissed) candidates). The carry-over endpoint had zero FE consumers before this batch,
 * so only an E2E proves the full returning-patient loop against the real API.
 *
 *   Visit A (completed): one treatment, deferred (dismissed) — the restore candidate.
 *   Workspace: New Visit → carry-over prompt appears → confirm (restoreDismissedIds) → the
 *     restored treatment renders ONCE in the carried-over section (the FIX-002 coherence
 *     fix prevents a double row).
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

const TX_DESCRIPTION = 'CarryOver Composite E2E';

async function seedReturningPatientWithPendingTx(
  page: Page,
  opts: { branchId: string; memberId: string },
): Promise<{ patientId: string }> {
  const result = await page.evaluate(
    async ({ api, branchId, memberId, txDesc }) => {
      const j = (body: unknown) => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' as const,
        body: JSON.stringify(body),
      });
      const patch = (body: unknown) => ({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' as const,
        body: JSON.stringify(body),
      });
      const fail = async (label: string, res: Response) =>
        ({ error: `${label} ${res.status}: ${(await res.text()).slice(0, 200)}` });

      const patientRes = await fetch(`${api}/dental/patients`, j({
        displayName: 'Carryover UI Patient', dateOfBirth: '1980-05-05',
        gender: 'female', branchId, consentGiven: true,
      }));
      if (!patientRes.ok) return fail('patient', patientRes);
      const patient = await patientRes.json() as { id: string };

      // Signed consent is required to complete a visit.
      const tplRes = await fetch(`${api}/dental/branches/${branchId}/consent-templates`, j({
        name: 'General Treatment Consent', body: 'I consent.',
      }));
      const tplJson = await tplRes.json() as { id?: string };
      const templateId = tplJson?.id;

      // ── Visit A (active) ──────────────────────────────────────────────────
      const vRes = await fetch(`${api}/dental/visits`, j({
        patientId: patient.id, branchId, dentistMemberId: memberId,
      }));
      if (!vRes.ok) return fail('visit', vRes);
      const visitA = await vRes.json() as { id: string };
      await fetch(`${api}/dental/visits/${visitA.id}`, patch({ status: 'active' }));

      // A treatment that gets DEFERRED (dismissed) on Visit A. The completion gate blocks
      // completing with diagnosed/planned treatments, but a dismissed one survives — and
      // becomes the restore candidate for the next visit (FR1.11). The create-treatment
      // body requires visitId + patientId (redundant with the path; see dental-visit.hurl §8).
      const txRes = await fetch(`${api}/dental/visits/${visitA.id}/treatments`, j({
        visitId: visitA.id, patientId: patient.id,
        cdtCode: 'D2391', description: txDesc, toothNumber: 26, priceCents: 15000,
      }));
      if (!txRes.ok) return fail('treatment', txRes);
      const tx = await txRes.json() as { id: string };
      const disRes = await fetch(`${api}/dental/visits/${visitA.id}/treatments/${tx.id}`,
        patch({ status: 'dismissed', dismissReason: 'Patient deferred to next visit' }));
      if (!disRes.ok) return fail('dismiss-treatment', disRes);

      // Sign consent + add a note, then complete Visit A so there is no OPEN visit
      // (the one-active-visit rule disables "New Visit" while a visit is open).
      const conRes = await fetch(`${api}/dental/visits/${visitA.id}/consents`, j({
        visitId: visitA.id, patientId: patient.id, templateId,
        templateName: 'General Treatment Consent',
      }));
      const conJson = await conRes.json() as { consent?: { id: string }; id?: string };
      const consentId = conJson?.consent?.id ?? conJson?.id;
      await fetch(`${api}/dental/visits/${visitA.id}/consents/${consentId}/sign`,
        j({ signatureData: 'data:image/png;base64,iVBORw0KGgo=' }));
      await fetch(`${api}/dental/visits/${visitA.id}/notes`, j({
        visitId: visitA.id, subjective: 'Dx composite tooth 26.', objective: 'WNL',
      }));
      const compRes = await fetch(`${api}/dental/visits/${visitA.id}`, patch({ status: 'completed' }));
      if (!compRes.ok) return fail('complete-visit-A', compRes);

      return { patientId: patient.id };
    },
    { api: API, branchId: opts.branchId, memberId: opts.memberId, txDesc: TX_DESCRIPTION },
  );

  if (!result || 'error' in result) {
    throw new Error(`Scenario seeding failed: ${result ? result.error : 'null result'}`);
  }
  return result as { patientId: string };
}

test.describe('FIX-002 — carry-over affordance at the new-visit entry point', () => {
  test('returning patient: starting a new visit prompts carry-over; confirming shows the carried treatment once', async ({ page }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'solo', label: 'CarryOverUI' });
    const { patientId } = await seedReturningPatientWithPendingTx(page, { branchId, memberId });

    await spaNavigate(page, `/${patientId}`);

    // Visit A is completed → no open visit → the New Visit affordance is enabled.
    const newVisitBtn = page.getByTestId('new-visit-btn');
    await expect(newVisitBtn).toBeVisible({ timeout: 15000 });
    await newVisitBtn.click();

    // The carry-over prompt appears for a returning patient with prior pending work.
    const confirm = page.getByTestId('carry-over-confirm');
    await expect(confirm).toBeVisible({ timeout: 15000 });
    await confirm.click();

    // The carried treatment renders in the table — exactly once (carried-over section),
    // never double-displayed (FIX-002 coherence). getByText requires a single match.
    await expect(page.getByText(TX_DESCRIPTION)).toBeVisible({ timeout: 15000 });
  });
});
