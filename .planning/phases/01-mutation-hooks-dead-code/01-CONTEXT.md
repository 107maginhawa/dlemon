# Phase 1: Mutation Hooks + Dead Code - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Extract 3 inline `fetch()` blocks from `$patientId.tsx` into typed TanStack Query `useMutation` hooks, then delete `use-visit.ts` and `use-dental-chart.ts` dead stubs and their tests.

**In scope:**
- Create `useCreateVisit`, `useSharePMD`, `useSaveChart`, `useSaveTreatment` mutation hooks
- Refactor `$patientId.tsx` to call hooks instead of inline fetch
- Delete `use-visit.ts`, `use-dental-chart.ts`, `use-visit.test.ts`, `use-dental-chart.test.ts`

**Out of scope:** No new features, no API changes, no UI changes.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure refactor/infrastructure phase.

Key notes from codebase analysis:
- Use `useMutation` from `@tanstack/react-query` (not `useQuery`)
- Follow existing read hook pattern: `apiBaseUrl` from `@/utils/config`, native fetch, `credentials: 'include'`
- `queryClient.invalidateQueries` pattern already used inline — preserve in hooks via `onSuccess`
- `handleSaveToothData` contains TWO sequential fetches:
  1. POST `/dental/visits/${visitId}/chart` → `useSaveChart` hook
  2. POST `/dental/visits/${visitId}/treatments` (conditional on cdtCode+description+priceInput) → `useSaveTreatment` hook
  The teeth array building logic (from `teeth` + `selectedTooth` state) stays in the component; hooks receive the already-built payload.
- `handleSharePMD` calls `navigator.share` on success — this side-effect stays in the component's `onSuccess` callback
- `handleNewVisit` sets `currentVisitId` on success — this side-effect stays in component's `onSuccess`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useQuery` hook pattern in `use-visits.ts`, `use-treatments.ts`, `use-dental-chart-query.ts` — follow same file structure
- `apiBaseUrl` from `@/utils/config` — use in all new hooks
- `Visit` type from `use-visits.ts` — reuse for `useCreateVisit` return type
- `useQueryClient` from `@tanstack/react-query` — available in `$patientId.tsx` already

### Established Patterns
- Hooks: named export function, typed options interface, typed return
- API calls: native fetch with `credentials: 'include'`, throw on `!res.ok`
- Query keys: `['dental-visits', patientId]`, `['dental-chart', visitId]`, `['dental-treatments', visitId]`

### Integration Points
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx` — replace 3 handlers + remove `apiBaseUrl` import if unused + `useQueryClient` may no longer be needed
- `apps/dentalemon/src/features/workspace/hooks/` — create 4 new hook files here
- `apps/dentalemon/src/features/workspace/hooks/use-visit.ts` — DELETE
- `apps/dentalemon/src/features/workspace/hooks/use-dental-chart.ts` — DELETE
- `apps/dentalemon/src/features/workspace/hooks/use-visit.test.ts` — DELETE
- `apps/dentalemon/src/features/workspace/hooks/use-dental-chart.test.ts` — DELETE

</code_context>

<specifics>
## Specific Ideas

- `useCreateVisit({ patientId })` — takes patientId in options, reads branchId/dentistMemberId from localStorage inside mutationFn, returns `Visit`
- `useSharePMD({ visitId, patientId })` — posts pmd endpoint, returns pmd object
- `useSaveChart({ visitId, patientId })` — accepts `{ teeth: ToothData[] }` as mutation variables
- `useSaveTreatment({ visitId, patientId })` — accepts `{ cdtCode, description, priceInput, toothNumber?, surfaces? }` as mutation variables

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
