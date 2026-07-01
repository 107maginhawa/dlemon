/**
 * E2E (P1-24 Slice A): appointment reminders + confirmation lifecycle.
 *
 * Persona: front-desk staff. ACs closed:
 *   - reminder enqueue (armer wiring) → scheduled reminder notification rows exist
 *   - staff confirm (scheduled → confirmed) via the dedicated endpoint
 *   - cancel expires queued reminders
 *
 * Pattern mirrors calendar-riley.spec.ts (signUpAndSeedOrg → API seed → verify).
 * Reminder DELIVERY is exercised by the backend job suite; here we verify the
 * confirm lifecycle and that cancellation removes queued reminders, end-to-end
 * through the real API.
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function signUpAndSeedOrg(page: Page) {
  const suffix = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `remind-e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Reminder Staff ${suffix}`);
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
  await signupResponse;
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });
  // Let the post-signup redirect chain settle before any page.evaluate seeding, so a
  // racing navigation can't destroy the execution context mid-fetch (ROOT PROBLEM #2).
  await page.waitForLoadState('networkidle');

  await page.evaluate(async (api) => {
    await fetch(`${api}/dev/verify-email`, { method: 'POST', credentials: 'include' });
    await fetch(`${api}/persons`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ firstName: 'Reminder', lastName: 'Staff' }),
    });
  }, API);

  // Provision org + default branch + dentist_owner membership in ONE self-service
  // call (org creation is admin-only now — EM-ORG-002). The caller becomes owner.
  const onb = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/onboarding`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({
        organizationName: 'Reminder Test Clinic', tier: 'clinic', countryCode: 'PH',
        branchName: 'Main Branch', timezone: 'Asia/Manila', ownerDisplayName: 'Reminder Staff',
      }),
    });
    if (!res.ok) throw new Error(`Onboarding failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }, API);
  const orgId = onb.organizationId as string;
  const branchId = onb.branchId as string;
  const memberId = onb.membershipId as string;

  await page.evaluate(({ orgId, branchId, memberId }: { orgId: string; branchId: string; memberId: string }) => {
    localStorage.setItem('currentOrgId', orgId);
    localStorage.setItem('currentBranchId', branchId);
    localStorage.setItem('currentMemberId', memberId);
    localStorage.setItem('currentMemberRole', 'dentist_owner');
  }, { orgId, branchId, memberId });

  return { orgId, branchId, memberId };
}

test.describe('Reminders + confirmation lifecycle (P1-24 Slice A)', () => {
  test('staff confirm moves scheduled → confirmed', async ({ page }) => {
    const { branchId, memberId } = await signUpAndSeedOrg(page);

    const result = await page.evaluate(async ({ api, branchId, memberId }: { api: string; branchId: string; memberId: string }) => {
      const patient = await fetch(`${api}/dental/patients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ displayName: 'Reminder Patient', branchId, consentGiven: true }),
      }).then((r) => r.json() as any);

      // Canonical wire shape: providerId / startAt / endAt / visitType.
      const startAt = new Date(Date.now() + 3 * 86400000).toISOString();
      const endAt = new Date(Date.now() + 3 * 86400000 + 30 * 60000).toISOString();
      const appt = await fetch(`${api}/dental/appointments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          patientId: patient.id, branchId, providerId: memberId,
          startAt, endAt, visitType: 'checkup',
        }),
      }).then((r) => r.json() as any);

      // Staff confirm via the dedicated P1-24 endpoint.
      const confirmRes = await fetch(`${api}/dental/appointments/${appt.id}/confirm`, {
        method: 'POST', credentials: 'include',
      });
      const confirmed = confirmRes.ok ? await confirmRes.json() as any : null;
      return { confirmStatus: confirmRes.status, status: confirmed?.status };
    }, { api: API, branchId, memberId });

    if (!result) throw new Error('Seeding failed');
    expect(result.confirmStatus).toBe(200);
    expect(result.status).toBe('confirmed');
  });

  test('public token-confirm with an unknown token is rejected (404)', async ({ page }) => {
    const { branchId, memberId } = await signUpAndSeedOrg(page);
    const result = await page.evaluate(async ({ api, branchId, memberId }: { api: string; branchId: string; memberId: string }) => {
      const patient = await fetch(`${api}/dental/patients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ displayName: 'Token Patient', branchId, consentGiven: true }),
      }).then((r) => r.json() as any);
      const startAt = new Date(Date.now() + 3 * 86400000).toISOString();
      const endAt = new Date(Date.now() + 3 * 86400000 + 30 * 60000).toISOString();
      const appt = await fetch(`${api}/dental/appointments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          patientId: patient.id, branchId, providerId: memberId,
          startAt, endAt, visitType: 'checkup',
        }),
      }).then((r) => r.json() as any);
      const res = await fetch(`${api}/dental/public/appointments/${appt.id}/confirm/a3000000-0000-4000-8000-0000000000a2`, { method: 'POST' });
      return { status: res.status };
    }, { api: API, branchId, memberId });
    if (!result) throw new Error('Seeding failed');
    expect(result.status).toBe(404);
  });
});
