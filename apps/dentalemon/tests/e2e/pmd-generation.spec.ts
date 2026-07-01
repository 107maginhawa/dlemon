/**
 * E2E: PMD Generation — Journey
 *
 * Flow: sign up → onboard clinic → create patient → create visit → activate →
 *       add treatment → sign consent → perform → complete visit → generate PMD →
 *       verify PMD content
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 *
 * Notes on the test seeding (matches tests/e2e/invoice-detail.spec.ts):
 *  - Org creation is admin-only (EM-ORG-002); a fresh owner self-provisions via
 *    setupDentalOrg → /dental/onboarding (also mints a live PIN session).
 *  - The workspace is PIN-gated, so the FR12.6 UI test navigates with gotoApp
 *    (SPA pushState) — a hard page.goto would wipe the in-memory PIN session.
 *  - Marking a treatment `performed` and completing a visit are both gated behind
 *    a SIGNED consent (BR-006 / TREATMENT_CONSENT_REQUIRED). A fresh org has no
 *    template, so we create one, attach a consent, and sign it before performing.
 *  - Treatment FSM is diagnosed → planned → performed (two steps).
 */

import { test, expect, type Page } from '@playwright/test';
import { setupDentalOrg, createDentalPatient, gotoApp, API } from './fixtures';
import { enableWorkspaceFlags } from './helpers/feature-flags';

interface SeedCtx {
  patientId: string;
  branchId: string;
  memberId: string;
}

/** Sign up, onboard a clinic, and register a patient. Returns seed context. */
async function setup(page: Page, displayName = 'Jose Dela Cruz'): Promise<SeedCtx> {
  const { branchId, memberId } = await setupDentalOrg(page);
  const patientId = await createDentalPatient(page, { displayName, branchId });
  return { patientId, branchId, memberId };
}

/**
 * Create a visit, add a performed D2391 treatment (with signed consent), and
 * complete the visit. Returns the visitId. Throws with the failing call's
 * status/body so a swallowed 4xx surfaces precisely.
 */
async function createAndCompleteVisit(page: Page, ctx: SeedCtx): Promise<string> {
  // setupDentalOrg leaves the page on a freshly-landed /dashboard that may still
  // be settling its post-PIN redirect; let it quiesce so the seeding evaluate
  // isn't torn down mid-navigation ("Execution context was destroyed").
  await page.waitForLoadState('networkidle').catch(() => {});
  return page.evaluate(async ({ api, ctx }) => {
    // 1. Create visit
    const visitRes = await fetch(`${api}/dental/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patientId: ctx.patientId, branchId: ctx.branchId, dentistMemberId: ctx.memberId }),
    });
    if (!visitRes.ok) throw new Error(`Create visit: ${visitRes.status}: ${await visitRes.text()}`);
    const visit = await visitRes.json() as any;

    // 2. Activate
    const activateRes = await fetch(`${api}/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'active' }),
    });
    if (!activateRes.ok) throw new Error(`Activate visit: ${activateRes.status}: ${await activateRes.text()}`);

    // 3. Add treatment (D2391 — PMD content assertions expect this CDT code)
    const txRes = await fetch(`${api}/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        visitId: visit.id,
        patientId: ctx.patientId,
        cdtCode: 'D2391',
        description: 'Resin composite, one surface',
        toothNumber: 21,
        priceCents: 15000,
      }),
    });
    if (!txRes.ok) throw new Error(`Create treatment: ${txRes.status}: ${await txRes.text()}`);
    const tx = await txRes.json() as any;

    // diagnosed → planned (first FSM step)
    const planRes = await fetch(`${api}/dental/visits/${visit.id}/treatments/${tx.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'planned' }),
    });
    if (!planRes.ok) throw new Error(`Plan treatment: ${planRes.status}: ${await planRes.text()}`);

    // 3b. Create + sign a consent (gates performed + complete).
    const tplRes = await fetch(`${api}/dental/branches/${ctx.branchId}/consent-templates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ name: 'General Treatment Consent', body: 'I consent.' }),
    });
    if (!tplRes.ok) throw new Error(`Consent template: ${tplRes.status}: ${await tplRes.text()}`);
    const tplJson = await tplRes.json() as any;
    const templateId = tplJson?.id;
    const conRes = await fetch(`${api}/dental/visits/${visit.id}/consents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ visitId: visit.id, patientId: ctx.patientId, templateId, templateName: 'General Treatment Consent' }),
    });
    if (!conRes.ok) throw new Error(`Create consent: ${conRes.status}: ${await conRes.text()}`);
    const conJson = await conRes.json() as any;
    const consentId = conJson?.consent?.id ?? conJson?.id;
    const signRes = await fetch(`${api}/dental/visits/${visit.id}/consents/${consentId}/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ signatureData: 'data:image/png;base64,iVBORw0KGgo=' }),
    });
    if (!signRes.ok) throw new Error(`Sign consent: ${signRes.status}: ${await signRes.text()}`);

    // planned → performed (second FSM step, now consent-gated)
    const perfRes = await fetch(`${api}/dental/visits/${visit.id}/treatments/${tx.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'performed' }),
    });
    if (!perfRes.ok) throw new Error(`Perform treatment: ${perfRes.status}: ${await perfRes.text()}`);

    // 4. Complete visit
    const completeRes = await fetch(`${api}/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'completed' }),
    });
    if (!completeRes.ok) throw new Error(`Complete visit: ${completeRes.status}: ${await completeRes.text()}`);

    return visit.id as string;
  }, { api: API, ctx });
}

test.describe('FR12.6: Share PMD Button on Completed Visits', () => {
  test('Share PMD button appears on completed visit in workspace', async ({ page }) => {
    // Share PMD is v2 (workspace.pmd) — opt in before navigating.
    await enableWorkspaceFlags(page, 'workspace.pmd');
    const ctx = await setup(page, 'PMD Share Patient');
    await createAndCompleteVisit(page, ctx);

    // PIN-gated workspace: SPA-navigate, never hard reload (would wipe PIN session).
    await gotoApp(page, `/${ctx.patientId}`);

    // FR12.6: Share PMD button should be visible when a completed visit is selected
    await expect(page.getByTestId('share-pmd-btn')).toBeVisible({ timeout: 8000 });
  });
});

test.describe('PMD Generation', () => {
  test('can generate PMD from a completed visit', async ({ page }) => {
    const ctx = await setup(page, 'PMD Gen Patient');
    const visitId = await createAndCompleteVisit(page, ctx);

    const pmdRes = await page.evaluate(async ({ api, visitId, patientId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/pmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId }),
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, visitId, patientId: ctx.patientId });

    expect(pmdRes.status).toBe(201);
    expect(pmdRes.body.status).toBe('generated');
    expect(pmdRes.body.visitId).toBe(visitId);
    expect(pmdRes.body.checksum).toBeTruthy();
  });

  test('PMD content includes treatment data', async ({ page }) => {
    const ctx = await setup(page, 'PMD Content Patient');
    const visitId = await createAndCompleteVisit(page, ctx);

    const pmdRes = await page.evaluate(async ({ api, visitId, patientId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/pmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId }),
      });
      return res.json();
    }, { api: API, visitId, patientId: ctx.patientId });

    const content = JSON.parse(pmdRes.content);
    expect(Array.isArray(content.treatments)).toBe(true);
    expect(content.treatments.length).toBeGreaterThan(0);
    expect(content.treatments[0].cdtCode).toBe('D2391');
  });

  test('cannot generate PMD from a draft visit', async ({ page }) => {
    const ctx = await setup(page, 'PMD Draft Patient');

    const visitRes = await page.evaluate(async ({ api, ctx }) => {
      const res = await fetch(`${api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId: ctx.patientId, branchId: ctx.branchId, dentistMemberId: ctx.memberId }),
      });
      return res.json();
    }, { api: API, ctx });

    const res = await page.evaluate(async ({ api, visitId, patientId }) => {
      const r = await fetch(`${api}/dental/visits/${visitId}/pmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId }),
      });
      return { status: r.status, body: await r.text().catch(() => '') };
    }, { api: API, visitId: visitRes.id, patientId: ctx.patientId });

    // Generating a PMD from a draft (non-completed/locked) visit is rejected with
    // 422 VISIT_NOT_COMPLETED (contract drift: the endpoint moved off a bare 400).
    expect(res.status, `unexpected body: ${res.body}`).toBe(422);
  });

  test('can retrieve generated PMD by visitId', async ({ page }) => {
    const ctx = await setup(page, 'PMD Retrieve Patient');
    const visitId = await createAndCompleteVisit(page, ctx);

    // Generate
    await page.evaluate(async ({ api, visitId, patientId }) => {
      return fetch(`${api}/dental/visits/${visitId}/pmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId }),
      });
    }, { api: API, visitId, patientId: ctx.patientId });

    // Retrieve
    const getRes = await page.evaluate(async ({ api, visitId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/pmd`, {
        credentials: 'include',
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, visitId });

    expect(getRes.status).toBe(200);
    expect(getRes.body.visitId).toBe(visitId);
  });
});
