---
gsd_state_version: 1.0
milestone: "structural-remediation"
milestone_name: Structural Remediation Plan
status: in_progress
stopped_at: ""
last_updated: "2026-05-27T00:00:00.000Z"
progress:
  total_phases: 13
  completed_phases: 9
  total_plans: 1
  completed_plans: 0
  percent: 69
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

#### Phase 10 violation baseline (2026-05-27)
| Module | Violations |
|--------|-----------|
| dental-imaging | 30 |
| dental-patient | 26 |
| dental-billing | ~~11~~ **0** ✅ |
| dental-org | 6 |
| dental-visit | 6 |
| dental-scheduling | 6 |
| dental-clinical | 6 |
| dental-pmd | 7 |
| dental-perio | 1 |
| **Total** | ~~99~~ **88** |

Next: tackle Phase 7 (package extraction) or continue Phase 10 facade migration (next target: dental-org or dental-perio, 6 and 1 violations respectively).

#### Phase 10 continued
- dental-billing migration complete (2026-05-27): 11 → 0 violations. CI gate active via `check:boundaries:dental-billing` script (exits 1 on any violation).
