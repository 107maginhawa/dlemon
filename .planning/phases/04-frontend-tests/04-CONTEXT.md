# Phase 4: Frontend Tests - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Write test coverage for the mutation hooks and key components built in phases 1-3. Two waves: hooks first (useCreateVisit, useSaveChart, useSharePMD), then components (DentalChartThumbnail, tooth-slideout, patient-folder-card status tabs). FDI adapter and workspace-tabs are already covered in existing test files.

</domain>

<decisions>
## Implementation Decisions

### Test File Location
- Colocate test files next to source (not in `__tests__/` subdir) — matches existing pattern: `use-visits.test.ts`, `use-medical-history.test.ts`, `workspace-tabs.test.ts`
- Hook tests: `apps/dentalemon/src/features/workspace/hooks/`
- Component tests: `apps/dentalemon/src/features/patients/components/` and `apps/dentalemon/src/features/workspace/components/`

### patient-folder-card Test Update
- Update existing `'folder tab has lemon gold color class'` assertion from `bg-[#FFE97D]` → `bg-lemon` (Phase 3 changed the implementation)
- Add 3 new tests for status-driven tab colors: `active` → `bg-lemon`, `archived` → `bg-muted`, `in-session` → `bg-teal-500`

### useSaveChart "rollback on error" Scope
- No optimistic update in implementation — test what exists: `isError` true on fetch failure, `invalidateQueries` NOT called on error
- Test `onSuccess` correctly invalidates `['dental-chart', visitId]`

### DentalChartThumbnail Test Scope
- Pure function tests for `getThumbnailPipClass()` — all 9 tooth states map to expected CSS class
- Component render tests — 32 pip divs rendered (via `data-tooth` attribute), empty state renders 32 healthy pips

### Price Conversion
- No standalone price conversion utility exists (Phase 2 eliminated `*100` conversion)
- Cover priceInput as part of tooth-slideout tests (field present on form)

### Claude's Discretion
- FDI adapter tests already exist in `dental-chart.test.ts` (lines 82-118) — skip, do not duplicate
- workspace-tabs tests already complete — skip
- Use `global.fetch = mock(...)` pattern (established by use-visits.test.ts) for hook mocking
- Use `renderHook` + `QueryClientProvider` wrapper (established pattern) for mutation hook tests

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `freshClient()` + `makeWrapper(qc)` pattern from `use-visits.test.ts` — copy for mutation hook tests
- `global.fetch = mock(...)` with `afterEach(() => { global.fetch = originalFetch; })` — established fetch mock pattern
- `render(React.createElement(...))` with `screen`, `fireEvent` — component test pattern
- `getThumbnailPipClass(state)` exported from `dental-chart-thumbnail.tsx` — pure function, directly testable
- `TOOTH_STATES` in `tooth-slideout.tsx` — 9 values (healthy, caries, fractured, filled, crown, missing, implant, extracted, watchlist)

### Established Patterns
- Bun test runner: `import { describe, test, expect, afterEach, mock } from 'bun:test'`
- `@testing-library/react`: `renderHook`, `waitFor`, `render`, `screen`, `fireEvent`, `cleanup`
- `afterEach(cleanup)` at top of every component test file
- `QueryClient({ defaultOptions: { queries: { retry: false } } })` — disables retries in tests

### Integration Points
- `useCreateVisit(patientId)` — invalidates `['dental-visits', patientId]` on success
- `useSaveChart()` — invalidates `['dental-chart', input.visitId]` on success
- `useSharePMD()` — no invalidation, returns `{ checksum, ...rest }`
- `DentalChartThumbnail({ teeth })` — renders `data-tooth={toothNumber}` divs
- `ToothSlideout({ toothNumber, open, onClose, onSave })` — resets state via `useEffect([toothNumber])`

</code_context>

<specifics>
## Specific Ideas

- patient-folder-card existing test for `'folder tab has lemon gold color class'` asserts `bg-[#FFE97D]` — this WILL FAIL after Phase 3 changes. Must fix to `bg-lemon`.
- dental-chart.test.ts already imports `fdiToUniversal`, `universalToFdi` and has exhaustive 32-tooth round-trip tests — do NOT add duplicate tests.

</specifics>

<deferred>
## Deferred Ideas

- useSaveTreatment tests — not in Phase 4 ROADMAP scope
- Integration/E2E tests for the workspace page — separate milestone
- Adding optimistic update to useSaveChart — out of scope (would require implementation change)

</deferred>
