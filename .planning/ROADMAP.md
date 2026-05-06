# Roadmap: Dentalemon v1.1 PR1 Frontend Completion

**Milestone:** v1.1
**Phases:** 5
**Requirements mapped:** 16 / 16 ✓
**Created:** 2026-05-06

## Overview

| # | Phase | Goal | Requirements | Risk |
|---|-------|------|--------------|------|
| 1 | Mutation Hooks + Dead Code | Extract 4 inline fetch() calls into typed mutation hooks; delete dead stubs | MUT-01, MUT-02 | Low |
| 2 | Bug Fixes + Type Tightening | Fix known bugs and tighten types; cascade guard ensures Phase 1 hooks still compile | BUG-01–07 | Medium |
| 3 | DentalChartThumbnail + Component Polish | Build missing mini-chart component; add color tabs to patient cards | COMP-01–03 | Low |
| 4 | Frontend Tests | Hook and component test coverage (2 waves) | TEST-01, TEST-02 | Low |
| 5 | Documentation ✅ | Scaffold SCREENS.md and COMPONENTS.md | DOC-01, DOC-02 | Trivial |

---

## Phase 1: Mutation Hooks + Dead Code

**Goal:** Replace all inline `fetch()` in the workspace page with proper TanStack Query mutations. Remove dead code stubs.

**Requirements:** MUT-01, MUT-02

**Tasks:**
1. Create `useCreateVisit` mutation hook — `src/features/workspace/hooks/use-create-visit.ts` — POST /dental/visits, invalidates visits query
2. Create `useSharePMD` mutation hook — `src/features/workspace/hooks/use-share-pmd.ts` — POST /dental/visits/:id/pmd
3. Create `useSaveChart` mutation hook — `src/features/workspace/hooks/use-save-chart.ts` — POST chart, invalidates chart query
4. Create `useSaveTreatment` mutation hook — `src/features/workspace/hooks/use-save-treatment.ts` — POST treatments, invalidates treatments query
5. Refactor `$patientId.tsx` — replace 4 inline fetch blocks with hook calls
6. Delete `use-visit.ts` and `use-dental-chart.ts` dead stubs
7. Fix/remove tests importing deleted stubs

**Key files:**
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx`
- `apps/dentalemon/src/features/workspace/hooks/`
- `apps/dentalemon/src/features/workspace/hooks/use-visit.ts` (DELETE)
- `apps/dentalemon/src/features/workspace/hooks/use-dental-chart.ts` (DELETE)

**Success criteria:**
1. `bun run typecheck` clean — no broken imports from deleted stubs
2. `bun test` passes — no test regressions
3. workspace page renders without runtime errors
4. All 4 mutations are callable from the workspace page
5. Dead stub files no longer exist in the codebase

---

## Phase 2: Bug Fixes + Type Tightening

**Goal:** Fix known bugs and tighten types for safety. Cascade guard: re-run typecheck after to verify Phase 1 hooks still compile with tightened types.

**Requirements:** BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, BUG-06, BUG-07

**Tasks:**
1. Treatment status enum — `tooth-slideout.tsx` — Change `proposed` → `diagnosed | planned` to match backend enum
2. Price field naming — `tooth-slideout.tsx` — Rename `priceCents` → `priceInput` (matches API field)
3. Tooth slideout state reset — `tooth-slideout.tsx` — Reset form state when `selectedTooth` changes
4. Tighten ToothData.state type — Remove `| string`, keep only `ToothState` union
5. Canonicalize ToothSurface type — `five-surface-selector.tsx` + types — Single 5-surface type everywhere
6. FDI validation guard — `dental-chart.helpers.ts` — Reject invalid tooth numbers
7. Price NaN guard — `tooth-slideout.tsx` — Validate numeric input before `*100` cents conversion
8. Hardcoded color cleanup — Payment footer button — Replace `bg-[#FFE97D]` with `bg-lemon`

**CASCADE GUARD:** After verification passes, additionally run:
- `cd apps/dentalemon && bun run typecheck`
- Verify `$patientId.tsx` still imports Phase 1 hooks without type errors

**Key files:**
- `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx`
- `apps/dentalemon/src/features/patients/components/five-surface-selector.tsx`
- `apps/dentalemon/src/constants/brand.ts`

**Success criteria:**
1. `bun run typecheck` clean — Phase 1 hooks and Phase 2 types compile together
2. Treatment creation uses `diagnosed` or `planned` (not `proposed`)
3. No runtime NaN/undefined errors on price input
4. Invalid FDI numbers are rejected
5. `bg-lemon` used instead of hardcoded hex in payment footer

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — Type tightening: ToothData.surfaces, buildToothMap, getToothColorClass, FDI guards, Treatment cdtCode/description (BUG-04, BUG-05, CR-03)
- [x] 02-02-PLAN.md — Hook fixes: CR-01 localStorage guard, CR-02 stale closure, WR-02 sequential saves, BUG-06 NaN guard
- [x] 02-03-PLAN.md — Verify BUG-02/BUG-03/BUG-01 already-fixed, BUG-07 color tokens, cascade typecheck guard

---

## Phase 3: DentalChartThumbnail + Component Polish

**Goal:** Build the missing DentalChartThumbnail component for patient cards. Polish existing components.

**Requirements:** COMP-01, COMP-02, COMP-03

**Tasks:**
1. Build DentalChartThumbnail — `src/features/patients/components/dental-chart-thumbnail.tsx` — 4×16 tooth grid with condition pip colors (caries=red/35%, decayed=amber, crown=blue, extract=red+dashed, filling=green)
2. Wire thumbnail to patient cards — `patient-folder-card.tsx` — Show mini chart when latest chart data available
3. ManilaFolderCard color tab — `patient-folder-card.tsx` — Add colored top tab strip: Gold=active, Gray=archived, Teal=in-session

**Key files:**
- `apps/dentalemon/src/features/patients/components/dental-chart-thumbnail.tsx` (CREATE)
- `apps/dentalemon/src/features/patients/components/patient-folder-card.tsx`
- `apps/dentalemon/tailwind.config.ts` (dental condition colors reference)

**Success criteria:**
1. Patient list renders thumbnails when chart data exists
2. Card tabs show correct colors per patient status (Gold/Gray/Teal)
3. `bun run typecheck` clean
4. Empty state renders correctly when no chart data exists

**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — Create DentalChartThumbnail, extend PatientCardData, update use-patients mapping
- [x] 03-02-PLAN.md — Cascade typecheck guard + structural grep verification

---

## Phase 4: Frontend Tests

**Goal:** Test coverage for hooks and key components. Two waves: hooks first, then components.

**Requirements:** TEST-01, TEST-02

**Wave 1 — Hook tests:**
- useCreateVisit: success, error, query invalidation
- useSaveChart: optimistic update, rollback on error
- useSharePMD: success, error state
- FDI adapter: exhaustive 32-tooth mapping + invalid input
- Price conversion: NaN guard, edge cases

**Wave 2 — Component tests:**
- DentalChartThumbnail: renders grid, condition colors, empty state
- patient-folder-card: renders each status color tab
- tooth-slideout: form reset on tooth change, status enum values
- workspace-tabs: tab switching, active highlight

**Test locations:**
- `apps/dentalemon/src/features/workspace/hooks/__tests__/`
- `apps/dentalemon/src/features/patients/components/__tests__/`

**Success criteria:**
1. All hook tests pass
2. All component tests pass
3. `bun test` clean — no regressions
4. `bun run typecheck` clean

**Plans:** 2 plans

Plans:
- [x] 04-01-PLAN.md — Hook tests: useCreateVisit, useSaveChart, useSharePMD
- [x] 04-02-PLAN.md — Component tests: DentalChartThumbnail, tooth-slideout, patient-folder-card update

---

## Phase 5: Documentation ✅ Complete 2026-05-06

**Goal:** Scaffold developer docs for the dentalemon frontend.

**Requirements:** DOC-01, DOC-02

**Tasks:**
1. SCREENS.md — `docs/development/SCREENS.md` — Map 28 wireframes → routes → components
2. COMPONENTS.md — `docs/development/COMPONENTS.md` — Shared component inventory with props/usage

**Key references:**
- `docs/context/wireframes/` (28 HTML wireframes)
- `apps/dentalemon/src/routes/` (route structure)
- `apps/dentalemon/src/features/` (component inventory)

**Success criteria:**
1. SCREENS.md exists and maps all 28 wireframes to routes and primary components
2. COMPONENTS.md inventories all shared components with props and usage examples
3. Docs are accurate (no hallucinated component names)

---

## Dependency Graph

```
Phase 1 (Mutation Hooks)
  └─► Phase 2 (Bug Fixes) — cascade guard verifies Phase 1 hooks compile with new types
       └─► Phase 3 (Components) — independent, can proceed after Phase 2
            └─► Phase 4 (Tests) — tests Phase 1+2+3 outputs
                 └─► Phase 5 (Docs) — documents Phase 1+2+3 outputs
```

---
*Roadmap created: 2026-05-06*
