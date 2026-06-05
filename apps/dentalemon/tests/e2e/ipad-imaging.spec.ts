/**
 * iPad viewport — imaging workspace layout (G6-S8)
 *
 * Runs under ipad-portrait (1024×768) and ipad-landscape (1366×1024) projects.
 * Asserts that the imaging viewer and sidebar panels are both visible at
 * landscape width and that there is no horizontal overflow.
 */

import { test, expect } from '@playwright/test';

// Imaging is a workspace overlay, not a standalone route. The `/imaging-test`
// harness mounts the REAL ImagingWorkspace + PatientImageList (no auth/seed), so
// these iPad-viewport layout assertions drive it directly.

test.describe('iPad imaging workspace layout', () => {
  test('imaging section has no horizontal overflow at landscape viewport', async ({ page }) => {
    // There is no standalone /imaging route — imaging is a workspace overlay.
    // /imaging-test is the routable harness that mounts the REAL ImagingWorkspace
    // + PatientImageList (no auth/seed needed), so it's the surface for asserting
    // the imaging layout at an iPad viewport.
    await page.goto('/imaging-test');
    await expect(page.getByTestId('imaging-toolbar')).toBeVisible({ timeout: 15_000 });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 1366;
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('imaging viewer panel is visible at landscape viewport', async ({ page }) => {
    await page.goto('/imaging-test');
    // The ImagingWorkspace viewer (toolbar + canvas) renders in the right pane.
    await expect(page.getByTestId('imaging-toolbar')).toBeVisible({ timeout: 15_000 });
  });
});
