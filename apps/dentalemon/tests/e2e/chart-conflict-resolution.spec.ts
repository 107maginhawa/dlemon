/**
 * E2E: Offline chart conflict visibility & resolution (P0-A)
 *
 * The server rejects a stale offline chart write (lower per-tooth clock) and
 * persists it as a conflict (syncStatus='conflict' + conflictPayload) instead of
 * silently dropping it. Before P0-A nothing could see or resolve them — dropped
 * clinical edits accumulated invisibly. This spec drives the REAL banner:
 *   - seed a conflict via the API (baseline #18 @clock10, then a stale #18 @clock3),
 *   - load the workspace → the conflict banner surfaces the rejected tooth,
 *   - Accept the offline edit → the conflict clears and the banner disappears.
 *
 * Self-seeding: org + owner via /dental/onboarding (signUpOnboardAndUnlock).
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

const CONFLICT_TOOTH = 18;

async function seedConflict(page: Page, opts: { branchId: string; memberId: string }): Promise<string> {
  const result = await page.evaluate(
    async ({ api, branchId, memberId, tooth }) => {
      const j = (body: unknown) => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' as const,
        body: JSON.stringify(body),
      });
      const patch = (body: unknown) => ({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' as const,
        body: JSON.stringify(body),
      });
      const fail = async (label: string, res: Response) =>
        ({ error: `${label} ${res.status}: ${(await res.text()).slice(0, 200)}` });

      const patientRes = await fetch(`${api}/dental/patients`, j({
        displayName: 'Conflict E2E Patient', branchId, consentGiven: true,
      }));
      if (!patientRes.ok) return fail('patient', patientRes);
      const patient = await patientRes.json() as { id: string };

      const vRes = await fetch(`${api}/dental/visits`, j({
        patientId: patient.id, branchId, dentistMemberId: memberId,
      }));
      if (!vRes.ok) return fail('visit', vRes);
      const visit = await vRes.json() as { id: string };
      await fetch(`${api}/dental/visits/${visit.id}`, patch({ status: 'active' }));

      // Baseline: tooth = crown @ clock 10 (the newer edit).
      const seedRes = await fetch(`${api}/dental/visits/${visit.id}/chart`, j({
        visitId: visit.id, patientId: patient.id, teeth: [{ toothNumber: tooth, state: 'crown', clock: 10 }],
      }));
      if (!seedRes.ok) return fail('seed-baseline', seedRes);

      // Stale offline write: tooth = caries @ clock 3 → loses the merge → conflict.
      const staleRes = await fetch(`${api}/dental/visits/${visit.id}/chart`, j({
        visitId: visit.id, patientId: patient.id, teeth: [{ toothNumber: tooth, state: 'caries', clock: 3 }],
      }));
      if (!staleRes.ok) return fail('seed-stale', staleRes);
      const stale = await staleRes.json() as { syncStatus: string };
      if (stale.syncStatus !== 'conflict') return { error: `expected conflict, got ${stale.syncStatus}` };

      return { patientId: patient.id };
    },
    { api: API, branchId: opts.branchId, memberId: opts.memberId, tooth: CONFLICT_TOOTH },
  );

  if (!result || 'error' in result) {
    throw new Error(`Conflict seeding failed: ${result ? result.error : 'null result'}`);
  }
  return (result as { patientId: string }).patientId;
}

test.describe('Offline chart conflict — visibility & resolution', () => {
  test('the banner surfaces a rejected offline edit and Accept clears it', async ({ page }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'solo', label: 'Conflict' });
    const patientId = await seedConflict(page, { branchId, memberId });

    await spaNavigate(page, `/${patientId}`);

    // Banner is visible with the rejected tooth surfaced.
    const banner = page.getByTestId('chart-conflict-banner');
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(banner.getByTestId('conflict-tooth-row').first()).toContainText(String(CONFLICT_TOOTH));

    // Accept the offline edit → conflict resolves → banner disappears.
    const acceptBtn = banner.getByTestId(/conflict-accept-/);
    await acceptBtn.first().click();
    await expect(banner).toBeHidden({ timeout: 15000 });
  });
});
