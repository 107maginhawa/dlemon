/**
 * E2E: Consent Revocation + History (WF-035, FIX-004 / Batch B)
 *
 * Proves the previously-orphaned revoke + history surface is reachable from the
 * real product UI: open the consent sheet → History tab → a pending consent
 * shows a Revoke affordance → revoking flips it to "Revoked" (the action drops).
 *
 * The consent sheet only ever produces SIGNED consents from the UI (create+sign
 * is atomic), so a PENDING form is seeded via the API first — then every
 * assertion is driven through the rendered UI (no page.evaluate(fetch) for the
 * behaviour under test).
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

async function setupWithPendingConsent(page: Page) {
  // Owner (dentist_owner) so the Revoke affordance is permitted (canRevoke).
  const { branchId, memberId } = await signUpOnboardAndUnlock(page, {
    tier: 'solo',
    label: 'ConsentRevoke',
  });

  const patientId = await page.evaluate(
    async (args) => {
      const res = await fetch(`${args.api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: 'Revoke Patient',
          dateOfBirth: '1990-02-02',
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

  // Seed an UNSIGNED (pending) consent form — the only state that is revocable.
  const consentId = await page.evaluate(
    async (args) => {
      const res = await fetch(`${args.api}/dental/visits/${args.visitId}/consents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId: args.visitId,
          patientId: args.patientId,
          templateId: 'tpl-e2e-revoke',
          templateName: 'E2E Revocable Consent',
        }),
      });
      if (!res.ok) throw new Error(`Consent seed failed: ${res.status}`);
      return (await res.json()).id as string;
    },
    { api: API, visitId, patientId },
  );

  return { patientId, visitId, consentId };
}

test.describe('Consent Revocation + History (WF-035, FIX-004)', () => {
  test('pending consent is revocable from the History tab and flips to Revoked', async ({
    page,
  }) => {
    const { patientId, consentId } = await setupWithPendingConsent(page);
    await spaNavigate(page, `/${patientId}`);

    // Open the consent sheet from the workspace top bar.
    const consentBtn = page.getByRole('button', { name: 'Consent', exact: true });
    await consentBtn.waitFor({ state: 'visible', timeout: 8000 });
    await consentBtn.click();

    const sheet = page.getByTestId('consent-sheet');
    await sheet.waitFor({ state: 'visible', timeout: 8000 });

    // Switch to the History tab (the surface the dead orphan ops now power).
    await sheet.getByRole('tab', { name: /history/i }).click();

    // The seeded form renders as Pending with a Revoke affordance.
    const status = page.getByTestId(`consent-status-${consentId}`);
    await expect(status).toHaveText(/pending/i, { timeout: 8000 });
    const revokeBtn = page.getByRole('button', { name: /revoke e2e revocable consent/i });
    await expect(revokeBtn).toBeVisible();

    // Revoke through the UI → status flips to Revoked and the action drops.
    await revokeBtn.click();
    await expect(status).toHaveText(/revoked/i, { timeout: 8000 });
    await expect(page.getByRole('button', { name: /revoke e2e revocable consent/i })).toHaveCount(0);
  });
});
