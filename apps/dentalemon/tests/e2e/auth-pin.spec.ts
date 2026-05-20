/**
 * E2E: PIN authentication flow
 *
 * Business Rules:
 * - FR9.2: User selection screen shows cards with avatar, name, role badge; single user = auto-select
 * - FR9.3: Role-based landing: dentist_owner → /dashboard, staff_full → /patients, staff_scheduling → /calendar
 * - FR9.7: After 3 fails, "Forgot PIN?" link appears
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

/**
 * Sign up as practice owner and return session cookies
 */
async function signUpOwner(page: Page) {
  const suffix = Date.now();
  const email = `pin-e2e-owner-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`PIN Owner ${suffix}`);
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
  const response = await signupResponse;
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up POST returned ${response.status()}: ${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

  // Create person profile to bypass onboarding redirect
  await page.evaluate(async (api) => {
    await fetch(`${api}/persons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ firstName: 'PIN', lastName: 'Owner' }),
    });
  }, API);

  return { email, password };
}

/**
 * Seed org, branch, and one staff_full member via API (uses existing browser session)
 */
async function seedOrgAndStaff(page: Page): Promise<{ orgId: string; branchId: string; memberId: string }> {
  const orgRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'PIN Test Clinic', tier: 'solo', countryCode: 'PH' }),
    });
    return res.json();
  }, API);
  const orgId = orgRes.id;

  const branchRes = await page.evaluate(async ({ api, orgId }: { api: string; orgId: string }) => {
    const res = await fetch(`${api}/dental/organizations/${orgId}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Main Clinic', timezone: 'Asia/Manila' }),
    });
    return res.json();
  }, { api: API, orgId });
  const branchId = branchRes.id;

  await page.evaluate(({ branchId, orgId }: { branchId: string; orgId: string }) => {
    localStorage.setItem('currentBranchId', branchId);
    localStorage.setItem('currentOrgId', orgId);
  }, { branchId, orgId });

  // Create owner membership so assertBranchAccess passes in listMembers
  await page.evaluate(async ({ api, orgId, branchId }: { api: string; orgId: string; branchId: string }) => {
    const sessionRes = await fetch(`${api}/auth/get-session`, { credentials: 'include' });
    const session = await sessionRes.json() as any;
    const personId = session?.user?.id;
    if (personId) {
      await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: 'Clinic Owner', role: 'dentist_owner', personId }),
      });
    }
  }, { api: API, orgId, branchId });

  const memberRes = await page.evaluate(async ({ api, orgId, branchId }: { api: string; orgId: string; branchId: string }) => {
    const res = await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: 'Staff Ana Cruz', role: 'staff_full' }),
    });
    return res.json();
  }, { api: API, orgId, branchId });
  const memberId = memberRes.id;

  await page.evaluate(async ({ api, orgId, branchId, memberId }: { api: string; orgId: string; branchId: string; memberId: string }) => {
    await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members/${memberId}/set-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pin: '123456' }),
    });
  }, { api: API, orgId, branchId, memberId });

  return { orgId, branchId, memberId };
}

/**
 * Seed org, branch, and ONE dentist_owner member via API
 */
async function seedOrgAndOwnerMember(page: Page): Promise<{ orgId: string; branchId: string; memberId: string }> {
  const orgRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Owner PIN Test Clinic', tier: 'solo', countryCode: 'PH' }),
    });
    return res.json();
  }, API);
  const orgId = orgRes.id;

  const branchRes = await page.evaluate(async ({ api, orgId }: { api: string; orgId: string }) => {
    const res = await fetch(`${api}/dental/organizations/${orgId}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Main Clinic', timezone: 'Asia/Manila' }),
    });
    return res.json();
  }, { api: API, orgId });
  const branchId = branchRes.id;

  await page.evaluate(({ branchId, orgId }: { branchId: string; orgId: string }) => {
    localStorage.setItem('currentBranchId', branchId);
    localStorage.setItem('currentOrgId', orgId);
  }, { branchId, orgId });

  // Create owner membership so assertBranchAccess passes in listMembers
  await page.evaluate(async ({ api, orgId, branchId }: { api: string; orgId: string; branchId: string }) => {
    const sessionRes = await fetch(`${api}/auth/get-session`, { credentials: 'include' });
    const session = await sessionRes.json() as any;
    const personId = session?.user?.id;
    if (personId) {
      await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: 'Clinic Owner', role: 'dentist_owner', personId }),
      });
    }
  }, { api: API, orgId, branchId });

  const memberRes = await page.evaluate(async ({ api, orgId, branchId }: { api: string; orgId: string; branchId: string }) => {
    const res = await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: 'Dr. Maria Reyes', role: 'dentist_owner' }),
    });
    return res.json();
  }, { api: API, orgId, branchId });
  const memberId = memberRes.id;

  await page.evaluate(async ({ api, orgId, branchId, memberId }: { api: string; orgId: string; branchId: string; memberId: string }) => {
    await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members/${memberId}/set-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pin: '654321' }),
    });
  }, { api: API, orgId, branchId, memberId });

  return { orgId, branchId, memberId };
}

/**
 * Seed org, branch, and exactly ONE member (the session user as dentist_owner).
 * This satisfies assertBranchAccess AND triggers FR9.2 auto-select (single member).
 */
async function seedOrgWithSingleMember(page: Page): Promise<{ orgId: string; branchId: string; memberId: string }> {
  const orgRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Single Member Clinic', tier: 'solo', countryCode: 'PH' }),
    });
    return res.json();
  }, API);
  const orgId = orgRes.id;

  const branchRes = await page.evaluate(async ({ api, orgId }: { api: string; orgId: string }) => {
    const res = await fetch(`${api}/dental/organizations/${orgId}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Main Clinic', timezone: 'Asia/Manila' }),
    });
    return res.json();
  }, { api: API, orgId });
  const branchId = branchRes.id;

  await page.evaluate(({ branchId, orgId }: { branchId: string; orgId: string }) => {
    localStorage.setItem('currentBranchId', branchId);
    localStorage.setItem('currentOrgId', orgId);
  }, { branchId, orgId });

  // Create single owner membership with personId (satisfies assertBranchAccess)
  const memberRes = await page.evaluate(async ({ api, orgId, branchId }: { api: string; orgId: string; branchId: string }) => {
    const sessionRes = await fetch(`${api}/auth/get-session`, { credentials: 'include' });
    const session = await sessionRes.json() as any;
    const personId = session?.user?.id;
    const res = await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: 'Solo Dentist', role: 'dentist_owner', personId }),
    });
    return res.json();
  }, { api: API, orgId, branchId });
  const memberId = memberRes.id;

  // Set PIN for the single member
  await page.evaluate(async ({ api, orgId, branchId, memberId }: { api: string; orgId: string; branchId: string; memberId: string }) => {
    await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members/${memberId}/set-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pin: '111111' }),
    });
  }, { api: API, orgId, branchId, memberId });

  return { orgId, branchId, memberId };
}

test.describe('PIN authentication flow', () => {
  test('owner can set up staff and staff can select profile', async ({ page }) => {
    await signUpOwner(page);
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
    await page.waitForLoadState('networkidle');

    // Should show the staff member card
    await expect(page.getByText('Staff Ana Cruz')).toBeVisible();
  });

  test('selecting a member card navigates to PIN entry', async ({ page }) => {
    await signUpOwner(page);
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
    await page.waitForLoadState('networkidle');

    // Click the staff member card
    await page.getByRole('button', { name: /Sign in as Staff Ana Cruz/i }).click();

    // Should navigate to PIN entry screen
    await expect(page.getByText('Staff Ana Cruz')).toBeVisible();
    // PIN keypad should be visible
    await expect(page.getByLabel('1')).toBeVisible();
  });

  test('entering correct PIN as dentist_owner reaches /dashboard', async ({ page }) => {
    await signUpOwner(page);
    const { memberId } = await seedOrgAndOwnerMember(page);

    // Navigate directly to pin-entry for the owner member (FR9.2 auto-selects for single member too)
    await page.goto(`${APP}/auth/pin-entry/${memberId}`);
    await page.waitForLoadState('networkidle');

    // Enter PIN 6-5-4-3-2-1
    for (const digit of ['6', '5', '4', '3', '2', '1']) {
      await page.getByRole('button', { name: new RegExp(`^${digit}$`) }).click();
    }

    // dentist_owner should land on /dashboard (FR9.3)
    await page.waitForURL(/\/dashboard/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('wrong PIN shows error message', async ({ page }) => {
    await signUpOwner(page);
    const { memberId } = await seedOrgAndStaff(page);

    // Navigate directly to pin-entry
    await page.goto(`${APP}/auth/pin-entry/${memberId}`);
    await page.waitForLoadState('networkidle');

    // Enter wrong PIN
    for (const digit of ['9', '9', '9', '9', '9', '9']) {
      await page.getByRole('button', { name: new RegExp(`^${digit}$`) }).click();
    }

    // Should show error
    await expect(page.getByText(/incorrect pin/i)).toBeVisible({ timeout: 3000 });
  });

  test('FR9.3: staff_full correct PIN lands on /patients (not /dashboard)', async ({ page }) => {
    await signUpOwner(page);
    const { memberId } = await seedOrgAndStaff(page);

    // Navigate directly to pin-entry
    await page.goto(`${APP}/auth/pin-entry/${memberId}`);
    await page.waitForLoadState('networkidle');

    // Enter correct PIN
    for (const digit of ['1', '2', '3', '4', '5', '6']) {
      await page.getByRole('button', { name: new RegExp(`^${digit}$`) }).click();
    }

    // staff_full should land on /patients, not /dashboard (FR9.3)
    await page.waitForURL(/\/patients/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/patients/);
  });

  test('FR9.7: "Forgot PIN?" link appears after 3 failed attempts', async ({ page }) => {
    await signUpOwner(page);
    const { memberId } = await seedOrgAndStaff(page);

    // Navigate directly to pin-entry
    await page.goto(`${APP}/auth/pin-entry/${memberId}`);
    await page.waitForLoadState('networkidle');

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
    await signUpOwner(page);
    await seedOrgWithSingleMember(page); // exactly 1 member in this branch

    // Navigate to pin-select — should auto-redirect to pin-entry for the single member
    await page.goto(`${APP}/auth/pin-select`);

    // Should land on pin-entry without requiring a click (FR9.2 auto-select)
    await expect(page).toHaveURL(/\/auth\/pin-entry\//, { timeout: 8000 });
    // PIN keypad should be visible
    await expect(page.getByLabel('1')).toBeVisible();
  });
});
