---
phase: 03-bug-fixes-polish
verified: 2026-05-11T00:00:00Z
status: human_needed
score: 6/7 must-haves verified
overrides_applied: 1
gaps:
  - truth: "useTreatmentPlan calls SDK, not raw fetch"
    status: accepted
    reason: "ROADMAP SC #2 and REQUIREMENTS BFIX-02 both specify SDK usage. Implementation intentionally kept raw fetch with a comment documenting no SDK option exists. The plan (03-01) reworded the must-have to 'raw fetch pattern is clean and consistent' — but PLAN must_haves cannot reduce roadmap success criteria. The raw fetch is still present at use-treatment-plan.ts:46."
    artifacts:
      - path: "apps/dentalemon/src/features/workspace/hooks/use-treatment-plan.ts"
        issue: "Uses raw fetch (fetch + apiBaseUrl + credentials:include) instead of generated SDK hook. ROADMAP SC #2 requires SDK call."
    missing:
      - "Either: generate/add an SDK hook for GET /dental/patients/:id/treatment-plan and replace raw fetch with it"
      - "Or: add an override entry to this VERIFICATION.md accepting the deviation with rationale (no SDK endpoint exists), accepted by a human decision-maker"
deferred: []
human_verification:
  - test: "Fullscreen Escape key behavior"
    expected: "Press F11 or browser fullscreen button, then press Escape — the fullscreen icon in workspace top bar should switch back to the expand icon immediately"
    why_human: "fullscreenchange event listener cannot be triggered programmatically without a running browser"
---

# Phase 03: Bug Fixes & Polish Verification Report

**Phase Goal:** Fix all known workspace bugs identified in reconciliation audit
**Verified:** 2026-05-11
**Status:** human_needed (BFIX-02 deviation accepted by user 2026-05-11)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Price displays consistent across table, payment modal, save flow (×100 at boundary) | ✓ VERIFIED | use-save-treatment.ts:36 `Math.round(priceAmount * 100)`; treatment-table.tsx line 284 `Math.round(parsed * 100)`; workspace-payment-modal.tsx `formatCents(priceCents)`; tooth-slideout.tsx `priceCents / 100` on CDT select. "price contract" comment in all 3 display files. |
| 2 | useTreatmentPlan calls SDK, not raw fetch | ✗ FAILED | use-treatment-plan.ts:46 still does `fetch(\`${apiBaseUrl}/dental/patients/...\`)` with `credentials: 'include'`. A comment was added ("intentional raw fetch") but the raw fetch was NOT replaced with SDK. REQUIREMENTS BFIX-02 and ROADMAP SC #2 both require SDK. |
| 3 | Fullscreen toggle works + syncs on Escape key | ✓ VERIFIED (automated) | workspace-top-bar.tsx:57-63: `useEffect` adds `fullscreenchange` listener; listener calls `setIsFullscreen(!!document.fullscreenElement)`. `.then()` chains removed from toggle. Human test still needed for runtime behavior (see Human Verification). |
| 4 | No duplicate Profile/PMD buttons in DOM simultaneously | ✓ VERIFIED | `grep PMD\|Profile\|onPmd tooth-slideout.tsx` → 0 results. WorkspaceTopBar confirmed as sole renderer. tooth-slideout.tsx is a tooth-entry panel only. |
| 5 | Org store uses reactive hook in component bodies | ✓ VERIFIED | $patientId.tsx:64 `useOrgContextStore(s => s.memberId)`; :67 `useOrgContextStore(s => s.branchId)`. Exactly 1 remaining `.getState()` at line 130 (event handler — intentional). 2 reactive selectors confirmed. |
| 6 | WorkspaceTabs files deleted, no broken imports | ✓ VERIFIED | workspace-tabs.tsx and workspace-tabs.test.ts absent from disk. `grep -r "workspace-tabs" apps/dentalemon/src` → 0 results. |
| 7 | Resize divider tracks Y-axis for vertical layout | ✓ VERIFIED | resizable-divider.tsx: `direction?: 'x' \| 'y'` prop (line 15); `clientY` branch at line 24 and 30; `aria-orientation="horizontal"` for y (line 44); `cursor-row-resize` via className (line 46); `h-2 w-full` layout for y-axis. $patientId.tsx:260: `<ResizableDivider onResize={handleResize} direction="y" />`. |

**Score:** 6/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/dentalemon/src/features/workspace/hooks/use-treatment-plan.ts` | Clean hook, intentional raw fetch documented | ✓ VERIFIED | Comment added; pattern clean; but SC requires SDK — see gap |
| `apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts` | `Math.round(priceAmount * 100)` | ✓ VERIFIED | Line 36 confirmed |
| `apps/dentalemon/src/routes/_workspace/$patientId.tsx` | Reactive org store selectors at lines 64+67 | ✓ VERIFIED | Both lines use `useOrgContextStore(s => s.field)` |
| `apps/dentalemon/src/features/workspace/components/resizable-divider.tsx` | direction prop, Y-axis tracking | ✓ VERIFIED | Full implementation present |
| `apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx` | fullscreenchange listener, no .then() | ✓ VERIFIED | useEffect with listener + cleanup; grep `.then(` → 0 results |
| `apps/dentalemon/src/features/workspace/components/workspace-tabs.tsx` | DELETED | ✓ VERIFIED | File does not exist on disk |
| `apps/dentalemon/src/features/workspace/components/workspace-tabs.test.ts` | DELETED | ✓ VERIFIED | File does not exist on disk |
| `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx` | No PMD/Profile buttons | ✓ VERIFIED | Zero matches for PMD/Profile/onPmd |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| WorkspacePage | useOrgContextStore | `useOrgContextStore(s => s.field)` | ✓ WIRED | 2 reactive selectors in render body; 1 .getState() in event handler (intentional) |
| ResizableDivider | $patientId.tsx | `direction="y"` prop | ✓ WIRED | $patientId.tsx:260 confirmed |
| useSaveTreatment | createDentalTreatment API | `Math.round(priceAmount * 100)` | ✓ WIRED | use-save-treatment.ts:36 confirmed |
| FullscreenButton | document | `addEventListener('fullscreenchange', ...)` | ✓ WIRED | Lines 61-62 in workspace-top-bar.tsx |
| CdtCodeBrowser | ToothSlideout | `setPriceInput(String(selection.priceCents / 100))` | ✓ WIRED | tooth-slideout.tsx:102 confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| use-treatment-plan.ts | `query.data` | raw `fetch()` to `apiBaseUrl` | Yes — real API call | ✓ FLOWING |
| use-save-treatment.ts | priceCents | `Math.round(priceAmount * 100)` | Yes — computed from user input | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| workspace-tabs files deleted | `ls workspace-tabs*` | No matches | ✓ PASS |
| No workspace-tabs imports | `grep -r workspace-tabs` → count | 0 | ✓ PASS |
| Reactive selectors in $patientId | `grep useOrgContextStore(s =>` | 2 results at lines 64+67 | ✓ PASS |
| .getState() count in $patientId | `grep useOrgContextStore.getState` | 1 result (line 130, event handler) | ✓ PASS |
| priceCents conversion | `grep Math.round(priceAmount` | Line 36: `* 100` present | ✓ PASS |
| fullscreenchange listener | `grep fullscreenchange workspace-top-bar.tsx` | Lines 61+62 (add+remove) | ✓ PASS |
| No .then() in fullscreen toggle | `grep '\.then(' workspace-top-bar.tsx` | 0 results | ✓ PASS |
| direction='y' wired | `grep direction="y" $patientId.tsx` | Line 260 | ✓ PASS |
| useTreatmentPlan — SDK vs raw fetch | `grep fetch use-treatment-plan.ts` | Raw fetch at line 46 — NOT SDK | ✗ FAIL |
| price contract comments | `grep "price contract"` | Present in all 3 display files | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BFIX-01 | 03-03 | Price unit mismatch fixed — save ×100 | ✓ SATISFIED | use-save-treatment.ts:36 `Math.round(priceAmount * 100)` |
| BFIX-02 | 03-01 | useTreatmentPlan uses SDK instead of raw fetch | ✗ BLOCKED | REQUIREMENTS says "generated SDK"; ROADMAP SC says "calls SDK, not raw fetch". Implementation kept raw fetch with comment. |
| BFIX-03 | 03-04 | Fullscreen button handles Escape via fullscreenchange | ✓ SATISFIED | fullscreenchange listener wired; human verification pending for runtime |
| BFIX-04 | 03-04 | Duplicate Profile/Share PMD buttons removed | ✓ SATISFIED | tooth-slideout.tsx: 0 PMD/Profile matches; investigation documented |
| BFIX-05 | 03-01 | useOrgContextStore reactive hook in render | ✓ SATISFIED | 2 reactive selectors confirmed |
| BFIX-06 | 03-01 | Orphaned WorkspaceTabs deleted | ✓ SATISFIED | Files deleted, 0 import refs |
| BFIX-07 | 03-02 | ResizableDivider Y-axis tracking | ✓ SATISFIED | direction prop + clientY branch + direction="y" in workspace |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| use-treatment-plan.ts | 46 | `fetch(apiBaseUrl + ...)` | ⚠️ Warning | ROADMAP SC #2 requires SDK; raw fetch kept intentionally but violates stated success criterion. Not a code quality issue — a requirements compliance issue. |

### Human Verification Required

#### 1. Fullscreen Escape key sync

**Test:** Open the workspace (`/workspace/$patientId`), click the fullscreen button to enter fullscreen, then press `Escape` to exit fullscreen via browser native behavior.
**Expected:** The fullscreen icon in the top bar immediately switches from the Minimize icon back to the Expand/Maximize icon — without needing to click the button.
**Why human:** `fullscreenchange` event behavior requires a real browser; cannot be triggered with grep/static analysis.

### Gaps Summary

**1 blocker gap:** BFIX-02 (useTreatmentPlan SDK migration) is the only gap. The ROADMAP success criterion #2 explicitly states "useTreatmentPlan calls SDK, not raw fetch." The plan reinterpreted this as "verify and document the raw fetch pattern" — a narrowing deviation not permitted under goal-backward verification rules.

**Decision needed:** A human must decide:
- Option A: Generate or add an SDK hook for `GET /dental/patients/:id/treatment-plan` and replace the raw fetch (satisfies the original SC).
- Option B: Accept the deviation by adding an override entry to this VERIFICATION.md, with rationale that no SDK endpoint exists for this route and the raw fetch is the correct pattern.

The 6 other bugs (BFIX-01, 03, 04, 05, 06, 07) are fully fixed and verified in the codebase.

---

*Verified: 2026-05-11*
*Verifier: Claude (gsd-verifier)*
