---
phase: 03-bug-fixes-polish
fixed_at: 2026-05-11T00:00:00Z
review_path: .planning/phases/03-bug-fixes-polish/03-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-11
**Source review:** .planning/phases/03-bug-fixes-polish/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (4 Critical + 7 Warning)
- Fixed: 11
- Skipped: 0

## Fixed Issues

### CR-01: Remove .tsx extension from FiveSurfaceSelector import

**Files modified:** `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx`
**Commit:** b477b32
**Applied fix:** Changed `'./five-surface-selector.tsx'` → `'./five-surface-selector'`

---

### CR-02: Wrap handleCreateInvoice in try/catch

**Files modified:** `apps/dentalemon/src/features/workspace/components/workspace-payment-modal.tsx`
**Commit:** 8a66bb3
**Applied fix:** Added try/catch around `mutateAsync` call; error surfaced via `createInvoice.isError`

---

### CR-03: Guard document.fullscreenElement in useState initializer

**Files modified:** `apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx`
**Commit:** c24872e
**Applied fix:** Changed `useState(!!document.fullscreenElement)` to lazy initializer with `typeof document !== 'undefined'` guard

---

### CR-04: Add null guard in useTreatmentPlan queryFn

**Files modified:** `apps/dentalemon/src/features/workspace/hooks/use-treatment-plan.ts`
**Commit:** 5055734
**Applied fix:** Added `if (!patientId) throw new Error('patientId is required')` at top of queryFn

---

### WR-01: Await onSaved before calling onClose in AmendmentForm

**Files modified:** `apps/dentalemon/src/features/workspace/components/amendment-form.tsx`
**Commit:** 365d2bc
**Applied fix:** Changed `onSaved?.()` → `await Promise.resolve(onSaved?.())` so async failures prevent premature close

---

### WR-02: Clarify thisVisitTotal label includes hidden completed rows

**Files modified:** `apps/dentalemon/src/features/workspace/components/treatment-table.tsx`
**Commit:** c1fa6c6
**Applied fix:** Added explanatory comment; changed label from "This Visit" to "This Visit (all)" to signal it includes filtered-out rows

---

### WR-03: Convert dismiss Popover to controlled state

**Files modified:** `apps/dentalemon/src/features/workspace/components/treatment-table.tsx`
**Commit:** 4509a19
**Applied fix:** Added `openDismissId` state; Popover now controlled via `open`/`onOpenChange`; `onSuccess` callback calls `setOpenDismissId(null)` to close after dismiss confirms

---

### WR-04: Handle onPointerCancel in ResizableDivider

**Files modified:** `apps/dentalemon/src/features/workspace/components/resizable-divider.tsx`
**Commit:** 4c61973
**Applied fix:** Added `handlePointerCancel` function and `onPointerCancel` prop to prevent drag state leak on touch cancel

---

### WR-05: Disable step nav buttons in readOnly mode

**Files modified:** `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx`
**Commit:** 47b8beb
**Applied fix:** Added `disabled={readOnly}` and guarded `onClick` with `!readOnly &&` on step indicator buttons

---

### WR-06: Replace BigInt with number for priceCents

**Files modified:** `apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts`
**Commit:** 1f6178d (fix), 91c91bd (reverted — wrong approach), milestone-audit-fix (final fix via TypeSpec)
**Applied fix (final):** Root cause was TypeSpec `int64` → `bigint` in SDK. Changed `priceCents: int64` → `int32` in `dental-visit.tsp` for both `DentalTreatment` and `CreateDentalTreatmentRequest` models (matches DB `integer` type). Regenerated OpenAPI + SDK — `priceCents` now `number` in SDK. Removed `BigInt()` wrapper in `use-save-treatment.ts`. Previous commit 91c91bd revert was incorrect: it tried SDK-type compatibility but BigInt is never JSON-serializable.

---

### WR-07: Remove duplicate profile link and share PMD button from table zone

**Files modified:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx`
**Commit:** 5cb8b1b
**Applied fix:** Removed the duplicate `view-profile-link` Link and `share-pmd-btn` button from inside `workspace-table-zone`; authoritative copies remain in the year filter bar

---

## Skipped Issues

None — all 11 in-scope findings were fixed.

---

## Info Findings (out of scope, deferred)

- **IN-01** (`amendment-form.tsx`) — `as` type cast suppresses body type safety
- **IN-02** (`medical-history-sheet.tsx`) — Escape key does not close sheet
- **IN-03** (`tooth-slideout.tsx`) — `clinicalNotes` TODO field in onSave payload
- **IN-04** (`use-treatment-plan.ts`) — raw fetch bypasses SDK auth/error handling

These require design decisions or backend coordination; deferred to next review cycle.

---

_Fixed: 2026-05-11_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
