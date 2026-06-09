/**
 * E2E: New Visit when one is already open (error-message honesty).
 *
 * Regression for the reported bug: clicking "New Visit" on a patient who already
 * has an active visit returned a correct 409 (ACTIVE_VISIT_EXISTS) but the UI
 * showed the generic "Failed to create visit. Please try again." This is the
 * test that would have caught it: it drives the REAL rendered FE in the
 * lived-in state (a pre-existing active visit) and asserts the surfaced toast
 * shows the ACTIONABLE backend message, not the generic fallback.
 *
 * Root cause was the central error parser reading the wrong envelope shape — see
 * apps/dentalemon/src/lib/error-toast.ts + its unit tests.
 */
import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

async function setupPatientWithActiveVisit(page: Page) {
  const { branchId } = await signUpOnboardAndUnlock(page, { tier: 'solo', label: 'Conflict' });

  return page.evaluate(
    async (args) => {
      const json = async (res: Response, label: string) => {
        if (!res.ok) throw new Error(`${label} (${res.status}): ${(await res.text()).slice(0, 300)}`);
        return res.json();
      };
      // Who am I (dentist member) in this branch?
      const ctx = await json(await fetch(`${args.api}/dental/org/context`, { credentials: 'include' }), 'org context');
      const dentistMemberId = ctx.member.id;

      // A patient…
      const patient = await json(
        await fetch(`${args.api}/dental/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ displayName: 'Open Visit Patient', dateOfBirth: '1985-06-15', gender: 'female', branchId: args.branchId, consentGiven: true }),
        }),
        'patient create',
      );

      // …who ALREADY has an ACTIVE visit (create draft → activate), exactly the
      // state every seeded demo patient is in.
      const visit = await json(
        await fetch(`${args.api}/dental/visits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ patientId: patient.id, branchId: args.branchId, dentistMemberId, visitType: 'general' }),
        }),
        'visit create',
      );
      await json(
        await fetch(`${args.api}/dental/visits/${visit.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'active' }),
        }),
        'visit activate',
      );

      return { patientId: patient.id };
    },
    { api: API, branchId },
  );
}

test.describe('New Visit with an existing active visit', () => {
  test('shows the actionable backend message, not the generic "try again"', async ({ page }) => {
    const { patientId } = await setupPatientWithActiveVisit(page);

    await spaNavigate(page, `/${patientId}`);
    await expect(page.getByTestId('new-visit-btn')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('new-visit-btn').click();

    // The 409 ACTIVE_VISIT_EXISTS message must surface verbatim…
    await expect(
      page.getByText(/active visit already exists|complete or discard it first/i),
    ).toBeVisible({ timeout: 10000 });

    // …and the misleading generic retry copy must NOT be shown.
    await expect(page.getByText(/please try again/i)).toHaveCount(0);
  });
});
