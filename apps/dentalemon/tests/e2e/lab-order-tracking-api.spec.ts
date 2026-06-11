/**
 * E2E: Lab Order Tracking — API integration coverage (J56)
 *
 * HONEST NAMING (AHA dental-clinical FIX-003): this spec drives the lab-order
 * FSM through the real API via page.evaluate(fetch) — it does NOT exercise the
 * UI. It was previously named `lab-order-tracking.spec.ts` and read as a UI
 * journey, masking GAP-1 (the Lab top-bar button never rendered). The genuine
 * rendered-UI journey now lives in `lab-order-ui.spec.ts`; this file is retained
 * as honest backend/API-contract coverage of the BR-018 lifecycle.
 *
 * Flow (all via API): sign up → create patient → create visit → create lab
 *       order → advance ordered → in_fabrication → delivered → fitted.
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock } from './helpers/e2e-seed';

async function setupAndGetVisit(page: Page) {
  // Provision org+branch+owner via /dental/onboarding (org creation is admin-only
  // — EM-ORG-002), set a PIN, and unlock the PIN-gated workspace.
  const { branchId, memberId } = await signUpOnboardAndUnlock(page, {
    tier: 'clinic',
    label: 'Lab',
  });

  // Create patient via the dental endpoint (real org/branch context).
  const patientRes = await page.evaluate(async ({ api, branchId }) => {
    const res = await fetch(`${api}/dental/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: 'Pedro Cruz', branchId, consentGiven: true }),
    });
    if (!res.ok) throw new Error(`Patient create failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }, { api: API, branchId });

  // Create visit
  const visitRes = await page.evaluate(async ({ api, patientId, branchId, memberId }) => {
    const res = await fetch(`${api}/dental/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patientId, branchId, dentistMemberId: memberId }),
    });
    return res.json();
  }, { api: API, patientId: patientRes.id, branchId, memberId });

  return { patientId: patientRes.id, visitId: visitRes.id };
}

// @BR-018 lab order lifecycle ordered → in_fabrication → delivered → fitted
//   (forward transitions driven end-to-end against the real API below; the
//    backward-transition rejection is covered in api-error-paths.spec.ts)
test.describe('Lab Order Tracking (J56)', () => {
  test('can create a lab order for a visit', async ({ page }) => {
    const { visitId, patientId } = await setupAndGetVisit(page);

    const orderRes = await page.evaluate(async ({ api, visitId, patientId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/lab-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId,
          patientId,
          labName: 'E2E Dental Lab',
          description: 'PFM Crown tooth 21',
        }),
      });
      return res.json();
    }, { api: API, visitId, patientId });

    expect(orderRes.id).toBeTruthy();
    expect(orderRes.status).toBe('ordered');
  });

  test('can advance lab order through full lifecycle', async ({ page }) => {
    const { visitId, patientId } = await setupAndGetVisit(page);

    // Create order
    const orderRes = await page.evaluate(async ({ api, visitId, patientId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/lab-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId,
          patientId,
          labName: 'E2E Lab',
          description: 'Zirconia Crown',
        }),
      });
      return res.json();
    }, { api: API, visitId, patientId });

    const orderId = orderRes.id;

    // ordered → inFabrication
    const inFab = await page.evaluate(async ({ api, visitId, orderId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/lab-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'in_fabrication' }),
      });
      return res.json();
    }, { api: API, visitId, orderId });
    expect(inFab.status).toBe('in_fabrication');

    // inFabrication → delivered
    const delivered = await page.evaluate(async ({ api, visitId, orderId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/lab-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'delivered' }),
      });
      return res.json();
    }, { api: API, visitId, orderId });
    expect(delivered.status).toBe('delivered');
    expect(delivered.deliveredAt).toBeTruthy();

    // delivered → fitted
    const fitted = await page.evaluate(async ({ api, visitId, orderId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/lab-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'fitted' }),
      });
      return res.json();
    }, { api: API, visitId, orderId });
    expect(fitted.status).toBe('fitted');
    expect(fitted.fittedAt).toBeTruthy();
  });

  test('invalid transition is rejected with 400', async ({ page }) => {
    const { visitId, patientId } = await setupAndGetVisit(page);

    const orderRes = await page.evaluate(async ({ api, visitId, patientId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/lab-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId,
          patientId,
          labName: 'E2E Lab Skip',
          description: 'Test skip transition',
        }),
      });
      return res.json();
    }, { api: API, visitId, patientId });

    // ordered → fitted (skip) should be rejected
    const status = await page.evaluate(async ({ api, visitId, orderId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/lab-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'fitted' }),
      });
      return res.status;
    }, { api: API, visitId, orderId: orderRes.id });

    // Invalid FSM transition is rejected (400 Bad Request / 422 Unprocessable).
    expect([400, 422]).toContain(status);
  });
});
