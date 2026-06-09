/**
 * E2E: Dental chart "living document" — cumulative cross-visit layers
 *
 * The odontogram on the active "Current — all visits" card is a living document:
 * its Completed / Proposed / Declined layers are status-filtered views over the
 * patient's treatments across ALL visits, not just the current one (commit
 * 30fbc0b7, ADR-008).
 *
 * This spec drives the real cross-visit flow through the API and asserts the
 * markers render on the REAL DentalChart (which is globally stubbed in vitest, so
 * only an E2E can exercise it):
 *   - A treatment PERFORMED in a prior, completed visit shows the tooth as
 *     `completed` on the current active card (cumulative, not per-visit).
 *   - A pending treatment CARRIED OVER from a prior visit shows the amber
 *     carried-over marker (`data-carried-over="1"`).
 *   - A treatment the patient DECLINED shows the tooth on the `declined` layer
 *     and surfaces the Declined toggle chip (hidden when no declined work exists).
 *
 * Self-seeding: org + owner provisioned via /dental/onboarding; the patient,
 * visits and treatments are built with the dental API, then the workspace is
 * driven through the real UI.
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

const TOOTH_COMPLETED = 16; // performed in visit A → cumulative completed on the active card
const TOOTH_CARRIED = 25;   // proposed in visit A, dismissed, restored into visit B → carried-over
const TOOTH_DECLINED = 46;  // recommended in visit B, patient declined → declined layer + chip

interface BuiltScenario {
  patientId: string;
  visitAId: string;
  visitBId: string;
}

/**
 * Build the living-document scenario entirely through the dental API:
 *
 *  Visit A (completed):
 *    - tooth 16: diagnosed → planned → performed   (cumulative completed)
 *    - tooth 25: diagnosed → dismissed             (so the visit can complete;
 *                                                    restored into visit B below)
 *  Visit B (active = "Current — all visits"):
 *    - carry-over restore of the dismissed tooth-25 item → planned + carriedOver
 *    - tooth 46: diagnosed → declined (refusalReason)
 *
 * Mirrors the consent + FSM chain used by reporting/billing specs.
 */
async function buildLivingDocumentScenario(
  page: Page,
  opts: { branchId: string; memberId: string },
): Promise<BuiltScenario> {
  const result = await page.evaluate(
    async ({ api, branchId, memberId, T_DONE, T_CARRY, T_DECLINE }) => {
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

      // Patient
      const patientRes = await fetch(`${api}/dental/patients`, j({
        displayName: 'Living Document Patient', dateOfBirth: '1980-04-12',
        gender: 'female', branchId, consentGiven: true,
      }));
      if (!patientRes.ok) return fail('patient', patientRes);
      const patient = await patientRes.json() as { id: string };

      // A signed consent is required per visit to perform a treatment AND to
      // complete the visit. One shared branch template is enough.
      const tplRes = await fetch(`${api}/dental/branches/${branchId}/consent-templates`, j({
        title: 'General Treatment Consent', content: 'I consent.',
        name: 'General Treatment Consent', body: 'I consent.',
      }));
      const tplJson = await tplRes.json() as { template?: { id: string }; id?: string };
      const templateId = tplJson?.template?.id ?? tplJson?.id;

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

      const addTreatment = async (visitId: string, toothNumber: number, cdtCode: string, description: string) => {
        const tRes = await fetch(`${api}/dental/visits/${visitId}/treatments`, j({
          visitId, patientId: patient.id, cdtCode, description, toothNumber, priceCents: 500000,
        }));
        if (!tRes.ok) return { id: null, error: await fail('treatment', tRes) };
        const t = await tRes.json() as { id?: string; data?: { id: string } };
        return { id: (t?.id ?? t?.data?.id) ?? null, error: null };
      };

      // ── Visit A ──────────────────────────────────────────────────────────
      const a = await startVisit();
      if (!a.id) return a.error;
      const visitAId = a.id;

      // tooth 16: → performed (cumulative completed)
      const done = await addTreatment(visitAId, T_DONE, 'D2740', `Crown #${T_DONE}`);
      if (!done.id) return done.error;
      for (const status of ['planned', 'performed']) {
        const r = await fetch(`${api}/dental/visits/${visitAId}/treatments/${done.id}`, patch({ status }));
        if (!r.ok) return fail(`tooth-${T_DONE}→${status}`, r);
      }

      // tooth 25: diagnosed → dismissed (carried over into visit B below)
      const carry = await addTreatment(visitAId, T_CARRY, 'D2391', `Resin composite #${T_CARRY}`);
      if (!carry.id) return carry.error;
      const dRes = await fetch(`${api}/dental/visits/${visitAId}/treatments/${carry.id}`,
        patch({ status: 'dismissed', dismissReason: 'Patient deferred — revisit next appointment' }));
      if (!dRes.ok) return fail(`tooth-${T_CARRY}→dismissed`, dRes);

      // Notes row + complete visit A
      await fetch(`${api}/dental/visits/${visitAId}/notes`, j({
        visitId: visitAId, subjective: 'Crown placed; composite deferred.', objective: 'WNL',
      }));
      const compRes = await fetch(`${api}/dental/visits/${visitAId}`, patch({ status: 'completed' }));
      if (!compRes.ok) return fail('complete-visit-A', compRes);

      // ── Visit B (active) ─────────────────────────────────────────────────
      const b = await startVisit();
      if (!b.id) return b.error;
      const visitBId = b.id;

      // Carry over the dismissed tooth-25 item → planned + carriedOver
      const coRes = await fetch(`${api}/dental/visits/${visitBId}/carry-over`,
        j({ restoreDismissedIds: [carry.id] }));
      if (!coRes.ok) return fail('carry-over', coRes);

      // tooth 46: diagnosed → declined
      const decline = await addTreatment(visitBId, T_DECLINE, 'D2750', `Crown #${T_DECLINE}`);
      if (!decline.id) return decline.error;
      const declRes = await fetch(`${api}/dental/visits/${visitBId}/treatments/${decline.id}`,
        patch({ status: 'declined', refusalReason: 'Patient declined — cost; will reconsider' }));
      if (!declRes.ok) return fail(`tooth-${T_DECLINE}→declined`, declRes);

      return { patientId: patient.id, visitAId, visitBId };
    },
    { api: API, branchId: opts.branchId, memberId: opts.memberId,
      T_DONE: TOOTH_COMPLETED, T_CARRY: TOOTH_CARRIED, T_DECLINE: TOOTH_DECLINED },
  );

  if (!result || 'error' in result) {
    throw new Error(`Scenario seeding failed: ${result ? result.error : 'null result'}`);
  }
  return result as BuiltScenario;
}

/**
 * Ensure the active card's dental chart is rendered. A fresh active visit B has no
 * chart row yet, so the carousel shows the "Initialize Dentition" empty state; we
 * click it (the real user flow) so the 32-tooth chart renders with the cumulative
 * layer overlays.
 */
async function ensureActiveChart(page: Page) {
  const chart = page.getByTestId('dental-chart');
  if (await chart.isVisible().catch(() => false)) return;
  const initBtn = page.getByTestId('init-dentition-btn');
  await expect(initBtn).toBeVisible({ timeout: 15000 });
  await initBtn.click();
  await expect(chart).toBeVisible({ timeout: 15000 });
}

test.describe('Living-document chart — cumulative cross-visit layers', () => {
  test('completed (prior visit) + carried-over + declined all render on the active card', async ({ page }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'solo', label: 'LivingDoc' });
    const { patientId } = await buildLivingDocumentScenario(page, { branchId, memberId });

    await spaNavigate(page, `/${patientId}`);

    // The active card is the cumulative "Current — all visits" slide.
    const activeCard = page.locator('[data-active-card="1"]');
    await expect(activeCard).toBeVisible({ timeout: 15000 });
    await expect(activeCard.getByText('Current — all visits')).toBeVisible();

    await ensureActiveChart(page);

    // Cumulative completed: tooth performed in the PRIOR (completed) visit A still
    // shows done on the current card — the living document, not a per-visit snapshot.
    await expect(page.getByTestId(`tooth-${TOOTH_COMPLETED}`))
      .toHaveAttribute('data-tooth-layer', 'completed');

    // Carried-over: a pending item first raised in a prior visit carries the amber marker.
    const carried = page.getByTestId(`tooth-${TOOTH_CARRIED}`);
    await expect(carried).toHaveAttribute('data-carried-over', '1');
    await expect(carried).toHaveAttribute('data-tooth-layer', 'proposed');

    // Declined: refused recommendation lands on the declined layer AND surfaces the
    // Declined toggle chip (which stays hidden when no declined work exists).
    await expect(page.getByTestId(`tooth-${TOOTH_DECLINED}`))
      .toHaveAttribute('data-tooth-layer', 'declined');
    await expect(page.getByTestId('chart-layer-declined')).toBeVisible();
  });
});
