/**
 * E2E: Safety Floor Medical Alerts — AC-MED-02
 *
 * Flow: sign up → create patient → add active allergy via API →
 *       open workspace → verify red allergy badge in the safety floor top bar
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function setupPatientWithAllergy(page: Page, allergyName: string) {
  const suffix = Date.now();
  const email = `safety-e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  // Sign up
  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Safety Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially(password, { delay: 10 });
  await expect(pwInput).not.toHaveValue('');
  const signupResponse = page
    .waitForResponse(
      (resp: any) =>
        /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
      { timeout: 10000 },
    )
    .catch(() => null);
  await page.getByRole('button', { name: /create an account/i }).click();
  const response = await signupResponse;
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up POST returned ${response.status()}: ${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), {
    timeout: 15000,
  });

  // Create org/branch/member
  const ctx = await page.evaluate(async (api) => {
    const orgRes = await fetch(`${api}/dental/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Safety Clinic', tier: 'solo', countryCode: 'PH' }),
    });
    const org = await orgRes.json();
    const branchRes = await fetch(`${api}/dental/organizations/${org.id}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Main Branch', timezone: 'Asia/Manila' }),
    });
    const branch = await branchRes.json();
    const memberRes = await fetch(
      `${api}/dental/organizations/${org.id}/branches/${branch.id}/members`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: 'Dr. Safety', role: 'dentist_owner' }),
      },
    );
    const member = await memberRes.json();
    return { orgId: org.id, branchId: branch.id, memberId: member.id };
  }, API);

  await page.evaluate((ids) => {
    localStorage.setItem('currentOrgId', ids.orgId);
    localStorage.setItem('currentBranchId', ids.branchId);
    localStorage.setItem('currentMemberId', ids.memberId);
  }, ctx);

  // Create patient
  const patientRes = await page.evaluate(
    async (args) => {
      const res = await fetch(`${args.api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: 'Safety Patient',
          dateOfBirth: '1988-11-05',
          gender: 'female',
          branchId: args.branchId,
          consentGiven: true,
        }),
      });
      return res.json();
    },
    { api: API, branchId: ctx.branchId },
  );

  // Add active allergy entry via medical history API
  const allergyRes = await page.evaluate(
    async (args) => {
      const res = await fetch(`${args.api}/dental/clinical/medical-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: args.patientId,
          entryType: 'allergy',
          displayName: args.allergyName,
          active: true,
          notes: 'Severe reaction',
        }),
      });
      return res.json();
    },
    { api: API, patientId: patientRes.id, allergyName },
  );

  return {
    patientId: patientRes.id,
    allergyId: allergyRes.id,
    branchId: ctx.branchId,
  };
}

test.describe('Safety Floor Medical Alerts (AC-MED-02)', () => {
  test('active allergy shows red badge in workspace top bar', async ({ page }) => {
    // [AC-MED-02] active allergies must be surfaced prominently in the workspace safety floor
    const allergyName = 'Penicillin';
    const { patientId } = await setupPatientWithAllergy(page, allergyName);

    await page.goto(`${APP}/${patientId}`);
    await page.waitForLoadState('networkidle');

    // The safety floor container uses bg-red-50 class and appears when safetyItems.length > 0
    // It renders allergy badges inside: bg-red-100 text-red-700 border-red-200
    const safetyFloor = page.locator('.bg-red-50.border.border-red-200').first();
    await safetyFloor.waitFor({ state: 'visible', timeout: 8000 });

    // The specific allergy badge must be present
    await expect(safetyFloor).toContainText(allergyName);
  });

  test('patient without allergies shows no safety floor', async ({ page }) => {
    // [AC-MED-02] safety floor must not appear for clean patient (no false positives)
    const suffix = Date.now();

    // Minimal setup: patient with no medical history
    await page.goto(`${APP}/auth/sign-up`);
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Name', { exact: true }).fill(`Clean Owner ${suffix}`);
    await page.getByLabel('Email', { exact: true }).fill(`clean-e2e-${suffix}@example.org`);
    const pwInput = page.locator('input[type="password"]');
    await pwInput.click();
    await pwInput.pressSequentially('E2eTestPass123!', { delay: 10 });
    await expect(pwInput).not.toHaveValue('');
    const signupResponse = page
      .waitForResponse(
        (resp: any) =>
          /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
        { timeout: 10000 },
      )
      .catch(() => null);
    await page.getByRole('button', { name: /create an account/i }).click();
    await signupResponse;
    await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), {
      timeout: 15000,
    });

    const ctx = await page.evaluate(async (api) => {
      const orgRes = await fetch(`${api}/dental/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: 'Clean Clinic', tier: 'solo', countryCode: 'PH' }),
      });
      const org = await orgRes.json();
      const branchRes = await fetch(`${api}/dental/organizations/${org.id}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: 'Main Branch', timezone: 'Asia/Manila' }),
      });
      const branch = await branchRes.json();
      const memberRes = await fetch(
        `${api}/dental/organizations/${org.id}/branches/${branch.id}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ displayName: 'Dr. Clean', role: 'dentist_owner' }),
        },
      );
      const member = await memberRes.json();
      return { branchId: branch.id, memberId: member.id };
    }, API);

    await page.evaluate((ids) => {
      localStorage.setItem('currentBranchId', ids.branchId);
      localStorage.setItem('currentMemberId', ids.memberId);
    }, ctx);

    const patientRes = await page.evaluate(
      async (args) => {
        const res = await fetch(`${args.api}/dental/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            displayName: 'Clean Patient',
            dateOfBirth: '1990-01-01',
            gender: 'male',
            branchId: args.branchId,
            consentGiven: true,
          }),
        });
        return res.json();
      },
      { api: API, branchId: ctx.branchId },
    );

    await page.goto(`${APP}/${patientRes.id}`);
    await page.waitForLoadState('networkidle');
    await page.getByTestId('timeline-carousel').waitFor({ state: 'visible', timeout: 8000 });

    // Safety floor container must not be visible for a patient with no active alerts
    const safetyFloor = page.locator('.bg-red-50.border.border-red-200').first();
    await expect(safetyFloor).not.toBeVisible();
  });

  test('resolved allergy does not appear in safety floor', async ({ page }) => {
    // [AC-MED-02] only active entries surface — resolved allergies must be silent
    const allergyName = 'Aspirin';
    const { patientId, allergyId } = await setupPatientWithAllergy(page, allergyName);

    // Resolve the allergy via API
    await page.evaluate(
      async (args) => {
        await fetch(`${args.api}/dental/clinical/medical-history/${args.allergyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ active: false, resolvedDate: new Date().toISOString() }),
        });
      },
      { api: API, allergyId },
    );

    await page.goto(`${APP}/${patientId}`);
    await page.waitForLoadState('networkidle');
    await page.getByTestId('timeline-carousel').waitFor({ state: 'visible', timeout: 8000 });

    // Safety floor must not appear since the allergy is resolved
    const safetyFloor = page.locator('.bg-red-50.border.border-red-200').first();
    await expect(safetyFloor).not.toBeVisible();
  });
});
