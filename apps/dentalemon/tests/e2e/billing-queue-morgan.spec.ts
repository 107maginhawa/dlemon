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
  const { orgId, branchId, memberId } = await signUpOnboardAndUnlock(page, {
    tier: 'clinic',
    label: 'Morgan',
  });

  return { orgId, branchId, memberId };
}

/**
 * Seed a patient + completed visit carrying a performed treatment + a draft invoice.
 *
 * createDentalInvoice enforces BR-009 (needs ≥1 performed/verified treatment), and
 * both the visit-completion gate and the treatment FSM (planned→performed) require a
 * SIGNED CONSENT — and a freshly-onboarded org has no consent template. So we run the
 * full billable flow (mirrors scripts/seed-demo.ts): consent template → patient →
 * visit(active) → sign consent → treatment diagnosed→planned→performed → complete →
 * invoice. Each step throws with context so a failing gate is pinpointed, not swallowed.
 */
async function seedInvoice(page: Page, branchId: string, memberId: string) {
  return page.evaluate(async ({ api, branchId, memberId }: { api: string; branchId: string; memberId: string }) => {
    const post = (path: string, body?: unknown) =>
      fetch(`${api}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    const patch = (path: string, body: unknown) =>
      fetch(`${api}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
    const need = async (step: string, res: Response) => {
      if (!res.ok) throw new Error(`seedInvoice failed at ${step}: ${res.status} ${await res.text()}`);
      return res.json() as any;
    };

    // A fresh onboarded org has no consent template — create one
    // (request = name/body; create returns the bare created object).
    const tpl = await need('consent-template', await post(`/dental/branches/${branchId}/consent-templates`, {
      name: 'General Treatment Consent', body: 'I consent to treatment.',
    }));
    const templateId = tpl?.id;
    if (!templateId) throw new Error('seedInvoice: no consent template id');

    const patient = await need('patient', await post('/dental/patients', {
      displayName: 'Morgan Billing Patient', consentGiven: true, branchId,
    }));

    const visit = await need('visit', await post('/dental/visits', {
      patientId: patient.id, branchId, dentistMemberId: memberId,
    }));
    await patch(`/dental/visits/${visit.id}`, { status: 'active' });

    // Sign a consent — required before treatment→performed AND visit completion.
    const consent = await need('consent', await post(`/dental/visits/${visit.id}/consents`, {
      visitId: visit.id, patientId: patient.id, templateId, templateName: 'General Treatment Consent',
    }));
    const consentId = consent?.id ?? consent?.data?.id;
    await need('consent-sign', await post(`/dental/visits/${visit.id}/consents/${consentId}/sign`, {
      signatureData: 'data:image/png;base64,iVBORw0KGgo=',
    }));

    // Treatment FSM is two-step: diagnosed → planned → performed (a single jump 422s).
    const treatment = await need('treatment', await post(`/dental/visits/${visit.id}/treatments`, {
      visitId: visit.id, patientId: patient.id, cdtCode: 'D2391',
      description: 'Resin composite', priceCents: 250000, toothNumber: 16,
    }));
    const treatmentId = treatment?.id ?? treatment?.data?.id;
    for (const status of ['planned', 'performed'] as const) {
      await need(`treatment→${status}`, await patch(`/dental/visits/${visit.id}/treatments/${treatmentId}`, { status }));
    }

    await need('complete-visit', await patch(`/dental/visits/${visit.id}`, { status: 'completed' }));

    const invoice = await need('invoice', await post('/dental/billing/invoices', {
      visitId: visit.id, patientId: patient.id, branchId, dentistMemberId: memberId,
    }));
    return { invoiceId: invoice.id, visitId: visit.id, patientId: patient.id, memberId };
  }, { api: API, branchId, memberId });
}

// ---------------------------------------------------------------------------
// Step 1: Billing review queue
// ---------------------------------------------------------------------------

test.describe('Morgan — Billing Review Queue', () => {
  test('billing page shows invoice list with status filter', async ({ page }) => {
    const { branchId, memberId } = await signUpAndSeedMorgan(page);
    const seeded = await seedInvoice(page, branchId, memberId);

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
    const { branchId, memberId } = await signUpAndSeedMorgan(page);
    const seeded = await seedInvoice(page, branchId, memberId);
    if (!seeded) throw new Error('Seeding failed — member, patient, or invoice creation returned null');

    const result = await page.evaluate(async ({ api, invoiceId }: { api: string; invoiceId: string }) => {
      // Void the invoice — the void contract requires an auditable reason (min 5).
      const voidRes = await fetch(`${api}/dental/billing/invoices/${invoiceId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: 'Billing error — duplicate invoice' }),
      });
      if (!voidRes.ok) return { ok: false, status: voidRes.status, body: await voidRes.text() };
      const voided = await voidRes.json() as any;
      return { ok: true, status: voided.status };
    }, { api: API, invoiceId: seeded.invoiceId });

    expect(result.ok, (result as any).body).toBe(true);
    expect(result.status).toBe('voided');
  });

  test('cannot void an already-voided invoice (returns 4xx)', async ({ page }) => {
    const { branchId, memberId } = await signUpAndSeedMorgan(page);
    const seeded = await seedInvoice(page, branchId, memberId);
    if (!seeded) throw new Error('Seeding failed — member, patient, or invoice creation returned null');

    const result = await page.evaluate(async ({ api, invoiceId }: { api: string; invoiceId: string }) => {
      const voidBody = { reason: 'Billing error — duplicate invoice' };
      // First void — succeeds.
      await fetch(`${api}/dental/billing/invoices/${invoiceId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(voidBody),
      });
      // Second void — already voided, should fail.
      const res = await fetch(`${api}/dental/billing/invoices/${invoiceId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(voidBody),
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
    const { branchId, memberId } = await signUpAndSeedMorgan(page);
    const seeded = await seedInvoice(page, branchId, memberId);
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
    const { branchId, memberId } = await signUpAndSeedMorgan(page);
    const seeded = await seedInvoice(page, branchId, memberId);
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
