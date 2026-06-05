/**
 * E2E Action-Contract Tests
 *
 * These tests verify that UI actions produce SUCCESSFUL API calls.
 * Unlike page-render tests (which check elements are visible), these ensure
 * the full round-trip works: button click → API request → 2xx response → UI update.
 *
 * This catches bugs like:
 * - Missing required fields in request body (branchId, memberId)
 * - Silent fetch failures (handler returns early on !res.ok)
 * - Stale localStorage causing auth/context errors
 */

import { test, expect, type Page } from '@playwright/test';
import { setupDentalOrg, createDentalPatient, gotoApp, APP, API } from './fixtures';

/**
 * Complete the tooth slideout wizard for a single tooth:
 * 1. Focus a surface pill (occlusal by default)
 * 2. Click a condition (Caries by default)
 * 3. Next → treatment step
 * 4. Continue → review step
 */
async function fillToothSlideout(page: Page, opts: { surface?: string; condition?: string } = {}) {
  // 'mesial' exists on all teeth (anterior and posterior)
  const surface = opts.surface ?? 'mesial';
  const condition = opts.condition ?? 'Caries';
  // Step 1 (Overview): focus a surface, then pick condition
  await page.getByTestId(`surface-${surface}`).click();
  await page.getByRole('button', { name: condition }).first().click();
  // Advance from overview → treatment
  await page.getByRole('button', { name: 'Next' }).click();
  // Treatment step: select first CDT code, then click Continue to advance to review
  await page.getByRole('option').first().click();
  await page.getByTestId('cdt-continue-btn').click();
}

test.describe('Action Contracts: Workspace', () => {
  test('new visit button produces 201 from API', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Contract Test Patient',
      branchId,
    });

    await gotoApp(page, `/${patientId}`);
    await page.waitForLoadState('networkidle');

    // Listen for the visit creation response
    const visitResponse = page.waitForResponse(
      (resp) => resp.url().includes('/dental/visits') && resp.request().method() === 'POST',
      { timeout: 10000 },
    );

    await page.getByTestId('new-visit-btn').click();

    const response = await visitResponse;
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.id).toBeTruthy();
    expect(body.patientId).toBe(patientId);
  });

  test('tooth chart save produces 200 from API', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Chart Test Patient',
      branchId,
    });

    await gotoApp(page, `/${patientId}`);
    await page.waitForLoadState('networkidle');

    // Create visit first
    const visitResponse = page.waitForResponse(
      (resp) => resp.url().includes('/dental/visits') && resp.request().method() === 'POST',
      { timeout: 10000 },
    );
    await page.getByTestId('new-visit-btn').click();
    const visitRes = await visitResponse;
    expect(visitRes.status()).toBe(201);

    // Click a tooth
    // Fresh visit → initialize dentition so the chart renders clickable teeth.
    await page.getByTestId('init-dentition-btn').click();
    await expect(page.getByTestId('dental-chart')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('tooth-21').click();
    await expect(page.getByTestId('tooth-slideout')).toBeVisible();

    // Fill slideout: select surface → condition → Next → Continue (to review)
    await fillToothSlideout(page);

    // Listen for chart save
    const chartResponse = page.waitForResponse(
      (resp) => resp.url().includes('/chart') && resp.request().method() === 'POST',
      { timeout: 10000 },
    );

    await page.getByRole('button', { name: 'Save', exact: true }).click();

    const chartRes = await chartResponse;
    expect(chartRes.status()).toBeLessThan(300);
  });
});

test.describe('Action Contracts: Treatment Plan', () => {
  test('tooth slideout save adds treatment row to plan tab (AC-VISIT)', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Treatment Row Patient',
      branchId,
    });

    await gotoApp(page, `/${patientId}`);
    await page.waitForLoadState('networkidle');

    // Create visit
    const visitResponse = page.waitForResponse(
      (resp) => resp.url().includes('/dental/visits') && resp.request().method() === 'POST',
      { timeout: 10000 },
    );
    await page.getByTestId('new-visit-btn').click();
    const visitRes = await visitResponse;
    expect(visitRes.status()).toBe(201);

    // Open tooth slideout
    // Fresh visit → initialize dentition so the chart renders clickable teeth.
    await page.getByTestId('init-dentition-btn').click();
    await expect(page.getByTestId('dental-chart')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('tooth-21').click();
    await expect(page.getByTestId('tooth-slideout')).toBeVisible();

    // Fill slideout: select surface → condition → Next → Continue (to review)
    await fillToothSlideout(page);

    // Save the chart — also wait for treatment POST (triggered after chart success)
    const chartResponse = page.waitForResponse(
      (resp) => resp.url().includes('/chart') && resp.request().method() === 'POST',
      { timeout: 10000 },
    );
    const treatmentResponse = page.waitForResponse(
      (resp) => resp.url().includes('/treatments') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const chartRes = await chartResponse;
    expect(chartRes.status()).toBeLessThan(300);
    const txRes = await treatmentResponse;
    expect(txRes.status()).toBeLessThan(300);

    // Verify the treatment plan API has data before opening the modal
    const planResponse = await page.evaluate(async ({ api, patientId, branchId }) => {
      const r = await fetch(`${api}/dental/patients/${patientId}/treatment-plan?branchId=${branchId}`, {
        credentials: 'include',
      });
      if (!r.ok) return { error: r.status, treatments: [] };
      const data = await r.json();
      return { treatmentCount: data.treatmentCount, treatments: data.treatments };
    }, { api: API, patientId, branchId });
    expect(planResponse.treatmentCount).toBeGreaterThan(0);

    // Open Treatment Plan sheet (top bar button) to verify the row was recorded
    await page.getByRole('button', { name: 'Treatment Plan' }).click();
    // Wait for the treatment plan API to respond with data
    await page.waitForResponse(
      (resp) => resp.url().includes('/treatment-plan') && resp.request().method() === 'GET',
      { timeout: 10000 },
    ).catch(() => null);
    await expect(page.getByTestId('treatment-row').first()).toBeVisible({ timeout: 12000 });
  });
});

test.describe('Action Contracts: Patient Registration', () => {
  test('register patient produces 201 from API', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);

    await gotoApp(page, `/patients`);
    await page.waitForLoadState('networkidle');

    // Listen for the patient creation response
    const patientResponse = page.waitForResponse(
      (resp) => resp.url().includes('/dental/patients') && resp.request().method() === 'POST',
      { timeout: 10000 },
    );

    await page.getByTestId('register-patient-btn').click();
    await page.getByLabel(/full name/i).fill('Action Contract Patient');
    await page.getByLabel(/date of birth/i).fill('1988-03-15');
    await page.getByTestId('consent-checkbox').check();
    await page.getByRole('button', { name: /register/i }).click();

    const response = await patientResponse;
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.id).toBeTruthy();
    expect(body.displayName).toBe('Action Contract Patient');
  });
});
