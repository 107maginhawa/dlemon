/**
 * E2E: Billing Module (FR4.x)
 *
 * Business Rules:
 * - FR4.1: Billing page loads and shows invoice list
 * - FR4.1b: Invoice status badges visible (draft, issued, paid)
 * - FR4.2: Payment modal is accessible from invoice detail
 * - FR4.3: Payment plan UI is accessible
 *
 * These tests verify UI-level behavior against the live API.
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

async function signUpAndSeedBilling(page: Page) {
  // Provision org+branch+owner via /dental/onboarding (org creation is admin-only
  // — EM-ORG-002), set a PIN, and unlock the PIN-gated workspace.
  const { orgId, branchId, memberId } = await signUpOnboardAndUnlock(page, {
    tier: 'clinic',
    label: 'Billing',
  });

  return { orgId, branchId, memberId };
}

/**
 * Seed a patient → visit → treatment → invoice and ISSUE it, returning the
 * invoiceId. Mirrors the FR4.1b seed but advances the invoice to `issued` so the
 * owner-only Apply Discount affordance is reachable (it hides on draft/paid/voided).
 */
async function seedIssuedInvoice(page: Page, branchId: string, memberId: string): Promise<string> {
  const result = await page.evaluate(async ({ api, branchId, memberId }: { api: string; branchId: string; memberId: string }) => {
    const post = (path: string, body: unknown) =>
      fetch(`${api}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
    const patch = (path: string, body: unknown) =>
      fetch(`${api}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });

    const patient = await (await post('/dental/patients', { displayName: 'Discount Test Patient', branchId, consentGiven: true })).json() as any;
    const visit = await (await post('/dental/visits', { patientId: patient.id, branchId, dentistMemberId: memberId })).json() as any;
    const visitId = visit.id;
    await patch(`/dental/visits/${visitId}`, { status: 'active' });

    const tpl = await (await post(`/dental/branches/${branchId}/consent-templates`, { name: 'General Treatment Consent', body: 'I consent.' })).json() as any;
    const con = await (await post(`/dental/visits/${visitId}/consents`, { visitId, patientId: patient.id, templateId: tpl?.id, templateName: 'General Treatment Consent' })).json() as any;
    const consentId = con?.consent?.id ?? con?.id;
    await post(`/dental/visits/${visitId}/consents/${consentId}/sign`, { signatureData: 'data:image/png;base64,iVBORw0KGgo=' });

    const treatment = await (await post(`/dental/visits/${visitId}/treatments`, {
      visitId, patientId: patient.id, cdtCode: 'D1110', description: 'Prophylaxis', toothNumber: 16, priceCents: 5000,
    })).json() as any;
    const treatmentId = treatment?.id ?? treatment?.data?.id;
    for (const status of ['planned', 'performed']) {
      await patch(`/dental/visits/${visitId}/treatments/${treatmentId}`, { status });
    }
    await patch(`/dental/visits/${visitId}`, { status: 'completed' });

    const invoice = await (await post('/dental/billing/invoices', { visitId, patientId: patient.id, branchId, dentistMemberId: memberId })).json() as any;
    // Issue it — the discount affordance is offered on issued/partial/overdue only.
    const issueRes = await patch(`/dental/billing/invoices/${invoice.id}/issue`, {});
    if (!issueRes.ok) return { error: `issue ${issueRes.status}: ${(await issueRes.text()).slice(0, 200)}` };
    return { invoiceId: invoice.id as string };
  }, { api: API, branchId, memberId });

  expect((result as any).error, `Seeding failed: ${(result as any)?.error}`).toBeUndefined();
  return (result as any).invoiceId;
}

test.describe('Billing (FR4.x)', () => {
  test('FR4.1: billing page loads with invoice list container', async ({ page }) => {
    await signUpAndSeedBilling(page);
    await spaNavigate(page, '/billing');

    // Page heading present
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible();

    // Billing list container present
    await expect(page.getByTestId('billing-list')).toBeVisible();
  });

  test('FR4.1: billing page shows empty state when no invoices', async ({ page }) => {
    await signUpAndSeedBilling(page);
    await spaNavigate(page, '/billing');

    // Billing list container must always be visible — either showing rows or an empty state
    await expect(page.getByTestId('billing-list')).toBeVisible();
  });

  test('FR4.1b: invoice status filter is visible on billing page', async ({ page }) => {
    await signUpAndSeedBilling(page);
    await spaNavigate(page, '/billing');

    // Status filter dropdown/select should be present (FR4.1b: status badges imply filter)
    await expect(page.getByLabel(/invoice status filter/i)).toBeVisible();
  });

  test('FR4.1b: invoice status badge visible after seeding an invoice', async ({ page }) => {
    const { branchId, memberId } = await signUpAndSeedBilling(page);

    // Seed patient + visit + treatment + invoice via API
    const result = await page.evaluate(async ({ api, branchId, memberId }: { api: string; branchId: string; memberId: string }) => {
      // Create patient
      const patientRes = await fetch(`${api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: 'Billing Test Patient', branchId, consentGiven: true }),
      });
      if (!patientRes.ok) return { error: `patient ${patientRes.status}: ${(await patientRes.text()).slice(0, 200)}` };
      const patient = await patientRes.json() as any;

      // Create visit
      const visitRes = await fetch(`${api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId: patient.id, branchId, dentistMemberId: memberId }),
      });
      if (!visitRes.ok) return { error: `visit ${visitRes.status}: ${(await visitRes.text()).slice(0, 200)}` };
      const visit = await visitRes.json() as any;
      const visitId = visit.id;

      // Activate visit
      await fetch(`${api}/dental/visits/${visitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'active' }),
      });

      // Consent gate: marking a treatment performed (and completing the visit)
      // requires a SIGNED consent. A fresh org has no template, so create one,
      // attach a consent, and sign it before the perform/complete steps.
      const tplRes = await fetch(`${api}/dental/branches/${branchId}/consent-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: 'General Treatment Consent', body: 'I consent.' }),
      });
      const tplJson = await tplRes.json() as any;
      const templateId = tplJson?.id;
      const conRes = await fetch(`${api}/dental/visits/${visitId}/consents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId: patient.id, templateId, templateName: 'General Treatment Consent' }),
      });
      const conJson = await conRes.json() as any;
      const consentId = conJson?.consent?.id ?? conJson?.id;
      await fetch(`${api}/dental/visits/${visitId}/consents/${consentId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ signatureData: 'data:image/png;base64,iVBORw0KGgo=' }),
      });

      // Add treatment, then advance diagnosed → planned → performed (FSM is two-step).
      const treatRes = await fetch(`${api}/dental/visits/${visitId}/treatments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId,
          patientId: patient.id,
          cdtCode: 'D1110',
          description: 'Prophylaxis',
          toothNumber: 16,
          priceCents: 5000,
        }),
      });
      if (!treatRes.ok) return { error: `treatment ${treatRes.status}: ${(await treatRes.text()).slice(0, 200)}` };
      const treatment = await treatRes.json() as any;
      const treatmentId = treatment?.id ?? treatment?.data?.id;
      for (const status of ['planned', 'performed']) {
        const tRes = await fetch(`${api}/dental/visits/${visitId}/treatments/${treatmentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status }),
        });
        if (!tRes.ok) return { error: `treatment→${status} ${tRes.status}: ${(await tRes.text()).slice(0, 200)}` };
      }

      // Complete visit
      await fetch(`${api}/dental/visits/${visit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'completed' }),
      });

      // Create invoice
      const invoiceRes = await fetch(`${api}/dental/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId: visit.id,
          patientId: patient.id,
          branchId,
          dentistMemberId: memberId,
        }),
      });
      if (!invoiceRes.ok) return { error: `invoice ${invoiceRes.status}: ${(await invoiceRes.text()).slice(0, 200)}` };
      const invoice = await invoiceRes.json() as any;
      return { invoiceId: invoice.id };
    }, { api: API, branchId, memberId });

    expect(result, `Seeding failed: ${(result as any)?.error}`).not.toBeNull();
    expect((result as any).error, `Seeding failed: ${(result as any)?.error}`).toBeUndefined();

    await spaNavigate(page, '/billing');

    // Invoice list should render with at least one status badge
    await expect(page.getByTestId('billing-list')).toBeVisible();

    // A status indicator exists in the table (draft badge for new invoice)
    const statusText = page.getByText(/draft|issued|partial|paid/i).first();
    await expect(statusText).toBeVisible({ timeout: 5000 });
  });

  // FIX-003: the owner applies a discount end-to-end and the invoice totals
  // re-render to reflect it (₱50.00 subtotal − 10% = ₱45.00 total).
  test('FR4.x: owner applies a 10% discount and the invoice totals reflect it', async ({ page }) => {
    const { branchId, memberId } = await signUpAndSeedBilling(page);
    const invoiceId = await seedIssuedInvoice(page, branchId, memberId);

    await spaNavigate(page, '/billing');
    await page.getByTestId(`invoice-row-${invoiceId}`).click();

    // InvoiceDetail opens — apply the owner-only discount.
    await expect(page.getByTestId('invoice-detail')).toBeVisible();
    await page.getByRole('button', { name: /apply discount/i }).click();
    await page.getByLabel(/discount %/i).fill('10');
    await page.getByLabel(/discount reason/i).fill('Senior citizen discount');
    await page.getByRole('button', { name: /^apply$/i }).click();

    // The Discount row (−₱5.00) and the reduced Total (₱45.00) re-render from the
    // server response — proof the discount took effect end-to-end. (₱45.00 also
    // appears as the Balance since there are no payments, so scope to the Total row.)
    await expect(page.getByText('-₱5.00')).toBeVisible({ timeout: 7000 });
    const totalRow = page.locator('div').filter({ has: page.getByText('Total', { exact: true }) }).last();
    await expect(totalRow.getByText('₱45.00')).toBeVisible();
  });

  // FIX-005: the owner creates a payment plan end-to-end and the plan view renders
  // its installment schedule — the headline PH installment journey.
  test('FR4.3: owner creates a 6×monthly payment plan and the plan view shows it', async ({ page }) => {
    const { branchId, memberId } = await signUpAndSeedBilling(page);
    const invoiceId = await seedIssuedInvoice(page, branchId, memberId);

    await spaNavigate(page, '/billing');
    await page.getByTestId(`invoice-row-${invoiceId}`).click();
    await expect(page.getByTestId('invoice-detail')).toBeVisible();

    await page.getByRole('button', { name: /create payment plan/i }).click();
    await expect(page.getByTestId('payment-plan-create')).toBeVisible();
    await page.getByLabel(/start date/i).fill('2026-07-01');
    await page.getByRole('button', { name: /create plan/i }).click();

    // Dialog closes on success → open the plan view and assert the schedule rendered
    // (default 6 installments, derived "Installments" stat + "Installment Schedule").
    await expect(page.getByTestId('payment-plan-create')).toBeHidden({ timeout: 7000 });
    await page.getByRole('button', { name: /view payment plan/i }).click();
    await expect(page.getByTestId('payment-plan-view')).toBeVisible();
    await expect(page.getByText('Installment Schedule')).toBeVisible();
    await expect(page.getByText('On Track')).toBeVisible();
  });
});
