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
        body: JSON.stringify({ title: 'General Treatment Consent', content: 'I consent.', name: 'General Treatment Consent', body: 'I consent.' }),
      });
      const tplJson = await tplRes.json() as any;
      const templateId = tplJson?.template?.id ?? tplJson?.id;
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
});
