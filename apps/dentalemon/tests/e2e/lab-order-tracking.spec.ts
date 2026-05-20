/**
 * E2E: Lab Order Tracking — Journey J56
 *
 * Flow: sign up → create patient → open workspace → create visit →
 *       verify lab orders API is reachable → create lab order →
 *       advance to inFabrication → advance to delivered → advance to fitted
 *
 * This E2E tests the API integration portion of the lab order lifecycle.
 * The LabOrdersSheet UI component integrates with these same endpoints.
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function setupAndGetVisit(page: Page) {
  const suffix = Date.now();
  const email = `lab-e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  // Sign up
  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Lab Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially(password, { delay: 10 });
  await expect(pwInput).not.toHaveValue('');
  const signupResponse = page.waitForResponse(
    (resp: any) => /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
    { timeout: 10000 },
  ).catch(() => null);
  await page.getByRole('button', { name: /create an account/i }).click();
  const response = await signupResponse;
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up POST returned ${response.status()}: ${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

  // Create patient
  const patientRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: [{ use: 'official', family: 'Cruz', given: ['Pedro'] }],
        birthDate: '1978-11-22',
        gender: 'male',
      }),
    });
    return res.json();
  }, API);

  // Create visit
  const visitRes = await page.evaluate(async ({ api, patientId }) => {
    const res = await fetch(`${api}/dental/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        patientId,
        branchId: '00000000-0000-4000-8000-000000000001',
        dentistMemberId: '00000000-0000-4000-8000-000000000002',
      }),
    });
    return res.json();
  }, { api: API, patientId: patientRes.id });

  return { patientId: patientRes.id, visitId: visitRes.id };
}

test.describe('Lab Order Tracking (J56)', () => {
  test('can create a lab order for a visit', async ({ page }) => {
    const { visitId } = await setupAndGetVisit(page);

    const orderRes = await page.evaluate(async ({ api, visitId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/lab-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId,
          patientId: '00000000-0000-4000-8000-000000000010',
          labName: 'E2E Dental Lab',
          description: 'PFM Crown tooth 21',
        }),
      });
      return res.json();
    }, { api: API, visitId });

    expect(orderRes.id).toBeTruthy();
    expect(orderRes.status).toBe('ordered');
  });

  test('can advance lab order through full lifecycle', async ({ page }) => {
    const { visitId } = await setupAndGetVisit(page);

    // Create order
    const orderRes = await page.evaluate(async ({ api, visitId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/lab-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId,
          patientId: '00000000-0000-4000-8000-000000000010',
          labName: 'E2E Lab',
          description: 'Zirconia Crown',
        }),
      });
      return res.json();
    }, { api: API, visitId });

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
    const { visitId } = await setupAndGetVisit(page);

    const orderRes = await page.evaluate(async ({ api, visitId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/lab-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId,
          patientId: '00000000-0000-4000-8000-000000000010',
          labName: 'E2E Lab Skip',
          description: 'Test skip transition',
        }),
      });
      return res.json();
    }, { api: API, visitId });

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

    expect(status).toBe(400);
  });
});
