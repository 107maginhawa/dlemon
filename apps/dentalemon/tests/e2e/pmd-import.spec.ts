/**
 * E2E: PMD Import (AC-PMD-03)
 *
 * Verifies POST /dental/pmd/import creates an importedPMD record linked to a patient.
 *
 * Flow: sign up → seed org → create patient → import PMD → verify record created
 */

import { test, expect } from '@playwright/test';
import { setupDentalOrg, createDentalPatient, API } from './fixtures';

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
          content: {
            allergies: ['penicillin'],
            medications: ['ibuprofen 400mg'],
            conditions: ['hypertension'],
          },
        }),
      });
      if (!res.ok) return { ok: false, status: res.status, body: await res.text() };
      const data = await res.json() as any;
      return { ok: true, id: data.id, patientId: data.patientId, sourceFacility: data.sourceFacility };
    }, { api: API, patientId });

    expect(result.ok).toBe(true);
    expect(result.id).toBeTruthy();
    expect(result.patientId).toBe(patientId);
    expect(result.sourceFacility).toBe('External Dental Clinic');
  });

  test('POST /dental/pmd/import returns 401 without auth', async ({ page }) => {
    const result = await page.evaluate(async (api: string) => {
      const res = await fetch(`${api}/dental/pmd/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: '00000000-0000-4000-8000-000000000099',
          sourceFacility: 'Test',
          sourceReference: 'REF-X',
          content: {},
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
    await page.evaluate(async ({ api, patientId }: { api: string; patientId: string }) => {
      await fetch(`${api}/dental/pmd/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId,
          sourceFacility: 'City Hospital',
          sourceReference: 'REF-LIST-001',
          content: { notes: 'test import' },
        }),
      });
    }, { api: API, patientId });

    // List imported PMDs
    const result = await page.evaluate(async ({ api, patientId }: { api: string; patientId: string }) => {
      const res = await fetch(`${api}/dental/pmd/imported?patientId=${patientId}`, {
        credentials: 'include',
      });
      if (!res.ok) return { ok: false, status: res.status };
      const data = await res.json() as any;
      return { ok: true, count: Array.isArray(data.items) ? data.items.length : (Array.isArray(data) ? data.length : 0) };
    }, { api: API, patientId });

    expect(result.ok).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(1);
  });
});
