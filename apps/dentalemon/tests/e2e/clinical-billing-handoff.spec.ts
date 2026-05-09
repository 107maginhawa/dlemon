/**
 * E2E: Clinical-Billing Handoff — Journey J37
 *
 * Flow: sign up -> create patient -> create visit -> activate -> add treatment ->
 *       complete visit -> create invoice -> verify line items -> record full payment ->
 *       verify invoice status = paid
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
  await page.getByLabel('Name', { exact: true }).fill(`Handoff Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(`handoff-e2e-${suffix}@example.org`);
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
        name: [{ use: 'official', family: 'Herrera', given: ['Russel'] }],
        birthDate: '1990-08-20',
        gender: 'male',
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

  // Add treatment and mark as performed
  const treatmentId = await page.evaluate(async ({ api, visitId, patientId }) => {
    const res = await fetch(`${api}/dental/visits/${visitId}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        visitId,
        patientId,
        cdtCode: 'D2391',
        description: 'Composite Filling',
        toothNumber: 14,
        priceCents: 250000,
      }),
    });
    const data = await res.json();
    return data.id;
  }, { api: API, visitId, patientId });

  await page.evaluate(async ({ api, visitId, treatmentId }) => {
    return fetch(`${api}/dental/visits/${visitId}/treatments/${treatmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'performed' }),
    });
  }, { api: API, visitId, treatmentId });

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

test.describe('Clinical-Billing Handoff', () => {
  test('completing a visit creates billable invoice', async ({ page }) => {
    const { patientId } = await setup(page);
    const visitId = await createAndCompleteVisit(page, patientId);

    // Create invoice from completed visit
    const invoiceRes = await page.evaluate(async ({ api, visitId, patientId }) => {
      const res = await fetch(`${api}/dental/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId,
          patientId,
          branchId: '00000000-0000-4000-8000-000000000001',
          dentistMemberId: '00000000-0000-4000-8000-000000000002',
        }),
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, visitId, patientId });

    expect(invoiceRes.status).toBe(201);
    const invoice = invoiceRes.body;
    const invoiceId = invoice.id;

    // Verify invoice has line items matching treatment
    expect(invoice.lineItems).toBeDefined();
    expect(invoice.lineItems.length).toBeGreaterThan(0);

    const lineItem = invoice.lineItems[0];
    expect(lineItem.cdtCode).toBe('D2391');
    expect(lineItem.description).toBe('Composite Filling');

    // Issue invoice first
    await page.evaluate(async ({ api, invoiceId }) => {
      return fetch(`${api}/dental/billing/invoices/${invoiceId}/issue`, {
        method: 'POST',
        credentials: 'include',
      });
    }, { api: API, invoiceId });

    // Record full payment
    const paymentRes = await page.evaluate(async ({ api, invoiceId, totalCents }) => {
      const res = await fetch(`${api}/dental/billing/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amountCents: totalCents,
          method: 'cash',
          receiptNumber: `R-${Date.now()}`,
          recordedByMemberId: '00000000-0000-4000-8000-000000000002',
        }),
      });
      return res.status;
    }, { api: API, invoiceId, totalCents: invoice.totalCents });

    expect(paymentRes).toBe(201);

    // Verify invoice status = paid
    const updatedInvoice = await page.evaluate(async ({ api, invoiceId }) => {
      const res = await fetch(`${api}/dental/billing/invoices/${invoiceId}`, {
        credentials: 'include',
      });
      return res.json();
    }, { api: API, invoiceId });

    expect(updatedInvoice.status).toBe('paid');
  });
});
