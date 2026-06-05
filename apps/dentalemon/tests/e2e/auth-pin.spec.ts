/**
 * E2E: PIN authentication flow
 *
 * Business Rules:
 * - FR9.2: User selection screen shows cards with avatar, name, role badge; single user = auto-select
 * - FR9.3: Role-based landing: dentist_owner → /dashboard, staff_full → /patients, staff_scheduling → /calendar
 * - FR9.7: After 3 fails, "Forgot PIN?" link appears
 */

import { test, expect, type Page } from '@playwright/test';
import { setupDentalOrg, API, APP } from './fixtures';

/**
 * Add a member to an existing branch (owner-authenticated session) and set its PIN.
 * Member creation by an owner is allowed; only org creation is admin-gated
 * (EM-ORG-002), which is why the org/branch/owner come from setupDentalOrg.
 */
async function addMemberWithPin(
  page: Page,
  opts: { orgId: string; branchId: string; displayName: string; role: string; pin?: string; personId?: string },
): Promise<string> {
  const memberId = await page.evaluate(async ({ api, o }) => {
    const res = await fetch(`${api}/dental/organizations/${o.orgId}/branches/${o.branchId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        displayName: o.displayName,
        role: o.role,
        ...(o.personId ? { personId: o.personId } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Member creation failed: ${res.status} ${await res.text().catch(() => '')}`);
    const m = await res.json() as any;
    return m.id as string;
  }, { api: API, o: opts });

  if (opts.pin) {
    await page.evaluate(async ({ api, o, memberId }) => {
      const res = await fetch(
        `${api}/dental/organizations/${o.orgId}/branches/${o.branchId}/members/${memberId}/set-pin`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ pin: o.pin }),
        },
      );
      if (!res.ok) throw new Error(`set-pin failed: ${res.status} ${await res.text().catch(() => '')}`);
    }, { api: API, o: opts, memberId });
  }

  return memberId;
}

/**
 * Onboard an org via the canonical self-service helper (owner = "E2E Dentist",
 * PIN 123456), then add ONE extra staff_full member ("Staff Ana Cruz", PIN 123456).
 * Returns the staff member's id (the subject of the PIN tests).
 */
async function seedOrgAndStaff(page: Page): Promise<{ orgId: string; branchId: string; memberId: string }> {
  const { orgId, branchId } = await setupDentalOrg(page);
  const memberId = await addMemberWithPin(page, {
    orgId,
    branchId,
    displayName: 'Staff Ana Cruz',
    role: 'staff_full',
    pin: '123456',
  });
  return { orgId, branchId, memberId };
}

/**
 * Onboard an org, then add a second dentist_owner member ("Dr. Maria Reyes",
 * PIN 654321). Returns that owner member's id.
 */
async function seedOrgAndOwnerMember(page: Page): Promise<{ orgId: string; branchId: string; memberId: string }> {
  const { orgId, branchId } = await setupDentalOrg(page);
  const memberId = await addMemberWithPin(page, {
    orgId,
    branchId,
    displayName: 'Dr. Maria Reyes',
    role: 'dentist_owner',
    pin: '654321',
  });
  return { orgId, branchId, memberId };
}

/**
 * Onboard an org. setupDentalOrg leaves the branch with exactly ONE member (the
 * onboarded owner "E2E Dentist", PIN 123456), which triggers FR9.2 auto-select.
 * Returns that single owner member's id.
 */
async function seedOrgWithSingleMember(page: Page): Promise<{ orgId: string; branchId: string; memberId: string }> {
  const { orgId, branchId, memberId } = await setupDentalOrg(page);
  return { orgId, branchId, memberId };
}

test.describe('PIN authentication flow', () => {
  test('owner can set up staff and staff can select profile', async ({ page }) => {
    const { orgId, branchId } = await seedOrgAndStaff(page);

    // Add a second member so the selection screen is shown (FR9.2 auto-select skips with 1 member)
    await page.evaluate(async ({ api, orgId, branchId }: { api: string; orgId: string; branchId: string }) => {
      await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: 'Dr. Juan Santos', role: 'dentist_associate' }),
      });
    }, { api: API, orgId, branchId });

    // Navigate to PIN select screen
    await page.goto(`${APP}/auth/pin-select`);

    // Should show the staff member card
    await expect(page.getByText('Staff Ana Cruz')).toBeVisible({ timeout: 15000 });
  });

  test('selecting a member card navigates to PIN entry', async ({ page }) => {
    const { orgId, branchId } = await seedOrgAndStaff(page);

    // Add second member to disable auto-select
    await page.evaluate(async ({ api, orgId, branchId }: { api: string; orgId: string; branchId: string }) => {
      await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: 'Dr. Juan Santos', role: 'dentist_associate' }),
      });
    }, { api: API, orgId, branchId });

    await page.goto(`${APP}/auth/pin-select`);

    // Click the staff member card (wait for it to render first)
    const staffCard = page.getByRole('button', { name: /Sign in as Staff Ana Cruz/i });
    await expect(staffCard).toBeVisible({ timeout: 15000 });
    await staffCard.click();

    // Should navigate to PIN entry screen
    await expect(page.getByText('Staff Ana Cruz')).toBeVisible();
    // PIN keypad should be visible
    await expect(page.getByLabel('1')).toBeVisible();
  });

  test('entering correct PIN as dentist_owner reaches /dashboard', async ({ page }) => {
    const { memberId } = await seedOrgAndOwnerMember(page);

    // Navigate directly to pin-entry for the owner member (FR9.2 auto-selects for single member too)
    await page.goto(`${APP}/auth/pin-entry/${memberId}`);
    await expect(page.getByLabel('1')).toBeVisible({ timeout: 15000 });

    // Enter PIN 6-5-4-3-2-1
    for (const digit of ['6', '5', '4', '3', '2', '1']) {
      await page.getByRole('button', { name: new RegExp(`^${digit}$`) }).click();
    }

    // dentist_owner should land on /dashboard (FR9.3)
    await page.waitForURL(/\/dashboard/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('wrong PIN shows error message', async ({ page }) => {
    const { memberId } = await seedOrgAndStaff(page);

    // Navigate directly to pin-entry
    await page.goto(`${APP}/auth/pin-entry/${memberId}`);
    await expect(page.getByLabel('1')).toBeVisible({ timeout: 15000 });

    // Enter wrong PIN
    for (const digit of ['9', '9', '9', '9', '9', '9']) {
      await page.getByRole('button', { name: new RegExp(`^${digit}$`) }).click();
    }

    // Should show error
    await expect(page.getByText(/incorrect pin/i)).toBeVisible({ timeout: 3000 });
  });

  test('FR9.3: staff_full correct PIN lands on /patients (not /dashboard)', async ({ page }) => {
    const { memberId } = await seedOrgAndStaff(page);

    // Navigate directly to pin-entry
    await page.goto(`${APP}/auth/pin-entry/${memberId}`);
    await expect(page.getByLabel('1')).toBeVisible({ timeout: 15000 });

    // Enter correct PIN
    for (const digit of ['1', '2', '3', '4', '5', '6']) {
      await page.getByRole('button', { name: new RegExp(`^${digit}$`) }).click();
    }

    // staff_full should land on /patients, not /dashboard (FR9.3)
    await page.waitForURL(/\/patients/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/patients/);
  });

  test('FR9.7: "Forgot PIN?" link appears after 3 failed attempts', async ({ page }) => {
    const { memberId } = await seedOrgAndStaff(page);

    // Navigate directly to pin-entry
    await page.goto(`${APP}/auth/pin-entry/${memberId}`);
    await expect(page.getByLabel('1')).toBeVisible({ timeout: 15000 });

    // Enter wrong PIN 3 times
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const digit of ['9', '9', '9', '9', '9', '9']) {
        await page.getByRole('button', { name: new RegExp(`^${digit}$`) }).click();
      }
      await page.waitForResponse(resp => resp.url().includes('verify-pin'), { timeout: 5000 }).catch(() => {});
    }

    // "Forgot PIN?" should be visible after 3 fails (FR9.7)
    await expect(page.getByTestId('forgot-pin-link')).toBeVisible({ timeout: 5000 });
  });

  test('FR9.2: single member auto-navigates to PIN entry', async ({ page }) => {
    await seedOrgWithSingleMember(page); // exactly 1 member in this branch

    // Navigate to pin-select — should auto-redirect to pin-entry for the single member
    await page.goto(`${APP}/auth/pin-select`);

    // Should land on pin-entry without requiring a click (FR9.2 auto-select)
    await expect(page).toHaveURL(/\/auth\/pin-entry\//, { timeout: 8000 });
    // PIN keypad should be visible
    await expect(page.getByLabel('1')).toBeVisible();
  });
});
