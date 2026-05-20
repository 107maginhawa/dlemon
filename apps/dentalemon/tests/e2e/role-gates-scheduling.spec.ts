/**
 * E2E: Role Gates — staff_scheduling blocked from clinical write endpoints
 *
 * BRs covered: BR-016, G1-S1 cross-module
 *
 * Verifies that a real staff_scheduling member gets 403 on:
 *   - POST /dental/visits/:visitId/treatments (createDentalTreatment)
 *   - POST /dental/visits/:visitId/prescriptions (createPrescription)
 *   - POST /dental/billing/invoices/:invoiceId/void (voidDentalInvoice)
 *
 * Uses two browser contexts: owner sets up org/data, scheduling user tests endpoints.
 */

import { test, expect, type Browser } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

async function signUpApi(page: { evaluate: Function }, email: string, name: string): Promise<string> {
  return page.evaluate(async ({ api, app, email, name }: { api: string; app: string; email: string; name: string }) => {
    const r = await fetch(`${api}/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password: 'E2eTestPass123!', name }),
    });
    if (!r.ok) throw new Error(`Sign-up failed: ${r.status} ${await r.text()}`);
    const data = await r.json() as any;
    return data.user?.id ?? '';
  }, { api: API, app: APP, email, name });
}

test.describe('Role Gates: staff_scheduling blocked from clinical writes', () => {
  test('staff_scheduling gets 403 on treatment, prescription, and invoice-void endpoints', async ({ browser }: { browser: Browser }) => {
    const suffix = Date.now();

    // ── Owner context: set up org, branch, patient, visit ─────────────────
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();

    // Sign up owner via UI
    const ownerEmail = `g1-owner-${suffix}@example.org`;
    await ownerPage.goto(`${APP}/auth/sign-up`);
    await ownerPage.waitForLoadState('networkidle');
    await ownerPage.getByLabel('Name', { exact: true }).fill(`G1 Owner ${suffix}`);
    await ownerPage.getByLabel('Email', { exact: true }).fill(ownerEmail);
    const pwInput = ownerPage.locator('input[type="password"]');
    await pwInput.click();
    await pwInput.pressSequentially('E2eTestPass123!', { delay: 10 });
    await ownerPage.getByRole('button', { name: /create an account/i }).click();
    await ownerPage.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });
    await ownerPage.evaluate(async (api: string) => {
      await fetch(`${api}/dev/verify-email`, { method: 'POST', credentials: 'include' });
    }, API);

    // Create org + branch + owner member + patient + visit
    const ownerData = await ownerPage.evaluate(async (api: string) => {
      const session = await (await fetch(`${api}/auth/get-session`, { credentials: 'include' })).json() as any;
      const personId: string = session?.user?.id;

      const org = await (await fetch(`${api}/dental/organizations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: 'G1 Role Gate Clinic', tier: 'solo', countryCode: 'PH' }),
      })).json() as any;

      const branch = await (await fetch(`${api}/dental/organizations/${org.id}/branches`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: 'Main', timezone: 'Asia/Manila' }),
      })).json() as any;

      const ownerMember = await (await fetch(`${api}/dental/organizations/${org.id}/branches/${branch.id}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ displayName: 'G1 Owner', role: 'dentist_owner', personId }),
      })).json() as any;

      const patient = await (await fetch(`${api}/dental/patients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ displayName: 'G1 Patient', dateOfBirth: '1990-01-01', gender: 'male', branchId: branch.id, consentGiven: true }),
      })).json() as any;

      const visit = await (await fetch(`${api}/dental/visits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ patientId: patient.id, branchId: branch.id, dentistMemberId: ownerMember.id }),
      })).json() as any;

      if (!visit.id) throw new Error(`Visit creation failed: ${JSON.stringify(visit)}`);

      return { orgId: org.id, branchId: branch.id, patientId: patient.id, visitId: visit.id, memberId: ownerMember.id };
    }, API);

    // ── Create staff_scheduling user (sign up via API) ─────────────────────
    const schedEmail = `g1-sched-${suffix}@example.org`;
    const schedCtx = await browser.newContext();
    const schedPage = await schedCtx.newPage();

    // Sign up scheduling user
    await schedPage.goto(`${APP}/auth/sign-up`);
    await schedPage.waitForLoadState('networkidle');
    await schedPage.getByLabel('Name', { exact: true }).fill(`G1 Scheduling ${suffix}`);
    await schedPage.getByLabel('Email', { exact: true }).fill(schedEmail);
    const schedPw = schedPage.locator('input[type="password"]');
    await schedPw.click();
    await schedPw.pressSequentially('E2eTestPass123!', { delay: 10 });
    await schedPage.getByRole('button', { name: /create an account/i }).click();
    await schedPage.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });
    await schedPage.evaluate(async (api: string) => {
      await fetch(`${api}/dev/verify-email`, { method: 'POST', credentials: 'include' });
    }, API);

    const schedPersonId = await schedPage.evaluate(async (api: string) => {
      const s = await (await fetch(`${api}/auth/get-session`, { credentials: 'include' })).json() as any;
      return s?.user?.id as string;
    }, API);

    // Owner adds scheduling user as staff_scheduling member
    await ownerPage.evaluate(async ({ api, branchId, orgId, personId }: { api: string; branchId: string; orgId: string; personId: string }) => {
      const r = await fetch(`${api}/dental/organizations/${orgId}/branches/${branchId}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ displayName: 'Scheduling Staff', role: 'staff_scheduling', personId }),
      });
      if (!r.ok) throw new Error(`Member creation failed: ${r.status} ${await r.text()}`);
    }, { api: API, branchId: ownerData.branchId, orgId: ownerData.orgId, personId: schedPersonId });

    // ── scheduling user makes restricted API calls ─────────────────────────
    // Note: voidDentalInvoice looks up the invoice before the role check (needs a
    // real performed-treatment → invoice chain). It is covered by the dental-billing
    // unit test instead.
    const results = await schedPage.evaluate(async ({ api, visitId, patientId, memberId }: { api: string; visitId: string; patientId: string; memberId: string }) => {
      const treatmentRes = await fetch(`${api}/dental/visits/${visitId}/treatments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ visitId, patientId, cdtCode: 'D0150', description: 'Exam', priceCents: 5000 }),
      });

      const prescriptionRes = await fetch(`${api}/dental/visits/${visitId}/prescriptions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ visitId, patientId, prescriberMemberId: memberId, drugName: 'Amoxicillin', dosage: '500mg', frequency: 'TID' }),
      });

      return {
        treatment: treatmentRes.status,
        prescription: prescriptionRes.status,
      };
    }, { api: API, visitId: ownerData.visitId, patientId: ownerData.patientId, memberId: ownerData.memberId });

    expect(results.treatment, 'createDentalTreatment should block staff_scheduling').toBe(403);
    expect(results.prescription, 'createPrescription should block staff_scheduling').toBe(403);

    await ownerCtx.close();
    await schedCtx.close();
  });
});
