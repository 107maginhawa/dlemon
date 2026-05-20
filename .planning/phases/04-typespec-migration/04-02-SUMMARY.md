---
phase: 04-typespec-migration
plan: "02"
subsystem: dental-billing
tags: [typespec, codegen, billing, migration]
dependency_graph:
  requires: [04-01]
  provides: [getPatientBalance-generated, getCollectionsSummary-generated, getDentalPaymentReceipt-generated]
  affects: [services/api-ts/src/generated/openapi/registry.ts]
tech_stack:
  added: []
  patterns: [typespec-interface-extension, billing-extras-migration]
key_files:
  created: []
  modified:
    - specs/api/src/modules/dental-billing.tsp
    - specs/api/src/main.tsp
    - services/api-ts/src/app.ts
    - services/api-ts/src/generated/openapi/registry.ts
    - services/api-ts/src/generated/openapi/routes.ts
    - services/api-ts/src/generated/openapi/validators.ts
decisions:
  - "BillingExtras placed as separate interface inside DentalBillingModule namespace, parallel to InvoiceManagement"
  - "Response models added outside namespace (file-level) to match existing model placement pattern"
  - "BillingExtrasMgmt binding uses same @route('/dental/billing') as DentalBillingMgmt — TypeSpec merges routes correctly"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  files_modified: 6
---

# Phase 04 Plan 02: Dental Billing Extensions TypeSpec Migration Summary

Migrated 3 dental billing extension routes from hand-wired `app.ts` into the TypeSpec pipeline. Routes now go through generated validators and registry.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Add BillingExtras interface to dental-billing.tsp | 7693e92 | Done |
| 2 | Add main.tsp binding, run pipeline, clean app.ts | 7693e92 | Done |

## What Was Built

- `PatientBalanceResponse`, `CollectionsSummaryResponse`, `DentalPaymentReceiptResponse` models in dental-billing.tsp
- `BillingExtras` interface with 3 operations inside `DentalBillingModule` namespace
- `BillingExtrasMgmt` binding in main.tsp at `/dental/billing`
- Pipeline ran clean: `bun run build` → `bun run generate` → `bun run typecheck` all exit 0
- 3 manual routes + 3 imports removed from app.ts

## Verification

- `bun run build` (specs/api): exit 0
- `bun run generate` (services/api-ts): exit 0, 0 new stubs, 182 existing skipped
- `bun run typecheck` (services/api-ts): exit 0
- registry.ts grep: 6 matches (2 per op) for getPatientBalance/getCollectionsSummary/getDentalPaymentReceipt
- app.ts grep for removed routes: 0 matches

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Handler files unchanged; they were pre-existing implementations.

## Threat Flags

None — routes previously existed with identical auth; no new trust boundary surface introduced.

## Self-Check: PASSED

- specs/api/src/modules/dental-billing.tsp: contains BillingExtras interface with 3 operationIds
- specs/api/src/main.tsp: contains BillingExtrasMgmt binding
- services/api-ts/src/app.ts: 0 manual billing-extras routes remain
- Commit 7693e92 confirmed in git log
