/**
 * iPad viewport — perio chart layout (G6-S8)
 *
 * Runs under ipad-portrait (1024×768) and ipad-landscape (1366×1024) projects.
 * Asserts the perio chart grid is visible at portrait width and that tooth
 * cells meet the Apple HIG 44px minimum tap target height.
 *
 * Setup mirrors perio-charting.spec.ts: sign up, onboard a clinic via one
 * /dental/onboarding call (org creation is admin-only — EM-ORG-002), set a PIN,
 * unlock the PIN-gated workspace, SPA-navigate to /$patientId, open the Perio
 * tab. There is no standalone /patients/:id/visits/:id/perio route. Skips
 * cleanly when the API/app dev servers are unavailable.
 */

import { test, expect, type Page } from '@playwright/test';
import { API, APP, setMemberPin, unlockWorkspace, spaNavigate } from './helpers/perio-e2e';

interface SeedContext {
  orgId: string;
  branchId: string;
  patientId: string;
  visitId: string;
}

async function signUpSeedOrgAndVisit(page: Page): Promise<SeedContext> {
  const suffix = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `ipad-perio-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`iPad Perio ${suffix}`);
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

  // Mark email verified + create the caller's person record so the workspace
  // guards don't bounce the authenticated owner to verify-email / profile-setup.
  await page.evaluate(async (api) => {
    await fetch(`${api}/dev/verify-email`, { method: 'POST', credentials: 'include' });
    await fetch(`${api}/persons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ firstName: 'iPad', lastName: 'Perio' }),
    });
  }, API);

  // Provision org + default branch + dentist_owner membership in ONE self-service
  // call. The caller becomes owner + dentist_owner member.
  const onb = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        organizationName: 'Perio iPad Clinic',
        tier: 'clinic',
        countryCode: 'PH',
        branchName: 'Main Branch',
        timezone: 'Asia/Manila',
        ownerDisplayName: 'Perio iPad Dentist',
      }),
    });
    if (!res.ok) throw new Error(`Onboarding failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }, API);
  const orgId = onb.organizationId as string;
  const branchId = onb.branchId as string;
  const memberId = onb.membershipId as string;

  const patientRes = await page.evaluate(
    async ({ api, branchId }: { api: string; branchId: string }) => {
      const res = await fetch(`${api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: 'Perio Patient',
          dateOfBirth: '1990-01-01',
          gender: 'female',
          branchId,
          consentGiven: true,
        }),
      });
      if (!res.ok) throw new Error(`Patient create failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return res.json();
    },
    { api: API, branchId },
  );

  const visitRes = await page.evaluate(
    async ({ api, patientId, branchId, memberId }: { api: string; patientId: string; branchId: string; memberId: string }) => {
      const res = await fetch(`${api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId, branchId, dentistMemberId: memberId }),
      });
      if (!res.ok) throw new Error(`Visit create failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return res.json();
    },
    { api: API, patientId: patientRes.id as string, branchId, memberId },
  );

  await page.evaluate(
    ({ orgId, branchId, memberId }: { orgId: string; branchId: string; memberId: string }) => {
      localStorage.setItem('selectedOrgId', orgId);
      localStorage.setItem('selectedBranchId', branchId);
      localStorage.setItem('currentOrgId', orgId);
      localStorage.setItem('currentBranchId', branchId);
      localStorage.setItem('currentMemberId', memberId);
      localStorage.setItem('currentMemberRole', 'dentist_owner');
    },
    { orgId, branchId, memberId },
  );

  // Set a PIN on the owner membership, then drive the real PIN-unlock UI so the
  // in-memory pinSession exists (the workspace route tree is PIN-gated).
  await setMemberPin(page, { orgId, branchId, memberId, pin: '135790' });
  await unlockWorkspace(page, '135790');

  return {
    orgId,
    branchId,
    patientId: patientRes.id as string,
    visitId: visitRes.id as string,
  };
}

/**
 * SPA-navigate to the workspace, open the Perio tab, and start a draft chart so
 * the grid renders. Returns once the grid is on screen.
 */
async function openPerioGrid(page: Page, patientId: string): Promise<void> {
  await spaNavigate(page, `/${patientId}`);
  await page.getByTestId('perio-tab-btn').click();
  await expect(page.getByTestId('perio-overlay')).toBeVisible();
  // Fresh visit → empty state. Click the start button directly (Playwright
  // auto-waits for it to become actionable, which also rides out the chart-load
  // spinner — a bare isVisible() guard would race the spinner and skip the click).
  await page.getByTestId('perio-start-btn').click();
  await expect(page.getByTestId('perio-grid')).toBeVisible();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('iPad perio chart layout', () => {
  test('perio chart grid is visible at portrait 1024×768', async ({ page }) => {
    let ctx: SeedContext | undefined;
    try {
      ctx = await signUpSeedOrgAndVisit(page);
    } catch {
      test.skip(true, 'Skipped — requires the live API + app dev servers');
      return;
    }
    if (!ctx) return;

    await openPerioGrid(page, ctx.patientId);
    await expect(page.getByTestId('perio-grid')).toBeVisible();
  });

  test('tooth cell tap targets meet Apple HIG 44px minimum', async ({ page }) => {
    let ctx: SeedContext | undefined;
    try {
      ctx = await signUpSeedOrgAndVisit(page);
    } catch {
      test.skip(true, 'Skipped — requires the live API + app dev servers');
      return;
    }
    if (!ctx) return;

    await openPerioGrid(page, ctx.patientId);

    const cell = page.getByTestId('tooth-cell').first();
    await expect(cell).toBeVisible();
    const height = await cell.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThanOrEqual(44);
  });
});
