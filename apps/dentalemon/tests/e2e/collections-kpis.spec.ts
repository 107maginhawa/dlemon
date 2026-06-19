/**
 * E2E: AR KPI dashboard (Phase 3.1).
 *
 * Proves the Metrics tab mounts live: Billing → Collections → Metrics renders
 * the KPI cards (data from GET /collections/kpis). KPI math is unit-tested
 * (utils/kpis.test.ts) and the endpoint shape is integration/contract-tested.
 */
import { test, expect } from '@playwright/test';
import { signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

test.describe('AR KPI dashboard', () => {
  test('Phase 3.1: the Metrics tab renders the KPI cards', async ({ page }) => {
    await signUpOnboardAndUnlock(page, { tier: 'clinic', label: 'Kpis' });

    await spaNavigate(page, '/billing');
    await page.getByRole('tab', { name: 'Collections' }).click();
    await page.getByTestId('collections-tab-metrics').click();

    await expect(page.getByTestId('collections-kpis')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('kpi-ar')).toBeVisible();
    await expect(page.getByTestId('kpi-aging-chart')).toBeVisible();
  });
});
