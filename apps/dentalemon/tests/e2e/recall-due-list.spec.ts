/**
 * E2E (P1-24 Slice B): recall (recare) due engine + due-list.
 *
 * Persona: front-desk staff. ACs closed:
 *   - an overdue recall surfaces in GET /dental/recalls/due (branch-scoped)
 *   - "Reach out" (manual override) flips the recall to 'sent'
 *   - completing a recurring recall seeds the next-cycle pending recall
 *
 * Mirrors calendar-riley.spec.ts setup. Recall DISPATCH (the cron job) is
 * covered by the backend suite; here we verify the due-list + lifecycle E2E
 * through the real API.
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function signUpAndSeedOrg(page: Page) {
  const suffix = Date.now();
  const email = `recare-e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Recare Staff ${suffix}`);
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
      body: JSON.stringify({ firstName: 'Recare', lastName: 'Staff' }),
    });
  }, API);

  // Provision org + default branch + dentist_owner membership in ONE self-service
  // call (org creation is admin-only now — EM-ORG-002). The caller becomes owner.
  const onb = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/onboarding`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({
        organizationName: 'Recare Test Clinic', tier: 'clinic', countryCode: 'PH',
        branchName: 'Main Branch', timezone: 'Asia/Manila', ownerDisplayName: 'Recare Staff',
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

test.describe('Recare due engine + due-list (P1-24 Slice B)', () => {
  test('overdue recall surfaces in due-list, reach-out flips to sent', async ({ page }) => {
    const { branchId } = await signUpAndSeedOrg(page);

    const result = await page.evaluate(async ({ api, branchId }: { api: string; branchId: string }) => {
      const patient = await fetch(`${api}/dental/patients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ displayName: 'Recare Patient', branchId, consentGiven: true }),
      }).then((r) => r.json() as any);

      // Assign the patient to the branch so the branch-scoped recall handlers permit access.
      await fetch(`${api}/dental/patients/${patient.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ preferredBranchId: branchId }),
      });

      // Create an overdue recurring recall.
      const recall = await fetch(`${api}/dental/patients/${patient.id}/recalls`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ type: 'cleaning', dueDate: '2024-01-01', intervalMonths: 6 }),
      }).then((r) => r.json() as any);

      // Due-list shows it.
      const due = await fetch(`${api}/dental/recalls/due?branchId=${branchId}&from=2000-01-01&to=2999-12-31`, { credentials: 'include' })
        .then((r) => r.json() as any);
      const inList = Array.isArray(due) && due.some((d: any) => d.id === recall.id);

      // Reach out (manual override) → sent.
      const sent = await fetch(`${api}/dental/patients/${patient.id}/recalls/${recall.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status: 'sent' }),
      }).then((r) => r.json() as any);

      return { inList, sentStatus: sent?.status, patientId: patient.id, recallId: recall.id };
    }, { api: API, branchId });

    if (!result) throw new Error('Seeding failed');
    expect(result.inList).toBe(true);
    expect(result.sentStatus).toBe('sent');
  });

  test('completing a recurring recall seeds the next-cycle pending recall', async ({ page }) => {
    const { branchId } = await signUpAndSeedOrg(page);

    const result = await page.evaluate(async ({ api, branchId }: { api: string; branchId: string }) => {
      const patient = await fetch(`${api}/dental/patients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ displayName: 'Recurring Patient', branchId, consentGiven: true }),
      }).then((r) => r.json() as any);
      await fetch(`${api}/dental/patients/${patient.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ preferredBranchId: branchId }),
      });
      const recall = await fetch(`${api}/dental/patients/${patient.id}/recalls`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ type: 'cleaning', dueDate: '2024-01-01', intervalMonths: 6 }),
      }).then((r) => r.json() as any);

      // pending → sent → completed (FSM); completion seeds the next cycle.
      await fetch(`${api}/dental/patients/${patient.id}/recalls/${recall.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status: 'sent' }),
      });
      await fetch(`${api}/dental/patients/${patient.id}/recalls/${recall.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status: 'completed' }),
      });

      const all = await fetch(`${api}/dental/patients/${patient.id}/recalls`, { credentials: 'include' })
        .then((r) => r.json() as any);
      const pending = Array.isArray(all) ? all.filter((r: any) => r.status === 'pending') : [];
      return { pendingCount: pending.length, hasInterval: pending.some((p: any) => p.intervalMonths === 6) };
    }, { api: API, branchId });

    if (!result) throw new Error('Seeding failed');
    expect(result.pendingCount).toBeGreaterThanOrEqual(1);
    expect(result.hasInterval).toBe(true);
  });
});
