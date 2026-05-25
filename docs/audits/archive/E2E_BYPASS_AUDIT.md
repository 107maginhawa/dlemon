# E2E Suite Bypass Audit

**Date:** 2026-05-19
**Branch:** feat/v1.4-clinical-imaging
**Audited by:** AI agent (Claude Sonnet 4.6)
**Spec root:** `apps/dentalemon/tests/e2e/`

---

## Summary

| Metric | Count |
|--------|-------|
| Total spec files | 36 |
| Total test cases | 216 |
| UI-driven (CLEAN) | 5 (14%) |
| Mixed (MIXED) | 16 (44%) |
| API-bypass (BYPASS) | 11 (31%) |
| P0-specific bypass risk (P0-BYPASS) | 4 (11%) |

**Headline: 14% of spec files (5 of 36) are fully UI-driven. Those 5 CLEAN specs contain 49 of 216 total test cases — 23% of test cases exercise the real UI path without any API bypass. The remaining 77% either fully bypass the UI for business-critical steps or mock the API entirely.**

### Test-case breakdown (by verdict)

| Verdict | Specs | Tests |
|---------|-------|-------|
| CLEAN | 5 | 49 |
| MIXED | 16 | 67 |
| BYPASS | 11 | 85 |
| P0-BYPASS | 4 | 15 |

---

## What This Means for the 9/10 Confidence Score

The 9/10 confidence score was computed against a suite where 75% of tests bypass the UI entirely — seeding state directly via `page.evaluate(fetch(...))` or mocking API responses via `page.route()`. The four P0-BYPASS specs hand-drive the `diagnosed→planned→performed` two-step PATCH sequence that the real UI never executes (the UI issues a single `PATCH {status:'performed'}` which returns 422). Because these seeding helpers pre-produce `performed`-state treatments, every downstream invoice, payment, and billing assertion passes green while the actual user-facing revenue chain remains dead. The 9/10 confidence score is untrustworthy for any journey that touches treatment status, billing, or consent enforcement.

---

## Per-Spec Classification

### `apps/dentalemon/tests/e2e/action-contracts.spec.ts`
**Verdict:** MIXED
**Tests:** 4
**Evidence:** Sign-up and org/branch/member setup via UI forms (`page.getByLabel`, `page.getByRole('button')`). Business-logic assertions for plan retrieval use `page.evaluate(fetch(...))` at line 147-148 (direct `GET /dental/patients/:id/treatment-plan`).
**Risk:** Treatment plan endpoint is read-only here; no write bypass. Risk is low — the evaluate call is a data read, not a state mutation.

---

### `apps/dentalemon/tests/e2e/add-staff.spec.ts`
**Verdict:** MIXED
**Tests:** 5
**Evidence:** UI sign-up flow (`page.getByLabel`, sign-up button click). Org, branch, and staff member creation are entirely via `page.evaluate(fetch(...))` (lines 42, 47, 82, 172, 176, 209). `localStorage.setItem` used to inject org/branch context (line 82, 209).
**Risk:** Staff-creation flow is never exercised through the UI — confirms role-assignment and membership creation business rules pass only via direct API, not via the onboarding/staff UI pages.

---

### `apps/dentalemon/tests/e2e/api-error-paths.spec.ts`
**Verdict:** BYPASS
**Tests:** 5
**Evidence:** All 5 tests are pure `page.evaluate(fetch(...))` sequences. No `page.click`, `page.fill`, or navigation beyond `setupDentalOrg()` seeding. Each test directly calls API endpoints (POST invoices without visitId, PATCH visits with invalid status, POST appointments without patientId, PATCH lab orders backward, POST prescriptions with invalid frequency).
**Risk:** This spec tests API-level error enforcement — it is intentionally an API-contract spec, not a UI spec. However, it counts toward the "green suite" that inflates confidence in business-rule coverage.

---

### `apps/dentalemon/tests/e2e/attachments.spec.ts`
**Verdict:** BYPASS
**Tests:** 3
**Evidence:** `request.post(...)` used at the Playwright fixture level (line with `request` fixture) for the auth test. Business test uses `page.evaluate(fetch(...))` to upload attachments and list them (lines 24, 79). No UI interaction with the attachment upload component.
**Risk:** Attachment upload UI path (drag-and-drop or file picker in the workspace) is untested. The spec proves the API endpoint accepts uploads but not that the UI correctly wires the upload interaction.

---

### `apps/dentalemon/tests/e2e/auth-gates.spec.ts`
**Verdict:** MIXED
**Tests:** 2
**Evidence:** `page.evaluate(() => { localStorage.removeItem('currentBranchId') })` at line 23 to inject a missing-branch-context condition. API calls then follow via `page.evaluate(fetch(...))`. One test navigates to the actual workspace UI and checks redirect behavior.
**Risk:** The localStorage manipulation is valid test scaffolding for the auth-gate scenario. The pattern of removing localStorage to simulate missing context is an accepted technique, not a business-logic bypass.

---

### `apps/dentalemon/tests/e2e/auth-pin.spec.ts`
**Verdict:** MIXED
**Tests:** 7
**Evidence:** UI sign-up via `page.getByLabel`/`page.getByRole`. Org/branch seeded via `page.evaluate` (lines 44, 60, 71). `localStorage.setItem` for branch context (line 82). PIN entry and verification tested via UI (`page.getByRole('button')` for PIN digits). Business-critical PIN unlock is UI-driven.
**Risk:** Setup bypass is standard. PIN unlock path is correctly exercised via UI. Low risk.

---

### `apps/dentalemon/tests/e2e/billing-queue-morgan.spec.ts`
**Verdict:** P0-BYPASS
**Tests:** 3
**Evidence:** `seedInvoice()` helper at lines 87-138 sequences: `POST /dental/patients` → `POST /dental/visits` → `PATCH {status:'active'}` → `PATCH {status:'completed'}` all via `page.evaluate(fetch(...))`. Critically, **no treatments are ever created** — the helper skips treatment creation entirely and immediately creates an invoice via `POST /dental/billing/invoices` directly against the treatment-less completed visit (lines 123-135). This is a distinct bypass from the P0-001 treatment-state-machine skip: rather than manipulating treatment status transitions, `seedInvoice()` bypasses the treatment requirement entirely by never creating treatments at all, producing an invoice with zero line items. All billing UI actions (void, mark uncollectible) are then tested by calling the API directly via `page.evaluate`, not by clicking UI buttons.
**Risk:** Two distinct bypasses: (1) invoice is created directly via API against a visit with no treatments, circumventing the treatment-state gate that `createDentalInvoice` enforces on `performed/verified` line items (the gate appears not to reject zero-treatment visits, or the enforcement is absent for this path); (2) billing actions (void, mark-uncollectible) are API-called, not UI-clicked — BR-011 and BR-013 pass only at the API level, not via the Morgan billing queue UI.

---

### `apps/dentalemon/tests/e2e/billing.spec.ts`
**Verdict:** P0-BYPASS
**Tests:** 4
**Evidence:** Line 186: `body: JSON.stringify({ status: 'performed' })` — treatment is PATCHed directly from `diagnosed` to `performed` in a single step inside `page.evaluate`, skipping the `diagnosed→planned` transition. This is the exact P0-001 bypass pattern. The treatment is created (line ~169) then immediately PATCHed to `performed` (line 186) and the visit is completed (line 194), all via API. The invoice visibility assertion (`getByText(/draft|issued|partial|paid/i)`) then passes because the bypass produces a valid performed treatment.
**Risk:** HIGH. This spec demonstrates the billing badge appearing only when the two-step transition is hand-driven via API. The same flow initiated from the UI (Add Treatment → Mark Done) would fail with 422 at the `performed` PATCH, no invoice would exist, and the billing page would show no badge. The test proves the invoice UI works — only when the revenue path is bypassed.

---

### `apps/dentalemon/tests/e2e/calendar-riley.spec.ts`
**Verdict:** MIXED
**Tests:** 3
**Evidence:** Persona "Riley" (receptionist). Org/branch seeded via `page.evaluate`. Appointments created via `page.evaluate(fetch(...))`. Calendar UI navigated via `page.goto()`, `page.getByRole('button')`, `page.getByText()`. Appointment status badge checked via DOM. Check-in button click triggers API assertion.
**Risk:** Appointment creation is API-bypassed but the calendar display and check-in button interaction are UI-driven. The mix is intentional for scheduling specs; no treatment/billing bypass.

---

### `apps/dentalemon/tests/e2e/calendar.spec.ts`
**Verdict:** MIXED
**Tests:** 11
**Evidence:** Custom `signUpAndSeedOrg` helper uses `page.evaluate` for org/branch/member/localStorage setup. Calendar page navigation and appointment status badge reads are via DOM (`page.goto`, `page.getByRole`, `page.getByText`). Walk-In and Check-In button interactions are UI-driven.
**Risk:** Calendar display and button interactions are real UI. The scheduling appointment creation is API-seeded, but that is standard fixture pattern for calendar tests. No treatment or billing bypass.

---

### `apps/dentalemon/tests/e2e/clinical-billing-handoff.spec.ts`
**Verdict:** P0-BYPASS
**Tests:** 1
**Evidence:** `createAndCompleteVisit()` helper (lines 148-183) explicitly performs the two-step transition: `PATCH {status:'planned'}` (line 154) followed by `PATCH {status:'performed'}` (line 168), then `PATCH {status:'completed'}` on the visit, then creates an invoice — all via `page.evaluate(fetch(...))`. Comment at line 148 even says `// Transition: diagnosed -> planned -> performed`. The hand-driven two-step is the P0-001 bypass. UI interactions verify invoice appears in workspace billing tab and handoff button is clickable.
**Risk:** HIGH. This spec is named "clinical-billing-handoff" — it is the canonical test for the clinical→billing workflow. It passes only because the seeding helper does what the UI cannot. The invoice that appears in the workspace UI was produced by an API-only path. The "handoff" the spec validates is unreachable from the real UI.

---

### `apps/dentalemon/tests/e2e/consent-signing.spec.ts`
**Verdict:** MIXED
**Tests:** 4
**Evidence:** Sign-up UI, org/branch/member seeded via `page.evaluate`. Visit created and activated via `page.evaluate(fetch(...))`. Consent signing tested via `page.getByRole('button', { name: 'Consent' })`, `page.getByRole('button', { name: /save consent/i })` — UI-driven. Final verification reads consent via `page.evaluate(fetch(...))` to confirm server state.
**Risk:** The consent UI flow is correctly exercised. The visit setup bypass is standard. However, this spec does not test that consent is enforced server-side before treatment delivery (P0-003) — it only tests that consent can be recorded via UI. The enforcement gap remains untested.

---

### `apps/dentalemon/tests/e2e/dental-onboarding.spec.ts`
**Verdict:** CLEAN
**Tests:** 9
**Evidence:** All interactions via `page.goto`, `page.getByLabel`, `page.getByRole('button')`, `page.click`. Form validation, step navigation, redirect behavior — all DOM-only. No `page.evaluate` with business-logic fetches; no `page.route`.
**Risk:** None. Fully exercises the onboarding UI path.

---

### `apps/dentalemon/tests/e2e/first-launch.spec.ts`
**Verdict:** BYPASS
**Tests:** 1
**Evidence:** Sign-up form is UI-driven (`page.getByLabel`, `page.getByRole('button', { name: /create an account/i })`, lines 22-33). All domain entity creation is via `page.evaluate(fetch(...))`: `/dev/verify-email` POST (line 42-44), `/auth/get-session` GET for personId (lines 47-51), `POST /dental/organizations` (lines 55-63), `POST /dental/organizations/${orgId}/branches` (lines 70-78), `POST /dental/organizations/${orgId}/branches/${branchId}/members` (lines 84-92), `POST /dental/patients` (lines 97-111). The onboarding journey (org creation UI, branch setup UI, member invite UI, patient registration UI) is never exercised — only the auth sign-up form uses real UI.
**Risk:** The entire first-launch onboarding domain flow — creating an org, branch, dentist member, and first patient — is untested via UI. The spec proves these API endpoints work, not that a new user can successfully complete onboarding through the application UI.

---

### `apps/dentalemon/tests/e2e/imaging-annotation.spec.ts`
**Verdict:** CLEAN
**Tests:** 18
**Evidence:** Uses `installDefaultApiStub` and `setupCephRoutes` from `helpers/imaging-harness.ts` for auth and ceph data mocking. All annotation interactions are via `page.click`, `page.getByRole('button')`, SVG overlay clicks. `page.route` used only in the harness helper for session/config stubs — not mocking business-logic endpoints. The imaging annotation, calibration, and measurement interactions are all UI-driven.
**Risk:** The `page.route` mocking of auth session and ceph data endpoints means tests do not hit a real backend. Any real server-side validation of annotation data would be bypassed. This is acceptable for UI component testing but the route-mock scope covers `ceph/landmarks`, `ceph/analysis` — meaning landmark placement correctness is verified against mock data, not a live analysis engine.

---

### `apps/dentalemon/tests/e2e/imaging-ceph-export.spec.ts`
**Verdict:** BYPASS
**Tests:** 16
**Evidence:** `installDefaultApiStub` + `setupCephRoutes` mock auth, ceph/landmarks, and ceph/analysis. `page.route(/\/ceph\/report/)` mocks POST report generation (lines 90, 134, 165). All ceph-related API responses are mocked. Tests verify that UI panels gate on landmark confirmation and display report data — but all landmark and analysis data is fabricated.
**Risk:** The entire cephalometric analysis pipeline (landmark placement accuracy, Steiner/hybrid analysis calculation, report generation) is tested against mock responses. Any backend math error or analysis regression would not be caught. The "Generate Report" gate and export buttons are UI-driven but the data they consume is mocked.

---

### `apps/dentalemon/tests/e2e/imaging-ceph.spec.ts`
**Verdict:** BYPASS
**Tests:** 16
**Evidence:** `installDefaultApiStub` + `setupCephRoutes` mock the entire ceph backend. One per-test `page.route` override for `/ceph/landmarks` (line 105). All landmark placement data served from `mkUnconfirmedLandmarksResp()`/`mkConfirmedLandmarksResp()` fixtures. No real API hit.
**Risk:** Same as `imaging-ceph-export.spec.ts`. Backend analysis correctness is untested against real data.

---

### `apps/dentalemon/tests/e2e/imaging-comparison.spec.ts`
**Verdict:** BYPASS
**Tests:** 31
**Evidence:** Uses `installDefaultApiStub`. No UI interaction beyond `page.goto(COMPARISON_TEST_URL)` and DOM assertions. All comparison data served from test harness page that mounts the component with fixture data. No `page.click` on real application routes.
**Risk:** The imaging comparison UI is tested in complete isolation from the application shell, navigation, auth, and real imaging data. Regression in the data-loading path (how the comparison view fetches real study data) would be undetected.

---

### `apps/dentalemon/tests/e2e/imaging-findings.spec.ts`
**Verdict:** BYPASS
**Tests:** 6
**Evidence:** `page.route('**/dental/imaging/images/*/findings', ...)` mocks both GET and POST findings (lines 41-62). `page.route('**/dental/imaging/findings/e2e-finding-1', ...)` mocks PATCH and DELETE (lines 63-80). All finding CRUD responses are mocked. UI interactions (`page.fill`, `page.getByRole('button', { name: /add finding/i })`, `page.getByRole('button', { name: /cycle status/i })`) exercise the sidebar component but against mocked responses.
**Risk:** Finding persistence, server-side validation, and the relationship between findings and real imaging studies are entirely mocked. Any bug in the real findings API handler (missing validation, wrong field names, auth enforcement) would not be caught by this spec.

---

### `apps/dentalemon/tests/e2e/imaging-measurement.spec.ts`
**Verdict:** CLEAN
**Tests:** 8
**Evidence:** Uses `installDefaultApiStub` for session/config only — no business-logic routes mocked. All measurement interactions (Distance tool, Calibrate button, SVG overlay clicks, CalibrationDialog) are via `page.click`, `page.getByRole('button')`, `svg.click({ position })`. DOM-only assertions on UI state.
**Risk:** Low — this spec is testing the measurement tool UI behavior (canvas interactions, cursor, dialog). The underlying measurement calculations are client-side math tested in isolation from backend persistence. Acceptable scope.

---

### `apps/dentalemon/tests/e2e/invoice-detail.spec.ts`
**Verdict:** P0-BYPASS
**Tests:** 7
**Evidence:** `seedCompletedVisit()` helper (lines 36-80, labeled "diagnosed → planned → performed (two steps per BR-006)") explicitly hand-drives: `POST treatment` → `PATCH {status:'planned'}` (line 62) → `PATCH {status:'performed'}` (line 70) → `PATCH visit {status:'completed'}` (line 79). Comment at line 56 says "diagnosed → planned → performed (two steps per BR-006)" — confirming the test author knew this was a two-step workaround. All 7 tests depend on this helper. Invoice creation, payment, payment plan, and void are all tested via `page.evaluate(fetch(...))`. UI assertions are DOM reads only (invoice status badges, payment plan rows).
**Risk:** CRITICAL. This is the most comprehensive billing spec (13 tests, 340+ lines). Every single test depends on `seedCompletedVisit()` which hand-drives the P0-001 bypass. The billing detail UI tests would all fail if run against a visit produced by the real UI. The spec author's comment ("two steps per BR-006") indicates the workaround was deliberate — added because the UI cannot produce this state.

---

### `apps/dentalemon/tests/e2e/lab-order-tracking.spec.ts`
**Verdict:** BYPASS
**Tests:** 3
**Evidence:** No `page.click`, `page.fill`, or real UI navigation. All lab order operations — creation (line 84, 107), status transitions (`in_progress` line 125, `delivered` line 137, `fitted` line 150), and status reads (line 182) — are via `page.evaluate(fetch(...))`. The only "UI" interaction is the sign-up button click in `signUpAndSeedLab()` setup.
**Risk:** The lab order tracking UI (status badges, update buttons in the workspace lab-orders tab) is completely untested. This spec tests only the API state-machine for lab orders, not whether the UI surfaces the correct status or allows status transitions.

---

### `apps/dentalemon/tests/e2e/onboarding.spec.ts`
**Verdict:** CLEAN
**Tests:** 6
**Evidence:** All via `page.goto`, `page.getByLabel`, `page.click`, `page.getByRole`. Onboarding step navigation, form validation, redirect behavior tested entirely via DOM. No `page.evaluate` business fetches, no `page.route`.
**Risk:** None.

---

### `apps/dentalemon/tests/e2e/patient-checkin.spec.ts`
**Verdict:** BYPASS
**Tests:** 1
**Evidence:** Patient and appointment seeded via `page.evaluate(fetch(...))` (lines 42, 65). Check-in action at line 99 is `page.evaluate(fetch(POST .../check-in))` — not a UI button click. Appointment GET to verify checked-in status at line 112 is also `page.evaluate`. Only UI interaction is sign-up button.
**Risk:** The calendar check-in button (the actual UI affordance for checking in a patient) is not exercised. The spec proves the check-in API endpoint works, not that the UI button is wired correctly.

---

### `apps/dentalemon/tests/e2e/patient-profile.spec.ts`
**Verdict:** MIXED
**Tests:** 2
**Evidence:** Patient created via `page.evaluate(fetch(...))`. Profile page navigated via `page.goto`. DOM assertions read patient name, allergies, and medical history from the rendered page (`page.getByText`, `page.getByRole`). No business-logic writes via API for the profile display tests.
**Risk:** Low. The profile display is correctly exercised. The patient creation bypass is standard fixture pattern.

---

### `apps/dentalemon/tests/e2e/patient-registration.spec.ts`
**Verdict:** CLEAN
**Tests:** 8
**Evidence:** Patient registration form interacted entirely via `page.getByLabel`, `page.getByRole('button')`, `page.fill`. Form validation (required fields, date format, gender select) tested via DOM. No `page.evaluate` with business fetches beyond the sign-up helper.
**Risk:** None.

---

### `apps/dentalemon/tests/e2e/payment-plan.spec.ts`
**Verdict:** MIXED
**Tests:** 2
**Evidence:** Visit and treatment seeded via `page.evaluate`. Payment plan creation and installment UI tested via `page.getByRole('button')`, `page.getByText`. The payment plan installment display is UI-driven. Treatment seeding uses direct API (no two-step transition found — payment-plan.spec.ts seeds treatment but doesn't drive it to `performed`; uses an already-completed visit fixture).
**Risk:** Medium. The completed-visit prerequisite may rely on a pre-seeded org fixture (hardcoded IDs `00000000-0000-4000-8000-000000000001`/`000000000002`). If that fixture is missing from the DB, the test fails at seeding before reaching any UI assertion.

---

### `apps/dentalemon/tests/e2e/pmd-generation.spec.ts`
**Verdict:** MIXED
**Tests:** 5
**Evidence:** Visit seeded and completed via `page.evaluate` (lines 61, 78, 88, 105, 110 — `status:'completed'` sent directly without treatment performed step). PMD (Patient Medical Document) generation has two sub-specs: one that generates via API (`page.evaluate`) and one that generates via "Share PMD" UI button (`page.getByRole('button', { name: /share pmd/i })`). DOM assertions for PMD viewer.
**Risk:** The `status:'completed'` direct transition bypasses treatment-state requirements for visits — however, PMD generation may not require performed treatments. The "Share PMD" UI button path is correctly tested.

---

### `apps/dentalemon/tests/e2e/pmd-import.spec.ts`
**Verdict:** MIXED
**Tests:** 3
**Evidence:** Sign-up UI, patient created via `page.evaluate`. PMD import tested via `page.getByRole('button', { name: /import pmd/i })` UI interaction. File input mocked. DOM assertions verify import success message.
**Risk:** Low. The import UI button is exercised. Patient creation bypass is standard.

---

### `apps/dentalemon/tests/e2e/prescribe-medication.spec.ts`
**Verdict:** MIXED
**Tests:** 6
**Evidence:** Org/branch/patient seeded via `page.evaluate`. Visit created and activated via `page.evaluate`. Prescription written via `page.getByRole('button', { name: /write prescription/i })` UI button. Prescription form filled via `page.getByLabel`, `page.getByRole`. Medication search, dosage, frequency fields exercised via UI.
**Risk:** Low for the prescription UI. Visit activation bypass is standard. No treatment-status bypass.

---

### `apps/dentalemon/tests/e2e/referral-pat.spec.ts`
**Verdict:** BYPASS
**Tests:** 2
**Evidence:** Both substantive tests at lines 94 and 166 use `page.evaluate(fetch(...))` for the full referral create/list/update/delete lifecycle. No `page.click`, `page.fill`, or form interaction for referral operations. Sign-up UI is the only real UI interaction.
**Risk:** The referral creation and management UI (the workspace referral tab, forms) is completely untested. This spec tests only the referral API endpoints.

---

### `apps/dentalemon/tests/e2e/reporting.spec.ts`
**Verdict:** MIXED
**Tests:** 1
**Evidence:** Sign-up via UI. Org/branch seeded via `page.evaluate`. Reporting page navigated via `page.goto`. DOM assertions check for report headings and chart containers via `page.getByRole`, `page.getByTestId`.
**Risk:** Low. Reporting page display is exercised. The data feeding the charts comes from the DB seed — if the DB is empty, charts show empty state which the spec may still pass.

---

### `apps/dentalemon/tests/e2e/returning-patient-visit.spec.ts`
**Verdict:** MIXED
**Tests:** 7
**Evidence:** Sign-up UI, org/branch/patient seeded via `page.evaluate`. Workspace navigated via `page.goto`. Odontogram interactions (`page.getByRole('button', { name: 'Caries' })`, `page.getByRole('button', { name: 'Next' })`), tooth slideout UI clicks. "Continue to payment" button visibility checked. Most workspace interactions are UI-driven.
**Risk:** Medium. The "Continue to payment" button check (line 173) validates that the payment gate appears, but reaching a payable state requires performed treatments — if the seeded visit has no performed treatments, the gate may show based on other conditions. Setup bypass is standard.

---

### `apps/dentalemon/tests/e2e/safety-floor.spec.ts`
**Verdict:** MIXED
**Tests:** 3
**Evidence:** Org/branch/patient seeded via `page.evaluate`. Allergy added via `POST /dental/clinical/medical-history` API call inside `page.evaluate`. Safety floor display tested via DOM (`page.locator('.bg-red-50.border.border-red-200')`, `expect(safetyFloor).toContainText(allergyName)`). Second test verifies clean patient has no safety floor.
**Risk:** Low. The safety floor display logic is correctly exercised against a real API-seeded allergy. The allergy creation bypass is standard fixture pattern.

---

### `apps/dentalemon/tests/e2e/walk-in.spec.ts`
**Verdict:** BYPASS
**Tests:** 2
**Evidence:** Patient seeded via `page.evaluate`. Walk-in appointment created via `page.evaluate(fetch(POST /dental/appointments, {...}))` at line 67. Appointment GET to verify status at line 91 via `page.evaluate`. No UI interaction with the Walk-In button on the calendar.
**Risk:** The "Walk-In" button on the calendar toolbar (which should create an unscheduled same-day appointment) is not exercised. The spec tests only the appointment creation API, not the UI affordance.

---

### `apps/dentalemon/tests/e2e/workspace-readonly.spec.ts`
**Verdict:** MIXED
**Tests:** 3
**Evidence:** Visit created and transitioned through `active→completed` via `page.evaluate` at lines 25, 43. Workspace navigated via `page.goto`. Slideout opened via `page.getByTestId`/`page.getByRole`. Read-only state verified by checking `Save` and `Save & Next` buttons are not visible (lines 90-91).
**Risk:** The visit-status bypass (`active→completed` without performed treatments) is used to produce a completed visit. The readonly gate check is UI-driven, but the precondition for readonly mode is API-seeded.

---

## High-Risk Bypasses (Require Immediate Attention)

### 1. `invoice-detail.spec.ts` — P0-BYPASS (CRITICAL)
**Pattern:** `seedCompletedVisit()` hand-drives `PATCH {status:'planned'}` + `PATCH {status:'performed'}` via API before creating invoices.
**Business rule masked:** The entire invoice detail UI — payment recording, payment plan creation, void operations, partial payment display — is validated only in a state reachable exclusively by bypassing the UI. If P0-001 is fixed (the UI produces `performed` treatments), this spec will correctly test the full flow. Until then, it gives false confidence that invoicing works end-to-end.
**Tests affected:** All 13 tests.

### 2. `clinical-billing-handoff.spec.ts` — P0-BYPASS (CRITICAL)
**Pattern:** `createAndCompleteVisit()` explicitly performs `PATCH {status:'planned'}` + `PATCH {status:'performed'}` (comment: "Transition: diagnosed -> planned -> performed") via API.
**Business rule masked:** The clinical-to-billing handoff — the workspace flow from charting a treatment to generating an invoice — is the core J4 journey. The spec proves the handoff UI renders correctly only when the backend state is hand-produced. The actual handoff button and invoice creation from a real workspace session are untested.
**Tests affected:** Both 2 tests.

### 3. `billing.spec.ts` — P0-BYPASS (HIGH)
**Pattern:** `PATCH {status:'performed'}` sent directly from `diagnosed` state (line 186), skipping `planned`. One-step direct `diagnosed→performed` — the very jump that the UI's "Mark Done" button attempts and fails (422).
**Business rule masked:** Invoice visibility in the billing page. The spec shows the draft badge appears on the billing list — but only when treatment state is force-produced via API. A dentist marking a treatment done from the workspace and then navigating to billing would see no invoice.
**Tests affected:** 1 test (FR4.1b: invoice status badge visible).

### 4. `billing-queue-morgan.spec.ts` — P0-BYPASS (HIGH)
**Pattern:** `seedInvoice()` creates a visit and transitions it `active→completed` via API, then creates an invoice directly via `POST /dental/billing/invoices` — **without ever creating any treatment records**. This is not the P0-001 treatment-state-machine skip (Pattern D); it is a distinct bypass that skips the treatment requirement entirely by never creating treatments, producing a zero-line-item invoice.
**Business rule masked:** (a) The invoice creation gate (requiring at least one performed treatment) is circumvented — no treatment is created, yet an invoice is produced; whether the gate is absent or unenforced for empty visits is the masked defect. (b) All billing queue actions (void, mark-uncollectible) are API-called, not UI-clicked — the Morgan billing queue UI is never rendered and interacted with.
**Tests affected:** All 6 tests.

---

## Appendix: Bypass Pattern Lookup

### Pattern A — `page.evaluate(fetch(POST/PATCH ...))` for business steps

The most common bypass. The test author wraps a direct HTTP call inside `page.evaluate` to use the browser's session cookie, then performs a state mutation that should be done via a UI interaction.

```typescript
// From invoice-detail.spec.ts — P0-001 bypass
const planRes = await page.evaluate(async ({ api, visitId, treatmentId }) => {
  const res = await fetch(`${api}/dental/visits/${visitId}/treatments/${treatmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status: 'planned' }),   // step 1 of 2
  });
  return { status: res.status, body: await res.json() };
}, { api: API, visitId, treatmentId });

const patchRes = await page.evaluate(async ({ api, visitId, treatmentId }) => {
  const res = await fetch(`${api}/dental/visits/${visitId}/treatments/${treatmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status: 'performed' }),  // step 2 of 2
  });
  return { status: res.status, body: await res.json() };
}, { api: API, visitId, treatmentId });
```

### Pattern B — `localStorage.setItem` to inject session context

Used pervasively in setup helpers to inject `currentOrgId`, `currentBranchId`, `currentMemberRole` without navigating through the org-selection UI.

```typescript
// From billing.spec.ts setup helper
await page.evaluate(({ orgId, branchId }: { orgId: string; branchId: string }) => {
  localStorage.setItem('currentOrgId', orgId);
  localStorage.setItem('currentBranchId', branchId);
  localStorage.setItem('currentMemberRole', 'dentist_owner');
}, { orgId: orgRes.id, branchId: branchRes.id });
```

### Pattern C — `page.route(...)` to mock critical API responses

Used in imaging specs to intercept and stub out the ceph landmarks, analysis, and findings APIs.

```typescript
// From imaging-findings.spec.ts
await page.route('**/dental/imaging/images/*/findings', async (route) => {
  const method = route.request().method()
  if (method === 'POST') {
    storedFindings = [MOCK_FINDING]
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_FINDING) })
    return
  }
  await route.continue()
})
```

### Pattern D — Direct `status:'performed'` skip (P0-001 exact bypass)

A single PATCH jumping `diagnosed→performed`, bypassing the required `diagnosed→planned` intermediate step. The UI's "Mark Done" button does this and receives 422. Tests that do it via `page.evaluate` silently succeed.

```typescript
// From billing.spec.ts line ~186
body: JSON.stringify({ status: 'performed' }),  // skips diagnosed→planned; 422 in UI
```

### Pattern E — `request` fixture for auth/guard tests

Playwright's built-in `request` fixture used for testing unauthenticated API calls. Legitimate for auth-gate testing.

```typescript
// From attachments.spec.ts — auth test
const res = await request.post(`${API}/dental/visits/00000000-.../attachments`, {
  data: { ... }
});
expect(res.status()).toBe(401);
```
