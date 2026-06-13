/**
 * E2E: Consent Template Picker — FIX-009 (FR8.4b, per-clinic consent wording)
 *
 * The consent sheet's template picker must surface the clinic's OWN configured
 * consent wording (the dental-org `body`), not just generic names. Flow:
 *   sign up (owner) → create a clinic consent template with distinctive body via
 *   the dental-org API → create patient + active visit → open the consent sheet →
 *   the configured template appears in the picker → selecting it renders its body
 *   as read-only clinic wording, and the "configure in Settings" fallback nudge
 *   is absent (because a real template exists).
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

const CLINIC_BODY =
  'I authorize the dentist to perform the surgical extraction of tooth #48 under local anesthesia, as discussed.';
const CLINIC_TEMPLATE_NAME = 'Acme Clinic Surgical Consent';

async function setup(page: Page) {
  const { branchId, memberId } = await signUpOnboardAndUnlock(page, {
    tier: 'solo',
    label: 'ConsentTpl',
  });

  // Owner configures a per-clinic consent template (FR8.4b) via dental-org API.
  await page.evaluate(
    async (args) => {
      const res = await fetch(`${args.api}/dental/branches/${args.branchId}/consent-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: args.name,
          body: args.body,
          requiresWitnessSignature: false,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '<unreadable>');
        throw new Error(`Consent template creation failed: ${res.status} — ${detail.slice(0, 300)}`);
      }
    },
    { api: API, branchId, name: CLINIC_TEMPLATE_NAME, body: CLINIC_BODY },
  );

  // Patient + active visit so the workspace renders the Consent affordance.
  const patientId = await page.evaluate(
    async (args) => {
      const res = await fetch(`${args.api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: 'Consent Tpl Patient',
          dateOfBirth: '1990-03-12',
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

  await page.evaluate(
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
    },
    { api: API, patientId, branchId, memberId },
  );

  return { patientId, branchId };
}

test.describe('Consent Template Picker (FIX-009 / FR8.4b)', () => {
  test('selecting the clinic-configured template surfaces its body as read-only wording', async ({
    page,
  }) => {
    const { patientId } = await setup(page);
    await spaNavigate(page, `/${patientId}`);

    const consentBtn = page.getByRole('button', { name: 'Consent', exact: true });
    await consentBtn.waitFor({ state: 'visible', timeout: 8000 });
    await consentBtn.click();

    const sheet = page.getByTestId('consent-sheet');
    await sheet.waitFor({ state: 'visible', timeout: 8000 });

    // The configured clinic template appears in the picker.
    const templateSelect = sheet.locator('select').first();
    await templateSelect.waitFor({ state: 'visible', timeout: 3000 });
    await expect(sheet.getByRole('option', { name: CLINIC_TEMPLATE_NAME })).toHaveCount(1);

    // A real clinic template exists → no "configure in Settings" fallback nudge.
    await expect(sheet.getByTestId('consent-template-fallback-hint')).toHaveCount(0);

    // Selecting it surfaces the clinic's configured wording, read-only.
    await templateSelect.selectOption({ label: CLINIC_TEMPLATE_NAME });
    const body = sheet.getByTestId('consent-template-body');
    await expect(body).toBeVisible({ timeout: 5000 });
    await expect(body).toContainText('surgical extraction of tooth #48');
  });
});
