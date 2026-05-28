# Dentalemon V1 — Full Enforcement Report
<!-- oli-enforce-all v1.0 | generated: 2026-05-29 | run: run-6-strict | modules: 11 | agents: 31 -->
<!-- flags: --strict | mode: full-run, all 22 sections, every file, all phases -->

---

## ⛔ STRICT MODE VIOLATION

**56 new P0 regressions detected vs run-5 baseline. Build gate FAILS.**

Top regression sources:
- `EF dental-clinical`: 10 handlers missing `assertBranchAccess` (inventory×5, occlusion×2, postop×3) — **NEW P0×11**
- `AL audit-compliance`: 16/25 mandatory audit contracts missing — **NEW P0×13**
- `EF dental-imaging`: 5 ceph handlers missing `assertBranchAccess` — **NEW P0×5**
- `EF dental-org`: IDOR on branch create/list + member deactivate canonical — **NEW P0×5**
- `EX cross-module`: emr/ imports PatientRepository directly, imaging_finding FKs — **NEW P0×7**
- `EF dental-pmd`: checksum validation never executed — **NEW P0×3**
- `EF dental-patient`: cross-branch PHI leak via `listByOrg()` — **NEW P0×3**
- `EF dental-visit`: lock gate missing on 3 write handlers — **NEW P0×3**

---

## Audit Scope

| Field | Value |
|-------|-------|
| Run ID | `run-6-strict-2026-05-29` |
| Git SHA | `e67c58b9` |
| Modules | 11 dental domain modules |
| Phase -1 | SKIP (codebase_map.auto_phase not set) |
| Phase -0.5 | SKIP (no map artifacts) |
| Phase 0 | ✅ Coverage (34 EC- findings) |
| Phase 1 | ✅ 22 agents: enforce-module×11 + enforce-file×11 |
| Phase 1.5 | ✅ UI Journey: imaging, billing, patient, scheduling, pmd |
| Phase 2 | ✅ Cross-module (EX) |
| Phase 2.5 | ✅ Traceability (TR) — WORKFLOW_MAP exists |
| Phase 3 | ✅ Audit Compliance (AL) — AUDIT_CONTRACTS exists |
| Total agents | 31 |
| Strict mode | FAIL — 56 new P0 regressions |

---

## Executive Summary

| Metric | Run-5 | Run-6 | Delta |
|--------|-------|-------|-------|
| Total findings | 323 | 380 | +57 ↑ |
| P0 (blocker) | ~31 | **78** | +47 ↑ |
| P1 (functional gap) | ~55 | **145** | +90 ↑ |
| P2 (incomplete) | ~170 | 114 | -56 ↓ |
| P3 (improvement) | ~67 | 43 | -24 ↓ |
| New findings | 84 | 156 | +72 |
| Resolved | 18 | 18 | — |
| Known | 221 | 206 | -15 |
| Avg compliance score | 49.6 | **44.5** | -5.1 ↓ |
| Modules: NOT_READY | 4 | 4 | — |
| Modules: PARTIAL | 5 | 5 | — |
| Modules: BLOCKED | 0 | 1 | +1 |
| Modules: FUTURE_PHASE | 1 | 1 | — |
| Modules: READY | 0 | 0 | — |

**Why P0/P1 jumped:** Run-6 used stricter enforcement — every handler file individually checked for `assertBranchAccess` (run-5 sampled), audit compliance phase is new (25 AL findings), UI journey is new (50 UJ findings). The codebase itself did NOT regress; run-5 under-counted.

---

## Coverage Findings (Phase 0)

> Full details: `docs/audits/ENFORCEMENT_COVERAGE.md`

| Module | Breadth% | Depth% | Score | Gap Sections |
|--------|----------|--------|-------|--------------|
| dental-audit | 50 | 41 | 41 ⚠️ | §4 Workflow Details, §9 UI, §12 Tests, §13 Edge Cases, §15 Errors, §18 Flags |
| dental-billing | 100 | 95 | 95 ✅ | — |
| dental-clinical | 93 | 100 | 100 ✅ | — |
| dental-emr-integration | 50 | 41 | 41 ⚠️ | §4, §9, §12, §13, §15, §18 |
| dental-imaging | 95 | 100 | 100 ✅ | — |
| dental-org | 83 | 100 | 100 ✅ | — |
| dental-patient | 85 | 100 | 100 ✅ | — |
| dental-perio | 100 | 95 | 95 ✅ | — |
| dental-pmd | 71 | 64 | 64 ⚠️ | §4, §9, §10b, §15 stubs |
| dental-scheduling | 83 | 91 | 91 ✅ | — |
| dental-visit | 93 | 100 | 100 ✅ | — |

Phase 0 gate: no module below 40% — **PASS** (warn-only). 3 modules in warning zone (41%, 41%, 64%).

---

## Module Compliance (Phase 1 — enforce-module)

> Per-module details: `docs/audits/enforce/module/{name}.md`

| Module | Score R5→R6 | P0 | P1 | P2 | P3 | v1_status | Trend |
|--------|------------|----|----|----|----|-----------|-------|
| dental-audit | 28→**0** | 2 | 7 | 4 | 3 | NOT_READY | ↓ |
| dental-billing | 61→**55** | 1 | 6 | 5 | 1 | NOT_READY | ↓ |
| dental-clinical | 66→**58** | 3 | 6 | 4 | 1 | NOT_READY | ↓ |
| dental-emr-integration | 22→**20** | 3 | 7 | 3 | 1 | FUTURE_PHASE | ↓ |
| dental-imaging | 44→**46** | 0 | 10 | 5 | 1 | PARTIAL | ↑ |
| dental-org | 54→**59** | 4 | 7 | 4 | 2 | PARTIAL | ↑ |
| dental-patient | 41→**37** | 4 | 6 | 7 | 5 | NOT_READY | ↓ |
| dental-perio | 41→**38** | 0 | 4 | 5 | 2 | PARTIAL | ↓ |
| dental-pmd | 49→**44** | 2 | 7 | 4 | 1 | **BLOCKED** | ↓ |
| dental-scheduling | 68→**70** | 1 | 2 | 2 | 1 | PARTIAL | ↑ |
| dental-visit | 72→**62** | 4 | 6 | 3 | 1 | NOT_READY | ↓ |

**Critical EM P0s (inline):**

- `EM-AUD-005` P0 — `setPin` writes no audit event; `EM-AUD-006` P0 — append-only not enforced at HTTP level
- `EM-BIL-001` P0 — `listDentalInvoices` no auth when `branchId` omitted → all-branch invoice enumeration
- `EM-CLI-001` P0 — `revokeConsentForm` handler entirely absent (WF-035 unimplemented)
- `EM-CLI-002` P0 — `updateMedicalHistoryEntry` mutates append-only PHI resource (must return 405)
- `EM-CLI-012` P0 — prescription schema missing `status` field; FSM pending/dispensed/cancelled nonexistent
- `EM-EMR P0×3` — route collision `/emr/:patientId` vs `/emr/:id`, spec DELETE contradiction, wrong-domain impl
- `EM-ORG-001` P0 — `recoverPin` route missing `authMiddleware` — unauthenticated access
- `EM-ORG-006` P0 — `GET /dental/organizations/:id` IDOR — no ownership/membership check
- `EM-PAT-001` P0 — `roles:['user']` on all dental-patient routes — any authenticated user can archive/export patients
- `EM-PAT-002` P0 — `archiveDentalPatient` uses `assertBranchAccess` not `assertBranchRole(['dentist_owner'])`
- `EM-PAT-003` P0 — `archiveDentalPatient` never parses reason body
- `EM-PAT-004` P0 — `listDentalPatients` org-expands `branchId` via `listByOrg()` — cross-branch PHI leak
- `EM-PMD P0-1` P0 — `GET /dental/pmd/:id/download` endpoint missing entirely
- `EM-PMD P0-2` P0 — PATCH/DELETE imported_pmd returns 404 not 405 IMPORTED_PMD_IMMUTABLE
- `EM-SCH P0` P0 — all 6 scheduling routes use `roles:['user']` — any user books/cancels/checks-in
- `EM-VIS-010` P0 — all 6 domain events (DE-001–DE-006) never emitted; zero `emit`/`publish` calls
- `EM-VIS-011` P0 — WF-046 pg-boss lock-visit job absent; `completed→locked` has no automated path
- `EM-VIS-007` P0 — `upsertVisitNotes` checks locked-only, not completed — SOAP notes writable to completed visit

---

## File Compliance (Phase 1 — enforce-file)

> Per-module details: `docs/audits/enforce/file/{name}.md`

| Module | Files | Auth Missing | P0 | P1 | P2 | P3 |
|--------|-------|-------------|----|----|----|----|
| dental-audit | 5 | 0 | 0 | 3 | 1 | 0 |
| dental-billing | 35 | 0 | 0 | 2 | 5 | 2 |
| dental-clinical | 27 | **10** | **11** | 2 | 1 | 1 |
| dental-emr-integration | 12 | n/a | 1 | 2 | 5 | 0 |
| dental-imaging | 53 | **5** | **5** | 2 | 2 | 2 |
| dental-org | 67 | **5** | **5** | 4 | 3 | 2 |
| dental-patient | 82 | 0 | **3** | 3 | 2 | 1 |
| dental-perio | 12 | 0 | 1 | 1 | 1 | 0 |
| dental-pmd | 13 | 0 | **3** | 3 | 1 | 1 |
| dental-scheduling | 26 | 0 | **2** | 0 | 1 | 1 |
| dental-visit | 61 | 0 | **3** | 2 | 2 | 0 |

**Critical EF P0s (inline):**

- `EF-CLI P0×10` — `assertBranchAccess` absent from inventory×5, occlusion×2, postop×3 handlers
- `EF-CLI P0` — `updateMedicalHistoryEntry.ts` live PATCH on append-only resource
- `EF-EMR-001` P0 — `handlers/emr/` wrong-domain module (consultation notes ≠ EMR import)
- `EF-IMG P0×5` — `createCephReport`, `batchUpsertCephLandmarks`, `recomputeCephAnalysis`, `deleteCephLandmark`, `updateCephLandmark` all missing `assertBranchAccess`
- `EF-IMG P1` — `imagingTier` gate uses `=== 'free'` not `=== 'cbct'` — wrong comparison
- `EF-ORG P0` — `DentalBranchManagement_create`: no ownership check; any user adds branches to any org
- `EF-ORG P0` — `DentalBranchManagement_list`: no org-access guard; exposes all org branches
- `EF-ORG P0` — `createMember`: missing `dentist_owner` role check; any staff can invite/promote
- `EF-ORG P0` — `DentalMembershipManagement_deactivate` (canonical): any branch member can deactivate owner
- `EF-ORG P0` — `getFeeSchedule`, `updateFeeSchedule`, `getAuditEvents` handlers not implemented
- `EF-PAT-001` P0 — archived patient write-block never enforced across 15 write handlers
- `EF-PAT-002` P0 — consent error is 400 (ValidationError) not 422 CONSENT_REQUIRED
- `EF-PAT-003` P0 — `listDentalPatients` silently expands to all-org branches; AC-PAT-004 violated
- `EF-PER-001` P0 — `upsertToothReading` never fetches parent visit; locked-visit writes succeed
- `EF-PMD-001` P0 — `importPMD.ts` reads `body.checksum` but never validates against content
- `EF-PMD-002` P0 — no 405 rejection on PATCH/PUT/DELETE imported_pmd routes
- `EF-PMD-003` P0 — `markSafetyFloorMerged()` issues UPDATE on immutable imported_pmd
- `EF-SCH-001` P0 — DE-010 `AppointmentBooked` + DE-011 `AppointmentCancelled` never published
- `EF-SCH-002` P0 — no service layer; direct repo instantiation in all handlers
- `EF-VIS P0×3` — `updateDentalTreatment`, `updateTooth`, `upsertDentalChart` allow writes to locked visits

**Service layer status across all modules:**
PRESENT: dental-audit (AuditLogRepository), dental-visit (visit.service.ts — UNUSED by handlers)
PRESENT_UNUSED: dental-visit
ABSENT: dental-billing, dental-clinical, dental-emr-integration, dental-imaging, dental-org, dental-patient, dental-perio, dental-pmd, dental-scheduling

---

## Cross-Module Compliance (Phase 2)

> Details: `docs/audits/enforce/cross-module.md`

| Metric | Value |
|--------|-------|
| P0 findings | 7 |
| P1 findings | 24 |
| P2 findings | 2 |
| Event coverage | **0%** (23/24 events never emitted) |
| Import violations | 7 |
| FK violations | 3 (imaging_finding.schema.ts) |
| New vs run-5 | 8 new (run-5 25 FK P0s RESOLVED via MODULE_BOUNDARIES.md) |

**Critical EX P0s:**

- `EX-004` P0 — `handlers/emr/` directly instantiates `PatientRepository` in 4 files — no facade, not exempt
- `EX-007` P0 — `imaging_finding.schema.ts` imports raw schemas from dental-visit, dental-patient, dental-org
- `EX-031` P0 — `imaging_finding.schema.ts` uses hard Drizzle `.references()` to 3 foreign modules — contradicts dental-imaging loose-coupling rule

**EX P1 (mass finding):**
- `EX-008–030` P1×23 — DE-001 through DE-023 **never emitted** anywhere in the codebase. Infrastructure exists (pg-boss consumer, publishAuditEvent) but zero producer call sites. This is the root cause of the domain event gap across dental-visit, dental-scheduling, dental-billing, dental-clinical, dental-imaging.

---

## UI Journey (Phase 1.5)

> Details: `docs/audits/enforce/ui-journey.md`

| Module | Total | P0 | P1 | P2 | P3 |
|--------|-------|----|----|----|----|
| dental-imaging | 9 | 0 | 1 | 7 | 1 |
| dental-billing | 12 | 0 | 4 | 6 | 2 |
| dental-patient | 11 | 0 | 4 | 5 | 2 |
| dental-scheduling | 11 | 0 | 5 | 4 | 2 |
| dental-pmd | 7 | 0 | 1 | 5 | 1 |
| **Total** | **50** | **0** | **15** | **27** | **8** |

All UJ findings are NEW (first UI journey enforcement run). No P0s — P1s are role-gating and consent flow gaps.

Key P1 UJ findings: `UJ-PAT-001` consent modal only submits `marketing_consent`, missing 3 required consent fields; `UJ-PAT-002/003` archive/export actions not role-gated in UI; `UJ-SCH P1×5` calendar has no conflict error, no double-booking feedback, working hours violations silent; `UJ-BIL P1×4` no void confirmation, issue-invoice transition not visible.

---

## Traceability (Phase 2.5)

> Details: `docs/audits/enforce/trace.md`

| Metric | Run-5 | Run-6 | Delta |
|--------|-------|-------|-------|
| Orphan BRs (5a) | 12 | 6 | -6 ↓ |
| Orphan Ops (5b) | 3 | 4 | +1 |
| Unspecced impls (5c) | 33 | 33 | — |
| Dead specs (5d/5e) | 0 | 6 | +6 NEW |
| New findings | 84 | 11 | net |

**Critical TR findings:**

- `TR-021` P1 — FUTURE_PHASE breach: 6 `handlers/emr/` consultation note handlers exist that the spec explicitly says not to implement until Phase 3+
- `TR-015/016` P1 — Dead spec: AC-CLI-006 (completed-visit write guard) + AC-IMG-002 (annotation reversal) have spec ACs but no behavioral test coverage
- `TR-WF-042` P1 — New orphan op: perio MODULE_SPEC references WF-038 (Clinical Amendment) instead of WF-042 — routing error
- 33 unspecced shim handlers (KNOWN/carry-forward from run-5)

---

## Audit Logging Compliance (Phase 3)

> Details: `docs/audits/enforce/audit-compliance/dental-audit.md`

| Metric | Value |
|--------|-------|
| Contracts checked | 25 |
| Contracts implemented | **9/25** (36%) |
| Contracts missing | **16/25** (64%) |
| Schema gaps | 5 missing fields |
| P0 findings | **13** |
| P1 findings | 3 |
| P2 findings | 3 |
| P3 findings | 6 |

**All 25 AL findings are NEW** — audit compliance phase not tracked in run-5.

**P0 AL findings (PHI operations without audit trail):**

- `AL-003/004` P0 — `createMembership` + `revokeMembership`: no audit call; HIPAA § 164.312(a)(2)(i) unique-user-ID requirement
- `AL-006` P0 — bulk patient export: no audit trail for PHI export
- `AL-007` P0 — `createDentalVisit`: no audit event; visit creation is auditable per §3
- `AL-009` P0 — `bookAppointment`: no audit event
- `AL-012` P0 — `createImagingStudy` / `getImagingStudy`: no audit for PHI image access
- `AL-013/014` P0 — PMD generate + download: no HIPAA-required audit trail
- `AL-017` P0 — `createPrescription`: `logger.info()` only, not persisted to audit table
- `AL-019/020` P0 — consent sign + revoke: only `logger.info()`, not persisted

**Schema gap:** audit table missing `event_type`, `actor_role`, `ip_address`, `user_agent`, `metadata` columns (5 of 8 required fields from AUDIT_CONTRACTS §2 absent from schema).

**pg-boss dead code:** `publishAuditEvent()` has zero callers; all 3 existing audit writes use direct `logAuditEvent` shim instead.

---

## Ratchet Summary (Phase 4)

| Category | Run-5 | Run-6 | Classification |
|----------|-------|-------|----------------|
| EM findings | 157 | 157 | 32 NEW, 13 RESOLVED, rest KNOWN |
| EF findings | 92 | 92 | ~35 NEW (auth gap scan), rest KNOWN |
| UJ findings | ~45 | 50 | ALL NEW (first strict pass) |
| EX findings | 33 | 33 | 8 NEW, 25 RESOLVED (FK exemption) |
| TR findings | 23 | 23 | 11 NEW, 0 resolved |
| AL findings | 0 | 25 | ALL NEW (new phase) |
| **TOTAL** | **323** | **380** | **+57 net** |

**--strict result: ❌ FAIL**

New P0 regressions by source:
```
EF dental-clinical:    11 P0  (auth gap scan — NEW discovery)
AL audit-compliance:   13 P0  (new phase — ALL NEW)
EF dental-imaging:      5 P0  (ceph auth gap — NEW discovery)
EF dental-org:          5 P0  (IDOR — NEW discovery)
EX cross-module:        7 P0  (import violation — NEW)
EF dental-pmd:          3 P0  (checksum bypass — NEW)
EF dental-patient:      3 P0  (PHI leak — NEW)
EF dental-visit:        3 P0  (lock gate — NEW)
EM dental-org:          4 P0  (security — 2 new, 2 known-promoted)
EM dental-patient:      4 P0  (4 new escalations)
EM dental-visit:        3 P0  (domain events P0 + lock P0 — NEW)
EM others:             ~3 P0  (misc)
TOTAL NEW P0:          ~64
```

**Resolved since run-5:** 25 EX Drizzle FK P0s (MODULE_BOUNDARIES.md exemption), 5 EM dental-org auth fixes, 2 EM dental-scheduling confirmed-correct, 1 EM dental-imaging (ceph math isomorphic confirmed) = **33 resolved**

---

## Stabilization Plan

**Immediate P0 sprint (security-critical, ship-blocking):**

| Priority | Finding | Module | Effort |
|----------|---------|--------|--------|
| S1 | `EM-PAT-001/004`: roles:['user'] + cross-branch PHI leak | dental-patient | 1d |
| S1 | `EF-CLI P0×10`: assertBranchAccess in 10 handlers | dental-clinical | 0.5d |
| S1 | `EF-IMG P0×5`: assertBranchAccess in ceph handlers | dental-imaging | 0.5d |
| S1 | `EM-ORG-001`: recoverPin unauth route | dental-org | 0.5d |
| S1 | `EF-ORG P0×4`: IDOR on branch/member ops | dental-org | 1d |
| S1 | `EF-PMD-001/002/003`: checksum bypass + immutability | dental-pmd | 0.5d |
| S1 | `EM-CLI-002`: medical history mutation (return 405) | dental-clinical | 0.5d |
| S2 | `EM-VIS-010/EF-VIS P0×3`: domain events + lock gate | dental-visit | 2d |
| S2 | `AL P0×13`: audit trail for PHI operations | dental-audit | 3d |
| S2 | `EM-BIL-001`: billing auth bypass when branchId omitted | dental-billing | 0.5d |
| S2 | `EF-SCH-001/002`: domain events + service layer | dental-scheduling | 1d |

**P1 sprint (functional, graduation-blocking):**
- Implement service layer across all 9 ABSENT modules (F2 goal — still open)
- Domain events: wire `publishAuditEvent` producer calls in dental-visit, dental-scheduling, dental-billing, dental-clinical, dental-imaging (EX-008–030)
- `EM-CLI-001`: implement `revokeConsentForm` handler
- Audit schema: add 5 missing columns (`event_type`, `actor_role`, `ip_address`, `user_agent`, `metadata`)
- `EM-PMD P0-1`: implement PMD download presigned-URL endpoint
- `EF-AUD-004`: fix route path `/dental/admin/audit` → `/dental/audit-events`

**Spec quality (P2 sprint):**
- dental-audit: add §4, §12, §13, §15, §18 sections
- dental-pmd: add §4, §9, §10b details
- dental-emr-integration: rename `handlers/emr/` → `handlers/consultation/` before any Phase 3 work

---

## What's Next

**Branch: `feat/p0-security-sprint`** — address all S1 P0s above. Run `/oli-enforce-all --strict --module dental-clinical` etc. to verify per-module before full re-run.

**Graduation criteria** (from `.planning/config.json`):
- p0_max: 0 → currently 78 P0s
- audit_health_min: 9.0 → currently ~2.0 (16/25 contracts missing)
- compliance_health_min: 9.0 → currently 4.5 (avg score 44.5/100)

**Next full enforcement:** After P0 sprint completes. Expected: ~30 P0s resolved (EF auth + PMD + ORG IDOR + CLI medical history) → re-run to verify regression-free baseline.

**Module graduation order** (highest score first, lowest P0):
1. dental-scheduling (70, P0=3) — closest to clean
2. dental-visit (62, P0=7) — needs domain events + lock gate
3. dental-billing (55, P0=1) — needs service layer + auth fix
4. dental-org (59, P0=9) — needs IDOR fixes
5. dental-clinical (58, P0=14) — needs auth sweep + consent revoke
6. dental-imaging (46, P0=5) — needs ceph auth + tier gate fix
7. dental-pmd (44, P0=5) — needs checksum + download
8. dental-perio (38, P0=1) — needs visit-lock cascade
9. dental-patient (37, P0=7) — needs role fixes + PHI leak
10. dental-audit (0, P0=2) — needs audit table schema + route fix
11. dental-emr-integration (20, FUTURE_PHASE) — defer

---

*oli-enforce-all v1.0 | run-6-strict | 2026-05-29 | 31 agents | 380 findings | ⛔ STRICT FAIL*
