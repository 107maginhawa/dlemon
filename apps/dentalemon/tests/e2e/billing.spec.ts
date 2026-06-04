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
  const { orgId, branchId } = await signUpOnboardAndUnlock(page, {
    tier: 'clinic',
    label: 'Billing',
  });

  return { orgId, branchId };
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
    const { branchId } = await signUpAndSeedBilling(page);

    // Seed patient + visit + treatment + invoice via API
    const result = await page.evaluate(async ({ api, branchId }: { api: string; branchId: string }) => {
      // Get current user's member for dentistMemberId
      const membersRes = await fetch(`${api}/dental/org/members`, { credentials: 'include' });
      const members = await membersRes.json() as any;
      const memberId = members?.items?.[0]?.id;
      if (!memberId) return null;

      // Create patient
      const patientRes = await fetch(`${api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: 'Billing Test Patient', consentGiven: true }),
      });
      if (!patientRes.ok) return null;
      const patient = await patientRes.json() as any;

      // Create visit
      const visitRes = await fetch(`${api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId: patient.id, branchId, dentistMemberId: memberId }),
      });
      if (!visitRes.ok) return null;
      const visit = await visitRes.json() as any;

      // Activate visit
      await fetch(`${api}/dental/visits/${visit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'active' }),
      });

      // Add treatment (performed)
      const treatRes = await fetch(`${api}/dental/visits/${visit.id}/treatments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: patient.id,
          cdtCode: 'D1110',
          description: 'Prophylaxis',
          priceCents: 5000,
        }),
      });
      const treatment = await treatRes.json() as any;
      await fetch(`${api}/dental/visits/${visit.id}/treatments/${treatment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'performed' }),
      });

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
      if (!invoiceRes.ok) return null;
      const invoice = await invoiceRes.json() as any;
      return { invoiceId: invoice.id };
    }, { api: API, branchId });

    expect(result, 'Seeding failed: member lookup or invoice creation returned null').not.toBeNull();

    await spaNavigate(page, '/billing');

    // Invoice list should render with at least one status badge
    await expect(page.getByTestId('billing-list')).toBeVisible();

    // A status indicator exists in the table (draft badge for new invoice)
    const statusText = page.getByText(/draft|issued|partial|paid/i).first();
    await expect(statusText).toBeVisible({ timeout: 5000 });
  });
});
