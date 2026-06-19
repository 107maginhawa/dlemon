/**
 * E2E: Fee Schedule drives pricing (dental-org G2 / AC-ORG-002, decision §5).
 *
 * Proves the split-brain is closed at the UI layer: a price set in the Fee
 * Schedule settings panel is saved to the CANONICAL dedicated fee store
 * (`PATCH /dental/fee-schedule/{cdt}`) and reads back on reload — not the inert
 * `settings.feeSchedule` blob that drove no pricing. The fee→treatment-default
 * downstream effect is proven at the contract + integration layers
 * (dental-visit.hurl §8a/8b, dental-treatment.fee-default.test.ts).
 */
import { test, expect } from '@playwright/test';
import { APP, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

test.describe('Fee Schedule', () => {
  test('AC-ORG-002: a price set in Settings persists via the dedicated fee store', async ({ page }) => {
    await signUpOnboardAndUnlock(page, { tier: 'clinic', label: 'Fee' });

    await spaNavigate(page, '/settings');
    // Settings panel switcher renders role="tab" in a tablist (settings-page.tsx
    // a11y refactor); the native <button> takes the explicit tab role.
    await page.getByRole('tab', { name: 'Fee Schedule' }).click();

    // Catalog (seeded on server boot) renders editable price rows. D1110 is a
    // canonical procedure code.
    const input = page.getByLabel('Price for D1110');
    await expect(input).toBeVisible({ timeout: 15000 });

    // Set a distinctive price and Save — assert the PATCH hits the dedicated
    // endpoint (the canonical store), not a branch-settings blob write.
    await input.fill('777');
    const patchResp = page
      .waitForResponse(
        (r) => /\/dental\/fee-schedule\/D1110$/.test(r.url()) && r.request().method() === 'PATCH',
        { timeout: 15000 },
      )
      .catch(() => null);
    await page.getByRole('button', { name: 'Save' }).click();
    const patch = await patchResp;
    expect(patch, 'Save must PATCH the dedicated fee-schedule endpoint').not.toBeNull();
    expect(patch!.status()).toBe(200);

    // Reload and confirm the value reads back from the canonical store.
    await spaNavigate(page, '/settings');
    await page.getByRole('tab', { name: 'Fee Schedule' }).click();
    const reloaded = page.getByLabel('Price for D1110');
    await expect(reloaded).toBeVisible({ timeout: 15000 });
    await expect(reloaded).toHaveValue('777');
  });
});
