# Phase 2: Clinical Sheet Fixes - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — issues visible in code, no grey areas)

<domain>
## Phase Boundary

Fix 3 specific issues in consent-sheet.tsx and lab-orders-sheet.tsx:
1. CFIX-01: `(form as any).id` in ConsentSheet → proper `ConsentForm` type from SDK
2. CFIX-02: Signature canvas mouse-only → Pointer Events API (touch + stylus + mouse)
3. CFIX-03: LabOrdersSheet useEffect/raw-fetch → TanStack Query (useQuery + useMutation with invalidation)

</domain>

<decisions>
## Implementation Decisions

### CFIX-01 — ConsentSheet typing
Use `ConsentForm` type from `@monobase/sdk-ts/generated/types`. The `createConsentForm` response data is typed as the SDK's `ConsentForm` type which has `id: string`. Replace `(form as any).id` with `form.id` after typing the destructured result properly. Do NOT migrate to useMutation — only fix the `as any` cast per requirement.

### CFIX-02 — Pointer Events
Replace `onMouseDown/Move/Up/Leave` with `onPointerDown/Move/Up/Leave` on the `<canvas>` element. Extract `clientX/clientY` from `PointerEvent` (same API surface as `MouseEvent`). The canvas already has `touch-none` (CSS `touch-action: none`), which is correct for pointer capture. Use `e.currentTarget.setPointerCapture(e.pointerId)` on pointerdown for reliable drag tracking.

### CFIX-03 — LabOrdersSheet TanStack Query
- List: `useQuery(listLabOrdersOptions({ path: { visitId } }))` — replace `load()` + `useEffect`
- Create: `useMutation(createLabOrderMutation())` with `onSuccess: () => queryClient.invalidateQueries({ queryKey: listLabOrdersQueryKey({ path: { visitId } }) })`
- Update/Cancel: `useMutation(updateLabOrderMutation())` with same invalidation
- Response shape: `data.data` (paginated — `{ data: LabOrder[], pagination: {...} }`) from pre-completion checklist learnings (01-04 deviation)

</decisions>

<code_context>
## Existing Code Insights

**consent-sheet.tsx:**
- Line ~107: `const { data: form } = await createConsentForm({...})`
- Line ~110: `path: { visitId, consentId: (form as any).id }` — needs type fix
- Canvas: `onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}` — needs Pointer Events
- Canvas has `touch-none` class already ✅

**lab-orders-sheet.tsx:**
- Imports `listLabOrders, createLabOrder, updateLabOrder` from `@monobase/sdk-ts/generated`
- Uses `useEffect` → `load()` async function pattern (classic pre-TanStack pattern)
- `(data as any)?.items` — response is actually `{ data: LabOrder[], pagination }` (not `.items`)

**SDK exports available:**
- `listLabOrdersOptions`, `listLabOrdersQueryKey` from `@monobase/sdk-ts/generated/react-query`
- `createLabOrderMutation`, `updateLabOrderMutation` from same
- `ConsentForm` type from `@monobase/sdk-ts/generated/types`

</code_context>

<specifics>
## Specific Requirements

- Do NOT add loading skeletons or UI changes beyond what's needed for TanStack Query wiring
- Preserve all existing UI structure in both files
- `bun run typecheck` must pass after changes

</specifics>
