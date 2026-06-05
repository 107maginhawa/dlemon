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
import { API, signUpOnboardAndUnlock } from './helpers/e2e-seed';
import { signVisitConsent } from './fixtures';

async function setup(page: Page) {
  // Provision org+branch+owner via /dental/onboarding (org creation is admin-only
  // — EM-ORG-002), set a PIN, and unlock the PIN-gated workspace.
  const { branchId, memberId } = await signUpOnboardAndUnlock(page, {
    tier: 'clinic',
    label: 'Plan',
  });

  // Create patient via the dental endpoint (real org/branch context).
  const patientRes = await page.evaluate(async ({ api, branchId }) => {
    const res = await fetch(`${api}/dental/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: 'Maria Santos', branchId, consentGiven: true }),
    });
    if (!res.ok) throw new Error(`Patient create failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }, { api: API, branchId });

  return { patientId: patientRes.id, branchId, memberId };
}

async function createAndCompleteVisit(page: Page, patientId: string, branchId: string, memberId: string) {
  // Create visit
  const visitRes = await page.evaluate(async ({ api, patientId, branchId, memberId }) => {
    const res = await fetch(`${api}/dental/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patientId, branchId, dentistMemberId: memberId }),
    });
    return res.json();
  }, { api: API, patientId, branchId, memberId });

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

  // Consent gate: performing a treatment / completing the visit requires a SIGNED consent.
  await signVisitConsent(page, { branchId, visitId, patientId });

  // Add treatment
  const treatmentId = await page.evaluate(async ({ api, visitId, patientId }) => {
    const res = await fetch(`${api}/dental/visits/${visitId}/treatments`, {
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
    const data = await res.json();
    return data.id;
  }, { api: API, visitId, patientId });

  // FSM is two-step: diagnosed → planned → performed.
  for (const status of ['planned', 'performed'] as const) {
    await page.evaluate(async ({ api, visitId, treatmentId, status }) => {
      return fetch(`${api}/dental/visits/${visitId}/treatments/${treatmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
    }, { api: API, visitId, treatmentId, status });
  }

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
    const { patientId, branchId, memberId } = await setup(page);
    const visitId = await createAndCompleteVisit(page, patientId, branchId, memberId);

    // Create invoice from visit
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

    expect(invoiceRes.status).toBe(201);
    const invoiceId = invoiceRes.body.id;

    // Issue invoice
    const issueRes = await page.evaluate(async ({ api, invoiceId }) => {
      const res = await fetch(`${api}/dental/billing/invoices/${invoiceId}/issue`, {
        method: 'PATCH',
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
    expect(planRes.body.status).toBe('on_track');
    expect(planRes.body.installments).toHaveLength(3);
  });

  test('BR-011: cannot void invoice with active payment plan (AC-PAY-03)', async ({ page }) => {
    const { patientId, branchId, memberId } = await setup(page);
    const visitId = await createAndCompleteVisit(page, patientId, branchId, memberId);

    // Create invoice
    const invoiceRes = await page.evaluate(
      async ({ api, visitId, patientId, branchId, memberId }) => {
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
      },
      { api: API, visitId, patientId, branchId, memberId },
    );
    expect(invoiceRes.status).toBe(201);
    const invoiceId = invoiceRes.body.id as string;

    // Issue invoice
    const issueStatus = await page.evaluate(
      async ({ api, invoiceId }) => {
        const res = await fetch(`${api}/dental/billing/invoices/${invoiceId}/issue`, {
          method: 'PATCH',
          credentials: 'include',
        });
        return res.status;
      },
      { api: API, invoiceId },
    );
    expect(issueStatus).toBe(200);

    // Create payment plan (locks the invoice from being voided)
    const planStatus = await page.evaluate(
      async ({ api, invoiceId, patientId }) => {
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
        return res.status;
      },
      { api: API, invoiceId, patientId },
    );
    expect(planStatus).toBe(201);

    // Attempt to void the invoice — must be rejected with ACTIVE_PAYMENT_PLAN error
    const voidRes = await page.evaluate(
      async ({ api, invoiceId }) => {
        const res = await fetch(`${api}/dental/billing/invoices/${invoiceId}/void`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason: 'Voiding for test purposes' }),
        });
        const body = await res.json().catch(() => ({}));
        return { status: res.status, body };
      },
      { api: API, invoiceId },
    );

    // BR-011: void must fail when active payment plan exists
    expect(voidRes.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(voidRes.body)).toContain('ACTIVE_PAYMENT_PLAN');
  });
});
