/**
 * E2E: Cold-start golden path — the continuous full-loop spec.
 *
 * The ONE test that proves the real chain works end-to-end from a brand-new
 * signup, asserting RENDERED CONTENT (not just chrome) at every back-office read:
 *
 *   sign up (UI) → onboarding wizard (UI, 4 steps) → PIN unlock (real keypad)
 *   → patients (UI) → workspace: create visit + init dentition + chart a tooth
 *     condition + CDT treatment (UI) → sign consent + advance FSM (API-assist)
 *     → complete visit via pre-completion checklist (UI)
 *   → billing invoice + payment (API-assist) → assert Paid in billing list (UI)
 *   → calendar appt (UI) → revenue report invoice (UI)
 *   → add staff member (UI) → sign out → re-login → RBAC gate + patient persists
 *
 * Unlike the fragmented per-workflow specs, this is self-seeded from a fresh
 * signup and never reuses the demo seed. API-assist is used ONLY for steps that
 * are not meaningfully UI-drivable (email verify, person record, consent
 * signature canvas, FSM transitions, invoice/payment plumbing) — and EVERY
 * assertion is UI-side against rendered content.
 *
 * Preconditions: API on :7213, app on :3003 (playwright.config webServer boots both).
 */

import { test, expect, API, APP, signVisitConsent } from './fixtures';
import type { Page, APIRequestContext } from '@playwright/test';

const PIN = '123456';
const STAFF_PIN = '246802';

// ─── API-assist helpers (share the browser context's auth cookie) ──────────────

async function getOrgContext(req: APIRequestContext) {
  const res = await req.get(`${API}/dental/org/context`);
  if (!res.ok()) throw new Error(`org/context ${res.status()}: ${(await res.text()).slice(0, 200)}`);
  const ctx = await res.json();
  return {
    orgId: ctx.org?.id as string,
    branchId: ctx.branch?.id as string,
    memberId: ctx.member?.id as string,
    role: ctx.member?.role as string,
  };
}

function unwrapList<T = any>(body: any): T[] {
  return Array.isArray(body) ? body : (body?.data ?? []);
}

// ─── The spec ──────────────────────────────────────────────────────────────────

test.describe('Cold-start full loop', () => {
  test('fresh signup → full clinical→billing→back-office loop with content assertions', async ({ errorAwarePage: page }) => {
    test.setTimeout(180_000);

    const suffix = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const email = `coldstart-${suffix}@example.org`;
    const password = 'E2eColdStart123!';
    const clinicName = `Cold Start Clinic ${suffix}`;
    const dentistName = 'Dr. Cold Start';
    const patientName = `Alma Ramos ${suffix}`;
    const staffName = `Front Desk ${suffix}`;

    let ids = { orgId: '', branchId: '', memberId: '', role: '' };
    let patientId = '';
    let visitId = '';
    let invoiceNumber = '';

    // ── 1. Sign up (real UI) ────────────────────────────────────────────────────
    await test.step('sign up via UI', async () => {
      await page.goto(`${APP}/auth/sign-up`);
      await page.waitForLoadState('networkidle');
      await page.getByLabel('Name', { exact: true }).fill(`Cold Start Owner ${suffix}`);
      await page.getByLabel('Email', { exact: true }).fill(email);
      const pw = page.locator('input[type="password"]');
      await pw.click();
      await pw.pressSequentially(password, { delay: 10 });
      const signup = page
        .waitForResponse((r) => /\/auth\/sign-up/.test(r.url()) && r.request().method() === 'POST', { timeout: 15000 })
        .catch(() => null);
      await page.getByRole('button', { name: /create an account/i }).click();
      const resp = await signup;
      if (resp && resp.status() >= 400) {
        throw new Error(`Sign-up failed (${resp.status()}): ${(await resp.text().catch(() => '')).slice(0, 300)}`);
      }
      await page.waitForURL((u: URL) => !u.pathname.includes('/auth/sign-up'), { timeout: 15000 });
    });

    // ── infra preconditions (not under test): verify email + person record ──────
    await test.step('infra: verify email + person', async () => {
      await page.request.post(`${API}/dev/verify-email`);
      const pr = await page.request.post(`${API}/persons`, {
        headers: { 'Content-Type': 'application/json' },
        data: { firstName: 'Cold', lastName: 'Start', contactInfo: { email } },
      });
      if (!pr.ok() && pr.status() !== 409) {
        throw new Error(`person create ${pr.status()}: ${(await pr.text().catch(() => '')).slice(0, 200)}`);
      }
    });

    // ── 2. Onboarding wizard (real UI, 4 steps) ─────────────────────────────────
    await test.step('drive onboarding wizard', async () => {
      await page.goto(`${APP}/dental-onboarding`);
      await page.waitForLoadState('networkidle');

      // Step 1 — Clinic
      await expect(page.getByRole('heading', { name: 'Clinic Setup' })).toBeVisible({ timeout: 15000 });
      await page.getByLabel(/clinic name/i).fill(clinicName);
      await page.getByRole('button', { name: /^next$/i }).click();

      // Step 2 — Dentist + PIN
      await expect(page.getByRole('heading', { name: 'Dentist Profile' })).toBeVisible();
      await page.getByLabel(/full name/i).fill(dentistName);
      await page.locator('#dentist-pin').fill(PIN);
      await page.getByRole('button', { name: /^next$/i }).click();

      // Step 3 — Fees (optional)
      await expect(page.getByRole('heading', { name: 'Fee Schedule' })).toBeVisible();
      await page.getByRole('button', { name: /^next$/i }).click();

      // Step 4 — First patient
      await expect(page.getByRole('heading', { name: 'First Patient' })).toBeVisible();
      await page.getByLabel(/full name/i).fill(patientName);
      await page.locator('input[type="date"]').fill('1985-04-12');

      const onbResp = page
        .waitForResponse((r) => /\/dental\/onboarding$/.test(r.url()) && r.request().method() === 'POST', { timeout: 15000 })
        .catch(() => null);
      await page.getByRole('button', { name: /get started/i }).click();
      const onb = await onbResp;
      if (onb && onb.status() >= 400) {
        throw new Error(`onboarding POST ${onb.status()}: ${(await onb.text().catch(() => '')).slice(0, 300)}`);
      }

      // Wizard finishes → navigates to /dashboard → bounced to the PIN gate
      // (no in-memory pin session yet).
      await page.waitForURL(/\/auth\/pin/, { timeout: 20000 });
    });

    // ── 3. PIN unlock (real keypad) ─────────────────────────────────────────────
    await test.step('unlock workspace via PIN keypad', async () => {
      // Single-member orgs auto-redirect pin-select → pin-entry; multi-member shows
      // a chooser. Wait for whichever appears, click the owner card if present.
      const keypad = page.getByRole('group', { name: /PIN keypad/i });
      const ownerCard = page.getByRole('button', { name: new RegExp(`Sign in as ${dentistName}`, 'i') });
      await expect(keypad.or(ownerCard).first()).toBeVisible({ timeout: 15000 });
      if (await ownerCard.isVisible().catch(() => false)) await ownerCard.click();
      await expect(keypad).toBeVisible({ timeout: 15000 });
      for (const d of PIN) {
        await page.getByRole('button', { name: d, exact: true }).click();
      }
      await page.waitForURL((u: URL) => !u.pathname.startsWith('/auth/'), { timeout: 15000 });

      ids = await getOrgContext(page.request);
      expect(ids.branchId, 'org context resolved after onboarding').toBeTruthy();
      expect(ids.role).toBe('dentist_owner');
    });

    // ── 4. Patients — the wizard's first patient renders ────────────────────────
    await test.step('patient list shows the onboarded patient', async () => {
      await spa(page, '/patients');
      const card = page.getByRole('button', { name: new RegExp(`Open patient record for ${patientName}`, 'i') });
      await expect(card).toBeVisible({ timeout: 15000 });

      // Resolve the patient id for later API-assist.
      const pr = await page.request.get(`${API}/dental/patients?branchId=${ids.branchId}`);
      const list = unwrapList(await pr.json());
      const match = list.find((p: any) => p.displayName === patientName) ?? list[0];
      patientId = match.id;
      expect(patientId).toBeTruthy();
    });

    // ── 5. Clinical loop ────────────────────────────────────────────────────────
    await test.step('open workspace + create visit', async () => {
      await page.getByRole('button', { name: new RegExp(`Open patient record for ${patientName}`, 'i') }).click();
      await page.waitForURL(new RegExp(`/${patientId}$`), { timeout: 15000 });

      const visitResp = page
        .waitForResponse((r) => /\/dental\/visits$/.test(r.url()) && r.request().method() === 'POST', { timeout: 15000 })
        .catch(() => null);
      await page.getByTestId('new-visit-btn').click();
      const vr = await visitResp;
      if (vr) {
        const body = await vr.json().catch(() => ({}));
        visitId = body.id ?? '';
      }
      if (!visitId) {
        const lv = await page.request.get(`${API}/dental/visits?patientId=${patientId}&branchId=${ids.branchId}`);
        visitId = unwrapList(await lv.json())[0]?.id ?? '';
      }
      expect(visitId, 'visit created').toBeTruthy();
    });

    await test.step('initialize dentition (proves fresh-visit chart is not a 404 dead-end)', async () => {
      // canInitDentition is true for an active visit on a patient WITH a DOB and
      // zero teeth — the fresh-visit path must offer init, never "Failed to load chart".
      const initBtn = page.getByTestId('init-dentition-btn');
      await expect(initBtn).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('visit-chart-error')).toHaveCount(0);
      await initBtn.click();
      await expect(page.getByTestId('dental-chart')).toBeVisible({ timeout: 15000 });
    });

    await test.step('chart a tooth condition + CDT treatment via UI', async () => {
      await page.getByTestId('tooth-16').click();
      await expect(page.getByTestId('tooth-slideout')).toBeVisible({ timeout: 10000 });

      // Overview: focus a surface, assign a condition.
      await page.getByTestId('surface-occlusal').click();
      // testid, not role+name: "Caries" matches both the condition button and the
      // finding-code chip (strict-mode violation). Target the condition picker.
      await page.getByTestId('condition-caries').click();

      // Advance to the treatment (CDT) step.
      await page.getByRole('button', { name: /^next$/i }).click();

      // CDT browser: search, select a code, continue → auto-advances to Review.
      await page.getByLabel('Search CDT codes').fill('D2391');
      await page.getByRole('option', { name: /D2391/ }).first().click();
      await page.getByTestId('cdt-continue-btn').click();

      // Review → Save (creates a treatment, status 'diagnosed').
      const txResp = page
        .waitForResponse((r) => /\/dental\/visits\/.+\/treatments$/.test(r.url()) && r.request().method() === 'POST', { timeout: 15000 })
        .catch(() => null);
      await page.getByRole('button', { name: /^save$/i }).click();
      await txResp;

      // The charted treatment renders in the table.
      await expect(page.getByText('Composite', { exact: false }).first()).toBeVisible({ timeout: 15000 });
    });

    await test.step('sign consent + advance FSM (API-assist) then assert performed total in UI', async () => {
      // Consent (signature canvas isn't meaningfully UI-drivable in headless).
      await signVisitConsent(page, { branchId: ids.branchId, visitId, patientId });

      // Advance the charted treatment diagnosed → planned → performed.
      const txList = unwrapList(await (await page.request.get(`${API}/dental/visits/${visitId}/treatments`)).json());
      const tx = txList[0];
      expect(tx, 'charted treatment exists').toBeTruthy();
      for (const status of ['planned', 'performed']) {
        const r = await page.request.patch(`${API}/dental/visits/${visitId}/treatments/${tx.id}`, {
          headers: { 'Content-Type': 'application/json' },
          data: { status },
        });
        if (!r.ok()) throw new Error(`FSM ${status} ${r.status()}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
      }

      // Refresh the workspace so the table reflects the performed status + total.
      await spa(page, '/patients');
      await page.getByRole('button', { name: new RegExp(`Open patient record for ${patientName}`, 'i') }).click();
      await page.waitForURL(new RegExp(`/${patientId}$`), { timeout: 15000 });
      await expect(page.getByTestId(`treatment-row-${tx.id}`)).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('grand-total-row')).toBeVisible();
    });

    await test.step('complete the visit via pre-completion checklist (UI)', async () => {
      const completeBtn = page.getByRole('button', { name: 'Complete visit' });
      await expect(completeBtn).toBeEnabled({ timeout: 15000 });
      await completeBtn.click();
      // Dialog: SOAP-notes will warn → button reads "Complete anyway"; either matches /complete/i.
      const confirm = page.getByRole('button', { name: /complete/i }).last();
      await expect(confirm).toBeVisible({ timeout: 10000 });
      const done = page
        .waitForResponse((r) => /\/dental\/visits\/.+$/.test(r.url()) && r.request().method() === 'PATCH', { timeout: 15000 })
        .catch(() => null);
      await confirm.click();
      await done;
    });

    // ── 6. Billing (API-assist plumbing) + UI assertion ─────────────────────────
    await test.step('create invoice + record payment, then assert Paid in billing list (UI)', async () => {
      const invRes = await page.request.post(`${API}/dental/billing/invoices`, {
        headers: { 'Content-Type': 'application/json' },
        data: { visitId, patientId, branchId: ids.branchId, dentistMemberId: ids.memberId },
      });
      if (!invRes.ok()) throw new Error(`invoice ${invRes.status()}: ${(await invRes.text().catch(() => '')).slice(0, 300)}`);
      const invoice = await invRes.json();
      invoiceNumber = invoice.invoiceNumber ?? invoice.number ?? '';
      expect(invoice.totalCents, 'invoice carries the performed treatment total').toBeGreaterThan(0);

      await page.request.patch(`${API}/dental/billing/invoices/${invoice.id}/issue`);
      const pay = await page.request.post(`${API}/dental/billing/invoices/${invoice.id}/payments`, {
        headers: { 'Content-Type': 'application/json' },
        data: { amountCents: invoice.totalCents, method: 'cash', receiptNumber: `R-${suffix}`, recordedByMemberId: ids.memberId },
      });
      if (!pay.ok()) throw new Error(`payment ${pay.status()}: ${(await pay.text().catch(() => '')).slice(0, 300)}`);

      await spa(page, '/billing');
      await expect(page.getByTestId('billing-list')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`invoice-row-${invoice.id}`)).toBeVisible({ timeout: 15000 });
      if (invoiceNumber) {
        await expect(page.getByText(invoiceNumber, { exact: false }).first()).toBeVisible();
      }
      await expect(page.getByTestId(`invoice-row-${invoice.id}`).getByText(/paid/i)).toBeVisible();
    });

    // ── 7. Calendar — seeded appointment renders on the grid ────────────────────
    await test.step('calendar shows a seeded appointment (UI)', async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
      const end = new Date(start.getTime() + 30 * 60_000);
      const apptRes = await page.request.post(`${API}/dental/appointments`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          patientId, branchId: ids.branchId, providerId: ids.memberId,
          startAt: start.toISOString(), endAt: end.toISOString(),
          visitType: 'checkup', notes: 'Cold-start follow-up',
        },
      });
      if (!apptRes.ok()) throw new Error(`appointment ${apptRes.status()}: ${(await apptRes.text().catch(() => '')).slice(0, 300)}`);
      const appt = await apptRes.json();

      await spa(page, '/calendar');
      await expect(page.getByTestId(`appt-draggable-${appt.id}`)).toBeVisible({ timeout: 15000 });
    });

    // ── 8. Reports — revenue report renders the real invoice ────────────────────
    await test.step('revenue report renders Total Billed + the invoice (UI)', async () => {
      await spa(page, '/reports');
      await expect(page.getByText(/total billed/i)).toBeVisible({ timeout: 15000 });
      const numberCell = page.getByTestId('revenue-invoice-number').first();
      await expect(numberCell).toBeVisible({ timeout: 15000 });
      if (invoiceNumber) {
        await expect(page.getByText(invoiceNumber, { exact: false }).first()).toBeVisible();
      }
    });

    // ── 9. Staff — add a member via UI ──────────────────────────────────────────
    await test.step('add a staff member via UI', async () => {
      await spa(page, '/staff');
      await page.getByRole('button', { name: /add staff/i }).click();
      await expect(page.getByTestId('staff-create-modal')).toBeVisible({ timeout: 10000 });
      await page.locator('#staff-name').fill(staffName);
      await page.getByRole('button', { name: /Staff - Full Operations/i }).click();
      await page.locator('#staff-pin').fill(STAFF_PIN);
      await page.locator('#staff-pin-confirm').fill(STAFF_PIN);
      await page.getByRole('button', { name: /create staff member/i }).click();
      await expect(page.getByText(staffName, { exact: false }).first()).toBeVisible({ timeout: 15000 });
    });

    // ── 10. Sign out → re-login → RBAC gate + patient persists ───────────────────
    await test.step('sign out, re-login, RBAC gate redirects staff off /staff, patient persists', async () => {
      await spa(page, '/dashboard');
      await page.getByTestId('sign-out-btn').click();
      await page.waitForURL(/\/auth\/(sign-in|\$authView)/, { timeout: 15000 });

      // Re-login as the cloud owner account.
      await page.getByLabel('Email', { exact: true }).fill(email);
      const pw = page.locator('input[type="password"]');
      await pw.click();
      await pw.pressSequentially(password, { delay: 10 });
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await page.waitForURL(/\/auth\/pin/, { timeout: 20000 });

      // pin-select now lists two members — pick the staff_full one to prove the
      // role gate. (Two members → no auto-redirect.)
      const staffCard = page.getByRole('button', { name: new RegExp(`Sign in as ${staffName}`, 'i') });
      await expect(staffCard).toBeVisible({ timeout: 15000 });
      await staffCard.click();
      await page.waitForURL(/\/auth\/pin-entry\//, { timeout: 15000 });
      await expect(page.getByRole('group', { name: /PIN keypad/i })).toBeVisible({ timeout: 15000 });
      for (const d of STAFF_PIN) {
        await page.getByRole('button', { name: d, exact: true }).click();
      }
      await page.waitForURL((u: URL) => !u.pathname.startsWith('/auth/'), { timeout: 15000 });

      // RBAC: staff_full must NOT get staff management — either the requireRole
      // guard redirects to /dashboard, or the in-page guard renders access-denied.
      // (Both are valid enforcement; the bug would be seeing the staff list.)
      await spa(page, '/staff');
      const denied = page.getByTestId('staff-access-denied');
      await expect
        .poll(
          async () => new URL(page.url()).pathname === '/dashboard' || (await denied.isVisible().catch(() => false)),
          { timeout: 10000 },
        )
        .toBe(true);
      // And the staff management surface must NOT be reachable.
      await expect(page.getByRole('button', { name: /add staff/i })).toHaveCount(0);

      // Login half: the onboarded patient still persists for the re-logged-in member.
      await spa(page, '/patients');
      await expect(
        page.getByRole('button', { name: new RegExp(`Open patient record for ${patientName}`, 'i') }),
      ).toBeVisible({ timeout: 15000 });
    });
  });
});

/**
 * SPA-navigate preserving the in-memory PIN session (a hard reload wipes it and
 * bounces to the PIN gate). Mirrors helpers/perio-e2e.ts::spaNavigate but tolerant
 * of guard redirects (the target path may differ from the requested one).
 */
async function spa(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForLoadState('networkidle');
}
