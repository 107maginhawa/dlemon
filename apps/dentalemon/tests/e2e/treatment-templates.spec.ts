/**
 * E2E: Treatment Templates — dental-visit GAP-2 / decision #13 (WIRE FE)
 *
 * Full create→apply loop through real UI:
 *   sign up (owner) → Settings → Treatment Templates → create a template with one
 *   item → it lists → create a patient + active visit (API) → open the workspace →
 *   Apply Template → pick the template → its item appears as a `planned` treatment
 *   row in the table.
 *
 * Exercises both halves of #13: the Settings management panel (create) and the
 * workspace apply affordance (the clinical action).
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

const TEMPLATE_NAME = 'E2E Exam Bundle';
const ITEM_CDT = 'D0150';
const ITEM_DESC = 'Comprehensive oral evaluation';

test.describe('Treatment Templates (#13 — create + apply)', () => {
  test('owner creates a template in Settings, then applies it to a visit', async ({ page }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'solo', label: 'TxTpl' });

    // 1. Create a treatment template via the Settings UI (Slice 1).
    await spaNavigate(page, '/settings');
    await page.getByRole('button', { name: 'Treatment Templates' }).click();
    await page.getByRole('button', { name: /add template/i }).click();
    await page.getByLabel(/template name/i).fill(TEMPLATE_NAME);
    await page.getByLabel(/item 1 cdt code/i).fill(ITEM_CDT);
    await page.getByLabel(/item 1 description/i).fill(ITEM_DESC);
    await page.getByLabel(/item 1 price/i).fill('1500');
    await page.getByRole('button', { name: /^save template$/i }).click();

    // It persists + lists (the panel reads back the { templates } envelope).
    await expect(page.getByText(TEMPLATE_NAME)).toBeVisible({ timeout: 8000 });

    // 2. Patient + active visit (API setup) so the workspace renders the affordance.
    const patientId = await page.evaluate(
      async (args) => {
        const res = await fetch(`${args.api}/dental/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            displayName: 'Tx Tpl Patient',
            dateOfBirth: '1991-05-20',
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

    await page.evaluate(
      async (args) => {
        const cr = await fetch(`${args.api}/dental/visits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ patientId: args.patientId, branchId: args.branchId, dentistMemberId: args.memberId }),
        });
        if (!cr.ok) throw new Error(`Visit creation failed: ${cr.status}`);
        const visit = await cr.json();
        const pr = await fetch(`${args.api}/dental/visits/${visit.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'active' }),
        });
        if (!pr.ok) throw new Error(`Visit activation failed: ${pr.status}`);
      },
      { api: API, patientId, branchId, memberId },
    );

    // 3. Apply the template from the workspace (Slice 2).
    await spaNavigate(page, `/${patientId}`);
    const applyBtn = page.getByRole('button', { name: /apply template/i });
    await applyBtn.waitFor({ state: 'visible', timeout: 8000 });
    await applyBtn.click();
    await page.getByRole('option', { name: new RegExp(TEMPLATE_NAME) }).click();

    // 4. The template's item lands as a planned treatment row in the table.
    await expect(page.getByText(ITEM_DESC, { exact: false })).toBeVisible({ timeout: 8000 });
  });
});
