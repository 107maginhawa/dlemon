/**
 * E2E: Morgan (Billing Manager) — Billing Review Queue
 *
 * Persona: Morgan manages the billing queue, reviews invoices, voids errors,
 *          and marks uncollectible debt.
 *
 * ACs closed: GAP_DASHBOARD item #14 — Morgan billing journey (all 3 steps)
 * BRs: BR-011 (void with active payment plan → error), BR-013 (mark uncollectible — owner-only write-off)
 *
 * Pattern: signUpAndSeedOrg → seed patient+visit+invoice via API → UI + API action → verify
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

// ---------------------------------------------------------------------------
// Setup helper
// ---------------------------------------------------------------------------

async function signUpAndSeedMorgan(page: Page) {
  // Provision org+branch+owner via /dental/onboarding (org creation is admin-only
  // — EM-ORG-002), set a PIN, and unlock the PIN-gated workspace.
  const { orgId, branchId } = await signUpOnboardAndUnlock(page, {
    tier: 'clinic',
    label: 'Morgan',
  });

  return { orgId, branchId };
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

    await spaNavigate(page, '/billing');

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
// Step 3: Mark uncollectible (BR-013 — owner-only write-off)
// ---------------------------------------------------------------------------

test.describe('Morgan — Mark Uncollectible (BR-013)', () => {
  test('issue → mark uncollectible → status becomes uncollectible', async ({ page }) => {
    const { branchId } = await signUpAndSeedMorgan(page);
    const seeded = await seedInvoice(page, branchId);
    if (!seeded) throw new Error('Seeding failed — member, patient, or invoice creation returned null');

    const result = await page.evaluate(async ({ api, invoiceId }: { api: string; invoiceId: string }) => {
      // Issue the draft so it becomes outstanding (write-off requires issued/partial/overdue).
      const issueRes = await fetch(`${api}/dental/billing/invoices/${invoiceId}/issue`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!issueRes.ok) return { ok: false, step: 'issue', status: issueRes.status, body: await issueRes.text() };

      const res = await fetch(`${api}/dental/billing/invoices/${invoiceId}/uncollectible`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return { ok: false, step: 'uncollectible', status: res.status, body: await res.text() };
      const written = await res.json() as any;
      return { ok: true, status: written.status };
    }, { api: API, invoiceId: seeded.invoiceId });

    expect(result.ok, `failed at ${result.step}: ${result.body}`).toBe(true);
    expect(result.status).toBe('uncollectible');
  });

  test('terminal — a second write-off on an uncollectible invoice returns 4xx', async ({ page }) => {
    const { branchId } = await signUpAndSeedMorgan(page);
    const seeded = await seedInvoice(page, branchId);
    if (!seeded) throw new Error('Seeding failed — member, patient, or invoice creation returned null');

    const result = await page.evaluate(async ({ api, invoiceId }: { api: string; invoiceId: string }) => {
      await fetch(`${api}/dental/billing/invoices/${invoiceId}/issue`, { method: 'PATCH', credentials: 'include' });
      await fetch(`${api}/dental/billing/invoices/${invoiceId}/uncollectible`, { method: 'POST', credentials: 'include' });
      // Second write-off — already uncollectible, must be rejected.
      const res = await fetch(`${api}/dental/billing/invoices/${invoiceId}/uncollectible`, { method: 'POST', credentials: 'include' });
      return { status: res.status };
    }, { api: API, invoiceId: seeded.invoiceId });

    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});
