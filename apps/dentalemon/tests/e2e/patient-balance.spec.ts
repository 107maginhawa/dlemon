/**
 * E2E: Patient Profile — authoritative outstanding balance (roadmap slice 1.6)
 *
 * The Payment History tab's "Outstanding Balance" must equal the server-computed
 * GET /dental/billing/patients/:id/balance (outstandingBalanceCents), not a
 * client-side sum of the visible invoice rows. This walks a seeded issued invoice
 * live, opens the Payment tab, and pins the rendered figure to the endpoint value.
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

/** Seed patient → visit → consent → billable treatment → invoice (issued). */
async function seedPatientWithIssuedInvoice(
  page: Page,
  branchId: string,
  memberId: string,
): Promise<{ patientId: string }> {
  const result = await page.evaluate(
    async ({ api, branchId, memberId }: { api: string; branchId: string; memberId: string }) => {
      const post = (path: string, body: unknown) =>
        fetch(`${api}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      const patch = (path: string, body: unknown) =>
        fetch(`${api}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });

      const patient = await (await post('/dental/patients', { displayName: 'Balance Test Patient', branchId, consentGiven: true })).json() as any;
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
      const issueRes = await patch(`/dental/billing/invoices/${invoice.id}/issue`, {});
      if (!issueRes.ok) return { error: `issue ${issueRes.status}: ${(await issueRes.text()).slice(0, 200)}` };
      return { patientId: patient.id as string };
    },
    { api: API, branchId, memberId },
  );

  expect((result as any).error, `Seeding failed: ${(result as any)?.error}`).toBeUndefined();
  return { patientId: (result as any).patientId };
}

test.describe('Patient Profile: authoritative outstanding balance (slice 1.6)', () => {
  test('Payment tab balance equals GET /patients/:id/balance outstandingBalanceCents', async ({ page }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'clinic', label: 'Balance' });
    const { patientId } = await seedPatientWithIssuedInvoice(page, branchId, memberId);

    // The contract value the UI must mirror — read straight from the endpoint.
    const expected = await page.evaluate(
      async ({ api, patientId }: { api: string; patientId: string }) => {
        const r = await fetch(`${api}/dental/billing/patients/${patientId}/balance`, { credentials: 'include' });
        if (!r.ok) return { error: `balance ${r.status}` };
        const b = await r.json() as { outstandingBalanceCents: number };
        // Mirror the profile's formatCents (en-PH, minimumFractionDigits: 0).
        const pesos = (b.outstandingBalanceCents / 100).toLocaleString('en-PH', { minimumFractionDigits: 0 });
        return { cents: b.outstandingBalanceCents, display: pesos };
      },
      { api: API, patientId },
    );
    expect((expected as any).error, `balance endpoint failed: ${(expected as any)?.error}`).toBeUndefined();
    // Sanity: the seeded issued invoice leaves a non-zero balance (₱50.00 = 5000¢).
    expect((expected as any).cents).toBe(5000);

    await spaNavigate(page, `/patients/${patientId}`);
    await page.getByTestId('tab-payment').click();

    const balanceEl = page.getByTestId('patient-outstanding-balance');
    await expect(balanceEl).toBeVisible();
    await expect(balanceEl).toHaveText(`₱${(expected as any).display}`);
  });
});
