/**
 * E2E: patient credit ledger (Phase 4.1).
 *
 * From the patient-profile Payment tab: add a credit (balance updates), then
 * apply it against the outstanding invoice (BR-052). The atomic caps are
 * integration-tested (dental-billing.patient-credits.test.ts, 7 cases).
 */
import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

async function seedPatientWithIssuedInvoice(page: Page, branchId: string, memberId: string): Promise<{ patientId: string }> {
  const result = await page.evaluate(
    async ({ api, branchId, memberId }: { api: string; branchId: string; memberId: string }) => {
      const post = (path: string, body: unknown) =>
        fetch(`${api}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      const patch = (path: string, body: unknown) =>
        fetch(`${api}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });

      const patient = await (await post('/dental/patients', { displayName: 'Credit Test Patient', branchId, consentGiven: true })).json() as any;
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
      return { patientId: patient.id as string };
    },
    { api: API, branchId, memberId },
  );
  expect((result as any).error, `Seeding failed: ${(result as any)?.error}`).toBeUndefined();
  return { patientId: (result as any).patientId };
}

test.describe('Patient credit ledger (Phase 4.1)', () => {
  test('add a credit, then apply it to the outstanding invoice', async ({ page }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'clinic', label: 'Credit' });
    const { patientId } = await seedPatientWithIssuedInvoice(page, branchId, memberId);

    await spaNavigate(page, `/patients/${patientId}`);
    await page.getByTestId('tab-payment').click();
    await expect(page.getByTestId('patient-credits')).toBeVisible({ timeout: 15000 });

    // Add ₱100 credit.
    await page.getByTestId('add-credit-amount').fill('100');
    await page.getByTestId('add-credit-btn').click();
    await expect(page.getByTestId('patient-credit-balance')).toContainText('100', { timeout: 15000 });

    // Apply ₱50 against the ₱50 invoice → leaves ₱50 credit, no error.
    await page.getByTestId('apply-credit-amount').fill('50');
    await page.getByTestId('apply-credit-btn').click();
    await expect(page.getByTestId('patient-credit-balance')).toContainText('50', { timeout: 15000 });
    await expect(page.getByTestId('apply-credit-error')).toHaveCount(0);
  });
});
