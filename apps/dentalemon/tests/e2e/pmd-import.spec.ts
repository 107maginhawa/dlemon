/**
 * E2E: PMD Import (AC-PMD-03)
 *
 * Verifies POST /dental/pmd/import creates an importedPMD record linked to a patient.
 *
 * Flow: sign up → seed org → create patient → import PMD → verify record created
 */

import { test, expect } from '@playwright/test';
import { setupDentalOrg, createDentalPatient, API, APP } from './fixtures';

// @BR-030 PMD import links to patient and branch

test.describe('PMD Import (AC-PMD-03)', () => {
  test('POST /dental/pmd/import creates imported PMD record linked to patient', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'PMD Import Patient',
      branchId,
    });

    const result = await page.evaluate(async ({ api, patientId }: { api: string; patientId: string }) => {
      const res = await fetch(`${api}/dental/pmd/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId,
          sourceFacility: 'External Dental Clinic',
          sourceReference: 'REF-2026-001',
          // Contract (ImportPMDRequestSchema): sourceDescription (string, ≤200) is
          // required and `content` is a string (serialize the clinical record).
          sourceDescription: 'Transferred records from External Dental Clinic',
          content: JSON.stringify({
            allergies: ['penicillin'],
            medications: ['ibuprofen 400mg'],
            conditions: ['hypertension'],
          }),
        }),
      });
      if (!res.ok) return { ok: false, status: res.status, body: await res.text() };
      const data = await res.json() as any;
      return { ok: true, id: data.id, patientId: data.patientId, sourceFacility: data.sourceFacility };
    }, { api: API, patientId });

    expect(result.ok, `import failed: ${JSON.stringify(result)}`).toBe(true);
    expect(result.id).toBeTruthy();
    expect(result.patientId).toBe(patientId);
    expect(result.sourceFacility).toBe('External Dental Clinic');
  });

  test('POST /dental/pmd/import returns 401 without auth', async ({ page }) => {
    // Load the app origin first (public sign-in page mints no session) so the
    // fetch runs from a same-site browsing context — a bare about:blank evaluate
    // can't reach the cross-origin API ("Failed to fetch"). No auth cookie is set,
    // so the import endpoint must reject with 401.
    await page.goto(`${APP}/auth/sign-in`);
    await page.waitForLoadState('domcontentloaded');

    const result = await page.evaluate(async (api: string) => {
      const res = await fetch(`${api}/dental/pmd/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: '00000000-0000-4000-8000-000000000099',
          sourceFacility: 'Test',
          sourceReference: 'REF-X',
          sourceDescription: 'unauth probe',
          content: '{}',
        }),
      });
      return { status: res.status };
    }, API);

    expect(result.status).toBe(401);
  });

  test('GET /dental/pmd/imported lists imported PMDs for patient', async ({ page }) => {
    const { branchId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'PMD List Patient',
      branchId,
    });

    // Import one PMD
    const imported = await page.evaluate(async ({ api, patientId }: { api: string; patientId: string }) => {
      const r = await fetch(`${api}/dental/pmd/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId,
          sourceFacility: 'City Hospital',
          sourceReference: 'REF-LIST-001',
          sourceDescription: 'City Hospital transfer summary',
          content: JSON.stringify({ notes: 'test import' }),
        }),
      });
      return { ok: r.ok, status: r.status, body: r.ok ? '' : await r.text().catch(() => '') };
    }, { api: API, patientId });
    expect(imported.ok, `import failed: ${imported.status} ${imported.body}`).toBe(true);

    // List imported PMDs
    const result = await page.evaluate(async ({ api, patientId }: { api: string; patientId: string }) => {
      const res = await fetch(`${api}/dental/pmd/imported?patientId=${patientId}`, {
        credentials: 'include',
      });
      if (!res.ok) return { ok: false, status: res.status };
      const data = await res.json() as any;
      // listImportedPMDs returns { data: [...], pagination }. Tolerate items[]/bare
      // array shapes too.
      const list = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : [];
      return { ok: true, count: list.length };
    }, { api: API, patientId });

    expect(result.ok).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(1);
  });
});
