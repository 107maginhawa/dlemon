/**
 * E2E: Clinical Attachment Upload (AC-ATTACH-01)
 *
 * Verifies POST /dental/visits/:visitId/attachments creates an attachment record
 * linked to a visit and appears in the list.
 *
 * Flow: sign up → seed org → create patient → create visit → upload attachment
 *       → verify record appears in GET /dental/visits/:visitId/attachments
 */

import { test, expect } from '@playwright/test';
import { setupDentalOrg, createDentalPatient, API } from './fixtures';

// @BR-019 Clinical records append-only; attachments linked to visit

test.describe('Clinical Attachment Upload (AC-ATTACH-01)', () => {
  test('POST /dental/visits/:visitId/attachments creates attachment record', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Attachment Test Patient',
      branchId,
    });

    const result = await page.evaluate(
      async ({ api, patientId, branchId, memberId }: { api: string; patientId: string; branchId: string; memberId: string }) => {
        // Create a visit
        const visitRes = await fetch(`${api}/dental/visits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ patientId, branchId, dentistMemberId: memberId }),
        });
        if (!visitRes.ok) return { ok: false, step: 'create-visit', status: visitRes.status };
        const visit = await visitRes.json() as any;

        // Upload attachment
        const attachRes = await fetch(`${api}/dental/visits/${visit.id}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            visitId: visit.id,
            patientId,
            imageType: 'xray',
            fileName: 'periapical-1.jpg',
            filePath: 'attachments/periapical-1.jpg',
            fileSizeBytes: 204800,
            mimeType: 'image/jpeg',
            toothNumbers: [21],
            note: 'Periapical x-ray uploaded via E2E test',
          }),
        });
        if (!attachRes.ok) return { ok: false, step: 'create-attachment', status: attachRes.status, body: await attachRes.text() };
        const attachment = await attachRes.json() as any;
        return {
          ok: true,
          visitId: visit.id,
          attachmentId: attachment.id,
          imageType: attachment.imageType,
          fileName: attachment.fileName,
        };
      },
      { api: API, patientId, branchId, memberId },
    );

    expect(result.ok).toBe(true);
    expect(result.attachmentId).toBeTruthy();
    expect(result.imageType).toBe('xray');
    expect(result.fileName).toBe('periapical-1.jpg');
  });

  test('GET /dental/visits/:visitId/attachments lists uploaded attachments', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, {
      displayName: 'Attachment List Patient',
      branchId,
    });

    const result = await page.evaluate(
      async ({ api, patientId, branchId, memberId }: { api: string; patientId: string; branchId: string; memberId: string }) => {
        // Create visit
        const visitRes = await fetch(`${api}/dental/visits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ patientId, branchId, dentistMemberId: memberId }),
        });
        if (!visitRes.ok) return { ok: false, step: 'create-visit', status: visitRes.status };
        const visit = await visitRes.json() as any;

        // Upload attachment
        await fetch(`${api}/dental/visits/${visit.id}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            visitId: visit.id,
            patientId,
            imageType: 'photo',
            fileName: 'intraoral-photo.png',
            filePath: 'attachments/intraoral-photo.png',
            fileSizeBytes: 512000,
            mimeType: 'image/png',
          }),
        });

        // List attachments
        const listRes = await fetch(`${api}/dental/visits/${visit.id}/attachments`, {
          credentials: 'include',
        });
        if (!listRes.ok) return { ok: false, step: 'list-attachments', status: listRes.status };
        const data = await listRes.json() as any;
        const items = Array.isArray(data.data) ? data.data : (Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []));
        return { ok: true, count: items.length };
      },
      { api: API, patientId, branchId, memberId },
    );

    expect(result.ok).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(1);
  });

  test('POST /dental/visits/:visitId/attachments returns 401 without auth', async ({ request }) => {
    const res = await request.post(`${API}/dental/visits/00000000-0000-4000-8000-000000000001/attachments`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        visitId: '00000000-0000-4000-8000-000000000001',
        patientId: '00000000-0000-4000-8000-000000000099',
        imageType: 'xray',
        fileName: 'test.jpg',
        filePath: 'test/test.jpg',
        fileSizeBytes: 1024,
        mimeType: 'image/jpeg',
      },
    });

    expect(res.status()).toBe(401);
  });
});
