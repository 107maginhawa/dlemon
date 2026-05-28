# Workspace Module Audit — Patient Workspace (Cross-module Orchestrator)

**Date:** 2026-05-26
**Auditor:** Read-only automated audit
**Scope:** `/_workspace` layout shell + `/_workspace/$patientId` main route + workspace-level orchestration components (TimelineCarousel, WorkspaceTopBar, WorkspacePaymentModal, tab/sheet navigation, empty states, readonly mode, iPad layout, journey specs)
**Prior global score:** ~70%
**Module ID:** #11 of 18

---

## Scope

This audit covers only workspace-level orchestration concerns. Individual module findings already captured in prior audits (CF-01, CF-03, CF-04, CF-07, CF-42, CF-43, CF-56, PMD findings F1–F15) are not re-reported here.

**Files audited:**
- `apps/dentalemon/src/routes/_workspace.tsx`
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx`
- `apps/dentalemon/src/routes/_workspace/queue-board.tsx`
- `apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx`
- `apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx`
- `apps/dentalemon/src/features/workspace/components/workspace-payment-modal.tsx`
- `apps/dentalemon/src/features/workspace/hooks/use-workspace-payment.ts`
- `apps/dentalemon/src/stores/org-context.store.ts`
- `apps/dentalemon/tests/e2e/ipad-workspace.spec.ts`
- `apps/dentalemon/tests/e2e/workspace-empty-states.spec.ts`
- `apps/dentalemon/tests/e2e/workspace-readonly.spec.ts`
- `apps/dentalemon/src/features/workspace/z_pages/timeline-carousel.test.ts`
- `apps/dentalemon/src/features/workspace/components/workspace-payment-modal.test.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-workspace-payment.test.ts`
- `apps/dentalemon/tests/e2e/journeys/01-new-patient-exam.journey.spec.ts` through `16-medical-alert-visibility.journey.spec.ts`
- `apps/dentalemon/tests/e2e/journeys/_journey-helpers.ts`

---

## Findings Summary

| # | Severity | Gate | Finding | File |
|---|----------|------|---------|------|
| WS-F1 | P1 | G2 | `role` field is stored in `useOrgContextStore` but **never read** by the workspace to gate any action — all top-bar buttons (Rx, Consent, Lab, PMD, Attachments, Notes, Treatment Plan) are visible and clickable to all authenticated roles including `readonly`. Action gating relies entirely on downstream server 403s with no user feedback. | `_workspace/$patientId.tsx`, `workspace-top-bar.tsx`, `org-context.store.ts` |
| WS-F2 | P1 | G2 | `isReadOnly` is derived solely from `currentVisit?.status` (`'completed'` or `'locked'`). A `readonly` role member with an active visit gets full edit UI — carousel new-visit button, tooth slideout Save/Save&Next, Mark Done — all enabled. Role-based readonly is unimplemented; only visit-status readonly is enforced. | `_workspace/$patientId.tsx` line 102–103 |
| WS-F3 | P1 | G4 | **No perio tab in workspace.** The workspace exposes Imaging, Recalls, and Treatment Plans tabs via the year-filter bar, but Perio Charting has no tab trigger, no sheet, no route. This was previously captured at the perio level (CF-42, CF-43) but the orchestration gap is: the workspace shell does not mount or wire any perio component whatsoever, making it unreachable from any navigation path. | `_workspace/$patientId.tsx` (grep for 'perio' returns empty) |
| WS-F4 | P1 | G7 | **`handleNewVisit` fails silently when `branchId` is null.** If the `/dental/org/context` call in `beforeLoad` fails or returns no branch (network error, unreachable API), `branchId` and `memberId` are null in the store. Clicking "New Visit" logs a console error and does nothing — no user-visible feedback, no error toast. The user sees the button do nothing with no explanation. | `_workspace/$patientId.tsx` lines 147–154 |
| WS-F5 | P1 | G4 | **Workspace has no empty-carousel state.** When `visits.length === 0` and `visitsLoading` is false (new patient, no visits), `currentVisitId` remains null, `currentVisit` is undefined, and the carousel renders a Swiper with zero slides plus the "New Visit" button. There is no empty-state prompt instructing the clinician to create the first visit. The `workspace-empty-states.spec.ts` tests the RecallsSheet and TreatmentPlansSheet empty states but does NOT test the zero-visits carousel state. | `_workspace/$patientId.tsx` line 95 + `workspace-empty-states.spec.ts` |
| WS-F6 | P1 | G8 | **`ipad-workspace.spec.ts` never navigates to the actual workspace route** (`/_workspace/$patientId`). All three tests navigate to `/patients` after seed, not to a patient workspace. The spec tests dashboard-level layout, not the clinical workspace layout at iPad viewport. The carousel, slideout panel, and 340px padding-right adjustment are never exercised under iPad dimensions. | `tests/e2e/ipad-workspace.spec.ts` lines navigate to `${APP}/patients` |
| WS-F7 | P2 | G3 | **`workspace-empty-states.spec.ts` uses wrong URL pattern.** The test navigates to `${APP}/_workspace/${patientId}` but the actual route is `/_workspace/$patientId` (TanStack pathless layout) — `openWorkspace()` in `_journey-helpers.ts` confirms the URL is `/${patientId}` without the `_workspace` prefix. If the test URL is wrong, `recalls-tab-btn` and `treatment-plans-tab-btn` wait will time out in CI. | `tests/e2e/workspace-empty-states.spec.ts` lines `await page.goto(...)` |
| WS-F8 | P2 | G2 | **`queue-board.tsx` uses `createFileRoute('/_workspace/queue-board' as any)`** — the `as any` cast suppresses TypeScript route validation. This route is not registered in the generated route tree, meaning TanStack Router's type-safe navigation to `/queue-board` will fail at compile time and may 404 at runtime. | `apps/dentalemon/src/routes/_workspace/queue-board.tsx` line 13 |
| WS-F9 | P2 | G4 | **`WorkspaceTopBar` receives no `isReadOnly` / `visitStatus`-aware disabling for Rx, Consent, Lab, PMD, or Notes buttons.** Only the "Complete visit" button is conditionally disabled (`disabled={visitStatus !== 'active'}`). After a visit is completed/locked, all five clinical-action buttons remain active and open their sheets — the user can attempt to write an Rx or add consent to a completed visit, relying entirely on the sheet/backend to reject it. | `apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx` lines 164–178 |
| WS-F10 | P2 | G6 | **Workspace org-context fetch uses raw `fetch()` with `as any` cast** in `_workspace.tsx` `beforeLoad`. The response is cast to `any` and no error is surfaced to the user when the fetch fails — the store silently retains stale or null values. No retry, no structured error, no redirect to onboarding if `branch.id` is missing. | `apps/dentalemon/src/routes/_workspace.tsx` lines 13–25 |
| WS-F11 | P2 | G8 | **No journey spec covers the `staff_full` persona entering the workspace.** All 16 journey specs use `pinAuth(page, 'dentist')` exclusively (except J02 which uses `staff`). There is no journey asserting that `staff_full` can open the workspace, view patient data, and is correctly blocked from clinical-write actions (tooth save, complete visit). The `PERSONAS` object defines `staff` as `staff_full` but no workspace journey uses it. | `tests/e2e/journeys/_journey-helpers.ts` + all journey specs |
| WS-F12 | P2 | G8 | **`timeline-carousel.test.ts` mocks Swiper globally but slide-change behavior depends on the mock's `onSlideChange` capture.** Tests verify render counts and the New Visit button, but no test exercises `handleSlideChange` → `onSelectVisit` callback wiring. The most critical carousel behavior (selecting a visit by swiping) has no unit test coverage. | `apps/dentalemon/src/features/workspace/z_pages/timeline-carousel.test.ts` |
| WS-F13 | P2 | G4 | **`WorkspacePaymentModal` unit test references `data-testid="view-invoice-btn"` but the component renders `data-testid="open-invoice-detail-btn"`** (confirmed in `workspace-payment-modal.tsx`). The `it('shows View Invoice link (PAY-02)')` test will fail because the selector does not match the actual DOM. | `workspace-payment-modal.test.ts` line asserting `view-invoice-btn` vs `workspace-payment-modal.tsx` using `open-invoice-detail-btn` |
| WS-F14 | P3 | G3 | **Journey spec J01 expected verdict is `'PASS'` in `META` but the file comment says `Expected verdict: BROKEN`** (P0-004, Gap #1, Gap #2). The `META.expectedVerdict = 'PASS'` field contradicts the spec documentation at the top of the file. If the journey harness evaluates `META.expectedVerdict`, J01 will incorrectly count as a pass. | `tests/e2e/journeys/01-new-patient-exam.journey.spec.ts` line `expectedVerdict: 'PASS'` vs header comment `Expected verdict: BROKEN` |
| WS-F15 | P3 | G4 | **`handleSharePMD` exposes raw PMD checksum in `navigator.share()` text field.** The share text is `PMD for visit — Checksum: ${pmd.checksum}`. Because the checksum is fake (PMD-F1 from the PMD audit), this leaks a non-cryptographic value to the OS share sheet, potentially misleading clinicians into trusting a document integrity indicator that is meaningless. | `_workspace/$patientId.tsx` lines 161–170 |

---

## Gate-by-Gate Analysis

### Gate 2 — Roles & Permissions

**Role store:** `useOrgContextStore` captures `role: string | null` from `GET /dental/org/context`. The field is populated correctly in `_workspace.tsx` `beforeLoad`.

**Critical gap:** The `role` value is **never consumed** in `_workspace/$patientId.tsx` or `workspace-top-bar.tsx`. There is no `if (role === 'readonly')` guard anywhere in the workspace shell. The intended RBAC (dentist_owner, dentist_associate, staff_full, readonly) is enforced only at the API layer.

**`isReadOnly` derivation:** Derived from visit status (`completed` | `locked`), not from the member's role. A `readonly` role with an active visit has a fully editable workspace in the frontend. The backend will reject writes with 403, but the UX is misleading — buttons are enabled, forms open, and the user receives no proactive indication they cannot act.

**WS-F1 and WS-F2 apply here.**

---

### Gate 3 — Routes & Navigation

**URL structure:** The workspace uses a TanStack pathless layout. The actual URL for a patient workspace is `/${patientId}` (no `_workspace` prefix), confirmed in `_journey-helpers.ts` `openWorkspace()`. The route declaration is `createFileRoute('/_workspace/$patientId')`.

**Mismatches identified:**
- `workspace-empty-states.spec.ts` navigates to `${APP}/_workspace/${patientId}` — the literal URL segment `_workspace` appears in the test navigation but is absent from the actual rendered URL (WS-F7).
- `queue-board.tsx` uses `as any` cast to suppress route registration type error, suggesting it is not in the generated route tree (WS-F8).
- Previously captured: CF-01 (patient card wrong route), CF-03 (treatment plans URL mismatch).

---

### Gate 4 — Frontend Interaction Integrity

**Tab/sheet architecture:** Workspace uses local `useState` booleans for each sheet (`rxSheetOpen`, `consentSheetOpen`, `labOrdersSheetOpen`, `pmdViewerOpen`, `pmdImportOpen`, `notesSheetOpen`, `treatmentPlanSheetOpen`, `imagingOpen`, `recallsOpen`, `treatmentPlansOpen`, `paymentModalOpen`, `checklistOpen`). Each sheet is opened via top-bar callbacks or tab buttons in the year-filter bar.

**Perio tab entirely absent:** No state variable, no button, no import of any perio component in `$patientId.tsx` (WS-F3).

**Top-bar action buttons:** All five clinical-action buttons (Rx, Consent, Lab, PMD, Attachments) remain enabled after visit completion. Only "Complete visit" is gated by `visitStatus !== 'active'` (WS-F9).

**Empty carousel:** Zero-visits case falls through to a Swiper with no slides and a "New Visit" button but no contextual prompt (WS-F5).

**Share PMD exposes fake checksum** in OS share sheet text (WS-F15).

---

### Gate 5 — Forms & Modals

**WorkspacePaymentModal (PAY-01/PAY-02):**
- Modal correctly shows line items → "Create Invoice" when no invoice exists.
- When invoice exists, shows "Record Payment" (`open-invoice-detail-btn`).
- `isReadOnly` flows through: footer button reads "View Invoice" for completed visits.
- No role guard on opening the payment modal — a `readonly` role user can click "Continue to Payment" and attempt invoice creation (server will reject, but UX is broken).

**PreCompletionChecklist:** Triggered by `onCompleteVisit` → `setChecklistOpen(true)`. Not role-gated — any authenticated user can attempt visit completion. Backend enforces, frontend does not.

---

### Gate 6 — Backend API Contract Alignment

**Org context fetch:** `_workspace.tsx` `beforeLoad` calls `GET /dental/org/context` via raw `fetch()` with `as any` response cast. No SDK usage, no structured error handling (WS-F10).

**Workspace has no backend aggregation endpoint.** Each carousel slide calls `getDentalChartOptions({ path: { visitId } })` independently — N+1 pattern where N is the number of visits. For a patient with 20 visits, the workspace fires 20 parallel chart queries on mount. No workspace-level snapshot aggregation endpoint exists.

**New visit creation:** `POST` via `useCreateVisit` hook — standard SDK pattern. Guard in `handleNewVisit` checks `branchId/memberId` but shows no user-visible error (WS-F4).

---

### Gate 7 — Role-Based Journey Maps

**Journey coverage:**
- J01: new patient exam (dentist) — `expectedVerdict: 'PASS'` contradicts file-header `Expected verdict: BROKEN` (WS-F14)
- J04: revenue chain — dentist creates visit, marks done, creates invoice. Invoice creation is done via `apiReader.post` (API-only, not UI) because no invoice creation UI exists in the workspace except through `WorkspacePaymentModal`, which J04 does not exercise.
- J01–J16: all use `dentist` or `staff` (staff_full) persona; no `readonly` journey, no `dentist_associate` journey.

**Cross-tab data flow:** No journey tests tab-switching within a visit (e.g., open imaging then return to clinical chart and verify no stale state). The `currentVisitId` is held in local state; no persistence across navigations.

**Carousel visit selection:** `handleSlideChange` calls `onSelectVisit` → `setCurrentVisitId`. No test verifies that changing carousel slides correctly updates `currentVisitId` and consequently updates the treatment table and top-bar visit date.

---

### Gate 8 — Test Confidence Gaps

**Unit tests present:**
- `timeline-carousel.test.ts`: render count, empty array, new-visit button. Missing: slide-change → `onSelectVisit` callback, lock mutation trigger (WS-F12).
- `workspace-payment-modal.test.ts`: PAY-01/PAY-02 coverage is good. One test uses wrong `data-testid` (`view-invoice-btn` vs actual `open-invoice-detail-btn`) — this test will fail (WS-F13).
- `use-workspace-payment.test.ts`: covers `usePatientInvoices` list and `useCreateInvoice` POST. Coverage adequate.

**E2E test gaps:**
- `ipad-workspace.spec.ts`: never reaches `/_workspace/$patientId` — all assertions are on `/patients` page (WS-F6).
- `workspace-empty-states.spec.ts`: wrong URL path for workspace navigation (WS-F7); does not test zero-visits carousel empty state.
- `workspace-readonly.spec.ts`: covers `BR-003` (completed visit no mark-done, slideout shows Add Amendment, footer shows View Invoice). Good coverage for visit-status readonly. Does not test role-based readonly (a `readonly` role with an active visit).
- No journey spec for `staff_full` persona in workspace (WS-F11).
- No journey spec for tab-switching, carousel slide-change, or cross-tab data consistency.

**Test count summary:**
| File | Tests Present | Critical Gap |
|------|--------------|--------------|
| `timeline-carousel.test.ts` | Render, empty, new-visit | No slide-change → callback coverage |
| `workspace-payment-modal.test.ts` | PAY-01/PAY-02 flows | 1 broken testid selector |
| `use-workspace-payment.test.ts` | List + create + error | None |
| `ipad-workspace.spec.ts` | 3 layout tests | Never reaches actual workspace URL |
| `workspace-empty-states.spec.ts` | Recalls, Plans, Queue empty | Wrong workspace URL; no zero-visits carousel |
| `workspace-readonly.spec.ts` | BR-003 visit-status | No role-based readonly |
| Journey specs J01–J16 | 16 journeys, dentist + staff | No readonly/associate persona; no tab-switching journey |

---

## Critical Issues Detail

### WS-F1 — Role field stored but never consumed (P1)

The `OrgContextStore` captures `role: string | null` from the backend context API. Every workspace action that should be role-gated (write Rx, add consent, create visit, mark treatment done, complete visit) reads only `branchId` and `memberId` from the store. `role` is read zero times in the workspace shell and zero times in `WorkspaceTopBar`. A `readonly` member gets the identical UI as a `dentist_owner`. All enforcement is server-side only, producing silent 403 errors with no user-facing feedback.

### WS-F2 — isReadOnly is visit-status only, not role-based (P1)

```typescript
// _workspace/$patientId.tsx line 102
const isReadOnly =
  currentVisit?.status === 'completed' || currentVisit?.status === 'locked';
```

This is the sole readonly derivation. A `readonly`-role member seeing an `active` visit gets `isReadOnly = false` — full edit UI including tooth save, Mark Done, and visit completion. The frontend makes no role-based distinction.

### WS-F6 — iPad spec never reaches workspace (P1)

```typescript
// ipad-workspace.spec.ts — all three tests:
await page.goto(`${APP}/patients`);
```

The spec is declared under `testMatch: '**/ipad-*.spec.ts'` for `ipad-portrait` and `ipad-landscape` projects. It tests the patients list page only. The workspace carousel + 340px slideout padding adjustment + Swiper coverflow layout at iPad dimensions is untested.

### WS-F13 — Broken testid in payment modal test (P2)

```typescript
// workspace-payment-modal.test.ts:
it('shows View Invoice link (PAY-02)', async () => {
  ...
  await waitFor(() => {
    expect(screen.getByTestId('view-invoice-btn')).not.toBeNull(); // FAILS
  });
});
```

Actual DOM uses `data-testid="open-invoice-detail-btn"`. This test will fail in CI.

---

## Recommended Fix Priority

| Priority | Finding | Action |
|----------|---------|--------|
| P1 | WS-F1 — role never consumed | Read `role` from store in `$patientId.tsx`; disable write actions for `readonly` role |
| P1 | WS-F2 — isReadOnly ignores role | Combine visit-status check with role check: `isReadOnly = (visit completed/locked) OR (role === 'readonly')` |
| P1 | WS-F3 — no perio tab | Wire perio charting tab into year-filter bar (already captured as CF-42/CF-43; orchestration fix needed here) |
| P1 | WS-F4 — silent fail on new visit | Add user-visible error toast when `branchId/memberId` is null |
| P1 | WS-F5 — no zero-visits empty state | Add empty state prompt when `visits.length === 0 && !visitsLoading` |
| P1 | WS-F6 — iPad spec tests wrong page | Rewrite `ipad-workspace.spec.ts` to navigate to `/${patientId}` and assert workspace carousel + layout |
| P2 | WS-F7 — wrong URL in empty-states spec | Change `${APP}/_workspace/${patientId}` to `${APP}/${patientId}` |
| P2 | WS-F8 — queue-board `as any` cast | Register `/_workspace/queue-board` properly in route tree |
| P2 | WS-F9 — top-bar not gated on completion | Disable Rx/Consent/Lab/PMD/Notes buttons when `visitStatus` is `completed` or `locked` |
| P2 | WS-F13 — broken payment modal testid | Fix test assertion: `view-invoice-btn` → `open-invoice-detail-btn` |
| P3 | WS-F14 — J01 verdict contradiction | Align `META.expectedVerdict` with file-header comment |
| P3 | WS-F15 — fake checksum in share text | Remove checksum from share text pending PMD-F1 fix |

---

## Overall Confidence Score: 4/10

**Rationale:**

The workspace shell is architecturally sound — layout, loading state, carousel, sheet-per-tab pattern, and visit-status readonly all work. However, confidence is critically undermined by:

1. **Role enforcement is entirely absent from the frontend** (WS-F1, WS-F2). The `role` field exists in the store but drives zero UI behavior. Any authenticated user has full clinical-write UI regardless of role.

2. **Perio tab is completely absent** from workspace orchestration (WS-F3 / CF-42). A core clinical module has no entry point in the primary workspace.

3. **Two of three workspace E2E test files are broken or misdirected** — `ipad-workspace.spec.ts` tests the wrong page (WS-F6) and `workspace-empty-states.spec.ts` uses the wrong URL (WS-F7). Effectively, iPad layout and empty-state coverage do not exist.

4. **One unit test has a broken selector** (WS-F13) — will fail in CI.

5. **No journey coverage for `readonly` role or cross-tab navigation** (WS-F11).

The workspace passes its own narrow unit tests and the `workspace-readonly.spec.ts` visit-status test, but the cross-cutting role security gap and the broken E2E coverage leave the module in a state where critical access-control and layout regressions would not be caught by the test suite.
