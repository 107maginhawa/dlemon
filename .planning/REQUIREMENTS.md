# Requirements: Dentalemon v1.1 PR1 Frontend Completion

**Defined:** 2026-05-06
**Core Value:** A practitioner can open any patient folder, view their dental chart, plan treatments, and record visits from a single workspace.

## v1 Requirements

### Mutation Hooks

- [ ] **MUT-01**: Inline `fetch()` calls in `$patientId.tsx` replaced by typed TanStack Query mutation hooks (useCreateVisit, useSharePMD, useSaveChart, useSaveTreatment)
- [ ] **MUT-02**: Dead code stubs (`use-visit.ts`, `use-dental-chart.ts`) removed and their tests cleaned up

### Bug Fixes

- [ ] **BUG-01**: Treatment status enum in tooth-slideout uses `diagnosed | planned` (not `proposed`) matching backend DentalVisitStatus
- [ ] **BUG-02**: Price field renamed from `priceCents` to `priceInput` matching API field name
- [ ] **BUG-03**: Tooth slideout form state resets when `selectedTooth` prop changes
- [ ] **BUG-04**: ToothData.state type uses only `ToothState` union (no `| string`); ToothSurface canonicalized to single 5-surface type everywhere
- [ ] **BUG-05**: FDI validation guard rejects invalid tooth numbers (1-32 Universal, 11-48 FDI)
- [ ] **BUG-06**: Price input validated before `*100` cents conversion (NaN guard)
- [ ] **BUG-07**: Hardcoded `bg-[#FFE97D]` on payment footer button replaced with `bg-lemon` token

### Components

- [ ] **COMP-01**: DentalChartThumbnail component renders 4×16 tooth grid with condition pip colors (caries=red/35%, decayed=amber, crown=blue, extract=red+dashed, filling=green)
- [ ] **COMP-02**: patient-folder-card shows DentalChartThumbnail when latest chart data is available
- [ ] **COMP-03**: patient-folder-card displays colored top tab strip: Gold=active, Gray=archived, Teal=in-session

### Tests

- [ ] **TEST-01**: Hook tests covering useCreateVisit (success, error, invalidation), useSaveChart (optimistic update, rollback), useSharePMD (success, error), FDI adapter (32-tooth mapping + invalid input), price conversion (NaN guard, edge cases)
- [ ] **TEST-02**: Component tests covering DentalChartThumbnail (grid render, condition colors, empty state), patient-folder-card (status color tabs), tooth-slideout (form reset on tooth change, status enum values), workspace-tabs (tab switching, active highlight)

### Documentation

- [ ] **DOC-01**: SCREENS.md maps 28 wireframes → routes → components
- [ ] **DOC-02**: COMPONENTS.md inventories shared components with props/usage

## v2 Requirements

(deferred to future milestone)

- iPad offline sync — cadence P2P engine not ready
- Multi-practitioner real-time collaboration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend API changes | This milestone is frontend-only |
| New feature modules | Beyond the 5-phase scope |
| Admin portal | Separate app |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MUT-01 | Phase 1 | Pending |
| MUT-02 | Phase 1 | Pending |
| BUG-01 | Phase 2 | Pending |
| BUG-02 | Phase 2 | Pending |
| BUG-03 | Phase 2 | Pending |
| BUG-04 | Phase 2 | Pending |
| BUG-05 | Phase 2 | Pending |
| BUG-06 | Phase 2 | Pending |
| BUG-07 | Phase 2 | Pending |
| COMP-01 | Phase 3 | Pending |
| COMP-02 | Phase 3 | Pending |
| COMP-03 | Phase 3 | Pending |
| TEST-01 | Phase 4 | Pending |
| TEST-02 | Phase 4 | Pending |
| DOC-01 | Phase 5 | Pending |
| DOC-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-06*
*Last updated: 2026-05-06 — Milestone v1.1 initialized*
