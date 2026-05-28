---
gsd_state_version: 1.0
milestone: "structural-remediation"
milestone_name: milestone
status: in_progress
last_updated: "2026-05-28T12:00:00.000Z"
progress:
  total_phases: 13
  completed_phases: 10
  total_plans: 28
  completed_plans: 28
  percent: 80
---

## Current Position

### Structural Remediation Plan — Phases 0–10 active

Plan file: `~/.claude/plans/id-like-to-understand-wiggly-storm.md`

#### Completed phases (as of 2026-05-27)

- Phase 0 (baseline): ✅ cb4c5c2 — cfbddd1
- Phase 1 (cruft/dead docs): ✅ 4756d47
- Phase 2 (doc truth): ✅ cb4c5c2
- Phase 3 (test hygiene + type cycle): ✅ 2aafb04
- Phase 4 (kill as any): ✅ fecf859
- Phase 6 (generator hardening): ✅ ffd07f2
- Phase 8 (account freeze): ✅ f3f92d9 — README banner added; dentalemon has Tauri too
- Phase 9a (z_pages → __tests__, spike relocated): ✅ f3f92d9
- Phase 5 (dental-org dup): ✅ 47f7a74 — FR6.3 migrated into createMember; DentalMembershipManagement_create deprecated (Sunset: 2026-09-01)
- Phase 9b (cdt-codes relocation, lib/utils docs): ✅ d49a1b1
- Phase 10 (boundary checker): ✅ e39b867 — 99 violations at baseline; check:boundaries script; MODULE_BOUNDARIES.md

#### Remaining phases

- Phase 7 (package extraction: ui, shared-utils, ceph-math) — ~3-5 days
- Phase 9c (large file splits: imaging-workspace.tsx 1051 LOC, others) — deferred
- Phase 10 continued (facade migration: 99 violations → 0, one module at a time)
- Phase 11 (module template + bloated module split) — requires Phase 10 complete
- Phase 12 (legacy module resolution) — HIGH risk, requires Phase 11 complete

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
