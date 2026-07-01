/**
 * E2E: Insurance / Revenue-Cycle (P1-26)
 *
 * Front-desk HMO flow at the UI level:
 *  - Billing → Insurance tab surfaces the claims worklist.
 *  - The worklist shows its empty state for a fresh branch (no claims yet).
 *  - The cash-patient Invoices tab is untouched (plan R3 — insurance is opt-in).
 *
 * Verifies UI-level behavior against the live API.
 */

import { test, expect, type Page } from '@playwright/test';
import { enableWorkspaceFlags } from './helpers/feature-flags';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function signUpAndSeed(page: Page) {
  const suffix = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `insurance-e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Insurance Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially(password, { delay: 10 });
  await expect(pwInput).not.toHaveValue('');

  const signupResponse = page
    .waitForResponse(
      (resp: any) => /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
      { timeout: 10000 },
    )
    .catch(() => null);
  await page.getByRole('button', { name: /create an account/i }).click();
  const response = await signupResponse;
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up POST returned ${response.status()}: ${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });
  // A post-signup client redirect can still be in flight here, which destroys the
  // page.evaluate execution context mid-fetch. Settle first, then retry on that race.
  await page.waitForLoadState('networkidle').catch(() => {});

  // Mark email verified + create the caller's person record so the workspace/
  // dashboard guards don't bounce the authenticated owner to a setup wizard.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.evaluate(async (api) => {
        await fetch(`${api}/dev/verify-email`, { method: 'POST', credentials: 'include' });
        await fetch(`${api}/persons`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ firstName: 'Insurance', lastName: 'Owner' }),
        });
      }, API);
      break;
    } catch (err) {
      if (attempt === 2 || !/context was destroyed|Execution context/i.test(String(err))) throw err;
      await page.waitForLoadState('networkidle').catch(() => {});
    }
  }

  // Provision org + default branch + dentist_owner membership in ONE self-service
  // call (org creation is admin-only now — EM-ORG-002). The caller becomes owner.
  const onb = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        organizationName: 'Insurance Test Clinic',
        tier: 'clinic',
        countryCode: 'PH',
        branchName: 'Main Branch',
        timezone: 'Asia/Manila',
        ownerDisplayName: 'Insurance Owner',
      }),
    });
    if (!res.ok) throw new Error(`Onboarding failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }, API);
  const orgId = onb.organizationId as string;
  const branchId = onb.branchId as string;
  const memberId = onb.membershipId as string;

  await page.evaluate(
    ({ orgId, branchId, memberId }: { orgId: string; branchId: string; memberId: string }) => {
      localStorage.setItem('currentOrgId', orgId);
      localStorage.setItem('currentBranchId', branchId);
      localStorage.setItem('currentMemberId', memberId);
      localStorage.setItem('currentMemberRole', 'dentist_owner');
    },
    { orgId, branchId, memberId },
  );

  // Set a PIN on the owner membership, then drive the real PIN-unlock UI so the
  // in-memory pinSession exists (dashboard routes are PIN-gated and the session
  // cannot be seeded via localStorage — it lives only in memory).
  await setMemberPin(page, { orgId, branchId, memberId, pin: '135790' });
  await unlockWorkspace(page, '135790');

  return { orgId, branchId };
}

/** Set a 6-digit PIN on a membership via the org admin endpoint. */
async function setMemberPin(
  page: Page,
  opts: { orgId: string; branchId: string; memberId: string; pin: string },
): Promise<void> {
  await page.evaluate(
    async ({ api, orgId, branchId, memberId, pin }) => {
      const res = await fetch(
        `${api}/dental/organizations/${orgId}/branches/${branchId}/members/${memberId}/set-pin`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ pin }),
        },
      );
      if (!res.ok) throw new Error(`set-pin failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    },
    { api: API, ...opts },
  );
}

/**
 * Drive the real PIN-select → PIN-entry flow to mint the in-memory pinSession.
 * A single-member branch auto-advances pin-select → pin-entry; we then tap the
 * keypad. On success the app navigates to the role landing page.
 */
async function unlockWorkspace(page: Page, pin: string): Promise<void> {
  await page.goto(`${APP}/auth/pin-select`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('group', { name: /PIN keypad/i })).toBeVisible({ timeout: 15000 });
  for (const digit of pin) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.waitForURL((url) => !url.pathname.includes('/auth/pin'), { timeout: 15000 });
}

/**
 * Client-side (SPA) navigation that preserves the in-memory PIN session. A hard
 * `page.goto` reloads the app and resets pinSession (it lives only in memory),
 * bouncing back to the PIN gate. Using the history API + popstate lets TanStack
 * Router handle the navigation in-app so the unlocked session survives.
 */
async function spaNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForURL((url) => url.pathname === path, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

test.describe('Insurance / Revenue-Cycle (P1-26)', () => {
  // Insurance / revenue-cycle is v2 (workspace.advanced_billing) — opt in before each nav.
  test.beforeEach(async ({ page }) => {
    await enableWorkspaceFlags(page, 'workspace.advanced_billing');
  });

  test('Insurance tab surfaces the claims worklist (empty state for a fresh branch)', async ({ page }) => {
    await signUpAndSeed(page);
    await spaNavigate(page, '/billing');

    await page.getByRole('tab', { name: /insurance/i }).click();

    await expect(page.getByTestId('claims-worklist')).toBeVisible();
    await expect(page.getByTestId('claims-empty')).toBeVisible();
  });

  test('cash path untouched: Invoices tab still renders the invoice list', async ({ page }) => {
    await signUpAndSeed(page);
    await spaNavigate(page, '/billing');

    // Default tab is Invoices — the cash-patient majority sees no insurance friction.
    await expect(page.getByTestId('billing-list')).toBeVisible();

    // Switching to Insurance then back keeps the invoice list intact.
    await page.getByRole('tab', { name: /insurance/i }).click();
    await expect(page.getByTestId('claims-worklist')).toBeVisible();
    await page.getByRole('tab', { name: /invoices/i }).click();
    await expect(page.getByTestId('billing-list')).toBeVisible();
  });

  test('a seeded claim RENDERS in the worklist (claim number + billed amount), not the empty state', async ({ page }) => {
    const { branchId } = await signUpAndSeed(page);

    // Seed: patient → insurance profile → claim with one inline line.
    const claim = await page.evaluate(async ({ api, branchId }) => {
      const h = { 'Content-Type': 'application/json' };
      const patient = await fetch(`${api}/dental/patients`, {
        method: 'POST', headers: h, credentials: 'include',
        body: JSON.stringify({ displayName: 'Claim Carla', branchId, consentGiven: true }),
      }).then((r) => r.json() as any);
      await fetch(`${api}/dental/patients/${patient.id}`, {
        method: 'PATCH', headers: h, credentials: 'include',
        body: JSON.stringify({ preferredBranchId: branchId }),
      });
      const profile = await fetch(`${api}/dental/patients/${patient.id}/insurance-profiles`, {
        method: 'POST', headers: h, credentials: 'include',
        body: JSON.stringify({ insurerName: 'Maxicare', policyNumber: 'POL-2026-001', subscriberName: 'Claim Carla', payerType: 'hmo' }),
      }).then((r) => r.json() as any);
      const res = await fetch(`${api}/dental/billing/claims`, {
        method: 'POST', headers: h, credentials: 'include',
        body: JSON.stringify({
          patientId: patient.id,
          insuranceProfileId: profile.id,
          lines: [{ cdtCode: 'D2391', description: 'Resin Composite 1 surface', billedAmountCents: 250000 }],
        }),
      });
      const body = await res.json() as any;
      return { status: res.status, claimNumber: body.claimNumber as string };
    }, { api: API, branchId });

    expect(claim.status, JSON.stringify(claim)).toBe(201);
    expect(claim.claimNumber).toBeTruthy();

    await spaNavigate(page, '/billing');
    await page.getByRole('tab', { name: /insurance/i }).click();

    const worklist = page.getByTestId('claims-worklist');
    await expect(worklist).toBeVisible();
    // The real claim must RENDER — a broken claims query would show the empty state
    // (the existing empty-state test would still pass, masking the regression).
    await expect(page.getByTestId('claims-empty')).toHaveCount(0);
    await expect(worklist.getByText(claim.claimNumber)).toBeVisible();
    // Billed amount renders from the seeded ₱2,500 line (formatPeso → en-PH).
    await expect(worklist.getByText('₱2,500.00').first()).toBeVisible();
  });
});
