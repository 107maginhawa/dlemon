/**
 * E2E: Workspace payment coherence — billable vs estimate (BR-009)
 *
 * The recurring "Create Invoice & Pay → 422" bug. The server invoices ONLY
 * performed|verified treatments (createDentalInvoice → NO_BILLABLE_TREATMENTS for
 * planned/diagnosed). This spec drives the REAL stack to prove the workspace payment
 * modal can never present an enabled Pay that 422s, and that a mixed visit bills only
 * the performed subset at the correct total.
 *
 * Two scenarios, real UI + real API:
 *   A. all-planned visit → footer routes to an ESTIMATE; the modal shows the estimate
 *      and NO "Create Invoice & Pay" button (no dead-end).
 *   B. mixed visit (1 performed + 1 planned) → footer "Continue to Payment (1)"; the
 *      modal's payable Subtotal = the performed item only; clicking Create Invoice &
 *      Pay creates an invoice whose total = the performed price (the planned item is
 *      NOT billed).
 *
 * Preconditions: API on :7213, app on :3003 (playwright.config webServer boots Vite;
 * the CI journey job boots api-ts). Self-provisions its own org — no seed coupling.
 */
import { test, expect, type Page } from '@playwright/test';
import { setupDentalOrg, createDentalPatient, signVisitConsent, gotoApp, API } from './fixtures';

async function apiPost(page: Page, path: string, body: unknown): Promise<any> {
  const res = await page.request.post(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    data: body,
  });
  if (!res.ok()) {
    throw new Error(`POST ${path} → ${res.status()}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  }
  return res.json();
}

async function apiPatch(page: Page, path: string, body: unknown): Promise<void> {
  const res = await page.request.patch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    data: body,
  });
  if (!res.ok()) {
    throw new Error(`PATCH ${path} → ${res.status()}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  }
}

/** Create an ACTIVE visit for a patient. */
async function createActiveVisit(
  page: Page,
  { patientId, branchId, memberId }: { patientId: string; branchId: string; memberId: string },
): Promise<string> {
  const visit = await apiPost(page, '/dental/visits', { patientId, branchId, dentistMemberId: memberId });
  await apiPatch(page, `/dental/visits/${visit.id}`, { status: 'active' });
  return visit.id as string;
}

/** Create a treatment, optionally advancing it through the FSM to a target status. */
async function createTreatment(
  page: Page,
  args: {
    visitId: string;
    patientId: string;
    toothNumber: number;
    priceCents: number;
    cdtCode: string;
    description: string;
    advanceTo?: 'planned' | 'performed';
  },
): Promise<string> {
  const tx = await apiPost(page, `/dental/visits/${args.visitId}/treatments`, {
    visitId: args.visitId,
    patientId: args.patientId,
    toothNumber: args.toothNumber,
    cdtCode: args.cdtCode,
    description: args.description,
    priceCents: args.priceCents,
  });
  // FSM: diagnosed → planned → performed (one step at a time; a jump is 422).
  if (args.advanceTo === 'planned' || args.advanceTo === 'performed') {
    await apiPatch(page, `/dental/visits/${args.visitId}/treatments/${tx.id}`, { status: 'planned' });
  }
  if (args.advanceTo === 'performed') {
    await apiPatch(page, `/dental/visits/${args.visitId}/treatments/${tx.id}`, { status: 'performed' });
  }
  return tx.id as string;
}

test.describe('Workspace payment coherence (BR-009: billable = performed|verified)', () => {
  test('all-planned visit: footer routes to an estimate, modal has NO 422-reachable Pay', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, { displayName: 'All Planned Patient', branchId });
    const visitId = await createActiveVisit(page, { patientId, branchId, memberId });

    // Two PLANNED treatments — nothing billable (the screenshot scenario).
    await createTreatment(page, {
      visitId, patientId, toothNumber: 17, priceCents: 450000, cdtCode: 'D2330',
      description: 'Resin composite', advanceTo: 'planned',
    });
    await createTreatment(page, {
      visitId, patientId, toothNumber: 28, priceCents: 80000, cdtCode: 'D0120',
      description: 'Periodic oral evaluation', advanceTo: 'planned',
    });

    await gotoApp(page, `/${patientId}`);
    await page.waitForLoadState('networkidle');

    // Footer must NOT offer "Continue to Payment (N)" (nothing is payable) — it routes
    // to the estimate instead.
    const footerBtn = page.getByTestId('continue-to-payment-btn');
    await expect(footerBtn).toBeVisible({ timeout: 15000 });
    await expect(footerBtn).toHaveText(/estimate/i);
    await expect(footerBtn).not.toHaveText(/continue to payment/i);

    await footerBtn.click();
    const modal = page.getByTestId('workspace-payment-modal');
    await expect(modal).toBeVisible();

    // The bug: an enabled "Create Invoice & Pay" that 422s. It must not exist.
    await expect(page.getByTestId('create-invoice-btn')).toHaveCount(0);
    await expect(page.getByTestId('subtotal-row')).toHaveCount(0);
    // Instead: the estimate, a human explanation, and a clean exit.
    await expect(page.getByTestId('estimate-section')).toBeVisible();
    await expect(page.getByTestId('no-billable-note')).toBeVisible();
    await expect(page.getByTestId('estimate-done-btn')).toBeVisible();
  });

  test('mixed visit: payable subtotal + invoice total are the PERFORMED subset only', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, { displayName: 'Mixed Visit Patient', branchId });
    const visitId = await createActiveVisit(page, { patientId, branchId, memberId });

    // Signed consent is required to advance a treatment to `performed`.
    await signVisitConsent(page, { branchId, visitId, patientId });

    // One PERFORMED (₱120 — billable) + one PLANNED (₱80 — estimate only).
    await createTreatment(page, {
      visitId, patientId, toothNumber: 14, priceCents: 12000, cdtCode: 'D2391',
      description: 'Resin composite, one surface', advanceTo: 'performed',
    });
    await createTreatment(page, {
      visitId, patientId, toothNumber: 28, priceCents: 8000, cdtCode: 'D1110',
      description: 'Prophylaxis', advanceTo: 'planned',
    });

    await gotoApp(page, `/${patientId}`);
    await page.waitForLoadState('networkidle');

    // Footer counts only the billable item.
    const footerBtn = page.getByTestId('continue-to-payment-btn');
    await expect(footerBtn).toBeVisible({ timeout: 15000 });
    await expect(footerBtn).toHaveText(/continue to payment \(1\)/i);

    await footerBtn.click();
    await expect(page.getByTestId('workspace-payment-modal')).toBeVisible();

    // Payable subtotal = the performed item only (₱120.00); the planned item is an estimate.
    await expect(page.getByTestId('subtotal-amount')).toHaveText(/120\.00/);
    await expect(page.getByTestId('estimate-section')).toBeVisible();

    // Create the invoice — must succeed (only the performed item bills, so no 422).
    const createPromise = page.waitForResponse(
      (r) => /\/dental\/billing\/invoices(\?|$)/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 15000 },
    );
    await page.getByTestId('create-invoice-btn').click();
    const createResp = await createPromise;
    expect(createResp.status(), 'Create-invoice POST must succeed (no NO_BILLABLE_TREATMENTS 422)').toBeLessThan(300);

    // Independent read: the invoice total is the performed price only (₱120 = 12000 cents),
    // never the ₱200 sum that the old "bill everything" path would have produced.
    const listResp = await page.request.get(
      `${API}/dental/billing/invoices?patientId=${patientId}&branchId=${branchId}`,
    );
    expect(listResp.ok()).toBe(true);
    const body = await listResp.json();
    const invoices: any[] = Array.isArray(body) ? body : (body.data ?? body.items ?? []);
    expect(invoices.length).toBeGreaterThan(0);
    const inv = invoices[0];
    expect(inv.totalCents).toBe(12000);
  });
});
