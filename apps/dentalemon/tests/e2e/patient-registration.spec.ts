/**
 * E2E: Patient Registration flow (FR2.x)
 *
 * Business Rules:
 * - FR2.3: Registration form requires name; save creates patient via API
 * - FR2.20: Consent checkbox required before registration (blocks without it)
 * - FR2.1: Patient list fetches from API (not hardcoded empty array)
 * - FR2.3: After registration, new patient card appears in list
 *
 * Journey J1: New Patient Walk-In
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

async function signUpAndSeedOrg(page: Page) {
  // Provision org+branch+owner via /dental/onboarding (org creation is admin-only
  // — EM-ORG-002), set a PIN, and unlock the PIN-gated workspace.
  const { email, password, orgId, branchId } = await signUpOnboardAndUnlock(page, {
    tier: 'solo',
    label: 'Patient',
  });

  return { email, password, orgId, branchId };
}

test.describe('Patient Registration flow', () => {
  test('FR2.1: navigates to patients page and shows empty state', async ({ page }) => {
    await signUpAndSeedOrg(page);
    await spaNavigate(page, '/patients');

    // Patient list loads from API — empty branch shows empty state
    await expect(page.getByTestId('patient-list-empty')).toBeVisible();
  });

  test('FR2.3: register patient button opens registration modal with required fields', async ({ page }) => {
    await signUpAndSeedOrg(page);
    await spaNavigate(page, '/patients');

    await page.getByTestId('register-patient-btn').click();

    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel(/date of birth/i)).toBeVisible();
    await expect(page.getByTestId('consent-checkbox')).toBeVisible();
  });

  test('FR2.3: cancel button closes modal without registering', async ({ page }) => {
    await signUpAndSeedOrg(page);
    await spaNavigate(page, '/patients');

    await page.getByTestId('register-patient-btn').click();
    await expect(page.getByLabel(/full name/i)).toBeVisible();

    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByLabel(/full name/i)).not.toBeVisible();
  });

  test('FR2.3: form validation prevents submission with empty name', async ({ page }) => {
    await signUpAndSeedOrg(page);
    await spaNavigate(page, '/patients');

    await page.getByTestId('register-patient-btn').click();
    // Check consent but leave name empty
    await page.getByTestId('consent-checkbox').check();
    await page.getByRole('button', { name: /register/i }).click();

    // Form should not submit — modal stays open
    await expect(page.getByLabel(/full name/i)).toBeVisible();
  });

  test('FR2.20: consent checkbox blocks registration when unchecked', async ({ page }) => {
    await signUpAndSeedOrg(page);
    await spaNavigate(page, '/patients');

    await page.getByTestId('register-patient-btn').click();
    await page.getByLabel(/full name/i).fill('Maria Santos');
    // Do NOT check consent
    await page.getByRole('button', { name: /register/i }).click();

    // Form should not submit — modal stays open, consent error shown
    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByText('Patient consent is required')).toBeVisible();
  });

  test('FR2.3: registering a patient calls POST /dental/patients and refreshes list', async ({ page }) => {
    await signUpAndSeedOrg(page);
    await spaNavigate(page, '/patients');

    // Intercept the dental patients API call
    const dentalPatientsRequest = page.waitForRequest(
      (req) => req.url().includes('/dental/patients') && req.method() === 'POST',
      { timeout: 10000 },
    ).catch(() => null);

    await page.getByTestId('register-patient-btn').click();
    await page.getByLabel(/full name/i).fill('Maria Santos');

    // Fill date of birth
    const dobInput = page.getByLabel(/date of birth/i);
    await dobInput.fill('1990-05-15');

    // Check consent (FR2.20)
    await page.getByTestId('consent-checkbox').check();

    await page.getByRole('button', { name: /register/i }).click();

    // Verify the correct API endpoint was called
    const req = await dentalPatientsRequest;
    expect(req).not.toBeNull();

    if (req) {
      const body = JSON.parse(req.postData() ?? '{}');
      expect(body.displayName).toBe('Maria Santos');
      expect(body.consentGiven).toBe(true);
    }

    // Modal should close after successful registration
    await expect(page.getByLabel(/full name/i)).not.toBeVisible({ timeout: 5000 });
  });

  test('AC-REG-02: API rejects patient creation when consentGiven=false (BR-015)', async ({ page }) => {
    const { branchId } = await signUpAndSeedOrg(page);

    // Bypass UI — call the API directly with consentGiven=false
    // BR-015 must be enforced server-side, not only by client-side validation
    const status = await page.evaluate(
      async ({ api, branchId }: { api: string; branchId: string }) => {
        const res = await fetch(`${api}/dental/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ displayName: 'No Consent Patient', branchId, consentGiven: false }),
        });
        return res.status;
      },
      { api: API, branchId },
    );

    expect(status).toBe(422);
  });

  test('FR2.1: patient list fetches from API and renders a seeded in-branch patient', async ({ page }) => {
    const { branchId } = await signUpAndSeedOrg(page);

    // Seed a patient IN THE BRANCH (createDentalPatient mints its own person record).
    // The earlier version seeded a patient with no branchId, so the branch-filtered
    // list never showed it and the assertion fell back to the empty state — passing
    // even if the list query were broken. Seeding in-branch forces a real card.
    const displayName = `Seeded ListPatient ${Date.now()}`;
    const created = await page.evaluate(async ({ api, branchId, displayName }) => {
      const r = await fetch(`${api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName, branchId, consentGiven: true }),
      });
      return r.ok;
    }, { api: API, branchId, displayName });
    expect(created, 'in-branch patient seeding must succeed').toBe(true);

    await spaNavigate(page, '/patients');

    // The seeded patient's card must render — proving the list query fetched live,
    // branch-scoped data (not a hardcoded empty array, and not a 400-empty fallback).
    await expect(page.getByTestId('patient-list-empty')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: new RegExp(`Open patient record for ${displayName}`, 'i') }),
    ).toBeVisible({ timeout: 8000 });
  });
});
