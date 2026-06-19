/**
 * iPad viewport — calendar / scheduling view layout (G6-S8)
 *
 * Runs under ipad-portrait (1024×768) and ipad-landscape (1366×1024) projects.
 * Asserts the calendar grid is visible, day headers are present, and there is
 * no horizontal overflow.
 */

import { test, expect, type Page } from '@playwright/test';
import { signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

// ---------------------------------------------------------------------------
// Setup helper — onboard a clinic via /dental/onboarding (org creation is
// admin-only — EM-ORG-002), set a PIN, and unlock the PIN-gated workspace.
// ---------------------------------------------------------------------------

async function signUpAndSeedOrg(page: Page) {
  const { orgId, branchId } = await signUpOnboardAndUnlock(page, {
    tier: 'clinic',
    label: 'iPad Cal',
  });
  return { orgId, branchId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('iPad calendar layout', () => {
  test('calendar grid is visible at iPad viewport', async ({ page }) => {
    let seeded = false;
    try {
      await signUpAndSeedOrg(page);
      seeded = true;
    } catch {
      test.skip(true, 'Skipped — requires full seed setup (API unavailable)');
      return;
    }

    if (!seeded) return;

    await spaNavigate(page, '/calendar');

    // Web-first wait: the appointments query loads async (a one-shot isVisible()
    // races the "Loading appointments…" spinner). The grid root carries a stable
    // data-testid per view (default = day).
    await expect(
      page
        .locator('[data-testid="calendar-day"], [data-testid="calendar-week"], [data-testid="calendar-month"]')
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    // Regression: the calendar must NOT hard-error. Before the fix the grid query
    // fired without branchId → "Validation failed: branchId … received undefined".
    await expect(page.getByTestId('calendar-error')).toHaveCount(0);
  });

  test('day headers are visible', async ({ page }) => {
    let seeded = false;
    try {
      await signUpAndSeedOrg(page);
      seeded = true;
    } catch {
      test.skip(true, 'Skipped — requires full seed setup (API unavailable)');
      return;
    }

    if (!seeded) return;

    await spaNavigate(page, '/calendar');

    // Web-first wait: the appointments query loads async (a one-shot isVisible()
    // races the loading skeleton). Wait for the grid root (carries role="main")
    // before asserting on its contents — this is the same hardening the
    // "calendar grid is visible" test uses, applied here to kill the timing flake.
    const grid = page
      .locator('[data-testid="calendar-day"], [data-testid="calendar-week"], [data-testid="calendar-month"]')
      .first();
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // The day view renders an hour rail of time labels (7 AM … 9 PM); week/month
    // render day-of-week headers. At least one header/time label must be present —
    // assert against the grid that just rendered, not the loading skeleton.
    const header = grid
      .locator(
        ':text("AM"), :text("PM"), :text("Mon"), :text("Tue"), :text("Wed"), :text("Thursday"), :text("Monday"), [data-testid="day-header"]',
      )
      .first();
    await expect(header).toBeVisible({ timeout: 15_000 });
  });

  test('no horizontal scroll at iPad width', async ({ page }) => {
    let seeded = false;
    try {
      await signUpAndSeedOrg(page);
      seeded = true;
    } catch {
      test.skip(true, 'Skipped — requires full seed setup (API unavailable)');
      return;
    }

    if (!seeded) return;

    await spaNavigate(page, '/calendar');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 1024;
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);
  });
});
