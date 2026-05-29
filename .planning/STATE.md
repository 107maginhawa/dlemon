---
gsd_state_version: 1.0
milestone: "structural-remediation"
milestone_name: milestone
status: in_progress
last_updated: "2026-05-29T07:30:00.000Z"
progress:
  total_phases: 13
  completed_phases: 10
  total_plans: 28
  completed_plans: 27
  percent: 77
---

## Current Position

### Structural Remediation Plan — Phases 0–10 active

Plan file: `~/.claude/plans/id-like-to-understand-wiggly-storm.md`

#### Completed phases (as of 2026-05-28)

- Phase 0 (baseline): ✅ (prior session)
- Phase 1 (cruft/dead docs): ✅ (prior session)
- Phase 2 (doc truth): ✅ (prior session)
- Phase 3 (test hygiene + type cycle): ✅ bc31a60f — removed vestigial ChartEntryClassification re-export from tooth-slideout
- Phase 4 (kill as any): ✅ d027c067 — replaced ctx as any → ctx as BaseContext in 9 imaging shims
- Phase 5 (dental-org dup): ✅ 47f7a749 — FR6.3 migrated into createMember; DentalMembershipManagement_create deprecated (Sunset: 2026-09-01)
- Phase 6 (generator hardening): ✅ 38142fe0 — duplicate operationId detection in generateRegistry()
- Phase 7a (packages/ui): ✅ (prior session)
- Phase 7b (packages/shared-utils): ✅ (prior session)
- Phase 7c (packages/ceph-math): ✅ (prior session)
- Phase 8 (account freeze): ✅ b9aee2d8 — CLAUDE.md monorepo structure updated; README banner already in place
- Phase 9a/9b (dentalemon src cleanup): ✅ a3708288 + 5faa4783 — services/→features/notifications/, utils/→lib/
- Phase 9c (large file splits): ✅ 8af49db9 (prior session)
- Phase 10 (boundary lint + CODEOWNERS): ✅ 233bad8b — 99→0 violations, check:boundaries:error exits 0
- Phase 11 (module template + bucket): ✅ 739388e9 — dental-visit/clinical/patient bucketed
- Phase 12 (legacy fate decisions): ✅ 2119b423 — MODULE_FATE.md decisions documented

#### Remaining phases

**All Phases 0–12 complete.** See future work in plan file §Future Work (F1–F7).

Outstanding deferred items (from plan §Future Work):

- F1: ✅ CLOSED 2026-05-28 — Renamed 21 ticket-ID test files to descriptive names (dental-visit.treatment-templates, dental-billing.payment-plan-fsm, acceptance.billing-payments, etc.); SA-GLOBAL-006 resolved
- F2: Backend service-layer/DI refactor (after Phases 10+11) — READY, unblocked after enforce-fix Wave 3 complete (2026-05-29)
- enforce-fix Wave 3: ✅ COMPLETE 2026-05-29 — 56 P0 security findings fixed (auth bypass, HIPAA audit trails, IDOR, lock gates, FSMs, domain events); 22 blocked pending F2 or architectural rename; 24 TDD_PROOF artifacts; ENFORCEMENT_FIX_REPORT.md written at docs/audits/; HANDOFF.json deleted (267db942)
- enforce-fix run-7 EF-ORG-P016 + EM-PAT-009 prod gap: ✅ COMPLETE 2026-05-29 (HEAD 8a659747) — **EF-ORG-P016** fee-schedule `GET/PATCH /dental/fee-schedule` implemented (45398d0a): active CDT procedure-code catalog via new `dental-visit/repos/visit-org.facade.ts` (8c4c5672) + per-branch overrides on `dental_branch.settings.feeSchedule`; dentist_owner|associate read, owner-only PATCH (role check precedes CDT-validity check), camelCase wire, 18 tests incl. real-createApp registration smoke; API_CONTRACTS.md aligned off stale snake_case. WF-028 audit-log viewer (`getAuditEvents.ts`) was already built. **EM-PAT-009** real prod gap closed (8a659747): generated registry wired the unguarded duplicate `engagement/addFollowUpNote.ts` (registry.ts:136) while tests hit the guarded `followUpNotes.ts` → archived patients silently accepted notes (201 not 422); duplicate collapsed to a re-export, harness now imports the registry's module. Gates: typecheck steady at 42 pre-existing; 0 new test failures (baseline-diff); 0 new boundary violations. DEFERRED minor: `acceptTreatmentPlan` archived-guard needs a cross-module patient-status facade (no dental-visit handler does patient-level archived checks today).
- enforce-fix run-7 remaining P0s: ✅ COMPLETE 2026-05-29 — EF-ORG-P015 + EM-PAT-001/002/003 were already fixed in Wave4 (c6af4266 recoverPin assertBranchAccess; cf03d64e export/bulk-archive/restore assertBranchRole(['dentist_owner'])); handoff was stale. Added the missing negative-path regression locks: cross-branch recoverPin → 403 (712b2d76, dental-org-auth-p0 21 pass/0 fail) and non-owner export/bulk-archive/restore → 403 (024a7822, dental-patient 58 pass/0 fail). Test-only, no prod change. typecheck 0 new errors (42 pre-existing broken-import test files unchanged).
- enforce-fix Wave 4 + run-7 cleanup: ✅ COMPLETE 2026-05-29 — Wave4 committed (267e7311: 40 P0s, 4 BLOCKED). Post-Wave4 cleanup wave resumed & verified: EF-PMD-005 source provenance (14ad066f), EF-PAT-004 branch-level authz on 26 dental-patient sub-resource handlers + fixture-collision fix (f4ead31f), run-7 audit docs (c6d94478). **Plus discovered+fixed a pre-existing fresh-DB blocker**: migration 0067 re-dropped FK constraints already removed by 0066 → bare DROP CONSTRAINT now IF EXISTS in 0066/0067/0068 (f75c6f4c); programmatic migrator + CI bootstrap unblocked. Gates: typecheck 0 new errors (42 pre-existing test-import-path breakage remain); full suite 0 new failures vs HEAD (2245 pass / 133 fail, all pre-existing; wave fixed 15). Dead `inet` import in dental-audit schema reverted (abandoned edit, no column/migration). 3 createDentalPatient validation fails + 4 broken-import test files are pre-existing, NOT in scope.
- F3: Schema unification legacy↔dental-* (multi-quarter, H2 2026→H1 2027)
- F4: Offline-sync/Tauri (cadence stub activation) — separate milestone
- F5: ✅ CLOSED 2026-05-28 — sample-workspace role documented in ARCHITECTURE.md (Frontend App Roles section); SA-GLOBAL-001 resolved
- F6: ✅ CLOSED 2026-05-28 — spec-change freeze lifted; TypeSpec workflow + generator safety documented in ARCHITECTURE.md (TypeSpec Change Safety section) and CONTRIBUTING_API.md
- F7: ✅ CLOSED 2026-05-28 — File Organization 6.5 → ≥ 8.0 (3 large components split, 8 Ceph handlers shimmed to camelCase, MODULE_MAP.md updated)

#### Phase 10 violation baseline → COMPLETE (2026-05-28)

| Module | Violations | Status |
|--------|-----------|--------|
| dental-imaging | 30 | ✅ 0 (e5f2b849) |
| dental-patient | 26 | ✅ 0 (48f09cb6) |
| dental-billing | 11 | ✅ 0 (prior) |
| dental-org | 6 | ✅ 0 (prior) |
| dental-visit | 6 | ✅ 0 (prior) |
| dental-scheduling | 6 | ✅ 0 (prior) |
| dental-clinical | 6 | ✅ 0 (prior) |
| dental-pmd | 7 | ✅ 0 (dffc9368) |
| dental-perio | 1 | ✅ 0 (prior) |
| **Total** | ~~99~~ | **✅ 0 — `check:boundaries:error` exits 0** |

**Phase 10 fully complete.** `bun run check:boundaries:error` exits 0. Per-module CI scripts active for all 8 modules.

Next: Phase 11 (module template + bloated module split) — now unblocked by Phase 10 completion.

#### Phase 10 facade migration history

- dental-billing (2026-05-27): 11 → 0 via `patient-billing.facade.ts`, `org-billing.facade.ts`
- dental-perio, dental-org, dental-visit, dental-scheduling, dental-clinical (2026-05-28): prior session
- dental-pmd (2026-05-28): 7 → 0 via `visit-pmd.facade.ts`, `clinical-pmd.facade.ts`, `patient-pmd.facade.ts`
- dental-patient (2026-05-28): 26 → 0 via `patient-dental-patient.facade.ts`, `person-dental-patient.facade.ts`, `visit-dental-patient.facade.ts`
- dental-imaging (2026-05-28): 30 → 0 via `org-imaging.facade.ts`, `clinical-imaging.facade.ts`
