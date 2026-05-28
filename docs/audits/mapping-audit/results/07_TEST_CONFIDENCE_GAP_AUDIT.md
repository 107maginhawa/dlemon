# Test Confidence Gap Audit
**Date**: 2026-05-26  
**Auditor**: Journey Test Audit Orchestrator — Pass 08  
**Scope**: apps/dentalemon + services/api-ts — full test stack  
**Mode**: Read-only. No code modified.

---

## 1. Test Structure Summary

| Test Type | Location | Framework | Count | Notes |
|---|---|---|---|---|
| Frontend Unit | `apps/dentalemon/src/**/*.test.ts(x)` | Bun test + @testing-library/react | 130 | happy-dom env; coverage gate line=75%, function=75%, branch=60% |
| Backend Unit/Integration | `services/api-ts/src/**/*.test.ts` | Bun test | 160 | Real Postgres DB; afterEach TRUNCATE pattern; real Hono app factory |
| E2E (non-journey) | `apps/dentalemon/tests/e2e/*.spec.ts` | Playwright | 52 | **SOFT gate in CI** (`continue-on-error: true`); no backend on CI run — hits static Vite build |
| Journey E2E | `apps/dentalemon/tests/e2e/journeys/*.spec.ts` | Playwright + journey harness | 16 | **HARD gate** in CI (`journey-verification` job); real postgres + seed + api-ts; 30-min timeout |
| Contract | `specs/api/tests/contract/` | Hurl + Schemathesis | ~22 | Separate `contract.yml` CI job; Schemathesis allowed to fail (shadow only) |
| Misc Integration | scattered | Bun test | 3 | Minimal; not a distinct layer |

**Total**: ~427 test files across both apps.

**CI Gate Structure** (from `quality.yml`):
```
typecheck     → hard gate (blocks merge)
lint          → hard gate
unit-test     → hard gate (coverage threshold enforced)
build         → hard gate
security      → hard gate
migration-safety → hard gate
traceability  → hard gate (P0 BR coverage: bun run audit:trace:ci)
e2e           → SOFT gate (continue-on-error: true, static build, no API)
journey-verification → hard gate (real stack, real data — authoritative E2E)
perf-ratchet  → DISABLED (if: false — no staging env wired)
```

**Journey Harness Verdict Map** (current expected):
| Journey | Name | Expected |
|---|---|---|
| J01 | New-patient comprehensive oral evaluation | PASS |
| J02 | Periodic recall exam (D0120) | PASS |
| J03 | Periodontal charting linked to odontogram | **BROKEN** |
| J04 | Revenue chain (flagship) | **BROKEN** |
| J05 | Status integrity on the odontogram | PASS |
| J06 | Multi-visit / phased treatment plan sequencing | **BROKEN** |
| J07 | Charting granularity & mixed dentition | PASS |
| J08 | Informed refusal | **BROKEN** |
| J09 | Treatment-plan versioning | **BROKEN** |
| J10 | Void / amend a signed entry | **BROKEN** |
| B01 | Free-tier ceph gate | **BROKEN** |
| B02 | Landmark placement → SNA/SNB numeric | **BROKEN** |
| B03 | Locked landmark immutability | PASS |
| J11–J16 | Ceph report, offline sync, medical alert | Various |

**8 of 16 journeys marked BROKEN-expected** — CI passes even while flagship revenue chain and plan versioning are non-functional.

---

## 2. Behavior-to-Test Matrix

| Behavior / Journey | Role | Source Finding | Existing Test | File | Assertion Quality | Missing Coverage | Severity |
|---|---|---|---|---|---|---|---|
| Patient card click → correct route `/_workspace/$patientId` | All | BN-01, BI-01 | Render test exists | `patient-folder-card.test.ts` | **WEAK** — tests display only; no navigation route assertion | E2E/Component: assert URL after click | P1 |
| Workspace top bar hides Rx/Consent/Lab for staff_scheduling | staff_scheduling | BI-03, PG-03 | None | — | **NONE** | Component: render TopBar as staff_scheduling → buttons absent | P1 |
| Dashboard defaults to `dentist_owner` when org context is null | All | BI-04 | Hook test exists | `use-dashboard-summary.test.ts` | **WEAK** — tests financial gating (showFinancials flag) but NOT the `?? 'dentist_owner'` fallback in the route component | Component: render DashboardPage with null role → owner CTAs not shown | P1 |
| Void Invoice: confirmation dialog before API call | dentist_owner | BI-07, FM-03 | Logic helper test | `invoice-detail.test.ts` | **WEAK** — `canVoid('issued') === true` only; no interaction test | E2E: click Void → confirmation dialog appears; cancel → no API fired | P1 |
| BR-009: Invoice blocked for planned/diagnosed treatment | All | BR-009 | `billing-gate-http.test.ts` | STRONG — real DB, 3 cases | ✅ Covered | — | — |
| BR-011: Invoice blocked without signed consent | All | AD-06 | `billing-gate-http.test.ts` | STRONG — AC-001/002/003 with 422/CONSENT_REQUIRED assertions | ✅ Backend covered | Frontend flow untested (E2E) | P2 |
| Treatment mark done: two-step (diagnosed→planned→performed) | CLINICAL_WRITE | FIX-01 | `use-mark-treatment-done.test.ts` | STRONG — 2 PATCHes verified, bodies captured | ✅ Covered | — | — |
| staff_scheduling 403 on clinical writes (API level) | staff_scheduling | PG-01 | `rbac-http.test.ts`, `role-gates-scheduling.spec.ts` | STRONG — real DB + E2E dual context | ✅ Covered | — | — |
| Workspace read-only after visit completed | All | BR-003 | `workspace-readonly.spec.ts` | STRONG — full E2E flow | ✅ Covered | — | — |
| canAccess RBAC utility (4 roles × all modules) | All | rbac.test.ts | STRONG — all combinations tested | ✅ Covered | 5 undocumented roles (hygienist etc) untested | P2 |
| PIN session: inactivity timeout, start, clear | All | pin-session.test.ts | STRONG — isExpired, updateActivity, clearSession | ✅ Covered | — | — |
| Treatment plans URL: `/treatment-plans` (plural) → 404 | All | AD-01 | **None** | — | **NONE** | API integration: GET /treatment-plans → 404 regression | P0 |
| Recalls endpoints exist in backend | All | AD-02, BJ-08 | **None** | — | **NONE** | API: GET /recalls → 200 (or confirm 404 = absent) | P0 |
| Queue board endpoints: GET /queue-board, PATCH /queue-items | All | AD-03/04 | **None** | — | **NONE** | API: GET /queue-board → 200 | P1 |
| Appointment modal: edit mode loads existing appointment | All | FM-01 | **None** | — | **NONE** | Component/E2E: open with appointmentId → data pre-filled | P1 |
| Consent sheet: confirmation before irreversible sign | CLINICAL_WRITE | FM-13 | `consent-sheet.test.ts` (render only suspected) | **WEAK/NONE** | No confirmation dialog test found | Component: sign button → confirmation; cancel → no POST | P1 |
| Staff formatRole: undocumented roles display properly | dentist_owner | BI-06 | **None** | — | **NONE** | Unit: `formatRole('hygienist')` → human-readable string | P2 |
| Fee schedule save persists | dentist_owner | BI-05, SET-02 | **None** | — | **NONE** | E2E: update fee → save → reload → fee persists | P2 |
| Revenue chain full flow (J04) | dentist_owner | J04 | `04-revenue-chain.journey.spec.ts` (BROKEN expected) | **NONE effective** — expectedVerdict=BROKEN means CI accepts failure | Fix journey and flip expectedVerdict to PASS | P0 |
| Perio chart linked to odontogram (J03) | All | J03 | `03-perio-charting.journey.spec.ts` (BROKEN expected) | **NONE effective** | Fix perio→chart link | P1 |
| Void/amend signed entry (J10) | dentist_owner | J10 | `10-void-amend-audit.journey.spec.ts` (BROKEN expected) | **NONE effective** | Implement amendment flow | P1 |
| Informed refusal flow (J08) | dentist_owner | J08 | `08-informed-refusal.journey.spec.ts` (BROKEN expected) | **NONE effective** | Implement informed refusal | P1 |
| iPad layout E2E (calendar, imaging, perio, workspace) | All | various | `ipad-*.spec.ts` — **permanently skipped** | **NONE** — test.skip(true) | Remove skip or wire seed setup | P2 |
| Patient registration modal: fields reset on close | All | FM-06 | `patient-registration-modal.test.ts` | WEAK (likely render only) | Component: open → fill → close → reopen → fields empty | P2 |
| Staff create modal: escape key / focus trap | dentist_owner | FM-04 | `staff-create-modal.test.ts` | WEAK | Accessibility: press Escape → modal closes | P2 |

---

## 3. Weak Test Report

| ID | Test File | Weak Pattern | Why It Is Weak | Recommended Improvement | Severity |
|---|---|---|---|---|---|
| WT-01 | `apps/dentalemon/src/features/patients/components/patient-folder-card.test.ts` | Render-only | Tests display name, avatar initials, visit count, follow-up badge — onClick fires but **no assertion on the route passed to navigate**. The P1 bug (wrong route `/$patientId`) is invisible to this test. | Assert that onClick callback causes navigation to `/_workspace/$patientId` using a router mock or E2E URL assertion. | P1 |
| WT-02 | `apps/dentalemon/tests/e2e/auth-gates.spec.ts` | Over-broad assertion | `expect(result.status).toBeGreaterThanOrEqual(400)` and `toBeLessThan(500)` — passes for any 4xx including 400 Bad Request instead of 401/403. Masks authorization vs validation errors. | Assert specific HTTP status codes: 401 for unauthenticated, 403 for wrong role. | P2 |
| WT-03 | `apps/dentalemon/src/features/billing/components/invoice-detail.test.ts` | Logic helper only, no interaction | `canVoid('issued') === true` tests pure function, not whether the Void button triggers a confirmation dialog before the API call. FM-03 (void without confirmation) is invisible. | Add component test: simulate click on Void button → expect confirmation dialog to appear; cancel → expect no fetch call. | P1 |
| WT-04 | `apps/dentalemon/tests/e2e/*.spec.ts` (E2E CI job) | Soft CI gate | The `e2e` CI job runs with `continue-on-error: true` against a static Vite build (no backend). Test failures do not block merges. Only `journey-verification` hard-fails. This means all 52 non-journey E2E specs are effectively advisory. | Harden at minimum: patient navigation, void invoice, staff role gate, and consent signing specs into the hard gate or a separate required job. | P1 |
| WT-05 | `apps/dentalemon/tests/e2e/ipad-calendar.spec.ts`, `ipad-imaging.spec.ts`, `ipad-workspace.spec.ts`, `ipad-perio-charting.spec.ts` | Permanently skipped | All iPad tests skipped with `test.skip(true, 'Skipped — requires full seed setup (API unavailable)')`. These never run in any environment. | Implement seed setup fixtures or remove tests. Permanent skips are false confidence. | P2 |
| WT-06 | `apps/dentalemon/tests/e2e/billing-queue-morgan.spec.ts` | Implementation gap skip | `test.skip('[BR-013] mark dental invoice as uncollectible — implementation gap')` — documents a missing feature but does not gate it. | Track as P2 implementation work item; do not leave skip in CI. | P2 |
| WT-07 | `apps/dentalemon/src/features/staff/components/staff-create-modal.test.ts` | Render/submit only (suspected) | StaffCreateModal uses a custom `div role="dialog"` — no Radix Dialog. Tests likely verify render and submit path but not escape key dismissal, focus trap, or aria attributes. | Add: press Escape → modal closes; Tab cycles through focusable elements; `aria-labelledby` present. | P2 |
| WT-08 | Journey harness with 8 BROKEN-expected journeys | Normalized failure | CI exits 0 when BROKEN-expected journeys remain BROKEN. Flagship revenue chain (J04), plan versioning (J09), informed refusal (J08) all accepted as "expected broken." This creates a false sense of CI green. | Every BROKEN journey should have a GitHub issue and a target fix sprint. CI should surface BROKEN count in PR comment even when not failing. | P1 |
| WT-09 | `apps/dentalemon/src/features/dashboard/hooks/use-dashboard-summary.test.ts` | Missing fallback scenario | Tests `showFinancials: false/true` gating correctly but does **not** test the `?? 'dentist_owner'` fallback in the route component (`dashboard.tsx`). The dashboard hook and route component are tested separately — the dangerous default is in the route, not the hook. | Add component test for `DashboardPage` with `orgContextStore.role = null` → assert owner-only CTAs (Billing, Staff) are **not** rendered. | P1 |
| WT-10 | `apps/dentalemon/src/features/workspace/components/consent-sheet.test.ts` | No irreversibility guard test | Consent signing is irreversible (signed forms become read-only). Test likely checks form renders or saves — no test that UI warns before irreversible sign action. | Add: click Sign button → confirmation dialog appears; cancel → form remains editable; confirm → POST fired and form becomes read-only. | P1 |

---

## 4. Missing Test Report

| ID | Item | Risk | Recommended Test Type | Suggested Assertion | Priority |
|---|---|---|---|---|---|
| MT-01 | Treatment plans URL mismatch: frontend calls `/treatment-plans` (plural), spec has `/treatment-plan` (singular) | P0 — treatment plan tab always 404s in production | E2E / API integration | Navigate to workspace → treatment plan tab → API response is 200, not 404 | P0 |
| MT-02 | Recalls endpoints (`/dental/patients/{id}/recalls`) not in OpenAPI spec | P0 — recalls tab always fails if backend not wired | API integration | GET `/dental/patients/{id}/recalls` → 200 or explicitly document as absent | P0 |
| MT-03 | Revenue chain journey J04 expected BROKEN — no test enforces it will eventually PASS | P0 — flagship billing workflow broken | Journey E2E (after fix) | Flip J04 expectedVerdict to PASS in harness; revenue chain full round-trip succeeds | P0 |
| MT-04 | Patient card click → wrong route causes 404 crash | P1 — every patient navigation fails | E2E | Click patient card → URL is `/_workspace/{patientId}`; workspace renders patient name | P1 |
| MT-05 | Workspace top bar: staff_scheduling sees Rx, Consent, Lab buttons (should be hidden/disabled) | P1 — UX confusion + false affordance | Component | Render WorkspaceTopBar with `role=staff_scheduling` → Rx, Consent, Lab buttons not rendered or have `disabled` | P1 |
| MT-06 | Dashboard renders dentist_owner CTAs when org context role is null | P1 — privilege display to unauthenticated user | Component | Render `DashboardPage` with `orgContextStore.role = null` → Billing CTA and Staff CTA absent | P1 |
| MT-07 | Void Invoice fires without confirmation dialog | P1 — destructive action with no undo | E2E | Click Void Invoice → confirmation modal appears with invoice ID → dismiss → no API call; confirm → status becomes `voided` | P1 |
| MT-08 | Appointment modal edit mode is a stub (no fetch/update) | P1 — edit appointment silently fails | E2E / Component | Open AppointmentModal with `appointmentId` → existing appointment data pre-populated; submit → PATCH call made | P1 |
| MT-09 | Queue board endpoints not in OpenAPI spec; frontend polls them | P1 — queue board tab always fails if endpoints absent | API integration | GET `/dental/branches/{id}/queue-board` → 200; PATCH `/dental/queue-items/{id}/status` → 200 | P1 |
| MT-10 | Consent signing: no confirmation before irreversible sign action | P1 — accidental signing cannot be undone | Component / E2E | Click sign button → confirmation dialog appears; cancel → form still editable; confirm → POST succeeds → form becomes read-only | P1 |
| MT-11 | J03 perio charting → odontogram link BROKEN | P1 — clinical charting disconnected | Journey E2E (after fix) | Perio chart recorded in charting session → tooth status updated in odontogram | P1 |
| MT-12 | J08 informed refusal BROKEN | P1 — no test for patient refusing treatment | Journey E2E (after fix) | Patient declines treatment → dismissed status with reason persists | P1 |
| MT-13 | J10 void/amend signed entry BROKEN | P1 — amendment workflow untested end-to-end | Journey E2E (after fix) | Void PMD → amendment chain visible in audit log | P1 |
| MT-14 | `formatRole` in StaffList for undocumented roles | P2 — raw role string displayed to dentist_owner | Unit | `formatRole('hygienist')` → `'Hygienist'`; `formatRole('billing_staff')` → `'Billing Staff'` | P2 |
| MT-15 | Fee schedule save/persist | P2 — TODO in component | E2E | Update a CDT code fee → save → reload settings → fee value persists | P2 |
| MT-16 | Patient registration modal: form does not reset on close | P2 — stale data on reopen | Component | Open modal → fill name + DOB → close → reopen → all fields empty | P2 |
| MT-17 | Staff create modal: accessibility (escape key, focus trap, ARIA) | P2 — inaccessible custom dialog | Component accessibility | Press Escape while modal open → modal closes; Tab key cycles through focusable elements only; `aria-labelledby` resolves to modal title | P2 |
| MT-18 | iPad E2E paths (4 spec files, all permanently skipped) | P2 — zero iPad coverage in any environment | E2E | Implement seed fixtures; remove `test.skip(true)` from all iPad specs | P2 |
| MT-19 | BR-013: mark invoice as uncollectible (skipped — implementation gap) | P2 — billing feature hole | E2E | POST `/dental/billing/invoices/{id}/uncollectible` → 200; UI reflects status | P2 |
| MT-20 | staff_scheduling sees workspace action buttons in UI (E2E round-trip) | P1 — API enforces but UI shows confusing buttons | E2E | Log in as staff_scheduling → navigate to workspace → Rx / Consent / Lab icon buttons absent or visually disabled | P1 |

---

## 5. Bad Test Patterns Checklist

| Pattern | Present? | Location | Notes |
|---|---|---|---|
| Render-only tests with no behavior assertion | ✅ Yes | `patient-folder-card.test.ts`, suspected `consent-sheet.test.ts`, `staff-create-modal.test.ts` | Tests check DOM content, not user outcomes |
| Snapshot-only tests | ❌ No | — | Not found |
| Over-mocked tests (mocks diverge from real contracts) | ⚠️ Partial | Frontend unit tests mock `global.fetch` with hardcoded responses; actual API shape drift (AD-01 treatment-plans URL) would not be caught | fetch mock in unit tests does not validate URL patterns |
| No user-event / click tests | ⚠️ Partial | Navigation on patient card click, Void Invoice button — no click-to-outcome assertion | |
| No role denial tests (UI level) | ✅ Yes | No UI component test checks `staff_scheduling` role hides action buttons in WorkspaceTopBar | Backend RBAC tests exist; UI role gate untested |
| No API error path tests | ❌ No | `api-error-paths.spec.ts` exists and covers several 4xx scenarios | ✅ |
| No form validation tests | ❌ No | `validatePaymentForm`, `validateStaffForm`, `validate()` all have unit tests | ✅ |
| Skipped tests | ✅ Yes | 4 iPad spec files (permanently), `billing-queue-morgan.spec.ts` (BR-013), `imaging-comparison.spec.ts` (2 images needed) | |
| Flaky sleeps / timeouts | ❌ No | Playwright uses `waitForResponse` and `waitForLoadState` patterns; no explicit sleeps found | ✅ |
| Shared mutable test data | ⚠️ Partial | Backend integration tests truncate in `afterEach` ✅; but UUID prefix namespace convention used — shared DB if tests run concurrently | |
| Tests not tied to behavior | ⚠️ Partial | `constants/countries.test.ts`, `constants/languages.test.ts`, `constants/timezones.test.ts` — validation of constant arrays, low risk | |
| Soft CI gate masking failures | ✅ Yes | `e2e` job `continue-on-error: true`; `perf-ratchet` job `if: false` (disabled) | |

---

## 6. Role and Permission Test Coverage

| Scenario | Backend Test Exists | Frontend Test Exists | E2E Test Exists | Quality |
|---|---|---|---|---|
| dentist_owner allows clinical writes | ✅ `rbac-http.test.ts` | n/a | ✅ `action-contracts.spec.ts` | STRONG |
| dentist_associate allows clinical writes | ✅ `rbac-http.test.ts` | n/a | ✅ `role-gates-scheduling.spec.ts` (implied) | STRONG |
| dentist_associate blocked from void invoice | ✅ `rbac-http.test.ts` | ❌ None | ❌ None | WEAK (backend only) |
| staff_scheduling blocked from clinical writes (API) | ✅ `rbac-http.test.ts` | n/a | ✅ `role-gates-scheduling.spec.ts` | STRONG |
| staff_scheduling blocked from clinical buttons (UI) | n/a | ❌ **None** | ❌ **None** | **NONE** |
| staff_full RBAC (canAccess) | ✅ `rbac.test.ts` (utility) | ✅ | ❌ None | WEAK (utility only) |
| Unauthenticated → 401 | ✅ `auth.test.ts` | ❌ None | ✅ `auth-gates.spec.ts` (broad) | WEAK |
| Wrong branch isolation (cross-org) | ✅ `cross-org-isolation.test.ts` | n/a | ❌ None | WEAK |
| Ownership check (own patient vs other's) | ⚠️ Partial | n/a | ❌ None | WEAK |
| canAccess for 5 undocumented roles | ❌ None | ❌ None | ❌ None | **NONE** |

---

## 7. Frontend Journey Test Coverage

| Journey | Navigation Smoke Test | Critical E2E | Form Submission | Broken Button/Link | Loading/Error/Empty | Accessibility |
|---|---|---|---|---|---|---|
| Patient list → patient workspace | ❌ **None** (route is broken) | ❌ None | n/a | ❌ None | ✅ `workspace-empty-states.spec.ts` | ❌ None |
| New visit creation | ✅ `action-contracts.spec.ts` | ✅ | n/a | n/a | n/a | ❌ None |
| Tooth chart → treatment plan | ✅ `action-contracts.spec.ts` | ✅ | n/a | n/a | n/a | ❌ None |
| Consent signing | ✅ `consent-signing.spec.ts` | ✅ | ⚠️ No confirmation guard | n/a | n/a | ❌ None |
| Invoice create + void | ✅ `invoice-detail.spec.ts` | ✅ | ❌ No void confirm | ❌ No confirm dialog | n/a | ❌ None |
| Staff management | ✅ `add-staff.spec.ts` | ✅ | ✅ | n/a | n/a | ❌ None |
| Calendar / appointment | ✅ `calendar.spec.ts` | ✅ | ❌ Edit mode stub | n/a | n/a | ❌ None |
| Dashboard | ⚠️ Indirect | ❌ None | n/a | ❌ None (role default bug) | n/a | ❌ None |
| Settings (fee schedule) | ❌ None | ❌ None | ❌ TODO gap | n/a | n/a | ❌ None |
| Imaging upload | ✅ `imaging-*.spec.ts` | ✅ | ✅ | n/a | n/a | ❌ None |
| Perio charting | ✅ `ipad-perio-charting.spec.ts` | ❌ **Skipped** | n/a | n/a | n/a | ❌ None |
| iPad workspace | ❌ **Skipped** | ❌ **Skipped** | ❌ **Skipped** | ❌ **Skipped** | ❌ **Skipped** | ❌ None |

**Accessibility**: CalibrationDialog (Radix Dialog, autoFocus, Enter key) is the only fully compliant modal. No accessibility smoke tests found for any other modal or form. No `axe-playwright` or similar tool integrated into E2E suite.

---

## 8. Confidence Score

| Layer | Score / 10 | Main Gap |
|---|---|---|
| Coverage Integrity | 6/10 | 75%/75%/60% gate enforced for `src/` only; E2E spec files, route components, and feature integration paths not in coverage scope. Backend 160-file real-DB test suite is strong but doesn't cover undocumented endpoints (recalls, queue-board). |
| Behavior Traceability | 5/10 | BR-009 (billing gate) and BR-011 (consent gate) have STRONG backend traces. Core P1 behaviors — patient navigation route, void confirmation, UI role gates, dashboard fallback — have zero or WEAK test traces. 8/16 journeys explicitly marked BROKEN-expected. |
| Test Quality | 6/10 | Backend tests: STRONG (real Hono factory, real DB, afterEach TRUNCATE). Frontend unit tests: mixed — pure logic helpers (canVoid, validatePaymentForm, two-step mark-done) are STRONG; component interaction tests are WEAK or absent. E2E: STRONG for covered flows; large surface of skipped/soft-gated tests. |
| Release Gate Readiness | 5/10 | E2E CI job is soft (continue-on-error), meaning 52 E2E specs are advisory. Journey hard gate accepts 8 BROKEN journeys as normal. No accessibility tests. Patient navigation route bug (P1) has no guard. Perf ratchet disabled. Core user workflow (patient list → workspace → chart → invoice) untested end-to-end due to broken navigation. |

**Overall Test Confidence: 5.5 / 10**

---

## 9. Gate 8 Verdict

**GATE 8: PASS (with significant test gaps requiring stabilization)**

Test infrastructure is mature (real-DB backend tests, journey harness, CI traceability gate). The primary confidence gap is in **frontend interaction behavior**: navigation correctness, destructive action guards (void), and UI-level role filtering are largely untested. Eight journey specs are intentionally marked BROKEN-expected, normalizing known feature failures in CI.

**Critical gaps for stabilization plan:**
- MT-01/02: Treatment plans URL 404 + recalls backend existence — zero test coverage for P0 regressions
- MT-04: Patient card navigation — P1 bug with no guard test
- MT-05/20: UI role gate on workspace top bar — no component or E2E test
- MT-07: Void invoice confirmation — destructive action with no test guard
- WT-04: E2E soft gate — critical E2E specs must move to hard gate
- WT-08: 8 BROKEN journeys normalized in CI — requires remediation tracking
