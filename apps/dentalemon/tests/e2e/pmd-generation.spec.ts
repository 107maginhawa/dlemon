/**
 * E2E: PMD Generation — Journey
 *
 * Flow: sign up → create patient → create visit → activate → add treatment →
 *       complete visit → generate PMD → verify PMD content
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function setup(page: Page) {
  const suffix = Date.now();

  // Sign up
  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`PMD Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(`pmd-e2e-${suffix}@example.org`);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially('E2eTestPass123!', { delay: 10 });
  await expect(pwInput).not.toHaveValue('');
  const signupResponse = page.waitForResponse(
    (resp: any) => /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
    { timeout: 10000 },
  ).catch(() => null);
  await page.getByRole('button', { name: /create an account/i }).click();
  const response = await signupResponse;
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up POST returned \${response.status()}: \${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

  // Create patient
  const patientRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: [{ use: 'official', family: 'Dela Cruz', given: ['Jose'] }],
        birthDate: '1970-05-01',
        gender: 'male',
      }),
    });
    return res.json();
  }, API);

  return { patientId: patientRes.id };
}

async function createAndCompleteVisit(page: Page, patientId: string) {
  // Create visit
  const visitRes = await page.evaluate(async ({ api, patientId }) => {
    const res = await fetch(`${api}/dental/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        patientId,
        branchId: '00000000-0000-4000-8000-000000000001',
        dentistMemberId: '00000000-0000-4000-8000-000000000002',
      }),
    });
    return res.json();
  }, { api: API, patientId });

  const visitId = visitRes.id;

  // Activate
  await page.evaluate(async ({ api, visitId }) => {
    return fetch(`${api}/dental/visits/${visitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'active' }),
    });
  }, { api: API, visitId });

  // Add treatment
  await page.evaluate(async ({ api, visitId, patientId }) => {
    return fetch(`${api}/dental/visits/${visitId}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        visitId,
        patientId,
        cdtCode: 'D2391',
        description: 'Resin composite, one surface',
        toothNumber: 21,
        priceCents: 15000,
      }),
    });
  }, { api: API, visitId, patientId });

  // Complete
  await page.evaluate(async ({ api, visitId }) => {
    return fetch(`${api}/dental/visits/${visitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'completed' }),
    });
  }, { api: API, visitId });

  return visitId;
}

test.describe('PMD Generation', () => {
  test('can generate PMD from a completed visit', async ({ page }) => {
    const { patientId } = await setup(page);
    const visitId = await createAndCompleteVisit(page, patientId);

    const pmdRes = await page.evaluate(async ({ api, visitId, patientId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/pmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId }),
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, visitId, patientId });

    expect(pmdRes.status).toBe(201);
    expect(pmdRes.body.status).toBe('generated');
    expect(pmdRes.body.visitId).toBe(visitId);
    expect(pmdRes.body.checksum).toBeTruthy();
  });

  test('PMD content includes treatment data', async ({ page }) => {
    const { patientId } = await setup(page);
    const visitId = await createAndCompleteVisit(page, patientId);

    const pmdRes = await page.evaluate(async ({ api, visitId, patientId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/pmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId }),
      });
      return res.json();
    }, { api: API, visitId, patientId });

    const content = JSON.parse(pmdRes.content);
    expect(Array.isArray(content.treatments)).toBe(true);
    expect(content.treatments.length).toBeGreaterThan(0);
    expect(content.treatments[0].cdtCode).toBe('D2391');
  });

  test('cannot generate PMD from a draft visit', async ({ page }) => {
    const { patientId } = await setup(page);

    const visitRes = await page.evaluate(async ({ api, patientId }) => {
      const res = await fetch(`${api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId,
          branchId: '00000000-0000-4000-8000-000000000001',
          dentistMemberId: '00000000-0000-4000-8000-000000000002',
        }),
      });
      return res.json();
    }, { api: API, patientId });

    const status = await page.evaluate(async ({ api, visitId, patientId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/pmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId }),
      });
      return res.status;
    }, { api: API, visitId: visitRes.id, patientId });

    expect(status).toBe(400);
  });

  test('can retrieve generated PMD by visitId', async ({ page }) => {
    const { patientId } = await setup(page);
    const visitId = await createAndCompleteVisit(page, patientId);

    // Generate
    await page.evaluate(async ({ api, visitId, patientId }) => {
      return fetch(`${api}/dental/visits/${visitId}/pmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId, patientId }),
      });
    }, { api: API, visitId, patientId });

    // Retrieve
    const getRes = await page.evaluate(async ({ api, visitId }) => {
      const res = await fetch(`${api}/dental/visits/${visitId}/pmd`, {
        credentials: 'include',
      });
      return { status: res.status, body: await res.json() };
    }, { api: API, visitId });

    expect(getRes.status).toBe(200);
    expect(getRes.body.visitId).toBe(visitId);
  });
});
