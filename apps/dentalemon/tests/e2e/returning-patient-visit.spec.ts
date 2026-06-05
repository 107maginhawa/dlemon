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

/**
 * Click "New Visit", then initialize the new visit's dentition so the dental
 * chart renders.
 *
 * A brand-new visit has no chart row, so GET /dental/visits/:id/chart 404s and the
 * active carousel slide shows the "Initialize Dentition" empty state. We drive the
 * REAL user flow: click the empty-state "init-dentition-btn", which calls
 * POST /dental/patients/:patientId/dentition AND invalidates the chart query so it
 * refetches and re-renders with the full dentition. (The patient is seeded with a
 * dateOfBirth, so the carousel's canInitDentition gate is satisfied and the button
 * renders.)
 */
async function startVisitAndInitDentition(page: Page, patientId: string, _dateOfBirth = '1985-06-15') {
  void patientId;
  await page.getByTestId('new-visit-btn').click();

  // Fresh visit → "Initialize Dentition" empty state. Clicking the button runs the
  // mutation + invalidates ['getDentalChart', visitId] so the chart re-renders.
  const initBtn = page.getByTestId('init-dentition-btn');
  await expect(initBtn).toBeVisible({ timeout: 15000 });
  await initBtn.click();

  await expect(page.getByTestId('dental-chart')).toBeVisible({ timeout: 15000 });
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

    // Create a visit, then initialize the dentition. A brand-new visit has no
    // teeth yet, so the active slide first shows the "Initialize Dentition" empty
    // state; the dental chart renders only after dentition is seeded.
    await startVisitAndInitDentition(page, patientId);

    await expect(page.getByTestId('dental-chart')).toBeVisible();

    // Count tooth buttons (permanent dentition = 32)
    const toothButtons = page.getByTestId(/^tooth-\d+$/);
    await expect(toothButtons).toHaveCount(32);
  });

  test('clicking a tooth opens slideout', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await spaNavigate(page, `/${patientId}`);

    await startVisitAndInitDentition(page, patientId);

    await page.getByTestId('tooth-21').click();
    await expect(page.getByTestId('tooth-slideout')).toBeVisible();
  });

  test('slideout records a per-surface condition (focus surface → pick condition)', async ({ page }) => {
    const { patientId } = await signUpAndGetPatient(page);

    await spaNavigate(page, `/${patientId}`);

    await startVisitAndInitDentition(page, patientId);

    await page.getByTestId('tooth-21').click();
    await expect(page.getByTestId('tooth-slideout')).toBeVisible();

    // Current UX (tooth-overview-step.tsx): condition buttons are disabled until a
    // surface is focused — there is no separate "Next → five-surface-selector" step
    // anymore; surface assignment is inline via per-surface pills. So: tap a surface
    // pill, which enables the condition picker, then pick "Caries".
    const caries = page.getByRole('button', { name: 'Caries' }).first();
    await expect(caries).toBeDisabled();

    // Tap a surface pill to focus it.
    const surfacePill = page.getByTestId(/^surface-/).first();
    await expect(surfacePill).toBeVisible();
    await surfacePill.click();

    // The condition picker is now enabled; assign "Caries".
    await expect(caries).toBeEnabled();
    await caries.click();

    // Assigning a condition colours the surface (the pill renders a coloured dot
    // once it has an assigned condition), confirming the per-surface record stuck.
    // Focus may auto-advance to the next unassigned surface, so assert on the set
    // of pills rather than the originally-focused one.
    await expect(page.locator('[data-testid^="surface-"] span.rounded-full').first()).toBeVisible();
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

/*
 * PRODUCT BUG NOTE (out of scope for this test-only pass; not fixed here):
 *
 *   When a visit is first created via the workspace "New Visit" button, it has no
 *   dental chart yet, so GET /dental/visits/:visitId/chart returns 404 NOT_FOUND
 *   (services/api-ts/src/handlers/dental-visit/chart/getDentalChart.ts:30 — "Dental
 *   chart" NotFound). The TimelineCarousel slide (src/features/workspace/components/
 *   timeline-carousel.tsx:119) treats ANY query error — including this expected
 *   "no chart yet" 404 — as a hard error state ("Failed to load chart"), so the
 *   `canInitDentition` empty-state with the in-UI "Initialize Dentition" button
 *   (line 133) is never reached for a fresh visit. Net effect: a user who clicks
 *   "New Visit" sees "Failed to load chart" and cannot start charting from the UI.
 *
 *   The fix belongs in product code (treat a 404 from the chart query as an empty
 *   chart → render the init-dentition empty-state instead of the error state).
 *   This same regression also breaks tests/e2e/prescribe-medication.spec.ts
 *   ("can create a new visit" → expects dental-chart) — i.e. it is not specific to
 *   this file. Until that lands, these tests seed the dentition via the documented
 *   POST /dental/patients/:patientId/dentition endpoint (the exact call the
 *   empty-state button makes) and click the carousel's "Retry" affordance.
 */
