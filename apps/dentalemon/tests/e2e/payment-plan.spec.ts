/**
 * E2E: Payment Plan — Journey J5
 *
 * Flow: sign up -> create patient -> create visit -> activate -> add treatment ->
 *       complete visit -> create invoice -> issue -> create payment plan ->
 *       verify plan status and installments
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function setup(page: Page) {
  const suffix = Date.now();

  // Sign up
  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Plan Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(`plan-e2e-${suffix}@example.org`);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially('E2eTestPass123!', { delay: 10 });
  await expect(pwInput).not.toHaveValue('');
  const signupResponse = page.waitForResponse(
    (resp: any) => /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
    { timeout: 10000 },
  ).catch(() => null);
  await page.getByRole('button', { name: /create an account/i }).click();
  const response = await signupResponse;
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up POST returned \${response.status()}: \${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

  // Create patient
  const patientRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: [{ use: 'official', family: 'Santos', given: ['Maria'] }],
        birthDate: '1985-03-15',
        gender: 'female',
      }),
    });
    return res.json();
  }, API);

  return { patientId: patientRes.id };
}

async function createAndCompleteVisit(page: Page, patientId: string) {
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
  }, { api: API, patientId });

  const visitId = visitRes.id;

  // Activate
  await page.evaluate(async ({ api, visitId }) => {
    return fetch(`${api}/dental/visits/${visitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'active' }),
    });
  }, { api: API, visitId });

  // Add treatment
  await page.evaluate(async ({ api, visitId, patientId }) => {
    return fetch(`${api}/dental/visits/${visitId}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        visitId,
        patientId,
        cdtCode: 'D2710',
        description: 'Crown (PFM)',
        toothNumber: 36,
        priceCents: 6000000,
      }),
    });
  }, { api: API, visitId, patientId });

  // Complete
  await page.evaluate(async ({ api, visitId }) => {
    return fetch(`${api}/dental/visits/${visitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'completed' }),
    });
  }, { api: API, visitId });

  return visitId;
}

test.describe('Payment Plan', () => {
  test('can create payment plan for an invoice', async ({ page }) => {
    const { patientId } = await setup(page);
    const visitId = await createAndCompleteVisit(page, patientId);

    // Create invoice from visit
    const invoiceRes = await page.evaluate(async ({ api, visitId, patientId }) => {
      const res = await fetch(`${api}/dental/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId }),
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, visitId, patientId });

    expect(invoiceRes.status).toBe(201);
    const invoiceId = invoiceRes.body.id;

    // Issue invoice
    const issueRes = await page.evaluate(async ({ api, invoiceId }) => {
      const res = await fetch(`${api}/dental/billing/invoices/${invoiceId}/issue`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.status;
    }, { api: API, invoiceId });

    expect(issueRes).toBe(200);

    // Create payment plan (3 monthly installments)
    const planRes = await page.evaluate(async ({ api, invoiceId, patientId }) => {
      const res = await fetch(`${api}/dental/billing/invoices/${invoiceId}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId,
          frequency: 'monthly',
          numberOfInstallments: 3,
          startDate: new Date().toISOString(),
        }),
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, invoiceId, patientId });

    expect(planRes.status).toBe(201);
    expect(planRes.body.status).toBe('onTrack');
    expect(planRes.body.installments).toHaveLength(3);
  });
});
