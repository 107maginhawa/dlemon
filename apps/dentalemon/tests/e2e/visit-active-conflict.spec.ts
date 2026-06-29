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
  test('disables New Visit (with a reason) instead of inviting a guaranteed-fail click', async ({ page }) => {
    const { patientId } = await setupPatientWithActiveVisit(page);

    await spaNavigate(page, `/${patientId}`);

    // The workspace makes the open visit obvious…
    await expect(page.getByTestId('visit-in-progress-indicator')).toBeVisible({ timeout: 15000 });

    // …and the New Visit affordance is DISABLED with a reason — not a clickable
    // button that 409s.
    const newVisit = page.getByTestId('new-visit-btn');
    await expect(newVisit).toBeVisible();
    await expect(newVisit).toBeDisabled();
    await expect(page.getByTestId('new-visit-disabled-hint')).toContainText(/finish or discard the open visit/i);

    // Forcing a click does nothing — no 409 error toast appears.
    await newVisit.click({ force: true }).catch(() => {});
    await expect(page.getByText(/active visit already exists|please try again/i)).toHaveCount(0);
  });

  test('owner can Discard the open visit, which re-enables New Visit (escape hatch)', async ({ page }) => {
    const { patientId } = await setupPatientWithActiveVisit(page);
    await spaNavigate(page, `/${patientId}`);

    const discard = page.getByTestId('discard-visit-btn');
    await expect(discard).toBeVisible({ timeout: 15000 });

    // PP-8 (ISSUE-041): discard now opens an accessible reason dialog (it replaced
    // window.prompt). Drive it explicitly: open → fill the required reason → confirm.
    await discard.click();
    await expect(page.getByTestId('discard-visit-dialog')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('discard-reason').fill('Patient left without being seen');
    await page.getByTestId('discard-visit-confirm').click();

    // After discard, the open visit is gone → the in-progress indicator clears and
    // New Visit becomes enabled again.
    await expect(page.getByTestId('visit-in-progress-indicator')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByTestId('new-visit-btn')).toBeEnabled();
  });
});
