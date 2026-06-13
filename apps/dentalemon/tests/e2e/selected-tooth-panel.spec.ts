/**
 * E2E: Selected-tooth-aware bottom panel + "why visible" explanation (P0-D)
 *
 * Seeds a patient + active visit with treatments on two teeth. Selecting a tooth
 * on the odontogram scopes the Treatment Breakdown to that tooth (chip + rows)
 * and the slideout explains why the tooth shows its current layer.
 *
 * Self-seeding via /dental/onboarding (signUpOnboardAndUnlock).
 */
import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

async function seedTreatments(page: Page, opts: { branchId: string; memberId: string }): Promise<string> {
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

      const patientRes = await fetch(`${api}/dental/patients`, j({ displayName: 'Panel E2E Patient', dateOfBirth: '1985-07-15', branchId, consentGiven: true }));
      if (!patientRes.ok) return fail('patient', patientRes);
      const patient = await patientRes.json() as { id: string };

      const vRes = await fetch(`${api}/dental/visits`, j({ patientId: patient.id, branchId, dentistMemberId: memberId }));
      if (!vRes.ok) return fail('visit', vRes);
      const visit = await vRes.json() as { id: string };
      await fetch(`${api}/dental/visits/${visit.id}`, patch({ status: 'active' }));

      for (const [toothNumber, cdtCode, description] of [[16, 'D2391', 'Composite #16'], [26, 'D2392', 'Composite #26']] as const) {
        const tRes = await fetch(`${api}/dental/visits/${visit.id}/treatments`, j({
          visitId: visit.id, patientId: patient.id, cdtCode, description, toothNumber, priceCents: 15000,
        }));
        if (!tRes.ok) return fail(`treatment-${toothNumber}`, tRes);
      }
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

test.describe('Selected-tooth-aware bottom panel', () => {
  test('selecting a tooth scopes the breakdown and explains the tooth layer', async ({ page }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'solo', label: 'Panel' });
    const patientId = await seedTreatments(page, { branchId, memberId });

    await spaNavigate(page, `/${patientId}`);
    await ensureActiveChart(page);

    // Before selecting: no tooth-scope chip.
    await expect(page.getByTestId('tooth-filter-chip')).toBeHidden();

    // Select tooth #16.
    await page.getByTestId('tooth-16').first().click();

    // The slideout explains why this tooth shows its layer.
    const explanation = page.getByTestId('tooth-layer-explanation');
    await expect(explanation).toBeVisible({ timeout: 15000 });
    await expect(explanation).toContainText('Proposed');

    // The Treatment Breakdown is scoped to tooth #16.
    const chip = page.getByTestId('tooth-filter-chip');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('16');

    // Only the tooth-16 treatment row renders in the scoped panel.
    const rows = page.locator('[data-testid^="treatment-row-"]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('16');

    // The chip count agrees with the rendered rows (summary ≠ body guard).
    await expect(page.getByTestId('tooth-filter-count')).toContainText('1');
  });
});
