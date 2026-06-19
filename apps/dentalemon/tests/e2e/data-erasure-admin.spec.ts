/**
 * Data Erasure admin queue — E2E (data-governance Batch E, decision #1 + C-4).
 *
 * Proves the V1 operator surface end-to-end: a PLATFORM ADMIN opens
 * Settings → Data Erasure and Approves one right-to-erasure request (→ anonymized)
 * and Rejects another (→ rejected) for the same patient subject, with an
 * independent API read of the durable aggregate confirming both transitions.
 *
 * Setup: a fresh clinic owner self-onboards, is promoted to the platform `admin`
 * role (erasure endpoints are admin-gated; the dev-only /dev/promote-admin mirrors
 * the AUTH_ADMIN_EMAILS auto-promotion), registers a patient (C-4: erasure is
 * patients-only — the subject MUST have a patient anchor), and seeds two requests
 * via the admin API (there is no FE create path — clinic-owner-initiated requests
 * are deferred to Phase-2). Re-unlocking hard-loads the PIN gate so the app's
 * useSession refetches the new admin role before the queue is driven.
 */
import { test, expect } from '@playwright/test';
import { signUpOnboardAndUnlock, API, unlockWorkspace, spaNavigate } from './helpers/e2e-seed';

test.describe('Data Erasure admin queue', () => {
  test('platform admin approves + rejects patient erasure requests through Settings', async ({ page }) => {
    const PIN = '135790';
    const { orgId, branchId } = await signUpOnboardAndUnlock(page, { label: 'Erasure', pin: PIN });

    // Promote the fresh owner to the platform admin role (erasure is admin-gated).
    const promote = await page.request.post(`${API}/dev/promote-admin`);
    expect(promote.ok(), `promote-admin: ${promote.status()}`).toBeTruthy();

    // Register the erasure subject — a real patient (C-4 patients-only).
    const patientRes = await page.request.post(`${API}/dental/patients`, {
      headers: { 'Content-Type': 'application/json' },
      data: { displayName: 'Erasure Subject', dateOfBirth: '1985-06-15', gender: 'female', consentGiven: true, branchId },
    });
    expect(patientRes.ok(), `create patient: ${patientRes.status()}`).toBeTruthy();
    const patient = await patientRes.json();
    const personId = patient.person.id as string;
    const patientId = patient.id as string;

    // Seed two erasure requests for this subject (admin API; FIX-001 resolves the
    // tenant from the patient's branch → must match orgId).
    const mkReq = async (reason: string) => {
      const r = await page.request.post(`${API}/dental/erasure-requests`, {
        headers: { 'Content-Type': 'application/json' },
        data: { subjectPersonId: personId, subjectPatientId: patientId, tenantId: orgId, reason },
      });
      expect(r.ok(), `erasure request create: ${r.status()} ${await r.text().catch(() => '')}`).toBeTruthy();
    };
    await mkReq('Art.17 erasure — approve leg');
    await mkReq('Art.17 erasure — reject leg');

    // Re-unlock: unlockWorkspace hard-loads /auth/pin-select, so the app re-mounts
    // and useSession refetches the now-admin role before the panel reads it.
    await unlockWorkspace(page, PIN);
    await spaNavigate(page, '/settings');

    // Open the Data Erasure panel (platform-admin gated). The settings switcher
    // is an ARIA tablist (a11y Batch 1 / commit 2b6e8087: button->role="tab"),
    // so the panel switch resolves by role 'tab', not 'button'.
    await page.getByRole('tab', { name: 'Data Erasure', exact: true }).click();
    await expect(page.getByTestId('data-erasure-table')).toBeVisible({ timeout: 15_000 });

    // Scope to THIS run's subject — the platform-wide queue may carry other rows.
    const shortId = personId.slice(0, 8);
    const myRows = () => page.getByTestId('data-erasure-row').filter({ hasText: shortId });
    await expect(myRows()).toHaveCount(2);
    // Both rows must carry the server-resolved tenant attribution (FIX-001).
    await expect(myRows().first()).toContainText(orgId.slice(0, 8));

    // Approve the first requested row → it leaves the requested set.
    await myRows().filter({ has: page.getByTestId('data-erasure-approve') }).first()
      .getByTestId('data-erasure-approve').click();
    await expect(myRows().getByTestId('data-erasure-approve')).toHaveCount(1);

    // Reject the remaining requested row with a reason → none left requested.
    const remaining = myRows().filter({ has: page.getByTestId('data-erasure-approve') }).first();
    await remaining.getByTestId('data-erasure-reject-reason').fill('Insufficient documentation');
    await remaining.getByTestId('data-erasure-reject').click();
    await expect(myRows().getByTestId('data-erasure-approve')).toHaveCount(0);

    // Independent read of the durable aggregate: one anonymized + one rejected.
    const list = await page.request.get(`${API}/dental/erasure-requests?subjectPersonId=${personId}`);
    expect(list.ok()).toBeTruthy();
    const rows = ((await list.json()).data ?? []) as Array<{ status: string }>;
    expect(rows.map((r) => r.status).sort()).toEqual(['anonymized', 'rejected']);
  });
});
