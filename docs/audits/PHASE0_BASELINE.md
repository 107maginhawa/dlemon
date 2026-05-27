# Phase 0 Baseline — Structural Remediation Pre-Refactor Snapshot

**Date**: 2026-05-27  
**Git tag**: `pre-refactor-baseline` (commit `da0050a`)  
**Purpose**: Record exact safety-gate counts and structural inventory before any remediation work begins. Any phase that drops below these numbers must stop and revert.

---

## Safety Gate Baseline

### Frontend (apps/dentalemon)

| Gate | Result | Notes |
|------|--------|-------|
| `bun run typecheck` | ✅ 0 errors | Clean |
| `bun run lint` | ✅ 0 errors / 173 warnings | Warnings only, non-blocking |
| `bun test --coverage src/` | **1495 pass / 3 fail / 5 skip / 1 error** (1503 total, 130 files) | 3 pre-existing failures baseline |

**Minimum acceptable**: ≥1495 pass, ≤3 fail, 0 errors in typecheck.

### Backend (services/api-ts)

| Gate | Result | Notes |
|------|--------|-------|
| `bun run typecheck` | ⚠️ 10 errors | ALL in test files, NOT production code. Pre-existing. |
| `bun run lint` | ⚠️ 4 errors / 3189 warnings | Pre-existing baseline. 4 errors in non-blocking positions. |
| `bun test src/**/*.test.ts` | **Requires `monobase_test` DB with migrated schema** | Without test DB: db-guard blocks execution. Last known CI count: ~1528 pass (Wave 4 complete). |

Backend typecheck errors (baseline — do not add new ones):
- `dental-billing/dental-billing.test.ts:1274,1288` — `'body' is of type 'unknown'`
- `dental-billing/repos/dental-invoice.test.ts:229,246` — `Expected 5 arguments, but got 3`
- `dental-patient/dental-patient-sync.test.ts:399,400,418,419,420` — `'created'/'body' is of type 'unknown'`
- `dental-patient/updateClaimStatus.ts:36` — `Property 'submittedAt' comes from index signature` (PRODUCTION FILE)

**Note**: `updateClaimStatus.ts:36` is the only production-code typecheck error. All others are in test files.

**Minimum acceptable**: ≤10 typecheck errors, ≤4 lint errors (no new errors introduced).

### Contract Tests

Run via CI (`journey-verification` workflow) — requires full postgres + seed. Not runnable locally without Docker. Baseline: passing on `main` at commit `da0050a`.

### E2E Tests

Run via CI (`e2e` and `journey-verification` workflows). Baseline: passing on `main` at commit `da0050a`.

---

## Task 3: Dual-Registered OperationId Audit

**Finding**: No duplicate operationId registrations detected.

The `routes.ts` file registers 236 operationId comment-blocks. All are unique — no comment-block operationId appears more than once.

However, two endpoints represent the **same business concept** under different operationIds:

| OperationId | Route | Handler | Business Function |
|---|---|---|---|
| `createMember` | `POST /dental/org/members` | `dental-org/createMember.ts` | Flat member creation |
| `DentalMembershipManagement_create` | `POST /dental/org/branches/{branchId}/memberships` | `dental-org/DentalMembershipManagement_create.ts` | Branch-scoped with tier-limit logic |

These are **two independent implementations** of create-membership. Both are reachable. Phase 5 of the remediation plan will resolve this by picking a canonical endpoint.

The new CI check (Task 6) will enforce that no operationId comment in routes.ts ever duplicates in future.

---

## Task 4: Cross-Module Repo Import Inventory

### Production files with cross-module imports

**82 unique production files** (129 individual import lines) violate the no-cross-module-repos rule.

**By importer module (import lines)**:

| Module | Import lines |
|--------|-------------|
| `dental-org` | 33 |
| `dental-imaging` | 30 |
| `dental-patient` | 26 |
| `dental-billing` | 11 |
| `dental-pmd` | 7 |
| `dental-visit` | 6 |
| `dental-scheduling` | 6 |
| `dental-clinical` | 6 |
| `shared` | 3 |
| `dental-perio` | 1 |
| **Total** | **129** |

### Test files with cross-module imports

**140 test files** also contain cross-module repo imports.

### Key violating handlers

`dental-billing` reaches into: `dental-visit`, `dental-clinical`, `dental-org`, `patient`, `person`  
`dental-clinical` reaches into: `dental-org`, `patient`  
`dental-imaging` cross-imports across 30 lines  
`dental-patient` has 24+ cross-imports (most pervasive per plan)  

---

## Task 5: FK Dependency Map (dental-* → legacy modules)

### Schema-level FK dependencies

All dental-* schema FKs that reference legacy module tables:

**`patient/repos/patient.schema` is the only legacy schema imported by dental-* repos.**

| Dental module schema | → Legacy schema |
|---|---|
| `dental-billing/repos/dental-invoice.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-billing/repos/dental-payment-plan.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-billing/repos/dental-payment.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-clinical/repos/amendment.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-clinical/repos/attachment.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-clinical/repos/consent-form.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-clinical/repos/lab-order.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-clinical/repos/medical-history.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-clinical/repos/occlusion-screening.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-clinical/repos/prescription.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-imaging/repos/imaging_finding.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-patient/repos/claim-draft.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-patient/repos/dental-alert.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-patient/repos/insurance-profile.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-patient/repos/patient-contact.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-patient/repos/recall.schema.ts` | `patient/repos/patient.schema` (patientId FK) |
| `dental-patient/repos/task.schema.ts` | `patient/repos/patient.schema` (patientId FK) |

**No dental-* schema files import from**: `billing/`, `emr/`, `person/`, or `provider/` repos.

### Dependency graph

```
patient/repos/patient.schema (fanIn from dental schemas)
  ← dental-billing (3 schema files — dental-invoice, dental-payment-plan, dental-payment)
  ← dental-clinical (7 schema files)
  ← dental-imaging (1 schema file — imaging_finding)
  ← dental-patient (6+ schema files)

No dental schema → billing/emr/person/provider FK coupling at schema level.
(Coupling at handler/query level exists — see Task 4 cross-module imports.)
```

**Implication for Phase 12**: Deleting `patient/` schema requires coordinating data migrations across 4 dental modules (17+ schema files with FK constraints). This cannot be done by code deletion alone — each FK table needs a migration to re-point to a dental-patient equivalent.

---

## Task 7: assert-branch-access.ts Duplicate Resolution

| File | Status | Content |
|------|--------|---------|
| `handlers/shared/assert-branch-access.ts` | ✅ **CANONICAL** | Full implementation — queries `dentalMemberships`, checks active status, throws `ForbiddenError` |
| `handlers/dental-scheduling/utils/assert-branch-access.ts` | ✅ **SHIM** (intentional) | 1-line re-export: `export { assertBranchAccess } from '@/handlers/shared/assert-branch-access'` with backwards-compat comment |

**Decision**: No code change needed. The dental-scheduling shim is correct — it's an explicit backwards-compatibility re-export pointing to the canonical shared location. Phase 10 can leave this as-is; the boundary lint rule will correctly flag any NEW callers in dental-scheduling to import from `shared/` directly.

---

## Task 8: preferences-form.test.tsx Divergence Investigation

### Files found (main branch, not worktrees)

1. `apps/dentalemon/src/features/person/components/preferences-form.test.tsx`
2. `apps/account/src/features/person/components/preferences-form.test.tsx`

### Execution status

**Root `bun test` runs `--filter dentalemon` only** — `apps/account` tests are **never executed in CI or by default locally**.

Only `apps/dentalemon/preferences-form.test.tsx` runs.

### Behavioral differences

| Aspect | apps/dentalemon | apps/account |
|--------|-----------------|--------------|
| Click simulation | `await userEvent.setup()` + `await user.click()` (async, full browser event sequence) | `fireEvent.click()` (synchronous, low-level) |
| Assertions | `not.toBeNull()` | `toBeDefined()` |
| Import | `userEvent from '@testing-library/user-event'` | `fireEvent` from `@testing-library/react` |

### Verdict

**Not a silent test execution bug** — account tests are intentionally excluded by the `--filter dentalemon` root script. The divergence is cosmetic:
- `dentalemon` version is higher quality (async userEvent catches timing issues)
- `account` version (synchronous fireEvent) would miss async validation bugs if it ran

**Risk level**: LOW. Since account tests don't run in CI, they don't produce false confidence. The risk is if someone runs account tests manually and incorrectly treats them as authoritative.

**Recommendation for Phase 3**: Note that both test files exist but only one runs. Add a comment to `apps/account/src/features/person/components/preferences-form.test.tsx` clarifying it is not run by the default test suite. Consider deleting when Phase 8 (account decision) resolves the account app fate.

---

## Summary: Phase 0 Complete

| Task | Status | Key Finding |
|------|--------|-------------|
| Tag `pre-refactor-baseline` | ✅ | `da0050a` |
| Safety gate baseline | ✅ | Frontend: 1495 pass. Backend: 10 ts-errors (test files), 4 lint errors. |
| Dual operationId audit | ✅ | 0 duplicates. 2 overlapping-concept endpoints (`createMember` + `DentalMembershipManagement_create`). |
| Cross-module imports | ✅ | 82 prod files / 129 import lines / 140 test files in violation. |
| FK dependency map | ✅ | `patient.schema` is the sole legacy schema with dental-* FKs. 17 schema files affected. |
| CI check for duplicate ops | ✅ | Script + quality.yml job added (see `scripts/check-duplicate-operation-ids.ts`). |
| assert-branch-access diff | ✅ | `shared/` is canonical. `dental-scheduling/utils/` is correct backwards-compat shim. |
| preferences-form divergence | ✅ | Account tests don't run in CI. Divergence cosmetic. Low risk. |
