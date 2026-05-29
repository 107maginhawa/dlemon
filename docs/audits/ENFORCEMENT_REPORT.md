<!-- oli: oli-enforce-all v1.0 | run-7 | 2026-05-29 | --strict -->

# Enforcement Report — Run 7

**Run ID:** run-7-strict-2026-05-29
**Git SHA:** 5035015a
**Date:** 2026-05-29
**Context:** First enforcement run post-Wave3 P0 security sprint (56 P0s claimed fixed)
**Prior run:** run-6-strict-2026-05-29 (git e67c58b9)

---

## Audit Scope

- **Modules audited:** 11 dental modules (dental-audit, dental-billing, dental-clinical, dental-emr-integration, dental-imaging, dental-org, dental-patient, dental-perio, dental-pmd, dental-scheduling, dental-visit)
- **Phases executed:** EM (module-level), EF (file-level), EX (cross-module), TR (traceability), AL (audit compliance), EC (coverage)
- **Spec artifacts:** MODULE_SPEC, API_CONTRACTS, AUDIT_CONTRACTS, DOMAIN_MODEL, ERROR_TAXONOMY, WORKFLOW_MAP, ROLE_PERMISSION_MATRIX, MODULE_MAP, MODULE_BOUNDARIES
- **Git SHA:** 5035015a
- **Date:** 2026-05-29

---

## Executive Summary

| Metric | Run-7 | Run-6 | Delta |
|--------|-------|-------|-------|
| Total findings | **346** | 380 | -34 |
| P0 (critical) | **54** | 78 | -24 |
| P1 (high) | **142** | ~167 | -25 |
| P2 (medium) | **109** | ~98 | +11 |
| P3 (low) | **41** | ~37 | +4 |
| New P0 regressions | **8** | — | — |
| P0s resolved (Wave3) | **18** | — | — |
| --strict verdict | **FAIL** | FAIL | — |

**Wave3 net effect:** 18 P0s resolved, 8 new P0s discovered. Net P0 reduction: -24. --strict remains FAIL because new P0s were introduced.

**Dominant systemic gap:** Domain events DE-001 through DE-023 are 0% wired. All 23 event publishers declared in EVENT_CONTRACTS.md are dead code. Cross-module choreography (audit trails, notifications, billing triggers) is entirely inoperative.

---

## Module Compliance Dashboard

| Module | Coverage% | Compliance% | P0 | P1 | v1_status | Trend (run-6→run-7) |
|--------|-----------|-------------|----|----|-----------|---------------------|
| dental-audit | 41% | 9% | 1 | 12 | NOT_READY | ↑ (was 0%, cap lifted) |
| dental-billing | 95% | 62% | 2 | 10 | PARTIAL | ↑ (55%→62%) |
| dental-clinical | 100% | 58% | 8 | 8 | PARTIAL | → (unchanged) |
| dental-emr-integration | 41% | 18% | 4 | 15 | NOT_READY | ↓ (20%→18%, new P0) |
| dental-imaging | 100% | 42% | 2 | 12 | PARTIAL | ↓ (46%→42%, schema SM P0) |
| dental-org | 100% | 71% | 6 | 8 | PARTIAL | ↑ (59%→71%, Wave3 auth) |
| dental-patient | 100% | 72% | 7 | 7 | PARTIAL | ↑ (37%→72%) |
| dental-perio | 95% | 72% | 2 | 9 | PARTIAL | ↑ (38%→72%) |
| dental-pmd | 64% | 62% | 1 | 8 | PARTIAL | ↑ (44%→62%, barrel fix) |
| dental-scheduling | 91% | 72% | 2 | 7 | PARTIAL | ↑ (70%→72%) |
| dental-visit | 100% | 72% | 1 | 9 | PARTIAL | ↑ (62%→72%) |

**Service layer status:** dental-org, dental-patient, dental-pmd, dental-scheduling, dental-visit — PRESENT. dental-audit, dental-billing, dental-imaging, dental-perio — ABSENT. dental-emr-integration, dental-clinical — ABSENT (project convention: handler→repo pattern).

---

## P0 Findings

All active P0 findings listed by module.

### dental-audit (1 P0)

| ID | Title | File | Spec Ref |
|----|-------|------|---------|
| EM-AUD-001 | Route `/dental/admin/audit` uses `authMiddleware({ roles: ['admin'] })` — dentist_owners have system role `user` and are blocked before reaching handler logic. Audit viewer functionally inaccessible to intended audience. | `app.ts:196-199` | MODULE_SPEC §6, AC-AUD-003 |

### dental-billing (2 P0s)

| ID | Title | File | Spec Ref |
|----|-------|------|---------|
| EM-BIL-23495b6c | DE-007 `InvoiceCreated` domain event not published in `createDentalInvoice` — audit and notification consumers silently starved | `createDentalInvoice.ts` | §10b DE-007 |
| EM-BIL-add117d4 | DE-008 `InvoicePaid` domain event not published in `recordDentalPayment` — patient receipt notification never triggered | `recordDentalPayment.ts` | §10b DE-008, WF-014 |

### dental-clinical (8 P0s — EM: 5, EF: 3)

| ID | Title | File | Spec Ref |
|----|-------|------|---------|
| EM-CLI-7e8a61cb | `createPrescription` writes to locked/completed visits without BR-003 guard | `prescriptions/createPrescription.ts` | §5 BR-003, AC-CLI-006 |
| EM-CLI-bd7bc565 | `createConsentForm` writes to locked/completed visits without BR-003 guard | `consent/createConsentForm.ts` | §5 BR-003 |
| EM-CLI-e7fc720a | `createAttachment` writes to locked/completed visits without BR-003 guard | `attachments/createAttachment.ts` | §5 BR-003 |
| EM-CLI-6ff99c36 | Signed consent form not blocked from revocation — `revokeConsentForm` only checks `revoked` flag, not `signed` flag. Illegal `signed → revoked` transition enabled. | `consent/revokeConsentForm.ts:44`, `consent-form.repo.ts:66` | §8 SM, BR-014 |
| EM-CLI-ba65c348 | `createAttachment` grants `hygienist` role instead of spec-permitted `staff_full` | `attachments/createAttachment.ts:34` | §6, ROLE_PERMISSION_MATRIX |
| EF-CLI-001 | `updateMedicalHistoryEntry` implements full PATCH on append-only entity — violates AC-CLI-005 clinical safety invariant | `medical-history/updateMedicalHistoryEntry.ts:37-43` | AC-CLI-005 |
| EF-CLI-002 | All 5 `inventory/*` handlers have zero branch authorization — any authenticated user can read/write any branch's inventory | `inventory/*.ts` (5 files) | §6, ROLE_PERMISSION_MATRIX |
| EF-CLI-003 | All 5 `occlusion/*` and `postop/*` handlers have zero branch authorization — cross-branch data access unconstrained | `occlusion/*.ts`, `postop/*.ts` (5 files) | §6, ROLE_PERMISSION_MATRIX |

### dental-emr-integration (4 P0s)

| ID | Title | File | Spec Ref |
|----|-------|------|---------|
| EM-EMR-001 | `handlers/emr/` implements consultation notes — entirely wrong domain vs spec (external EMR import bridge). Identity collision blocks Phase 3+ scheduling. | `handlers/emr/` (12 files) | MODULE_SPEC §1, §20 |
| EM-EMR-002 | MODULE_SPEC §20 AI Instruction #3 prohibits implementation until Phase 3+ — Wave3 deepened unauthorized implementation | `handlers/emr/` | MODULE_SPEC §20 #3 |
| EM-EMR-003 | Namespace collision: `handlers/emr/` blocks any Phase 3+ spec-compliant implementation | `handlers/emr/`, `routes.ts:1441-1480` | MODULE_SPEC §10 |
| EM-EMR-004 | DB-level FK cascade constraints on `patient` and `provider` in `emr.schema.ts` violate MODULE_SPEC §20 AI Instruction #1 (no DB FKs to other modules) — NEW in run-7 | `repos/emr.schema.ts:36-42` | MODULE_SPEC §20 #1, §7b |

### dental-imaging (2 P0s)

| ID | Title | File | Spec Ref |
|----|-------|------|---------|
| EM-IMG-008 | AC-IMG-002 and AC-IMG-003 structurally untestable — `draft` and `not_placed` enum values do not exist in code schemas. SM states diverge from spec. | `imaging_finding.schema.ts:33-47`, `imaging_ceph.schema.ts:35-39` | §11 AC-IMG-002, AC-IMG-003 |
| EM-IMG-014 | Observability hooks not implemented per §17 — `dental-imaging.tier-blocked` WARN never emitted on tier gate fires. Operationally critical for monitoring tier upgrade conversion. | `createImagingStudy.ts`, `getCephAnalysis.ts` + 4 others | §17 Observability |

### dental-org (6 P0s — EM: 2, EF: 4)

| ID | Title | File | Spec Ref |
|----|-------|------|---------|
| EM-ORG-001 | Deprecated member-create path (`DentalMembershipManagement_create`) is live without `assertBranchRole(['dentist_owner'])` — any branch member can create staff | `DentalMembershipManagement_create.ts:29-74` | §6 |
| EM-ORG-002 | `POST /dental/organizations` uses generic `authMiddleware()` — any authenticated user can create organizations | `DentalOrganizationManagement_create.ts:15-35` | §6 |
| EF-ORG-P015 | `recoverPin()` has no `assertBranchAccess` — any authenticated user can reset any membership's PIN cross-branch via security-question bypass — NEW in run-7 | `pinRecovery.ts:64-80` | §6, BR-016 |
| EF-ORG-P016 | Fee schedule endpoints (`GET/PATCH /dental/fee-schedule`) and audit log handler not implemented — WF-025 P1 workflow has zero code — NEW in run-7 | (missing files) | §3 WF-025, WF-028 |
| EF-ORG-P017 | `memberStatusEnum` missing `'invited'` and `'revoked'` — WF-004 staff invitation state machine broken at DB level — NEW in run-7 | `repos/membership.schema.ts:22` | §7, §8, API_CONTRACTS |
| EF-ORG-P018 | `TIER_LIMIT_REACHED` error code used in 2 handlers not present in ERROR_TAXONOMY.md — undocumented wire-level error code — NEW in run-7 | `createMember.ts:73`, `DentalMembershipManagement_create.ts:53` | ERROR_TAXONOMY §5 |

### dental-patient (7 P0s — EM: 4, EF: 3)

| ID | Title | File | Spec Ref |
|----|-------|------|---------|
| EM-PAT-001 | `exportDentalPatients` uses `assertBranchAccess()` not `assertBranchRole(['dentist_owner'])` — any branch member can export all patient PHI | `identity/exportDentalPatients.ts:56` | §6 |
| EM-PAT-002 | `bulkArchiveDentalPatients` uses `assertBranchAccess()` not `assertBranchRole(['dentist_owner'])` | `identity/bulkArchiveDentalPatients.ts:39` | §6 |
| EM-PAT-003 | `restoreDentalPatient` uses `assertBranchAccess()` not `assertBranchRole` | `identity/restoreDentalPatient.ts:30-31` | §6, §8 |
| EM-PAT-004 | `updateDentalPatient` allows `dentist_associate` to set `status=archived` via PATCH, bypassing dentist_owner gate | `identity/updateDentalPatient.ts:41-55` | §6, §8 |
| EF-PAT cross-route | All dental-patient routes use `roles: ['user']` at route level — operation-specific role matrix not enforced at router | `app.ts` (all dental/patients routes) | §6 |
| EF-PAT cross-branch | `listDentalPatients` expands branchId to all org branches — cross-branch PHI leak | `identity/listDentalPatients.ts:38-48` | AC-PAT-004 |
| EF-PAT archive | `archiveDentalPatient` uses `assertBranchAccess` not `assertBranchRole(['dentist_owner'])`; `reason` body never extracted or validated | `identity/archiveDentalPatient.ts` | §6, API_CONTRACTS |

### dental-perio (2 P0s)

| ID | Title | File | Spec Ref |
|----|-------|------|---------|
| EM-PER-001 | `createPerioChart` throws `BusinessLogicError` (422) for duplicate chart — spec and AC-P02 require 409 `CHART_EXISTS`. Test encodes wrong behavior. | `createPerioChart.ts:52-54` | §15, AC-P02 |
| EM-PER-002 | `perio-validation.ts` throws `ValidationError` (400) for invalid depth/tooth — spec requires 422 `INVALID_DEPTH`/`INVALID_TOOTH_NUMBER`. Tests absent for AC-P04/AC-P05. | `utils/perio-validation.ts:24,35` | §5 BR-P03/P04, §15 |

### dental-pmd (1 P0)

| ID | Title | File | Spec Ref |
|----|-------|------|---------|
| EM-PMD-6e91e277 | `generatePMD` permits `staff_full` role — ROLE_PERMISSION_MATRIX restricts PMD generation to `dentist_owner` and `dentist_associate` only | `generatePMD.ts:44` | §6, ROLE_PERMISSION_MATRIX |

### dental-scheduling (2 P0s)

| ID | Title | File | Spec Ref |
|----|-------|------|---------|
| EM-SCH-a564d893 | `cancelAppointment` allows `dentist_associate` and `staff_scheduling` — spec restricts cancel to `staff_full` and `dentist_owner` only | `cancelAppointment.ts:33-35` | §6 |
| EM-SCH-4afe5eab | `checkInAppointment` allows `staff_scheduling` (not permitted) and excludes `dentist_associate` (required) — double role-list error | `checkInAppointment.ts:38-40` | §6 |

### dental-visit (1 P0)

| ID | Title | File | Spec Ref |
|----|-------|------|---------|
| EM-VIS-001 | `getTreatmentPlan` accepts optional `branchId` — when omitted, any authenticated user receives full treatment plan for any patient with no branch membership check | `treatment-plans/getTreatmentPlan.ts:25-28` | §6, API_CONTRACTS |

---

## P1 Findings Summary

142 P1 findings total. Key P1s per module:

| ID | Module | Title | File |
|----|--------|-------|------|
| EM-AUD-002 | dental-audit | `branchId` optional — unscoped queries return all-branch audit data | `getAuditEvents.ts:31` |
| EM-AUD-005 | dental-audit | `setPin` writes to platform audit table not `dental_audit_log` | `DentalMembershipManagement_setPin.ts` |
| EM-AUD-008 | dental-audit | ~28 write handlers across modules produce zero audit events | multiple |
| EM-AUD-009 | dental-audit | `dental_audit_log` missing 5 spec-required fields | `repos/audit-log.schema.ts` |
| EF-AUD-001..005 | dental-audit | Schema field names, route path, required params, camelCase vs snake_case, error code all diverge from AUDIT_CONTRACTS | various |
| EM-BIL-4b60bbd3 | dental-billing | `updateDentalPaymentPlan` not registered in routes — 404 in production | `registry.ts` |
| EM-BIL-0decb164 | dental-billing | `issueDentalInvoice` excludes `staff_full` role | `issueDentalInvoice.ts:28` |
| EF-BIL-001/003/005 | dental-billing | Wrong error class (400 vs 422), wrong error codes, payment method enum gaps | various |
| EM-CLI-7df05775 | dental-clinical | `signConsentForm` does not emit DE-012 ConsentSigned | `consent/signConsentForm.ts` |
| EM-CLI-68f8f19e | dental-clinical | `createLabOrder` does not emit DE-014 LabOrderCreated | `lab-orders/createLabOrder.ts` |
| EM-CLI-743e7b05 | dental-clinical | `updateLabOrder` does not emit DE-015 LabOrderCompleted | `lab-orders/updateLabOrder.ts` |
| EM-CLI-1f1f48d5 | dental-clinical | `createPrescription` does not emit DE-016 PrescriptionWritten | `prescriptions/createPrescription.ts` |
| EM-CLI-84148bcf | dental-clinical | Consent revoke endpoint absent from TypeSpec | `app.ts:482`, TypeSpec |
| EF-CLI-004/005/006 | dental-clinical | Missing DE-012/014/015/016 emitters in domain-events.ts + callers | `domain-events.ts`, handlers |
| EM-EMR-006/007 | dental-emr | Terminal `imported` state not implemented; wrong-domain FSM active | `emr.repo.ts` |
| EF-EMR-001..008 | dental-emr | Future-phase module violation; endpoint mismatch; domain entity mismatch; AC-EMR-001 violated; DB FK coupling | various |
| EM-IMG-001/002 | dental-imaging | GET /dental/imaging/studies list endpoint missing; annotation endpoints missing | `routes.ts` |
| EM-IMG-009/010/011 | dental-imaging | DE-018/DE-019/DE-020 not published by any imaging handler | various |
| EM-IMG-012/013 | dental-imaging | `IMAGING_TIER_REQUIRED` error code never emitted; NOT_CALIBRATED guard absent | `getCephAnalysis.ts` |
| EF-IMG-016/017/018 | dental-imaging | 200 vs 202 mismatch in recomputeCephAnalysis; IMAGING_TIER_REQUIRED never emitted; annotation status field missing | various |
| EM-ORG-003 | dental-org | `updateMember` handler not registered in routes | `updateMember.ts` |
| EM-ORG-005 | dental-org | Membership `invited` status absent from enum | `membership.schema.ts` |
| EM-ORG-006 | dental-org | WF-004 staff invitation email not implemented | `createMember.ts` |
| EF-ORG-P020/021/022 | dental-org | getMemberRole no status='active' filter; responses missing data/meta envelope; getOrgContext branch active check | various |
| EM-PAT-005/006/007 | dental-patient | DE-021 PatientRegistered not published; DE-008 consumer absent; patient merge 501 stub missing | various |
| EF-PER-001..006 | dental-perio | Wrong error codes across all write handlers; missing VISIT_LOCKED check in completePerioChart; hygienist role undeclared | various |
| EM-PMD-f6e9a8ca..ecb305a7 | dental-pmd | imported_pmd FK constraint violates spec; missing branch_id/imported_by_member_id; pmd_document missing storage_file_id; checksum optional | `repos/pmd-document.schema.ts` |
| EM-SCH-9f6305ad | dental-scheduling | PATCH cancel path does not emit DE-011 AppointmentCancelled | `updateAppointment.ts` |
| EM-SCH-26cb6cb7 | dental-scheduling | `cancelAppointment` missing audit log (AUDIT_CONTRACTS DELETED event) | `cancelAppointment.ts` |
| EF-SCH-001..004 | dental-scheduling | 204 vs 200 response mismatch; REASON_REQUIRED vs ValidationError; RESCHEDULE_CONFLICT vs CONFLICT | various |
| EM-VIS-002/003/004/005 | dental-visit | BR-001 guard absent in createDentalVisit; performed treatment immutability gap; all 6 domain events dead; auto-lock cron not registered | various |
| EF-VIS-001/002/003/004/005 | dental-visit | Same as above at EF level + getTreatmentPlan auth gap + undeclared hygienist role in 3 handlers | various |
| EX-004..006 | cross-module | emr/ direct PatientRepository imports (no facade) + emr.repo.ts cross-module schema imports | `emr/` handlers |
| EX-008..030 | cross-module | DE-001..DE-023 fully specified, 0% wired — all cross-module event choreography inoperative | all modules |
| AL-001..009 | audit-compliance | 9 P0 operations with no persisted audit record | various handlers |

---

## Coverage Findings

From `ENFORCEMENT_COVERAGE.md` (EC findings, tracked separately):

| Module | Coverage Score | Gate | Key Gaps |
|--------|---------------|------|----------|
| dental-audit | 41% | WARN | §4, §9, §12, §13, §15, §18 ABSENT |
| dental-billing | 95% | PASS | §7b STUB only |
| dental-clinical | 100% | PASS | Fully spec'd |
| dental-emr-integration | 41% | WARN | §4, §9, §10b, §12, §13, §15, §17, §18 ABSENT; identity gap |
| dental-imaging | 100% | PASS | Fully spec'd including v1.4 ceph |
| dental-org | 100% | PASS | Breadth gaps: getDashboardSummary, 6 PIN handlers |
| dental-patient | 100% | PASS | Breadth gaps: sync/ unspec'd; treatment-plans boundary |
| dental-perio | 95% | PASS | §20 AI Instructions ABSENT |
| dental-pmd | 64% | PASS | §3, §4, §6, §7b, §8, §14, §15, §18 STUB/ABSENT |
| dental-scheduling | 91% | PASS | §7, §7b STUB; noShow/reschedule handlers unspec'd |
| dental-visit | 100% | PASS | Fully spec'd |

**Modules below 70%:** dental-audit (41%), dental-emr-integration (41%). No module below 40% hard gate. Average: 84%.

---

## Cross-Module Findings

From `docs/audits/enforce/cross-module.md`:

**Total:** 31 findings (P0=5, P1=24, P2=2, P3=0)

**Wave3 resolutions confirmed:**
- EX-007 (imaging_finding cross-module FK): RESOLVED — all 4 fields now bare UUIDs with loose-coupling comments
- EX-031 (imaging_finding Drizzle .references()): RESOLVED — confirmed clean by source scan

**Active P0:** EX-004 — `emr/` handler files directly instantiate `PatientRepository` with no facade

**Active P1 (24):** EX-008..030 — DE-001 through DE-023 fully specified, 0% wired in any handler

**Active P2 (2):** EX-032 (emr/ directory naming), EX-033 (ImagingFinding absent from DOMAIN_MODEL.md §3)

---

## Traceability Findings

From `docs/audits/enforce/trace.md`:

**Total:** 26 findings (P0=2, P1=10, P2=15, P3=0) — net +3 from run-6

| Metric | Value |
|--------|-------|
| Overall chain completeness | ~68% |
| Orphan BRs | 4 (BR-005, BR-013, BR-019, BR-020) |
| Broken WF chains | 2 (dashboard, perio routing) |
| Dead specs (AC no test) | 5 |
| Unspecced implementations | 36 handler groups |
| State machine divergences | 2 new (TR-025, TR-026) |
| Resolved since run-6 | 1 (TR-020: AC-AUD-002 405 test committed) |

---

## Audit Logging Compliance

From `docs/audits/enforce/audit-compliance/all-modules.md`:

**Contracts implemented:** 13/25 | **Contracts missing:** 12/25

| Wave3 Fix | Verified Status |
|-----------|----------------|
| AL-003 (assign membership) | PARTIAL — fix on informal route, canonical `DentalMembershipManagement_create.ts` still unaudited |
| AL-004 (revoke membership) | NOT FIXED — fix on dead-code `deactivateMember.ts`, actual routed `DentalMembershipManagement_deactivate.ts` unaudited |
| AL-006 (export patient) | FIXED |
| AL-007 (book appointment) | FIXED |
| AL-011 (upload imaging study) | FIXED |
| AL-012 (access imaging study) | FIXED |

**Open P0 audit contracts (11 total: 9 missing + 2 Pino-only):**
AL-001 (create org), AL-002 (create branch), AL-003 (assign membership — canonical), AL-004 (revoke membership — canonical), AL-005 (create patient), AL-008 (cancel appointment), AL-009 (create invoice), AL-013 (generate PMD), AL-025 (download PMD), AL-023 (import EMR — Pino only), AL-024 (view EMR — Pino only)

**Schema gap:** `dental_audit_log` missing 5 §2 required fields. Wave3 added `inet` import to schema but never added `ip_address` column — dead import orphan.

---

## Ratchet Summary vs Run-6

| Module | Run-6 P0 | Run-7 P0 | Delta | Resolved | New |
|--------|----------|----------|-------|----------|-----|
| dental-audit | 2 | 1 | -1 | EM-AUD-006 (405 enforcement) | EM-AUD-001 re-opened (wrongly RESOLVED in run-6) |
| dental-billing | 1 | 2 | +1 | — | EM-BIL DE-007/DE-008 (new P0s) |
| dental-clinical | 14 | 8 | -6 | EF-CLI-001..005 (Wave3 auth fixes partially resolved) | EM-CLI-6ff99c36, EM-CLI-ba65c348 escalated |
| dental-emr-integration | 4 | 4 | 0 | — | EM-EMR-004 (DB FK) added, G-EMR-01 removed from count |
| dental-imaging | 5 | 2 | -3 | EF-IMG-001..005 (ceph auth), EX-007+031 (FK) | EM-IMG-008, EM-IMG-014 (new EM P0s) |
| dental-org | 9 | 6 | -3 | EF-ORG-001..004 (Wave3 branch auth) | EF-ORG-P015/016/017/018 (4 new) |
| dental-patient | 7 | 7 | 0 | — | Composition changed, same count |
| dental-perio | 1 | 2 | +1 | — | EM-PER-001/002 (error taxonomy newly identified as P0) |
| dental-pmd | 5 | 1 | -4 | Checksum P0s resolved by run-7 analysis | EM-PMD-6e91e277 (staff_full permission) |
| dental-scheduling | 3 | 2 | -1 | Partial resolution | EM-SCH two P0s remain |
| dental-visit | 7 | 1 | -6 | Wave3 visit/carry-over fixes | EM-VIS-001 (getTreatmentPlan auth) |
| Cross-module (EX) | 7 | 5 | -2 | EX-007, EX-031 (imaging FK) | — |
| Audit compliance (AL) | 13 | 11 | -2 | AL-006/007/011/012 (4 fixed) | AL-003/004 defect discovered |
| **TOTALS** | **~78** | **54** | **-24** | **~18 resolved** | **~8 new** |

---

## --strict Verdict

**--strict: FAIL**

8 new P0 regressions discovered in run-7 vs run-6 baseline. The --strict gate requires zero new P0 regressions. Wave3 resolved 18 P0s but introduced 8 new ones (EM-AUD-001 re-opening, EM-EMR-004, EF-ORG-P015/016/017/018, EM-IMG-008, EM-IMG-014).

Secondary violations preventing PASS:
- Domain events DE-001..DE-023: 0% wired — all 23 event publishers are dead code
- Audit compliance: 12/25 contracts missing (9 P0 + 2 Pino-only)
- AL-003/AL-004 Wave3 fixes applied to wrong/unrouted handlers — canonical routes still unaudited

---

## Stabilization Plan

### Tier 1 — Fix immediately (unblock all new feature work)

1. **EM-AUD-001** — Change `authMiddleware({ roles: ['admin'] })` to `{ roles: ['user'] }` at `app.ts:197`. One-line fix.
2. **EF-ORG-P015** — Add `assertBranchAccess(db, user.id, member.branchId)` after line 80 of `pinRecovery.ts`. Cross-branch PIN reset is exploitable.
3. **EF-ORG-P017** — Add `'invited'`, `'revoked'` to `memberStatusEnum`. Generate migration.
4. **EM-ORG-001** — Add `assertBranchRole(['dentist_owner'])` to `DentalMembershipManagement_create.ts` or remove deprecated route.
5. **EM-ORG-002** — Add `authMiddleware({ roles: ['admin'] })` to `POST /dental/organizations`.
6. **EM-PAT-001/002/003** — Replace `assertBranchAccess` with `assertBranchRole(['dentist_owner'])` in export, bulk-archive, and restore handlers.
7. **EM-SCH-a564d893** — Fix `cancelAppointment` role list to `['dentist_owner', 'staff_full']`.
8. **EM-SCH-4afe5eab** — Fix `checkInAppointment` role list to `['dentist_owner', 'dentist_associate', 'staff_full']`.

### Tier 2 — Fix before next feature merge

9. **EF-CLI-001/002/003** — Remove `updateMedicalHistoryEntry`; add branch auth to all 10 inventory/occlusion/postop handlers.
10. **AL-003/AL-004** — Add `logAuditEvent` to `DentalMembershipManagement_create.ts` and `DentalMembershipManagement_deactivate.ts` (canonical routes).
11. **AL-005/008/009/013/025** — Add `logAuditEvent` to createDentalPatient, cancelAppointment, createDentalInvoice, generatePMD, exportPMD.
12. **EM-IMG-008** — Align imaging finding status enum (`suspected/confirmed/monitoring/resolved` → `draft/confirmed/resolved`) and ceph landmark enum (`placed/confirmed/locked` → `not_placed/placed/locked`). DB migration required.
13. **EM-VIS-004** — Wire all 6 domain event emit calls in dental-visit handlers (updateDentalVisit, createDentalTreatment, updateDentalTreatment).
14. **EF-ORG-P018** — Add `TIER_LIMIT_REACHED(409)` to ERROR_TAXONOMY.md §5 dental-org.

### Tier 3 — Sprint before next release

15. **EX-004** — Create `patient/repos/patient-emr.facade.ts`; replace 4 direct PatientRepository imports in `emr/` handlers.
16. **EM-EMR-001/002/003** — Architectural rename: `handlers/emr/` → `handlers/consultation-notes/`. Update all routes.ts and registry.ts references.
17. **EM-BIL-23495b6c/add117d4** — Add DE-007/DE-008 event publishing to `createDentalInvoice` and `recordDentalPayment`.
18. **EM-AUD-009** — Complete abandoned Wave3 schema fix: add `ip_address inet`, `category`, `event_type`, `outcome`, `retention_status` to `dental_audit_log`.

---

## What's Next

**Branch 1 — P0 count > 0 (CURRENT):** Execute Wave4 targeting the 8 new P0s in Tier 1 before any new feature development. Wave4 must achieve 0 new P0 regressions.

**Branch 2 — Audit compliance < 60% (CURRENT: 52%):** Run a dedicated audit-wiring sprint. Wire AL-003, AL-004, AL-005, AL-008, AL-009, AL-013, AL-025 against canonical routed handlers. Validate each with a contract test against the real server, not buildTestApp().

**Branch 3 — Domain events 0% wired (CURRENT):** After P0s resolved, begin systematic event wiring. Start with dental-visit (DE-001..006) as highest-impact producer. Wire into updateDentalVisit (DE-001/002/003) and updateDentalTreatment (DE-005/006) as a single PR.

**Branch 4 — emr/ architectural bloat (CURRENT):** Schedule architectural rename sprint to move `handlers/emr/` to `handlers/consultation-notes/`. Pre-requisite for any Phase 3+ dental-emr-integration work. Coordinate with schema migration to drop cascade FK constraints (EM-EMR-004).

**Branch 5 — Coverage score stable (CURRENT: 84% average):** No coverage sprint needed this cycle. dental-audit (41%) and dental-emr-integration (41%) gaps are tied to missing spec sections — address in spec-writing sprint, not code sprint.

---

*Generated by oli-enforce-all synthesis agent | run-7-strict-2026-05-29 | git 5035015a*
