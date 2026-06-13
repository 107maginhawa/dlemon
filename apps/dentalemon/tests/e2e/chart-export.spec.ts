/**
 * E2E: Structured chart export (P0-B)
 *
 * Seeds a patient + active visit with a charted tooth and a treatment, then
 * drives the real Export button → the print-ready overlay renders the structured
 * export (header + odontogram table + treatment summary + legend).
 *
 * Self-seeding via /dental/onboarding (signUpOnboardAndUnlock).
 */
import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

async function seedChart(page: Page, opts: { branchId: string; memberId: string }): Promise<string> {
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
      const fail = async (label: string, res: Response) =>
        ({ error: `${label} ${res.status}: ${(await res.text()).slice(0, 200)}` });

      const patientRes = await fetch(`${api}/dental/patients`, j({
        displayName: 'Export E2E Patient', branchId, consentGiven: true,
      }));
      if (!patientRes.ok) return fail('patient', patientRes);
      const patient = await patientRes.json() as { id: string };

      const vRes = await fetch(`${api}/dental/visits`, j({
        patientId: patient.id, branchId, dentistMemberId: memberId,
      }));
      if (!vRes.ok) return fail('visit', vRes);
      const visit = await vRes.json() as { id: string };
      await fetch(`${api}/dental/visits/${visit.id}`, patch({ status: 'active' }));

      const chartRes = await fetch(`${api}/dental/visits/${visit.id}/chart`, j({
        visitId: visit.id, patientId: patient.id,
        teeth: [{ toothNumber: 11, state: 'healthy' }, { toothNumber: 26, state: 'caries', surfaces: ['mesial', 'occlusal'] }],
      }));
      if (!chartRes.ok) return fail('chart', chartRes);

      const tRes = await fetch(`${api}/dental/visits/${visit.id}/treatments`, j({
        visitId: visit.id, patientId: patient.id, cdtCode: 'D2391',
        description: 'Composite #26', toothNumber: 26, priceCents: 15000,
      }));
      if (!tRes.ok) return fail('treatment', tRes);

      return { patientId: patient.id };
    },
    { api: API, branchId: opts.branchId, memberId: opts.memberId },
  );
  if (!result || 'error' in result) {
    throw new Error(`Export seeding failed: ${result ? result.error : 'null result'}`);
  }
  return (result as { patientId: string }).patientId;
}

test.describe('Structured chart export', () => {
  test('the Export button opens the print-ready structured export', async ({ page }) => {
    const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'solo', label: 'Export' });
    const patientId = await seedChart(page, { branchId, memberId });

    await spaNavigate(page, `/${patientId}`);

    const exportBtn = page.getByTestId('chart-export-btn');
    await expect(exportBtn).toBeVisible({ timeout: 15000 });
    await exportBtn.click();

    const overlay = page.getByTestId('chart-export-overlay');
    await expect(overlay).toBeVisible({ timeout: 15000 });
    await expect(overlay.getByTestId('chart-export')).toBeVisible();
    // structured content: at least the charted teeth + the legend render
    await expect(overlay.getByTestId('export-tooth-row').first()).toBeVisible();
    await expect(overlay.getByTestId('export-legend')).toBeVisible();
    await expect(overlay.getByTestId('chart-export-print')).toBeVisible();
  });
});
