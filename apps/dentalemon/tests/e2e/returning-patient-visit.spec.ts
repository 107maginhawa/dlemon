/**
 * E2E: Returning Patient Visit flow
 *
 * Journey J3: open patient → enter workspace → select tooth → record condition
 * → add treatment → view breakdown → complete visit
 *
 * Preconditions:
 *  - Practice owner signed in (cloud account)
 *  - Patient exists (seeded via API or created in test)
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

async function signUpAndGetPatient(page: Page) {
  // Provision org+branch+owner via /dental/onboarding (org creation is admin-only
  // — EM-ORG-002), set a PIN, and unlock the PIN-gated workspace.
  const { email, password, branchId } = await signUpOnboardAndUnlock(page, {
    tier: 'solo',
    label: 'Visit',
  });

  // Create a test patient via the dental API.
  const patientRes = await page.evaluate(
    async (args) => {
      const res = await fetch(`${args.api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: 'Maria Santos',
          dateOfBirth: '1985-06-15',
          gender: 'female',
          branchId: args.branchId,
          consentGiven: true,
        }),
      });
      if (!res.ok) throw new Error(`Patient create failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return res.json();
    },
    { api: API, branchId },
  );

  return { email, password, patientId: patientRes.id };
}

test.describe('Returning Patient Visit', () => {
  test('navigates to workspace from patient list', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await spaNavigate(page, `/${patientId}`);

    await expect(page.getByTestId('timeline-carousel')).toBeVisible();
  });

  test('workspace shows new visit button', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await spaNavigate(page, `/${patientId}`);

    await expect(page.getByTestId('new-visit-btn')).toBeVisible();
  });

  test('dental chart renders 32 teeth', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await spaNavigate(page, `/${patientId}`);

    // Create a visit first
    await page.getByTestId('new-visit-btn').click();
    await page.waitForTimeout(500); // allow API call

    await expect(page.getByTestId('dental-chart')).toBeVisible();

    // Count tooth buttons
    const toothButtons = page.getByTestId(/^tooth-\d+$/);
    await expect(toothButtons).toHaveCount(32);
  });

  test('clicking a tooth opens slideout', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await spaNavigate(page, `/${patientId}`);

    await page.getByTestId('new-visit-btn').click();
    await page.waitForTimeout(500);

    await page.getByTestId('tooth-21').click();
    await expect(page.getByTestId('tooth-slideout')).toBeVisible();
  });

  test('slideout can select condition and advance to surface step', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await spaNavigate(page, `/${patientId}`);

    await page.getByTestId('new-visit-btn').click();
    await page.waitForTimeout(500);

    await page.getByTestId('tooth-21').click();
    await expect(page.getByTestId('tooth-slideout')).toBeVisible();

    // Select "caries" condition
    await page.getByRole('button', { name: 'Caries' }).first().click();

    // Click Next to advance to surface step
    await page.getByRole('button', { name: 'Next' }).click();

    // Should now show surface selector
    await expect(page.getByTestId('five-surface-selector')).toBeVisible();
  });

  test('FR1.10: workspace footer shows "Continue to Payment" button', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await spaNavigate(page, `/${patientId}`);

    // FR1.10: persistent payment footer is always visible in workspace
    await expect(page.getByRole('button', { name: /continue to payment/i })).toBeVisible();
  });

  test('FR1.15: workspace shows "new visit" button (not read-only) for current patient', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await spaNavigate(page, `/${patientId}`);

    // FR1.15: active workspace has a way to create/start a visit (not read-only)
    await expect(page.getByTestId('new-visit-btn')).toBeVisible();
  });
});
