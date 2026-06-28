/**
 * E2E: estimate → deposit → pay → receipt → reconcile (billing §g).
 *
 * Proves the planned-only "Review Estimate" screen is no longer a dead-end: a
 * deposit is a real kind='deposit' invoice (born issued, due-on-receipt, NO
 * dueDate), payable now → BIR receipt, mirrored into the patient credit wallet,
 * then drawn down against the later performed-work invoice via the existing
 * apply-credit UI — with NO double-charge (one cash collection == the job total).
 *
 * Deliberate deviations from the task brief, and why:
 *  - Self-bootstraps a fresh org/patient/visit (signUpOnboardAndUnlock) instead of
 *    SQL-discovering a planned-only patient in the demo seed. Deterministic, no
 *    `db:reseed` coupling — the convention every other tests/e2e/*.spec.ts follows.
 *  - Sets the deposit to the FULL estimate via the "Full estimate" button (not by
 *    typing into the React-controlled number input, which silently de-syncs on a
 *    native value-set). Full deposit ⇒ estimate == job total, so the no-double-
 *    charge arithmetic is exact.
 *  - Post-payment "Paid"/receipt assertions go through an INDEPENDENT API read, not
 *    the open overlay, so the spec survives Task 3 (auto-close-on-paid).
 *
 * Precondition: API on :7213, app on :3003 (playwright.config webServer boots both).
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { API, APP, signUpOnboardAndUnlock, spaNavigate, unlockWorkspace } from './helpers/e2e-seed';
import { signVisitConsent } from './fixtures';

// One planned crown. estimate == performed-invoice total == job total.
const PRICE_CENTS = 250000; // ₱2,500.00
const PIN = '135790';

interface Seeded {
  patientId: string;
  visitId: string;
  treatmentId: string;
}

/**
 * Seed an ACTIVE visit with one PLANNED (never performed) treatment — the
 * planned-only estimate state that used to dead-end. No consent needed: consent
 * only gates planned→performed, and we stay planned here.
 */
async function seedPlannedOnlyVisit(page: Page, branchId: string, memberId: string): Promise<Seeded> {
  const out = await page.evaluate(
    async ({ api, branchId, memberId, price }) => {
      const post = (p: string, b: unknown) =>
        fetch(`${api}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(b) });
      const patch = (p: string, b: unknown) =>
        fetch(`${api}${p}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(b) });

      const patient = (await (await post('/dental/patients', { displayName: `Deposit Flow ${Date.now()}`, branchId, consentGiven: true })).json()) as { id: string };
      const visit = (await (await post('/dental/visits', { patientId: patient.id, branchId, dentistMemberId: memberId })).json()) as { id: string };
      await patch(`/dental/visits/${visit.id}`, { status: 'active' });
      const tx = (await (await post(`/dental/visits/${visit.id}/treatments`, {
        visitId: visit.id, patientId: patient.id, cdtCode: 'D2740', description: 'Crown - porcelain/ceramic', toothNumber: 14, priceCents: price,
      })).json()) as { id?: string; data?: { id: string } };
      const treatmentId = tx.id ?? tx.data?.id;
      // diagnosed (default) → planned. NOT performed → stays an estimate.
      await patch(`/dental/visits/${visit.id}/treatments/${treatmentId}`, { status: 'planned' });
      return { patientId: patient.id, visitId: visit.id, treatmentId };
    },
    { api: API, branchId, memberId, price: PRICE_CENTS },
  );
  if (!out.treatmentId) throw new Error('seedPlannedOnlyVisit: treatment carried no id');
  return out as Seeded;
}

/** Independent read of one invoice (shares the browser context's owner cookies). */
async function readInvoice(req: APIRequestContext, invoiceId: string) {
  const r = await req.get(`${API}/dental/billing/invoices/${invoiceId}`);
  if (!r.ok()) throw new Error(`GET invoice ${invoiceId} → ${r.status()}`);
  return r.json() as Promise<{
    id: string; kind?: string; status: string; totalCents: number; paidCents: number;
    balanceCents: number; dueDate: string | null;
    payments: Array<{ id: string; method: string; amountCents: number; isVoid?: boolean }>;
  }>;
}

test.describe('Estimate → deposit → pay → receipt → reconcile (§g)', () => {
  test('planned-only estimate is not a dead-end: collect a deposit, reconcile with no double-charge', async ({ page }) => {
    const req = page.request; // authenticated as the onboarded owner (shared cookies)

    // ── Arrange: fresh clinic + planned-only visit ──────────────────────────
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'clinic', label: 'Deposit', pin: PIN });
    const { patientId, visitId, treatmentId } = await seedPlannedOnlyVisit(page, branchId, memberId);

    // ── (a/b/c) Workspace footer: "Review Estimate", enabled (no dead-end) ──
    await spaNavigate(page, `/${patientId}`);
    await expect(page.getByTestId('workspace-carousel-zone')).toBeVisible({ timeout: 20000 });
    const footerCta = page.getByTestId('continue-to-payment-btn');
    await expect(footerCta).toBeEnabled();
    await expect(footerCta).toHaveText(/Review Estimate/);
    await footerCta.click();

    // ── (d) The deposit affordance is present and actionable, no dead control ─
    await expect(page.getByTestId('workspace-payment-modal')).toBeVisible();
    await expect(page.getByTestId('deposit-panel')).toBeVisible();
    await expect(page.getByTestId('deposit-amount-input')).toBeVisible();
    await expect(page.getByTestId('deposit-full-estimate-btn')).toBeVisible();
    const collectBtn = page.getByTestId('collect-deposit-btn');
    await expect(collectBtn).toBeEnabled();
    // No dead-disabled "Create Invoice & Pay" leftover on the estimate screen.
    await expect(page.getByTestId('create-invoice-btn')).toHaveCount(0);

    // Full estimate ⇒ deposit == job total (deterministic; dodges the controlled
    // number-input de-sync). CTA reflects the full amount.
    await page.getByTestId('deposit-full-estimate-btn').click();
    await expect(collectBtn).toContainText('2,500.00');
    await expect(collectBtn).toBeEnabled();

    // ── (e) Collect → InvoiceDetail on the kind='deposit' invoice: Issued, no Due Date ─
    // Capture the deposit invoice id from the sheet's own by-id GET (the invoice
    // LIST projects out kind for revenue-excluded deposits, so list-lookup can't
    // find it; the by-id GET carries the full row).
    const detailGet = page.waitForResponse(
      (r) => /\/dental\/billing\/invoices\/[0-9a-f-]{36}$/i.test(new URL(r.url()).pathname) && r.request().method() === 'GET' && r.status() === 200,
      { timeout: 15000 },
    );
    await collectBtn.click();
    const sheet = page.getByTestId('invoice-detail');
    await expect(sheet).toBeVisible({ timeout: 15000 });
    await expect(sheet).toContainText('Issued');
    await expect(sheet.getByText('Due Date', { exact: false })).toHaveCount(0);

    const depositInvoiceId = new URL((await detailGet).url()).pathname.split('/').pop() as string;
    const depBorn = await readInvoice(req, depositInvoiceId);
    expect(depBorn.kind).toBe('deposit');
    expect(depBorn.status).toBe('issued');
    expect(depBorn.dueDate ?? null).toBeNull(); // due-on-receipt, never overdue
    expect(depBorn.totalCents).toBe(PRICE_CENTS);

    // ── (f) Record full payment in the overlay → independent read confirms Paid ─
    await sheet.getByRole('button', { name: 'Record Payment' }).click();
    await page.locator('#pay-amount').fill('2500');
    await page.locator('#pay-receipt').fill(`R-DEP-${Date.now()}`);
    await sheet.getByRole('button', { name: 'Record', exact: true }).click();

    // Full payment auto-dismisses the sheet — the user lands back on the workspace
    // instead of stranding on a paid invoice.
    await expect(sheet).toHaveCount(0, { timeout: 15000 });

    // Paid via independent read (the sheet is gone; read durable truth).
    await expect.poll(async () => (await readInvoice(req, depositInvoiceId)).status, { timeout: 15000 }).toBe('paid');
    const depPaid = await readInvoice(req, depositInvoiceId);
    expect(depPaid.balanceCents).toBe(0);
    expect(depPaid.paidCents).toBe(PRICE_CENTS);

    // Receipt (BIR OR) is reachable for the recorded payment.
    const cashPmt = depPaid.payments.find((p) => p.method === 'cash' && !p.isVoid);
    expect(cashPmt, 'a non-void cash payment exists').toBeTruthy();
    const receiptRes = await req.get(`${API}/dental/billing/invoices/${depositInvoiceId}/payments/${cashPmt!.id}/receipt`);
    expect(receiptRes.ok()).toBe(true);

    // ── (g) Reconcile: perform the work, bill it, draw the deposit credit down ──
    // Setup (API): sign consent → planned→performed → create + issue the
    // performed-work invoice. The ACT under test (apply credit) is UI-driven below.
    await signVisitConsent(page, { branchId, visitId, patientId });
    const performedInvoiceId = await page.evaluate(
      async ({ api, visitId, patientId, branchId, memberId, treatmentId }) => {
        const post = (p: string, b: unknown) =>
          fetch(`${api}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(b) });
        const patch = (p: string, b?: unknown) =>
          fetch(`${api}${p}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: b === undefined ? undefined : JSON.stringify(b) });
        await patch(`/dental/visits/${visitId}/treatments/${treatmentId}`, { status: 'performed' });
        const inv = (await (await post('/dental/billing/invoices', { visitId, patientId, branchId, dentistMemberId: memberId })).json()) as { id: string };
        await patch(`/dental/billing/invoices/${inv.id}/issue`);
        return inv.id;
      },
      { api: API, visitId, patientId, branchId, memberId, treatmentId },
    );

    // Performed invoice is the job total, fully outstanding before reconciliation.
    const perfBefore = await readInvoice(req, performedInvoiceId);
    expect(perfBefore.totalCents).toBe(PRICE_CENTS);
    expect(perfBefore.balanceCents).toBe(PRICE_CENTS);

    // Patient profile → Payment tab. The workspace deposit flow warmed (and the
    // out-of-band performed-invoice write never invalidated) the patient invoice
    // LIST cache, so an SPA nav would serve stale list rows. Hard-reload to start
    // React Query cold, then re-unlock the PIN gate — the documented pattern.
    await page.goto(`${APP}/patients/${patientId}`);
    await unlockWorkspace(page, PIN);
    await spaNavigate(page, `/patients/${patientId}`);
    await page.getByTestId('tab-payment').click();
    await expect(page.getByTestId('patient-credits')).toBeVisible({ timeout: 15000 });
    // The deposit cash is now a credit (the mirror).
    await expect(page.getByTestId('patient-credit-balance')).toContainText('2,500', { timeout: 15000 });

    // Apply the full deposit credit against the PERFORMED-work invoice (UI act).
    // Target it explicitly — the paid deposit is excluded from the outstanding list.
    await page.getByTestId('apply-credit-invoice').selectOption(performedInvoiceId);
    await page.getByTestId('apply-credit-amount').fill('2500');
    await page.getByTestId('apply-credit-btn').click();
    await expect(page.getByTestId('patient-credit-balance')).toHaveText('₱0.00', { timeout: 15000 });
    await expect(page.getByTestId('apply-credit-error')).toHaveCount(0);

    // ── No double-charge: ONE cash collection == job total; performed invoice
    //    cleared by CREDIT, not a second cash charge. ─────────────────────────
    const perfAfter = await readInvoice(req, performedInvoiceId);
    expect(perfAfter.balanceCents).toBe(0); // reduced by the deposit credit…
    expect(perfAfter.payments.filter((p) => p.method === 'cash' && !p.isVoid)).toHaveLength(0); // …not re-charged in cash
    const depFinal = await readInvoice(req, depositInvoiceId);
    expect(depFinal.paidCents).toBe(PRICE_CENTS); // total cash collected == job total, once
  });
});
