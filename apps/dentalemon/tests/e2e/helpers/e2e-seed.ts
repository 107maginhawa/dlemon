/**
 * Shared E2E seeding helper for self-seeding specs.
 *
 * Org creation is admin-only (EM-ORG-002). A signed-up clinic owner provisions
 * their clinic via the self-service `POST /dental/onboarding` endpoint (caller
 * becomes owner + dentist_owner member). The workspace route tree is then
 * PIN-gated, and the PIN session lives only in memory — so specs must set a PIN,
 * unlock through the real UI, and navigate via SPA pushState (`spaNavigate`),
 * never a hard `page.goto` (which would reset the session and bounce to the PIN
 * gate). This helper does signup → verify-email → person → onboarding → set-pin
 * → unlock, returning the org/branch/member ids; the caller adds its own
 * scenario-specific seeding (patients, visits, invoices, …) using branchId/memberId.
 */

import { expect, type Page } from '@playwright/test';
import { API, APP, setMemberPin, unlockWorkspace, spaNavigate } from './perio-e2e';

export { API, APP, setMemberPin, unlockWorkspace, spaNavigate };

export interface OnboardResult {
  email: string;
  password: string;
  orgId: string;
  branchId: string;
  memberId: string;
}

/**
 * Sign up a fresh clinic owner, onboard their clinic (org + branch + owner
 * membership) via `/dental/onboarding`, set a PIN, and unlock the workspace.
 * Returns the ids; the caller seeds its own patients/visits with branchId/memberId
 * and SPA-navigates with `spaNavigate(page, '/' + patientId)`.
 */
export async function signUpOnboardAndUnlock(
  page: Page,
  opts: { tier?: 'solo' | 'clinic'; label?: string; pin?: string; activate?: boolean } = {},
): Promise<OnboardResult> {
  const tier = opts.tier ?? 'clinic';
  const label = opts.label ?? 'E2E';
  const pin = opts.pin ?? '135790';
  const suffix = Date.now();
  const email = `${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`${label} Owner ${suffix}`);
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
  // guards don't bounce the owner to verify-email / profile-setup. Use the
  // navigation-immune APIRequestContext (page.request, which shares the browser
  // context's cookies) instead of an in-page fetch — a post-signup client redirect
  // was racing the page.evaluate and destroying its execution context.
  await page.request.post(`${API}/dev/verify-email`);
  await page.request.post(`${API}/persons`, {
    headers: { 'Content-Type': 'application/json' },
    data: { firstName: 'E2E', lastName: 'Owner' },
  });

  // Provision org + default branch + dentist_owner membership in ONE self-service call.
  const onb = await page.evaluate(
    async ({ api, tier, label }) => {
      const res = await fetch(`${api}/dental/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          organizationName: `${label} Clinic`,
          tier,
          countryCode: 'PH',
          branchName: 'Main Branch',
          timezone: 'Asia/Manila',
          ownerDisplayName: `${label} Dentist`,
        }),
      });
      if (!res.ok) throw new Error(`Onboarding failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return res.json();
    },
    { api: API, tier, label },
  );
  const orgId = onb.organizationId as string;
  const branchId = onb.branchId as string;
  const memberId = onb.membershipId as string;

  // C-1: onboarding leaves the org 'provisional'. Activate by default so E2E
  // flows behave like a live clinic (PHI writes allowed; no activation banner).
  // Pass { activate: false } to exercise the provisional state itself.
  if (opts.activate !== false) {
    await page.request.post(`${API}/dental/organizations/${orgId}/activate`);
  }

  await page.evaluate(
    ({ orgId, branchId, memberId }) => {
      localStorage.setItem('selectedOrgId', orgId);
      localStorage.setItem('selectedBranchId', branchId);
      localStorage.setItem('currentOrgId', orgId);
      localStorage.setItem('currentBranchId', branchId);
      localStorage.setItem('currentMemberId', memberId);
      localStorage.setItem('currentMemberRole', 'dentist_owner');
    },
    { orgId, branchId, memberId },
  );

  await setMemberPin(page, { orgId, branchId, memberId, pin });
  await unlockWorkspace(page, pin);

  return { email, password, orgId, branchId, memberId };
}
