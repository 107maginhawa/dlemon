/**
 * E2E (P1-24 Slice B): recall (recare) due engine + front-desk due-list.
 *
 * Persona: front-desk staff. ACs closed:
 *   - an overdue recall surfaces in GET /dental/recalls/due (branch-scoped)
 *   - the calendar "Recare due" panel RENDERS due + OVERDUE recalls (UI, not just API)
 *   - "Reach out" (manual override) flips the recall to 'sent'
 *   - completing a recurring recall seeds the next-cycle pending recall
 *
 * Recall DISPATCH (the cron job) is covered by the backend suite; here we verify
 * the due-list + lifecycle E2E through the real API AND the real rendered UI.
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

/** YYYY-MM-DD for today + `delta` days (local runner clock). */
function isoDay(delta: number): string {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Seed a branch patient + a recall at `dueDate`. Returns the ids. */
async function seedPatientRecall(
  page: Page,
  branchId: string,
  opts: { displayName: string; dueDate: string },
): Promise<{ patientId: string; recallId: string }> {
  return page.evaluate(
    async ({ api, branchId, displayName, dueDate }) => {
      const patient = await fetch(`${api}/dental/patients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ displayName, branchId, consentGiven: true }),
      }).then((r) => r.json() as any);
      // Assign to the branch so the branch-scoped due-list / recall handlers permit access.
      await fetch(`${api}/dental/patients/${patient.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ preferredBranchId: branchId }),
      });
      const recall = await fetch(`${api}/dental/patients/${patient.id}/recalls`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ type: 'cleaning', dueDate, intervalMonths: 6 }),
      }).then((r) => r.json() as any);
      return { patientId: patient.id, recallId: recall.id };
    },
    { api: API, branchId, displayName: opts.displayName, dueDate: opts.dueDate },
  );
}

test.describe('Recare due engine + due-list (P1-24 Slice B)', () => {
  test('calendar Recare panel RENDERS overdue + due-soon recalls (front-desk chase list)', async ({ page }) => {
    const { branchId } = await signUpOnboardAndUnlock(page, { label: 'Recare', tier: 'clinic' });

    // One deeply-overdue recall (the most urgent to chase) and one due in 10 days.
    await seedPatientRecall(page, branchId, { displayName: 'Overdue Olivia', dueDate: isoDay(-60) });
    await seedPatientRecall(page, branchId, { displayName: 'Duesoon Dexter', dueDate: isoDay(10) });

    await spaNavigate(page, '/calendar');
    await page.getByRole('button', { name: /toggle recare due-list/i }).click();

    const panel = page.getByRole('dialog', { name: /recare due-list/i });
    await expect(panel.getByTestId('recall-due-list')).toBeVisible();

    // Both surface in the front-desk recare queue. The OVERDUE patient is the
    // regression guard: a default due-window of [today, +30d] silently drops
    // overdue recalls — the patients who most need outreach (P1-24 "Overdue" is a
    // V1-required recare category). Both rows must render with the real patient name.
    await expect(panel.getByText('Overdue Olivia')).toBeVisible();
    await expect(panel.getByText('Duesoon Dexter')).toBeVisible();
    await expect(panel.getByTestId('recall-due-row')).toHaveCount(2);
  });

  test('overdue recall surfaces in due-list API, reach-out flips to sent', async ({ page }) => {
    const { branchId } = await signUpOnboardAndUnlock(page, { label: 'RecareApi', tier: 'clinic' });
    const { patientId, recallId } = await seedPatientRecall(page, branchId, {
      displayName: 'Api Patient', dueDate: '2024-01-01',
    });

    const result = await page.evaluate(
      async ({ api, branchId, patientId, recallId }) => {
        const due = await fetch(
          `${api}/dental/recalls/due?branchId=${branchId}&from=2000-01-01&to=2999-12-31`,
          { credentials: 'include' },
        ).then((r) => r.json() as any);
        const inList = Array.isArray(due) && due.some((d: any) => d.id === recallId);

        const sent = await fetch(`${api}/dental/patients/${patientId}/recalls/${recallId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ status: 'sent' }),
        }).then((r) => r.json() as any);

        return { inList, sentStatus: sent?.status };
      },
      { api: API, branchId, patientId, recallId },
    );

    expect(result.inList).toBe(true);
    expect(result.sentStatus).toBe('sent');
  });

  test('completing a recurring recall seeds the next-cycle pending recall', async ({ page }) => {
    const { branchId } = await signUpOnboardAndUnlock(page, { label: 'RecareCycle', tier: 'clinic' });
    const { patientId, recallId } = await seedPatientRecall(page, branchId, {
      displayName: 'Recurring Patient', dueDate: '2024-01-01',
    });

    const result = await page.evaluate(
      async ({ api, patientId, recallId }) => {
        // pending → sent → completed (FSM); completion seeds the next cycle.
        await fetch(`${api}/dental/patients/${patientId}/recalls/${recallId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ status: 'sent' }),
        });
        await fetch(`${api}/dental/patients/${patientId}/recalls/${recallId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ status: 'completed' }),
        });
        const all = await fetch(`${api}/dental/patients/${patientId}/recalls`, { credentials: 'include' })
          .then((r) => r.json() as any);
        const pending = Array.isArray(all) ? all.filter((r: any) => r.status === 'pending') : [];
        return { pendingCount: pending.length, hasInterval: pending.some((p: any) => p.intervalMonths === 6) };
      },
      { api: API, patientId, recallId },
    );

    expect(result.pendingCount).toBeGreaterThanOrEqual(1);
    expect(result.hasInterval).toBe(true);
  });
});
