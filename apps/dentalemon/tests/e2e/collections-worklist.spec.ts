/**
 * E2E: collections worklist tab (BR-051, Phase 2.4b).
 *
 * Proves the new worklist surface mounts live: Billing → Collections → Worklist
 * tab renders the worklist table (data driven by GET /collections/worklist). The
 * log-note POST + worklist aggregation are proven at the integration/contract
 * layers (dental-billing.collections-worklist.test.ts, dental-billing.hurl) and
 * the FE component test (collections-worklist.test.tsx).
 */
import { test, expect } from '@playwright/test';
import { signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

test.describe('Collections worklist', () => {
  test('BR-051: the Worklist tab renders the worklist table', async ({ page }) => {
    await signUpOnboardAndUnlock(page, { tier: 'clinic', label: 'Worklist' });

    await spaNavigate(page, '/billing');
    await page.getByRole('tab', { name: 'Collections' }).click();
    await page.getByTestId('collections-tab-worklist').click();

    await expect(page.getByTestId('collections-worklist')).toBeVisible({ timeout: 15000 });
  });
});
