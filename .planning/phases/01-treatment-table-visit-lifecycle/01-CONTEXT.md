# Phase 1: Treatment Table & Visit Lifecycle - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Practitioner can interact with treatment table (inline price edit, dismiss, notes, toggle completed) and complete/lock visits with SOAP notes and a pre-completion safety checklist. All state persists to the backend via existing API handlers. No new database schema changes required.

</domain>

<decisions>
## Implementation Decisions

### Treatment Table Interactions
- Click price cell → shows `<input type="number">` in-place, saves on blur via `updateDentalTreatment`
- Dismiss: bottom-sheet or popover with short text input for reason (required, min 3 chars) → calls `updateDentalTreatment` with status=dismissed + dismissReason
- Inline notes: collapsible sub-row revealed by chevron in the row, edits in place
- Completed treatments hidden by default, toggled by the existing "View Completed (N)" button (add local state to actually hide/show rows)

### Dual Totals Display
- Show two subtotal rows: "This Visit: $X" and "Carried Over: $Y" above the existing grand total row
- Carried-over subtotal computed from carriedOverItems prop

### SOAP Notes Sheet
- New `SoapNotesSheet.tsx` component triggered via `onNotes` callback in WorkspaceTopBar
- Loads existing notes via TanStack Query + visitNotes GET endpoint
- 4 fields: Subjective, Objective, Assessment, Plan (plus optional free-text Notes)
- Saves via useMutation on explicit "Save Notes" button; invalidates query on success

### Pre-Completion Checklist
- `PreCompletionChecklist.tsx` dialog triggered by "Complete Visit" button
- Uses Promise.all + 4 skeleton-loaded async checks: (1) consent signed, (2) no unstarted/planned treatments, (3) SOAP notes present, (4) no open lab orders
- Shows pass/warn per check with icons; user can "Complete anyway" to bypass warnings
- On confirm: calls `updateDentalVisit({ status: 'completed' })` via mutation

### Visit Lock
- "Lock Visit" button appears on completed visit cards in carousel (admin only or any practitioner)
- Single-click with confirmation → `updateDentalVisit({ status: 'locked' })`
- Locked cards become fully read-only

### Claude's Discretion
- Exact drawer vs popover choice for dismiss reason UI
- Whether "Complete Visit" button lives in workspace-top-bar or a dedicated area
- Exact styling of subtotal rows

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TreatmentTable` (`treatment-table.tsx`) — has `onMarkDone` prop, grand total row, carried-over section; needs inline edit + dismiss + notes toggle + subtotals
- `useVisits` (`use-visits.ts`) — TanStack Query, returns visits + activeVisit
- `useTreatments` (`use-treatments.ts`) — TanStack Query, returns treatments per visitId
- `WorkspaceTopBar` (`workspace-top-bar.tsx`) — has `onNotes` callback ready; existing `IconButton` component
- `AttachmentsSheet`, `ConsentSheet`, `LabOrdersSheet` — Sheet component patterns to follow for SoapNotesSheet
- `VisitNotesRepository.upsert()` — backend upsert already implemented
- `TreatmentRepository.dismiss()` / `updateStatus()` — backend already handles dismiss + status updates

### Established Patterns
- TanStack Query for all data fetching (useQuery + listDentalXxxOptions)
- useMutation + query invalidation for all writes
- Sheet components: trigger button → Sheet/Drawer overlay with form
- `priceCents` in DB, divide by 100 for display, multiply by 100 on save
- State decisions from STATE.md: PreCompletionChecklist uses Promise.all + skeletons; visit complete/lock via `updateDentalVisit({ status })`

### Integration Points
- `updateDentalTreatment.ts` handler — exists, accepts status + dismissReason + priceCents patch
- `updateDentalVisit.ts` handler — exists, accepts status transition
- `upsertVisitNotes.ts` handler — exists, upserts S/O/A/P notes
- SDK: mutation hooks need to be found or built via `useMutation` wrapping the generated fetch functions

</code_context>

<specifics>
## Specific Ideas

- No specific references — open to standard approaches
- Price note from existing code: `priceInput` is raw string (e.g. "1500"), backend stores as cents. BFIX-01 (Phase 3) notes the ×100 mismatch — be consistent here.

</specifics>

<deferred>
## Deferred Ideas

- PendingLocksView (admin dashboard) — deferred post-MVP per STATE.md decision
- Payment plans + receipt printing — deferred per STATE.md decision
- Inline treatment notes persistence to backend (treatment schema has no notes field) — noted as TODO in existing code

</deferred>
