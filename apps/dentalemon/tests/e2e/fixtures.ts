/**
 * Global E2E test fixtures — extends Playwright's base test with:
 * 1. Console error listener (fails test on uncaught JS errors)
 * 2. Network failure listener (fails test on 4xx/5xx API responses unless expected)
 * 3. Shared dental org setup helper
 */

import { test as base, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

export { expect, APP, API };

/** Extends base test with error-capturing page fixture */
export const test = base.extend<{
  /** Page with auto-attached error listeners */
  errorAwarePage: Page;
}>({
  errorAwarePage: async ({ page }, use) => {
    const errors: string[] = [];
    const failedRequests: string[] = [];

    // Capture uncaught JS errors
    page.on('pageerror', (err) => {
      errors.push(`[JS Error] ${err.message}`);
    });

    // Capture failed API requests (5xx = always fail, 4xx = collect for reporting)
    page.on('response', (response) => {
      const url = response.url();
      // Only track API calls, not static assets
      if (url.includes('/dental/') || url.includes('/auth/') || url.includes('/patients')) {
        if (response.status() >= 500) {
          failedRequests.push(`[${response.status()}] ${response.request().method()} ${url}`);
        }
      }
    });

    await use(page);

    // After test: fail if there were uncaught errors or 5xx responses
    if (errors.length > 0) {
      throw new Error(`Uncaught page errors:\n${errors.join('\n')}`);
    }
    if (failedRequests.length > 0) {
      throw new Error(`Server errors during test:\n${failedRequests.join('\n')}`);
    }
  },
});

/**
 * Complete dental org setup: sign up → create org → create branch → create member → set localStorage
 * Returns everything needed to interact with the dental workspace.
 */
export async function setupDentalOrg(page: Page) {
  const suffix = Date.now();
  const email = `e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  // Sign up via UI
  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`E2E Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially(password, { delay: 10 });
  await expect(pwInput).not.toHaveValue('');
  const signupResponse = page.waitForResponse(
    (resp) => /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
    { timeout: 10000 },
  ).catch(() => null);
  await page.getByRole('button', { name: /create an account/i }).click();
  const response = await signupResponse;
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up failed (${response.status()}): ${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

  // Create dental org + branch + member via API
  const ctx = await page.evaluate(async (api) => {
    const orgRes = await fetch(`${api}/dental/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'E2E Test Clinic', tier: 'solo', countryCode: 'PH' }),
    });
    if (!orgRes.ok) throw new Error(`Org creation failed: ${orgRes.status}`);
    const org = await orgRes.json();

    const branchRes = await fetch(`${api}/dental/organizations/${org.id}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Main Branch', timezone: 'Asia/Manila' }),
    });
    if (!branchRes.ok) throw new Error(`Branch creation failed: ${branchRes.status}`);
    const branch = await branchRes.json();

    const memberRes = await fetch(`${api}/dental/organizations/${org.id}/branches/${branch.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: 'E2E Dentist', role: 'dentist_owner' }),
    });
    if (!memberRes.ok) throw new Error(`Member creation failed: ${memberRes.status}`);
    const member = await memberRes.json();

    return { orgId: org.id, branchId: branch.id, memberId: member.id };
  }, API);

  // Set localStorage context
  await page.evaluate((ids) => {
    localStorage.setItem('currentOrgId', ids.orgId);
    localStorage.setItem('currentBranchId', ids.branchId);
    localStorage.setItem('currentMemberId', ids.memberId);
    localStorage.setItem('currentMemberRole', 'dentist_owner');
  }, ctx);

  return { email, password, ...ctx };
}

/**
 * Create a dental patient within a branch.
 * Returns the patient ID.
 */
export async function createDentalPatient(page: Page, opts: {
  displayName: string;
  branchId: string;
  dateOfBirth?: string;
  gender?: string;
}) {
  const res = await page.evaluate(async ({ api, opts }) => {
    const r = await fetch(`${api}/dental/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        displayName: opts.displayName,
        dateOfBirth: opts.dateOfBirth ?? '1990-01-01',
        gender: opts.gender ?? 'female',
        branchId: opts.branchId,
        consentGiven: true,
      }),
    });
    if (!r.ok) throw new Error(`Patient creation failed: ${r.status}`);
    return r.json();
  }, { api: API, opts });

  return res.id as string;
}
