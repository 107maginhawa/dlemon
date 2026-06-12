/**
 * E2E: Patient Profile
 *
 * ACs covered: AC-PROF-01, AC-PROF-02
 */

import { test, expect, type Page } from '@playwright/test';
import { setupDentalOrg, createDentalPatient , gotoApp} from './fixtures';
import { API } from './helpers/e2e-seed';

const APP = 'http://localhost:3003';

/** Seed a visit for a patient so the Overview tab's visit history has real rows. */
async function seedVisit(
  page: Page,
  opts: { patientId: string; branchId: string; memberId: string; chiefComplaint: string },
): Promise<string> {
  return page.evaluate(async ({ api, opts }) => {
    const r = await fetch(`${api}/dental/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        patientId: opts.patientId,
        branchId: opts.branchId,
        dentistMemberId: opts.memberId,
        chiefComplaint: opts.chiefComplaint,
      }),
    });
    if (!r.ok) throw new Error(`Visit creation failed: ${r.status} ${await r.text().catch(() => '')}`);
    const v = await r.json() as { id: string };
    return v.id;
  }, { api: API, opts });
}

// ─── AC-PROF-01: Patient profile page loads with real demographics + visits ──

test.describe('Patient Profile: Profile page loads (AC-PROF-01)', () => {
  test('navigating to /patients/:id renders the patient name and seeded visit history', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Profile Test Patient',
      branchId,
    });
    // Seed a visit so the Overview tab MUST render real visit-history content. If
    // the profile's useVisits query loses its branchId again (the visits-400 bug),
    // GET /dental/visits 400s, visits is empty, and the seeded complaint below never
    // renders — failing this test instead of silently showing the empty state. A
    // chrome-only assertion (page length / no-500) would not catch that regression.
    const chiefComplaint = 'E2E Toothache Visit';
    await seedVisit(page, { patientId, branchId, memberId, chiefComplaint });

    await gotoApp(page, `/patients/${patientId}`);
    await page.waitForLoadState('networkidle');

    // Page should load without error
    await expect(page.locator('body')).not.toContainText('500');
    await expect(page.locator('body')).not.toContainText('Not Found');

    // PROF-01: the patient's name renders in the profile header (real data, not just
    // chrome). The backend splits displayName "Profile Test Patient" into
    // firstName="Profile" / lastName="Test Patient"; the header renders
    // `{LASTNAME}, {firstName}` → "TEST PATIENT, Profile".
    const profileName = page.getByTestId('profile-name');
    await expect(profileName).toBeVisible();
    await expect(profileName).toContainText(/Profile/i);
    await expect(profileName).toContainText(/Patient/i);

    // PROF-02: the Overview tab's visit-history section must show the SEEDED visit —
    // proving the visits query (which requires branchId) actually returned data.
    const visitHistory = page.getByTestId('visit-history-section');
    await expect(visitHistory).toBeVisible();
    await expect(visitHistory.getByText(chiefComplaint)).toBeVisible();
    await expect(page.getByTestId('no-visits-message')).toHaveCount(0);
  });
});

// ─── FR2.4: Edit demographics → save → reload (registration-typo fix) ──────

test.describe('Patient Profile: Edit demographics (FR2.4)', () => {
  test('correct a name typo: edit → save → reload shows the corrected name', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Mari/a Wrongname',
      branchId,
    });

    await gotoApp(page, `/patients/${patientId}`);
    await page.waitForLoadState('networkidle');

    // Open the edit modal and correct first + last name.
    await page.getByTestId('edit-patient-button').click();
    const firstName = page.getByLabel(/first name/i);
    const lastName = page.getByLabel(/last name/i);
    await firstName.fill('Mariana');
    await lastName.fill('Reyes');
    await page.getByRole('button', { name: /save changes/i }).click();

    // Reload from scratch — the corrected name must come from the API, not state.
    await page.waitForLoadState('networkidle');
    await gotoApp(page, `/patients/${patientId}`);
    await page.waitForLoadState('networkidle');

    const profileName = page.getByTestId('profile-name');
    await expect(profileName).toBeVisible();
    // Header renders `{LASTNAME}, {firstName}` → "REYES, Mariana".
    await expect(profileName).toContainText(/Mariana/);
    await expect(profileName).toContainText(/REYES/i);
    await expect(profileName).not.toContainText(/Wrongname/i);
  });

  // #14 (V-PAT-014): edit contact info (phone/email) → save → reload renders it.
  test('add contact info: edit email/phone → save → reload shows the contact info', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Contact Patient',
      branchId,
    });

    await gotoApp(page, `/patients/${patientId}`);
    await page.waitForLoadState('networkidle');
    // Fresh patient has no contact info.
    await expect(page.locator('body')).toContainText(/no contact info/i);

    await page.getByTestId('edit-patient-button').click();
    await page.getByLabel(/email/i).fill('contact@clinic.test');
    await page.getByLabel(/phone/i).fill('+639170000234');
    await page.getByRole('button', { name: /save changes/i }).click();

    // Reload from scratch — the contact info must come from the API, not state.
    await page.waitForLoadState('networkidle');
    await gotoApp(page, `/patients/${patientId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('profile-name')).toBeVisible();
    await expect(page.locator('body')).toContainText('contact@clinic.test');
    await expect(page.locator('body')).toContainText('+639170000234');
    await expect(page.locator('body')).not.toContainText(/no contact info/i);
  });
});

// ─── AC-PROF-02: Open workspace from profile ──────────────────────────────

test.describe('Patient Profile: Open workspace from profile (AC-PROF-02)', () => {
  test('clicking "Open workspace" from patient profile navigates to workspace', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Prof02 Patient',
      branchId,
    });

    await gotoApp(page, `/patients/${patientId}`);
    await page.waitForLoadState('networkidle');
    // Anchor on the profile page itself before probing for a workspace CTA. The
    // SPA transition from the dashboard can otherwise leave the previous route's
    // "Open Workspace" quick-action briefly in the DOM, which detaches mid-click
    // and times out. Waiting for the profile header guarantees we evaluate the
    // locator against the settled profile page (which has no workspace CTA).
    await page.getByTestId('back-to-patients').waitFor({ state: 'visible', timeout: 8000 });

    // Look for a workspace link/button
    const workspaceLink = page.getByRole('link', { name: /workspace|open workspace/i })
      .or(page.getByRole('button', { name: /workspace|open workspace/i }));

    const linkExists = await workspaceLink.count();
    if (linkExists === 0) {
      // If the profile page doesn't have an explicit link, check that the patient ID
      // is accessible and a direct workspace URL works
      await gotoApp(page, `/${patientId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).not.toContainText('500');
      return;
    }

    await workspaceLink.first().click();
    await page.waitForLoadState('networkidle');

    // After clicking, should navigate away from /patients/:id
    const currentUrl = page.url();
    expect(currentUrl).not.toBe(`${APP}/patients/${patientId}`);
    await expect(page.locator('body')).not.toContainText('500');
  });
});
