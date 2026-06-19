/**
 * E2E: file an insurance claim from the worklist (roadmap Phase 1b · sub-slice A).
 *
 * Seeds a patient with an insurance profile + an issued invoice, then drives the
 * worklist "New claim" flow (patient → payer → anchor invoice → file) live and
 * asserts the claim materialises in the worklist.
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

interface Seeded {
  patientId: string;
  insuranceProfileId: string;
  invoiceId: string;
}

async function seedClaimable(page: Page, branchId: string, memberId: string): Promise<Seeded> {
  const result = await page.evaluate(
    async ({ api, branchId, memberId }: { api: string; branchId: string; memberId: string }) => {
      const post = (path: string, body: unknown) =>
        fetch(`${api}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      const patch = (path: string, body: unknown) =>
        fetch(`${api}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });

      const patient = await (await post('/dental/patients', { displayName: 'Claimable Patient', branchId, consentGiven: true })).json() as any;
      const profile = await (await post(`/dental/patients/${patient.id}/insurance-profiles`, {
        insurerName: 'Maxicare', policyNumber: 'MX-2026-1', subscriberName: 'Claimable Patient', payerType: 'hmo',
      })).json() as any;

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

      return { patientId: patient.id, insuranceProfileId: profile.id, invoiceId: invoice.id };
    },
    { api: API, branchId, memberId },
  );

  expect((result as any).error, `Seeding failed: ${(result as any)?.error}`).toBeUndefined();
  return result as Seeded;
}

test.describe('Insurance claims: file a claim from the worklist (slice 1b.A)', () => {
  test('New claim → patient → payer → invoice → file → claim appears in worklist', async ({ page }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'clinic', label: 'Claim' });
    const seeded = await seedClaimable(page, branchId, memberId);

    await spaNavigate(page, '/billing');
    await page.getByRole('tab', { name: 'Insurance' }).click();
    await expect(page.getByTestId('claims-worklist')).toBeVisible();

    await page.getByTestId('new-claim-btn').click();
    await expect(page.getByTestId('claim-create')).toBeVisible();

    await page.getByTestId('claim-patient-search').fill('Claimable');
    await page.getByTestId(`claim-patient-opt-${seeded.patientId}`).click();
    await page.getByTestId(`claim-profile-opt-${seeded.insuranceProfileId}`).click();
    await page.getByTestId(`claim-invoice-opt-${seeded.invoiceId}`).click();

    const fileBtn = page.getByTestId('file-claim-btn');
    await expect(fileBtn).toBeEnabled();
    await fileBtn.click();

    // Sheet closes and the worklist now shows a claim (empty-state gone).
    await expect(page.getByTestId('claim-create')).toHaveCount(0);
    await expect(page.getByTestId('claims-empty')).toHaveCount(0);
    // A real claim row materialises (server-issued CLM- number) with the anchored
    // billed amount (₱50.00 = 5000¢ from the seeded treatment).
    await expect(page.getByTestId('claims-worklist')).toContainText('CLM-');
    await expect(page.getByTestId('claims-worklist')).toContainText('₱50.00');

    // Slice 1b.B — open the claim and verify its derived line breakdown (the
    // Prophylaxis line carried over from the anchor invoice).
    await page.getByTestId('claims-worklist').getByRole('button', { name: /CLM-/ }).first().click();
    await expect(page.getByTestId('claim-detail')).toBeVisible();
    await expect(page.getByTestId('claim-detail')).toContainText('D1110');
    await expect(page.getByTestId('claim-detail')).toContainText('Prophylaxis');

    // Slice 1b.C — add a line to the (draft) claim and verify it materialises.
    await page.getByTestId('add-line-cdt').fill('D0220');
    await page.getByTestId('add-line-description').fill('Periapical X-ray');
    await page.getByTestId('add-line-billed').fill('30.00');
    await page.getByTestId('add-line-submit').click();
    await expect(page.getByTestId('claim-detail')).toContainText('D0220');
    await expect(page.getByTestId('claim-detail')).toContainText('Periapical X-ray');

    // Slice 1b.D — estimate coverage for the claim's lines (read-only split).
    await page.getByTestId('estimate-coverage-btn').click();
    await expect(page.getByTestId('coverage-estimate')).toBeVisible();
    await expect(page.getByTestId('coverage-estimate')).toContainText('HMO covers');
  });
});
