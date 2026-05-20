# Phase 1: Treatment Table & Visit Lifecycle — Research

**Researched:** 2026-05-10
**Domain:** Workspace interactions — treatment table mutations, visit status transitions, SOAP notes
**Confidence:** HIGH (all findings verified against live codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Click price cell → `<input type="number">` in-place, saves on blur via `updateDentalTreatment`
- Dismiss: bottom-sheet or popover with short text input for reason (required, min 3 chars) → calls `updateDentalTreatment` with `status=dismissed` + `dismissReason`
- Inline notes: collapsible sub-row revealed by chevron, edits in place
- Completed treatments hidden by default, toggled by existing "View Completed (N)" button
- Dual subtotals: "This Visit: $X" and "Carried Over: $Y" above grand total
- `SoapNotesSheet.tsx` triggered via `onNotes` in WorkspaceTopBar
- 4 SOAP fields + optional free-text Notes; saves on explicit button; invalidates query on success
- `PreCompletionChecklist.tsx` dialog, Promise.all + 4 async checks, pass/warn with icons
- On confirm: `updateDentalVisit({ status: 'completed' })` via mutation
- "Lock Visit" button on completed visit cards (admin or any practitioner), single-click with confirmation
- Lock via `updateDentalVisit({ status: 'locked' })`

### Claude's Discretion
- Exact drawer vs popover for dismiss reason UI
- Whether "Complete Visit" button lives in workspace-top-bar or a dedicated area
- Exact styling of subtotal rows

### Deferred Ideas (OUT OF SCOPE)
- PendingLocksView (admin dashboard)
- Payment plans + receipt printing
- Inline treatment notes persistence to backend (treatment schema has no notes field)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TXTBL-01 | User can see separate subtotals for current visit vs carried-over treatments | `TreatmentTable` already has carried-over section; add two subtotal rows above grand total using existing `priceAmount` on treatments and `priceCents/100` on `carriedOverItems` |
| TXTBL-02 | User can inline-edit treatment price by clicking the price cell | ⚠️ BLOCKED by TypeSpec gap — `priceCents` not in `UpdateDentalTreatmentRequest`. Requires TypeSpec edit + codegen before frontend can save. |
| TXTBL-03 | User can dismiss a treatment from the table | `updateDentalTreatmentMutation` exists in SDK; send `{ status: 'dismissed', dismissReason }`. Use Radix Popover for UI. |
| TXTBL-04 | User can add/edit inline notes on a treatment row | Local state only (treatment schema has no notes field); treatment row expands with chevron. No backend call. |
| TXTBL-05 | User can toggle visibility of completed treatments | Local `useState(false)` for `showCompleted`; "View Completed (N)" button already rendered. |
| VISIT-01 | User can complete a visit (transitions status to 'completed') | `updateDentalVisitMutation` in SDK; `draft → active → completed` transition enforced by `VISIT_TRANSITIONS`. |
| VISIT-02 | Pre-completion checklist warns about missing consent, planned treatments, missing SOAP notes | Four parallel async queries via `Promise.all`; checklist dialog uses Radix Dialog. |
| VISIT-03 | User can lock a completed visit (transitions status to 'locked') | Same mutation; `completed → locked` is valid per `VISIT_TRANSITIONS`. |
| VISIT-04 | User can enter SOAP notes for a visit | `upsertVisitNotesMutation` + `getVisitNotesOptions` both exist in SDK. Sheet pattern from ConsentSheet. |
</phase_requirements>

---

## Summary

Phase 1 implements treatment table interactivity and visit lifecycle transitions. The backend is fully complete — three handlers (`updateDentalTreatment`, `updateDentalVisit`, `upsertVisitNotes`) exist and are exercised. The SDK has generated mutation options for all three (`updateDentalTreatmentMutation`, `updateDentalVisitMutation`, `upsertVisitNotesMutation`) and query options for fetching notes (`getVisitNotesOptions`). The workspace route at `apps/dentalemon/src/routes/_workspace/$patientId.tsx` orchestrates all sheets via boolean state, with `WorkspaceTopBar` already wired with `onNotes` callback.

One blocking landmine: `priceCents` is absent from `UpdateDentalTreatmentRequest` in both the TypeSpec model and generated validators. Inline price editing (TXTBL-02) cannot persist to the backend until `priceCents?: int32` is added to `UpdateDentalTreatmentRequest` in `dental-visit.tsp`, codegen is re-run, and the handler is updated to apply the patch. This must be the first task in Wave 0.

A secondary note: the treatment status enum in the backend uses `diagnosed | planned | performed | verified | dismissed` but `useTreatments` hook types it as `diagnosed | planned | in_progress | completed | cancelled` — a mismatch that will cause TypeScript errors when passing statuses. The `in_progress` / `completed` / `cancelled` values do not exist in `DentalTreatmentStatusSchema`. The hook type needs alignment with the generated schema.

**Primary recommendation:** Execute TypeSpec fix for `priceCents` first (Wave 0, task 0), then build all frontend components against the verified SDK contracts.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Inline price edit | Frontend + API | — | UI captures input; API validates and persists `priceCents` |
| Dismiss treatment | Frontend + API | — | Frontend collects reason; API enforces status transitions |
| Inline notes (local only) | Frontend | — | No backend field; local state in treatment row |
| Show/hide completed rows | Frontend | — | Pure local state, no API call |
| Dual subtotals | Frontend | — | Computed from existing query data |
| SOAP notes | Frontend + API | — | `upsertVisitNotes` POST + `getVisitNotes` GET |
| Pre-completion checklist | Frontend | API (4 async reads) | Frontend orchestrates Promise.all; each check queries an existing endpoint |
| Visit complete/lock | Frontend + API | — | `updateDentalVisit({ status })` enforced by `VISIT_TRANSITIONS` |

---

## Standard Stack

### Core (all verified in codebase)

| Library | Import Path | Purpose | Verified |
|---------|-------------|---------|---------|
| `@tanstack/react-query` | `useMutation`, `useQuery`, `useQueryClient` | Data fetching + mutation | [VERIFIED: grep codebase] |
| `@monobase/sdk-ts/generated/@tanstack/react-query` | `updateDentalTreatmentMutation`, `updateDentalVisitMutation`, `upsertVisitNotesMutation`, `getVisitNotesOptions` | Generated mutation/query options | [VERIFIED: react-query.gen.ts] |
| `@monobase/sdk-ts/generated` | `updateDentalTreatment`, `updateDentalVisit`, `upsertVisitNotes`, `getVisitNotes` | Raw fetch functions | [VERIFIED: sdk.gen.ts] |
| `@radix-ui/react-popover` | `Popover`, `PopoverTrigger`, `PopoverContent` | Dismiss-reason UI | [VERIFIED: package.json] |
| `@radix-ui/react-dialog` | `Dialog`, `DialogContent`, `DialogHeader` | PreCompletionChecklist | [VERIFIED: package.json] |
| `lucide-react` | `ChevronDown`, `CheckCircle2`, `AlertTriangle`, `XCircle` | Icons | [VERIFIED: used throughout] |

### Installation
Nothing to install — all packages already present.

---

## API Contracts (Verified)

### `PATCH /dental/visits/{visitId}/treatments/{treatmentId}`

```typescript
// UpdateDentalTreatmentBody — verified from validators.ts:16593
{
  status?: 'diagnosed' | 'planned' | 'performed' | 'verified' | 'dismissed';
  dismissReason?: string;
  toothNumber?: number;     // int
  surfaces?: ToothSurfaceCode[];
  cdtCode?: string;
  description?: string;
  conditionCode?: string;
  // ⚠️ priceCents is NOT present — must add to TypeSpec first
}
```

**Transition rules** (from `TREATMENT_TRANSITIONS`):
- `diagnosed → planned | dismissed`
- `planned → performed | dismissed`
- `performed → verified | dismissed`
- `verified → dismissed`
- `dismissed → []` (terminal)

**Dismiss path:** Handler checks `body.status === 'dismissed'` and routes to `repo.dismiss(treatmentId, reason)` — dismissReason defaults to `'Dismissed'` if omitted.

### `PATCH /dental/visits/{visitId}`

```typescript
// UpdateDentalVisitBody — verified from validators.ts:16603
{
  status?: 'draft' | 'active' | 'completed' | 'locked';
  chiefComplaint?: string;
}
```

**Transition rules** (from `VISIT_TRANSITIONS`, verified in visit.schema.ts pattern):
- `active → completed` (Complete Visit)
- `completed → locked` (Lock Visit)
- `locked` visits throw `VISIT_LOCKED` — fully immutable

**Lifecycle timestamps** set automatically by handler: `activate()`, `complete()`, `lock()` repo methods called based on target status.

### `POST /dental/visits/{visitId}/notes`

```typescript
// UpsertVisitNotesBody — verified from validators.ts:16732
{
  visitId: UUID;       // required (path param mirrors body)
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  notes?: string;
}
```

Returns 201 with `VisitNotesSchema`. Idempotent upsert — safe to call multiple times.

### `GET /dental/visits/{visitId}/notes` → `getVisitNotesOptions`

Returns `VisitNotesSchema` (same shape). Use for pre-loading SoapNotesSheet.

---

## SDK Mutation Hooks (Verified)

All three mutation options are in `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts`:

```typescript
// [VERIFIED: @tanstack/react-query.gen.ts lines 2004, 2282, 2421]

// Pattern: useMutation({ ...updateDentalTreatmentMutation() })
updateDentalTreatmentMutation(options?)  // → UseMutationOptions
updateDentalVisitMutation(options?)      // → UseMutationOptions
upsertVisitNotesMutation(options?)       // → UseMutationOptions

// Query: useQuery(getVisitNotesOptions({ path: { visitId } }))
getVisitNotesOptions(options)            // → QueryOptions
```

Usage pattern (consistent with rest of codebase):
```typescript
const queryClient = useQueryClient();
const mutation = useMutation({
  ...updateDentalTreatmentMutation(),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: listDentalTreatmentsQueryKey({ path: { visitId } }) });
  },
});
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Dismiss popover | Custom dropdown | `@radix-ui/react-popover` |
| Checklist dialog | Custom modal overlay | `@radix-ui/react-dialog` |
| API mutations | Raw `fetch()` + state | `useMutation({ ...updateDentalTreatmentMutation() })` |
| Notes query | `useEffect` + useState | `useQuery(getVisitNotesOptions(...))` |
| Sheet overlay | New fixed-div pattern | Copy ConsentSheet/LabOrdersSheet pattern exactly |
| Query invalidation | Manual refetch | `queryClient.invalidateQueries(queryKey)` |

---

## Architecture Patterns

### Sheet Pattern (from ConsentSheet / LabOrdersSheet)
```tsx
// Pattern: fixed inset-0, z-40, items-end, max-h-[75-80vh], rounded-t-2xl
// [VERIFIED: consent-sheet.tsx, lab-orders-sheet.tsx]
<div className="fixed inset-0 z-40 flex items-end" role="dialog" aria-modal="true">
  <div className="absolute inset-0 bg-black/40" onClick={onClose} />
  <div className="relative w-full max-h-[75vh] bg-background rounded-t-2xl shadow-2xl flex flex-col">
    {/* drag handle */}
    {/* header with title + close button */}
    {/* scrollable body */}
    {/* sticky footer with cancel + save */}
  </div>
</div>
```

### Inline Edit Pattern (to implement in TreatmentTable)
```tsx
// Price cell: click to enter edit mode, blur to save
const [editingId, setEditingId] = useState<string | null>(null);
const [draftPrice, setDraftPrice] = useState('');

// In price cell:
{editingId === t.id ? (
  <input
    type="number"
    autoFocus
    value={draftPrice}
    onChange={e => setDraftPrice(e.target.value)}
    onBlur={() => {
      const cents = Math.round(parseFloat(draftPrice) * 100);
      mutation.mutate({ path: { visitId: t.visitId, treatmentId: t.id }, body: { priceCents: cents } });
      setEditingId(null);
    }}
    className="w-20 text-right border rounded px-1"
  />
) : (
  <button onClick={() => { setEditingId(t.id); setDraftPrice(String(t.priceAmount ?? 0)); }}>
    {CURRENCY_SYMBOL}{(t.priceAmount ?? 0).toLocaleString(APP_LOCALE)}
  </button>
)}
```

### Dismiss Popover Pattern
```tsx
// Radix Popover — Claude's discretion: popover preferred over full sheet for brevity
<Popover>
  <PopoverTrigger asChild>
    <button>Dismiss</button>
  </PopoverTrigger>
  <PopoverContent className="w-64 p-4">
    <label className="text-xs font-semibold">Reason (required)</label>
    <input
      value={reason}
      onChange={e => setReason(e.target.value)}
      minLength={3}
      placeholder="e.g. Patient declined"
      className="w-full mt-1 border rounded px-2 py-1 text-sm"
    />
    <button
      disabled={reason.trim().length < 3}
      onClick={() => dismissMutation.mutate({ path: { visitId, treatmentId }, body: { status: 'dismissed', dismissReason: reason } })}
      className="mt-2 w-full rounded bg-destructive/10 text-destructive text-sm py-1.5 font-medium disabled:opacity-50"
    >
      Confirm Dismiss
    </button>
  </PopoverContent>
</Popover>
```

### PreCompletionChecklist Pattern
```tsx
// Promise.all of 4 async checks — checks run in parallel
const [checks, setChecks] = useState<CheckResult[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  if (!open) return;
  setLoading(true);
  Promise.all([
    checkConsentSigned(visitId),      // GET /dental/visits/{visitId}/consent-forms
    checkNoUnstartedTreatments(visitId), // GET /dental/visits/{visitId}/treatments
    checkSoapNotesPresent(visitId),    // GET /dental/visits/{visitId}/notes
    checkNoOpenLabOrders(visitId),     // GET /dental/visits/{visitId}/lab-orders
  ]).then(results => {
    setChecks(results);
    setLoading(false);
  });
}, [open, visitId]);
```

### Workspace Orchestration
`$patientId.tsx` owns all state. Pattern for new components:
1. Add `const [xOpen, setXOpen] = useState(false)` near other sheet states (line 51-60)
2. Pass handler to WorkspaceTopBar or render a button in the footer
3. Conditionally render `{currentVisitId && <XComponent open={xOpen} onClose={() => setXOpen(false)} />}` in the sheet overlays section (lines 327+)

---

## Critical Landmines

### Landmine 1: `priceCents` Missing from UpdateDentalTreatmentRequest — BLOCKS TXTBL-02
**What:** TypeSpec model `UpdateDentalTreatmentRequest` (dental-visit.tsp line 157) does not include `priceCents`. Generated validator `UpdateDentalTreatmentBody` at validators.ts:16593 confirms absence.
**Impact:** Any frontend attempt to PATCH price will send `priceCents` and the Zod validator will strip it silently (strict mode off) or error. Backend handler only patches `status | toothNumber | surfaces | cdtCode | description | conditionCode`.
**Fix required before frontend:**
1. Add `priceCents?: int32;` to `UpdateDentalTreatmentRequest` in `specs/api/src/modules/dental-visit.tsp`
2. `cd specs/api && bun run build`
3. `cd services/api-ts && bun run generate`
4. Update `updateDentalTreatment.ts` handler to apply `priceCents` patch
**This is Wave 0 task 0.**

### Landmine 2: Treatment Status Type Mismatch in `useTreatments`
**What:** `useTreatments.ts` types `Treatment.status` as `'diagnosed' | 'planned' | 'in_progress' | 'completed' | 'cancelled'`. Backend enum (treatment.schema.ts) is `'diagnosed' | 'planned' | 'performed' | 'verified' | 'dismissed'`. Values `in_progress`, `completed`, `cancelled` do not exist.
**Impact:** TypeScript will not error on the hook (it's a custom interface), but `StatusBadge` in `TreatmentTable` will render "in_progress" as gray (fallback) since no matching status. The "Mark Done" button currently calls `onMarkDone` which presumably tries to set `status: 'completed'` — this will fail the backend transition check.
**Fix:** Update `Treatment` interface in `use-treatments.ts` to match `DentalTreatmentStatusSchema`: `'diagnosed' | 'planned' | 'performed' | 'verified' | 'dismissed'`. Update `StatusBadge` to handle the real statuses.

### Landmine 3: `priceCents` vs `priceAmount` Dual Representation
**What:** `DentalTreatmentSchema` returns `priceCents: number` (integer cents). `useTreatments` maps it as `priceAmount: number` (dollars — already divided). The workspace footer does `Math.round((t.priceAmount ?? 0) * 100)` to go back to cents for payment. Carried-over items in `TreatmentTable` use `item.priceCents / 100`.
**Impact:** BFIX-01 is listed as a separate requirement. When implementing TXTBL-02, input shown to user is dollars (`priceAmount`), save must multiply by 100 to `priceCents`. Verify the `select` transform in `useTreatments` is actually dividing `priceCents` by 100 — if so, the `priceAmount` field is already in dollars. If not, there's a double-divide risk.
**Action:** Read the `select` function in `useTreatments` carefully before implementing price edit. The `Treatment` interface shows `priceAmount: number` but the raw API returns `priceCents: number` — the transform must divide by 100.

### Landmine 4: Visit Status vs Treatment Status Confusion
**What:** Visits use `draft | active | completed | locked`. Treatments use `diagnosed | planned | performed | verified | dismissed`. These are different enums. The checklist check "no unstarted/planned treatments" must query treatments and filter by `status === 'diagnosed' || status === 'planned'` — NOT by `completed`.
**Complete Visit** changes the visit status to `completed`, NOT the treatment statuses. Treatments stay at whatever status they are.

### Landmine 5: `notesSheetOpen` Currently Shows MedicalHistoryForm
**What:** In `$patientId.tsx` line 341, `onNotes` opens a sheet that renders `<MedicalHistoryForm>`, not SOAP notes. The `onNotes` callback is already wired to `setNotesSheetOpen(true)`. The new `SoapNotesSheet` must REPLACE or be added alongside this existing sheet.
**Action:** Either (a) rename/repurpose the existing notes sheet to show both SOAP + a link to medical history, or (b) add a separate `soapSheetOpen` state and a dedicated trigger. Recommend option (a) since `onNotes` is already the natural trigger — replace `MedicalHistoryForm` inside with a tabbed or stacked layout showing SOAP notes first.

---

## Common Pitfalls

### Pitfall 1: Forgetting to invalidate `listDentalTreatmentsQueryKey` after mutations
**What:** After dismiss or status update, stale treatments remain visible.
**Fix:** Always `queryClient.invalidateQueries({ queryKey: listDentalTreatmentsQueryKey({ path: { visitId } }) })` in `onSuccess`.

### Pitfall 2: Using raw fetch instead of SDK mutation options
**What:** LabOrdersSheet uses imperative `await listLabOrders(...)` with useState — marked as CFIX-03 debt. Don't repeat this pattern.
**Fix:** Use `useMutation({ ...updateDentalTreatmentMutation() })` pattern everywhere.

### Pitfall 3: Blur fires before Popover closes
**What:** Inline price input `onBlur` may fire when user clicks the Dismiss popover trigger, causing a spurious save with empty value.
**Fix:** Use `onBlur` only when `editingId` is set; add null guard before mutating.

### Pitfall 4: Completed visit read-only check
**What:** `isReadOnly = status === 'completed' || status === 'locked'`. TreatmentTable currently accepts `readOnly` prop but doesn't fully suppress interactions.
**Fix:** Pass `readOnly={isReadOnly}` to TreatmentTable and gate all edit/dismiss/notes interactions behind `!readOnly`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (`bun test`) |
| Config | `services/api-ts/bunfig.toml` (backend); no separate vitest for frontend yet |
| Quick run command | `cd services/api-ts && bun test --testPathPattern dental-visit` |
| Full suite command | `cd services/api-ts && bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Command | File Exists? |
|--------|----------|-----------|---------|--------------|
| TXTBL-01 | Subtotals render correctly | Frontend unit (component snapshot/logic) | Manual verify in browser | ❌ Wave 0 gap |
| TXTBL-02 | Price edit persists via API | Backend unit (handler test) | `bun test --testPathPattern updateDentalTreatment` | Likely ❌ (new endpoint field) |
| TXTBL-03 | Dismiss calls mutation with reason | Backend unit + frontend integration | `bun test --testPathPattern updateDentalTreatment` | ✅ handler exists |
| TXTBL-04 | Notes toggle shows sub-row | Frontend visual | Manual | ❌ Wave 0 gap |
| TXTBL-05 | Toggle completed visibility | Frontend unit | Manual | ❌ Wave 0 gap |
| VISIT-01 | Complete visit changes status | Backend handler test | `bun test --testPathPattern updateDentalVisit` | ✅ |
| VISIT-02 | Checklist shows 4 checks | Frontend integration | Manual + future E2E | ❌ Wave 0 gap |
| VISIT-03 | Lock visit changes status | Backend handler test | `bun test --testPathPattern updateDentalVisit` | ✅ |
| VISIT-04 | SOAP notes upsert | Backend handler test | `bun test --testPathPattern upsertVisitNotes` | ✅ |

### Wave 0 Gaps
- [ ] TypeSpec + codegen for `priceCents` in `UpdateDentalTreatmentRequest` — blocks TXTBL-02
- [ ] Fix `Treatment` type in `use-treatments.ts` to match real backend status enum
- [ ] Backend handler test for `updateDentalTreatment` with `priceCents` patch
- [ ] Frontend component tests for TreatmentTable interactions (if adding vitest)

---

## Environment Availability

Step 2.6: No new external dependencies. All tooling (Bun, Drizzle, Radix, TanStack Query) already present.

---

## Open Questions (RESOLVED)

1. **Does `onNotes` replace MedicalHistoryForm or add SOAP alongside it?** ✅ RESOLVED
   - **Decision:** Replace notes sheet content with SoapNotesSheet; add "View Medical History" link inside SoapNotesSheet that opens MedicalHistorySheet separately.
   - `onNotes` → opens SoapNotesSheet; MedicalHistorySheet triggered via separate link/button inside it.

2. **Which visit status can be "completed" from?** ✅ RESOLVED
   - **Decision:** Only `active → completed` is valid. "Complete Visit" button is disabled when `status !== 'active'`.

3. **PreCompletionChecklist: which endpoints serve the 4 checks?** ✅ RESOLVED
   - Consent: `listConsentFormsOptions` — **CONFIRMED in react-query.gen.ts** (exact export verified)
   - Unstarted treatments: `listDentalTreatmentsOptions` → filter client-side for `status !== 'performed' && status !== 'verified'`
   - SOAP notes: `getVisitNotesOptions` — confirmed
   - Open lab orders: `listLabOrdersOptions` → filter for non-terminal statuses
   - All four SDK exports confirmed present in `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts`

---

## Sources

### Primary (HIGH confidence)
- `services/api-ts/src/handlers/dental-visit/updateDentalTreatment.ts` — handler verified
- `services/api-ts/src/handlers/dental-visit/updateDentalVisit.ts` — handler verified
- `services/api-ts/src/handlers/dental-visit/upsertVisitNotes.ts` — handler verified
- `services/api-ts/src/generated/openapi/validators.ts` — Zod schemas verified
- `services/api-ts/src/handlers/dental-visit/repos/treatment.schema.ts` — DB schema + transitions verified
- `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` — mutation hooks verified
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx` — orchestrator verified
- `apps/dentalemon/src/features/workspace/components/consent-sheet.tsx` — sheet pattern verified
- `apps/dentalemon/src/features/workspace/components/lab-orders-sheet.tsx` — sheet pattern verified
- `specs/api/src/modules/dental-visit.tsp` — TypeSpec source verified (priceCents gap confirmed)
- `apps/dentalemon/package.json` — Radix Popover + Dialog confirmed present

---

## Metadata

**Confidence breakdown:**
- API contracts: HIGH — read from generated validators and handler source
- SDK hooks: HIGH — confirmed in react-query.gen.ts
- Landmines: HIGH — verified against actual schema files
- Sheet pattern: HIGH — two existing examples read in full
- Orchestrator wiring: HIGH — $patientId.tsx read in full

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (stable codebase, no fast-moving deps)
