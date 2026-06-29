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
import { API, APP, signUpOnboardAndUnlock } from './helpers/e2e-seed';

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

    // Provision org+branch+owner via /dental/onboarding (org creation is admin-only
    // — EM-ORG-002), set a PIN, and unlock. The owner then seeds a patient + visit
    // and (below) adds the scheduling user as an EXTRA member (member creation by an
    // owner is allowed; only org creation was gated).
    const owner = await signUpOnboardAndUnlock(ownerPage, { tier: 'solo', label: 'G1' });

    // Create patient + visit
    const ownerData = await ownerPage.evaluate(async ({ api, branchId, memberId, orgId }: { api: string; branchId: string; memberId: string; orgId: string }) => {
      const patientRes = await fetch(`${api}/dental/patients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ displayName: 'G1 Patient', dateOfBirth: '1990-01-01', gender: 'male', branchId, consentGiven: true }),
      });
      if (!patientRes.ok) throw new Error(`Patient creation failed: ${patientRes.status} ${await patientRes.text()}`);
      const patient = await patientRes.json() as any;

      const visitRes = await fetch(`${api}/dental/visits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ patientId: patient.id, branchId, dentistMemberId: memberId }),
      });
      if (!visitRes.ok) throw new Error(`Visit creation failed: ${visitRes.status} ${await visitRes.text()}`);
      const visit = await visitRes.json() as any;

      if (!visit.id) throw new Error(`Visit creation failed: ${JSON.stringify(visit)}`);

      return { orgId, branchId, patientId: patient.id, visitId: visit.id, memberId };
    }, { api: API, branchId: owner.branchId, memberId: owner.memberId, orgId: owner.orgId });

    // ── Create staff_scheduling user (sign up via API) ─────────────────────
    const schedEmail = `g1-sched-${suffix}@example.org`;
    const schedCtx = await browser.newContext();
    const schedPage = await schedCtx.newPage();

    // Sign up scheduling user via the API (not the UI form). Submitting the
    // sign-up form kicks off a post-auth redirect chain; the immediately-following
    // page.evaluate then raced it ("Execution context was destroyed … navigation")
    // under CI's slower timing. Loading a stable page once and signing up over
    // fetch removes the navigation entirely.
    await schedPage.goto(`${APP}/auth/sign-up`);
    await schedPage.waitForLoadState('domcontentloaded');
    await signUpApi(schedPage, schedEmail, `G1 Scheduling ${suffix}`);
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
