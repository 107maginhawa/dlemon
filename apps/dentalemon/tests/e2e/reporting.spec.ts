/**
 * E2E: Reporting
 *
 * ACs covered: AC-REPORT-01
 */

import { test, expect } from '@playwright/test';
import { setupDentalOrg , gotoApp} from './fixtures';

const APP = 'http://localhost:3003';

// ─── AC-REPORT-01: Daily report page loads without 500 ───────────────────

test.describe('Reporting: Daily report loads (AC-REPORT-01)', () => {
  test('navigating to /reports/daily renders without server error', async ({ page }) => {
    await setupDentalOrg(page);

    await gotoApp(page, `/reports/daily`);
    await page.waitForLoadState('networkidle');

    // Must not show a 500 server error
    await expect(page.locator('body')).not.toContainText('500');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');

    // Page should render some content
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(10);
  });
});
