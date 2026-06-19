/**
 * E2E: dunning reminder cadence (BR-050, Phase 2.3b).
 *
 * Proves the FE↔BE round-trip for the new Reminder Cadence settings panel: the
 * offsets selected in Settings are saved to branch settings (PUT /settings) and
 * read back on reload. The cadence→reminder effect is proven at the integration
 * layer (dental-billing/jobs/jobs.test.ts — "respects branch-configured offsets").
 */
import { test, expect } from '@playwright/test';
import { signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

test.describe('Reminder Cadence settings', () => {
  test('BR-050: a cadence set in Settings persists across reload', async ({ page }) => {
    await signUpOnboardAndUnlock(page, { tier: 'clinic', label: 'Cadence' });

    await spaNavigate(page, '/settings');
    await page.getByRole('tab', { name: 'Reminder Cadence' }).click();

    // Default cadence is [3,7,14]; toggle 30 on and 3 off, then save.
    const chip30 = page.getByTestId('offset-chip-30');
    await expect(chip30).toBeVisible({ timeout: 15000 });
    await chip30.click();
    await page.getByTestId('offset-chip-3').click();

    const putResp = page
      .waitForResponse(
        (r) => /\/dental\/branches\/[^/]+\/settings$/.test(r.url()) && r.request().method() === 'PUT',
        { timeout: 15000 },
      )
      .catch(() => null);
    await page.getByTestId('save-reminder-cadence').click();
    const put = await putResp;
    expect(put, 'Save must PUT branch settings').not.toBeNull();
    expect(put!.status()).toBe(200);

    // Reload: 7, 14, 30 selected; 3 deselected.
    await spaNavigate(page, '/settings');
    await page.getByRole('tab', { name: 'Reminder Cadence' }).click();
    await expect(page.getByTestId('offset-chip-30')).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 });
    await expect(page.getByTestId('offset-chip-7')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('offset-chip-3')).toHaveAttribute('aria-pressed', 'false');
  });
});
