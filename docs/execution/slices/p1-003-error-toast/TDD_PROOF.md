---
slice: p1-003-error-toast
phase: v1.5-g1
generated-by: oli-execution-gate
timestamp: 2026-05-25T00:00:00Z
---

## Spec Items
| ID | Description | Test File | RED Output | Status |
|----|-------------|-----------|------------|--------|
| AC-003 | useUpdateTreatment calls toast.error on failure | treatment-table.test.ts | _toastError not called | COVERED |
| AC-004 | useSaveChart calls toast.error on generic failure | use-save-chart.test.ts | _toastError not called | COVERED |
| AC-005 | useSaveChart toast message contains "locked" for VISIT_LOCKED 422 | use-save-chart.test.ts | message mismatch | COVERED |
| AC-006 | useSaveTreatment calls toast.error on failure | use-save-treatment.test.ts | _toastError not called | COVERED |

## Coverage Summary
- Total: 4/4 (100%)
- Pre-existing unrelated failure: treatment-table "calls onMarkDone" (not introduced by this slice)

## Verification
- Test command: `cd apps/dentalemon && bun test src/features/workspace/components/treatment-table.test.ts src/features/workspace/hooks/use-save-chart.test.ts src/features/workspace/hooks/use-save-treatment.test.ts`
- Baseline: 22 pass, 1 pre-existing fail → Final: 25 pass, 1 pre-existing fail (+3 new passing)
