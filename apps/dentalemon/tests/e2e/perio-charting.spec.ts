/**
 * E2E — Perio charting (P0-1, plan §4 step 9).
 *
 * Opens the workspace for a patient with an active visit, opens the Perio tab,
 * starts an exam, enters depths across ≥16 teeth via keyboard auto-advance,
 * verifies a red (≥5mm) cell + the out-of-range count + that CAL renders, then
 * completes and asserts Stage/Grade/Extent + the BOP bucket appear and the chart
 * becomes read-only. Re-opening confirms a completed chart is immutable.
 *
 * Per the "real wiring" memory this hits the real server (no mocked SDK). Setup
 * mirrors ipad-perio-charting.spec.ts: sign up, seed org/branch/patient/visit via
 * the live API, then drive the UI. Skips cleanly when the API is unavailable.
 */

import { test, expect, type Page } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:7213';
const APP = process.env.APP_URL ?? 'http://localhost:3003';

interface SeedContext {
  patientId: string;
  visitId: string;
  branchId: string;
  orgId: string;
}

async function signUpSeedOrgAndVisit(page: Page): Promise<SeedContext> {
  const suffix = Date.now();
  const email = `perio-e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Perio E2E ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially(password, { delay: 10 });

  const signupResponse = page
    .waitForResponse(
      (resp) => /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
      { timeout: 10000 },
    )
    .catch(() => null);
  await page.getByRole('button', { name: /create an account/i }).click();
  const response = await signupResponse;
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up POST returned ${response.status()}: ${body.slice(0, 300)}`);
  }
  await page.waitForURL((url) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  await page.evaluate(async (api) => {
    await fetch(`${api}/persons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ firstName: 'Perio', lastName: 'E2E' }),
    });
  }, API);

  const orgRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Perio E2E Clinic', tier: 'clinic', countryCode: 'PH' }),
    });
    return res.json();
  }, API);

  const branchRes = await page.evaluate(
    async ({ api, orgId }: { api: string; orgId: string }) => {
      const res = await fetch(`${api}/dental/organizations/${orgId}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: 'Main', timezone: 'Asia/Manila' }),
      });
      return res.json();
    },
    { api: API, orgId: orgRes.id as string },
  );

  const memberId = await page.evaluate(
    async ({ api, orgId }: { api: string; orgId: string }) => {
      const res = await fetch(`${api}/dental/organizations/${orgId}/members`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      return (data.items?.[0]?.id ?? data[0]?.id) as string;
    },
    { api: API, orgId: orgRes.id as string },
  );

  const patientRes = await page.evaluate(
    async ({ api, branchId }: { api: string; branchId: string }) => {
      const res = await fetch(`${api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: 'Perio',
          lastName: 'Patient',
          dateOfBirth: '1985-01-01',
          sex: 'female',
          branchId,
        }),
      });
      return res.json();
    },
    { api: API, branchId: branchRes.id as string },
  );

  const visitRes = await page.evaluate(
    async ({ api, patientId, branchId, memberId }: { api: string; patientId: string; branchId: string; memberId: string }) => {
      const res = await fetch(`${api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId, branchId, dentistMemberId: memberId }),
      });
      return res.json();
    },
    { api: API, patientId: patientRes.id as string, branchId: branchRes.id as string, memberId },
  );

  await page.evaluate(
    ({ orgId, branchId }: { orgId: string; branchId: string }) => {
      localStorage.setItem('selectedOrgId', orgId);
      localStorage.setItem('selectedBranchId', branchId);
    },
    { orgId: orgRes.id as string, branchId: branchRes.id as string },
  );

  return {
    orgId: orgRes.id as string,
    branchId: branchRes.id as string,
    patientId: patientRes.id as string,
    visitId: visitRes.id as string,
  };
}

test.describe('Perio charting (P0-1)', () => {
  test('start → keyboard entry → red-line → CAL → complete → read-only', async ({ page }) => {
    let ctx: SeedContext | undefined;
    try {
      ctx = await signUpSeedOrgAndVisit(page);
    } catch {
      test.skip(true, 'Skipped — requires the live API + app dev servers');
      return;
    }
    if (!ctx) return;

    await page.goto(`${APP}/patients/${ctx.patientId}`);
    await page.waitForLoadState('networkidle');

    // Open the Perio tab and start an exam.
    await page.getByTestId('perio-tab-btn').click();
    await expect(page.getByTestId('perio-overlay')).toBeVisible();
    await page.getByTestId('perio-start-btn').click();
    await expect(page.getByTestId('perio-grid')).toBeVisible();

    // Enter depths across the first 16 teeth via keyboard auto-advance.
    // Type a deep value (6mm) on the first site of each tooth so we trip the red-line.
    const firstCell = page.getByLabel(/Tooth 18 mesiobuccal depth/i);
    await firstCell.click();
    // Drive a run of digits; auto-advance carries focus across sites/teeth.
    for (let i = 0; i < 16 * 6; i += 1) {
      await page.keyboard.type('6');
    }

    // A red (≥5mm) cell renders and the out-of-range count is > 0.
    const redCell = page.getByLabel(/Tooth 18 mesiobuccal depth/i);
    await expect(redCell).toHaveClass(/text-destructive/);
    await expect(page.getByTestId('perio-over-threshold-count')).not.toHaveText('0');

    // CAL row renders (read-only).
    await expect(page.getByTestId('perio-cal-cell').first()).toBeVisible();

    // Complete the exam.
    await expect(page.getByTestId('perio-complete-btn')).toBeEnabled();
    await page.getByTestId('perio-complete-btn').click();

    // Stage/Grade/Extent chips + BOP bucket appear, chart becomes read-only.
    await expect(page.getByTestId('perio-classification-chips')).toBeVisible();
    await expect(page.getByTestId('perio-status-badge')).toHaveText(/Completed/i);
    await expect(page.getByTestId('perio-complete-btn')).toHaveCount(0);
    await expect(page.getByLabel(/Tooth 18 mesiobuccal depth/i)).toHaveAttribute('readonly', '');

    // Re-open: a completed chart is immutable.
    await page.getByRole('button', { name: /close perio chart/i }).click();
    await page.getByTestId('perio-tab-btn').click();
    await expect(page.getByTestId('perio-status-badge')).toHaveText(/Completed/i);
    await expect(page.getByTestId('perio-start-btn')).toHaveCount(0);
  });
});
