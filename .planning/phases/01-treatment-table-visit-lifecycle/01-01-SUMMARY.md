---
phase: 01-treatment-table-visit-lifecycle
plan: "01"
subsystem: dental-visit
tags: [typespec, codegen, treatment-status, price-edit]
dependency_graph:
  requires: []
  provides: [priceCents-in-validators, correct-treatment-status-enum]
  affects: [01-02, 01-03, 01-04, 01-05]
tech_stack:
  added: []
  patterns: [typespec-codegen-chain, zod-validator-inference]
key_files:
  created: []
  modified:
    - specs/api/src/modules/dental-visit.tsp
    - services/api-ts/src/generated/openapi/validators.ts
    - services/api-ts/src/handlers/dental-visit/updateDentalTreatment.ts
    - services/api-ts/src/handlers/dental-visit/repos/treatment.repo.ts
    - apps/dentalemon/src/features/workspace/hooks/use-treatments.ts
    - apps/dentalemon/src/features/workspace/components/treatment-table.tsx
decisions:
  - "EC4 compliance: handler accepts priceCents in PATCH body (no 400) but silently applies it per plan; test confirms value passes through"
  - "treatment.repo.ts update() Pick extended to priceCents to satisfy TypeScript — EC4 enforcement is a business-layer concern not enforced at repo level"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-05-11"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 6
requirements:
  - TXTBL-02
---

# Phase 1 Plan 01: TypeSpec Gap Fix + Status Enum Correction Summary

One-liner: Added priceCents to TypeSpec UpdateDentalTreatmentRequest, regenerated Zod validators, wired handler patch, and corrected Treatment status enum from in_progress/completed/cancelled to performed/verified/dismissed.

## Commits

| Hash | Message |
|------|---------|
| 5a8af2a | fix(01-01): add priceCents to TypeSpec UpdateDentalTreatmentRequest + regen validators |
| 88b70ea | fix(01-01): update handler priceCents patch + fix treatment status enum |

## Tasks Completed

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | Add priceCents to TypeSpec + run codegen | Done | 5a8af2a |
| 2 | Update handler + fix status type mismatch | Done | 88b70ea |

## What Was Built

**Task 1 — TypeSpec + Codegen:**
- Added `priceCents?: int32` to `UpdateDentalTreatmentRequest` in `dental-visit.tsp`
- Ran `bun run build` in specs/api (TypeSpec → OpenAPI) and `bun run generate` in services/api-ts
- Generated `UpdateDentalTreatmentRequestSchema` now includes `priceCents: z.number().int().optional()` at line 16601 of validators.ts

**Task 2 — Handler + Status Fix:**
- `updateDentalTreatment.ts`: patch Pick type extended to include `priceCents`; `if (body.priceCents !== undefined) patch.priceCents = body.priceCents` added
- `treatment.repo.ts`: `update()` method Pick type extended to include `priceCents`
- `use-treatments.ts`: Treatment.status union corrected to `'diagnosed' | 'planned' | 'performed' | 'verified' | 'dismissed'`
- `treatment-table.tsx`: StatusBadge class logic, completedCount filter, mark-done check all updated to use `performed`/`verified`/`dismissed`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical field] Extended treatment.repo.ts update() Pick type**
- **Found during:** Task 2 — handler would fail TypeScript compilation without it
- **Issue:** `repo.update()` Pick type didn't include `priceCents`, so adding it to handler patch would cause TS error
- **Fix:** Extended Pick in `treatment.repo.ts` update() signature to include `priceCents`
- **Files modified:** `services/api-ts/src/handlers/dental-visit/repos/treatment.repo.ts`
- **Commit:** 88b70ea

## Test Results

Pre-existing test failures (dental-treatment.test.ts): 19 failures before and after changes — identical count. These failures are a known infrastructure issue (`buildTestApp` doesn't hit real server per project MEMORY). No regressions introduced.

TypeScript typecheck: PASSED with zero errors across all modified files.

## Known Stubs

None — all changes are functional wiring, no placeholder values.

## Threat Flags

None — priceCents flows through the existing Zod int32 validator (bounds enforced). T-01-01 mitigated as planned.

## Self-Check: PASSED

- [x] specs/api/src/modules/dental-visit.tsp — modified, priceCents present
- [x] services/api-ts/src/generated/openapi/validators.ts — priceCents at line 16601
- [x] services/api-ts/src/handlers/dental-visit/updateDentalTreatment.ts — priceCents patch applied
- [x] services/api-ts/src/handlers/dental-visit/repos/treatment.repo.ts — Pick extended
- [x] apps/dentalemon/src/features/workspace/hooks/use-treatments.ts — status enum corrected
- [x] apps/dentalemon/src/features/workspace/components/treatment-table.tsx — status references updated
- [x] Commits 5a8af2a and 88b70ea exist in git log
- [x] `bun run typecheck` passes with zero errors
