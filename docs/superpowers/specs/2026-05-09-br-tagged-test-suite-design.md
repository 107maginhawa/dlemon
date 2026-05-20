# BR-Tagged Test Suite — Phase 2 Design Spec

**Date:** 2026-05-09
**Status:** Draft
**Scope:** All 22 business rules (BR-001 through BR-022)

## Problem

Frontend tests have **0 BR tags** (`// [BR-###]`). Backend `business-rules.test.ts` covers 12/22 rules but 3 have gap tests documenting broken enforcement. 10 rules lack dedicated backend tests. No traceability from tests back to business rules.

## Approach

10 vertical slices, TDD (RED→GREEN), prioritized by risk. Each slice is self-contained: backend test → backend fix (if needed) → frontend BR tag → verify.

## Slice Definitions

### TIER 1: P0 — Gap Fixes (code + test)

**Slice 1: BR-015 — Patient consent required**
- RED: `business-rules.test.ts` — change gap test to assert `status >= 400` for `consentGiven: false`
- GREEN: `createDentalPatient.ts` — add `if (!body.consentGiven) throw BusinessLogicError('CONSENT_REQUIRED')`
- Tag: `patient-registration-modal.test.ts` — `// [BR-015]` on consent checkbox test

**Slice 2: BR-007 — Verified treatment immutable**
- RED: `business-rules.test.ts` — change gap test to assert `status >= 400` for cdtCode edit on verified
- GREEN: `updateDentalTreatment.ts` — add guard: if `treatment.status === 'verified'` and field edit attempted, throw `TREATMENT_IMMUTABLE`
- Tag: `treatment-table.test.ts` — `// [BR-007]` on readOnly guard tests

**Slice 3: BR-011 — Payment plan blocks void**
- RED: `business-rules.test.ts` — change gap test to assert `status >= 400` for void with active plan
- GREEN: `voidDentalInvoice.ts` — add `findActiveByInvoiceId` check before void
- Tag: `workspace-payment-modal.test.ts` — `// [BR-011]` on voided invoice filter test

### TIER 2: P1 — Tag + New Tests

**Slice 4: BR-016 + BR-017 — Authorization**
- Tag: `business-rules.test.ts` existing BR-016 tests with `// [BR-016]`
- New: `business-rules.test.ts` — `describe('BR-017')` test: POST prescription without prescriberMemberId → 4xx
- Tag: `rx-sheet.test.ts` — `// [BR-017]` on prescription form tests

**Slice 5: BR-001–004 — Visit lifecycle**
- Tag: `use-visits.test.ts` — `// [BR-001]` on active visit derivation tests
- Tag: `treatment-table.test.ts` — `// [BR-003]` on readOnly guard
- Tag: `check-in-flow.test.ts` — `// [BR-004]` on check-in creates visit tests
- New: `business-rules.test.ts` — complete BR-004 test (verify appointment delete keeps visit)

**Slice 6: BR-006 + BR-008 — Treatment status + carry-over**
- Tag: `use-treatments.test.ts` — `// [BR-006]` on status enum test
- Tag: `use-save-treatment.test.ts` — `// [BR-006]` on status tests
- Tag: `treatment-table.test.ts` — `// [BR-008]` on carried-over rendering (or add test.skip)
- Note: `business-rules.test.ts` already has BR-008 skip (UI-only)

**Slice 7: BR-009–012 — Billing**
- Tag: existing `business-rules.test.ts` tests with `// [BR-009]`, `// [BR-012]`
- New: `business-rules.test.ts` — BR-010 test asserting `taxCents === 0` on invoice creation
- Tag: `workspace-payment-modal.test.ts` — `// [BR-009]` on empty line items guard, `// [BR-012]` on status badges

### TIER 3: P2/P3 — Remaining

**Slice 8: BR-014 + BR-018 + BR-019 — Consent/Lab/Amendments**
- Tag: `consent-sheet.test.ts` — `// [BR-014]` on signed immutability tests
- New: `business-rules.test.ts` — `describe('BR-018')` lab order transition tests
- Tag: `lab-orders-sheet.test.ts` — `// [BR-018]` on transition tests
- Placeholder: `test.skip('[BR-019] clinical records append-only')`

**Slice 9: BR-021 + BR-022 — PMD**
- Tag: existing `business-rules.test.ts` BR-021 tests
- New: `business-rules.test.ts` — `describe('BR-022')` imported PMD read-only test

**Slice 10: BR-005, BR-013, BR-020 — Unimplemented (placeholders)**
- `describe.skip('BR-005')` — auto-discard draft visits
- `describe.skip('BR-013')` — markInvoiceUncollectible
- `describe.skip('BR-020')` — patient merge/unmerge

## File Change Map

| File | Slices | Type |
|------|--------|------|
| `services/api-ts/src/handlers/business-rules.test.ts` | 1-10 | Tags + new tests + placeholders |
| `services/api-ts/src/handlers/dental-patient/createDentalPatient.ts` | 1 | Code fix (3 lines) |
| `services/api-ts/src/handlers/dental-visit/updateDentalTreatment.ts` | 2 | Code fix (7 lines) |
| `services/api-ts/src/handlers/dental-billing/voidDentalInvoice.ts` | 3 | Code fix (6 lines) |
| `apps/.../patient-registration-modal.test.ts` | 1 | BR tag |
| `apps/.../treatment-table.test.ts` | 2,5,6 | BR tags |
| `apps/.../workspace-payment-modal.test.ts` | 3,7 | BR tags |
| `apps/.../rx-sheet.test.ts` | 4 | BR tag |
| `apps/.../use-visits.test.ts` | 5 | BR tags |
| `apps/.../check-in-flow.test.ts` | 5 | BR tag |
| `apps/.../use-treatments.test.ts` | 6 | BR tag |
| `apps/.../use-save-treatment.test.ts` | 6 | BR tag |
| `apps/.../consent-sheet.test.ts` | 8 | BR tag |
| `apps/.../lab-orders-sheet.test.ts` | 8 | BR tag |

## Verification

```bash
# After all slices:
cd services/api-ts && bun test src/handlers/business-rules.test.ts
cd apps/dentalemon && bun test src/

# BR tag count (should be ≥22):
grep -r '// \[BR-' services/api-ts/src/ apps/dentalemon/src/ | wc -l

# No remaining fireEvent:
grep -r 'fireEvent' apps/dentalemon/src/ --include='*.test.*' | wc -l  # expect 0

# Placeholder count (should be 3):
grep -r 'describe.skip.*BR-' services/api-ts/src/handlers/business-rules.test.ts | wc -l
```

## Success Criteria

- All 22 BR rules have `// [BR-###]` tagged tests (19 active + 3 skip placeholders)
- 3 gap fixes (BR-007, BR-011, BR-015) enforced in backend handlers
- Frontend tests tagged where rules have client-side enforcement
- `bun test` passes for both backend and frontend with no regressions
- BUSINESS_RULES.md coverage map updated to reflect actual state
