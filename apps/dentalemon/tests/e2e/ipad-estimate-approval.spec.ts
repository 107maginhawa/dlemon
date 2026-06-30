/**
 * E2E (Phase 2E): Sendable/approvable Estimate — generate → print → sign → approved.
 *
 * Drives the REAL stack: charts planned treatments, opens the Treatment Plan,
 * views the formal Estimate document, prints it (window.print stubbed), then
 * captures an in-person patient e-signature which creates+signs a consent form
 * and links it to an immutable TreatmentPlanVersion via acceptTreatmentPlan.
 *
 * Preconditions: API :7213, app :3003 (playwright.config reuseExistingServer).
 */
import { test, expect, type Page } from '@playwright/test';
import { setupDentalOrg, createDentalPatient, gotoApp, API } from './fixtures';

async function apiPost(page: Page, path: string, body: unknown): Promise<any> {
  const res = await page.request.post(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' }, data: body,
  });
  if (!res.ok()) throw new Error(`POST ${path} → ${res.status()}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return res.json();
}
async function apiPatch(page: Page, path: string, body: unknown): Promise<void> {
  const res = await page.request.patch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' }, data: body,
  });
  if (!res.ok()) throw new Error(`PATCH ${path} → ${res.status()}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
}
async function createActiveVisit(page: Page, a: { patientId: string; branchId: string; memberId: string }): Promise<string> {
  const visit = await apiPost(page, '/dental/visits', { patientId: a.patientId, branchId: a.branchId, dentistMemberId: a.memberId });
  await apiPatch(page, `/dental/visits/${visit.id}`, { status: 'active' });
  return visit.id as string;
}
async function createPlannedTreatment(page: Page, a: {
  visitId: string; patientId: string; toothNumber: number; priceCents: number; cdtCode: string; description: string;
}): Promise<void> {
  const tx = await apiPost(page, `/dental/visits/${a.visitId}/treatments`, {
    visitId: a.visitId, patientId: a.patientId, toothNumber: a.toothNumber,
    priceCents: a.priceCents, cdtCode: a.cdtCode, description: a.description,
  });
  await apiPatch(page, `/dental/visits/${a.visitId}/treatments/${tx.id}`, { status: 'planned' });
}

test.describe('Estimate — print & in-person approval', () => {
  test('generate → print → sign → approved', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, { displayName: 'Estimate Patient', branchId });
    const visitId = await createActiveVisit(page, { patientId, branchId, memberId });
    await createPlannedTreatment(page, { visitId, patientId, toothNumber: 16, priceCents: 1200000, cdtCode: 'D2740', description: 'Crown #16' });
    await createPlannedTreatment(page, { visitId, patientId, toothNumber: 11, priceCents: 150000, cdtCode: 'D1110', description: 'Prophylaxis' });

    await gotoApp(page, `/${patientId}`);
    await page.waitForLoadState('networkidle');

    // Open the Treatment Plan sheet (top-bar affordance) and view the Estimate.
    await page.getByRole('button', { name: /treatment plan/i }).first().click();
    const viewEstimate = page.getByTestId('view-estimate-btn');
    await expect(viewEstimate).toBeVisible({ timeout: 15000 });
    await viewEstimate.click();

    // Estimate document: the two planned items + the total.
    await expect(page.getByTestId('estimate-document')).toBeVisible();
    await expect(page.getByTestId('estimate-line-item')).toHaveCount(2);
    await expect(page.getByTestId('estimate-total')).toContainText('₱13,500.00');
    await page.screenshot({ path: 'test-results/estimate-draft.png' });

    // Print — stub window.print so headless doesn't block, assert it fires.
    await page.evaluate(() => {
      (window as unknown as { __printed?: boolean }).__printed = false;
      window.print = () => { (window as unknown as { __printed?: boolean }).__printed = true; };
    });
    await page.getByTestId('estimate-print').click();
    expect(await page.evaluate(() => (window as unknown as { __printed?: boolean }).__printed)).toBe(true);

    // Approve & Sign — visit is active, so the button is enabled.
    const approve = page.getByTestId('estimate-approve-btn');
    await expect(approve).toBeEnabled();
    await approve.click();

    // Draw a signature stroke on the overlay canvas.
    await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="estimate-overlay"] canvas') as HTMLCanvasElement;
      if (!canvas) throw new Error('Signature canvas not found in estimate overlay');
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d')!;
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + 20, clientY: rect.top + 30, pointerId: 1 }));
      ctx.beginPath(); ctx.moveTo(20, 30); ctx.lineTo(80, 60); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.stroke();
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: rect.left + 80, clientY: rect.top + 60, pointerId: 1 }));
    });
    await page.waitForTimeout(300);

    // Confirm approval — links the signed consent to a frozen plan version.
    const acceptPromise = page
      .waitForResponse((r) => /\/treatment-plan\/accept/.test(r.url()) && r.request().method() === 'POST', { timeout: 15000 })
      .catch(() => null);
    const confirm = page.getByTestId('estimate-sign-confirm');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    const acceptResp = await acceptPromise;
    expect(acceptResp, 'acceptTreatmentPlan POST should fire on confirm').not.toBeNull();
    expect(acceptResp!.status()).toBe(201);

    // Approved state surfaces in the document.
    await expect(page.getByTestId('estimate-signature-block')).toContainText(/approved/i, { timeout: 15000 });
    await page.screenshot({ path: 'test-results/estimate-approved.png' });
  });
});
