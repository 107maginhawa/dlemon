# AHA Module/Group Fix Report: Dental Org & Staff

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Org & Staff (org/branches/memberships/settings/onboarding/PIN) |
| Module slug | dental-org |
| Raw gap plan used | `docs/aha/module-gap-plans/dental-org-gap-plan.md` |
| Fix-ready plan used | `docs/aha/module-fix-plans/dental-org-fix-ready-plan.md` |
| Output fix report | `docs/aha/module-fix-plans/dental-org-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A — Staff edit (P1); Batch B appended below when executed |
| Superpowers used | Yes (`superpowers:test-driven-development` + `superpowers:verification-before-completion`) |
| Working tree status checked | Yes — clean before Batch A |
| Fix scope | P1 (FIX-001) + V1 RECOMMENDED test pins (FIX-002 staff portion) |
| Out of scope | Batch C (PIN recovery, Q2), Batch D (multi-branch, Q1), invite flow, permission grid, Batch-4 landing rework |
| Shared files touched | No (Batch A is fully module-local) |
| Schema/migration touched | No |
| Limitations | None for Batch A |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: staff cannot be edited — no FE affordance for `updateMember` | P1 | V1 REQUIRED | A | Only P1 in module; FR6.1-explicit; eliminates deactivate+recreate workaround | Fixed |
| FIX-002 (staff portion) | GAP-8: staff FE tests assert helpers only | P3 | V1 RECOMMENDED `[TEST GAP]` | A | Prevents fake-green wiring of FIX-001 | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `bun test src/features/staff/` | All existing (helper-only) tests pass | FIX-001/002 | Confirmed GAP-8: no rendered/mutation assertions existed |
| New RED tests (3 files) | staff-edit-modal.test.tsx: module-not-found (component absent); staff-list.render: owner-Edit-affordance + open-modal FAIL (no Edit button); create-modal pin: PASS (pins existing wiring) | FIX-001/002 | Failures confirmed for the expected reasons before implementation |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-001 | New `StaffEditModal` (prefilled role/displayName/license/NPI/credential; changed-fields-only PATCH; owner-row role locked); Edit affordance per row (owner-only) in `staff-list.tsx`; `update` mutation added to `useStaffMutations` (invalidates list); `Member` view-model extended with licenseNumber/npi/credentialType | `staff-edit-modal.tsx` (new), `staff-list.tsx`, `use-staff-members.ts` | No | Backend untouched; uses existing `updateMemberMutation` SDK hook (verified present, no regen needed) |
| FIX-002 | Rendered mutation-call pins: edit PATCH url+body, create POST body + reset-pin body, affordance RBAC gating | `staff-edit-modal.test.tsx`, `staff-list.render.test.tsx`, `staff-create-modal.render.test.tsx` (all new) | No | global.fetch mock per repo convention (no mock.module); pre-existing helper-only tests left intact |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `apps/dentalemon/src/features/staff/components/staff-edit-modal.test.tsx` | frontend/component | Prefill from member; Save PATCHes `/dental/org/members/{id}` with changed role + credentials; no-edit ⇒ no PATCH; blank-name validation blocks save | FIX-001 |
| `apps/dentalemon/src/features/staff/components/staff-list.render.test.tsx` | frontend/component + permission/RBAC | Owner sees Edit per row; non-owner sees none; Edit opens modal prefilled with that member | FIX-001 |
| `apps/dentalemon/src/features/staff/components/staff-create-modal.render.test.tsx` | frontend/regression | Create posts `{displayName, role}` to branch-scoped endpoint then sets PIN via reset-pin | FIX-002 |
| `apps/dentalemon/tests/e2e/add-staff.spec.ts` (extended) | E2E/Playwright | FR6.1 journey: owner edits associate role → badge updates → persists after full reload | FIX-001 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/features/staff/` (apps/dentalemon) | Passed | 46/0 |
| `bun test src/` (full FE suite) | Passed | 2248 pass / 0 fail |
| `bun run typecheck` (apps/dentalemon) | Passed | tsc --noEmit clean |
| `bunx playwright test tests/e2e/add-staff.spec.ts -g "owner edits" --project=chromium` | Passed | 1/1 (12.3s, API+app auto-booted) |

## 7. Validation Summary

All Batch A validation passed: focused RED→GREEN component tests, full FE suite (no regressions), FE typecheck, and the browser-level role-edit persistence journey. No backend, contract, or schema surface was touched, so backend/contract gates were not required for this batch.

## 8. Shared / Cross-Module / Database Impact

None — Batch A touched only `features/staff/` and one E2E spec.

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Settings shell + consent templates | FIX-003/004 + FIX-002 settings portion | Batch B — next selected batch | Run Batch B in this 04 pass (per user instruction) |
| Doc reconcile | FIX-005/006 | Batch E not yet run | Piggyback on a later pass |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| PIN recovery UI (Batch C) | `[NEEDS PRODUCT DECISION]` | Q2 unresolved (self-service vs owner-reset-only on shared device) | Product decision Q2 |
| Multi-branch UI (Batch D) | `[NEEDS PRODUCT DECISION]` | Q1 unresolved (V1-launch vs growth scope) | Product decision Q1 |
| Tier-limit enforcement check (FR6.3) | `[NEEDS CONFIRMATION]` | Q3 verify-then-classify not yet performed | Quick eng check |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Invite-email flow | V2 DEFERRED | Direct-add+PIN is the decided model |
| Permission-grid revival, org-scoped membership API expansion | DO NOT ADD | G3 decision final; duplicate path |
| Generic settings-panel plugin framework | `[DO NOT OVERBUILD]` | Batch B ships a minimal registry only |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `apps/dentalemon/src/features/staff/components/staff-edit-modal.tsx` | New edit modal (PATCH changed fields only) | FIX-001 |
| `apps/dentalemon/src/features/staff/components/staff-list.tsx` | Edit affordance per row (owner-only) + modal mount | FIX-001 |
| `apps/dentalemon/src/features/staff/hooks/use-staff-members.ts` | `update` mutation + Member credential fields | FIX-001 |
| `apps/dentalemon/src/features/staff/components/staff-edit-modal.test.tsx` | New rendered tests | FIX-001/002 |
| `apps/dentalemon/src/features/staff/components/staff-list.render.test.tsx` | New rendered RBAC/affordance tests | FIX-001/002 |
| `apps/dentalemon/src/features/staff/components/staff-create-modal.render.test.tsx` | New create mutation pin | FIX-002 |
| `apps/dentalemon/tests/e2e/add-staff.spec.ts` | FR6.1 role-edit persistence journey | FIX-001 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| Test output recorded in this report §6 (RED runs + GREEN runs + E2E pass) | this file | all |

## 14. Completion Decision

`COMPLETE` (Batch A) — the selected batch (FIX-001 + FIX-002 staff portion) was fixed RED-first, all relevant validation ran and passed, no regressions.

## 15. Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for **Batch B — settings shell + consent templates** (`docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`), which unblocks the data-governance retention panel and dental-pmd cert panel mounts.
