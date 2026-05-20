/**
 * E2E: Staff Management (FR6.x)
 *
 * Business Rules:
 * - FR6.1: Create staff member with name, role, 6-digit PIN
 * - FR6.5: Staff list shows name, role badge, status, actions
 * - FR8.13: Only Dentist-Owner can access staff module
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function signUpAndSetupPractice(page: Page): Promise<{ orgId: string; branchId: string }> {
  const suffix = Date.now();
  const email = `staff-e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Staff Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially(password, { delay: 10 });
  await expect(pwInput).not.toHaveValue('');

  const signupResponse = page.waitForResponse(
    (resp: any) => /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
    { timeout: 10000 },
  ).catch(() => null);
  await page.getByRole('button', { name: /create an account/i }).click();
  const res = await signupResponse;
  if (res && res.status() >= 400) {
    const body = await res.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up POST returned ${res.status()}: ${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

  // Mark email as verified (required for dashboard access guard)
  await page.evaluate(async (api) => {
    await fetch(`${api}/dev/verify-email`, { method: 'POST', credentials: 'include' });
  }, API);

  // Create org + branch + membership in one evaluate call so we have personId
  const ctx = await page.evaluate(async (api) => {
    // Get current user's personId for membership linkage
    const sessionRes = await fetch(`${api}/auth/get-session`, { credentials: 'include' });
    const session = await sessionRes.json() as any;
    const personId: string = session?.user?.id ?? '';

    const orgRes = await fetch(`${api}/dental/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Staff Test Clinic', tier: 'clinic', countryCode: 'PH' }),
    });
    const org = await orgRes.json() as any;

    const branchRes = await fetch(`${api}/dental/organizations/${org.id}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Main Branch', timezone: 'Asia/Manila' }),
    });
    const branch = await branchRes.json() as any;

    // Create membership so getOrgContext returns role = dentist_owner
    const memberRes = await fetch(`${api}/dental/organizations/${org.id}/branches/${branch.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: 'Staff Owner', role: 'dentist_owner', personId }),
    });
    const member = await memberRes.json() as any;

    return { orgId: org.id, branchId: branch.id, memberId: member.id };
  }, API);
  const { orgId, branchId } = ctx;

  await page.evaluate(({ orgId, branchId, memberId }: { orgId: string; branchId: string; memberId: string }) => {
    localStorage.setItem('currentOrgId', orgId);
    localStorage.setItem('currentBranchId', branchId);
    localStorage.setItem('currentMemberId', memberId);
    localStorage.setItem('currentMemberRole', 'dentist_owner');
  }, ctx);

  return { orgId, branchId };
}

test.describe('Staff Management', () => {
  test('FR6.5: staff page loads and shows staff list header', async ({ page }) => {
    await signUpAndSetupPractice(page);
    await page.goto(`${APP}/staff`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Staff Members' })).toBeVisible();
    await expect(page.getByRole('button', { name: /add staff/i })).toBeVisible();
  });

  test('FR6.1: "+ Add Staff" button opens creation modal', async ({ page }) => {
    await signUpAndSetupPractice(page);
    await page.goto(`${APP}/staff`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add staff/i }).click();
    await expect(page.getByTestId('staff-create-modal')).toBeVisible();

    // Should have required fields: name, role, PIN
    await expect(page.getByLabel(/display name/i)).toBeVisible();
    await expect(page.getByLabel(/pin.*6 digits/i)).toBeVisible();
  });

  test('FR6.1: form validates 6-digit PIN requirement', async ({ page }) => {
    await signUpAndSetupPractice(page);
    await page.goto(`${APP}/staff`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add staff/i }).click();
    await page.getByLabel(/display name/i).fill('Test Staff');
    await page.getByLabel(/pin.*6 digits/i).fill('123'); // Too short

    await page.getByRole('button', { name: /create staff member/i }).click();

    await expect(page.getByText(/pin must be exactly 6 digits/i)).toBeVisible();
  });

  test('FR6.1: creating a staff member adds to the list', async ({ page }) => {
    const { orgId, branchId } = await signUpAndSetupPractice(page);
    await page.goto(`${APP}/staff`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add staff/i }).click();
    await page.getByLabel(/display name/i).fill('Nurse Maria');

    // Select role: Staff - Full Operations
    await page.getByText('Staff - Full Operations').click();

    await page.getByLabel(/pin.*6 digits/i).fill('111111');
    await page.getByLabel(/confirm pin/i).fill('111111');

    await page.getByRole('button', { name: /create staff member/i }).click();

    // Wait for modal to close (success) — modal disappears once create + pin-reset both complete
    await expect(page.getByTestId('staff-create-modal')).not.toBeVisible({ timeout: 10000 });

    // Staff member should appear in list after query invalidation + refetch
    await expect(page.getByText('Nurse Maria')).toBeVisible({ timeout: 8000 });
  });

  test('FR8.13: non-owner role is denied access to staff page', async ({ page }) => {
    // The RBAC route guard (requireRole) blocks staff_full from /staff at the route level,
    // redirecting to /dashboard. The StaffAccessDenied component is a secondary in-page
    // guard shown when the route guard somehow lets a non-owner through (e.g. role changes
    // after load). This test verifies the route-level denial.
    const suffix = Date.now();
    const email = `staff-fr813-${suffix}@example.org`;
    const password = 'E2eTestPass123!';

    await page.goto(`${APP}/auth/sign-up`);
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Name', { exact: true }).fill(`Staff Full ${suffix}`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    const pwInput = page.locator('input[type="password"]');
    await pwInput.click();
    await pwInput.pressSequentially(password, { delay: 10 });
    await expect(pwInput).not.toHaveValue('');
    await page.getByRole('button', { name: /create an account/i }).click();
    await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

    await page.evaluate(async (api) => {
      await fetch(`${api}/dev/verify-email`, { method: 'POST', credentials: 'include' });
    }, API);

    const ctx = await page.evaluate(async (api) => {
      const sessionRes = await fetch(`${api}/auth/get-session`, { credentials: 'include' });
      const session = await sessionRes.json() as any;
      const personId: string = session?.user?.id ?? '';

      const orgRes = await fetch(`${api}/dental/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: 'Staff Full Clinic', tier: 'clinic', countryCode: 'PH' }),
      });
      const org = await orgRes.json() as any;

      const branchRes = await fetch(`${api}/dental/organizations/${org.id}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: 'Main Branch', timezone: 'Asia/Manila' }),
      });
      const branch = await branchRes.json() as any;

      // Create staff_full membership linked to this user
      const memberRes = await fetch(`${api}/dental/organizations/${org.id}/branches/${branch.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: 'Staff Member', role: 'staff_full', personId }),
      });
      const member = await memberRes.json() as any;

      return { orgId: org.id, branchId: branch.id, memberId: member.id };
    }, API);

    await page.evaluate((ids: { orgId: string; branchId: string; memberId: string }) => {
      localStorage.setItem('currentOrgId', ids.orgId);
      localStorage.setItem('currentBranchId', ids.branchId);
      localStorage.setItem('currentMemberId', ids.memberId);
    }, ctx);

    await page.goto(`${APP}/staff`);
    await page.waitForLoadState('networkidle');

    // staff_full role cannot access the staff module — route guard redirects to /dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    // Staff list heading must NOT be visible (access was denied)
    await expect(page.getByRole('heading', { name: 'Staff Members' })).not.toBeVisible();
  });
});
