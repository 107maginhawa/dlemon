/**
 * E2E: SL-03 / B-G1 — a per-tooth PATCH survives cross-visit carry-over.
 *
 * The odontogram is a living document: every chart write must merge into the
 * patient baseline so the next visit inherits it. `upsertDentalChart` always
 * did; the per-surface PATCH path (`updateTooth`) did NOT — so a single-tooth
 * edit was silently dropped from the next visit's chart.
 *
 * This spec drives the REAL per-tooth edit path through the API and asserts the
 * edited tooth renders on the next visit's chart (the real DentalChart is
 * globally stubbed in vitest, so only an E2E exercises it):
 *
 *   Visit A (completed): upsert chart with tooth 11 = "healthy", then PATCH
 *     tooth 11 to "crown" (the per-tooth path under test).
 *   Visit B (active): the cumulative card carries tooth 11 forward — and it must
 *     show the PATCHed "crown", not the stale upsert "healthy". Before the fix
 *     the PATCH skipped the baseline merge and tooth 11 carried "healthy".
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

const TOOTH = 11; // upsert as "healthy", PATCH to "crown" → carry-over must show "crown"

async function buildPatchCarryoverScenario(
  page: Page,
  opts: { branchId: string; memberId: string },
): Promise<{ patientId: string }> {
  const result = await page.evaluate(
    async ({ api, branchId, memberId, tooth }) => {
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
        displayName: 'Patch Carryover Patient', dateOfBirth: '1975-03-09',
        gender: 'male', branchId, consentGiven: true,
      }));
      if (!patientRes.ok) return fail('patient', patientRes);
      const patient = await patientRes.json() as { id: string };

      // Shared consent template (a signed consent is required to complete a visit).
      const tplRes = await fetch(`${api}/dental/branches/${branchId}/consent-templates`, j({
        name: 'General Treatment Consent', body: 'I consent.',
      }));
      const tplJson = await tplRes.json() as { id?: string };
      const templateId = tplJson?.id;

      const startVisit = async () => {
        const vRes = await fetch(`${api}/dental/visits`, j({
          patientId: patient.id, branchId, dentistMemberId: memberId,
        }));
        if (!vRes.ok) return { id: null, error: await fail('visit', vRes) };
        const v = await vRes.json() as { id: string };
        await fetch(`${api}/dental/visits/${v.id}`, patch({ status: 'active' }));
        const conRes = await fetch(`${api}/dental/visits/${v.id}/consents`, j({
          visitId: v.id, patientId: patient.id, templateId,
          templateName: 'General Treatment Consent',
        }));
        const conJson = await conRes.json() as { consent?: { id: string }; id?: string };
        const consentId = conJson?.consent?.id ?? conJson?.id;
        await fetch(`${api}/dental/visits/${v.id}/consents/${consentId}/sign`,
          j({ signatureData: 'data:image/png;base64,iVBORw0KGgo=' }));
        return { id: v.id, error: null };
      };

      // ── Visit A ──────────────────────────────────────────────────────────
      const a = await startVisit();
      if (!a.id) return a.error;
      const visitAId = a.id;

      // Upsert establishes tooth 11 = "healthy" (this DOES merge baseline today).
      const upRes = await fetch(`${api}/dental/visits/${visitAId}/chart`, j({
        visitId: visitAId, patientId: patient.id,
        teeth: [{ toothNumber: tooth, state: 'healthy' }],
      }));
      if (!upRes.ok) return fail('upsert-chart', upRes);

      // The per-tooth PATCH under test: tooth 11 → "crown". Before the fix this
      // edit never reached the baseline.
      const ptRes = await fetch(`${api}/dental/visits/${visitAId}/chart/teeth/${tooth}`,
        patch({ toothNumber: tooth, state: 'crown' }));
      if (!ptRes.ok) return fail('patch-tooth', ptRes);

      await fetch(`${api}/dental/visits/${visitAId}/notes`, j({
        visitId: visitAId, subjective: 'Crown charted on tooth 11.', objective: 'WNL',
      }));
      const compRes = await fetch(`${api}/dental/visits/${visitAId}`, patch({ status: 'completed' }));
      if (!compRes.ok) return fail('complete-visit-A', compRes);

      // ── Visit B (active) — inherits the baseline ─────────────────────────
      const b = await startVisit();
      if (!b.id) return b.error;

      return { patientId: patient.id };
    },
    { api: API, branchId: opts.branchId, memberId: opts.memberId, tooth: TOOTH },
  );

  if (!result || 'error' in result) {
    throw new Error(`Scenario seeding failed: ${result ? result.error : 'null result'}`);
  }
  return result as { patientId: string };
}

async function ensureActiveChart(page: Page) {
  const activeCard = page.locator('[data-active-card="1"]');
  const chart = activeCard.getByTestId('dental-chart');
  if (await chart.isVisible().catch(() => false)) return;
  const initBtn = activeCard.getByTestId('init-dentition-btn');
  if (await initBtn.isVisible().catch(() => false)) {
    await initBtn.click();
  }
  await expect(chart).toBeVisible({ timeout: 15000 });
}

test.describe('Chart per-tooth PATCH — cross-visit carry-over (B-G1)', () => {
  test('a tooth edited via the per-tooth PATCH carries its state into the next visit', async ({ page }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'solo', label: 'PatchCarry' });
    const { patientId } = await buildPatchCarryoverScenario(page, { branchId, memberId });

    await spaNavigate(page, `/${patientId}`);

    const activeCard = page.locator('[data-active-card="1"]');
    await expect(activeCard).toBeVisible({ timeout: 15000 });

    await ensureActiveChart(page);

    // The carried tooth must reflect the PATCHed "crown" — not the upsert "healthy".
    // Tooth state is exposed in the button's aria-label ("Tooth …, <state>, <layer>").
    const tooth = activeCard.getByTestId(`tooth-${TOOTH}`);
    await expect(tooth).toBeVisible({ timeout: 15000 });
    await expect(tooth).toHaveAttribute('aria-label', /crown/i);
  });
});
