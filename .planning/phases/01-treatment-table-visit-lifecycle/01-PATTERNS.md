# Phase 1: Treatment Table & Visit Lifecycle — Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 9
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `treatment-table.tsx` (modify) | component | CRUD + event-driven | `treatment-table.tsx` itself | self |
| `soap-notes-sheet.tsx` (new) | component | request-response | `consent-sheet.tsx` | exact |
| `pre-completion-checklist.tsx` (new) | component | request-response | `lab-orders-sheet.tsx` (multi-fetch pattern) | role-match |
| `use-update-treatment.ts` (new) | hook | CRUD | `use-create-visit.ts` | exact |
| `use-update-visit.ts` (new) | hook | CRUD | `use-create-visit.ts` | exact |
| `use-visit-notes.ts` (new) | hook | request-response | `use-visits.ts` + `use-treatments.ts` | exact |
| `workspace-top-bar.tsx` (modify) | component | event-driven | `workspace-top-bar.tsx` itself | self |
| `dental-visit.tsp` (modify) | config | — | `dental-visit.tsp` itself (lines 157-165) | self |
| `updateDentalTreatment.ts` handler (modify) | service | CRUD | existing handler pattern | self |

---

## Pattern Assignments

### `soap-notes-sheet.tsx` (component, request-response)

**Analog:** `apps/dentalemon/src/features/workspace/components/consent-sheet.tsx`

**Imports pattern** (consent-sheet.tsx lines 9-11):
```typescript
import React, { useState, useRef, useEffect } from 'react';
import { createConsentForm, signConsentForm } from '@monobase/sdk-ts/generated';
```

For SoapNotesSheet use:
```typescript
import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { upsertVisitNotesMutation, getVisitNotesOptions, getVisitNotesQueryKey } from '@monobase/sdk-ts/generated/react-query';
```

**Props interface pattern** (consent-sheet.tsx lines 20-26):
```typescript
export interface ConsentSheetProps {
  visitId: string;
  patientId: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}
```

**Sheet overlay structure** (consent-sheet.tsx lines 123-134):
```typescript
if (!open) return null;
return (
  <div
    className="fixed inset-0 z-40 flex items-end"
    role="dialog"
    aria-modal="true"
    aria-label="..."
  >
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div
      data-testid="..."
      className="relative w-full max-h-[80vh] bg-background rounded-t-2xl shadow-2xl flex flex-col"
    >
```

**Drag handle + header pattern** (consent-sheet.tsx lines 136-149):
```typescript
      <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
        <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
      </div>
      <div className="flex items-center justify-between px-5 pb-3 border-b flex-shrink-0">
        <h2 className="text-base font-semibold">SOAP Notes</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close SOAP notes"
          className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
        >
          ✕
        </button>
      </div>
```

**Scrollable body pattern** (consent-sheet.tsx line 152):
```typescript
<div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
```

**Input field pattern** (consent-sheet.tsx lines 161-177 — label style):
```typescript
<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="soap-subjective">
  Subjective
</label>
<textarea
  id="soap-subjective"
  className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-[#FFE97D] outline-none resize-none"
  rows={3}
/>
```

**Sticky footer with cancel + save** (consent-sheet.tsx lines 224-241):
```typescript
<div className="flex items-center gap-2 px-5 py-4 border-t flex-shrink-0">
  <button
    type="button"
    onClick={onClose}
    className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
  >
    Cancel
  </button>
  <button
    type="button"
    onClick={handleSave}
    disabled={saving}
    aria-label="Save SOAP notes"
    className="flex-1 h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50"
  >
    {saving ? 'Saving…' : 'Save Notes'}
  </button>
</div>
```

**Reset on close pattern** (consent-sheet.tsx lines 38-48):
```typescript
useEffect(() => {
  if (!open) {
    // reset all local state here
    setForm({ subjective: '', objective: '', assessment: '', plan: '', notes: '' });
    setError('');
  }
}, [open]);
```

---

### `pre-completion-checklist.tsx` (component, request-response)

**Analog:** `apps/dentalemon/src/features/workspace/components/lab-orders-sheet.tsx` (multi-fetch + Dialog pattern)

**Sheet vs Dialog:** Use Radix Dialog (not sheet overlay) since this is a blocking confirmation. But structure the inner content following the sheet body/footer conventions.

**Multi-fetch on open pattern** (lab-orders-sheet.tsx lines 71-79 — adapted):
```typescript
// useEffect triggered when open=true, runs Promise.all
useEffect(() => {
  if (!open) return;
  setLoading(true);
  setChecks([]);
  Promise.all([
    checkConsentSigned(visitId),
    checkNoUnstartedTreatments(visitId),
    checkSoapNotesPresent(visitId),
    checkNoOpenLabOrders(visitId),
  ]).then((results) => {
    setChecks(results);
    setLoading(false);
  });
}, [open, visitId]);
```

**Loading/skeleton pattern** (lab-orders-sheet.tsx line 231):
```typescript
{loading && <p className="text-sm text-muted-foreground text-center py-4">Running checks…</p>}
```

**Error banner pattern** (consent-sheet.tsx lines 153-157):
```typescript
{error && (
  <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
    {error}
  </div>
)}
```

**CTA button pattern — destructive bypass** (consent-sheet.tsx footer, adapted):
```typescript
<button
  type="button"
  onClick={handleCompleteAnyway}
  className="flex-1 h-11 rounded-xl border border-destructive/40 text-destructive text-sm hover:bg-destructive/10 transition-colors"
>
  Complete anyway
</button>
<button
  type="button"
  onClick={handleConfirm}
  disabled={confirming || hasBlockingFailure}
  className="flex-1 h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50"
>
  {confirming ? 'Completing…' : 'Complete Visit'}
</button>
```

---

### `use-update-treatment.ts` (hook, CRUD)

**Analog:** `apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts`

**Full hook pattern** (use-create-visit.ts lines 8-42):
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDentalTreatmentMutation, listDentalTreatmentsQueryKey } from '@monobase/sdk-ts/generated/react-query';

export function useUpdateTreatment(visitId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    ...updateDentalTreatmentMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listDentalTreatmentsQueryKey({ path: { visitId } }),
      });
    },
  });
}
```

**Key difference from use-create-visit.ts:** Use spread `...updateDentalTreatmentMutation()` instead of hand-rolling `mutationFn`. The generated mutation options already wrap the fetch call (react-query.gen.ts lines 2421-2433).

**Call site pattern:**
```typescript
mutation.mutate({
  path: { visitId, treatmentId: t.id },
  body: { status: 'dismissed', dismissReason: reason },
});
```

---

### `use-update-visit.ts` (hook, CRUD)

**Analog:** `apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts`

**Pattern** (same structure, different SDK function):
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDentalVisitMutation, listDentalVisitsQueryKey } from '@monobase/sdk-ts/generated/react-query';

export function useUpdateVisit(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    ...updateDentalVisitMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listDentalVisitsQueryKey({ query: { patientId } }),
      });
    },
  });
}
```

**Call site pattern:**
```typescript
mutation.mutate({
  path: { visitId },
  body: { status: 'completed' },
});
```

---

### `use-visit-notes.ts` (hook, request-response)

**Analog:** `apps/dentalemon/src/features/workspace/hooks/use-visits.ts` (query) + `use-create-visit.ts` (mutation)

**Query half** (use-visits.ts lines 9-54 — adapted):
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getVisitNotesOptions,
  getVisitNotesQueryKey,
  upsertVisitNotesMutation,
} from '@monobase/sdk-ts/generated/react-query';

export function useVisitNotes(visitId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    ...getVisitNotesOptions({ path: { visitId: visitId as string } }),
    enabled: !!visitId,
  });

  const mutation = useMutation({
    ...upsertVisitNotesMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getVisitNotesQueryKey({ path: { visitId: visitId as string } }),
      });
    },
  });

  return {
    notes: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    save: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
```

---

### `treatment-table.tsx` modifications (component, CRUD)

**Self-analog:** `apps/dentalemon/src/features/workspace/components/treatment-table.tsx`

**Existing state pattern to add at top of component:**
```typescript
// Add inside TreatmentTable component body
const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
const [draftPrice, setDraftPrice] = useState('');
const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
const [showCompleted, setShowCompleted] = useState(false);
```

**Existing "View Completed" button** (treatment-table.tsx lines 78-85) — add onClick:
```typescript
<button
  type="button"
  data-testid="view-completed-btn"
  onClick={() => setShowCompleted(v => !v)}
  className="text-xs text-muted-foreground hover:text-foreground"
>
  {showCompleted ? 'Hide Completed' : `View Completed (${completedCount})`}
</button>
```

**Inline price edit — replace price cell** (treatment-table.tsx lines 142-145):
```typescript
<td className="px-4 py-2 text-right tabular-nums">
  {!readOnly && editingPriceId === t.id ? (
    <input
      type="number"
      autoFocus
      value={draftPrice}
      onChange={e => setDraftPrice(e.target.value)}
      onBlur={() => {
        if (editingPriceId && draftPrice !== '') {
          const cents = Math.round(parseFloat(draftPrice) * 100);
          onUpdatePrice?.(t.id, t.visitId, cents);
        }
        setEditingPriceId(null);
      }}
      onKeyDown={e => { if (e.key === 'Escape') setEditingPriceId(null); }}
      className="w-20 text-right border rounded px-1 text-sm bg-background focus:border-[#FFE97D] outline-none"
    />
  ) : (
    <button
      type="button"
      disabled={readOnly}
      onClick={() => { setEditingPriceId(t.id); setDraftPrice(String(t.priceAmount ?? 0)); }}
      className="tabular-nums hover:underline disabled:cursor-default"
    >
      {CURRENCY_SYMBOL}{(t.priceAmount ?? 0).toLocaleString(APP_LOCALE)}
    </button>
  )}
</td>
```

**Dual subtotal rows — insert before grand total** (treatment-table.tsx lines 199-210):
```typescript
{/* This Visit subtotal */}
<tr className="border-t border-border/40">
  <td colSpan={6} className="px-4 py-1.5 text-right text-xs text-muted-foreground">
    This Visit
  </td>
  <td className="px-4 py-1.5 text-right tabular-nums text-xs text-muted-foreground">
    {CURRENCY_SYMBOL}{grandTotal.toLocaleString(APP_LOCALE)}
  </td>
</tr>
{carriedOverItems.length > 0 && (
  <tr>
    <td colSpan={6} className="px-4 py-1.5 text-right text-xs text-muted-foreground">
      Carried Over
    </td>
    <td className="px-4 py-1.5 text-right tabular-nums text-xs text-muted-foreground">
      {CURRENCY_SYMBOL}
      {carriedOverTotal.toLocaleString(APP_LOCALE)}
    </td>
  </tr>
)}
```

**StatusBadge fix** — update to real statuses (treatment-table.tsx lines 34-50):
```typescript
// Replace status === 'completed' → 'performed' | 'verified'
// Replace status === 'in_progress' → remove (doesn't exist)
// Add 'dismissed' → gray/muted style
```

---

### `workspace-top-bar.tsx` modifications (component, event-driven)

**Self-analog:** `apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx`

**Add new props to interface** (workspace-top-bar.tsx lines 16-27):
```typescript
interface WorkspaceTopBarProps {
  // ... existing props ...
  onCompleteVisit: () => void;
  visitStatus?: 'draft' | 'active' | 'completed' | 'locked';
}
```

**IconButton pattern to copy for Complete Visit button** (workspace-top-bar.tsx lines 28-50):
```typescript
// Complete Visit — add in RIGHT section alongside existing icon buttons
// Use CheckCircle2 from lucide-react
<IconButton
  label="Complete visit"
  onClick={onCompleteVisit}
  disabled={visitStatus !== 'active'}
>
  <CheckCircle2 className="h-4 w-4" />
</IconButton>
```

**Landmine 5 fix note:** `onNotes` (line 153) currently opens `notesSheetOpen` which renders `MedicalHistoryForm`. Replace that sheet's content with `SoapNotesSheet`. In `$patientId.tsx` line 341 area, swap out the `MedicalHistoryForm` render for `SoapNotesSheet`.

---

### `specs/api/src/modules/dental-visit.tsp` modification

**Self-analog:** `dental-visit.tsp` lines 157-165 (the gap to fill)

**Current state (lines 157-165):**
```
model UpdateDentalTreatmentRequest {
  status?: DentalTreatmentStatus;
  dismissReason?: string;
  toothNumber?: int32;
  surfaces?: ToothSurfaceCode[];
  cdtCode?: string;
  description?: string;
  conditionCode?: string;
}
```

**Required change — add one line before closing brace:**
```
  priceCents?: int32;
```

**Reference pattern:** `CreateDentalTreatmentRequest` at lines 149-155 already has `priceCents: int64` — use `int32` for patch (matches existing validator type conventions in the file).

**Post-edit commands:**
```bash
cd /Users/eladventures/Desktop/dentalemon/specs/api && bun run build
cd /Users/eladventures/Desktop/dentalemon/services/api-ts && bun run generate
```

---

### `services/api-ts/src/handlers/dental-visit/updateDentalTreatment.ts` modification

**Self-analog:** existing handler

**Pattern to follow:** Add `priceCents` to the patch block after codegen regenerates the validator. The handler already has a conditional patch pattern — find the existing field assignments and add:
```typescript
if (body.priceCents !== undefined) {
  updates.priceCents = body.priceCents;
}
```

---

## Shared Patterns

### Sheet Overlay Structure
**Source:** `apps/dentalemon/src/features/workspace/components/consent-sheet.tsx` lines 123-243
**Apply to:** `soap-notes-sheet.tsx`

```typescript
// Outer: fixed inset-0 z-40 flex items-end
// Backdrop: absolute inset-0 bg-black/40 onClick={onClose}
// Panel: relative w-full max-h-[80vh] bg-background rounded-t-2xl shadow-2xl flex flex-col
// Drag handle: w-9 h-1 bg-muted-foreground/30 rounded-full
// Header: flex items-center justify-between px-5 pb-3 border-b flex-shrink-0
// Body: flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4
// Footer: flex items-center gap-2 px-5 py-4 border-t flex-shrink-0
```

### TanStack Query Mutation Hook
**Source:** `apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts` lines 8-42
**Apply to:** `use-update-treatment.ts`, `use-update-visit.ts`, `use-visit-notes.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { <generatedMutationFn>, <listQueryKey> } from '@monobase/sdk-ts/generated/react-query';

export function useXxx(...) {
  const queryClient = useQueryClient();
  return useMutation({
    ...<generatedMutationFn>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: <listQueryKey>(...) });
    },
  });
}
```

### TanStack Query Hook (read)
**Source:** `apps/dentalemon/src/features/workspace/hooks/use-visits.ts` lines 9-54
**Apply to:** query half of `use-visit-notes.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { <queryOptions> } from '@monobase/sdk-ts/generated/react-query';

const query = useQuery({
  ...<queryOptions>({ path: { ... } }),
  enabled: !!id,
});
```

### Primary CTA Button Style
**Source:** `consent-sheet.tsx` line 237, `lab-orders-sheet.tsx` line 222
**Apply to:** all save/confirm buttons in new components

```typescript
className="flex-1 h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50"
```

### Input / Textarea Field Style
**Source:** `lab-orders-sheet.tsx` line 186, `consent-sheet.tsx` line 170
**Apply to:** all form inputs in SoapNotesSheet, dismiss popover

```typescript
className="w-full h-10 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
// textarea: add resize-none, remove h-10, add rows={N}
```

### Label Style
**Source:** `consent-sheet.tsx` line 161
**Apply to:** all field labels

```typescript
className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block"
```

### Query Invalidation on Mutation Success
**Source:** `use-create-visit.ts` lines 36-40
**Apply to:** ALL mutation hooks

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({
    queryKey: listDentalTreatmentsQueryKey({ path: { visitId } }),
  });
},
```

---

## No Analog Found

None — all new files have close analogs in the codebase.

---

## Critical Pre-Conditions (Wave 0)

Before any frontend work on TXTBL-02 (inline price edit):

1. Add `priceCents?: int32;` to `UpdateDentalTreatmentRequest` in `specs/api/src/modules/dental-visit.tsp` (line 164, before closing brace)
2. Run `cd specs/api && bun run build`
3. Run `cd services/api-ts && bun run generate`
4. Update handler to apply `priceCents` patch
5. Fix `Treatment` interface in `use-treatments.ts` — change status type from `'diagnosed' | 'planned' | 'in_progress' | 'completed' | 'cancelled'` to `'diagnosed' | 'planned' | 'performed' | 'verified' | 'dismissed'`

---

## Metadata

**Analog search scope:** `apps/dentalemon/src/features/workspace/`, `packages/sdk-ts/src/generated/`, `specs/api/src/modules/`
**Files scanned:** 10
**Pattern extraction date:** 2026-05-10
