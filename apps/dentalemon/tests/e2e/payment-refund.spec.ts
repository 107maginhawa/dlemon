/**
 * E2E: payment refund (BR-053, Phase 4.2b).
 *
 * Owner opens an invoice with a recorded payment, refunds it from the payment
 * row, and the refund form closes on success (POST /payments/:id/refund). The
 * atomic caps + refund-to-credit are integration-tested
 * (dental-billing.refunds.test.ts, 7 cases).
 */
import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

async function seedInvoiceWithPayment(page: Page, branchId: string, memberId: string): Promise<{ invoiceId: string; paymentId: string }> {
  const result = await page.evaluate(
    async ({ api, branchId, memberId }: { api: string; branchId: string; memberId: string }) => {
      const post = (path: string, body: unknown) =>
        fetch(`${api}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      const patch = (path: string, body: unknown) =>
        fetch(`${api}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });

      const patient = await (await post('/dental/patients', { displayName: 'Refund Test Patient', branchId, consentGiven: true })).json() as any;
      const visit = await (await post('/dental/visits', { patientId: patient.id, branchId, dentistMemberId: memberId })).json() as any;
      const visitId = visit.id;
      await patch(`/dental/visits/${visitId}`, { status: 'active' });
      const tpl = await (await post(`/dental/branches/${branchId}/consent-templates`, { name: 'General Treatment Consent', body: 'I consent.' })).json() as any;
      const con = await (await post(`/dental/visits/${visitId}/consents`, { visitId, patientId: patient.id, templateId: tpl?.id, templateName: 'General Treatment Consent' })).json() as any;
      const consentId = con?.consent?.id ?? con?.id;
      await post(`/dental/visits/${visitId}/consents/${consentId}/sign`, { signatureData: 'data:image/png;base64,iVBORw0KGgo=' });
      const treatment = await (await post(`/dental/visits/${visitId}/treatments`, { visitId, patientId: patient.id, cdtCode: 'D1110', description: 'Prophylaxis', toothNumber: 16, priceCents: 5000 })).json() as any;
      const treatmentId = treatment?.id ?? treatment?.data?.id;
      for (const status of ['planned', 'performed']) await patch(`/dental/visits/${visitId}/treatments/${treatmentId}`, { status });
      await patch(`/dental/visits/${visitId}`, { status: 'completed' });
      const invoice = await (await post('/dental/billing/invoices', { visitId, patientId: patient.id, branchId, dentistMemberId: memberId })).json() as any;
      const issueRes = await patch(`/dental/billing/invoices/${invoice.id}/issue`, {});
      if (!issueRes.ok) return { error: `issue ${issueRes.status}` };
      const payRes = await post(`/dental/billing/invoices/${invoice.id}/payments`, { amountCents: 5000, method: 'cash', receiptNumber: `R-${Date.now()}`, recordedByMemberId: memberId });
      if (!payRes.ok) return { error: `payment ${payRes.status}: ${(await payRes.text()).slice(0, 150)}` };
      const payment = await payRes.json() as any;
      return { invoiceId: invoice.id as string, paymentId: payment.id as string };
    },
    { api: API, branchId, memberId },
  );
  expect((result as any).error, `Seeding failed: ${(result as any)?.error}`).toBeUndefined();
  return { invoiceId: (result as any).invoiceId, paymentId: (result as any).paymentId };
}

test.describe('Payment refund (Phase 4.2)', () => {
  test('owner refunds a payment from the invoice detail', async ({ page }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'clinic', label: 'Refund' });
    const { invoiceId, paymentId } = await seedInvoiceWithPayment(page, branchId, memberId);

    await spaNavigate(page, '/billing');
    await page.getByTestId(`invoice-row-${invoiceId}`).click();
    await expect(page.getByTestId('invoice-detail')).toBeVisible({ timeout: 15000 });

    await page.getByTestId(`refund-payment-${paymentId}`).click();
    await expect(page.getByTestId('refund-payment-form')).toBeVisible();
    await page.getByTestId('refund-amount').fill('50');
    await page.getByTestId('refund-reason').fill('Treatment cancelled');
    await page.getByTestId('confirm-payment-refund').click();

    // On success the form closes (refundingPaymentId cleared).
    await expect(page.getByTestId('refund-payment-form')).toBeHidden({ timeout: 15000 });
  });
});
