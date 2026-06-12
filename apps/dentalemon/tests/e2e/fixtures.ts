/**
 * Global E2E test fixtures — extends Playwright's base test with:
 * - createAppointment helper for scheduling AC tests
 * 1. Console error listener (fails test on uncaught JS errors)
 * 2. Network failure listener (fails test on 4xx/5xx API responses unless expected)
 * 3. Shared dental org setup helper
 */

import { test as base, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

export { expect, APP, API };

/**
 * Map a free-text service description to the appointment `visitType` enum
 * (checkup|treatment|emergency|recall). The wire contract dropped free-text
 * serviceType in favour of this enum (+ free-text `notes`).
 */
export function toVisitType(service?: string): 'checkup' | 'treatment' | 'emergency' | 'recall' {
  const s = (service ?? '').toLowerCase();
  if (/emergency|acute|toothache|\bpain\b|urgent|walk.?in/.test(s)) return 'emergency';
  if (/recall|periodic|annual|maintenance|\breview\b|follow.?up|hygiene/.test(s)) return 'recall';
  if (/exam|checkup|check-up|cleaning|consult|screening/.test(s)) return 'checkup';
  return 'treatment';
}

/**
 * Create + sign a general consent on a visit. The backend gates marking a
 * treatment `performed` (and completing a visit) behind a SIGNED consent
 * (TREATMENT_CONSENT_REQUIRED / VISIT_CONSENT_REQUIRED). A fresh test org has no
 * consent template, so this creates one first, attaches a consent to the visit,
 * and signs it. Mirrors scripts/seed-demo.ts::ensureSignedConsent.
 * Call AFTER creating the visit and BEFORE performing a treatment.
 */
export async function signVisitConsent(
  page: Page,
  opts: { branchId: string; visitId: string; patientId: string },
): Promise<void> {
  const res = await page.evaluate(async ({ api, o }) => {
    // 1. consent template (request = name/body; create returns the bare object).
    const tplRes = await fetch(`${api}/dental/branches/${o.branchId}/consent-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: 'General Treatment Consent', body: 'I consent to treatment.',
      }),
    });
    if (!tplRes.ok) return { ok: false, step: 'template', status: tplRes.status, body: await tplRes.text().catch(() => '') };
    const tpl = await tplRes.json();
    const templateId = tpl?.id;
    // 2. attach consent to the visit.
    const conRes = await fetch(`${api}/dental/visits/${o.visitId}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ visitId: o.visitId, patientId: o.patientId, templateId, templateName: 'General Treatment Consent' }),
    });
    if (!conRes.ok) return { ok: false, step: 'consent', status: conRes.status, body: await conRes.text().catch(() => '') };
    const con = await conRes.json();
    const consentId = con?.consent?.id ?? con?.id;
    // 3. sign it.
    const signRes = await fetch(`${api}/dental/visits/${o.visitId}/consents/${consentId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ signatureData: 'data:image/png;base64,iVBORw0KGgo=' }),
    });
    if (!signRes.ok) return { ok: false, step: 'sign', status: signRes.status, body: await signRes.text().catch(() => '') };
    return { ok: true, step: 'done', status: 200, body: '' };
  }, { api: API, o: opts });
  if (!res.ok) throw new Error(`signVisitConsent failed at ${res.step}: ${res.status} ${res.body}`);
}

/** Extends base test with error-capturing page fixture */
export const test = base.extend<{
  /** Page with auto-attached error listeners */
  errorAwarePage: Page;
}>({
  errorAwarePage: async ({ page }, use) => {
    const errors: string[] = [];
    const failedRequests: string[] = [];

    // Capture uncaught JS errors
    page.on('pageerror', (err) => {
      errors.push(`[JS Error] ${err.message}`);
    });

    // Capture failed API requests (5xx = always fail, 4xx = collect for reporting)
    page.on('response', (response) => {
      const url = response.url();
      // Only track API calls, not static assets
      if (url.includes('/dental/') || url.includes('/auth/') || url.includes('/patients')) {
        if (response.status() >= 500) {
          failedRequests.push(`[${response.status()}] ${response.request().method()} ${url}`);
        }
      }
    });

    await use(page);

    // After test: fail if there were uncaught errors or 5xx responses
    if (errors.length > 0) {
      throw new Error(`Uncaught page errors:\n${errors.join('\n')}`);
    }
    if (failedRequests.length > 0) {
      throw new Error(`Server errors during test:\n${failedRequests.join('\n')}`);
    }
  },
});

/**
 * Complete dental org setup: sign up → create org → create branch → create member → set localStorage
 * Returns everything needed to interact with the dental workspace.
 */
export async function setupDentalOrg(page: Page) {
  const suffix = Date.now();
  const email = `e2e-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  // Sign up via UI
  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`E2E Owner ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially(password, { delay: 10 });
  await expect(pwInput).not.toHaveValue('');
  const signupResponse = page.waitForResponse(
    (resp) => /\/auth\/sign-up/.test(resp.url()) && resp.request().method() === 'POST',
    { timeout: 10000 },
  ).catch(() => null);
  await page.getByRole('button', { name: /create an account/i }).click();
  const response = await signupResponse;
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(`Sign-up failed (${response.status()}): ${body.slice(0, 500)}`);
  }
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });

  // Mark email as verified so the frontend guard doesn't redirect to /verify-email.
  // The backend has requireEmailVerification: false but the frontend guard still checks
  // emailVerified on the session. /dev/verify-email is non-production only.
  // Use the navigation-immune APIRequestContext (page.request, shares context cookies)
  // rather than an in-page fetch — a post-signup client redirect was racing the
  // page.evaluate and destroying its execution context.
  await page.request.post(`${API}/dev/verify-email`);

  // Provision dental org + default branch + owner membership in ONE self-service
  // call (the caller becomes the org owner + dentist_owner member). Replaces the old
  // org→branch→member sequence, which now 403s for a normal user (org creation is
  // admin-only — EM-ORG-002; self-service goes through /dental/onboarding).
  const onbRes = await page.request.post(`${API}/dental/onboarding`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      organizationName: 'E2E Test Clinic',
      tier: 'solo',
      countryCode: 'PH',
      branchName: 'Main Branch',
      timezone: 'Asia/Manila',
      ownerDisplayName: 'E2E Dentist',
    },
  });
  if (!onbRes.ok()) {
    throw new Error(`Onboarding failed (${onbRes.status()}): ${(await onbRes.text().catch(() => '')).slice(0, 300)}`);
  }
  const onb = await onbRes.json();
  const ctx = { orgId: onb.organizationId as string, branchId: onb.branchId as string, memberId: onb.membershipId as string };

  // C-1: activate the freshly-onboarded (provisional) org so journeys run against
  // a live clinic (PHI writes allowed; no provisional-activation banner).
  await page.request.post(`${API}/dental/organizations/${ctx.orgId}/activate`);

  // Set localStorage context
  await page.evaluate((ids) => {
    localStorage.setItem('currentOrgId', ids.orgId);
    localStorage.setItem('currentBranchId', ids.branchId);
    localStorage.setItem('currentMemberId', ids.memberId);
    localStorage.setItem('currentMemberRole', 'dentist_owner');
  }, ctx);

  // The requirePerson guard (src/lib/guards.ts) bounces every protected route to
  // the /onboarding profile wizard until a person profile exists. A fresh signup
  // has none (the demo account the journeys reuse already does), so create one via
  // the API. firstName is the only required field (PersonCreateRequestSchema).
  const personRes = await page.request.post(`${API}/persons`, {
    headers: { 'Content-Type': 'application/json' },
    data: { firstName: 'E2E', lastName: 'Owner', contactInfo: { email } },
  });
  // 409 = person already exists (idempotent retry) → tolerate.
  if (!personRes.ok() && personRes.status() !== 409) {
    throw new Error(`person create failed (${personRes.status()}): ${(await personRes.text().catch(() => '')).slice(0, 200)}`);
  }

  // CC-2: the _workspace + _dashboard route trees are PIN-gated. The in-memory
  // pinSession is minted ONLY by the keypad verify-pin flow and is wiped by a full
  // page reload. A freshly-onboarded member has NO pin (createOnboarding sets none),
  // so set one via the API, then mint the session through the real pin-select →
  // pin-entry keypad (mirrors tests/e2e/journeys/_journey-helpers.ts::pinAuth).
  // After this returns, the page holds a live pin session — reach gated routes with
  // gotoApp() (SPA-nav), NEVER page.goto (a hard reload wipes the session).
  const setPinRes = await page.request.post(
    `${API}/dental/organizations/${ctx.orgId}/branches/${ctx.branchId}/members/${ctx.memberId}/set-pin`,
    { headers: { 'Content-Type': 'application/json' }, data: { pin: DEMO_PIN } },
  );
  if (!setPinRes.ok()) {
    throw new Error(`set-pin failed (${setPinRes.status()}): ${(await setPinRes.text().catch(() => '')).slice(0, 200)}`);
  }

  await page.goto(`${APP}/auth/pin-select`);
  await page.waitForLoadState('networkidle');
  // Single-member orgs may auto-redirect straight to pin-entry; handle both.
  if (page.url().includes('/auth/pin-select')) {
    const card = page.getByRole('button', { name: new RegExp(`Sign in as ${OWNER_DISPLAY_NAME}`, 'i') });
    await expect(card, `PIN-select card for "${OWNER_DISPLAY_NAME}" must render`).toBeVisible({ timeout: 15000 });
    await card.click();
  }
  await page.waitForURL(/\/auth\/pin-entry\//, { timeout: 10000 });
  await expect(page.getByLabel('1')).toBeVisible({ timeout: 10000 });
  for (const digit of DEMO_PIN) {
    await page.getByRole('button', { name: new RegExp(`^${digit}$`) }).click();
  }
  // Land off the auth flow — the in-memory pin session is now active.
  await page.waitForURL((url: URL) => !url.pathname.startsWith('/auth/'), { timeout: 10000 });

  return { email, password, pin: DEMO_PIN, ...ctx };
}

/** PIN used for the self-bootstrap fixture owner (valid per /^\d{4,8}$/). */
const DEMO_PIN = '123456';
/** Display name onboarded by setupDentalOrg — must match the pin-select card text. */
const OWNER_DISPLAY_NAME = 'E2E Dentist';

/**
 * SPA-navigate to a same-origin app route WITHOUT a full reload. The workspace +
 * dashboard route trees are PIN-gated and the pin session minted by setupDentalOrg
 * lives ONLY in memory — a hard page.goto wipes it and bounces to /auth/pin-select.
 * TanStack Router intercepts the history change and renders the target with the
 * session intact (mirrors _journey-helpers.ts::openWorkspace).
 *
 * Accepts a path ("/patients", `/${patientId}`) or a full APP URL.
 */
export async function gotoApp(page: Page, pathOrUrl: string): Promise<void> {
  const to = pathOrUrl.startsWith('http')
    ? new URL(pathOrUrl).pathname + new URL(pathOrUrl).search
    : pathOrUrl;
  await page.evaluate((target) => {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, to);
  await page.waitForLoadState('networkidle');
}

/**
 * Create a dental patient within a branch.
 * Returns the patient ID.
 */
export async function createDentalPatient(page: Page, opts: {
  displayName: string;
  branchId: string;
  dateOfBirth?: string;
  gender?: string;
}) {
  const res = await page.evaluate(async ({ api, opts }) => {
    const r = await fetch(`${api}/dental/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        displayName: opts.displayName,
        dateOfBirth: opts.dateOfBirth ?? '1990-01-01',
        gender: opts.gender ?? 'female',
        branchId: opts.branchId,
        consentGiven: true,
      }),
    });
    if (!r.ok) throw new Error(`Patient creation failed: ${r.status}`);
    return r.json();
  }, { api: API, opts });

  return res.id as string;
}

/**
 * Create a dental appointment within a branch.
 * Returns the appointment object (id, status, scheduledAt, ...).
 */
export async function createAppointment(page: Page, opts: {
  patientId: string;
  branchId: string;
  memberId: string;
  scheduledAt?: string;
  durationMinutes?: number;
  serviceType?: string;
}) {
  // Contract (CreateAppointmentRequestSchema): providerId, startAt, endAt (ISO
  // datetimes), visitType (checkup|treatment|emergency|recall) — NOT the legacy
  // dentistMemberId/scheduledAt/durationMinutes/serviceType. Translate the helper's
  // friendly opts to the wire contract; keep the free-text service string in `notes`.
  const startAt = opts.scheduledAt ?? new Date(Date.now() + 86400000).toISOString();
  const durationMinutes = opts.durationMinutes ?? 30;
  const endAt = new Date(new Date(startAt).getTime() + durationMinutes * 60_000).toISOString();
  const visitType = toVisitType(opts.serviceType);
  const res = await page.evaluate(async ({ api, opts, startAt, endAt, visitType }) => {
    const r = await fetch(`${api}/dental/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        patientId: opts.patientId,
        branchId: opts.branchId,
        providerId: opts.memberId,
        startAt,
        endAt,
        visitType,
        notes: opts.serviceType,
      }),
    });
    if (!r.ok) throw new Error(`Appointment creation failed: ${r.status} ${await r.text().catch(() => '')}`);
    return r.json();
  }, { api: API, opts, startAt, endAt, visitType });

  return res as { id: string; status: string; startAt: string; endAt: string; visitType: string };
}
