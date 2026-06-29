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

    // The active card is the cumulative all-visits slide.
    const activeCard = page.locator('[data-active-card="1"]');
    await expect(activeCard).toBeVisible({ timeout: 15000 });
    // The cumulative scope renders as two chips ("Current" + "All visits"); the
    // "All visits" chip is unique to the active/open card (historical = "Snapshot").
    await expect(activeCard.getByTestId('chart-scope-label')).toContainText('All visits');

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

  test('historical card shows per-visit completed layer for performed tooth and read-only layer key', async ({ page }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'solo', label: 'HistCard' });
    const { patientId, visitAId } = await buildLivingDocumentScenario(page, { branchId, memberId });

    // Initialize Visit A's dentition chart so the historical snapshot card has teeth
    // in the database. Without this, getDentalChart returns 404 for the completed Visit A
    // and the historical carousel card shows an error state (no teeth rendered in the DOM).
    // The patient DOB is 1980-04-12 → adult (age > 12) → permanent dentition.
    // initializeDentition has no visit-status gate, so this works on a completed visit.
    await page.evaluate(
      async ({ api, patientId, visitAId }) => {
        const res = await fetch(`${api}/dental/patients/${patientId}/dentition`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ visitId: visitAId, dateOfBirth: '1980-04-12' }),
        });
        if (!res.ok) throw new Error(`initDentition-A failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      },
      { api: API, patientId, visitAId },
    );

    await spaNavigate(page, `/${patientId}`);

    // The carousel starts on the most-recent slide (Visit B, the open visit).
    // Wait for the active card to be ready first.
    const activeCard = page.locator('[data-active-card="1"]');
    await expect(activeCard).toBeVisible({ timeout: 15000 });
    // The cumulative scope renders as two chips ("Current" + "All visits"); the
    // "All visits" chip is unique to the active/open card (historical = "Snapshot").
    await expect(activeCard.getByTestId('chart-scope-label')).toContainText('All visits');

    // Also initialise the active chart so the active card's chart request completes
    // (otherwise the API's chart endpoint for Visit B may not exist yet, causing
    // network noise that slows the test without affecting the assertion target).
    await ensureActiveChart(page);

    // Navigate to Visit A (historical, completed) by clicking the first Swiper
    // pagination bullet — Visit A is sorted first (oldest) so it lands at index 0.
    // Swiper renders clickable bullets with `swiper-pagination-bullet` class.
    const carousel = page.getByTestId('timeline-carousel');
    await expect(carousel).toBeVisible({ timeout: 15000 });
    const firstBullet = carousel.locator('.swiper-pagination-bullet').first();
    await expect(firstBullet).toBeVisible({ timeout: 10000 });
    await firstBullet.click();

    // After clicking the first bullet, Visit A's card becomes the active (centred)
    // slide and the previous Visit B card is no longer active. We identify the
    // historical card as the slide that carries `data-testid="chart-layer-key"`
    // (historical snapshots) rather than `chart-layer-toggle` (open/living card).
    // Using `not([data-active-card])` would also work, but the layer-key testid is
    // more semantically explicit and directly validates the UI element under test.
    //
    // Wait for the centred card to flip: after paging, Visit A becomes active
    // ([data-active-card="1"]) and its chart should load. Scope assertions to that
    // card to avoid matching the off-screen Visit B slide.
    await expect(activeCard).toBeVisible({ timeout: 15000 });

    // The historical card (now centred) must render the read-only layer key —
    // NOT the interactive layer-toggle group that appears only on the open card.
    const historicalCard = page.locator('[data-active-card="1"]');
    const layerKey = historicalCard.getByTestId('chart-layer-key');
    await expect(layerKey).toBeVisible({ timeout: 15000 });

    // The layer key spans baseline/proposed/completed (declined only when declined
    // work exists in that visit's snapshot, which Visit A doesn't have).
    await expect(layerKey).toContainText('Existing');
    await expect(layerKey).toContainText('Planned');
    // The 'completed' layer is labeled "Treated" in the UI (Phase-3 rename; the
    // underlying layer key stays 'completed').
    await expect(layerKey).toContainText('Treated');

    // Regression: before this slice, a historical card's per-visit snapshot would
    // fall back to `baseline` for every tooth (the cumulative cross-visit sets were
    // not applied, and perVisitLayers was ignored). Now, tooth 16 — which was
    // performed (crown placed) in Visit A — must carry `data-tooth-layer="completed"`
    // on Visit A's snapshot card, proving the per-visit layer is painted correctly.
    const tooth16InHistoricalCard = historicalCard.getByTestId(`tooth-${TOOTH_COMPLETED}`);
    await expect(tooth16InHistoricalCard).toHaveAttribute('data-tooth-layer', 'completed', { timeout: 15000 });
  });
});
