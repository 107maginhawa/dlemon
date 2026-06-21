/**
 * E2E: Patient self-service portal — the patient's "day in the life" (E4).
 *
 * Closes the patient-portal e2e coverage cluster (plan 013, Phase 3a). The portal
 * routes/views/testids and the /me/* endpoints all existed and were be-unit + RTL
 * tested, but NO end-to-end spec drove the real patient-facing UI. This walks a
 * logged-in patient through the whole portal surface in one session:
 *
 *   1. /portal root REDIRECTS to the Appointments tab          (portal-index-redirect)
 *   2. own appointments render from GET /me/appointments       (portal-list-my-appointments)
 *   3. bottom-tab navigation Appointments <-> Bills            (portal-tab-navigation)
 *   4. own invoices render from GET /me/invoices               (portal-list-my-invoices)
 *   5. balance roll-up equals GET /me/balance (the facade)     (portal-get-my-balance,
 *                                                               inter-portal-billing-facade)
 *   6. sign-out destroys the session                           (portal-sign-out)
 *
 * A patient who owns data does not exist in any seed (seeded patients have no
 * login; online booking is anonymous), so we construct one honestly over HTTP:
 *   - a fresh clinic owner (separate cookie jar) provisions an org/branch;
 *   - the patient signs up (email/password) and SELF-REGISTERS a dental_patient
 *     into that branch (createPatient → ensurePersonForUser, person.id === user.id);
 *   - the owner seeds one appointment + one issued invoice for that patient.
 * Session establishment + seeding is infrastructure (the allowed non-DOM writes);
 * the portal navigation under test is driven through the rendered DOM, and goal
 * state is asserted via an independent /me/* read on the patient's own cookie jar.
 *
 * Standard authed Postgres lane — no Mailpit/MinIO (Set A). Self-contained: it
 * provisions its own org, so it does not depend on the demo seed being present.
 */

import {
  test,
  expect,
  type Page,
  type APIRequestContext,
  request as pwRequest,
} from '@playwright/test';
import { API, APP } from './helpers/e2e-seed';

const PW = 'E2eTestPass123!';

/** A fresh clinic owner in its OWN cookie jar (separate from the patient session). */
async function seedOwnerOrg(): Promise<{
  ownerCtx: APIRequestContext;
  branchId: string;
  memberId: string;
}> {
  const ownerCtx = await pwRequest.newContext({ baseURL: API });
  const email = `portal-owner-${Date.now()}@example.org`;
  const su = await ownerCtx.post('/auth/sign-up/email', {
    data: { email, password: PW, name: 'Portal Owner' },
  });
  expect(su.ok(), `owner sign-up → ${su.status()}`).toBeTruthy();
  await ownerCtx.post('/dev/verify-email');
  await ownerCtx.post('/persons', { data: { firstName: 'Portal', lastName: 'Owner' } });
  const onb = await ownerCtx.post('/dental/onboarding', {
    data: {
      organizationName: 'Portal Clinic',
      tier: 'solo',
      countryCode: 'PH',
      branchName: 'Main Branch',
      timezone: 'Asia/Manila',
      ownerDisplayName: 'Portal Dentist',
    },
  });
  expect(onb.ok(), `onboarding → ${onb.status()}`).toBeTruthy();
  const { organizationId, branchId, membershipId } = (await onb.json()) as {
    organizationId: string;
    branchId: string;
    membershipId: string;
  };
  await ownerCtx.post(`/dental/organizations/${organizationId}/activate`);
  return { ownerCtx, branchId, memberId: membershipId };
}

/**
 * Sign the patient up (email/password) into the browser's cookie jar and
 * self-register their dental_patient into `branchId`. Returns the patient's
 * dental_patient id (used by the owner to seed appointments/invoices).
 */
async function establishPatientSession(page: Page, branchId: string): Promise<string> {
  // Land on the app origin so page.request shares the browser context cookie jar.
  await page.goto(`${APP}/auth/sign-in`);
  const email = `portal-patient-${Date.now()}@example.org`;
  const su = await page.request.post(`${API}/auth/sign-up/email`, {
    data: { email, password: PW, name: 'Portal Patient' },
  });
  expect(su.ok(), `patient sign-up → ${su.status()}`).toBeTruthy();
  await page.request.post(`${API}/dev/verify-email`);
  await page.request.post(`${API}/persons`, {
    data: { firstName: 'Portal', lastName: 'Patient' },
  });
  // Self-registration (no personId) → ensurePersonForUser links person.id === user.id.
  const pr = await page.request.post(`${API}/patients`, {
    data: {
      name: [{ given: ['Portal'], family: 'Patient' }],
      birthDate: '1990-01-01',
      gender: 'male',
      preferredBranchId: branchId,
    },
  });
  expect(pr.status(), `self-register patient → ${pr.status()}`).toBe(201);
  return ((await pr.json()) as { id: string }).id;
}

/** Owner seeds ONE issued invoice (₱50 balance) for `patientId`, mirroring patient-balance.spec. */
async function seedIssuedInvoice(
  ownerCtx: APIRequestContext,
  branchId: string,
  memberId: string,
  patientId: string,
): Promise<void> {
  const visit = await (
    await ownerCtx.post('/dental/visits', { data: { patientId, branchId, dentistMemberId: memberId } })
  ).json();
  const visitId = visit.id as string;
  await ownerCtx.patch(`/dental/visits/${visitId}`, { data: { status: 'active' } });

  const tpl = await (
    await ownerCtx.post(`/dental/branches/${branchId}/consent-templates`, {
      data: { name: 'General Treatment Consent', body: 'I consent.' },
    })
  ).json();
  const con = await (
    await ownerCtx.post(`/dental/visits/${visitId}/consents`, {
      data: { visitId, patientId, templateId: tpl.id, templateName: 'General Treatment Consent' },
    })
  ).json();
  const consentId = con?.consent?.id ?? con?.id;
  await ownerCtx.post(`/dental/visits/${visitId}/consents/${consentId}/sign`, {
    data: { signatureData: 'data:image/png;base64,iVBORw0KGgo=' },
  });

  const treatment = await (
    await ownerCtx.post(`/dental/visits/${visitId}/treatments`, {
      data: {
        visitId,
        patientId,
        cdtCode: 'D1110',
        description: 'Prophylaxis',
        toothNumber: 16,
        priceCents: 5000,
      },
    })
  ).json();
  const treatmentId = treatment?.id ?? treatment?.data?.id;
  for (const status of ['planned', 'performed']) {
    await ownerCtx.patch(`/dental/visits/${visitId}/treatments/${treatmentId}`, { data: { status } });
  }
  await ownerCtx.patch(`/dental/visits/${visitId}`, { data: { status: 'completed' } });

  const invoice = await (
    await ownerCtx.post('/dental/billing/invoices', {
      data: { visitId, patientId, branchId, dentistMemberId: memberId },
    })
  ).json();
  const issue = await ownerCtx.patch(`/dental/billing/invoices/${invoice.id}/issue`, { data: {} });
  expect(issue.ok(), `issue invoice → ${issue.status()}`).toBeTruthy();
}

/** Mirror src/lib/format-currency.ts formatCents — the figure the UI must render. */
function formatCents(cents: number): string {
  return `₱${(cents / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

test.describe('Patient self-service portal (E4)', () => {
  test('a logged-in patient navigates appointments, bills, balance, and signs out', async ({ page }) => {
    test.slow(); // sign-up + onboarding + visit→invoice seeding + a full DOM walk.

    const { ownerCtx, branchId, memberId } = await seedOwnerOrg();
    try {
      const patientId = await establishPatientSession(page, branchId);

      // Owner seeds the patient's own data (separate cookie jar).
      const startAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
      const endAt = new Date(Date.now() + 3 * 86_400_000 + 30 * 60_000).toISOString();
      const appt = await ownerCtx.post('/dental/appointments', {
        data: { patientId, providerId: memberId, branchId, startAt, endAt, visitType: 'checkup' },
      });
      expect(appt.status(), `seed appointment → ${appt.status()}`).toBe(201);
      await seedIssuedInvoice(ownerCtx, branchId, memberId, patientId);

      // ── 1. /portal redirects to the Appointments tab. ──────────────────────
      await page.goto(`${APP}/portal`);
      await page.waitForURL(/\/portal\/appointments$/, { timeout: 15_000 });
      await expect(page.getByTestId('portal-tab-appointments')).toHaveAttribute(
        'aria-current',
        'page',
      );

      // ── 2. Own appointments render (GET /me/appointments). ─────────────────
      await expect(page.getByTestId('portal-appointments-list')).toBeVisible();
      await expect(page.getByTestId('portal-appointment-card')).toHaveCount(1);

      // ── 3. Bottom-tab navigation Appointments → Bills. ─────────────────────
      await page.getByTestId('portal-tab-bills').click();
      await page.waitForURL(/\/portal\/bills$/, { timeout: 10_000 });
      await expect(page.getByTestId('portal-tab-bills')).toHaveAttribute('aria-current', 'page');

      // ── 4. Own invoices render (GET /me/invoices). ─────────────────────────
      await expect(page.getByTestId('portal-invoices-list')).toBeVisible();
      await expect(page.getByTestId('portal-invoice-card')).toHaveCount(1);

      // ── 5. Balance roll-up MIRRORS GET /me/balance (the billing facade). ───
      // Independent read on the patient's OWN cookie jar — the contract the UI
      // must reflect, not a client-side sum of visible rows.
      const balRes = await page.request.get(`${API}/me/balance`);
      expect(balRes.ok(), `GET /me/balance → ${balRes.status()}`).toBeTruthy();
      const { outstandingBalanceCents } = (await balRes.json()) as {
        outstandingBalanceCents: number;
      };
      expect(outstandingBalanceCents).toBe(5000); // the single ₱50 issued invoice
      await expect(page.getByTestId('portal-balance-amount')).toHaveText(
        formatCents(outstandingBalanceCents),
      );

      // ── tab back to Appointments (both directions of the control). ─────────
      await page.getByTestId('portal-tab-appointments').click();
      await page.waitForURL(/\/portal\/appointments$/, { timeout: 10_000 });
      await expect(page.getByTestId('portal-tab-appointments')).toHaveAttribute(
        'aria-current',
        'page',
      );

      // ── 6. Sign out destroys the session (goal-state independent read). ────
      const [soResp] = await Promise.all([
        page.waitForResponse(
          (r) => /\/auth\/sign-out/.test(r.url()) && r.request().method() === 'POST',
          { timeout: 10_000 },
        ),
        page.getByTestId('portal-sign-out').click(),
      ]);
      expect(soResp.status(), 'POST /auth/sign-out must be 200').toBe(200);
      await page.waitForURL(/\/auth\/sign-in/, { timeout: 10_000 });
      const sess = await page.request.get(`${API}/auth/get-session`);
      const body = (await sess.json()) as { user?: { email?: string } } | null;
      expect(body?.user?.email ?? null, 'sign-out must destroy the session').toBeNull();
    } finally {
      await ownerCtx.dispose();
    }
  });
});
