<!-- oli-version: 1.1 | reviewed: 2026-05-27 | skill: oli-ui-journey | module: dental-visit -->

# Journey Coverage Report — dental-visit

**Module:** dental-visit  
**Reviewed:** 2026-05-27  
**Reviewer:** Claude (gsd-code-reviewer)  
**Depth:** deep  
**Standard:** IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md §8.3, §3.5, §3.6  
**Source files reviewed:**
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx`
- `apps/dentalemon/src/features/workspace/components/dental-chart.tsx`
- `apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts`
- `apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx`
- `apps/dentalemon/src/features/workspace/components/treatment-table.tsx`
- `apps/dentalemon/src/features/workspace/components/treatment-plan-tab.tsx`
- `apps/dentalemon/src/features/workspace/components/treatment-plans-sheet.tsx`
- `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx`
- `apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx`
- `apps/dentalemon/src/features/workspace/components/pre-completion-checklist.tsx`
- `apps/dentalemon/src/features/workspace/components/soap-notes-sheet.tsx`
- `apps/dentalemon/src/features/workspace/hooks/use-save-tooth-flow.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-mark-treatment-done.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-treatment-plan.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-visits.ts`
- `apps/dentalemon/src/features/workspace/__tests__/timeline-carousel.test.ts`
- `apps/dentalemon/src/features/workspace/__tests__/treatment-plan-tab.test.ts`

---

## Executive Summary

The dental-visit workspace implementation is structurally complete and covers the primary clinical journeys (chart entry, treatment lifecycle, SOAP notes, visit completion, timeline navigation). Several **BLOCKER-level** bugs were found: the pre-completion checklist blocks visit completion even on warnings with no reachable override path (contradicting the component's own comment and BR-014's override allowance); the dental chart has no layer-switching UI (baseline/proposed/completed layers are absent from the rendered output, violating §3.5 and §8.3 of the standard); the treatment save sequence calls `onSuccess` before the treatment mutation completes, causing silent data divergence; and the treatment-plan accept flow records no patient approval. Multiple WARNING-level gaps follow including `TreatmentTable` mutations operating on an empty `visitId`.

**V1 Readiness: ORANGE** — Core workflows are present but three V1 Required items (layer separation, treatment plan approval record, item-level plan completion) are missing, and one critical workflow is partially blocked (visit completion with warnings). Not production-safe for clinical operations without fixes.

---

## Critical Issues (BLOCKER)

### CR-01: `handleNewVisit` silently fails with no user feedback when org context is missing

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:147-159`  
**Issue:** When `branchId` or `memberId` is absent from the org context store, `handleNewVisit` logs a `console.error` and returns silently. The dentist sees nothing — no toast, no dialog, no disabled state on the button. A user clicking "New Visit" assumes the visit was created.

```ts
function handleNewVisit() {
  const { branchId: localBranchId, memberId: dentistMemberId } = useOrgContextStore.getState();
  if (!localBranchId || !dentistMemberId) {
    console.error('Cannot create visit: branchId or memberId missing from org context store');
    return; // silent failure — no user feedback
  }
  createVisitMutation.mutate(...);
}
```

**Fix:** Surface the error to the user before returning:

```ts
if (!localBranchId || !dentistMemberId) {
  // Replace with your toast/alert primitive
  alert('Branch context unavailable. Re-select your branch to create a visit.');
  return;
}
```

---

### CR-02: Pre-completion checklist disables "Complete Visit" on warnings with no override — BR-014 and WF-012 violated

**File:** `apps/dentalemon/src/features/workspace/components/pre-completion-checklist.tsx:226-228`  
**Issue:** The "Complete Visit" button is disabled when `hasWarns` is true:

```tsx
disabled={isPending || checks.length === 0 || hasWarns}
```

The component's own file header (line 6) states: *"Allows 'Complete anyway' when warns exist."* No such button or code path exists. The four checks (consent signed, no unstarted treatments, SOAP notes present, no open lab orders) are all implemented as **warnings**, not hard blocks — but the UI treats them identically to hard errors.

This violates:
- MODULE_SPEC.md §4 WF-012: the spec never mandates all four checks as blockers
- BR-014: "Dentist-Owner can override" consent requirement
- IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md §3.4: "Provider signature / finalization — V1 Recommended"

A dentist performing emergency work without a signed consent form cannot complete the visit. The only escape is to close the dialog, create and sign a consent form, and retry.

**Fix:** Add a secondary "Complete anyway" action visible only when `hasWarns && !hasErrors`:

```tsx
{!loading && (
  <div className="flex gap-2">
    <button type="button" onClick={onClose} disabled={isPending}>
      Go Back
    </button>
    {hasWarns && (
      <button
        type="button"
        onClick={handleComplete}
        disabled={isPending}
        className="flex-1 h-11 rounded-xl bg-amber-100 text-amber-800 text-sm font-semibold"
      >
        {isPending ? 'Completing…' : 'Complete anyway'}
      </button>
    )}
    {!hasWarns && (
      <button
        type="button"
        onClick={handleComplete}
        disabled={isPending || checks.length === 0}
        className="flex-1 h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold"
      >
        {isPending ? 'Completing…' : 'Complete Visit'}
      </button>
    )}
  </div>
)}
```

---

### CR-03: Dental chart has no baseline/proposed/completed layer switching — CHART-BR-001, CHART-BR-002, CHART-BR-006 violated

**File:** `apps/dentalemon/src/features/workspace/components/dental-chart.tsx:1-147`  
**Issue:** The dental chart renders a single unified tooth map. There is no layer concept in `DentalChartProps`, no layer toggle UI, and no layer-based visual differentiation. While `ToothData` has `entryClassification?: ChartEntryClassification`, this field is never read by `buildToothMap`, `getToothFillColor`, or any rendering path. It has zero effect on the output.

This violates:
- IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md §3.5 (CHART-BR-001): "Baseline chart entries must be separate from proposed and completed work" — **V1 Required**
- CHART-BR-002: "Completed work must not overwrite baseline condition" — **V1 Required**
- CHART-BR-006: "Proposed work must remain distinguishable visually and structurally" — **V1 Required**
- §8.3: "Separate layers visually — Baseline, proposed, completed should be clearly distinct" — **V1 Required**

A dentist cannot tell whether a caries indicator on tooth 14 represents an existing condition (baseline), a proposed treatment, or completed work. This is a clinical safety gap.

**Fix required:**
1. Add `layer?: 'baseline' | 'proposed' | 'completed'` to `ToothData` (or use `entryClassification`)
2. Add a layer switcher control to `DentalChart` (e.g. segmented control: Baseline | Proposed | Completed)
3. Filter displayed teeth by active layer and apply distinct visual treatment per layer (e.g. opacity 40% for non-active layers, dashed border for proposed)

---

### CR-04: `useSaveToothFlow` calls `onSuccess` before treatment save completes — silent data divergence

**File:** `apps/dentalemon/src/features/workspace/hooks/use-save-tooth-flow.ts:71-97`  
**Issue:** `onSuccess?.()` is called at line 72 immediately when the **chart** save succeeds, before the treatment mutation fires. If the treatment mutation fails (line 88-95), the only response is `console.error`. The user sees the slideout close with no indication the treatment was not recorded. The chart shows the tooth updated; the treatment table shows nothing.

```ts
saveChartMutation.mutate(
  { visitId, patientId, teeth: updatedTeeth },
  {
    onSuccess: () => {
      onSuccess?.();   // slideout closes here — treatment save has NOT started yet
      if (data.cdtCode && data.description && priceAmount !== undefined) {
        saveTreatmentMutation.mutate({ ... }, {
          onError: (err) => {
            console.error('Treatment save failed ...');
            // no user feedback
          },
        });
      }
    },
  },
);
```

**Fix:** Move `onSuccess?.()` inside the treatment save `onSuccess`, or keep the slideout open on treatment failure:

```ts
onSuccess: () => {
  if (data.cdtCode && data.description && priceAmount !== undefined) {
    saveTreatmentMutation.mutate(
      { ... },
      {
        onSuccess: () => onSuccess?.(),
        onError: (err) => {
          console.error('Treatment save failed', err);
          // parent must expose an onError prop to show inline error
        },
      },
    );
  } else {
    onSuccess?.();
  }
},
```

---

### CR-05: Treatment plan "Accept Plan" records no patient approval — TP-BR-007 violated

**File:** `apps/dentalemon/src/features/workspace/components/treatment-plan-tab.tsx:295`  
`apps/dentalemon/src/features/workspace/hooks/use-treatment-plan.ts:61-81`  

**Issue:** The "Accept Plan" button calls `acceptPlan()` with no arguments:

```tsx
onClick={() => acceptPlan()}
```

`acceptMutation` sends `POST .../treatment-plan/accept` with body `{ consentFormId: undefined }`. No patient approval date, signature, or consent form ID is captured. No role guard prevents a `staff_full` read-only user from clicking "Accept Plan" since `TreatmentPlanTab` has no `readOnly` prop.

This violates:
- IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md §3.6 TP-BR-007: "Patient approval should be recorded with date/status" — **V1 Required**
- MODULE_SPEC.md §6: plan acceptance requires `dentist_owner` or `dentist_associate`

**Fix:**
1. Add a `readOnly` prop to `TreatmentPlanTab` and hide the "Accept Plan" button for `staff_full`.
2. Before calling `acceptPlan()`, prompt for a consent form link or at minimum an acknowledgment that patient verbal approval was obtained.

---

## Warnings

### WR-01: `TreatmentTable` receives no `visitId` from parent — all inline mutations operate on empty URL path segment

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:317-326`  
`apps/dentalemon/src/features/workspace/components/treatment-table.tsx:69, 97`  

**Issue:** `TreatmentTable` is rendered without a `visitId` prop:

```tsx
<TreatmentTable
  treatments={treatments}
  carriedOverItems={carriedOverItems}
  visits={visits}
  onMarkDone={...}
  // visitId not passed
/>
```

The component defaults to `visitId = ''`. `useUpdateTreatment('')` is called, meaning every price edit, dismiss, notes update, and decline mutation fires to `PATCH /dental/visits//treatments/:id` — an invalid URL. These mutations will 404 or silently fail.

**Fix:** Pass `visitId={currentVisitId ?? undefined}` from `$patientId.tsx` to `TreatmentTable`. Add a guard in `TreatmentTable` before mounting `useUpdateTreatment`:

```ts
if (!visitId) {
  // mutations disabled when visitId absent — render read-only
}
```

---

### WR-02: Carousel `activeIndex` state not synced when `visits` prop grows (new visit added)

**File:** `apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx:153-154`  
**Issue:** `initialSlide` is computed per render and used to initialize `useState`. When a new visit is created and `visits` grows from N to N+1, `sorted` changes length but `activeIndex` stays at the old value. Swiper only respects `initialSlide` on mount. After `handleNewVisit` creates a visit and the parent sets `currentVisitId` to the new visit, the carousel's active visual indicator (yellow border, accent bar) still shows the old slide.

**Fix:** Pass `currentVisitId` as a prop to `TimelineCarousel` (it is already in the signature but unused by `VisitChartCard`). Inside the component, derive `activeIndex` from the sorted position of `currentVisitId` and use Swiper's imperative `slideTo` via a `useEffect` when the derived index changes:

```ts
useEffect(() => {
  const idx = sorted.findIndex(v => v.id === currentVisitId);
  if (idx >= 0 && idx !== activeIndex) {
    setActiveIndex(idx);
    swiperRef.current?.slideTo(idx);
  }
}, [currentVisitId, sorted]);
```

---

### WR-03: `TreatmentTable` `markDoneErrorId` tracks the clicked row before mutation outcome — error shown under wrong row on rapid clicks

**File:** `apps/dentalemon/src/features/workspace/components/treatment-table.tsx:232-234`  
**Issue:** `setMarkDoneErrorId(t.id)` fires on button click before the mutation settles. If a second "Mark Done" is clicked before the first resolves, `markDoneErrorId` shifts to the second treatment ID. When the first mutation fails, `isMarkDoneError` is true but the error renders under the second treatment row.

**Fix:** Track errors per-treatment-ID using a `Record<string, string | null>` in component state, populated in `onError` callback. Remove the global `markDoneErrorId` approach.

---

### WR-04: `TreatmentTable` has `'declined'` status but `useMarkTreatmentDone` type does not include it — type inconsistency, FSM divergence

**File:** `apps/dentalemon/src/features/workspace/components/treatment-table.tsx:44-58`  
`apps/dentalemon/src/features/workspace/hooks/use-mark-treatment-done.ts:16`  

**Issue:** `StatusBadge` handles `'declined'` status. The `TreatmentStatus` union in `useMarkTreatmentDone` is `'diagnosed' | 'planned' | 'performed' | 'verified' | 'dismissed'` — no `'declined'`. MODULE_SPEC §8 state machine also omits `'declined'`. Two parallel dismissal paths ("Dismiss" → `dismissed`, "Decline" → `declined`) exist with overlapping semantics. The `declined` status is also used in `TreatmentPlanTab` as informed refusal.

**Fix:** Decide whether `declined` is a first-class FSM state (add to MODULE_SPEC, `useMarkTreatmentDone`, and all state guards) or consolidate with `dismissed` (single path with a `reason` + `refusalType` field).

---

### WR-05: `PreCompletionChecklist` consent check passes if ANY consent is signed — not scoped to current visit's procedures

**File:** `apps/dentalemon/src/features/workspace/components/pre-completion-checklist.tsx:38-46`  
**Issue:** `checkConsentSigned` passes if `items.some(f => f.signed)` is true for any consent form on the visit. A general consent signed at patient registration (if linked to the visit) permanently satisfies this check for every subsequent visit. The check does not validate that the consent covers the treatments performed in this visit.

**Fix:** At minimum, check that a consent was signed at or after the visit's `activatedAt` timestamp. Ideally, verify consent is linked to specific CDT codes or treatment items.

---

### WR-06: `SoapNotesSheet` "Discard" closes without confirmation — unsaved clinical notes silently lost

**File:** `apps/dentalemon/src/features/workspace/components/soap-notes-sheet.tsx:452-456`  
**Issue:** "Discard" calls `onClose()` directly. If a dentist has typed SOAP notes and mis-clicks Discard, all content is lost with no recovery path (notes are not auto-saved).

```tsx
<button type="button" onClick={onClose}>Discard</button>
```

**Fix:**

```tsx
function handleDiscard() {
  const isDirty = Object.values(form).some(v => v.trim().length > 0);
  if (isDirty && !window.confirm('Discard unsaved SOAP notes?')) return;
  onClose();
}
```

---

### WR-07: `TreatmentPlansSheet` transitions plan status at plan level — no item-level completion path — TP-BR-005 violated

**File:** `apps/dentalemon/src/features/workspace/components/treatment-plans-sheet.tsx:29-36, 100-119`  
**Issue:** The FSM buttons (`Present`, `Approve`, `Start`, `Complete`, `Cancel`) transition the entire plan document's status. There is no UI for completing individual plan items. Per TP-BR-005: "Completing one item must not automatically complete the whole plan unless all items are completed." The "Complete" button sets the plan to `completed` regardless of how many items have actually been performed.

**Fix (design decision required):** Either (a) make plan status read-only (driven automatically from item completion counts), or (b) add item-level completion tracking inside `TreatmentPlansSheet`, or (c) document that the plan-level buttons are intentional manual overrides with a warning label.

---

### WR-08: Carousel fires `onSelectVisit` on initial render via `handleSlideChange` — races with `useEffect` visit auto-selection

**File:** `apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx:156-162`  
`apps/dentalemon/src/routes/_workspace/$patientId.tsx:94-99`  

**Issue:** Swiper fires `onSlideChange` on mount when `initialSlide > 0`, triggering `handleSlideChange` which calls `onSelectVisit`. Meanwhile, the parent's `useEffect` at line 94-99 also calls `setCurrentVisitId` when visits load. Both run in the same render cycle, causing two competing state updates for `currentVisitId`. In practice the `useEffect` wins (runs after render), but the carousel callback fires with a visit ID that may differ from what the `useEffect` selects (e.g. if an `active` visit exists at a non-last position).

**Fix:** Guard the carousel callback to avoid firing when the new ID matches the current one:

```ts
function handleSlideChange(swiper: { activeIndex: number }) {
  const idx = swiper.activeIndex;
  setActiveIndex(idx);
  const visit = sorted[idx];
  // only notify parent if the visit actually changed
  if (visit && visit.id !== currentVisitId) onSelectVisit(visit.id);
}
```

`currentVisitId` must be added as a prop to `TimelineCarousel` for this guard.

---

## Info

### IN-01: `TreatmentPlanTab` hardcodes `₱` currency symbol instead of using `CURRENCY_SYMBOL` constant

**File:** `apps/dentalemon/src/features/workspace/components/treatment-plan-tab.tsx:93`  
Should import and use `CURRENCY_SYMBOL` from `@/constants/brand`, matching all other workspace components.

---

### IN-02: `TreatmentPlansSheet` formats currency as USD with `en-US` locale

**File:** `apps/dentalemon/src/features/workspace/components/treatment-plans-sheet.tsx:93`  
```tsx
.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
```
Should use `APP_LOCALE` and the app currency constant.

---

### IN-03: Dental chart legend omits `implant` and `watchlist` states — teeth with these states not filterable

**File:** `apps/dentalemon/src/features/workspace/components/dental-chart.tsx:112-143`  
`ToothState` has 9 values; the legend only shows 7. `implant` and `watchlist` can appear on teeth but cannot be toggled via the filter legend.

---

### IN-04: `ToothSlideout` Save button enabled when `entryClassification` is set but `handleSave` guard silently no-ops

**File:** `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx:198-200, 461`  
Save button: `disabled={saving || (!primaryState && !entryClassification)}` — enabled if either is set.  
`handleSave`: `if (!primaryState) return;` — blocks save if `primaryState` is empty, ignoring `entryClassification`.  
A user setting only `entryClassification` sees the button enabled but clicking it silently does nothing.

---

### IN-05: `$patientId.test.ts` tests only raw source text — not rendering, hooks, or behavior

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.test.ts`  
All assertions use `.toContain()` on the raw TSX file text. These are static-analysis assertions disguised as unit tests. They provide zero coverage of runtime behavior, hook wiring, or component correctness.

---

### IN-06: Six key carousel tests permanently skipped via `skipMockDependent` alias

**File:** `apps/dentalemon/src/features/workspace/__tests__/timeline-carousel.test.ts:11`  
`skipMockDependent = test.skip` — six tests covering initialSlide, slide change callbacks, and DentalChart rendering are permanently disabled. These cover core WF-034 behaviors. No plan to enable them is documented.

---

### IN-07: `handleNewVisit` mixes reactive selectors and imperative `getState()` for the same store

**File:** `apps/dentalemon/src/routes/_workspace/$patientId.tsx:79-82, 147`  
`branchId` and `memberId` are read via reactive selectors at lines 79-82 and also via `getState()` inside `handleNewVisit`. The pattern is inconsistent and confusing for maintainers. Standardize on reactive selectors or explicitly document the dual-access pattern.

---

## Workflow Coverage Matrix

| Workflow | ID | Status | Notes |
|---|---|---|---|
| Open workspace | WF-008 | COVERED | Route renders, visits load, chart loads |
| Chart entry (condition/treatment) | WF-009 | PARTIAL | CR-03: no layer separation |
| Mark treatment as performed | WF-010 | COVERED | Two-step FSM correct |
| SOAP notes authoring | WF-011 | COVERED | Sign/lock/addendum all present |
| Complete visit | WF-012 | PARTIAL | CR-02: no warning override path |
| Initialize dentition | WF-032 | NOT COVERED | No dentition init UI in workspace |
| Carry-over display | WF-033 | COVERED | TreatmentTable carried-over section |
| Timeline carousel navigation | WF-034 | COVERED | Swiper coverflow; WR-02 sync gap |
| Create visit from workspace (+) | WF-045 | COVERED | CR-01: silent failure on missing context |
| Treatment plan presentation | WF-048 | PARTIAL | CR-05: no approval record |
| Treatment plan item completion | WF-049/050 | PARTIAL | WR-07: plan-level only, no item-level |

---

## Business Rule Coverage Matrix

| Rule ID | Rule | UI Coverage | Status |
|---|---|---|---|
| BR-001 | No concurrent active visits | Server-enforced; no client recovery UX | NOT COVERED in UI |
| BR-002 | Visit transitions linear | Complete Visit button disabled when not active | COVERED |
| BR-003 | Visit immutable after completed | isReadOnly flag, slideout readOnly | COVERED |
| BR-006 | Treatment forward-only | useMarkTreatmentDone two-step | COVERED |
| BR-007 | Completed treatment immutable | readOnly price edit guard | COVERED |
| BR-008 | Carry-over display | TreatmentTable section | COVERED |
| BR-014 | Consent before treatment | Pre-completion checklist warn (CR-02: no override) | PARTIAL |
| CHART-BR-001 | Baseline separate from proposed/completed | No layer UI | NOT COVERED |
| CHART-BR-002 | Completed work does not overwrite baseline | No layer tracking | NOT COVERED |
| CHART-BR-006 | Proposed work visually distinct | No layer UI | NOT COVERED |
| TP-BR-004 | Approved items become completed procedures | Item-level completion absent | PARTIAL |
| TP-BR-005 | One item completion does not complete whole plan | Plan-level buttons only — WR-07 | NOT COVERED |
| TP-BR-007 | Patient approval recorded with date/status | Not captured — CR-05 | NOT COVERED |

---

## V1 Readiness Rating: ORANGE

Core workflows are structurally present. Three V1 Required items from IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD §3.5 and §8.3 are not implemented (chart layer separation, treatment plan patient approval record, item-level plan completion). One critical WF-012 path is blocked (visit completion with any warning). These must be resolved before clinical production use.

**Prioritized fixes:**

| Priority | Finding | Effort |
|---|---|---|
| P0 | CR-03: Chart layer separation | High — new UI + data model |
| P0 | CR-02: Visit completion override path | Low — add one button |
| P0 | WR-01: TreatmentTable missing visitId | Low — one prop pass |
| P1 | CR-04: onSuccess order in save flow | Medium — refactor callback chain |
| P1 | CR-05: Treatment plan approval record | Medium — UI + API body |
| P1 | WR-02: Carousel activeIndex sync | Low — useEffect + swiperRef |
| P2 | CR-01: New visit silent failure | Low — add user feedback |
| P2 | WR-06: SOAP Discard without confirmation | Low — add dirty check |
| P2 | WR-07: Plan-level vs item-level FSM | High — design decision |

---

_Reviewed: 2026-05-27_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_
