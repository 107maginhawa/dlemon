/**
 * E2E: P2-007 — Empty states across workspace tabs
 *
 * Verifies that a freshly-created patient with no clinical data sees
 * the correct empty states in the Recalls sheet, Treatment Plans sheet,
 * and the Queue board page.
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect } from '@playwright/test';
import { setupDentalOrg, createDentalPatient, APP } from './fixtures';

test.describe('Workspace empty states — P2-007', () => {
  test('RecallsSheet: empty state for new patient', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Empty Recalls Patient',
      branchId,
    });

    await page.goto(`${APP}/_workspace/${patientId}`);
    await page.waitForLoadState('networkidle');

    // Wait for workspace to finish loading (year filter bar appears after visits load)
    await page.waitForSelector('[data-testid="recalls-tab-btn"]', { timeout: 10000 });

    await page.getByTestId('recalls-tab-btn').click();

    await page.waitForSelector('[data-testid="recalls-sheet"]', { timeout: 5000 });

    await expect(
      page.getByText('No recalls yet. Schedule a cleaning or follow-up.'),
    ).toBeVisible();
  });

  test('TreatmentPlansSheet: empty state for new patient', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Empty Plans Patient',
      branchId,
    });

    await page.goto(`${APP}/_workspace/${patientId}`);
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('[data-testid="treatment-plans-tab-btn"]', { timeout: 10000 });

    await page.getByTestId('treatment-plans-tab-btn').click();

    await page.waitForSelector('[data-testid="treatment-plans-sheet"]', { timeout: 5000 });

    await expect(
      page.getByText('No treatment plans. Create one to track approved treatment sequences.'),
    ).toBeVisible();
  });

  test('QueueBoard: empty state when no patients queued', async ({ page }) => {
    await setupDentalOrg(page);

    await page.goto(`${APP}/_workspace/queue-board`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('No patients in the queue.')).toBeVisible({ timeout: 10000 });
  });
});
