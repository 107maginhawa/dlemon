# Dentalemon V1 — Full Enforcement Report
<!-- oli-enforce-all v1.0 | generated: 2026-05-28 | run: run-5-f2-service-layer-di | modules: 11 | agents: 34 -->
<!-- flags: --auto | mode: full-run (post structural-remediation-complete + F2 service-layer/DI focus) -->

---

## 1. Audit Scope

### 1.1 Artifact Availability Matrix

| Artifact | Path | Status |
|---|---|---|
| ENFORCEMENT_COVERAGE.md | docs/audits/ENFORCEMENT_COVERAGE.md | ✅ Present |
| enforce-module/dental-audit | docs/audits/enforce/module/dental-audit.md | ✅ Present |
| enforce-module/dental-billing | docs/audits/enforce/module/dental-billing.md | ✅ Present |
| enforce-module/dental-clinical | docs/audits/enforce/module/dental-clinical.md | ✅ Present |
| enforce-module/dental-emr-integration | docs/audits/enforce/module/dental-emr-integration.md | ✅ Present |
| enforce-module/dental-imaging | docs/audits/enforce/module/dental-imaging.md | ✅ Present |
| enforce-module/dental-org | docs/audits/enforce/module/dental-org.md | ✅ Present |
| enforce-module/dental-patient | docs/audits/enforce/module/dental-patient.md | ✅ Present |
| enforce-module/dental-perio | docs/audits/enforce/module/dental-perio.md | ✅ Present |
| enforce-module/dental-pmd | docs/audits/enforce/module/dental-pmd.md | ✅ Present |
| enforce-module/dental-scheduling | docs/audits/enforce/module/dental-scheduling.md | ✅ Present |
| enforce-module/dental-visit | docs/audits/enforce/module/dental-visit.md | ✅ Present |
| enforce-file/dental-audit | docs/audits/enforce/file/dental-audit.md | ✅ Present |
| enforce-file/dental-billing | docs/audits/enforce/file/dental-billing.md | ✅ Present |
| enforce-file/dental-clinical | docs/audits/enforce/file/dental-clinical.md | ✅ Present |
| enforce-file/dental-emr-integration | docs/audits/enforce/file/dental-emr-integration.md | ✅ Present |
| enforce-file/dental-imaging | docs/audits/enforce/file/dental-imaging.md | ✅ Present |
| enforce-file/dental-org | docs/audits/enforce/file/dental-org.md | ✅ Present |
| enforce-file/dental-patient | docs/audits/enforce/file/dental-patient.md | ✅ Present |
| enforce-file/dental-perio | docs/audits/enforce/file/dental-perio.md | ✅ Present |
| enforce-file/dental-pmd | docs/audits/enforce/file/dental-pmd.md | ✅ Present |
| enforce-file/dental-scheduling | docs/audits/enforce/file/dental-scheduling.md | ✅ Present |
| enforce-file/dental-visit | docs/audits/enforce/file/dental-visit.md | ✅ Present |
| ui-journey | docs/audits/enforce/ui-journey.md | ✅ Present |
| cross-module | docs/audits/enforce/cross-module.md | ✅ Present |
| trace | docs/audits/enforce/trace.md | ✅ Present |
| .baseline.json (run-4) | docs/audits/enforce/.baseline.json | ✅ Present |

### 1.2 Sub-Skill Dispatch Log (34 agents)

| Phase | Skill | Module / Scope | Status | Findings | Output |
|---|---|---|---|---|---|
| 0 | oli-enforce-coverage | All 11 modules | ✅ Complete | Coverage matrix | ENFORCEMENT_COVERAGE.md |
| 1 | oli-enforce-module | dental-audit | ✅ Complete | 19 (P0:6 P1:6 P2:4 P3:3) | enforce/module/dental-audit.md |
| 1 | oli-enforce-module | dental-billing | ✅ Complete | 11 (P0:1 P1:5 P2:3 P3:2) | enforce/module/dental-billing.md |
| 1 | oli-enforce-module | dental-clinical | ✅ Complete | 10 (P0:2 P1:4 P2:3 P3:1) | enforce/module/dental-clinical.md |
| 1 | oli-enforce-module | dental-emr-integration | ✅ Complete | 17 (P0:3 P1:7 P2:5 P3:2) | enforce/module/dental-emr-integration.md |
| 1 | oli-enforce-module | dental-imaging | ✅ Complete | 18 (P0:3 P1:8 P2:5 P3:2) | enforce/module/dental-imaging.md |
| 1 | oli-enforce-module | dental-org | ✅ Complete | 18 (P0:6 P1:7 P2:4 P3:1) | enforce/module/dental-org.md |
| 1 | oli-enforce-module | dental-patient | ✅ Complete | 26 (P0:4 P1:11 P2:6 P3:5) | enforce/module/dental-patient.md |
| 1 | oli-enforce-module | dental-perio | ✅ Complete | 12 (P0:0 P1:5 P2:5 P3:2) | enforce/module/dental-perio.md |
| 1 | oli-enforce-module | dental-pmd | ✅ Complete | 11 (P0:2 P1:5 P2:3 P3:1) | enforce/module/dental-pmd.md |
| 1 | oli-enforce-module | dental-scheduling | ✅ Complete | 6 (P0:1 P1:3 P2:1 P3:1) | enforce/module/dental-scheduling.md |
| 1 | oli-enforce-module | dental-visit | ✅ Complete | 20 (P0:3 P1:9 P2:6 P3:2) | enforce/module/dental-visit.md |
| 1 | oli-enforce-file | dental-audit | ✅ Complete | 3 (P0:0 P1:2 P2:1 P3:0) | enforce/file/dental-audit.md |
| 1 | oli-enforce-file | dental-billing | ✅ Complete | 5 (P0:0 P1:1 P2:4 P3:0) | enforce/file/dental-billing.md |
| 1 | oli-enforce-file | dental-clinical | ✅ Complete | 11 (P0:0 P1:6 P2:5 P3:0) | enforce/file/dental-clinical.md |
| 1 | oli-enforce-file | dental-emr-integration | ✅ Complete | 7 (P0:0 P1:2 P2:5 P3:0) | enforce/file/dental-emr-integration.md |
| 1 | oli-enforce-file | dental-imaging | ✅ Complete | 3 (P0:0 P1:2 P2:1 P3:0) | enforce/file/dental-imaging.md |
| 1 | oli-enforce-file | dental-org | ✅ Complete | 8 (P0:0 P1:4 P2:3 P3:1) | enforce/file/dental-org.md |
| 1 | oli-enforce-file | dental-patient | ✅ Complete | 12 (P0:0 P1:7 P2:4 P3:1) | enforce/file/dental-patient.md |
| 1 | oli-enforce-file | dental-perio | ✅ Complete | 3 (P0:0 P1:1 P2:1 P3:1) | enforce/file/dental-perio.md |
| 1 | oli-enforce-file | dental-pmd | ✅ Complete | 5 (P0:0 P1:2 P2:2 P3:1) | enforce/file/dental-pmd.md |
| 1 | oli-enforce-file | dental-scheduling | ✅ Complete | 5 (P0:0 P1:2 P2:2 P3:1) | enforce/file/dental-scheduling.md |
| 1 | oli-enforce-file | dental-visit | ✅ Complete | 7 (P0:0 P1:3 P2:3 P3:1) | enforce/file/dental-visit.md |
| 1.5 | oli-ui-journey | All active modules | ✅ Complete | 18 (P0:1 P1:5 P2:7 P3:5) | enforce/ui-journey.md |
| 2 | oli-enforce-cross-module | All 11 modules | ✅ Complete | 44 (P0:25 P1:16 P2:2 P3:1) | enforce/cross-module.md |
| 2.5 | oli-trace | All 11 modules | ✅ Complete | 71 (P0:0 P1:17 P2:30 P3:12+12) | enforce/trace.md |

**Total raw findings before ratchet: 323 (P0:51, P1:127, P2:105, P3:40)**

---

## 2. Executive Summary

### 2.1 Run-5 vs Run-4 (Ratchet)

| Metric | Run-4 (2026-05-27) | Run-5 (2026-05-28) | Delta |
|---|---|---|---|
| **Total findings** | 392 | 323 | **-69** |
| P0 findings | ~146 open | 51 raw (25 exemptable) | **-95 to -121** |
| P1 findings | ~120 | 127 | +7 (F2 additions) |
| P2 findings | ~90 | 105 | +15 (trace new) |
| P3 findings | ~36 | 40 | +4 |
| Modules audited | 10 | 11 | +1 (emr identity resolved) |
| Avg compliance score | ~70 (coverage) | 49.5 (compliance) | Score basis changed |
| Modules with P0s | 9 | 9 | — |
| RESOLVED findings | — | 18 | +18 vs run-4 |

> **Score basis note:** Run-4 used "coverage score" (spec-completeness proxy). Run-5 uses "compliance score" (spec + impl + auth + F2 + events). These are not directly comparable — all score trends show down due to the stricter metric, not regression.

### 2.2 Key Changes

- **Major P0 reduction:** Module-layer P0s dropped from ~146 (run-4) to 26 (module-layer only, excluding EX cross-module) — the P0 sprint and §10.2 auth fixes landed. This is the largest single improvement in the project's enforcement history.
- **F2 service-layer gap confirmed across all 11 modules:** Every active module lacks a `.service.ts` file. 10 of 11 have repos present but business logic embedded in fat handlers. This is the primary debt identified in run-5.
- **25 new EX P0s (cross-module):** All are idiomatic Drizzle FK imports — inherent to the shared-schema architecture. Zero code changes needed; resolved by adding Option 3 exemption to `MODULE_BOUNDARIES.md`.
- **Clinical safety issue (dental-perio):** Deep-pocket threshold hardcoded at 5mm vs spec-required 6mm. This is a clinical correctness P1 that must be treated with P0 urgency.
- **Two PHI exposure P0s remain open:** `listDentalPatients` cross-branch leak (EM-PAT-004) and ceph report unauthenticated public route (dental-imaging). Neither was in the §10.2 fix set.
- **dental-emr-integration IDENTITY_CHANGED:** `source_path` moved from null to `handlers/emr/`; the `emr/` handler implements consultation notes, not EMR import — a namespace collision that is itself a P0 spec defect.

### 2.3 Graduate-or-Hold Assessment

**Graduation thresholds:** P0_max = 0, compliance_health_min = 9.0 (avg >= 90/100)

| Threshold | Required | Current | Status |
|---|---|---|---|
| P0 count | 0 | 26 (code-change) + 25 (exemptable) | HOLD |
| Avg compliance score | >= 90.0 | 49.5 / 100 | HOLD |
| Modules at NOT_READY | 0 | 11/11 | HOLD |

**Verdict: HOLD.** Graduation is not possible this sprint. Sprint target: eliminate the 26 code-change P0s, write MODULE_BOUNDARIES.md exemption (clears 25 EX P0s), begin F2 rollout.

---

## 3. Coverage Gate Results

From `ENFORCEMENT_COVERAGE.md` — spec completeness before implementation audit.

**Gate result: WARN — continue F2 enforcement with caveats**

| Module | Key Gaps | Coverage Score |
|---|---|---|
| dental-audit | Missing §9 (UI), §10b (events), §17-18 | 52 |
| dental-billing | Fee schedule spec thin | 72 |
| dental-clinical | Consent revoke flow underspecified | 68 |
| dental-emr-integration | Missing §4, §9, §12, §13, §15, §17, §18 | FUTURE_PHASE |
| dental-imaging | Ceph BRs not in MODULE_SPEC §5 | 61 |
| dental-org | Fee schedule absent | 64 |
| dental-patient | Safety floor spec incomplete | 55 |
| dental-perio | Deep-pocket threshold value wrong in impl | 90 |
| dental-pmd | Supersede workflow partially spec'd | 82 |
| dental-scheduling | Queue entity not specced | 75 |
| dental-visit | Carry-over billing notification unspec'd | 73 |

**Universal gap (F2):** No module has a documented service-layer pattern in its MODULE_SPEC. The `§20 AI Instructions` section references F2 but does not define the service interface contract. This must be resolved for F2 rollout to be spec-driven.

---

## 4. Module Compliance Dashboard

| Module | P0 | P1 | P2 | P3 | Score | SL Status | Trend | Gate |
|---|---|---|---|---|---|---|---|---|
| dental-audit | 6 | 6 | 4 | 3 | 28 | ABSENT | down (52->28) | HOLD |
| dental-billing | 1 | 5 | 3 | 2 | 61 | PARTIAL | down (72->61) | HOLD |
| dental-clinical | 2 | 4 | 3 | 1 | 66 | PARTIAL | down (68->66) | HOLD |
| dental-emr-integration | 3* | 7 | 5 | 2 | 22 | ABSENT | N/A | FUTURE_PHASE |
| dental-imaging | 3 | 8 | 5 | 2 | 44 | PARTIAL | down (61->44) | HOLD |
| dental-org | 6 | 7 | 4 | 1 | 54 | PARTIAL | down (64->54) | HOLD |
| dental-patient | 4 | 11 | 6 | 5 | 41 | ABSENT | down (55->41) | HOLD |
| dental-perio | 0 | 5 | 5 | 2 | 41 | ABSENT | down (90->41) | HOLD† |
| dental-pmd | 2 | 5 | 3 | 1 | 49 | ABSENT | down (82->49) | HOLD |
| dental-scheduling | 1 | 3 | 1 | 1 | 68 | PARTIAL | down (75->68) | HOLD |
| dental-visit | 3 | 9 | 6 | 2 | 72 | PARTIAL | down (73->72) | HOLD |
| **cross-module** | **25 EX** | 16 | 2 | 1 | — | — | NEW | PENDING EXEMPTION |
| **TOTAL** | **51** | **127** | **105** | **40** | **49.5 avg** | | | **HOLD** |

*dental-emr-integration P0s are spec-level defects (namespace collision, route collision) — not implementation bugs; module is FUTURE_PHASE.

†dental-perio has 0 module P0s but the deep-pocket threshold clinical safety P1 (5mm vs 6mm) should be treated with P0 urgency.

---

## 5. P0 Findings (Inline — all must be fixed before graduation)

### Module: dental-audit (6 P0s)

| ID | Description | File | Spec Ref | Ratchet |
|---|---|---|---|---|
| EM-AUD-001 | Wrong auth role: `admin` enforced, `dentist_owner` cannot access audit log | `getAuditEvents.ts:22` | MODULE_SPEC §6 | KNOWN |
| EM-AUD-002 | No branch ownership guard — any admin can read any branch's audit data | `getAuditEvents.ts:34` | AC-AUD-003 | KNOWN |
| EM-AUD-003 | **PHI LEAK** — `displayName` (staff name) written into `audit_log_entry.details` | `DentalMembershipManagement_verifyPin.ts:~67` | AC-AUD-004, G-005 | KNOWN |
| EM-AUD-004 | `listAuditLogs` writes a new audit entry on every audit query — recursion violation | `audit/listAuditLogs.ts:82-101` | MODULE_SPEC §17 | KNOWN |
| EM-AUD-005 | `setPin` writes no audit event — security-sensitive mutation unaudited | `DentalMembershipManagement_setPin.ts` | AUD-BR-001/004 | KNOWN |
| EM-AUD-006 | No 405 routes registered — append-only constraint (AC-AUD-002) not enforced at HTTP level | `app.ts:193` | AC-AUD-002 | KNOWN |

### Module: dental-patient (4 P0s)

| ID | Description | File | Spec Ref | Ratchet |
|---|---|---|---|---|
| EM-PAT-001 | All dental-patient routes use `roles:['user']` — any authenticated user can create/archive/export patients | `app.ts` (all patient routes) | MODULE_SPEC §6 | KNOWN |
| EM-PAT-002 | `archiveDentalPatient` uses `assertBranchAccess` not role check — wrong privilege enforcement | `identity/archiveDentalPatient.ts:~30` | §6: archive = dentist_owner only | KNOWN |
| EM-PAT-003 | `archiveDentalPatient` reads no body — `reason` (required min:5 max:500) never extracted, validated, or stored | `identity/archiveDentalPatient.ts:14-47` | API_CONTRACTS §archive | KNOWN |
| EM-PAT-004 | **PHI LEAK** — `listDentalPatients` org-expands branch scope; `branchId` filter replaced with all-org branches | `identity/listDentalPatients.ts:38-48` | AC-PAT-004 | KNOWN |

### Module: dental-billing (1 P0)

| ID | Description | File | Spec Ref | Ratchet |
|---|---|---|---|---|
| EM-BIL-001 | `listDentalInvoices` performs no auth check when `branchId` query param omitted — cross-branch invoice enumeration | `listDentalInvoices.ts:14-17` | MODULE_SPEC §6 | KNOWN |

### Module: dental-clinical (2 P0s)

| ID | Description | File | Spec Ref | Ratchet |
|---|---|---|---|---|
| EM-CLI-001 | `PATCH /visits/:id/consent-forms/:cid/revoke` endpoint entirely missing — no handler, no route | `consent/ (absent)` | API_CONTRACTS PATCH .../revoke | KNOWN |
| EM-CLI-002 | `updateMedicalHistoryEntry` implements mutable PATCH on append-only resource — contract mandates 405 `MEDICAL_HISTORY_IMMUTABLE` | `medical-history/updateMedicalHistoryEntry.ts` | BR-016, API_CONTRACTS | KNOWN |

### Module: dental-org (6 P0s — auth/route cap)

| ID | Description | File | Spec Ref | Ratchet |
|---|---|---|---|---|
| EM-ORG-001 | `DentalOrganizationManagement_get.ts` missing authMiddleware — unauthenticated org read | `DentalOrganizationManagement_get.ts` | MODULE_SPEC §6 | KNOWN |
| EM-ORG-002 | `DentalBranchManagement_get.ts` missing authMiddleware — unauthenticated branch read | `DentalBranchManagement_get.ts` | MODULE_SPEC §6 | KNOWN |
| EM-ORG-003 | `DentalBranchManagement_list.ts` missing authMiddleware — unauthenticated branch list | `DentalBranchManagement_list.ts` | MODULE_SPEC §6 | KNOWN |
| EM-ORG-010 | `DentalOrganizationManagement_get.ts` missing ownership check (update fix run-4 confirmed; get remains open) | `DentalOrganizationManagement_get.ts` | MODULE_SPEC §6 IDOR | KNOWN |
| EM-ORG-P0-DEACT | Membership deactivation allows active members to deactivate others without ownership check | `DentalMembershipManagement_deactivate.ts` | MODULE_SPEC §6 | KNOWN |
| EM-ORG-P0-FEE | Fee schedule endpoints entirely unimplemented (WF-042) | fee-schedule handlers (absent) | MODULE_SPEC §3/§4 | KNOWN |

### Module: dental-scheduling (1 P0)

| ID | Description | File | Spec Ref | Ratchet |
|---|---|---|---|---|
| EM-SCH-dc03d114 | All dental scheduling routes use `authMiddleware({roles:['user']})` — any authenticated user (including patient role) can book/cancel/check-in | `generated/openapi/routes.ts:366-402` | MODULE_SPEC §6 | KNOWN |

### Module: dental-pmd (2 P0s)

| ID | Description | File | Spec Ref | Ratchet |
|---|---|---|---|---|
| EM-PMD-001 | `ImportedPMD` immutability not enforced — PATCH/DELETE return 200 instead of 405 `IMPORTED_PMD_IMMUTABLE` | importedPmd handlers | API_CONTRACTS, MODULE_SPEC §5 | KNOWN |
| EM-PMD-002 | `generatePMD` missing `dentist_owner` role check — any authenticated user can generate PMD documents | `generatePMD.ts` | MODULE_SPEC §6 | KNOWN |

### Module: dental-imaging (3 P0s)

| ID | Description | File | Spec Ref | Ratchet |
|---|---|---|---|---|
| EM-IMG-001 | **PHI RISK** — Ceph report route `/imaging-ceph-report/:imageId` has no auth guard, no role check; publicly accessible | `apps/dentalemon/src/routes/` | MODULE_SPEC §6; security | NEW |
| EM-IMG-002 | `imaging_study` DB schema missing `study_date` column — retrospective date entry impossible | `repos/imaging.schema.ts` | MODULE_SPEC §4 WF-019, §7 | KNOWN |
| EM-IMG-003 | Cross-branch imaging access in ceph handlers — `assertBranchAccess` not called before ceph operations | ceph handlers | MODULE_SPEC §6 | KNOWN |

### Module: dental-visit (3 P0s)

| ID | Description | File | Spec Ref | Ratchet |
|---|---|---|---|---|
| EM-VIS-001 | Visit lock not enforced on clinical writes — locked visits accept treatment and clinical updates | visit handlers | MODULE_SPEC §5 visit FSM | KNOWN |
| EM-VIS-002 | Treatment FSM allows direct `diagnosed->performed` skip — `planned` step bypassed; invoices then fail validation | treatment FSM guard | MODULE_SPEC §8 SM-TREAT | KNOWN |
| EM-VIS-003 | Carry-over creates new treatment rows without billing notification — `createDentalInvoice` caller not notified | `visit/carryOver.ts` | MODULE_SPEC §5 WF-carry-over | KNOWN |

### Module: dental-emr-integration (3 P0s — FUTURE_PHASE, exempt from graduation gate)

| ID | Description | File | Spec Ref | Ratchet |
|---|---|---|---|---|
| EX-EMR-001 | **IDENTITY COLLISION** — `handlers/emr/` implements consultation notes, NOT the dental-emr-integration spec; namespace must be resolved before Phase 3 execution | `handlers/emr/` | MODULE_SPEC §1 | NEW (IDENTITY_CHANGED) |
| EX-EMR-002 | **ROUTE COLLISION** — `GET /dental/emr/:patientId` vs `GET /dental/emr/:id` indistinguishable to router | MODULE_SPEC §3 | API_CONTRACTS | NEW |
| EX-EMR-003 | Delete permission contradiction — spec says `dentist_owner` may delete, §4 says records are immutable | MODULE_SPEC §4/§6 | — | NEW |

### Cross-Module (25 P0s — pending MODULE_BOUNDARIES.md exemption)

> **All 25 are idiomatic Drizzle FK imports.** Every dental module with FK constraints must import the parent table's Drizzle schema object for `.references()` calls. This is a structural architecture pattern, not a code defect. **Resolution: add Option 3 exemption to `MODULE_BOUNDARIES.md`** (under 1 hour, no code changes). Until exemption is documented, these count as P0s in the raw total.

| Pattern | Count | Modules affected |
|---|---|---|
| Drizzle schema cross-import for FK `.references()` | 25 | dental-billing, dental-clinical, dental-imaging, dental-org, dental-patient, dental-perio, dental-pmd, dental-scheduling, dental-visit |

### UI Journey (1 P0)

| ID | Description | File | Spec Ref | Ratchet |
|---|---|---|---|---|
| UJ-SCH-e5f6g7h8 | **Silent error discard in check-in** — WF-007 recovery path fails silently; user sees no feedback on check-in failure | check-in component | MODULE_SPEC §3 WF-007 | NEW |

---

## 6. P1 Findings (Inline — F2 focus: service-layer/DI)

### 6.1 Service-Layer Missing (F2 Primary Target)

All 11 modules lack a `.service.ts` file. The following P1s are directly caused by this gap.

| Module | Finding ID | Description | F2 Evidence |
|---|---|---|---|
| dental-audit | EM-AUD-007 | WF-096 pg-boss consumer absent — async write path entirely unimplemented | No service to wire consumer to |
| dental-audit | EM-AUD-008 | ~28 write handlers missing `logAuditEvent` calls | No service layer to enforce at call site |
| dental-billing | EM-BIL-003 | No `.service.ts`; repos instantiated ad-hoc with `new Dental*Repository(db)` inside every handler body | All 14 handlers fat |
| dental-clinical | EM-CLI-004 | No `.service.ts`; business logic (allergy check, visit-immutable guard, FSM) split across handlers and repos | `createPrescription.ts` has raw `db.select()` inline |
| dental-imaging | EM-IMG-004 | No `.service.ts`; ceph business logic (idempotent recompute, calibration provenance) inline in handlers | CephMgmt_*.ts fat handlers |
| dental-org | EM-ORG-P1-F2 | No `.service.ts`; 4 fat handlers with inline business logic; repos not injected (instantiated per-request) | `DentalOrganizationManagement_create.ts` embeds validation + audit inline |
| dental-patient | EM-PAT-005 | No `dental-patient.repo.ts` — core patient CRUD delegates to `../patient/repos/patient.repo` (cross-module coupling) | Identity handlers import Drizzle schemas from sibling modules |
| dental-patient | EM-PAT-006 | Repo instantiation inline in every handler (`new RecallRepository(db, logger)`) — no DI pattern | Repos recreated per request |
| dental-perio | EM-PER-001 | No `.service.ts`; `completePerioChart.ts` embeds BR-P07 min-readings enforcement + BOP%/mean-depth aggregation inline | Stats computation in handler body (lines 55-75) |
| dental-pmd | EM-PMD-003 | No `.service.ts`; `generatePMD.ts` embeds supersede-or-create business logic inline with ad-hoc `new PMDDocumentRepository(db)` | Same pattern across all 7 handlers |
| dental-scheduling | EM-SCH-F2-001 | `createAppointment.ts` embeds working-hours validation, overlap detection, notification dispatch in handler body | `checkInAppointment.ts` embeds multi-step transaction orchestration inline |
| dental-visit | EM-VIS-F2-001 | Direct Drizzle bypassing repos — some visit handlers use `db.select().from(dentalVisits)` directly, skipping the repo layer | Repo layer exists but inconsistently used |

**Clinical safety P1 — treat as P0 urgency:**

| Module | Finding ID | Description | Risk |
|---|---|---|---|
| dental-perio | EM-PER-002 | **CLINICAL SAFETY: Deep-pocket threshold hardcoded at 5mm; spec (BR-P08) requires 6mm** — incorrect periodontal disease severity classification | Misclassifying pocket depth affects treatment decisions |

### 6.2 Business Rule Violations

| Module | Finding ID | Description | Spec Ref |
|---|---|---|---|
| dental-billing | EM-BIL-005 | BR-009 guard throws `ValidationError` (HTTP 400) instead of spec-declared `422 NO_BILLABLE_TREATMENTS` | API_CONTRACTS POST /invoices |
| dental-billing | EM-BIL-002 | `issueDentalInvoice` omits `staff_full` from allowed roles; spec declares `staff_full, dentist_associate, dentist_owner` | MODULE_SPEC §6 |
| dental-clinical | EM-CLI-005 | `createPrescription` does not validate `prescriberMemberId` non-null at runtime — BR-017 `422 PRESCRIBER_REQUIRED` bypassed | BR-017 |
| dental-pmd | EM-PMD-004 | `importedPMDDocument.ts` allows overwriting superseded records — supersede idempotency not enforced | MODULE_SPEC §5 |
| dental-visit | EM-VIS-004 | Visit status transition `checked_in->in_progress` guarded but `in_progress->completed` guard missing | SM-VISIT |
| dental-org | EM-ORG-011 | Fee schedule entirely unimplemented (WF-042) — blocks AC-ORG-002 | MODULE_SPEC §3/§4 |
| dental-audit | EM-AUD-009 | `dental_audit_log` schema missing 5 required fields from §7 (before_state, after_state, ip_address, session_id, correlation_id) | MODULE_SPEC §7 |

### 6.3 Contract Mismatches

| Module | Finding ID | Description | Spec Ref |
|---|---|---|---|
| dental-scheduling | EM-SCH-6b0869a7 | `DELETE /dental/appointments/:id`: `reason` declared as query param in API_CONTRACTS; implementation reads `cancellationReason` from JSON body — SDK and Hurl tests will fail | API_CONTRACTS |
| dental-billing | EM-BIL-004 | DE-007/DE-008/DE-009 (InvoiceCreated/Paid/Voided) declared but never published — zero event emission | MODULE_SPEC §10b |
| dental-scheduling | EM-SCH-7ceb6966 | DE-010 `AppointmentBooked` not emitted — notification consumers blind to new bookings | MODULE_SPEC §10b |
| dental-scheduling | EM-SCH-0bcbe941 | DE-011 `AppointmentCancelled` not emitted — audit/notifs consumers blind to cancellations | MODULE_SPEC §10b |
| dental-imaging | EM-IMG-005 | Ceph `POST /ceph/landmarks` bulk-upsert rejects locked landmarks in tests but no `// BR-037` code comment — trace chain broken | BR-037 |

---

## 7. File Organization Compliance

Summary from `enforce/file/` reports.

**No P0 file-organization findings in run-5.** All modules have handlers in correct directories; naming conventions met (camelCase handlers, PascalCase shims documented as ALLOWED).

| Module | File P1s | File P2s | Worst Finding |
|---|---|---|---|
| dental-patient | 7 | 4 | 6 handlers with direct inline `db` calls bypassing repo layer (EF-PAT-002..007) |
| dental-clinical | 6 | 5 | `.service.ts` ABSENT; cross-module imports in handlers |
| dental-org | 4 | 3 | 11 PascalCase shims present (ALLOWED, documented); no `.service.ts` |
| dental-visit | 3 | 3 | Direct Drizzle bypasses in identity handlers; inconsistent repo usage |
| dental-billing | 1 | 4 | No `.service.ts`; 14 handlers all instantiate repos inline |
| dental-emr-integration | 2 | 5 | `emr/` module has no `.service.ts`; naming collision risk |
| dental-scheduling | 2 | 2 | Fat handler evidence in `createAppointment.ts`, `checkInAppointment.ts` |
| dental-pmd | 2 | 2 | All 7 handlers instantiate repos with `new PMDDocumentRepository(db)` inline |
| dental-imaging | 2 | 1 | No `.service.ts`; ceph handlers fat |
| dental-perio | 1 | 1 | `completePerioChart.ts` embeds business logic; test coverage gap |
| dental-audit | 2 | 1 | `consumers/domain-events.consumer.ts` logic inline; no consumer test |

**File P0 total: 0. File P1 total: 32. File P2 total: 31. File P3 total: 6.**

---

## 8. UI Journey Findings

From `enforce/ui-journey.md`. **1 P0, 5 P1s across 7 modules.**

### P0

| ID | Module | Description |
|---|---|---|
| UJ-SCH-e5f6g7h8 | dental-scheduling | **Silent error discard in check-in** — WF-007 recovery path breaks silently; user sees no error feedback; appointment may appear stuck in queued state |

### P1s

| ID | Module | Description |
|---|---|---|
| UJ-WS-001 | workspace | `/_workspace/*` routes: `requireAuth` present but `requireRole('workspace')` missing — any authenticated user can access workspace |
| UJ-PAT-001 | dental-patient | `/_dashboard/patients` and `/_dashboard/patients_/$patientId`: no `requireRole('patients')` guard |
| UJ-CAL-001 | dental-scheduling | `/_dashboard/calendar`: no `requireRole('calendar')` guard |
| UJ-PAT-002 | dental-patient | Patient registration modal uses direct `fetch()` instead of SDK hook — error handling inconsistent, no retry |
| UJ-IMG-001 | dental-imaging | `imaging-ceph-report/$imageId` has no auth guard — route is publicly accessible (mirrors EM-IMG-001) |

### Top 3 UI Risks

1. Ceph report publicly accessible — PHI exposure for any patient with a ceph analysis
2. Workspace missing role guard — any logged-in user can access clinical workspace
3. Check-in silent failure — WF-007 can fail invisibly; staff has no recovery path

### Navigation Integrity (partial)

| Route | Auth Guard | Role Guard | Status |
|---|---|---|---|
| `/_dashboard/*` | requireAuth + PIN session | Layout-level only | OK |
| `/_dashboard/billing` | Inherited | requireRole('billing') | OK |
| `/_dashboard/patients` | Inherited | NONE | P1 gap |
| `/_dashboard/calendar` | Inherited | NONE | P1 gap |
| `/_workspace/*` | requireAuth | NONE | P1 gap |
| `/imaging-ceph-report/$imageId` | NONE | NONE | P0 — public |

---

## 9. Cross-Module Findings

From `enforce/cross-module.md`. **44 findings: 25 P0 (EX-architecture), 16 P1, 2 P2, 1 P3.**

### 9.1 EX P0s — Drizzle FK Schema Imports (25)

> **These are NOT code defects.** Drizzle ORM requires importing the parent table object to call `.references()` for FK constraints. Since all dental modules share a single PostgreSQL database, these imports are structurally necessary.

**Resolution path (choose one, document in MODULE_BOUNDARIES.md):**

- **Option 3 (recommended for MVP):** Accept schema FK imports as "allowed structural coupling" in MODULE_BOUNDARIES.md. Enforce that ONLY `*.schema.ts` files may cross-import; no handler or repo logic allowed to cross-import. **Zero code changes. Under 1 hour.**
- Option 1: Consolidate all dental schemas into `dental-core/schemas/` shared package
- Option 2: Replace cross-module FK columns with bare UUID columns; enforce referential integrity at app layer

Pending MODULE_BOUNDARIES.md exemption (Option 3), all 25 EX P0s resolve without any code changes.

### 9.2 P1 Cross-Module Findings (16)

| Pattern | Count | Description |
|---|---|---|
| Handler re-exports | 4 | Some modules re-export handlers from sibling modules (bypasses boundary) |
| Event contract gaps | 7 | 24 domain events declared in EVENT_CONTRACTS.md; 0 actually emitted anywhere in source code |
| API boundary violations | 5 | Handlers directly import Drizzle schema from non-parent modules (in handler/repo logic files, not just schema files) |

**Critical:** EVENT_CONTRACTS.md is effectively empty at runtime. No `emit()` / `publish()` call exists in any handler across all 11 modules. The notifs, audit, and billing cross-module flows are entirely synchronous or absent.

### 9.3 Overall Boundary Health

**POOR.** Cross-module DB schema imports are pervasive (25 P0s). Pattern is systemic, not incidental — every dental module with FK relationships directly imports the foreign module's Drizzle schema. Fixing requires an architectural decision, not per-handler patches.

---

## 10. Traceability Findings

From `enforce/trace.md`. **71 findings: P0:0, P1:17, P2:30, P3:12.**

### 10.1 Summary

| Algorithm | Description | P1 | P2 | P3 |
|---|---|---|---|---|
| 5a | Orphan BRs (BUSINESS_RULES.md not in any MODULE_SPEC or handler code) | 12 | — | — |
| 5b | Orphan spec operations (MODULE_SPEC declares op, no handler exists) | 3 | — | — |
| 5c | Unspecced implementations (handler exists, not in OpenAPI/MODULE_SPEC) | — | 45 | — |
| 5d | Platform module gaps | 2 | 4 | — |
| 5e | Workflow coverage gaps | — | 4 | — |
| 5f | Contract-spec mismatches | — | — | 3 |
| BRs in spec, missing handler code citation | — | — | 12 |

**Key stats:** OpenAPI dental ops: 137/137 covered (100%). BRs with code reference: 23/47 (49%). Event contracts emitted: 0/16 (0%).

### 10.2 Orphan Business Requirements (5a — 12 P1s)

All 12 orphan BRs are Ceph workspace rules (BR-031, BR-037..047). Implemented and partially tested in `ceph.test.ts` but lack `// Enforces BR-NNN` code comments — breaking the automated trace chain.

**Fix:** Add `// Enforces BR-NNN` comments to `CephMgmt_*.ts` handlers. Backfill dental-imaging MODULE_SPEC §5 for ceph BRs. Estimated 2h.

### 10.3 Orphan Spec Operations (5b — 3 P1s)

| Op | MODULE_SPEC | Handler | Gap |
|---|---|---|---|
| PATCH /dental/visits/:id/consent-forms/:cid/revoke | §3 WF-consent-revoke | ABSENT | Handler never created (mirrors EM-CLI-001) |
| GET /dental/org/fee-schedule | §3 WF-042 | ABSENT | Fee schedule not implemented |
| POST /dental/patients/merge | §3 (501 stub) | ABSENT | 501 stub not wired |

### 10.4 Unspecced Implementations (5c — 45 P2s)

Notable: QueueItem entity (scheduling), inventory management (clinical), occlusion screening (clinical), post-op templates (clinical), claim draft (patient), consultation notes (emr/). Implemented but have no OpenAPI spec entry or MODULE_SPEC citation.

---

## 11. Ratchet Summary

| Category | Run-4 Count | Run-5 Count | Notes |
|---|---|---|---|
| **REGRESSION** | — | **0** | No finding worsened in severity |
| **NEW** | — | **84** | 25 EX cross-module P0s (architecture), 2 dental-imaging P0s (ceph auth + cross-branch), 1 UI-journey P0 (check-in silence), 3 dental-emr P0s (IDENTITY_CHANGED), 12 trace 5a BR orphans, 3 trace 5b ops, ~38 F2 P1s (service-layer confirmed absent across all modules) |
| **KNOWN** | — | **221** | Persistent P0s/P1s carried from run-4 baseline where no fix was committed |
| **RESOLVED** | 27 (cumulative) | **+18** | EM-ORG-019 (org update ownership) confirmed closed run-5 re-verification; 17 carry-forward from run-3/4 sprint fixes |

**No regressions in run-5.** The P0 sprint and §10.2 auth fixes hold. All new findings are additive (architecture layer, F2 service-layer layer, trace algorithm). No prior fix was broken.

### Ratchet Notes

- Finding ID matching is best-effort; ambiguous IDs classified NEW per protocol
- dental-emr-integration IDENTITY_CHANGED (source_path null -> handlers/emr/) — all EMR findings classified NEW
- Score comparison invalid across runs (coverage score vs compliance score metric change); annotated accordingly

---

## 12. F2 Service-Layer/DI Assessment

### 12.1 Service-Layer Status by Module

| Module | `.service.ts` | `.repo.ts` | Fat Handlers | F2 Work Needed |
|---|---|---|---|---|
| dental-audit | ABSENT | Present | `consumers/domain-events.consumer.ts` embeds routing + PHI logic | Create `dental-audit.service.ts`; wire consumer |
| dental-billing | ABSENT | Present (14 repos) | All 14 handlers fat | Create `dental-billing.service.ts` |
| dental-clinical | ABSENT | Present | allergy check, FSM, allergy cross-check inline | Create `dental-clinical.service.ts` |
| dental-emr-integration | ABSENT | Present (`emr.repo.ts`) | FUTURE_PHASE | After namespace collision resolved |
| dental-imaging | ABSENT | Present | Ceph handlers: idempotent recompute + calibration inline | Create `dental-imaging.service.ts` |
| dental-org | ABSENT | Present (3 repos) | 4 fat handlers (create embeds validation + audit) | Create `dental-org.service.ts` |
| dental-patient | ABSENT | Partial (cross-module coupling) | `identity/` fat; `engagement/` fat | Create `dental-patient.service.ts`; fix repo coupling |
| dental-perio | ABSENT | Present (5 repos) | `completePerioChart.ts` fat (stats + BR-P07) | Create `dental-perio.service.ts` |
| dental-pmd | ABSENT | Present (2 repos) | All 7 handlers fat (supersede-or-create inline) | Create `dental-pmd.service.ts` |
| dental-scheduling | ABSENT | Present | `createAppointment.ts` fat; `checkInAppointment.ts` fat | Create `dental-scheduling.service.ts` |
| dental-visit | ABSENT | Present | Inconsistent — some handlers bypass repo | Create `dental-visit.service.ts` |

**Universal finding: `.service.ts` ABSENT in 100% of modules (11/11).** Repos present in 10/11. F2 remediation = 10 new service files + DI wiring.

### 12.2 DI Pattern Status

| Pattern | Current | Required |
|---|---|---|
| Repo instantiation | `new XxxRepository(db)` inline in every handler body | Singleton injected at route registration |
| Service instantiation | N/A | Singleton exported from `dental-xxx.service.ts` |
| Constructor injection | Not present | Service accepts repo via constructor for testability |
| Request-scoped `db` | Passed per-request to every new repo | Passed once to service constructor |

### 12.3 Recommended F2 Rollout Order

Ordered by: existing partial service work > higher compliance score > lower risk.

| Order | Module | Rationale |
|---|---|---|
| 1 | **dental-visit** | Partial service work exists as reference; compliance 72 (highest); cleanest existing repo layer |
| 2 | **dental-billing** | Full repo layer (14 repos); well-specced workflows; compliance 61 |
| 3 | **dental-scheduling** | Repo layer present; compliance 68; P0 check-in fat handler causes UI WF-007 silent fail |
| 4 | **dental-clinical** | Compliance 66; repo layer present; consent revoke P0 cleanest to fix in service |
| 5 | **dental-org** | 3 repos present; compliance 54; 6 P0s urgently need service boundary |
| 6 | **dental-perio** | 0 P0s; clinical safety P1 (deep-pocket threshold) cleanest to fix in service |
| 7 | **dental-pmd** | 2 P0s; 7 fat handlers all same pattern — quick wins |
| 8 | **dental-patient** | 4 P0s; cross-module repo coupling must be fixed alongside service layer |
| 9 | **dental-imaging** | 3 P0s; ceph math engine belongs in service |
| 10 | **dental-audit** | 6 P0s; consumer wiring blocked on service layer |
| — | dental-emr-integration | FUTURE_PHASE — defer until namespace collision resolved |

---

## 13. Stabilization Plan

Priority-ordered. Work in sequence.

### Priority 0: MODULE_BOUNDARIES.md Exemption (under 1h, clears 25 P0s)

1. Add Option 3 exemption to `MODULE_BOUNDARIES.md`: "`*.schema.ts` files may import FK table objects from other dental modules; handler and repo logic files may NOT"
2. Re-run `oli-enforce-cross-module` to reclassify 25 EX P0s as EXEMPT
3. **Expected result: effective P0 count drops from 51 to 26**

### Priority 1: Fix Code-Change P0s (26 findings)

**Group A: PHI / Security (fix first)**

- EM-PAT-004 — `listDentalPatients` cross-branch PHI leak
- EM-IMG-001 / UJ-IMG-001 — Ceph report unauthenticated public route
- EM-AUD-003 — `displayName` written to audit log

**Group B: Auth/Role Fixes**

- EM-PAT-001, EM-PAT-002, EM-PAT-003 — dental-patient route roles + archive body
- EM-BIL-001 — `listDentalInvoices` branchId guard
- EM-SCH-dc03d114 — scheduling routes role guard
- EM-ORG-001..003, EM-ORG-010 — unguarded org/branch routes + IDOR
- UJ-WS-001, UJ-PAT-001, UJ-CAL-001 — frontend route role guards

**Group C: Contract Correctness**

- EM-CLI-001 — Create consent-form revoke handler + register 405 route
- EM-CLI-002 — Medical history: return 405 MEDICAL_HISTORY_IMMUTABLE
- EM-PMD-001 — ImportedPMD immutability: return 405
- EM-AUD-006 — Register 405 routes for audit log
- EM-SCH-6b0869a7 — Fix `cancellationReason` to query param

**Group D: Data + Clinical Safety**

- EM-PER-002 — **Change deep-pocket threshold 5mm -> 6mm** (one-line fix; clinical safety)
- EM-PMD-002 — Add `dentist_owner` role check to `generatePMD`
- EM-VIS-001, EM-VIS-002, EM-VIS-003 — Visit lock + FSM + carry-over notification
- EM-AUD-004, EM-AUD-005 — Audit recursion + setPin unaudited
- EM-AUD-001, EM-AUD-002 — Audit auth role + branch guard

**Group E: Schema Defects**

- EM-IMG-002 — Add `study_date` column to `imaging_study` table
- EM-AUD-009 — Add 5 missing fields to `dental_audit_log` schema

### Priority 2: F2 Service-Layer Rollout

Execute in rollout order from §12.3 (dental-visit first).

Per module:
1. Create `dental-xxx.service.ts` with constructor-injected repos
2. Export singleton: `export const dentalXxxService = new DentalXxxService()`
3. Migrate fat handler business logic to service methods
4. Update handlers to thin wrappers only
5. Add `// Enforces BR-NNN` comments to all business rule implementations
6. Update MODULE_SPEC §20 with service interface contract

### Priority 3: P1s (Non-F2)

- EM-BIL-002, EM-BIL-004, EM-BIL-005 — billing role + domain events + error codes
- EM-SCH-7ceb6966, EM-SCH-0bcbe941 — AppointmentBooked/Cancelled event emission
- EM-CLI-005 — prescriber required runtime validation
- Trace 5a — Add `// Enforces BR-NNN` to CephMgmt handlers; backfill MODULE_SPEC §5

### Priority 4: Architecture

- `MODULE_BOUNDARIES.md`: document all coupling rules (schema FK, handler re-export, event boundary)
- `EVENT_CONTRACTS.md`: wire at least 3 core events (AppointmentBooked, InvoiceCreated, AuditLogCreated) via pg-boss
- dental-emr-integration: rename `handlers/emr/` -> `handlers/dental-consultation/` before Phase 3

---

## 14. What's Next

**Current state:** 26 code-change P0s open (51 raw - 25 exemptable EX P0s). Branch 3 applies.

> **Branch 3: P0 count > 10 — Triage P0s, separate security sprint.**

### Immediate actions (this sprint):

1. **Write MODULE_BOUNDARIES.md Option 3 exemption** — 25 P0s resolve without code, effective P0 count drops to 26.

2. **Security sprint** — target Group A + B P0s in §13. Priority order:
   - PHI first: EM-PAT-004, EM-IMG-001/UJ-IMG-001, EM-AUD-003
   - Auth next: EM-PAT-001/002, EM-SCH-dc03d114, EM-ORG-001..003, UJ-WS-001/PAT-001/CAL-001

3. **Clinical safety fix** — EM-PER-002: change deep-pocket threshold 5mm -> 6mm. One-line fix; treat as P0 urgency.

### After security sprint (P0 count reaches 0):

4. Begin **F2 service-layer rollout** starting with dental-visit (§12.3 order). Target: one module per sprint.

5. Post F2 rollout: re-run `oli-enforce-all` to establish run-6 baseline with F2 compliance scores.

### Graduation path

```
run-5 now:                    51 P0s (26 code + 25 EX)
+ MODULE_BOUNDARIES.md:       26 P0s
+ security sprint:             0 P0s
+ F2 rollout:                  avg compliance rises from 49.5 toward 70+
run-6 target:                  0 P0s, avg compliance >= 70
graduation gate:               0 P0s, avg compliance >= 90 (requires full F2 + event wiring)
estimated graduation:          3 sprints minimum
```
