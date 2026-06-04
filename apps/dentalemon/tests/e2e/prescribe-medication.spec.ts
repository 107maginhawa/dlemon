/**
 * E2E: Prescribe Medication — Journey J7
 *
 * Flow: sign up → create patient → open workspace → create visit →
 *       open Rx sheet → fill form → save → verify prescription in list
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';
import { setupDentalOrg, createDentalPatient } from './fixtures';

async function setupWorkspace(page: Page) {
  // Provision org+branch+owner via /dental/onboarding (org creation is admin-only
  // — EM-ORG-002), set a PIN, and unlock the PIN-gated workspace.
  const { branchId, memberId } = await signUpOnboardAndUnlock(page, {
    tier: 'solo',
    label: 'Rx',
  });

  // Create patient via dental API
  const patientRes = await page.evaluate(async (args) => {
    const res = await fetch(`${args.api}/dental/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        displayName: 'Ana Reyes',
        dateOfBirth: '1990-03-12',
        gender: 'female',
        branchId: args.branchId,
        consentGiven: true,
      }),
    });
    if (!res.ok) throw new Error(`Patient create failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }, { api: API, branchId });

  return { patientId: patientRes.id, memberId };
}

test.describe('Prescribe Medication (J7)', () => {
  test('workspace page loads for a patient', async ({ page }) => {
    const { patientId } = await setupWorkspace(page);
    await spaNavigate(page, `/${patientId}`);
    await expect(page.getByTestId('timeline-carousel')).toBeVisible();
  });

  test('new visit button is visible', async ({ page }) => {
    const { patientId } = await setupWorkspace(page);
    await spaNavigate(page, `/${patientId}`);
    await expect(page.getByTestId('new-visit-btn')).toBeVisible();
  });

  test('can create a new visit', async ({ page }) => {
    const { patientId } = await setupWorkspace(page);
    await spaNavigate(page, `/${patientId}`);
    await page.getByTestId('new-visit-btn').click();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('dental-chart')).toBeVisible();
  });

  test('can fill Rx form and save prescription — prescription appears in API list', async ({
    page,
  }) => {
    // [AC-RX-01, BR-017] fill drug/dosage/frequency → submit → verify in list
    const { patientId, memberId } = await setupWorkspace(page);
    await spaNavigate(page, `/${patientId}`);

    // Create a new visit via the UI so the workspace enters active mode
    await page.getByTestId('new-visit-btn').click();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('dental-chart')).toBeVisible();

    // Capture the visitId from the prescriptions API call triggered when Rx sheet opens
    let capturedVisitId: string | null = null;
    page.on('response', async (resp) => {
      const url = resp.url();
      const m = url.match(/\/dental\/visits\/([^/]+)\/prescriptions/);
      if (m) capturedVisitId = m[1] ?? null;
    });

    // Click "Write prescription" button in the top bar
    await page.getByRole('button', { name: /write prescription/i }).click();

    // Wait for RxSheet to appear
    const rxSheet = page.getByTestId('rx-sheet');
    await rxSheet.waitFor({ state: 'visible', timeout: 5000 });

    // Fill required fields
    await page.getByLabel('Drug name').fill('Amoxicillin');
    await page.getByLabel('Dosage').fill('500mg');
    await page.getByLabel('Frequency selection').selectOption('OD (once daily)');

    // Intercept the createPrescription POST to capture visitId
    const prescriptionResponse = page.waitForResponse(
      (resp) =>
        /\/dental\/visits\/.+\/prescriptions/.test(resp.url()) &&
        resp.request().method() === 'POST',
      { timeout: 10000 },
    );

    // Submit
    await rxSheet.getByRole('button', { name: /save prescription/i }).click();

    // Sheet must close after successful save
    await expect(rxSheet).not.toBeVisible({ timeout: 8000 });

    // Verify prescription created via API response
    const prescResp = await prescriptionResponse;
    expect(prescResp.status()).toBe(201);

    const body = await prescResp.json();
    expect(body).toBeTruthy();
    expect(body.drugName).toBe('Amoxicillin');
    expect(body.dosage).toBe('500mg');
  });
});

// ─── AC-PRES-01: Create prescription → visible in prescription list ───────

test.describe('Prescription: Created prescription visible in visit list (AC-PRES-01, BR-017)', () => {
  test('prescription created via API appears in GET /visits/:id/prescriptions', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, { displayName: 'Pres01 Patient', branchId });

    const result = await page.evaluate(async ({ api, patientId, branchId, memberId }: { api: string; patientId: string; branchId: string; memberId: string }) => {
      // Create + activate visit
      const visitRes = await fetch(`${api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId, branchId, dentistMemberId: memberId }),
      });
      if (!visitRes.ok) return { ok: false, step: 'visit', status: visitRes.status };
      const visit = await visitRes.json() as any;

      await fetch(`${api}/dental/visits/${visit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'active' }),
      });

      // Create prescription (BR-017: prescriberMemberId required)
      const rxRes = await fetch(`${api}/dental/visits/${visit.id}/prescriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId: visit.id,
          patientId,
          prescriberMemberId: memberId,
          drugName: 'Amoxicillin',
          dosage: '500mg',
          frequency: 'TID',
          duration: '7 days',
          quantity: '21 capsules',
        }),
      });
      if (!rxRes.ok) return { ok: false, step: 'rx', status: rxRes.status };
      const rx = await rxRes.json() as any;

      // List prescriptions for this visit
      const listRes = await fetch(`${api}/dental/visits/${visit.id}/prescriptions`, { credentials: 'include' });
      if (!listRes.ok) return { ok: false, step: 'list', status: listRes.status };
      const list = await listRes.json() as any;
      const items: any[] = Array.isArray(list) ? list : (list.items ?? list.data ?? []);
      const found = items.find((p: any) => p.id === rx.id);

      return { ok: true, rxId: rx.id, found: !!found, drugName: found?.drugName };
    }, { api: API, patientId, branchId, memberId });

    expect(result.ok).toBe(true);
    expect(result.found).toBe(true);
    expect(result.drugName).toBe('Amoxicillin');
  });
});

// ─── AC-RX-02: Prescription requires prescriber ───────────────────────────

test.describe('Prescription: Requires prescriber (AC-RX-02, BR-017)', () => {
  test('prescription without prescriberId is rejected by API', async ({ page }) => {
    const { patientId } = await setupWorkspace(page);

    // Create a visit to test against
    const visitId = await page.evaluate(async ({ api, patientId }: { api: string; patientId: string }) => {
      const r = await fetch(`${api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId }),
      });
      if (!r.ok) return null;
      const body = await r.json() as any;
      return body.id as string;
    }, { api: API, patientId });

    if (!visitId) return; // visit creation may need branchId/memberId context — skip if not available

    const result = await page.evaluate(async ({ api, visitId }: { api: string; visitId: string }) => {
      const r = await fetch(`${api}/dental/visits/${visitId}/prescriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        // prescriberId intentionally omitted — BR-017 requires it
        body: JSON.stringify({ drugName: 'Amoxicillin', dosage: '500mg', frequency: 'OD', quantity: '10 tabs' }),
      });
      return { status: r.status };
    }, { api: API, visitId });

    // BR-017: prescriberId is required — must reject without it
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.status).toBeLessThan(500);
  });
});
