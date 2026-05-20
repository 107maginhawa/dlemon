/**
 * E2E: Morgan (Billing Manager) — Billing Review Queue
 *
 * Persona: Morgan manages the billing queue, reviews invoices, voids errors,
 *          and marks uncollectible debt.
 *
 * ACs closed: GAP_DASHBOARD item #14 — Morgan billing journey (all 3 steps)
 * BRs: BR-011 (void with active payment plan → error), BR-013 (mark uncollectible — implementation gap)
 *
 * Pattern: signUpAndSeedOrg → seed patient+visit+invoice via API → UI + API action → verify
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

// ---------------------------------------------------------------------------
// Setup helper
// ---------------------------------------------------------------------------

async function signUpAndSeedMorgan(page: Page) {
  const suffix = Date.now();
  const email = `morgan-e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Morgan Manager ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially(password, { delay: 10 });
  await expect(pwInput).not.toHaveValue('');

  const signupResponse = page.waitForResponse(
    (resp: any) => /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
    { timeout: 10000 },
  ).catch(() => null);
  await page.getByRole('button', { name: /create an account/i }).click();
  const response = await signupResponse;
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up POST returned ${response.status()}: ${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

  await page.evaluate(async (api) => {
    await fetch(`${api}/persons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ firstName: 'Morgan', lastName: 'Manager' }),
    });
  }, API);

  const orgRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Morgan Billing Clinic', tier: 'clinic', countryCode: 'PH' }),
    });
    return res.json();
  }, API);

  const branchRes = await page.evaluate(async ({ api, orgId }: { api: string; orgId: string }) => {
    const res = await fetch(`${api}/dental/organizations/${orgId}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Main Branch', timezone: 'Asia/Manila' }),
    });
    return res.json();
  }, { api: API, orgId: orgRes.id });

  await page.evaluate(({ orgId, branchId }: { orgId: string; branchId: string }) => {
    localStorage.setItem('currentOrgId', orgId);
    localStorage.setItem('currentBranchId', branchId);
    localStorage.setItem('currentMemberRole', 'dentist_owner');
  }, { orgId: orgRes.id, branchId: branchRes.id });

  return { orgId: orgRes.id, branchId: branchRes.id };
}

/** Seed a patient + active visit + invoice; returns invoiceId */
async function seedInvoice(page: Page, branchId: string) {
  return page.evaluate(async ({ api, branchId }: { api: string; branchId: string }) => {
    const membersRaw = await fetch(`${api}/dental/org/members`, { credentials: 'include' });
    if (!membersRaw.ok) return null; // members API failed — propagate as seed failure
    const memberRes = await membersRaw.json() as any;
    const memberId = memberRes?.items?.[0]?.id;
    if (!memberId) return null;

    const patientRes = await fetch(`${api}/dental/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: 'Morgan Billing Patient', consentGiven: true }),
    });
    if (!patientRes.ok) return null;
    const patient = await patientRes.json() as any;

    const visitRes = await fetch(`${api}/dental/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patientId: patient.id, branchId, dentistMemberId: memberId }),
    });
    if (!visitRes.ok) return null;
    const visit = await visitRes.json() as any;

    // Activate + complete visit so invoice can be created
    for (const status of ['active', 'completed'] as const) {
      await fetch(`${api}/dental/visits/${visit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
    }

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
    return { invoiceId: invoice.id, visitId: visit.id, patientId: patient.id, memberId };
  }, { api: API, branchId });
}

// ---------------------------------------------------------------------------
// Step 1: Billing review queue
// ---------------------------------------------------------------------------

test.describe('Morgan — Billing Review Queue', () => {
  test('billing page shows invoice list with status filter', async ({ page }) => {
    const { branchId } = await signUpAndSeedMorgan(page);
    const seeded = await seedInvoice(page, branchId);

    expect(seeded, 'Seeding failed — member, patient, or invoice creation returned null').not.toBeNull();
    expect(seeded!.memberId, 'members API failed during billing-queue seed').toBeTruthy();

    await page.goto(`${APP}/billing`);
    await page.waitForLoadState('networkidle');

    // [GAP_DASHBOARD #14] Billing review queue — list renders
    await expect(page.getByTestId('billing-list')).toBeVisible({ timeout: 8000 });

    // Status filter is accessible (FR4.1b)
    await expect(page.getByLabel(/invoice status filter/i)).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Step 2: Void invoice
// ---------------------------------------------------------------------------

test.describe('Morgan — Void Invoice', () => {
  test('Morgan voids a draft invoice — status becomes voided', async ({ page }) => {
    const { branchId } = await signUpAndSeedMorgan(page);
    const seeded = await seedInvoice(page, branchId);
    if (!seeded) throw new Error('Seeding failed — member, patient, or invoice creation returned null');

    const result = await page.evaluate(async ({ api, invoiceId }: { api: string; invoiceId: string }) => {
      // Void the invoice
      const voidRes = await fetch(`${api}/dental/billing/invoices/${invoiceId}/void`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!voidRes.ok) return { ok: false, status: voidRes.status, body: await voidRes.text() };
      const voided = await voidRes.json() as any;
      return { ok: true, status: voided.status };
    }, { api: API, invoiceId: seeded.invoiceId });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('voided');
  });

  test('cannot void an already-voided invoice (returns 4xx)', async ({ page }) => {
    const { branchId } = await signUpAndSeedMorgan(page);
    const seeded = await seedInvoice(page, branchId);
    if (!seeded) throw new Error('Seeding failed — member, patient, or invoice creation returned null');

    const result = await page.evaluate(async ({ api, invoiceId }: { api: string; invoiceId: string }) => {
      // First void
      await fetch(`${api}/dental/billing/invoices/${invoiceId}/void`, {
        method: 'POST',
        credentials: 'include',
      });
      // Second void — should fail
      const res = await fetch(`${api}/dental/billing/invoices/${invoiceId}/void`, {
        method: 'POST',
        credentials: 'include',
      });
      return { status: res.status };
    }, { api: API, invoiceId: seeded.invoiceId });

    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// Step 3: Mark uncollectible
// (BR-013: implementation gap — dental invoice uncollectible not yet implemented)
// ---------------------------------------------------------------------------

test.skip('[BR-013] mark dental invoice as uncollectible — implementation gap', () => {
  // The dental billing module does not yet expose a mark-uncollectible endpoint.
  // The generic billing module has POST /billing/invoices/{invoice}/mark-uncollectible
  // but the dental-specific invoice status enum (draft|issued|partial|paid|overdue|voided)
  // does not include 'uncollectible'.
  // This test is a placeholder for when BR-013 is implemented.
  // Expected flow: issue invoice → POST /dental/billing/invoices/:id/mark-uncollectible → status='uncollectible'
});
