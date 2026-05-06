---
phase: 01-mutation-hooks-dead-code
reviewed: 2026-05-06T12:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts
  - apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts
  - apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts
  - apps/dentalemon/src/features/workspace/hooks/use-share-pmd.ts
  - apps/dentalemon/src/routes/_workspace/$patientId.tsx
findings:
  critical: 3
  warning: 5
  info: 1
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-06T12:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Four mutation hooks (`useCreateVisit`, `useSaveChart`, `useSaveTreatment`, `useSharePMD`) and the `$patientId.tsx` workspace route were reviewed. Critical issues include sending empty auth-critical identifiers from localStorage, a stale closure in cache invalidation, and `as any` type casts bypassing type safety. Several warnings around missing useEffect dependencies and race conditions between parallel mutations.

## Critical Issues

### CR-01: Empty branchId/dentistMemberId sent to API from localStorage

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:76-77`
**Issue:** `handleNewVisit` reads `currentBranchId` and `currentMemberId` from `localStorage` with a fallback of `''`. If these keys are absent (first login, cleared storage, incognito), the mutation fires a POST with empty strings for required business identifiers. The server may create an orphaned visit with no branch or dentist, or silently accept bad data.
**Fix:**
```typescript
function handleNewVisit() {
  const branchId = localStorage.getItem('currentBranchId');
  const dentistMemberId = localStorage.getItem('currentMemberId');
  if (!branchId || !dentistMemberId) {
    // Surface error to user or redirect to branch selection
    console.error('Branch or member ID not set');
    return;
  }
  createVisitMutation.mutate(
    { patientId, branchId, dentistMemberId },
    { onSuccess: (visit) => setCurrentVisitId(visit.id) },
  );
}
```

### CR-02: Stale `visitId` closure in `useSaveChart` and `useSaveTreatment` cache invalidation

**File:** `apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts:34-36`
**File:** `apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts:39-41`
**Issue:** Both hooks capture `visitId` as a parameter and use it in `onSuccess` to invalidate queries. But `visitId` is `string | null` and comes from React state (`currentVisitId`). The hook instance is created with whatever value `currentVisitId` had at render time. If the user switches visits between when the mutation fires and when `onSuccess` runs, the invalidation targets the old visit's cache -- the new visit's stale data remains. More critically, if `visitId` is `null` at hook creation time, `onSuccess` invalidates `['dental-chart', null]` which is a no-op against the real query key.

Meanwhile, the `mutationFn` correctly reads `input.visitId` (the value at call time). The invalidation key should also use the input, not the closure.
**Fix:**
```typescript
// use-save-chart.ts
onSuccess: (_data, variables) => {
  queryClient.invalidateQueries({ queryKey: ['dental-chart', variables.visitId] });
},

// use-save-treatment.ts
onSuccess: (_data, variables) => {
  queryClient.invalidateQueries({ queryKey: ['dental-treatments', variables.visitId] });
},
```

### CR-03: `as any` type casts in treatment table rendering

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:249-252`
**Issue:** Four `as any` casts are used to access `cdtCode`, `procedureCode`, and `description` on treatment objects. This defeats TypeScript's type safety entirely. If the treatment type from `useTreatments` does not include these fields, this is a runtime bug hidden by the cast. If it does include them, the cast is unnecessary. Either way, this violates the project's explicit rule to "eliminate as-any casts" (commit `d8fd7ea`).
**Fix:** Update the treatment type definition returned by `useTreatments` to include all fields the UI needs (`cdtCode`, `procedureCode`, `description`), then remove all `as any` casts.

## Warnings

### WR-01: Missing `currentVisitId` in useEffect dependency array

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:55`
**Issue:** The `useEffect` that auto-selects the initial visit depends on `[visits]` but reads `currentVisitId` inside the callback. The early-return `if (currentVisitId) return;` uses a potentially stale closure value. React's exhaustive-deps rule would flag this. If `currentVisitId` changes between renders but `visits` doesn't, the effect won't re-evaluate.
**Fix:**
```typescript
useEffect(() => {
  if (!visits.length) return;
  if (currentVisitId) return;
  const active = visits.find((v) => v.status === 'active');
  setCurrentVisitId((active ?? visits[0])?.id ?? null);
}, [visits, currentVisitId]);
```

### WR-02: Race condition between saveChart and saveTreatment mutations

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:120-143`
**Issue:** `handleSaveToothData` fires `saveChartMutation.mutate()` and `saveTreatmentMutation.mutate()` in parallel (not awaited, not chained). If the chart save fails but the treatment save succeeds, the data is left in an inconsistent state: a treatment exists referencing chart data that was never persisted. There is no error handling or rollback.
**Fix:** Chain the mutations so the treatment is only saved after the chart save succeeds:
```typescript
saveChartMutation.mutate(
  { visitId: currentVisitId, patientId, teeth: updatedTeeth },
  {
    onSuccess: () => {
      clearSelection();
      if (data.cdtCode && data.description && data.priceInput) {
        saveTreatmentMutation.mutate({ /* ... */ });
      }
    },
  },
);
```

### WR-03: No error feedback to user on mutation failures

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:72-143`
**Issue:** All four mutation call sites (`handleNewVisit`, `handleSharePMD`, `handleSaveToothData` x2) have `onSuccess` handlers but no `onError` handlers. When a mutation fails, the user sees no feedback -- the UI silently does nothing. For a clinical application, silent data loss is a patient safety concern.
**Fix:** Add `onError` callbacks that show a toast or error banner to the user for each mutation call.

### WR-04: `parseFloat(data.priceInput) || 0` silently converts invalid prices to zero

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:139`
**Issue:** If a user enters non-numeric text in the price field, `parseFloat` returns `NaN`, the `||` fallback converts it to `0`, and a zero-cost treatment is silently created. For a billing-critical field, this should be validated before submission, not silently defaulted.
**Fix:** Validate the price input before calling the mutation. Reject or warn if the value is not a valid positive number.

### WR-05: `navigator.share` error silently swallowed

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:97`
**Issue:** The `.catch(() => {})` on `navigator.share()` swallows all errors including user-meaningful ones (e.g., permission denied, AbortError when user cancels is fine, but other errors are not). At minimum, `AbortError` should be filtered out and other errors logged.
**Fix:**
```typescript
navigator.share({ /* ... */ }).catch((err) => {
  if (err.name !== 'AbortError') {
    console.error('Share failed:', err);
  }
});
```

## Info

### IN-01: Hardcoded currency `'PHP'` in treatment mutation

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:140`
**Issue:** The currency is hardcoded as `'PHP'` rather than using the `CURRENCY_SYMBOL` or a currency constant from `@/constants/brand`. The footer uses `CURRENCY_SYMBOL` for display but the mutation payload uses a different source. If the brand constants change, the display and data will diverge.
**Fix:** Import and use a `CURRENCY_CODE` constant from `@/constants/brand` (or derive from existing constants).

---

_Reviewed: 2026-05-06T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
