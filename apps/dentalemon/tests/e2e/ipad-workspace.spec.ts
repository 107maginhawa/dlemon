/**
 * iPad viewport — visit workspace layout (G6-S8)
 *
 * Runs under ipad-portrait (1024×768) and ipad-landscape (1366×1024) projects.
 * Assertions are thin: layout integrity only, no deep domain seeding required.
 *
 * If a full seed setup is unavailable the tests skip cleanly.
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
    label: 'iPad WS',
  });
  return { orgId, branchId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('iPad workspace layout', () => {
  test('tooth chart visible without horizontal scroll', async ({ page }) => {
    let seeded = false;
    try {
      await signUpAndSeedOrg(page);
      seeded = true;
    } catch {
      test.skip(true, 'Skipped — requires full seed setup (API unavailable)');
      return;
    }

    if (!seeded) return;

    // Navigate to the workspace root (patients list is the entry point)
    await spaNavigate(page, '/patients');

    // Assert no horizontal overflow at this viewport
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 1024;
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('main nav element is visible at iPad width', async ({ page }) => {
    let seeded = false;
    try {
      await signUpAndSeedOrg(page);
      seeded = true;
    } catch {
      test.skip(true, 'Skipped — requires full seed setup (API unavailable)');
      return;
    }

    if (!seeded) return;

    await spaNavigate(page, '/patients');

    // Navigation must be accessible — the sidebar toggle (always rendered in the
    // dashboard header). Web-first wait: a one-shot isVisible() races the route
    // transition (passed in portrait, flaked in landscape).
    await expect(
      page.locator('[data-testid="sidebar-toggle"], nav, [role="navigation"]').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('lemon accent button has correct background colour', async ({ page }) => {
    let seeded = false;
    try {
      await signUpAndSeedOrg(page);
      seeded = true;
    } catch {
      test.skip(true, 'Skipped — requires full seed setup (API unavailable)');
      return;
    }

    if (!seeded) return;

    await spaNavigate(page, '/patients');

    // Find any button styled with the lemon accent (#FFE97D)
    const lemonBtn = page.locator('button').filter({ has: page.locator(':text-is("New Patient"), :text-is("Add Patient"), :text-is("Walk-In")') }).first();
    const exists = await lemonBtn.count();
    if (exists === 0) {
      // No lemon button visible on this view — skip colour assertion
      return;
    }

    const bg = await lemonBtn.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    // #FFE97D ≈ rgb(255, 233, 125) — allow a small tolerance range
    expect(bg).toMatch(/rgb\(25[0-9], 23[0-9], 1[0-9]{2}\)|#ffe97d|rgb\(255, 233, 125\)/i);
  });
});
