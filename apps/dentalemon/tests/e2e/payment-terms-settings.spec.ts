/**
 * E2E: clinic default payment terms (BR-048, Phase 2.1b).
 *
 * Proves the FE↔BE round-trip for the new Payment Terms settings panel: a
 * default set in Settings is saved to branch settings (PUT /settings) and reads
 * back on reload. The terms→dueDate-at-issue effect is proven at the integration
 * layer (dental-billing.payment-terms.test.ts, 5 cases).
 */
import { test, expect } from '@playwright/test';
import { signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

test.describe('Payment Terms settings', () => {
  test('BR-048: a clinic default term set in Settings persists across reload', async ({ page }) => {
    await signUpOnboardAndUnlock(page, { tier: 'clinic', label: 'Terms' });

    await spaNavigate(page, '/settings');
    await page.getByRole('tab', { name: 'Payment Terms' }).click();

    const net60 = page.getByTestId('terms-preset-60');
    await expect(net60).toBeVisible({ timeout: 15000 });
    await net60.click();

    const putResp = page
      .waitForResponse(
        (r) => /\/dental\/branches\/[^/]+\/settings$/.test(r.url()) && r.request().method() === 'PUT',
        { timeout: 15000 },
      )
      .catch(() => null);
    await page.getByTestId('save-payment-terms').click();
    const put = await putResp;
    expect(put, 'Save must PUT branch settings').not.toBeNull();
    expect(put!.status()).toBe(200);

    // Reload and confirm Net 60 reads back as the active preset.
    await spaNavigate(page, '/settings');
    await page.getByRole('tab', { name: 'Payment Terms' }).click();
    const reloaded = page.getByTestId('terms-preset-60');
    await expect(reloaded).toBeVisible({ timeout: 15000 });
    await expect(reloaded).toHaveAttribute('aria-pressed', 'true');
  });
});
