/**
 * E2E: Staff Management (FR6.x)
 *
 * Business Rules:
 * - FR6.1: Create staff member with name, role, 6-digit PIN
 * - FR6.5: Staff list shows name, role badge, status, actions
 * - FR8.13: Only Dentist-Owner can access staff module
 */

import { test, expect, type Page } from '@playwright/test';
import { API, APP, signUpOnboardAndUnlock, spaNavigate, setMemberPin } from './helpers/e2e-seed';

async function signUpAndSetupPractice(page: Page): Promise<{ orgId: string; branchId: string }> {
  // Provision org+branch+owner via /dental/onboarding (org creation is admin-only
  // — EM-ORG-002), set a PIN, and unlock. Caller becomes dentist_owner.
  const { orgId, branchId } = await signUpOnboardAndUnlock(page, {
    tier: 'clinic',
    label: 'Staff',
  });

  return { orgId, branchId };
}

test.describe('Staff Management', () => {
  test('FR6.5: staff page loads and shows staff list header', async ({ page }) => {
    await signUpAndSetupPractice(page);
    await spaNavigate(page, `/staff`);

    await expect(page.getByRole('heading', { name: 'Staff Members' })).toBeVisible();
    await expect(page.getByRole('button', { name: /add staff/i })).toBeVisible();
  });

  test('FR6.1: "+ Add Staff" button opens creation modal', async ({ page }) => {
    await signUpAndSetupPractice(page);
    await spaNavigate(page, `/staff`);

    await page.getByRole('button', { name: /add staff/i }).click();
    await expect(page.getByTestId('staff-create-modal')).toBeVisible();

    // Should have required fields: name, role, PIN
    await expect(page.getByLabel(/display name/i)).toBeVisible();
    await expect(page.getByLabel(/pin.*6 digits/i)).toBeVisible();
  });

  test('FR6.1: form validates 6-digit PIN requirement', async ({ page }) => {
    await signUpAndSetupPractice(page);
    await spaNavigate(page, `/staff`);

    await page.getByRole('button', { name: /add staff/i }).click();
    await page.getByLabel(/display name/i).fill('Test Staff');
    await page.getByLabel(/pin.*6 digits/i).fill('123'); // Too short

    await page.getByRole('button', { name: /create staff member/i }).click();

    await expect(page.getByText(/pin must be exactly 6 digits/i)).toBeVisible();
  });

  test('FR6.1: creating a staff member adds to the list', async ({ page }) => {
    const { orgId, branchId } = await signUpAndSetupPractice(page);
    await spaNavigate(page, `/staff`);

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

  test('FR8.13: non-owner role is denied access to staff page', async ({ browser }) => {
    // The RBAC route guard (requireRole) blocks staff_full from /staff at the route level,
    // redirecting to /dashboard. The StaffAccessDenied component is a secondary in-page
    // guard shown when the route guard somehow lets a non-owner through (e.g. role changes
    // after load). This test verifies the route-level denial.
    //
    // Org creation is admin-only (EM-ORG-002), so the org+branch come from an OWNER
    // onboarding via /dental/onboarding. The owner then adds a SEPARATE staff_full member
    // (member creation by an owner is allowed) linked to a second signed-up user. That
    // staff_full user unlocks their own PIN session and is the one denied /staff.
    const suffix = Date.now();
    const pin = '246802';

    // ── Owner context: onboard org + branch ──────────────────────────────
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const owner = await signUpOnboardAndUnlock(ownerPage, { tier: 'clinic', label: 'StaffOwner' });

    // ── Staff context: sign up the non-owner user ────────────────────────
    const staffCtx = await browser.newContext();
    const staffPage = await staffCtx.newPage();
    const staffEmail = `staff-fr813-${suffix}@example.org`;
    const staffPassword = 'E2eTestPass123!';

    await staffPage.goto(`${APP}/auth/sign-up`);
    await staffPage.waitForLoadState('networkidle');
    await staffPage.getByLabel('Name', { exact: true }).fill(`Staff Full ${suffix}`);
    await staffPage.getByLabel('Email', { exact: true }).fill(staffEmail);
    const staffPw = staffPage.locator('input[type="password"]');
    await staffPw.click();
    await staffPw.pressSequentially(staffPassword, { delay: 10 });
    await expect(staffPw).not.toHaveValue('');
    await staffPage.getByRole('button', { name: /create an account/i }).click();
    await staffPage.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });
    const staffPersonId = await staffPage.evaluate(async (api: string) => {
      await fetch(`${api}/dev/verify-email`, { method: 'POST', credentials: 'include' });
      // The requirePerson guard bounces any user without a person profile to the
      // /onboarding wizard — which would strand the PIN-entry route below. Create
      // the staff user's person record so the workspace guards let them through.
      await fetch(`${api}/persons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ firstName: 'Staff', lastName: 'Full' }),
      });
      const s = await (await fetch(`${api}/auth/get-session`, { credentials: 'include' })).json() as any;
      return s?.user?.id as string;
    }, API);

    // ── Owner adds the staff user as a staff_full member + sets their PIN ──
    const staffMemberId = await ownerPage.evaluate(async ({ api, orgId, branchId, personId }: { api: string; orgId: string; branchId: string; personId: string }) => {
      const r = await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: 'Staff Member', role: 'staff_full', personId }),
      });
      if (!r.ok) throw new Error(`Member creation failed: ${r.status} ${await r.text()}`);
      const m = await r.json() as any;
      return m.id as string;
    }, { api: API, orgId: owner.orgId, branchId: owner.branchId, personId: staffPersonId });

    await setMemberPin(ownerPage, { orgId: owner.orgId, branchId: owner.branchId, memberId: staffMemberId, pin });

    // ── Staff user seeds their org context + unlocks, then visits /staff ──
    await staffPage.evaluate(({ orgId, branchId, memberId }: { orgId: string; branchId: string; memberId: string }) => {
      localStorage.setItem('selectedOrgId', orgId);
      localStorage.setItem('selectedBranchId', branchId);
      localStorage.setItem('currentOrgId', orgId);
      localStorage.setItem('currentBranchId', branchId);
      localStorage.setItem('currentMemberId', memberId);
      localStorage.setItem('currentMemberRole', 'staff_full');
    }, { orgId: owner.orgId, branchId: owner.branchId, memberId: staffMemberId });

    // Unlock the staff user's PIN-gated session. The shared unlockWorkspace helper
    // expects the keypad to render immediately at /auth/pin-select, but with two
    // members in the branch (owner + staff) that page lists member-select cards
    // instead of auto-advancing — so drive the keypad directly via the staff
    // member's pin-entry route, which reconstructs context from the seeded
    // localStorage (currentOrgId/currentBranchId) and verifies the PIN.
    await staffPage.goto(`${APP}/auth/pin-entry/${staffMemberId}`);
    await staffPage.waitForLoadState('networkidle');
    await expect(staffPage.getByRole('group', { name: /PIN keypad/i })).toBeVisible({ timeout: 15000 });
    for (const digit of pin) {
      await staffPage.getByRole('button', { name: new RegExp(`^${digit}$`) }).click();
    }
    await staffPage.waitForURL((url: URL) => !url.pathname.startsWith('/auth/'), { timeout: 15000 });

    await spaNavigate(staffPage, `/staff`);

    // staff_full role cannot access the staff module — route guard redirects to /dashboard
    await expect(staffPage).toHaveURL(/\/dashboard/);
    // Staff list heading must NOT be visible (access was denied)
    await expect(staffPage.getByRole('heading', { name: 'Staff Members' })).not.toBeVisible();

    await ownerCtx.close();
    await staffCtx.close();
  });
});
