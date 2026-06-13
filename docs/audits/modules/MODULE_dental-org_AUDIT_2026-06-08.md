# Module Audit — dental-org

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure
**Verdict:** ✅ **READY** (all SAFE gaps closed; gates green)

---

## STEP 0 — Artifacts & /module-review

| Artifact | Location | Status |
|----------|----------|--------|
| Handler dir | `services/api-ts/src/handlers/dental-org/` | ✅ present (50+ handlers, repos/) |
| TypeSpec | `specs/api/src/modules/dental-org.tsp` | ✅ present |
| MODULE_SPEC | `docs/product/modules/dental-org/MODULE_SPEC.md` | ✅ present |
| API_CONTRACTS | `docs/product/modules/dental-org/API_CONTRACTS.md` | ✅ present |
| Tests | 30+ `*.test.ts` (handlers + repos) | ✅ present |

**/module-review result:** PASS — no `test.skip`/`xtest`, no `Not implemented` stubs, no TODO/FIXME in handler code, repos + tests present, only 1 `as any` in non-test code (boundary-justified).

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file:line) | Strength | Verdict |
|------|-------|-------|----|-----------------|----------|---------|
| **WF-043** Branch-scoped login / membership select | ✅ | ✅ getOrgContext / verifyPin | `flow:manage-membership-rbac` | getOrgContext.test.ts, verifyPin.test.ts | VERIFIED | 🟢 |
| **WF-004** Staff invitation + first login | ✅ | ✅ createMember / createOnboarding | `step:create-member` | createMember.test.ts, createOnboarding.test.ts | VERIFIED | 🟢 |
| **WF-027** Staff member management | ✅ | ✅ create/update/deactivate/listMembers | `flow:manage-membership-rbac` | updateMember/deactivateMember/listMembers.test.ts | VERIFIED | 🟢 |
| **WF-025** Configure fee schedule | ✅ | ✅ feeSchedule / updateFeeScheduleEntry | NONE (KG-backlog) | dental-org.fee-schedule.test.ts:155-190 | VERIFIED | 🟢 |
| **WF-026** Configure branch hours | ✅ | ✅ get/updateWorkingHours | NONE (KG-backlog) | dental-org.clinic-settings.test.ts | VERIFIED | 🟢 |
| **WF-069** Create organization | ✅ | ✅ createOnboarding / DentalOrganizationManagement_create | `flow:onboard-organization` | createOnboarding.test.ts, organization.test.ts | VERIFIED | 🟢 |
| **WF-070** Create branch | ✅ | ✅ DentalBranchManagement_create | `domain:org-tenancy` | DentalBranchManagement_create.test.ts | VERIFIED | 🟢 |
| **WF-072** Membership revocation | ✅ | ✅ deactivateMember | `step:deactivate` | deactivateMember.test.ts:123-144 | VERIFIED | 🟢 |
| **WF-028** View audit log | ✅ | ✅ proxy → dental-audit | `flow:audit-trail` | (canonical in dental-audit) | VERIFIED | 🟢 |
| **WF-029** Export practice reports | ✅ | ✅ getDashboardSummary | NONE | dental-org.dashboard-summary-extended.test.ts | VERIFIED | 🟢 |
| **BR-016** assertBranchAccess → 403 non-member | ✅ | ✅ assert-branch-access.ts | `domain:org-tenancy` | fee-schedule.test.ts:155, business-rules.test.ts (×3) | VERIFIED | 🟢 |
| **BR-016b** PIN lockout (429 + escalation) | ✅ | ✅ verifyPin.ts | `step:verify-pin` | verifyPin.test.ts:191-235 (429, 5-min escalation, reset) | VERIFIED | 🟢 |
| **BR-016c** imagingTier gate blocks ceph | ✅ | ✅ (dental-imaging) | `step:create-study` | dental-imaging/ceph-business-rules.test.ts | VERIFIED (cross-module) | 🟢 |
| **AC-ORG-001** Branch access enforced | ✅ | ✅ | — | assert-branch-access + 403 tests | VERIFIED | 🟢 |
| **AC-ORG-002** Fee schedule → new invoice default | ✅ | ✅ per-branch override | — | fee-schedule.test.ts:178-190 (override-wins/default) | PARTIAL (invoice default is billing-side) | 🟡 |
| **AC-ORG-003** Invitation → active membership | ✅ | ✅ | `step:create-member` | createOnboarding.test.ts | VERIFIED | 🟢 |
| **State machine** invited→active→inactive | ✅ | ✅ transitionStatus | — | membership.test.ts:187-235 (legal + illegal-jump 422) | VERIFIED | 🟢 |
| **RBAC** owner-only create member | ✅ | ✅ assertBranchRole | — | createMember.test.ts:220,238 (403 staff_full/associate) | VERIFIED | 🟢 |
| **RBAC** owner-only deactivate | ✅ | ✅ | — | deactivateMember.test.ts:123,144 (403 non-owner/no-membership) | VERIFIED | 🟢 |
| **RBAC** owner-only role change (self-promotion guard) | ✅ | ✅ updateMember.ts:49-63 | — | updateMember.test.ts (NEW: 403 non-owner + unchanged-role) | VERIFIED (was NONE) | 🟢 |
| **RBAC** owner-only fee schedule | ✅ | ✅ | — | fee-schedule.test.ts:160 (403 staff_full) | VERIFIED | 🟢 |
| **RBAC** cross-org PIN isolation | ✅ | ✅ | — | auth-security-hardening.test.ts:167 (CF-38 cross-org 403) | VERIFIED | 🟢 |

KG coverage for dental-org is strong: `domain:org-tenancy`, `flow:onboard-organization`, `flow:manage-membership-rbac` (+steps create-member/set-permissions/set-pin/verify-pin/deactivate), `flow:audit-trail`. Fee-schedule / working-hours / dashboard steps are KG-backlog (NONE) — lossy graph, not a blocker.

---

## Ranked Gaps & Disposition

| # | Gap | Class | Disposition |
|---|-----|-------|-------------|
| 1 | `updateMember` role-change had **no adversarial test** for the non-owner self-promotion guard (G7-S3, `updateMember.ts:49-63`) — privilege-escalation gate unproven | REAL test gap | ✅ **CLOSED** — added 403-non-owner test (+ unchanged-role assertion) and a positive non-role-field test (updateMember.test.ts) |
| 2 | MODULE_SPEC §6 Member Role Catalog claimed **9** roles, omitting `treatment_coordinator`; ground-truth enum has **10** | doc drift | ✅ **CLOSED** — 9→10 + added `treatment_coordinator` row |
| 3 | MODULE_SPEC §7 `member_role` validation listed a stale 4-role set | doc drift | ✅ **CLOSED** — now references §6 (10-role catalog) |
| 4 | API_CONTRACTS listed membership `status` as `revoked`, omitting `inactive`; implemented lifecycle uses `inactive` and explicitly rejects `revoked` (`membership.repo.ts:22`) | doc/contract drift | ✅ **CLOSED** — status → `inactive`; added implementation note (deactivate = DELETE→204) |
| 5 | br-registry `dental-org` block listed only BR-016; BR-016b (PIN lockout) implemented + tested but absent | registry drift | ✅ **CLOSED** — added BR-016b with source + test ref |
| 6 | BR-016c (imagingTier gate) is declared in dental-org §5 but enforced/tested in dental-imaging | cross-module attribution | ⏭️ Deferred to **dental-imaging** audit round (avoid mis-attributing registry entry) |
| 7 | EM-AUD-013: audit-viewer query params camelCase + `limit`/`offset` vs snake_case+`page`; PIN endpoints absent from `sdk-ts` (no FE consumer) | known tracked | No action — already documented in MODULE_SPEC §10 |

**Not-safe / surfaced only:** none requiring schema migration or new feature build this round.

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| dental-org backend suite (`test-with-db.ts`) | ✅ **329 pass / 0 fail** |
| `eslint` (changed test) | ✅ clean |
| `check:boundaries:dental-org` | ✅ no cross-module violations |
| Contract suite (`:7213`) | N/A — doc/registry/test-only changes; no TypeSpec/handler/SDK wire change this round |

---

## Files Changed

- `services/api-ts/src/handlers/dental-org/updateMember.test.ts` — +2 adversarial tests (G7-S3)
- `docs/product/modules/dental-org/MODULE_SPEC.md` — role catalog 9→10, §7 enum reference
- `docs/product/modules/dental-org/API_CONTRACTS.md` — status `revoked`→`inactive` + impl note
- `specs/api/docs/standards/br-registry.json` — added BR-016b
- `docs/audits/modules/MODULE_dental-org_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — rollup entry
