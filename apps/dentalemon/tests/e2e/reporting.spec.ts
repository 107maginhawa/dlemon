/**
 * E2E: Reporting
 *
 * ACs covered: AC-REPORT-01
 */

import { test, expect, type Page } from '@playwright/test';
import { setupDentalOrg, gotoApp } from './fixtures';
import { API } from './helpers/e2e-seed';

const APP = 'http://localhost:3003';

/**
 * Seed a fully-billed visit so the Revenue Report has a real invoice to render.
 * Returns the invoice number (INV-YYYY-XXXXXXXX) the report should display.
 *
 * Mirrors the billing-spec chain: patient → visit → activate → signed consent →
 * treatment (diagnosed→planned→performed) → complete visit → invoice.
 */
async function seedBilledInvoice(
  page: Page,
  opts: { branchId: string; memberId: string },
): Promise<string> {
  const result = await page.evaluate(async ({ api, branchId, memberId }) => {
    const patientRes = await fetch(`${api}/dental/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: 'Report Revenue Patient', branchId, consentGiven: true }),
    });
    if (!patientRes.ok) return { error: `patient ${patientRes.status}: ${(await patientRes.text()).slice(0, 200)}` };
    const patient = await patientRes.json() as { id: string };

    const visitRes = await fetch(`${api}/dental/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patientId: patient.id, branchId, dentistMemberId: memberId }),
    });
    if (!visitRes.ok) return { error: `visit ${visitRes.status}: ${(await visitRes.text()).slice(0, 200)}` };
    const visit = await visitRes.json() as { id: string };
    const visitId = visit.id;

    await fetch(`${api}/dental/visits/${visitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'active' }),
    });

    // Consent gate: performing a treatment + completing the visit needs a SIGNED consent.
    const tplRes = await fetch(`${api}/dental/branches/${branchId}/consent-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'General Treatment Consent', body: 'I consent.' }),
    });
    const tplJson = await tplRes.json() as { id?: string };
    const templateId = tplJson?.id;
    const conRes = await fetch(`${api}/dental/visits/${visitId}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ visitId, patientId: patient.id, templateId, templateName: 'General Treatment Consent' }),
    });
    const conJson = await conRes.json() as { consent?: { id: string }; id?: string };
    const consentId = conJson?.consent?.id ?? conJson?.id;
    await fetch(`${api}/dental/visits/${visitId}/consents/${consentId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ signatureData: 'data:image/png;base64,iVBORw0KGgo=' }),
    });

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
    const treatment = await treatRes.json() as { id?: string; data?: { id: string } };
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

    await fetch(`${api}/dental/visits/${visitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'completed' }),
    });

    const invoiceRes = await fetch(`${api}/dental/billing/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ visitId, patientId: patient.id, branchId, dentistMemberId: memberId }),
    });
    if (!invoiceRes.ok) return { error: `invoice ${invoiceRes.status}: ${(await invoiceRes.text()).slice(0, 200)}` };
    const invoice = await invoiceRes.json() as { invoiceNumber: string };
    return { invoiceNumber: invoice.invoiceNumber };
  }, { api: API, branchId: opts.branchId, memberId: opts.memberId });

  if ('error' in result) throw new Error(`Invoice seeding failed: ${result.error}`);
  return result.invoiceNumber;
}

// ─── AC-REPORT-01: Reports page renders the revenue report with real data ─────

test.describe('Reporting: Revenue report renders seeded data (AC-REPORT-01)', () => {
  test('navigating to /reports shows the Revenue Report with the seeded invoice', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);

    // Seed a real billed invoice so the report has content to render. Without this,
    // the report's empty state ("No invoices for this period") would pass any
    // chrome-only smoke check — which is exactly how the old /reports/daily phantom
    // test (a route that does not exist) asserted nothing real.
    const invoiceNumber = await seedBilledInvoice(page, { branchId, memberId });

    await gotoApp(page, `/reports`);
    await page.waitForLoadState('networkidle');

    // Must not show a server error
    await expect(page.locator('body')).not.toContainText('500');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');

    // The Revenue tab is the default — its heading must render.
    await expect(page.getByRole('heading', { name: /revenue report/i })).toBeVisible();

    // The seeded invoice must appear in the Invoices table. If the billing-invoices
    // query (which requires branchId) breaks or returns empty, the report shows
    // "No invoices for this period" instead and this assertion fails.
    await expect(page.getByText(invoiceNumber)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('No invoices for this period')).toHaveCount(0);
  });
});
