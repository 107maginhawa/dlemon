/**
 * E2E: Clinical-Billing Handoff — Journey J37
 *
 * Flow: sign up -> seed org/branch/member -> create patient -> create visit ->
 *       activate -> add treatment -> complete visit -> create invoice ->
 *       verify line items -> record full payment -> verify invoice status = paid
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock } from './helpers/e2e-seed';

async function setup(page: Page) {
  // Provision org+branch+owner via /dental/onboarding (org creation is admin-only
  // — EM-ORG-002), set a PIN, and unlock the PIN-gated workspace.
  const { orgId, branchId, memberId } = await signUpOnboardAndUnlock(page, {
    tier: 'clinic',
    label: 'Handoff',
  });

  // Create patient via dental patients endpoint
  const patientRes = await page.evaluate(async ({ api, branchId }: { api: string; branchId: string }) => {
    const res = await fetch(`${api}/dental/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: 'Russel Herrera', branchId, consentGiven: true }),
    });
    if (!res.ok) throw new Error(`Patient create failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }, { api: API, branchId });

  return { patientId: patientRes.id, branchId, memberId, orgId };
}

async function createAndCompleteVisit(page: Page, patientId: string, branchId: string, memberId: string) {
  // Create visit
  const visitRes = await page.evaluate(async ({ api, patientId, branchId, memberId }) => {
    const res = await fetch(`${api}/dental/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        patientId,
        branchId,
        dentistMemberId: memberId,
      }),
    });
    return { status: res.status, body: await res.json() };
  }, { api: API, patientId, branchId, memberId });

  if (visitRes.status !== 201 && visitRes.status !== 200) {
    throw new Error(`Visit creation returned ${visitRes.status}: ${JSON.stringify(visitRes.body)}`);
  }
  const visitId = visitRes.body.id;

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
  const treatmentRes = await page.evaluate(async ({ api, visitId, patientId }) => {
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
    return { status: res.status, body: await res.json() };
  }, { api: API, visitId, patientId });

  if (treatmentRes.status !== 201 && treatmentRes.status !== 200) {
    throw new Error(`Treatment creation returned ${treatmentRes.status}: ${JSON.stringify(treatmentRes.body)}`);
  }
  const treatmentId = treatmentRes.body.id;

  // Transition: diagnosed -> planned -> performed
  const planRes = await page.evaluate(async ({ api, visitId, treatmentId }) => {
    const res = await fetch(`${api}/dental/visits/${visitId}/treatments/${treatmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'planned' }),
    });
    return { status: res.status, body: await res.json() };
  }, { api: API, visitId, treatmentId });

  if (planRes.status !== 200) {
    throw new Error(`Treatment plan transition returned ${planRes.status}: ${JSON.stringify(planRes.body)}`);
  }

  const patchRes = await page.evaluate(async ({ api, visitId, treatmentId }) => {
    const res = await fetch(`${api}/dental/visits/${visitId}/treatments/${treatmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'performed' }),
    });
    return { status: res.status, body: await res.json() };
  }, { api: API, visitId, treatmentId });

  if (patchRes.status !== 200) {
    throw new Error(`Treatment perform transition returned ${patchRes.status}: ${JSON.stringify(patchRes.body)}`);
  }

  // Complete
  const completeRes = await page.evaluate(async ({ api, visitId }) => {
    const res = await fetch(`${api}/dental/visits/${visitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'completed' }),
    });
    return { status: res.status, body: await res.json() };
  }, { api: API, visitId });

  if (completeRes.status !== 200) {
    throw new Error(`Visit complete returned ${completeRes.status}: ${JSON.stringify(completeRes.body)}`);
  }

  return visitId;
}

test.describe('Clinical-Billing Handoff', () => {
  test('completing a visit creates billable invoice', async ({ page }) => {
    const { patientId, branchId, memberId } = await setup(page);
    const visitId = await createAndCompleteVisit(page, patientId, branchId, memberId);

    // Create invoice from completed visit
    const invoiceRes = await page.evaluate(async ({ api, visitId, patientId, branchId, memberId }) => {
      const res = await fetch(`${api}/dental/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId,
          patientId,
          branchId,
          dentistMemberId: memberId,
        }),
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, visitId, patientId, branchId, memberId });

    if (invoiceRes.status !== 201) {
      throw new Error(`Invoice creation returned ${invoiceRes.status}: ${JSON.stringify(invoiceRes.body)}`);
    }
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
    const paymentRes = await page.evaluate(async ({ api, invoiceId, totalCents, memberId }) => {
      const res = await fetch(`${api}/dental/billing/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amountCents: totalCents,
          method: 'cash',
          receiptNumber: `R-${Date.now()}`,
          recordedByMemberId: memberId,
        }),
      });
      return res.status;
    }, { api: API, invoiceId, totalCents: invoice.totalCents, memberId });

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
