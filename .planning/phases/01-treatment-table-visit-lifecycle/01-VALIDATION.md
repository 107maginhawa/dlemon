# Phase 1: Treatment Table & Visit Lifecycle — Validation Architecture

**Created:** 2026-05-10
**Phase:** 01-treatment-table-visit-lifecycle

## Test Map

| Requirement | Test Type | Scenario | Verification Command |
|-------------|-----------|----------|---------------------|
| TXTBL-01 | Component | TreatmentTable renders dual subtotals (This Visit / Carried Over) | `bun test treatment-table` — expect "This Visit" and "Carried Over" rows |
| TXTBL-02 | Component | Click price cell → input appears; blur saves via mutation | `bun test treatment-table` — expect price input renders on click |
| TXTBL-03 | Component | Dismiss button opens popover with reason input; confirm calls mutation | `bun test treatment-table` — expect dismiss popover renders |
| TXTBL-04 | Component | Chevron toggles notes sub-row | `bun test treatment-table` — expect notes row hidden/shown |
| TXTBL-05 | Component | "View Completed" button toggles completed row visibility | `bun test treatment-table` — completedCount rows hidden by default |
| VISIT-01 | Component | Complete Visit button calls updateDentalVisit({ status: 'completed' }) | Wiring test in $patientId or workspace-top-bar |
| VISIT-02 | Component | PreCompletionChecklist shows 4 check items with pass/warn state | `bun test pre-completion-checklist` |
| VISIT-03 | Component | Lock Visit button calls updateDentalVisit({ status: 'locked' }) | Wiring test |
| VISIT-04 | Component | SoapNotesSheet renders S/O/A/P fields; Save calls upsertVisitNotes | `bun test soap-notes-sheet` |

## Acceptance Commands

```bash
# TypeScript — must pass
cd /Users/eladventures/Desktop/dentalemon && bun run typecheck

# Unit tests — must pass
cd /Users/eladventures/Desktop/dentalemon && bun test apps/dentalemon/src/features/workspace

# SDK codegen integrity (after Wave 1)
grep 'priceCents' packages/sdk-ts/src/generated/types.gen.ts
```

## Key Verification Points

1. `priceCents` present in `UpdateDentalTreatmentBody` after Wave 1 codegen
2. `use-treatments.ts` status type = `'diagnosed' | 'planned' | 'performed' | 'verified' | 'dismissed'`
3. TreatmentTable does NOT render completed rows by default (`completedCount > 0` shows toggle)
4. `onNotes` in `$patientId.tsx` opens `SoapNotesSheet`, not `MedicalHistoryForm`
5. Visit completion disabled when `status !== 'active'`
