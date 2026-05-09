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
import { setupDentalOrg, createDentalPatient, APP, API } from './fixtures';

test.describe('Action Contracts: Workspace', () => {
  test('new visit button produces 201 from API', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Contract Test Patient',
      branchId,
    });

    await page.goto(`${APP}/${patientId}`);
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

    await page.goto(`${APP}/${patientId}`);
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
    await page.getByTestId('tooth-21').click();
    await expect(page.getByTestId('tooth-slideout')).toBeVisible();

    // Select condition
    await page.getByRole('button', { name: 'Caries' }).first().click();

    // Advance to surface, then treatment, then review, then save
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Listen for chart save
    const chartResponse = page.waitForResponse(
      (resp) => resp.url().includes('/chart') && resp.request().method() === 'POST',
      { timeout: 10000 },
    );

    await page.getByRole('button', { name: 'Save' }).click();

    const chartRes = await chartResponse;
    expect(chartRes.status()).toBeLessThan(300);
  });
});

test.describe('Action Contracts: Patient Registration', () => {
  test('register patient produces 201 from API', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);

    await page.goto(`${APP}/patients`);
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
