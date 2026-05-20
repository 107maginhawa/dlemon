---
phase: 04-typespec-migration
plan: "04"
subsystem: dental-org
tags: [typespec, migration, members, branch-config, working-hours, consent-templates]
dependency_graph:
  requires: [04-03]
  provides: [TSMIG-01]
  affects: [specs/api/src/modules/dental-org.tsp, specs/api/src/main.tsp, services/api-ts/src/app.ts]
tech_stack:
  added: []
  patterns: [typespec-interface-extension, re-export-shim]
key_files:
  created:
    - services/api-ts/src/handlers/dental-org/setSecurityQuestion.ts
    - services/api-ts/src/handlers/dental-org/recoverPin.ts
    - services/api-ts/src/handlers/dental-org/getBranchSettings.ts
    - services/api-ts/src/handlers/dental-org/updateBranchSettings.ts
    - services/api-ts/src/handlers/dental-org/getWorkingHours.ts
    - services/api-ts/src/handlers/dental-org/updateWorkingHours.ts
    - services/api-ts/src/handlers/dental-org/listConsentTemplates.ts
    - services/api-ts/src/handlers/dental-org/createConsentTemplate.ts
    - services/api-ts/src/handlers/dental-org/updateConsentTemplate.ts
    - services/api-ts/src/handlers/dental-org/deleteConsentTemplate.ts
  modified:
    - specs/api/src/modules/dental-org.tsp
    - specs/api/src/main.tsp
    - services/api-ts/src/app.ts
decisions:
  - "Prefixed model names with Dental to avoid collisions (DentalWorkingHours, DentalBranchSettings, DentalConsentTemplate)"
  - "recoverPin interface op has no @useAuth — preserves existing public endpoint posture"
  - "Codegen placed workingHours stubs in dental-org/ (matches registry imports); re-export shims forward to dental-scheduling/workingHours.ts"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  files_modified: 13
---

# Phase 04 Plan 04: Flat Members + Branch Config TypeSpec Migration Summary

Migrated 13 remaining manual dental routes (flat member management + branch config) into TypeSpec, completing Phase 04 TypeSpec migration (TSMIG-01).

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Add FlatMemberManagement + BranchConfigManagement to dental-org.tsp | Done |
| 2 | Add main.tsp bindings, run pipeline, clean app.ts, final verification | Done |

## What Was Done

**dental-org.tsp:** Added 13 new request/response models and 2 new interfaces:
- `FlatMemberManagement` (5 ops): listMembers, createMember, resetMemberPin, setSecurityQuestion, recoverPin
- `BranchConfigManagement` (8 ops): getWorkingHours, updateWorkingHours, getBranchSettings, updateBranchSettings, listConsentTemplates, createConsentTemplate, updateConsentTemplate, deleteConsentTemplate

**main.tsp:** Added `FlatMemberMgmt` and `BranchConfigMgmt` bindings under `/dental/org/members` and `/dental/branches` routes.

**10 re-export shim files created:** Codegen generates one file per operationId; shims forward to the multi-export source files (`pinRecovery.ts`, `branchSettings.ts`, `consentTemplates.ts`, `workingHours.ts`).

**app.ts:** Removed all 13 manual route registrations, all associated imports, `dentalAuth` const, and the "not yet in TypeSpec" comment block. `authMiddleware` import removed (no longer referenced).

## Verification

- `bun run build` (TypeSpec): exit 0
- `bun run generate` (codegen): exit 0, 10 new stubs generated
- `bun run typecheck`: exit 0
- `grep dental app.ts` for manual routes: 0 lines (phase goal achieved)
- 13 operationIds present in registry.ts

## Deviations from Plan

**1. [Rule 1 - Bug] Model name collision avoidance — prefixed with Dental**
- **Found during:** Task 1 — healthcare modules already define `WorkingHours`, `BranchSettings`, `ConsentTemplate` in their namespaces
- **Fix:** Named models `DentalWorkingHours`, `DentalWorkingHoursDay`, `DentalBranchSettings`, `UpdateDentalBranchSettingsRequest`, `DentalConsentTemplate`, `CreateDentalConsentTemplateRequest`, `UpdateDentalConsentTemplateRequest`
- **Impact:** None — models are namespace-scoped; only naming changed

**2. [Rule 2 - Auto-add] workingHours re-export shim points to dental-scheduling/**
- **Found during:** Task 2 — codegen placed `getWorkingHours`/`updateWorkingHours` stubs in `dental-org/` (matching registry import path), but actual implementation lives in `dental-scheduling/workingHours.ts`
- **Fix:** Re-export shims in `dental-org/` forward to `../dental-scheduling/workingHours`

## Known Stubs

None — all re-export shims forward to existing production implementations.

## Self-Check: PASSED
