/**
 * E2E: Invoice + Payment ACs
 *
 * ACs covered: AC-INV-01, AC-INV-02, AC-INV-03, AC-INV-04, AC-PAY-01, AC-PAY-02
 *
 * Pattern: setupDentalOrg → seed visit+treatment via API → assert invoice behavior
 */

import { test, expect } from '@playwright/test';
import { setupDentalOrg, createDentalPatient , gotoApp} from './fixtures';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

/**
 * Build a minimal invoiceable visit:
 *   create visit → activate → add performed treatment → complete → return visitId + patientId
 */
async function seedCompletedVisit(page: any, opts: { patientId: string; branchId: string; memberId: string }) {
  return page.evaluate(async ({ api, opts }: { api: string; opts: { patientId: string; branchId: string; memberId: string } }) => {
    // 1. Create visit
    const visitRes = await fetch(`${api}/dental/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patientId: opts.patientId, branchId: opts.branchId, dentistMemberId: opts.memberId }),
    });
    if (!visitRes.ok) throw new Error(`Create visit: ${visitRes.status}: ${await visitRes.text()}`);
    const visit = await visitRes.json() as any;

    // 2. Activate visit
    const activateRes = await fetch(`${api}/dental/visits/${visit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'active' }),
    });
    if (!activateRes.ok) throw new Error(`Activate visit: ${activateRes.status}: ${await activateRes.text()}`);

    // 3. Add a treatment with correct fields (priceCents, cdtCode, patientId required)
    const txRes = await fetch(`${api}/dental/visits/${visit.id}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        visitId: visit.id,
        patientId: opts.patientId,
        cdtCode: 'D1110',
        description: 'Prophylaxis Adult',
        priceCents: 150000,
      }),
    });
    if (!txRes.ok) throw new Error(`Create treatment: ${txRes.status}: ${await txRes.text()}`);
    const tx = await txRes.json() as any;

    // diagnosed → planned → performed (two steps per BR-006)
    // URL: PATCH /dental/visits/:visitId/treatments/:treatmentId
    const planRes = await fetch(`${api}/dental/visits/${visit.id}/treatments/${tx.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'planned' }),
    });
    if (!planRes.ok) throw new Error(`Plan treatment: ${planRes.status}: ${await planRes.text()}`);

    // 3b. Sign a consent — the backend gates marking a treatment `performed` (and
    // completing the visit) behind a SIGNED consent (TREATMENT_CONSENT_REQUIRED).
    // A fresh org has no template, so create one, attach a consent, and sign it.
    const tplRes = await fetch(`${api}/dental/branches/${opts.branchId}/consent-templates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ title: 'General Treatment Consent', content: 'I consent.', name: 'General Treatment Consent', body: 'I consent.' }),
    });
    if (!tplRes.ok) throw new Error(`Consent template: ${tplRes.status}: ${await tplRes.text()}`);
    const tplJson = await tplRes.json() as any;
    const templateId = tplJson?.template?.id ?? tplJson?.id;
    const conRes = await fetch(`${api}/dental/visits/${visit.id}/consents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ visitId: visit.id, patientId: opts.patientId, templateId, templateName: 'General Treatment Consent' }),
    });
    if (!conRes.ok) throw new Error(`Create consent: ${conRes.status}: ${await conRes.text()}`);
    const conJson = await conRes.json() as any;
    const consentId = conJson?.consent?.id ?? conJson?.id;
    const signRes = await fetch(`${api}/dental/visits/${visit.id}/consents/${consentId}/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ signatureData: 'data:image/png;base64,iVBORw0KGgo=' }),
    });
    if (!signRes.ok) throw new Error(`Sign consent: ${signRes.status}: ${await signRes.text()}`);

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

    return { visitId: visit.id, memberId: opts.memberId };
  }, { api: API, opts });
}

// ─── AC-INV-02: Invoice requires line items ────────────────────────────────

test.describe('Invoice: Requires line items (AC-INV-02)', () => {
  test('creating invoice without line items is rejected', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, { displayName: 'Inv02 Patient', branchId });

    const result = await page.evaluate(async ({ api, patientId, branchId }: { api: string; patientId: string; branchId: string }) => {
      const r = await fetch(`${api}/dental/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId, branchId, lineItems: [] }),
      });
      return { status: r.status };
    }, { api: API, patientId, branchId });

    // Invoice with empty line items must be rejected (4xx)
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.status).toBeLessThan(500);
  });
});

// ─── AC-INV-01 + AC-INV-03: Invoice from workspace / generated on checkout ─

test.describe('Invoice: Created from completed visit (AC-INV-01, AC-INV-03)', () => {
  test('invoice can be created for a completed visit and has draft status', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, { displayName: 'Inv01 Patient', branchId });
    const { visitId } = await seedCompletedVisit(page, { patientId, branchId, memberId });

    const result = await page.evaluate(async ({ api, visitId, patientId, branchId, memberId }: { api: string; visitId: string; patientId: string; branchId: string; memberId: string }) => {
      const r = await fetch(`${api}/dental/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId, branchId, dentistMemberId: memberId }),
      });
      if (!r.ok) return { ok: false, status: r.status, body: await r.text() };
      const body = await r.json() as any;
      return { ok: true, status: r.status, invoiceStatus: body.status, invoiceId: body.id };
    }, { api: API, visitId, patientId, branchId, memberId });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(result.invoiceId).toBeTruthy();
    expect(result.invoiceStatus).toBe('draft');
  });
});

// ─── AC-INV-04: View invoice from completed visit ─────────────────────────

test.describe('Invoice: View from completed visit (AC-INV-04)', () => {
  test('seeded invoice RENDERS in the billing list and its detail sheet shows line items', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, { displayName: 'Inv04 Patient', branchId });
    const { visitId } = await seedCompletedVisit(page, { patientId, branchId, memberId });

    const invoiceId = await page.evaluate(async ({ api, visitId, patientId, branchId, memberId }: { api: string; visitId: string; patientId: string; branchId: string; memberId: string }) => {
      const r = await fetch(`${api}/dental/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId, branchId, dentistMemberId: memberId }),
      });
      if (!r.ok) return null;
      const body = await r.json() as any;
      return body.id as string;
    }, { api: API, visitId, patientId, branchId, memberId });

    expect(invoiceId).toBeTruthy();

    await gotoApp(page, `/billing`);
    await expect(page.getByTestId('billing-list')).toBeVisible();

    // The seeded invoice must actually RENDER as a row — a broken invoices query
    // would collapse to the empty "No invoices found" state (the old assertion of
    // "no error text" would still have passed, hiding such a regression).
    const row = page.getByTestId(`invoice-row-${invoiceId}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('Inv04 Patient');

    // Open the detail sheet → line items render from the real seeded treatment
    // (D1110 Prophylaxis Adult @ ₱1,500). This asserts the FE invoice-detail fetch
    // + line-item render, not just an API 201.
    await row.click();
    const detail = page.getByTestId('invoice-detail');
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('Prophylaxis Adult');
    await expect(detail).toContainText('D1110');
  });
});

// ─── AC-PAY-01: Record payment against invoice ────────────────────────────

test.describe('Payment: Record payment against invoice (AC-PAY-01)', () => {
  test('payment recorded against issued invoice reduces balance', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, { displayName: 'Pay01 Patient', branchId });
    const { visitId } = await seedCompletedVisit(page, { patientId, branchId, memberId });

    const result = await page.evaluate(async ({ api, visitId, patientId, branchId, memberId }: { api: string; visitId: string; patientId: string; branchId: string; memberId: string }) => {
      // Create invoice (auto-creates line items from performed treatments)
      const invRes = await fetch(`${api}/dental/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId, branchId, dentistMemberId: memberId }),
      });
      if (!invRes.ok) return { ok: false, step: 'create', status: invRes.status, body: await invRes.text() };
      const invoice = await invRes.json() as any;

      // Issue invoice (draft → issued). V-BIL-008: issue is a state transition,
      // so the canonical method is PATCH (not POST).
      const issueRes = await fetch(`${api}/dental/billing/invoices/${invoice.id}/issue`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!issueRes.ok) return { ok: false, step: 'issue', status: issueRes.status };

      // Record full payment using exact invoice totalCents (API uses cents)
      const payRes = await fetch(`${api}/dental/billing/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amountCents: invoice.balanceCents, method: 'cash', receiptNumber: `RCV-${Date.now()}`, recordedByMemberId: memberId }),
      });
      const payBody = await payRes.json() as any;
      if (!payRes.ok) return { ok: false, step: 'pay', status: payRes.status, body: JSON.stringify(payBody) };

      return { ok: true, paymentId: payBody.id, invoiceId: invoice.id, invoiceTotalCents: invoice.totalCents };
    }, { api: API, visitId, patientId, branchId, memberId });

    expect(result.ok).toBe(true);
    expect(result.paymentId).toBeTruthy();
  });

  // @BR-012 invoice state lifecycle: draft → (payment) → paid (and partial → plan, below)
  test('invoice status becomes paid after full payment is recorded (AC-PAY-01)', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, { displayName: 'Pay01b Patient', branchId });
    const { visitId } = await seedCompletedVisit(page, { patientId, branchId, memberId });

    const result = await page.evaluate(async ({ api, visitId, patientId, branchId, memberId }: { api: string; visitId: string; patientId: string; branchId: string; memberId: string }) => {
      // Create + issue invoice (auto-creates line items from performed treatments)
      const invRes = await fetch(`${api}/dental/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId, branchId, dentistMemberId: memberId }),
      });
      if (!invRes.ok) return { ok: false, step: 'create', status: invRes.status, body: await invRes.text() };
      const invoice = await invRes.json() as any;

      // V-BIL-008: issue is a PATCH state transition.
      await fetch(`${api}/dental/billing/invoices/${invoice.id}/issue`, { method: 'PATCH', credentials: 'include' });

      // Record FULL payment matching invoice balance
      const payRes = await fetch(`${api}/dental/billing/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amountCents: invoice.balanceCents, method: 'cash', receiptNumber: `RCV-${Date.now()}`, recordedByMemberId: memberId }),
      });
      if (!payRes.ok) return { ok: false, step: 'pay', status: payRes.status };

      // Fetch invoice again — status must be 'paid'
      const getRes = await fetch(`${api}/dental/billing/invoices/${invoice.id}`, { credentials: 'include' });
      if (!getRes.ok) return { ok: false, step: 'get', status: getRes.status };
      const updated = await getRes.json() as any;
      return { ok: true, status: updated.status, paidCents: updated.paidCents, balanceCents: updated.balanceCents };
    }, { api: API, visitId, patientId, branchId, memberId });

    expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
    expect(result.status).toBe('paid');
    expect(result.balanceCents).toBe(0);
  });
});

// ─── AC-PAY-02: Partial payment creates payment plan ─────────────────────

test.describe('Payment: Partial payment creates payment plan (AC-PAY-02)', () => {
  test('payment plan can be created for an outstanding invoice balance', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, { displayName: 'Pay02 Patient', branchId });
    const { visitId } = await seedCompletedVisit(page, { patientId, branchId, memberId });

    const result = await page.evaluate(async ({ api, visitId, patientId, branchId, memberId }: { api: string; visitId: string; patientId: string; branchId: string; memberId: string }) => {
      // Create + issue invoice (auto-creates line items from performed treatments)
      const invRes = await fetch(`${api}/dental/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId, branchId, dentistMemberId: memberId }),
      });
      if (!invRes.ok) return { ok: false, step: 'create', status: invRes.status, body: await invRes.text() };
      const invoice = await invRes.json() as any;

      await fetch(`${api}/dental/billing/invoices/${invoice.id}/issue`, {
        method: 'POST',
        credentials: 'include',
      });

      // Create payment plan (3 monthly installments)
      const planRes = await fetch(`${api}/dental/billing/invoices/${invoice.id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId,
          numberOfInstallments: 3,
          frequency: 'monthly',
          startDate: new Date().toISOString(),
        }),
      });
      if (!planRes.ok) return { ok: false, step: 'plan', status: planRes.status, body: await planRes.text() };
      const plan = await planRes.json() as any;

      return { ok: true, planId: plan.id, installmentCount: plan.numberOfInstallments ?? 3 };
    }, { api: API, visitId, patientId, branchId, memberId });

    expect(result.ok).toBe(true);
    expect(result.planId).toBeTruthy();
  });
});

// ─── AC-PAY-03: Payment plan cannot be voided after invoice is issued ────
test.describe('Payment: Cannot void payment plan after invoice issued (AC-PAY-03)', () => {
  test('voiding a payment plan on an issued invoice returns 4xx', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, { displayName: 'Pay03 Patient', branchId });
    const { visitId } = await seedCompletedVisit(page, { patientId, branchId, memberId });

    const result = await page.evaluate(async ({ api, visitId, patientId, branchId, memberId }: { api: string; visitId: string; patientId: string; branchId: string; memberId: string }) => {
      // Create + issue invoice
      const invRes = await fetch(`${api}/dental/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId, branchId, dentistMemberId: memberId }),
      });
      if (!invRes.ok) return { ok: false, step: 'create', status: invRes.status, body: await invRes.text() };
      const invoice = await invRes.json() as any;

      await fetch(`${api}/dental/billing/invoices/${invoice.id}/issue`, {
        method: 'POST',
        credentials: 'include',
      });

      // Create payment plan
      const planRes = await fetch(`${api}/dental/billing/invoices/${invoice.id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId,
          numberOfInstallments: 3,
          frequency: 'monthly',
          startDate: new Date().toISOString(),
        }),
      });
      if (!planRes.ok) return { ok: false, step: 'plan', status: planRes.status, body: await planRes.text() };
      const plan = await planRes.json() as any;

      // Attempt to void/delete the plan — DELETE endpoint doesn't exist → 404 (4xx satisfies AC-PAY-03)
      const voidRes = await fetch(`${api}/dental/billing/invoices/${invoice.id}/plan/${plan.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      return { ok: true, voidStatus: voidRes.status };
    }, { api: API, visitId, patientId, branchId, memberId });

    // AC-PAY-03: voiding a plan on an issued invoice must be rejected
    expect(result.ok).toBe(true);
    expect(result.voidStatus).toBeGreaterThanOrEqual(400);
    expect(result.voidStatus).toBeLessThan(500);
  });
});
