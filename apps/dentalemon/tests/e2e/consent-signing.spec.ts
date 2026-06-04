/**
 * E2E: Consent Signing — AC-MED-03, BR-014
 *
 * Flow: sign up → create patient + active visit → sign consent via UI →
 *       verify sheet closes on success → re-open verifies read-only immutability
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

async function setupWithActiveVisit(page: Page) {
  // Provision org+branch+owner via /dental/onboarding (org creation is admin-only
  // — EM-ORG-002), set a PIN, and unlock the PIN-gated workspace.
  const { branchId, memberId } = await signUpOnboardAndUnlock(page, {
    tier: 'solo',
    label: 'Consent',
  });

  // Create patient
  const patientId = await page.evaluate(
    async (args) => {
      const res = await fetch(`${args.api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: 'Consent Patient',
          dateOfBirth: '1992-07-20',
          gender: 'male',
          branchId: args.branchId,
          consentGiven: true,
        }),
      });
      if (!res.ok) throw new Error(`Patient creation failed: ${res.status}`);
      const patient = await res.json();
      return patient.id as string;
    },
    { api: API, branchId },
  );

  // Create + activate visit
  const visitId = await page.evaluate(
    async (args) => {
      const createRes = await fetch(`${args.api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: args.patientId,
          branchId: args.branchId,
          dentistMemberId: args.memberId,
        }),
      });
      if (!createRes.ok) throw new Error(`Visit creation failed: ${createRes.status}`);
      const visit = await createRes.json();
      const patchRes = await fetch(`${args.api}/dental/visits/${visit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'active' }),
      });
      if (!patchRes.ok) throw new Error(`Visit activation failed: ${patchRes.status}`);
      return visit.id as string;
    },
    { api: API, patientId, branchId, memberId },
  );

  return {
    patientId,
    visitId,
    branchId,
    memberId,
  };
}

test.describe('Consent Signing (AC-MED-03, BR-014)', () => {
  test('workspace loads with active visit', async ({ page }) => {
    // [AC-MED-03] workspace is accessible before consent signing
    const { patientId } = await setupWithActiveVisit(page);
    await spaNavigate(page, `/${patientId}`);
    await expect(page.getByTestId('timeline-carousel')).toBeVisible();
  });

  test('consent sheet opens, accepts template + signature, and closes on save', async ({
    page,
  }) => {
    // [AC-MED-03] signing flow end-to-end via UI
    const { patientId } = await setupWithActiveVisit(page);
    await spaNavigate(page, `/${patientId}`);

    // Open consent sheet — button with aria-label "Consent"
    const consentBtn = page.getByRole('button', { name: 'Consent', exact: true });
    await consentBtn.waitFor({ state: 'visible', timeout: 8000 });
    await consentBtn.click();

    // Wait for sheet to animate in
    const sheet = page.getByTestId('consent-sheet');
    await sheet.waitFor({ state: 'visible', timeout: 8000 });

    // Select first template
    const templateSelect = sheet.locator('select').first();
    await templateSelect.waitFor({ state: 'visible', timeout: 3000 });
    await templateSelect.selectOption({ index: 1 });

    // Inject signature into canvas via pointer events + toDataURL capture
    await page.evaluate(() => {
      const canvas = document.querySelector(
        '[data-testid="consent-sheet"] canvas',
      ) as HTMLCanvasElement;
      if (!canvas) throw new Error('Signature canvas not found in consent sheet');
      const ctx2d = canvas.getContext('2d')!;
      const rect = canvas.getBoundingClientRect();

      // Simulate a pointer stroke
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          clientX: rect.left + 20,
          clientY: rect.top + 30,
          pointerId: 1,
        }),
      );
      ctx2d.beginPath();
      ctx2d.moveTo(20, 30);
      ctx2d.lineTo(80, 60);
      ctx2d.strokeStyle = '#1a1a1a';
      ctx2d.lineWidth = 2;
      ctx2d.stroke();
      canvas.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          clientX: rect.left + 80,
          clientY: rect.top + 60,
          pointerId: 1,
        }),
      );
    });

    // Brief wait for signatureData state update from stopDraw
    await page.waitForTimeout(300);

    // Submit — the "Save consent form" button
    const submitBtn = sheet.getByRole('button', { name: /save consent/i });
    await submitBtn.click();

    // Sheet must close after successful save
    await expect(sheet).not.toBeVisible({ timeout: 8000 });
  });

  test('signed consent form is immutable — re-sign returns error', async ({ page }) => {
    // [BR-014] backend immutability: signing an already-signed form must fail
    const { patientId, visitId, branchId } = await setupWithActiveVisit(page);
    await spaNavigate(page, `/${patientId}`);

    // Create + sign a consent form via API
    const result = await page.evaluate(
      async (args) => {
        // Create form
        const createRes = await fetch(
          `${args.api}/dental/visits/${args.visitId}/consents`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              visitId: args.visitId,
              templateId: 'tpl-general',
              templateName: 'General Dental Consent',
              patientId: args.patientId,
              branchId: args.branchId,
            }),
          },
        );
        if (!createRes.ok) {
          const errBody = await createRes.text().catch(() => '<unreadable>');
          return { error: `Create failed: ${createRes.status} — ${errBody.slice(0, 500)}`, formId: null };
        }
        const form = await createRes.json();

        // Sign it once — must succeed
        const signRes = await fetch(
          `${args.api}/dental/visits/${args.visitId}/consents/${form.id}/sign`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
            }),
          },
        );
        if (!signRes.ok) return { error: `First sign failed: ${signRes.status}`, formId: form.id };

        // Sign it again — must fail (BR-014 immutability)
        const reSignRes = await fetch(
          `${args.api}/dental/visits/${args.visitId}/consents/${form.id}/sign`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              signatureData: 'data:image/png;base64,different==',
            }),
          },
        );
        return { reSignStatus: reSignRes.status, formId: form.id };
      },
      { api: API, visitId, patientId, branchId },
    );

    // Re-signing a signed form must return 409 Conflict or 400 Bad Request
    expect(result.error).toBeUndefined();
    expect([400, 409]).toContain(result.reSignStatus);
  });

  test('signed consent form is read-only — GET list shows signed=true after signing (AC-MED-03)', async ({ page }) => {
    const { patientId, visitId, branchId } = await setupWithActiveVisit(page);

    const result = await page.evaluate(
      async (args: { api: string; visitId: string; patientId: string; branchId: string }) => {
        // Create consent form
        const createRes = await fetch(`${args.api}/dental/visits/${args.visitId}/consents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            visitId: args.visitId,
            templateId: 'tpl-general',
            templateName: 'General Dental Consent',
            patientId: args.patientId,
            branchId: args.branchId,
          }),
        });
        if (!createRes.ok) return { ok: false, step: 'create', status: createRes.status };
        const form = await createRes.json() as any;

        // Sign it
        const signRes = await fetch(`${args.api}/dental/visits/${args.visitId}/consents/${form.id}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
          }),
        });
        if (!signRes.ok) return { ok: false, step: 'sign', status: signRes.status };

        // GET list for visit — signed form must appear with signed=true
        const listRes = await fetch(`${args.api}/dental/visits/${args.visitId}/consents`, { credentials: 'include' });
        if (!listRes.ok) return { ok: false, step: 'list', status: listRes.status };
        const list = await listRes.json() as any;
        const items: any[] = list.data ?? list.items ?? (Array.isArray(list) ? list : []);
        const found = items.find((c: any) => c.id === form.id);

        return { ok: true, signed: found?.signed ?? found?.signedAt != null, formId: form.id };
      },
      { api: API, visitId, patientId, branchId },
    );

    expect(result.ok).toBe(true);
    expect(result.signed).toBe(true);
  });
});
