/**
 * E2E: Dental Clinic Onboarding Wizard
 *
 * Business Rules (PRD source of truth):
 * - FR7.5/FR9.8: No dental org exists → auto-redirect to /dental-onboarding
 * - FR7.1: 4 wizard steps: Clinic Setup → Dentist Profile → Fee Schedule → First Patient
 * - FR7.1: First Patient step is skippable
 * - FR7.4: Progress saved to localStorage, resumable after interruption
 * - FR9.1: 6-digit PIN set during Dentist Profile step (not hardcoded '000000')
 * - FR7.1: Completing wizard creates real org/branch/member via API, then redirects to dashboard
 */

import { test, expect, type Page } from '@playwright/test';

const APP = 'http://localhost:3003';
const API = 'http://localhost:7213';

/** Sign up + complete 2-step person profile. Returns page on the dental-onboarding or dashboard screen. */
async function signUpAndSetupPerson(page: Page): Promise<void> {
  const suffix = Date.now();
  const email = `dental-onboarding-${suffix}@example.org`;
  const password = 'TestPass123!';

  // Sign up
  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Doc ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially(password, { delay: 10 });
  await expect(pwInput).not.toHaveValue('');
  const signupResponse = page.waitForResponse(
    (r: any) => /\/auth\/sign-up/.test(r.url()) && r.request().method() === 'POST',
    { timeout: 10000 },
  ).catch(() => null);
  await page.getByRole('button', { name: /create an account/i }).click();
  const res = await signupResponse;
  if (res && res.status() >= 400) {
    const body = await res.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up returned ${res.status()}: ${body.slice(0, 300)}`);
  }
  await page.waitForURL((url) => url.pathname === '/onboarding', { timeout: 15000 });

  // Step 1: Personal info (select DOB)
  await page.getByLabel(/date of birth/i).click();
  await page.getByRole('combobox', { name: /choose the year/i }).selectOption('1985');
  await page.getByRole('combobox', { name: /choose the month/i }).selectOption({ index: 0 });
  await page.getByRole('button', { name: /January 1st, 1985/i }).click();
  await page.click('button:has-text("Next")');

  // Step 2: Skip address
  await page.getByRole('button', { name: /skip for now/i }).click();

  // Should land on dental-onboarding (FR7.5) or dashboard
  await page.waitForURL(
    (url) => url.pathname === '/dental-onboarding' || url.pathname === '/dashboard',
    { timeout: 15000 },
  );
}

/** Navigate through clinic step with valid data */
async function fillClinicStep(page: Page, clinicName = 'Test Dental Clinic') {
  await page.getByLabel(/clinic name/i).fill(clinicName);
  await page.getByRole('button', { name: 'Next' }).click();
}

/** Navigate through dentist profile step with name + PIN */
async function fillDentistStep(page: Page, name = 'Dr. Test Owner', pin = '123456') {
  await page.getByLabel(/full name/i).fill(name);
  await page.getByLabel(/6-digit pin/i).fill(pin);
  await page.getByRole('button', { name: 'Next' }).click();
}

// ---------------------------------------------------------------------------

test.describe('Dental Clinic Onboarding Wizard', () => {

  test('FR7.5: redirects to /dental-onboarding after person profile when no org exists', async ({ page }) => {
    await signUpAndSetupPerson(page);
    await expect(page).toHaveURL(`${APP}/dental-onboarding`);
  });

  test('FR7.1: wizard shows 4 steps with correct labels', async ({ page }) => {
    await signUpAndSetupPerson(page);
    await page.goto(`${APP}/dental-onboarding`);
    await page.waitForLoadState('networkidle');

    // All 4 step labels visible in the indicator (use first match if heading + label both exist)
    await expect(page.getByText('Clinic Setup').first()).toBeVisible();
    await expect(page.getByText('Dentist Profile').first()).toBeVisible();
    await expect(page.getByText('Fee Schedule').first()).toBeVisible();
    await expect(page.getByText('First Patient').first()).toBeVisible();
  });

  test('FR9.1: dentist profile step has 6-digit PIN input', async ({ page }) => {
    await signUpAndSetupPerson(page);
    await page.goto(`${APP}/dental-onboarding`);
    await page.waitForLoadState('networkidle');

    // Fill clinic step to advance to dentist step
    await fillClinicStep(page);

    // Dentist step should have PIN input
    await expect(page.getByLabel(/6-digit pin/i)).toBeVisible();
  });

  test('FR9.1: dentist step validates PIN is exactly 6 digits', async ({ page }) => {
    await signUpAndSetupPerson(page);
    await page.goto(`${APP}/dental-onboarding`);
    await page.waitForLoadState('networkidle');

    await fillClinicStep(page);

    // Fill name but short PIN
    await page.getByLabel(/full name/i).fill('Dr. Test');
    await page.getByLabel(/6-digit pin/i).fill('123'); // Too short
    await page.getByRole('button', { name: 'Next' }).click();

    // Should show validation error
    await expect(page.getByText(/pin must be exactly 6 digits/i)).toBeVisible();
    // Should stay on dentist step (check the heading specifically)
    await expect(page.getByRole('heading', { name: /dentist profile/i })).toBeVisible();
  });

  test('FR7.1: first patient step has skip option', async ({ page }) => {
    await signUpAndSetupPerson(page);
    await page.goto(`${APP}/dental-onboarding`);
    await page.waitForLoadState('networkidle');

    await fillClinicStep(page);
    await fillDentistStep(page);
    // Fee Schedule step - just click next
    await page.getByRole('button', { name: 'Next' }).click();

    // Patient step should have Skip button
    await expect(page.getByRole('button', { name: /skip/i })).toBeVisible();
  });

  test('FR7.1: completing wizard via skip patient redirects to dashboard', async ({ page }) => {
    await signUpAndSetupPerson(page);
    await page.goto(`${APP}/dental-onboarding`);
    await page.waitForLoadState('networkidle');

    await fillClinicStep(page);
    await fillDentistStep(page);
    await page.getByRole('button', { name: 'Next' }).click(); // Fee schedule

    // Skip patient step
    await page.getByRole('button', { name: /skip/i }).click();

    // Should redirect to dashboard
    await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL(`${APP}/dashboard`);
  });

  test('FR7.1: completing wizard with first patient creates patient and redirects', async ({ page }) => {
    await signUpAndSetupPerson(page);
    await page.goto(`${APP}/dental-onboarding`);
    await page.waitForLoadState('networkidle');

    await fillClinicStep(page);
    await fillDentistStep(page);
    await page.getByRole('button', { name: 'Next' }).click(); // Fee schedule

    // Fill patient step
    await page.getByLabel(/full name/i).fill('Maria Santos');
    await page.locator('input[type="date"]').fill('1990-05-15');
    await page.getByRole('button', { name: /get started/i }).click();

    // Should redirect to dashboard or patients
    await page.waitForURL(
      (url) => url.pathname === '/dashboard' || url.pathname === '/patients',
      { timeout: 15000 },
    );
  });

  test('FR7.4: wizard progress is preserved after page refresh', async ({ page }) => {
    await signUpAndSetupPerson(page);
    await page.goto(`${APP}/dental-onboarding`);
    await page.waitForLoadState('networkidle');

    // Fill clinic name
    await page.getByLabel(/clinic name/i).fill('My Persisted Clinic');

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Clinic name should be preserved from localStorage
    await expect(page.getByLabel(/clinic name/i)).toHaveValue('My Persisted Clinic');
  });

  test('FR7.1: wizard calls real API endpoints (not broken paths)', async ({ page }) => {
    await signUpAndSetupPerson(page);
    await page.goto(`${APP}/dental-onboarding`);
    await page.waitForLoadState('networkidle');

    // Listen for API calls
    const apiCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes(API) && req.method() === 'POST') {
        apiCalls.push(req.url());
      }
    });

    await fillClinicStep(page, 'API Test Clinic');
    await fillDentistStep(page, 'Dr. API Test', '654321');
    await page.getByRole('button', { name: 'Next' }).click(); // Fee schedule
    await page.getByRole('button', { name: /skip/i }).click(); // Skip patient

    await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 15000 });

    // Verify correct API endpoints were called
    expect(apiCalls.some((url) => /\/dental\/organizations\/$/.test(url) || /\/dental\/organizations\//.test(url))).toBe(true);
    expect(apiCalls.some((url) => /\/branches\//.test(url))).toBe(true);
    expect(apiCalls.some((url) => /\/members\//.test(url) || /\/set-pin/.test(url))).toBe(true);

    // Verify NO calls to wrong endpoints
    expect(apiCalls.some((url) => /\/dental\/org\/organizations/.test(url))).toBe(false);
    expect(apiCalls.some((url) => /\/dental\/org\/branches/.test(url))).toBe(false);
  });

});
