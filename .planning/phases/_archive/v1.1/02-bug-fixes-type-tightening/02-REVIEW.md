---
phase: 02-bug-fixes-type-tightening
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts
  - apps/dentalemon/src/features/workspace/hooks/use-treatments.ts
  - apps/dentalemon/src/routes/_workspace/$patientId.tsx
  - apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts
  - apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts
  - apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: fixed
---

# Phase 2: Code Review Report

**Reviewed:** 2026-05-06
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

6 files reviewed covering the Phase 2 bug fixes and type tightening. 11 findings: 3 critical (data loss, silent error swallowing, stale closure surviving the fix), 5 warnings (input validation gaps, type unsafety, navigation logic flaw), 3 info items.

---

## Critical Issues

### CR-01: `handleSave` silently swallows save errors — UI closes on failure

**File:** `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx:79-93`

**Issue:** `handleSave` calls `await onSave(...)` inside a `try/finally` block with no `catch`. If `onSave` throws (network error, NaN rejection), the `finally` block still calls `onClose()`, dismissing the slideout and discarding the user's in-progress data. The user loses their unsaved edits with no error feedback.

```typescript
async function handleSave() {
  setSaving(true);
  try {
    await onSave({ ... });
    onClose();   // ← only close on success
  } catch (err) {
    // surface error to user — do NOT close
    console.error('Save failed', err);
    // setError(err) → show inline error message
  } finally {
    setSaving(false);
  }
}
```

**Fix:** Move `onClose()` inside `try` (after the `await`), add a `catch` that surfaces the error and does NOT close. The current code calls `onClose()` unconditionally in `finally` — move it to after the await succeeds.

---

### CR-02: Stale `visitId` closure still present in `useSaveChart` and `useSaveTreatment` parameter — fix is incomplete

**File:** `apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts:20-38`
**File:** `apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts:24-42`

**Issue:** Both hooks accept `visitId: string | null` as a hook parameter but the value is **never used** — `mutationFn` reads `input.visitId` instead. The hook parameter exists only to be passed in from the parent (`useSaveChart(currentVisitId)`), but there is no mechanism enforcing that `input.visitId === visitId`. The caller in `$patientId.tsx` passes `currentVisitId!` into the mutation input (line 139, 146) — if `currentVisitId` changes between when the hook was instantiated and when `mutate` fires, the `input.visitId` reflects the current value but the hook-level `visitId` (used nowhere) is stale. The actual stale-closure bug the PR claimed to fix was the `onSuccess` query invalidation key: `queryClient.invalidateQueries({ queryKey: ['dental-chart', input.visitId] })` uses `input.visitId` (correct), so invalidation is safe. However the hook signature misleads callers into thinking the passed `visitId` governs which visit is targeted — it does not. The unused parameter should either be removed (making the API honest) or used as a default/guard.

**Fix:** Remove the unused `visitId` parameter from both hook signatures since it does nothing, or add a runtime guard:

```typescript
// Option A — remove parameter (cleaner)
export function useSaveChart() { ... }

// Option B — use it as a guard
mutationFn: async (input: SaveChartInput) => {
  if (visitId !== null && input.visitId !== visitId) {
    throw new Error('visitId mismatch — stale mutation reference');
  }
  ...
}
```

---

### CR-03: Treatment save errors are silently ignored — no error propagation from `saveTreatmentMutation.mutate`

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:145-159`

**Issue:** The nested `saveTreatmentMutation.mutate(...)` call in the `onSuccess` callback of `saveChartMutation` provides no `onError` handler. If the treatment POST fails (network error, 422, server crash), the mutation fails silently — the chart was saved (tooth state updated) but the treatment record was not created, leaving the UI in an inconsistent state with no user notification. This is a data integrity issue: the user believes they saved a treatment but no treatment exists in the backend.

```typescript
saveTreatmentMutation.mutate(
  { ... },
  {
    onSuccess: () => { /* optionally show toast */ },
    onError: (err) => {
      // surface error — "Treatment could not be saved. Chart was saved."
      console.error('Treatment save failed', err);
    },
  },
);
```

**Fix:** Add `onError` callback to the nested `saveTreatmentMutation.mutate` call. Consider also exposing `saveTreatmentMutation.isError` / `saveTreatmentMutation.error` state in the UI.

---

## Warnings

### WR-01: `isValidUniversalNumber` accepts non-integer floats — guard is incomplete

**File:** `apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts:46-48`

**Issue:** `Number.isInteger(n) && n >= 1 && n <= 32` correctly rejects floats. However the function accepts any runtime `number` — callers who pass `parseFloat(str)` on user input can pass `NaN` which satisfies none of the conditions and returns `false` (correct), but `Infinity` also returns `false` (correct). The issue is that the companion `isValidFdiNumber` uses `TOOTH_NUMBERS.includes(n)` which silently returns `false` for floats like `11.0` even though `11.0 === 11` in JS (they are equal). For floats like `11.5`, `includes` returns false correctly. However neither guard is actually called before chart/treatment saves in `$patientId.tsx` — the guards exist but are **not wired into the save path**. A caller can pass any `toothNumber` to the API.

**Fix:** Wire `isValidFdiNumber(selectedTooth)` into `handleSaveToothData` before building `updatedTeeth`, and before passing `toothNumber` to `saveTreatmentMutation.mutate`.

---

### WR-02: `surfaces` field type mismatch between `SaveTreatmentInput` and `Treatment`

**File:** `apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts:17`

**Issue:** `SaveTreatmentInput.surfaces` is typed as `string[]` (line 17), but `Treatment.surfaces` (in `use-treatments.ts`) is typed as `ToothSurface[]` and `ToothSlideoutData.surfaces` is `ToothSurface[]`. At the call site in `$patientId.tsx` (line 152), `data.surfaces` (which is `ToothSurface[]`) is passed for `surfaces: string[]`. TypeScript accepts this only if `ToothSurface` is assignable to `string`, which it likely is if `ToothSurface` is a string union — but the inconsistency is fragile and makes it unclear what the API actually accepts. If `ToothSurface` ever becomes a non-string type this silently breaks.

**Fix:** Change `SaveTreatmentInput.surfaces` to `ToothSurface[]`:

```typescript
import type { ToothSurface } from '@/features/workspace/components/five-surface-selector.helpers';

interface SaveTreatmentInput {
  ...
  surfaces: ToothSurface[];
  ...
}
```

---

### WR-03: `handleSaveToothData` skips treatment save if only `priceInput` is missing — but `cdtCode` + `description` alone are not sufficient to skip silently

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:128-135`

**Issue:** The NaN guard condition is: if `data.cdtCode && data.description && data.priceInput !== undefined && data.priceInput !== ''` — if the user enters a CDT code and description but leaves price blank, `priceAmount` stays `undefined` and the treatment is silently not saved (line 144 gate: `priceAmount !== undefined`). No error or warning is shown. A clinician who fills in CDT + description but forgets the price gets silent data loss.

**Fix:** Either require price when CDT+description are present (validate before save with user-visible error), or explicitly allow zero-price treatments:

```typescript
if (data.cdtCode && data.description) {
  const raw = data.priceInput ? parseFloat(data.priceInput) : 0;
  if (isNaN(raw) || raw < 0) {
    // surface error to user
    return;
  }
  priceAmount = raw;
}
```

---

### WR-04: `currentVisitId!` non-null assertion inside `onSuccess` callback is unsafe

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:146`

**Issue:** Inside the `saveChartMutation.mutate` `onSuccess` callback, `currentVisitId!` is asserted non-null with `!`. The callback fires asynchronously — `currentVisitId` could be set to `null` (e.g., user navigates away, visit is deleted) between the mutation firing and the callback executing. The non-null assertion bypasses TypeScript's safety check.

**Fix:** Capture `visitId` in a local variable before the async call:

```typescript
function handleSaveToothData(data: ToothSlideoutData) {
  const visitId = currentVisitId;
  if (!visitId || !selectedTooth) return;
  // ...
  saveTreatmentMutation.mutate({
    visitId,  // captured, not currentVisitId!
    ...
  });
}
```

---

### WR-05: "Continue to Payment" navigation is unconditional — navigates even when `isReadOnly && pendingCount === 0`

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:317-325`

**Issue:** The button `disabled` condition is `pendingCount === 0 && !isReadOnly`. When `isReadOnly` is true, the button is always enabled regardless of whether there are treatments to bill. Clicking "View Invoice" with zero treatments navigates to `/billing` with nothing to show. This is a logic error: `disabled={pendingCount === 0 && !isReadOnly}` should be `disabled={pendingCount === 0 && treatments.length === 0}` or similar.

**Fix:**

```typescript
disabled={!isReadOnly && pendingCount === 0}
```

This disables the button for editable visits with no pending treatments, while still allowing read-only visits with completed treatments to view the invoice.

---

## Info

### IN-01: `getToothColorClass` still uses hardcoded hex in `crown` case — not swapped to token

**File:** `apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts:123`

**Issue:** The Phase 2 task listed "Swapped bg-[#FFE97D] → bg-lemon color tokens" but `getToothColorClass` still returns `fill-[#FFE97D] text-[#4A4018]` for the `crown` case. The background class swap did not extend to this fill class. This is an inline SVG fill, not a Tailwind background, so the lemon token may not apply — but the inconsistency should be documented.

**Fix:** If the design token system supports fill classes (`fill-lemon`), use it. Otherwise document why the hardcoded hex is retained here.

---

### IN-02: `useTreatments` response normalisation is fragile

**File:** `apps/dentalemon/src/features/workspace/hooks/use-treatments.ts:44`

**Issue:** `Array.isArray(data) ? data : (data.items ?? data.data ?? [])` silently returns `[]` if the API returns an unexpected shape. This hides backend contract violations — a 200 response with unexpected JSON shape will surface as an empty treatment list with no error.

**Fix:** Add an explicit shape check or use Zod to parse the response, throwing on unexpected shape rather than returning empty.

---

### IN-03: `useEffect` dependency array omits `currentVisitId`

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:50-55`

**Issue:** The `useEffect` for auto-selecting the active visit has `[visits]` as the dependency array. `currentVisitId` is read inside the effect (line 52: `if (currentVisitId) return;`) but is not in the dependency array. React's exhaustive-deps lint rule would flag this. In practice the logic is correct because the guard only skips when `currentVisitId` is already set, but the missing dependency is a lint violation that could bite on refactor.

**Fix:**

```typescript
useEffect(() => {
  if (!visits.length) return;
  if (currentVisitId) return;
  const active = visits.find((v) => v.status === 'active');
  setCurrentVisitId((active ?? visits[0])?.id ?? null);
}, [visits, currentVisitId]);
```

---

_Reviewed: 2026-05-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
