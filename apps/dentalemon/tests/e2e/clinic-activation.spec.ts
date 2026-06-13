/**
 * E2E: Clinic activation (C-1 / ADR-007)
 *
 * A self-service onboarded clinic is 'provisional'. The owner sees an activation
 * banner in the dashboard shell and activates it (terms/BAA acceptance → 'live'),
 * which unlocks PHI writes (gated in production) and dismisses the banner.
 */
import { test, expect } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

test.describe('Clinic activation', () => {
  test('owner activates a provisional clinic from the dashboard banner', async ({ page }) => {
    // Onboard WITHOUT auto-activation → the clinic stays provisional.
    const { orgId } = await signUpOnboardAndUnlock(page, { tier: 'clinic', label: 'Activate', activate: false });

    await spaNavigate(page, `/dashboard`);

    // The owner sees the activation banner + CTA.
    await expect(page.getByTestId('clinic-activation-banner')).toBeVisible();
    const activateBtn = page.getByTestId('activate-clinic-btn');
    await expect(activateBtn).toBeVisible();

    await activateBtn.click();

    // Banner self-dismisses once the org flips to live.
    await expect(page.getByTestId('clinic-activation-banner')).not.toBeVisible({ timeout: 8000 });

    // Independent oracle: the server-side org status is now 'live'.
    const liveStatus = await page.evaluate(async ({ api, orgId }: { api: string; orgId: string }) => {
      const r = await fetch(`${api}/dental/organizations/${orgId}`, { credentials: 'include' });
      return (await r.json() as { status?: string }).status;
    }, { api: API, orgId });
    expect(liveStatus).toBe('live');
  });
});
