/**
 * E2E: Condition-vocabulary findings + finding→treatment (P0-C)
 *
 * Seeds a patient + active visit, opens a tooth slideout, records a structured
 * finding from the curated vocabulary, and converts it into a treatment — through
 * the real UI.
 *
 * Self-seeding via /dental/onboarding (signUpOnboardAndUnlock).
 */
import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

async function seedActiveVisit(page: Page, opts: { branchId: string; memberId: string }): Promise<string> {
  const result = await page.evaluate(
    async ({ api, branchId, memberId }) => {
      const j = (body: unknown) => ({
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include' as const, body: JSON.stringify(body),
      });
      const patch = (body: unknown) => ({
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        credentials: 'include' as const, body: JSON.stringify(body),
      });
      const fail = async (label: string, res: Response) => ({ error: `${label} ${res.status}: ${(await res.text()).slice(0, 200)}` });

      const patientRes = await fetch(`${api}/dental/patients`, j({ displayName: 'Findings E2E Patient', dateOfBirth: '1985-07-15', branchId, consentGiven: true }));
      if (!patientRes.ok) return fail('patient', patientRes);
      const patient = await patientRes.json() as { id: string };

      const vRes = await fetch(`${api}/dental/visits`, j({ patientId: patient.id, branchId, dentistMemberId: memberId }));
      if (!vRes.ok) return fail('visit', vRes);
      const visit = await vRes.json() as { id: string };
      await fetch(`${api}/dental/visits/${visit.id}`, patch({ status: 'active' }));

      return { patientId: patient.id };
    },
    { api: API, branchId: opts.branchId, memberId: opts.memberId },
  );
  if (!result || 'error' in result) throw new Error(`Seeding failed: ${result ? result.error : 'null result'}`);
  return (result as { patientId: string }).patientId;
}

async function ensureActiveChart(page: Page) {
  const chart = page.getByTestId('dental-chart');
  if (await chart.isVisible().catch(() => false)) return;
  const initBtn = page.getByTestId('init-dentition-btn');
  await expect(initBtn).toBeVisible({ timeout: 15000 });
  await initBtn.click();
  await expect(chart).toBeVisible({ timeout: 15000 });
}

test.describe('Condition-vocabulary findings', () => {
  test('record a structured finding on a tooth and convert it to a treatment', async ({ page }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'solo', label: 'Findings' });
    const patientId = await seedActiveVisit(page, { branchId, memberId });

    await spaNavigate(page, `/${patientId}`);
    await ensureActiveChart(page);

    // Open the tooth slideout for #16.
    await page.getByTestId('tooth-16').first().click();

    const panel = page.getByTestId('findings-panel');
    await expect(panel).toBeVisible({ timeout: 15000 });

    // Record a caries finding from the curated vocabulary.
    await panel.getByTestId('finding-code-caries').click();
    await panel.getByTestId('finding-add-btn').click();

    // It lands in the active findings list.
    const row = panel.locator('[data-testid^="finding-row-"]').first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row).toContainText('Caries');

    // Convert it into a treatment.
    await row.locator('[data-testid^="finding-convert-"]').first().click();
    await row.locator('[data-testid^="finding-convert-confirm-"]').first().click();

    // After conversion the finding shows it is linked to a treatment.
    await expect(panel.getByText('linked to treatment').first()).toBeVisible({ timeout: 15000 });
  });
});
