# Dentalemon V1 — Full Enforcement Report

<!-- oli-enforce-all v1.0 | generated: 2026-05-27 | run: baseline-004-section-10-2-auth-resolved | modules: 11 | agents: 33 -->
<!-- flags: --auto --json | mode: ratchet-reclassify (27 P0 findings RESOLVED: 19 P0 sprint + 8 §10.2 auth/IDOR, commit 80f11f7) -->

---

## 1. Audit Scope

### 1.1 Artifact Availability Matrix

| Input | File | Present |
|---|---|---|
| Module Map | `docs/product/MODULE_MAP.md` | ✅ |
| Domain Model | `docs/product/DOMAIN_MODEL.md` | ✅ |
| Workflow Map | `docs/product/WORKFLOW_MAP.md` (587 L) | ✅ |
| Event Contracts | `docs/product/EVENT_CONTRACTS.md` (569 L) | ✅ |
| Role Permission Matrix | `docs/product/ROLE_PERMISSION_MATRIX.md` (121 L) | ✅ |
| IDEAL Standard | `docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` (873 L) | ✅ |
| MODULE_SPEC × 11 | `docs/product/modules/*/MODULE_SPEC.md` | ✅ |
| API_CONTRACTS × 11 | `docs/product/modules/*/API_CONTRACTS.md` | ✅ (partial coverage) |
| Prior Baseline | `docs/audits/enforce/.baseline.json` | ❌ **First run** |

### 1.2 Sub-Skill Dispatch Log (33 agents)

| Phase | Sub-Skill | Module(s) | Status |
|---|---|---|---|
| 0 | oli-enforce-coverage | all 11 | ✅ |
| 1 | oli-enforce-module | dental-audit | ✅ |
| 1 | oli-enforce-file | dental-audit | ✅ |
| 1 | oli-enforce-module | dental-billing | ✅ (findings from notification; module file missing — incorporated below) |
| 1 | oli-enforce-file | dental-billing | ✅ |
| 1 | oli-enforce-module | dental-clinical | ✅ |
| 1 | oli-enforce-file | dental-clinical | ✅ |
| 1 | oli-enforce-module | dental-emr-integration | ✅ |
| 1 | oli-enforce-file | dental-emr-integration | ✅ |
| 1 | oli-enforce-module | dental-imaging | ✅ |
| 1 | oli-enforce-file | dental-imaging | ✅ |
| 1 | oli-enforce-module | dental-org | ✅ |
| 1 | oli-enforce-file | dental-org | ✅ |
| 1 | oli-enforce-module | dental-patient | ✅ |
| 1 | oli-enforce-file | dental-patient | ✅ |
| 1 | oli-enforce-module | dental-perio | ✅ |
| 1 | oli-enforce-file | dental-perio | ✅ |
| 1 | oli-enforce-module | dental-pmd | ✅ |
| 1 | oli-enforce-file | dental-pmd | ✅ (path corrected: `enforce/dental-pmd.md` → `enforce/file/dental-pmd.md`) |
| 1 | oli-enforce-module | dental-scheduling | ✅ |
| 1 | oli-enforce-file | dental-scheduling | ✅ |
| 1 | oli-enforce-module | dental-visit | ✅ |
| 1 | oli-enforce-file | dental-visit | ✅ |
| 1.5 | oli-ui-journey | dental-billing | ✅ |
| 1.5 | oli-ui-journey | dental-clinical | ✅ |
| 1.5 | oli-ui-journey | dental-imaging | ✅ |
| 1.5 | oli-ui-journey | dental-org | ✅ |
| 1.5 | oli-ui-journey | dental-patient | ✅ |
| 1.5 | oli-ui-journey | dental-pmd | ✅ |
| 1.5 | oli-ui-journey | dental-scheduling | ✅ |
| 1.5 | oli-ui-journey | dental-visit | ✅ |
| 2 | oli-enforce-cross-module | all | ✅ |
| 2.5 | oli-trace | all | ✅ → `docs/audits/enforce/trace.md` |

**Phase 1.5 skipped (3 modules):** dental-audit (no FE), dental-emr-integration (not implemented), dental-perio (UI prototype-only).

---

## 2. Executive Summary

### 2.1 Overall Coverage

| Metric | Value |
|---|---|
| Modules audited | 11 of 11 |
| Average spec coverage score | 70% (range: 52%–90%) |
| API handlers with spec coverage | 77 / 222 (35%) |
| Modules below 70% coverage | 5 (audit 52%, patient 55%, imaging 61%, org 64%, clinical 68%) |

### 2.2 Finding Counts

> Run-1 (2026-05-27): 486 findings. Run-2 (+2 P0: EM-ORG-019/020). Run-3 (2026-05-27): **19 P0 findings RESOLVED** (P0 sprint — commits verified). Run-4 (2026-05-27): **8 §10.2 P0 auth/IDOR findings RESOLVED** (enforce-fix-004, commit 80f11f7). Total baseline: **488**. Open: **461**.

| Severity | EC- | EM- | EF- | UJ- | EX- | TR- | **Total** | **Open** |
|---|---|---|---|---|---|---|---|---|
| **P0 BLOCKER** | 9 | 59 | 60 | 39 | 4 | 5 | **176** | **146** (−27 resolved: 19 P0 sprint + 8 §10.2) |
| **P1 WARNING** | 5 | 64 | 60 | 35 | 2 | 31 | **197** | **197** |
| **P2 INFO** | 9 | 15 | 20 | 15 | 0 | 0 | **59** | **59** |
| **P3 NOTE** | 1 | 20 | 20 | 15 | 0 | 0 | **56** | **56** |
| **Total** | **24** | **158** | **160** | **104** | **6** | **36** | **488** |

### 2.3 Per-Module Severity Breakdown

| Module | Coverage | P0 | P1 | P2/P3 | V1 Status |
|---|---|---|---|---|---|
| dental-audit | 52% | 9 | 14 | 5 | 🔴 NOT READY |
| dental-billing | 72% | 21 | 19 | 7 | 🔴 NOT READY |
| dental-clinical | 68% | 17 | 16 | 8 | 🔴 NOT READY |
| dental-emr-integration | N/A | 6 | 9 | 3 | ⚪ FUTURE PHASE |
| dental-imaging | 61% | 26 | 21 | 5 | 🔴 NOT READY |
| dental-org | 64% | 5 ↓ | 14 | 9 | 🔴 NOT READY |
| dental-patient | 55% | 13 | 20 | 9 | 🔴 NOT READY |
| dental-perio | 90% | 7 | 7 | 0 | 🟡 CONDITIONAL |
| dental-pmd | 82% | 13 ↓ | 15 | 7 | 🟡 CONDITIONAL |
| dental-scheduling | 75% | 15 | 15 | 4 | 🔴 NOT READY |
| dental-visit | 73% | 13 ↓ | 19 | 12 | 🔴 NOT READY |

> ↓ = open P0 reduced in run-4 (§10.2 auth/IDOR fixes, commit 80f11f7)

> **🔴 NOT READY (9 of 11):** P0 blockers are present that prevent safe production use. Fix-Now list applies.  
> **🟡 CONDITIONAL (2 of 11):** P0 blockers are narrower and fixable within a sprint; P1+ items tracked.  
> **⚪ FUTURE PHASE:** dental-emr-integration is out of scope for V1.

### 2.4 Systemic Findings (Cross-Cutting)

| Finding | Impact | Modules Affected |
|---|---|---|
| **All 23 domain events (DE-001..023) never emitted** | Silent data pipeline failure; audit trail, notifs, downstream consumers all starved | All 11 |
| **pg-boss audit consumer entirely absent** | Audit log may be silently empty; WF-096 unimplemented | dental-audit |
| **Chart layer separation (baseline/proposed/completed) absent** | Core clinical differentiating feature entirely unimplemented | dental-visit, dental-clinical |
| **GDPR patient erasure not implemented** | Legal compliance gap (WFG-006) | dental-patient |
| **222 handlers, only 77 (35%) have API_CONTRACTS coverage** | Enforcement runs on unspecced handlers produce unreliable results | All |

---

## 3. Coverage Findings (Phase 0 — EC-)

> Full report: `docs/audits/ENFORCEMENT_COVERAGE.md`

| ID | Module | Sev | Description |
|---|---|---|---|
| EC-DAUD-001 | dental-audit | P0 | `getAuditEvents.ts` role check `admin` not `dentist_owner`; dentist owners get 403 |
| EC-DAUD-002 | dental-audit | P0 | Endpoint registered at `/dental/admin/audit` not spec's `/dental/audit-events` |
| EC-DAUD-003 | dental-audit | P0 | WF-096 pg-boss consumer entirely absent |
| EC-DCLI-001 | dental-clinical | P0 | `updateMedicalHistoryEntry` handler exists but spec declares append-only (AC-CLI-005) |
| EC-DIMG-001 | dental-imaging | P0 | Dual handler sets (old + facade) coexist — route conflicts likely |
| EC-DORG-001 | dental-org | P0 | 6 PIN handlers entirely unspecced in MODULE_SPEC §10 / API_CONTRACTS |
| EC-DORG-002 | dental-org | P0 | Dual handler sets coexist — facade migration incomplete |
| EC-DPAT-001 | dental-patient | P0 | Treatment plan ownership conflict between dental-patient and dental-visit |
| EC-DSCH-001 | dental-scheduling | P0 | MODULE_SPEC §8 explicitly states no standalone queue table; 3 queue handlers exist |
| EC-DBIL-001 | dental-billing | P2 | API_CONTRACTS uses status `sent`; code uses `issued` — mismatch |
| EC-DVIS-001 | dental-visit | P1 | BR-008 carry-over implementation deviates from `source_visit_id` contract |
| EC-DVIS-002 | dental-visit | P1 | FSM init state missing `not_started` from schema |
| EC-DVIS-003 | dental-visit | P1 | Dentition path inconsistency |
| EC-DEMR-001 | dental-emr-integration | P3 | 7 spec sections absent (§4, §9, §12, §13, §15, §17, §18) |

---

## 4. Module Compliance (Phase 1 — EM-)

### 4.1 dental-audit — V1 Readiness: 1.5/10 🔴

**Summary:** The audit module has a working repository layer but every declared acceptance criterion has at least one gap. The GET endpoint uses the wrong role (admin vs dentist_owner), lacks branch scoping, and the spec's entire async write pathway (pg-boss consumer) is absent. The module also violates its own §17 anti-recursion rule.

| ID | Sev | Finding |
|---|---|---|
| EM-AUDIT-001 | P0 | Auth model mismatch — `admin` enforced, spec requires `dentist_owner`; all dentist owners get 403 on audit log |
| EM-AUDIT-002 | P0 | No `assertBranchAccess` guard — any admin can query any branch's audit data (AC-AUD-003 violated) |
| EM-AUDIT-003 | P0 | G-005 PHI leak — `displayName` written to `audit_log_entry.details` in verifyPin handler |
| EM-AUDIT-004 | P0 | `listAuditLogs` writes a new audit entry on every call — recursion violation (MODULE_SPEC §17) |
| EM-AUDIT-005 | P0 | `setPin` writes no audit event — sensitive operation unaudited |
| EM-AUDIT-006 | P0 | No 405 routes for PATCH/PUT/DELETE on audit events (AC-AUD-002 not enforced) |
| EM-AUDIT-007 | P1 | WF-096 async pg-boss consumer entirely absent — all 24 domain events never consumed |
| EM-AUDIT-008 | P1 | ~28 write handlers across modules missing `logAuditEvent` calls |
| EM-AUDIT-009 | P1 | `dental_audit_log` missing 5 declared §7 fields: `category`, `event_type`, `outcome`, `ip_address`, `retention_status` |
| EM-AUDIT-010 | P1 | `metadata` field silently dropped in audit log writes |
| EM-AUDIT-011 | P1 | `INVALID_DATE_RANGE` (422) validation absent |
| EM-AUDIT-012 | P1 | `limit`/`offset` NaN not guarded — malformed params cause DB errors |
| EM-AUDIT-013 | P1 | Query param names diverge from spec (snake_case vs camelCase; `page/per_page` vs `limit/offset`) |
| EM-AUDIT-014 | P1 | No HTTP-level test for `getAuditEvents` handler |
| EM-AUDIT-015 | P1 | `verifyPin` lockout check uses pre-increment failed-attempt count |
| EM-AUDIT-016 | P3 | `AC-003` test label conflates repo test and AC |
| EM-AUDIT-017 | P3 | Two parallel audit tables (`dental_audit` + `dental_audit_log`) create ambiguity |
| EM-AUDIT-018 | P3 | Stale `as any` casts in wiring test indicate schema mismatch |

---

### 4.2 dental-billing — V1 Readiness: 4/10 🔴

**Summary:** Core invoice and payment flows are structurally present. However, 9 blockers span security (caller-controlled patientId in payment plan, no branch scope in list), data integrity (FSM bypassed for draft invoices), business rule violations (taxRate accepted from client), and a systemic event emission failure.

| ID | Sev | Finding |
|---|---|---|
| EM-BILL-001 | P0 | `taxRate` accepted from client body — violates BR-010 ("taxCents must always be 0", ADR-008) |
| EM-BILL-002 | P0 | `staff_full` excluded from invoice issue endpoint — primary billing role locked out of a required workflow |
| EM-BILL-003 | P0 | Payment accepted on `draft` status invoices — bypasses `draft→issued` FSM requirement |
| EM-BILL-004 | P0 | `voidInvoice` reads `reason` from body but never stores it — BR-016 void-reason audit trail missing |
| EM-BILL-005 | P0 | DE-007 InvoiceCreated, DE-008 InvoicePaid, DE-009 InvoiceVoided — never emitted in any handler |
| EM-BILL-006 | P0 | Invoice number generation is a non-atomic read-modify-write — concurrent creates produce duplicate numbers |
| EM-BILL-007 | P0 | `patientId` in payment plan creation is caller-controlled with no ownership verification (IDOR) |
| EM-BILL-008 | P0 | `listInvoices` has no `branchId` scope guard — returns all-org invoices to any branch member |
| EM-BILL-009 | P0 | Void payment does not handle transition from `overdue` status — `overdue→voided` not in FSM |
| EM-BILL-010 | P1 | Payment plan installment status returns camelCase `onTrack`; DB stores snake_case `on_track` — labels always blank |
| EM-BILL-011 | P1 | `markUncollectible` returns 501 correctly but is missing from route registration in generated routes |
| EM-BILL-012 | P1 | Fee schedule lookup (WF-042) — handler absent; endpoint 404 in production |
| EM-BILL-013 | P1 | Overdue cron (WF-054) — pg-boss job registered but consumer absent |
| EM-BILL-014 | P1 | `discountCents` applies no permission check — any role can apply discounts (BR-004: dentist_owner only) |
| EM-BILL-015 | P1 | Payment exceeds balance check absent — overpayment possible without error |

---

### 4.3 dental-clinical — V1 Readiness: 3.5/10 🔴

**Summary:** Prescription, consent, lab order, and medical history handlers exist but 6 P0 blockers prevent safe use: visit immutability is unenforced on 6 of 7 write handlers, consent revocation is entirely absent, medical history allows mutation of append-only records, and all 5 domain events are never emitted.

| ID | Sev | Finding |
|---|---|---|
| EM-CLIN-001 | P0 | BR-003 visit immutability not enforced on: `createPrescription`, `signConsentForm`, `createConsentForm`, `createAttachment`, `createAmendment`, `updatePrescription` |
| EM-CLIN-002 | P0 | WF-035 (Revoke Consent) handler entirely absent — no `revokeConsentForm` handler, no route, no schema column |
| EM-CLIN-003 | P0 | `signConsentForm` allows `staff`/`hygienist` to sign on behalf of patient — spec restricts to patient signature |
| EM-CLIN-004 | P0 | DE-012 ConsentSigned, DE-013 ConsentRevoked, DE-014 LabOrderCreated, DE-015 LabOrderCompleted, DE-016 PrescriptionWritten — none emitted |
| EM-CLIN-005 | P0 | `updateMedicalHistoryEntry` allows full PATCH on append-only records (AC-CLI-005 violated) |
| EM-CLIN-006 | P0 | `createPrescription` allergy check uses unvalidated `patientId` from request body (IDOR — allergy data from any patient accessible) |
| EM-CLIN-007 | P1 | Lab order FSM status names diverge from API contract (`pending` vs `submitted`, `in_lab` vs `processing`, etc.) |
| EM-CLIN-008 | P1 | `listPrescriptions` fetches all rows then paginates in-memory (unbounded query risk) |
| EM-CLIN-009 | P1 | `signConsentForm` checks `existing.signed` boolean instead of `status` field — boolean is always false after schema migration |
| EM-CLIN-010 | P1 | `createConsentForm` allows `hygienist` role — not in MODULE_SPEC §6 |
| EM-CLIN-011 | P1 | `createAmendment` does not validate referenced record exists — orphan amendments possible |
| EM-CLIN-012 | P1 | `AttachmentsSheet` "All" tab leaks cross-visit patient attachments without branch-scope auth |
| EM-CLIN-013 | P1 | `toggleEntry` in medical history calls `updateMedicalHistoryEntry` — same append-only violation as EM-CLIN-005 |
| EM-CLIN-014 | P3 | AC-PRES-04 and AC-PRES-05 are duplicate tests |
| EM-CLIN-015 | P3 | `console.error` in AmendmentForm without user feedback |
| EM-CLIN-016 | P3 | `deleteAttachment` allows deletion on locked visit — inconsistent with BR-003 |
| EM-CLIN-017 | P3 | WF-038 amendment spec requires audit event; handler emits none |

---

### 4.4 dental-emr-integration — V1 Readiness: N/A ⚪ (Future Phase)

**Summary:** Module is declared in the spec as Phase 3+ only. However, a live `emr/` handler directory exists (consultation notes, finalize, list EMR patients) — an active name and directory collision with the future `dental-emr-integration` module. The spec itself has two contradictions that must be resolved before implementation begins.

| ID | Sev | Finding |
|---|---|---|
| EM-EMR-001 | P0 | Route path collision: `GET /dental/emr/:patientId` vs `GET /dental/emr/:id` are indistinguishable at runtime |
| EM-EMR-002 | P0 | Spec contradiction: §6 permits DELETE; AC-EMR-001 mandates 405 METHOD_NOT_ALLOWED — cannot implement both |
| EM-EMR-003 | P0 | Active `services/api-ts/src/handlers/emr/` directory conflicts with planned `dental-emr-integration` handler location (UNS-006) |
| EM-EMR-004 | P1 | MODULE_SPEC missing §9 UI/UX, §12 Test Expectations, §13 Edge Cases, §15 Error Handling, §17 Observability, §18 Feature Flags |
| EM-EMR-005 | P1 | ROLE_PERMISSION_MATRIX.md has no rows for dental-emr-integration roles |
| EM-EMR-006 | P1 | No `branchId` scoping declared in spec — cross-branch EMR data isolation unspecified |
| EM-EMR-007 | P1 | Schema §7.3 missing `source_system_version` field declared in API_CONTRACTS |

---

### 4.5 dental-imaging — V1 Readiness: 4/10 🔴

**Summary:** Ceph analysis and finding pipelines are functionally present. Key blockers: all 3 domain events never published, `IMAGING_TIER_REQUIRED` error code never emitted (always `FORBIDDEN`), imaging_finding has direct DB FKs to external modules violating loose coupling, and ceph recompute is missing critical guard conditions.

| ID | Sev | Finding |
|---|---|---|
| EM-IMG-001 | P0 | DE-018 ImagingStudyUploaded, DE-019 ImagingFindingConfirmed, DE-020 CephAnalysisComputed — never published in any handler |
| EM-IMG-002 | P0 | `IMAGING_TIER_REQUIRED` error code never emitted — `ForbiddenError` always emits generic `FORBIDDEN` |
| EM-IMG-003 | P0 | `imaging_finding.schema.ts` has DB-level FKs to `dental_visit`, `patients`, `dental_branch` — violates loose-coupling boundary (§20 architectural invariant) |
| EM-IMG-004 | P0 | `CephMgmt_recomputeCephAnalysis` missing `NOT_CALIBRATED` and `INSUFFICIENT_LANDMARKS` guards (spec declares both as 422) |
| EM-IMG-005 | P0 | `patient_display_id` in ceph report snapshot stores raw UUID not human-readable identifier |
| EM-IMG-006 | P1 | WF-019 study state machine (`pending_review → reviewed`) not implemented — studies skip directly to `active` |
| EM-IMG-007 | P1 | `study_date` falls back to `createdAt` with acknowledged code comment — spec requires explicit capture |
| EM-IMG-008 | P1 | `createImagingStudy` comment says hygienist may upload but `assertBranchRole` only allows `dentist_owner`, `dentist_associate` |
| EM-IMG-009 | P1 | `imagingTier` derivation from study type not implemented — tier check bypassed at study creation |
| EM-IMG-010 | P1 | `upsertAnalysis` does not update `calibrationValue`/`calibrationMethod` on conflict |
| EM-IMG-011 | P1 | WF-040 finding immutability after visit lock not enforced |
| EM-IMG-012 | P1 | AC-IMG-002 (annotation status reversal → 422) — `imaging_annotation` table has no `status` column; no annotation state machine exists |
| EM-IMG-013 | P3 | DICOM MIME type (`application/dicom`) absent from `ALLOWED_IMAGING_MIME_TYPES` |
| EM-IMG-014 | P3 | `listPatientImages` missing `mimeType` and `fileSizeBytes` for imaging-source rows |
| EM-IMG-015 | P3 | Ceph report imagingTier check may have null-tier → free mapping gap |

---

### 4.6 dental-org — V1 Readiness: 2.5/10 🔴

> ⚠️ **Run-2 delta (2026-05-27):** +2 new P0 findings from PIN handler batch. Two new facade routes (`set-pin`, `verify-pin`) added without `authMiddleware` — both currently non-functional (always 401). Fix together with EM-ORG-002 (ownership check) before enabling.

**Summary:** Organization, branch, and membership management is functionally present. Six critical security gaps: three PIN routes lack `authMiddleware` (recoverPin, set-pin, verify-pin — all currently 401 every caller), `setPin` allows privilege escalation across members, `listMembers` leaks `securityAnswerHash`, and any authenticated user can update any org's settings.

| ID | Sev | Status | Finding |
|---|---|---|---|
| EM-ORG-001 | P0 | KNOWN | `recoverPin` route missing `authMiddleware` — unauthenticated cross-tenant PIN reset possible |
| EM-ORG-002 | P0 | KNOWN | `setPin` only checks `assertBranchAccess` — any branch member can overwrite any other member's PIN |
| EM-ORG-003 | P0 | KNOWN | `listMembers` exposes `securityAnswerHash` and `securityQuestion` to all branch members |
| EM-ORG-004 | P0 | KNOWN | `DentalOrganizationManagement_update` has no ownership check — any authenticated user can PATCH any tenant's org |
| EM-ORG-019 | P0 | **NEW** | `DentalMembershipManagement_setPin` route (routes.ts:857) missing `authMiddleware` — route currently always 401 |
| EM-ORG-020 | P0 | **NEW** | `DentalMembershipManagement_verifyPin` route (routes.ts:865) missing `authMiddleware` — route currently always 401 |
| EM-ORG-005 | P1 | KNOWN | `deactivateMember` uses `assertBranchAccess` not `assertBranchRole('dentist_owner')` — any member can deactivate peers |
| EM-ORG-006 | P1 | KNOWN | `recordFailedPinAttempt` is non-atomic read-modify-write — lockout bypassable under concurrent requests |
| EM-ORG-007 | P1 | KNOWN | `createMember` has no `dentist_owner` role gate — any branch member can add new staff |
| EM-ORG-008 | P1 | KNOWN | `DentalBranchManagement_create` has no ownership check — any authenticated user can create branches under any org |
| EM-ORG-009 | P1 | KNOWN | `DentalOrganizationManagement_get` has no ownership/membership check — any user can read any org |
| EM-ORG-010 | P1 | KNOWN | `updateMember` response leaks `securityAnswerHash` |
| EM-ORG-011 | P1 | KNOWN | Membership `status` enum mismatch between spec and schema (`invited` state missing from schema) |
| EM-ORG-012 | P1 | KNOWN | Duplicate handler files for `setPin` and `verifyPin` — divergence risk between old and facade implementations |
| EM-ORG-013 | P1 | KNOWN | `recoverPin` lockout check uses stale pre-request member state |
| EM-ORG-014 | P3 | KNOWN | `ROLE_LABELS` in `pin-select.tsx` only maps 4 roles; schema has 9 |
| EM-ORG-015 | P3 | KNOWN | `DentalMembershipManagement_create` marked deprecated but still registered as live route |
| EM-ORG-016 | P3 | KNOWN | API contract specifies `org_tier` field; implementation uses `tier` |
| EM-ORG-017 | P3 | KNOWN | Lockout thresholds are magic numbers — not named constants |
| EM-ORG-018 | P3 | KNOWN | `listMembers` pagination computes total before slicing but passes sliced-page length to `buildPaginationMeta` |

---

### 4.7 dental-patient — V1 Readiness: 3/10 🔴

**Summary:** Patient CRUD and archive flows exist but 8 blockers span auth bypass (null `preferredBranchId` skips all auth, `branchId` optional in create), data integrity (non-atomic follow-up notes, archived read-only gate absent from all write handlers), compliance (import skips consent), and a cross-branch data leak on list.

| ID | Sev | Finding |
|---|---|---|
| EM-PAT-001 | P0 | BR-015b archived read-only gate missing from ALL write handlers: `updateDentalPatient`, `addFollowUpNote`, `createPatientContact`, `createDentalAlert`, `createRecall` |
| EM-PAT-002 | P0 | `archiveDentalPatient` uses `assertBranchAccess` not `assertBranchRole('dentist_owner')` — any member can archive |
| EM-PAT-003 | P0 | `archiveDentalPatient` reads no request body — required `reason` field never captured, validated, or stored |
| EM-PAT-004 | P0 | `listDentalPatients` silently expands branch filter to org-wide when branch has `organizationId` (AC-PAT-004 violated — cross-branch data leak) |
| EM-PAT-005 | P0 | `branchId` optional in `createDentalPatient` — patients created without branch, `assertBranchAccess` skipped, accessible to anyone |
| EM-PAT-006 | P0 | `importPatients` skips consent validation entirely (BR-015) — bulk registration bypasses compliance gate |
| EM-PAT-007 | P0 | All patient read/write handlers have `if (patient.preferredBranchId) { assertBranchAccess }` — null `preferredBranchId` silently skips auth |
| EM-PAT-008 | P0 | `addFollowUpNote` uses two sequential non-atomic `db.update()` calls — concurrent appends lose one note (clinical data loss) |
| EM-PAT-009 | P1 | Export endpoint path diverges from API contract |
| EM-PAT-010 | P1 | Export uses `assertBranchAccess` not `assertBranchRole` — `dentist_owner` restriction not enforced |
| EM-PAT-011 | P1 | `bulkArchiveDentalPatients` enforces access not role check |
| EM-PAT-012 | P1 | `getDentalPatientStatement` accessible by `staff_scheduling` — spec restricts to `staff_full` + `dentist_owner` |
| EM-PAT-013 | P1 | `createDentalPatient` returns 400 for consent violation instead of spec's 422 |
| EM-PAT-014 | P1 | `addFollowUpNote` duplicate implementations with divergent validation |
| EM-PAT-015 | P1 | Safety floor `getDentalPatient` response missing `medications` and `conditions` (IDEAL §3 safety floor requirement) |
| EM-PAT-016 | P1 | DE-021 PatientRegistered event never emitted |
| EM-PAT-017 | P1 | `patients.tsx` uses raw `fetch` instead of SDK; invalidates wrong query key |
| EM-PAT-018 | P3 | `onSelect` navigates to `'/$patientId'` (workspace) not `'/patients/$patientId'` (profile) |
| EM-PAT-019 | P3 | `importPatients` returns 201 (not 202 async) — deviates from contract |
| EM-PAT-020 | P3 | `logAuditEvent` in `getDentalPatient` uses `preferredBranchId ?? patientId` as tenantId |
| EM-PAT-021 | P3 | `useExportPatients` client-side CSV omits `branchId` query param |

---

### 4.8 dental-perio — V1 Readiness: 6/10 🟡

**Summary:** Core perio chart CRUD and validation are correctly implemented. Two blockers are narrow: both emit the wrong HTTP status code (422 instead of 409) which breaks API consumers but is a one-line fix each. The visit-lock cascade is unimplemented, leaving the `locked` state unreachable.

| ID | Sev | Finding |
|---|---|---|
| EM-PERIO-001 | P0 | `createPerioChart` throws 422 on duplicate chart — spec mandates 409 CHART_EXISTS (BR-P01) |
| EM-PERIO-002 | P0 | `upsertToothReading` checks chart status but not parent visit lock status — locked-visit charts remain writable |
| EM-PERIO-003 | P1 | `getPerioChart` admits `staff_scheduling` role — spec forbids it |
| EM-PERIO-004 | P1 | `hygienist` role granted clinical write access — not declared in MODULE_SPEC §6 |
| EM-PERIO-005 | P1 | `completePerioChart` already-complete error emits 422 instead of spec-required 409 |
| EM-PERIO-006 | P1 | `perio.chart.locked` event and visit-lock cascade not implemented — `locked` state unreachable in production |

---

### 4.9 dental-pmd — V1 Readiness: 3.5/10 🟡

**Summary:** PMD generation and import handlers exist but have 5 critical invariant violations. Most critical: a live FK to `patients` breaks the GDPR erasure guarantee, the SHA-256 checksum function is a charcode sum (not SHA-256), and `getImportedPMD` fetches before authorizing (IDOR).

| ID | Sev | Finding |
|---|---|---|
| EM-PMD-001 | P0 | `imported_pmd` has live DB FK to `patients` — violates §7.2 import contract invariant #1; GDPR erasure broken |
| EM-PMD-002 | P0 | `checksum` field is optional, not verified server-side — §7.2 invariant #4 violated; malformed imports accepted silently |
| EM-PMD-003 | P0 | `source_description` maps to `sourceFacility` — field effectively optional; §7.2 invariant #5 violated |
| EM-PMD-004 | P0 | `getImportedPMD` fetches record before branch authorization — IDOR window (existence leak to unauthorized callers) |
| EM-PMD-005 | P0 | `sha256Hex()` in `generatePMD` is a charcode sum, not SHA-256 — comment reads "in production use node:crypto" — THIS IS production code |
| EM-PMD-006 | P1 | `pmd_document` has live DB FKs to `dental_visit`, `patients`, `dental_memberships`, `dental_branch` — §20 coupling violation |
| EM-PMD-007 | P1 | No 405 route-level rejection for PATCH/PUT/DELETE on imported PMDs (BR-022 / §7.2 ¶3) |
| EM-PMD-008 | P1 | `listPMDs` pagination is post-hoc (fetch-all, then slice) — incorrect total count returned |
| EM-PMD-009 | P1 | `generatePMD` allows `staff_full` to generate PMDs — spec restricts to dentist roles |
| EM-PMD-010 | P1 | `membership` null not guarded before use — undefined dereference at runtime |
| EM-PMD-011 | P1 | `exportPMD` calls `JSON.parse(pmd.content)` without error guard — throws 500 on corrupt stored content |
| EM-PMD-012 | P3 | API contract uses `GET /dental/pmd/:patientId` (path param); impl uses `?patientId=` (query param) |
| EM-PMD-013 | P3 | `PMDDocument` frontend type missing `branchId` field |
| EM-PMD-014 | P3 | `pmd-import.tsx` requires JSON content; API contract accepts PDF/XML multipart |

---

### 4.10 dental-scheduling — V1 Readiness: 4.5/10 🔴

**Summary:** Appointment CRUD and check-in handlers exist. Three module-level blockers: cancel reason captured in wrong location (body vs query param), check-in response shape doesn't match contract, and `useQueueBoard` frontend hook makes unauthenticated fetch calls (will 401 in production).

| ID | Sev | Finding |
|---|---|---|
| EM-SCHED-001 | P0 | Cancel endpoint ignores `reason` query param — spec defines query param, impl reads body field; tests pass with wrong fixture |
| EM-SCHED-002 | P0 | `checkInAppointment` returns `{ appointment, visitId }` — contract mandates `{ data: { appointment_id, visit_id } }` |
| EM-SCHED-003 | P0 | `useQueueBoard` raw `fetch()` with no auth headers — queue board API calls return 401 in production |
| EM-SCHED-004 | P1 | `cancelAppointment` swallows JSON parse errors — non-JSON body silently gives 422 REASON_REQUIRED instead of 400 |
| EM-SCHED-005 | P1 | `listAppointments` returns raw array — not wrapped in `{ data, meta }` envelope per contract |
| EM-SCHED-006 | P1 | `buildAppointmentPayload` calls Zustand store outside React context — runtime error in non-React environments |

---

### 4.11 dental-visit — V1 Readiness: 5/10 🔴

**Summary:** Visit, treatment, chart, and notes handlers are functionally present and the state machine (VISIT_TRANSITIONS, TREATMENT_TRANSITIONS) is correctly implemented. Five blockers: IDOR on dismissed-treatment restore, two handlers missing BR-003 immutability guards, conditional branch auth in `updateDentalTreatment`, and an undeclared `VISIT_HAS_OPEN_TREATMENTS` block that prevents dentists from completing routine visits.

| ID | Sev | Finding |
|---|---|---|
| EM-VISIT-001 | P0 | `carryOverTreatments` restore path has no `patientId` filter — cross-patient treatment IDOR (dismissed treatments from any patient copyable) |
| EM-VISIT-002 | P0 | `upsertDentalChart` and `updateTooth` never check `visit.status` — charts of completed/locked visits freely writable (BR-003) |
| EM-VISIT-003 | P0 | `updateDentalTreatment` calls `assertBranchRole` inside `if (visit)` — orphaned treatment auth skipped entirely |
| EM-VISIT-004 | P0 | BR-007 immutability guards `verified` status only — `performed` treatment's CDT code, tooth, surfaces freely patchable |
| EM-VISIT-005 | P0 | `VISIT_HAS_OPEN_TREATMENTS` block absent from MODULE_SPEC, API_CONTRACTS, and WF-012 — prevents dentists from completing visits with pending diagnoses or carry-over treatments |
| EM-VISIT-006 | P1 | BR-001 (no concurrent active visit) relies solely on DB unique index — application-level 409 ACTIVE_VISIT_EXISTS never returned |
| EM-VISIT-007 | P1 | `upsertVisitNotes` does not block writes on `completed` visit (only `locked`) |
| EM-VISIT-008 | P1 | `carryOverTreatments` auto-discovers up to 5 previous visits — contradicts `source_visit_id` contract |
| EM-VISIT-009 | P1 | `initializeDentition` does not throw DENTITION_ALREADY_INITIALIZED (409) per API_CONTRACTS |
| EM-VISIT-010 | P1 | Inline price editor renders for `performed`/`verified` treatments — EC4 immutability not enforced in UI |
| EM-VISIT-011 | P1 | `window.confirm` used for irreversible visit-lock action — blocks automated testing, violates UI standard §8 |
| EM-VISIT-012 | P3 | `TRANSITION_LABELS` has dead entries in `TreatmentPlansSheet` |
| EM-VISIT-013 | P3 | `useSaveToothFlow` silently drops treatment-save failure |
| EM-VISIT-014 | P3 | `getTreatmentPlan` includes `declined` treatments in `totalEstimateCents` |

---

## 5. File Compliance (Phase 1 — EF-)

### 5.1 dental-audit

| ID | Sev | Location | Finding |
|---|---|---|---|
| EF-AUDIT-001 | P0 | `getAuditEvents.ts:21` | Admin role check instead of dentist_owner |
| EF-AUDIT-002 | P0 | `getAuditEvents.ts:30` | No `assertBranchAccess` — cross-branch data leak |
| EF-AUDIT-003 | P0 | Route registration | No 405 routes for PATCH/PUT/DELETE on audit events |
| EF-AUDIT-004 | P0 | `audit-logger.ts` | Writes are synchronous inline — not async via pg-boss as spec declares |
| EF-AUDIT-005 | P1 | `getAuditEvents.ts:34-37` | Query params `from`/`to`, `limit`/`offset` vs spec `date_from`/`date_to`, `page`/`per_page` |
| EF-AUDIT-006 | P1 | `getAuditEvents.ts:34` | Default limit 50, max 200 vs spec default 20, max 100 |
| EF-AUDIT-007 | P1 | Retention job | Does not cover `dental_audit_log` table |
| EF-AUDIT-008 | P3 | `audit_log_entry.details` | `reason` and `metadata` JSONB fields are open PHI vectors with no schema enforcement |
| EF-AUDIT-009 | P3 | Observability | `audit_events_written_total` metric absent |

---

### 5.2 dental-billing

| ID | Sev | Location | Finding |
|---|---|---|---|
| EF-BILL-001 | P0 | `createDentalInvoice.ts` | `taxRate` accepted from client — BR-010 violation |
| EF-BILL-002 | P0 | `issueDentalInvoice.ts` | `staff_full` excluded from allowed roles |
| EF-BILL-003 | P0 | `recordDentalPayment.ts` | Accepts payment on draft invoices |
| EF-BILL-004 | P0 | `voidDentalInvoice.ts` | Void reason captured but never stored |
| EF-BILL-005 | P0 | All billing handlers | DE-007/008/009 never emitted |
| EF-BILL-006 | P0 | `createDentalInvoice.ts` | Invoice number generation race condition |
| EF-BILL-007 | P0 | `createPaymentPlan.ts` | `patientId` caller-controlled (IDOR) |
| EF-BILL-008 | P0 | `listDentalInvoices.ts` | No `branchId` scope guard |
| EF-BILL-009 | P0 | `voidDentalInvoice.ts` | `overdue→voided` transition not handled |
| EF-BILL-010 | P0 | `payment-plan-view.tsx` | `formatPlanStatus` maps camelCase `onTrack` vs DB snake_case `on_track` — labels always blank |
| EF-BILL-011 | P0 | File inventory | `GET /dental/patients/:id/statement` endpoint missing from spec implementation |
| EF-BILL-012 | P1 | `listDentalInvoices.ts` | `date_from`/`date_to` filter params absent — only `date` param |
| EF-BILL-013 | P1 | `createDentalPaymentPlan.ts` | No installment-count upper bound — uncapped payment plan splits |
| EF-BILL-014 | P1 | `applyDentalDiscount.ts` | No `dentist_owner` role gate on discount endpoint |
| EF-BILL-015 | P1 | `billing-list.tsx` | "Collected This Month" uses `createdAt` not payment date |

---

### 5.3 dental-clinical

| ID | Sev | Location | Finding |
|---|---|---|---|
| EF-CLIN-001 | P0 | Route registry | `revokeConsentForm` handler and route entirely absent |
| EF-CLIN-002 | P0 | `createPrescription.ts` | No visit status check before write (BR-003) |
| EF-CLIN-003 | P0 | `signConsentForm.ts` | Stale boolean check `existing.signed` instead of status field |
| EF-CLIN-004 | P0 | `updateMedicalHistoryEntry.ts` | Full PATCH on append-only records (AC-CLI-005) |
| EF-CLIN-005 | P0 | `createPrescription.ts` | Allergy cross-check uses caller-supplied `patientId` (IDOR) |
| EF-CLIN-006 | P0 | All clinical handlers | DE-012..DE-016 never emitted |
| EF-CLIN-007 | P1 | `createLabOrder.ts` + `updateLabOrder.ts` | Lab order status names diverge from API contract |
| EF-CLIN-008 | P1 | `listPrescriptions.ts` | Unbounded fetch-all + in-memory pagination |
| EF-CLIN-009 | P1 | `attachments-sheet.tsx` | "All" tab leaks cross-visit attachments without scope guard |
| EF-CLIN-010 | P2 | Unspecced files | 13 handler files co-located with no spec coverage: inventory, occlusion screening, post-op templates |

---

### 5.4 dental-emr-integration — Score: 0/10

| ID | Sev | Finding |
|---|---|---|
| EF-EMR-001 | P0 | Handler directory does not exist |
| EF-EMR-002 | P0 | Schema / repo files do not exist |
| EF-EMR-003 | P0 | No public API endpoints implemented |
| EF-EMR-004 | P1 | Route registration absent |
| EF-EMR-005 | P1 | Auth / permission enforcement absent |
| EF-EMR-006 | P1 | Business rules (immutability) absent |

---

### 5.5 dental-imaging

| ID | Sev | Location | Finding |
|---|---|---|---|
| EF-IMG-001 | P0 | `createImagingStudy.ts` | Request body schema diverges from contract (field names, types) |
| EF-IMG-002 | P0 | File inventory | `GET /dental/imaging/studies` (list) handler entirely missing |
| EF-IMG-003 | P0 | File inventory | `POST /dental/imaging/studies/:id/images` (image upload) missing |
| EF-IMG-004 | P0 | File inventory | All annotation endpoints absent (POST annotations, PATCH annotation) |
| EF-IMG-005 | P0 | Finding endpoint | URL mismatch: impl uses `images/:imageId/findings`; contract uses `studies/:id/findings` |
| EF-IMG-006 | P0 | File inventory | `POST /dental/imaging/ceph-analyses` creation endpoint missing |
| EF-IMG-007 | P0 | Ceph handler | Landmark/recompute URLs diverge from contract |
| EF-IMG-008 | P0 | `ceph_analysis.schema.ts` | Anchors on `image_id` not `analysis_id` — structural FK mismatch |
| EF-IMG-009 | P0 | `imaging_annotation` | SM-01 state machine absent — no `status` column on `imaging_annotation` table |
| EF-IMG-010 | P0 | SM-02 | Missing `not_placed` initial state for landmark state machine |
| EF-IMG-011 | P0 | `imaging_finding.schema.ts` | 3 DB-level FKs to external modules (dental_visit, patients, dental_branch) |
| EF-IMG-012 | P0 | `createImagingStudy.ts` | `UNSUPPORTED_MIME_TYPE` returns 400; spec defines 422 |
| EF-IMG-013 | P0 | Test file | `imaging_finding.fsm.property.test.ts` is empty / unreadable — zero coverage |
| EF-IMG-014 | P0 | All imaging handlers | DE-018/019/020 never emitted |
| EF-IMG-015 | P1 | `use-imaging-br.test.ts` | Test file has no corresponding implementation file |
| EF-IMG-016 | P1 | `ImagingCephRepository.upsertAnalysis` | Does not update calibration fields on conflict |
| EF-IMG-017 | P1 | `ceph-report.ts` | URL uses `/ceph/report` (singular); handler may use `/reports` (plural) |
| EF-IMG-018 | P1 | `createImagingStudy.ts` | MIME type check uses `as any` cast |
| EF-IMG-019 | P1 | `listFindings.ts` | Pagination always returns page size = total (bug in `buildPaginationMeta` call) |
| EF-IMG-020 | P1 | `deleteFinding.ts` | Allows deletion of confirmed findings — no immutability enforcement |
| EF-IMG-021 | P1 | `use-imaging-findings.ts` | Errors logged to `console.error` only — no user feedback |
| EF-IMG-022 | P1 | Feature flags | `dental_imaging_ceph_enabled` and `dental_imaging_auto_landmark` never checked at runtime |
| EF-IMG-023 | P1 | `CephMgmt_updateCephLandmark` | `locked` state on confirmed landmark unreachable via normal PATCH |

---

### 5.6 dental-org

| ID | Sev | Location | Finding |
|---|---|---|---|
| EF-ORG-001 | P0 | `deactivateMember.ts:27` | No `dentist_owner` role check — any active member can deactivate peers |
| EF-ORG-002 | P0 | `DentalBranchManagement_get.ts:25` | Skips `assertBranchAccess` — any user can read any branch (IDOR) |
| EF-ORG-003 | P0 | `verifyPin.ts` vs `DentalMembershipManagement_verifyPin.ts` | Duplicate handlers — one skips `trackLastLogin`; deployed version TBD; FR6.4 silently fails |
| EF-ORG-004 | P1 | `dental_membership` schema | `member_status` enum missing `invited` state |
| EF-ORG-005 | P1 | `dental_organization.schema.ts` | `imaging_tier` on org table; spec says branch-level |
| EF-ORG-006 | P1 | `DentalOrganizationManagement_create.ts` | Allows any authenticated user to create an org — no admin/superuser gate |
| EF-ORG-007 | P1 | `setPin.ts` | Any branch member can change another member's PIN |
| EF-ORG-008 | P1 | `onboarding-wizard.tsx` | Creates member with no `branchId` validation |
| EF-ORG-009 | P3 | `pinRecovery.ts:98` | PIN lockout counter shared with security-question attempts — undocumented interaction |
| EF-ORG-010 | P3 | `listMembers` (flat) | Strips `pinHash` only; `securityAnswerHash`/`securityQuestion` remain in response |
| EF-ORG-011 | P3 | `pin-select.tsx` | `PinSelectMember` type accepts only 4 roles; schema has 9 |
| EF-ORG-012 | P3 | `getDashboardSummary` | `branchId` guard is redundant dead code |

---

### 5.7 dental-patient

| ID | Sev | Location | Finding |
|---|---|---|---|
| EF-PAT-001 | P0 | `addFollowUpNote.ts` | Duplicate export with two separate non-atomic `db.update()` calls — clinical data race |
| EF-PAT-002 | P0 | `addFollowUpNote.ts` | `needsFollowUp = true` set in two sequential non-atomic writes |
| EF-PAT-003 | P1 | Audit log | `tenantId` fallback to `patientId` — incorrect audit correlation |
| EF-PAT-004 | P1 | Export handler | Status filter applied in-memory after fetching 10k rows |
| EF-PAT-005 | P1 | `patients.tsx` | `as any` navigation type cast |
| EF-PAT-006 | P1 | `patients.tsx:onSelect` | Navigates to workspace route instead of patient profile route |
| EF-PAT-007 | P1 | CSV import parser | Does not handle quoted fields — malformed import on any name containing a comma |
| EF-PAT-008 | P1 | `createDentalPatient.ts` | `branchId` optional creates unscoped patients that bypass all auth |
| EF-PAT-009 | P2 | `PatientRegistrationModal` | `displayName` + single `consentGiven` vs spec's `first_name`/`last_name` + 4 consent fields |
| EF-PAT-010 | P2 | Missing handlers | `GET /dental/patients/:id/alerts`, `GET /dental/patients/:id/contacts`, `GET /dental/patients/:id/recalls` not implemented |
| EF-PAT-011 | P3 | `DentalPatientSafetyFloor` | Does not include `medications` or `conditions` in response |

---

### 5.8 dental-perio

| ID | Sev | Location | Finding |
|---|---|---|---|
| EF-PERIO-001 | P0 | `PerioChartRepository.upsertToothReading` | Partial upsert `onConflictDoUpdate` nullifies omitted columns — destructive partial write |
| EF-PERIO-002 | P0 | `PerioChartRepository.getChartSummary` | `summaryDeepPocketCount` counts sites not teeth (spec counts distinct teeth) |
| EF-PERIO-003 | P0 | `perio-validation.ts` | Deep pocket threshold is 5mm; spec (BR-P03) says 6mm |
| EF-PERIO-004 | P0 | All perio handlers | Error codes diverge from API_CONTRACTS (`PERIO_CHART_DUPLICATE`, `PERIO_VISIT_LOCKED` vs contract's `CHART_EXISTS`, `VISIT_LOCKED`) |
| EF-PERIO-005 | P0 | `completePerioChart.ts` | `examinerMemberId` resolved without branch filter — cross-branch member possible |
| EF-PERIO-006 | P1 | `upsertToothReading.ts` | Visit-lock check absent (perio readings writable on locked visits) |
| EF-PERIO-007 | P1 | `completePerioChart.ts` | Wrong HTTP code on already-complete (422 vs 409) |
| EF-PERIO-008 | P1 | `dental_perio_tooth_reading` | Missing `gingival_recession` and `furcation` columns declared in §7 |

---

### 5.9 dental-pmd

| ID | Sev | Location | Finding |
|---|---|---|---|
| EF-PMD-001 | P0 | `imported_pmd.schema.ts` | 5 §7.2 import contract invariants violated (all 5 unclean) |
| EF-PMD-002 | P0 | `importPMD.ts` | Multipart file upload entirely absent — only JSON textarea; PDF/XML uploads impossible |
| EF-PMD-003 | P0 | File inventory | `GET /dental/pmd/:id/download` endpoint missing — no presigned URL, no `expires_at` |
| EF-PMD-004 | P0 | Route mounting | `generatePMD` mounted at `/dental/visits/:visitId/pmd` not spec's `/dental/pmd/generate` |
| EF-PMD-005 | P0 | Route mounting | `listPMDs` uses query param `?patientId=` not spec's path param `:patientId` |
| EF-PMD-006 | P1 | Schema | `pmd_document` has 4 live FKs to external modules (§20 violation) |
| EF-PMD-007 | P1 | All PMD handlers | No 405 routes for PATCH/PUT/DELETE on imported PMDs |
| EF-PMD-008 | P1 | `listPMDs.ts` | Post-hoc pagination — incorrect total count |
| EF-PMD-009 | P2 | Frontend type | `PMDDocument` missing `branchId` |
| EF-PMD-010 | P2 | `pmd-import.tsx` | Forces JSON content type; prevents PDF/XML imports |

---

### 5.10 dental-scheduling

| ID | Sev | Location | Finding |
|---|---|---|---|
| EF-SCHED-001 | P0 | `createAppointment.ts` | API field names diverge from contract: `dentistMemberId`/`scheduledAt`/`durationMinutes`/`serviceType` vs contract's `provider_id`/`start_at`/`end_at`/`visit_type` |
| EF-SCHED-002 | P0 | `cancelAppointment.ts` | Cancel reason in body vs contract's query param |
| EF-SCHED-003 | P0 | `updateAppointment.ts` | Reschedule conflict error code `CONFLICT` not `DOUBLE_BOOKING` per contract |
| EF-SCHED-004 | P0 | `checkInAppointment.ts` | Check-in active visit returns `CONFLICT` not `CHECKIN_ACTIVE_VISIT` |
| EF-SCHED-005 | P0 | All scheduling handlers | Role-based permissions not enforced — only `assertBranchAccess` (no role distinction) |
| EF-SCHED-006 | P0 | `listAppointments.ts` | `date_from`/`date_to` range filter absent — only single `date` param; week/month calendar views always return one day |
| EF-SCHED-007 | P1 | `AppointmentModal` | `DOUBLE_BOOKING` warning from API response discarded silently |
| EF-SCHED-008 | P1 | `AppointmentModal` | Edit mode never populates existing appointment data — edits create new appointments (duplicates) |
| EF-SCHED-009 | P1 | File inventory | `check-in-flow.tsx` referenced in tests but file does not exist |
| EF-SCHED-010 | P1 | `cancelAppointment.ts` | DE-011 AppointmentCancelled event not emitted |
| EF-SCHED-011 | P1 | All handlers | All 4 observability hooks missing (`appointments_created_total`, etc.) |
| EF-SCHED-012 | P1 | `dental_appointment` schema | `checked_in_at` field named `checkInTime` — spec divergence |
| EF-SCHED-013 | P3 | `listQueueBoard.ts` | Queue board FSM states deviate from spec annotation |
| EF-SCHED-014 | P3 | Queue handlers | `ctx: any` type cast in queue board handlers |

---

### 5.11 dental-visit

| ID | Sev | Location | Finding |
|---|---|---|---|
| EF-VISIT-001 | P0 | `createDentalVisit.ts` | BR-001: no concurrent active/draft visit check; 409 ACTIVE_VISIT_EXISTS never returned by this handler |
| EF-VISIT-002 | P0 | `upsertDentalChart.ts` | BR-003: no visit status check; completed/locked chart can be overwritten |
| EF-VISIT-003 | P0 | `upsertVisitNotes.ts:35` | BR-003 incomplete: only `locked` blocked; `completed` visits' notes freely editable |
| EF-VISIT-004 | P0 | `updateDentalTreatment.ts:39` | Branch authorization skipped when visit is null (orphaned treatment) |
| EF-VISIT-005 | P0 | `initializeDentition.ts` | DENTITION_ALREADY_INITIALIZED 409 never returned; idempotency spec not met |
| EF-VISIT-006 | P1 | `updateDentalVisit.ts` | VISIT_HAS_OPEN_TREATMENTS block undeclared in spec, API_CONTRACTS, WF-012 |
| EF-VISIT-007 | P1 | `upsertVisitNotes.ts` | Note type field mismatch: impl uses SOAP fields; contract uses `note_type` enum + `content` |
| EF-VISIT-008 | P1 | `dental-chart.tsx` | Inline price editor visible for performed/verified treatments (EC4 immutability not enforced in UI) |
| EF-VISIT-009 | P1 | `treatment-plans-sheet.tsx` | Status labels use wrong locale format (USD vs PHP currency; `₱` hardcoded in component) |
| EF-VISIT-010 | P1 | `timeline-carousel.tsx` | `activeIndex` not synced when visits array grows |
| EF-VISIT-011 | P3 | `treatment-table.tsx` | `markDoneErrorId` tracks clicked row before mutation outcome — wrong row shows error on rapid clicks |
| EF-VISIT-012 | P3 | `TreatmentTable` | `'declined'` status in component type but `useMarkTreatmentDone` type lacks it |
| EF-VISIT-013 | P3 | `getTreatmentPlan.ts` | `declined` treatments included in `totalEstimateCents` |
| EF-VISIT-014 | P3 | Tests | Six key carousel tests permanently skipped via `skipMockDependent` alias |
| EF-VISIT-015 | P3 | `handleNewVisit` | Mixes reactive selectors and imperative `getState()` for same store |

---

## 6. Cross-Module Findings (Phase 2 — EX-)

| ID | Sev | Description |
|---|---|---|
| EX-001 | P1 | `dental-org` circularly depends on downstream modules (billing/clinical/visit) for dashboard summary — violates dependency direction |
| EX-002 | P0 | `dental-imaging` imports `dental-clinical` schema directly + has DB FK to dental_visit — architectural boundary violation (§20) |
| EX-003 | P1 | `dental-pmd` bypasses facade pattern with direct repo instantiation for cross-module data access |
| EX-004 | P0 | `dental-patient` imports from 3 downstream modules across 7 files — inverted dependency direction |
| EX-005 | P1 | `dental-scheduling` has undocumented DB FK to `dental_visit.id` — coupling without spec declaration |
| EX-006 | P0 | **All 23 domain events (DE-001..DE-023) declared in EVENT_CONTRACTS.md are never emitted anywhere in the codebase.** The entire event pipeline is aspirational. All downstream consumers (dental-audit, notifs, dental-clinical) starved of events. |

> **EX-006 is the most systemic finding in this audit.** Every module that emits events (billing, clinical, imaging, org, patient, scheduling, visit, pmd) has zero calls to any event bus. The audit trail, notification system, and cross-module workflows that depend on domain events are silently non-functional.

---

## 7. UI Journey Findings (Phase 1.5 — UJ-)

### 7.1 dental-billing

| ID | Sev | Finding |
|---|---|---|
| UJ-BILL-001 | P0 | `staff_full` has `billing: false` in `rbac.ts:38` — primary payment-recording role locked out of billing page |
| UJ-BILL-002 | P0 | Void fires immediately on button click — no confirmation dialog, no reason field (WF-041 step 2 violated) |
| UJ-BILL-003 | P0 | `pendingCount` counts `diagnosed|planned` (non-billable) treatments — BR-009 will 422 server-side with no pre-flight warning |
| UJ-BILL-004 | P1 | WF-015 (create payment plan) has zero UI — `PaymentPlanView` is read-only; entire P1 workflow unreachable |
| UJ-BILL-005 | P1 | No receipt preview or generation (§8.4 V1 Required) |
| UJ-BILL-006 | P1 | No discount/write-off UI — `discountCents` display-only; BILL-BR-004 unenforced in UI |
| UJ-BILL-007 | P1 | Void button shown to non-owner roles — `canVoid()` checks only status, not role |

### 7.2 dental-clinical

| ID | Sev | Finding |
|---|---|---|
| UJ-CLIN-001 | P0 | Lab order FSM wrong: 5 UI states vs 3 backend states — every status transition button 422s in production |
| UJ-CLIN-002 | P0 | `MedicalHistoryForm` calls PATCH on append-only records — appends appear to succeed but overwrite prior data |
| UJ-CLIN-003 | P0 | "View Medical History" button opens PMD Import sheet — wrong handler wired |
| UJ-CLIN-004 | P0 | Consent revoke flow entirely absent from UI (WF-035 blocked at route AND component level) |
| UJ-CLIN-005 | P1 | Amendment form has no error display — `console.error` only |
| UJ-CLIN-006 | P1 | Prescription sheet "Save" disabled for hygienist role even on unsigned consent — UX inconsistency |

### 7.3 dental-imaging

| ID | Sev | Finding |
|---|---|---|
| UJ-IMG-001 | P0 | Imaging tier gate absent from UI — users at `free` tier reach imaging upload silently; server rejects with generic `FORBIDDEN` |
| UJ-IMG-002 | P0 | XSS via unsanitized SVG label text — annotation `text` sliced at write but not at read; rendered to DOM |
| UJ-IMG-003 | P0 | Calibration PATCH uses bare `fetch()` without `credentials: 'include'` — will 401 in all authenticated sessions |
| UJ-IMG-004 | P0 | Split-brain from duplicate `useImagingStudy` hook instances — edits in one panel overwrite the other silently |
| UJ-IMG-005 | P0 | `handleLockAll` concurrent mutations break optimistic rollback — UI state diverges from server on partial failure |
| UJ-IMG-006 | P0 | IndexedDB connection leak — `useImagingCache` opens new IDB connection per render without closing prior |
| UJ-IMG-007 | P0 | API error text rendered to DOM via `innerHTML` — XSS vector from server-controlled error messages |

### 7.4 dental-org

| ID | Sev | Finding |
|---|---|---|
| UJ-ORG-001 | P0 | `recoverPin` UI allows cross-tenant PIN reset — form submits without tenant validation |
| UJ-ORG-002 | P0 | Deployed `verifyPin` facade skips `trackLastLogin` — FR6.4 activity visibility silently fails |
| UJ-ORG-003 | P0 | PIN session timer starts at login not last activity — dentists logged out 5 minutes into active use |
| UJ-ORG-004 | P0 | `localStorage` PIN session keys never written — PIN selection shows empty member list on every page load |
| UJ-ORG-005 | P1 | Security question answers stored in localStorage — XSS-accessible credential exposure |
| UJ-ORG-006 | P1 | PIN reset flow has no rate limiting in UI — brute-force via UI possible |

### 7.5 dental-patient

| ID | Sev | Finding |
|---|---|---|
| UJ-PAT-001 | P0 | Medical alerts absent from `PatientProfilePage` — safety-critical display requirement (IDEAL §3 safety floor) |
| UJ-PAT-002 | P0 | Guardian/contact entirely absent from patient profile UI (PAT-BR-002 V1 Required) |
| UJ-PAT-003 | P0 | Client-side search `patients.tsx` double-filters — applies filter to already-filtered server response; pagination breaks |
| UJ-PAT-004 | P1 | No empty state for patient profile tabs (alerts, contacts, recall) — UI shows nothing on first load |
| UJ-PAT-005 | P1 | Archive confirmation dialog absent — irreversible action with no friction |

### 7.6 dental-pmd

| ID | Sev | Finding |
|---|---|---|
| UJ-PMD-001 | P0 | Checksum never sent in import payload — every import rejected with 422 on strict validation path |
| UJ-PMD-002 | P0 | No file upload input — import UI only shows JSON textarea; PDF/XML imports impossible from UI |
| UJ-PMD-003 | P0 | No PMD list route — existing imported PMDs cannot be browsed |
| UJ-PMD-004 | P0 | No download button — exported PMD URL never reachable from UI |
| UJ-PMD-005 | P0 | PMD viewer unreachable in workspace — "View PMD" button not wired in `WorkspaceTopBar` |

### 7.7 dental-scheduling

| ID | Sev | Finding |
|---|---|---|
| UJ-SCHED-001 | P0 | Silent error suppression on check-in — `checkIn()` swallows errors with `console.error` only |
| UJ-SCHED-002 | P0 | Walk-in flag `_walkIn` has underscore prefix (naming convention for "unused") — walk-in mode silently disabled |
| UJ-SCHED-003 | P0 | Edit appointment modal calls `createAppointment` not `updateAppointment` — edits create duplicates |
| UJ-SCHED-004 | P0 | Double-booking warning from API (`DOUBLE_BOOKING`) discarded at UI level — users not warned |
| UJ-SCHED-005 | P0 | Cancel appointment UI entirely absent from calendar view — no cancel path exists for front desk |
| UJ-SCHED-006 | P0 | Check-in disconnected from queue board — checked-in patients do not appear in queue (APT-BR-005 broken) |

### 7.8 dental-visit

| ID | Sev | Finding |
|---|---|---|
| UJ-VISIT-001 | P0 | `handleNewVisit` fails silently when org context is missing — dentist sees nothing, assumes visit created |
| UJ-VISIT-002 | P0 | Pre-completion checklist disables "Complete Visit" on ANY warning with no override — BR-014 and WF-012 violated; emergency cases uncompletable |
| UJ-VISIT-003 | P0 | Dental chart has no baseline/proposed/completed layer switching — `entryClassification` dead code; dentist cannot distinguish existing from proposed work (CHART-BR-001/002/006) |
| UJ-VISIT-004 | P0 | `useSaveToothFlow` calls `onSuccess` (closes slideout) before treatment mutation fires — silent data divergence if treatment save fails |
| UJ-VISIT-005 | P0 | "Accept Plan" sends POST with no patient approval record, date, or consent reference — TP-BR-007 not met |
| UJ-VISIT-006 | P1 | `TreatmentTable` receives no `visitId` from parent — all inline mutations fire to invalid URL `/dental/visits//treatments/:id` |
| UJ-VISIT-007 | P1 | Carousel `activeIndex` not synced after new visit created — yellow border stays on old slide |
| UJ-VISIT-008 | P1 | `TreatmentPlansSheet` transitions plan at plan level only — no item-level completion (TP-BR-005) |

---

## 8. Traceability Findings (Phase 2.5 — TR-)

> Full report: `docs/audits/enforce/trace.md`

### 8.1 Algorithm 5a — Orphan Business Rules (9 confirmed)

| ID | Sev | BR | Description |
|---|---|---|---|
| TR-5A-001 | P1 | PAT-BR-002 | Minor patient guardian linkage — enforcement gap |
| TR-5A-002 | P1 | ENC-BR-002 | Chief complaint not required server-side — validation field exists, no 422 guard |
| TR-5A-003 | P0 | CHART-BR-001/002/006 | No baseline/proposed/completed layer separation in data model — single JSONB chart blob |
| TR-5A-004 | P1 | TP-BR-003/007 | Treatment plan status transitions + patient approval record — unimplemented |
| TR-5A-005 | P1 | BILL-BR-004 | Discounts require permission + reason — unenforced in UI and partially in API |
| TR-5A-006 | P1 | CLAIM-BR-002/003 | CDT + ICD-10 code support — unimplemented (dental-patient has unspecced handlers) |
| TR-5A-007 | P1 | ATT-BR-003/004 | Attachment metadata + visit/procedure linkage — partially present |
| TR-5A-008 | P1 | LF-BR-001/002 | Local IDs stable; local→server mapping — SyncLog exists but entity endpoints accept no `localId` |
| TR-5A-009 | P1 | AUD-BR-004 | Audit log must include before/after or reason — `metadata` field present but silently dropped |

### 8.2 Algorithm 5b — Broken Chains (4 confirmed)

| ID | Sev | Description |
|---|---|---|
| TR-5B-001 | P1 | G-003: `dental-clinical` directly imports `VisitRepository` — cross-module repo import (Wave G1 planned) |
| TR-5B-002 | P1 | DE-019 consumer absent from `dental-clinical` — confirmed imaging findings never reach clinical safety floor |
| TR-5B-003 | P0 | No pg-boss consumer file found for `dental-audit` — audit events enqueued but never consumed; audit log silently empty |
| TR-5B-004 | P1 | `dental-perio` uses hard CASCADE FK to `dental_visit` — all other modules use UUID-only refs (coupling violation) |

### 8.3 Algorithm 5c — Unspecced Implementations (6 confirmed)

| ID | Sev | Module | Description |
|---|---|---|---|
| TR-5C-001 | P1 | dental-scheduling | `createQueueItem`/`listQueueBoard`/`updateQueueItemStatus` — MODULE_SPEC explicitly states no standalone queue table |
| TR-5C-002 | P1 | dental-clinical | Inventory management handlers (`createInventoryItem`, etc.) — no spec coverage, wrong module |
| TR-5C-003 | P1 | dental-clinical | Occlusion screening handlers — no spec coverage |
| TR-5C-004 | P1 | dental-clinical | Post-op template handlers — no spec coverage |
| TR-5C-005 | P1 | dental-patient | Claims/insurance handlers (`createClaimDraft`, `createInsuranceProfile`, etc.) — no MODULE_SPEC owner |
| TR-5C-006 | P1 | emr/ | `createConsultation`, `finalizeConsultation`, `listEMRPatients` — MODULE_SPEC says future phase only; active route collision |

### 8.4 Algorithm 5d — Cross-Module Blind Spots (5 confirmed)
*Note: XMD-003 and XMD-005 partially overlap with EX-006. Kept here for 5d completeness; EX-006 is authoritative for dedup.*

| ID | Sev | Description |
|---|---|---|
| TR-5D-001 | P1 | `dentist_associate` "own patients only" billing unenforced at DB level |
| TR-5D-002 | P1 | PMD snapshot excludes lab orders and imaging studies — incomplete clinical snapshot |
| TR-5D-003 | P1 | Visit carry-over creates new treatment rows without billing notification — DE-004 ambiguity |
| TR-5D-004 | P1 | G-005 PHI in audit logs — no cross-module remediation plan defines fix scope |
| TR-5D-005 | P1 | `notifs` module subscriptions to billing events (DE-007/008) have no confirmed implementation — possibly dead consumers |

### 8.5 Algorithm 5e — Workflow Coverage Gaps (14 confirmed, 3 HIGH)

| ID | Priority | Workflow | Description |
|---|---|---|---|
| TR-5E-001 | HIGH | WFG-002 | Check-in partial failure — no recovery path (appointment checked in, visit fails to create) |
| TR-5E-002 | HIGH | WFG-004 | Concurrent invoice creation — no idempotency guard for same visit |
| TR-5E-003 | HIGH/Legal | WFG-006 | GDPR patient erasure — not implemented |
| TR-5E-004 | MEDIUM | WFG-001 | BR-005 discard on empty-draft visit — IMPLEMENTED (contrary to WORKFLOW_MAP claim; false positive) |
| TR-5E-005 | MEDIUM | WFG-007 | 24h appointment reminder cron — pg-boss job registered; consumer absent |
| TR-5E-006 | MEDIUM | WFG-008 | Recall auto-scheduling — `createRecall` exists; no E2E spec or test |
| TR-5E-007 | MEDIUM | 4.2 | Recall scheduling step in returning-patient workflow — no dedicated E2E spec |
| TR-5E-008 | MEDIUM | 4.6 | Offline-ready clinical workflow — Cadence CRDT not activated end-to-end |
| TR-5E-009 | LOW | WFG-009 | Lab order completion notification — DE-015 consumer absent in `notifs` |

### 8.6 Algorithm 5f — Role Coverage Gaps (3 confirmed)

| ID | Sev | Description |
|---|---|---|
| TR-5F-001 | P1 | `staff_scheduling` check-in gate — `checkInAppointment` spec restricts to `dentist_*`; enforcement unverified |
| TR-5F-002 | P1 | Platform admin impersonation has no break-glass audit trail |
| TR-5F-003 | P1 | `dentist_associate` "own patients only" billing — no enforcement in any layer |

### 8.7 E2E Journey Coverage (§9.2)

| Journey | Status | Notes |
|---|---|---|
| E2E-001 | COVERED | `returning-patient-visit.spec.ts` |
| E2E-002 | COVERED | `journeys/02-baseline-chart.spec.ts` |
| E2E-003 | COVERED | `journeys/06-phased-plan.spec.ts` |
| E2E-004 | COVERED | `billing.spec.ts` |
| E2E-005 | PARTIAL | Walk-in flag `_walkIn` unused (UJ-SCHED-002); double-booking warning discarded (UJ-SCHED-004) |
| E2E-006 | PARTIAL | Annotation endpoints missing (EF-IMG-004); upload endpoint missing (EF-IMG-003) |
| E2E-007 | COVERED | `ipad-workspace.spec.ts` |
| E2E-008 | PARTIAL | Audit recursion (EM-AUDIT-004) means clinical note audit creates unbounded entries |
| E2E-009 | PARTIAL | `journeys/15-offline-sync-metadata.spec.ts` covers metadata only; Cadence CRDT stub |
| E2E-010 | MISSING | No matching spec file per trace (TR-5E report); no dashboard unpaid-balance test |

**Coverage: 7/10 fully or partially covered; 3 have structural gaps.**

---

## 9. Ratchet Summary

### Run-1 (2026-05-27, baseline-001) — First Baseline
All **486 findings** classified NEW. No prior baseline.

### Run-2 (2026-05-27, dental-org PIN batch)
+2 new P0s: EM-ORG-019, EM-ORG-020. Total: **488**.

### Run-3 (2026-05-27, baseline-003-p0-sprint-resolved) — P0 Sprint Reclassification

**19 P0 findings reclassified RESOLVED** (commits verified, no sub-skill re-dispatch needed):

| ID | Module | Commit | Reason |
|---|---|---|---|
| EM-ORG-001 | dental-org | 61ed52c | authMiddleware on recoverPin |
| EM-ORG-002 | dental-org | d1acbb5 | assertBranchRole on setPin |
| EM-ORG-003 | dental-org | bdce591 | securityAnswerHash stripped from listMembers |
| EM-ORG-004 | dental-org | d1acbb5 | org ownership check in update |
| EM-ORG-019 | dental-org | 61ed52c | authMiddleware on set-pin route |
| EM-ORG-020 | dental-org | 61ed52c | authMiddleware on verify-pin + trackLastLogin |
| EM-AUDIT-001 | dental-audit | 481af31 | role check admin→dentist_owner |
| EM-AUDIT-002 | dental-audit | 481af31 | assertBranchAccess in getAuditEvents |
| EM-AUDIT-003 | dental-audit | 144f74e | displayName removed from PIN audit log |
| EM-AUDIT-004 | dental-audit | 9bc870d | self-audit removed from listAuditLogs |
| UJ-IMG-002 | dental-imaging | — | already-fixed: JSX escapes annotation text |
| UJ-IMG-007 | dental-imaging | — | already-fixed: no innerHTML in imaging UI |
| UJ-ORG-003 | dental-org | ab78a03 | PIN session timer resets on activity |
| UJ-ORG-004 | dental-org | 48f1d4a | PIN keys written to localStorage on selection |
| EM-BILL-001 | dental-billing | 1fabc23 | taxRate stripped from createDentalInvoice |
| EM-BILL-006 | dental-billing | e429dcb | UUID-based invoice numbering |
| EM-PMD-005 | dental-pmd | 096e455 | real node:crypto SHA-256 |
| TR-5B-003 | dental-audit | 40d433c | pg-boss consumer for domain events |
| TR-5A-003 | dental-visit | b045539 | chart_layer enum in dental_chart schema |

### Run-4 (2026-05-27, baseline-004-section-10-2-auth-resolved) — §10.2 Auth/IDOR Reclassification

**8 §10.2 P0 auth/IDOR findings reclassified RESOLVED** (commit 80f11f7, enforce-fix-004):

| ID | Module | Fix |
|---|---|---|
| EF-ORG-001 | dental-org | assertBranchAccess → assertBranchRole on deactivateMember |
| EF-ORG-002 | dental-org | assertBranchAccess added to DentalBranchManagement_get |
| EM-PAT-005 | dental-patient | branchId made required in createDentalPatient |
| EM-PAT-007 | dental-patient | ForbiddenError when patient has no branch in getDentalPatient |
| EM-VISIT-001 | dental-visit | patientId filter added to carryOverTreatments dismissed restore |
| EM-VISIT-003 | dental-visit | NotFoundError on null visit; assertBranchRole always runs in updateDentalTreatment |
| EM-PMD-004 | dental-pmd | Auth-before-data in getImportedPMD (lightweight probe before full content) |
| UJ-SCHED-003 | dental-scheduling | appointment-modal edit mode calls updateAppointment (PATCH) not createAppointment |

**Still BLOCKED:**
- **0 REGRESSIONS**
- **461 NEW** (open findings)
- **27 RESOLVED** (19 P0 sprint + 8 §10.2 auth)
- **EX-006 BLOCKED** — event bus, own phase (see §10.1)

---

## 10. Stabilization Plan

### 10.1 Fix Now — P0 Blockers Blocking All Production Use

**19/20 fixed** (P0 sprint complete 2026-05-27). One item remains BLOCKED as its own phase:

| ID | Status | Fix |
|---|---|---|
| EX-006 | 🚫 BLOCKED | Implement event bus and emit all 23 domain events (own phase — plan with `/office-hours`) |
| EM-ORG-001 | ✅ RESOLVED | `authMiddleware` on `recoverPin` (61ed52c) |
| EM-ORG-002 | ✅ RESOLVED | `assertBranchRole` on `setPin` (d1acbb5) |
| EM-ORG-003 | ✅ RESOLVED | `securityAnswerHash` stripped from `listMembers` (bdce591) |
| EM-ORG-004 | ✅ RESOLVED | Org ownership check in `DentalOrganizationManagement_update` (d1acbb5) |
| EM-ORG-019 | ✅ RESOLVED | `authMiddleware` on `set-pin` route (61ed52c) |
| EM-ORG-020 | ✅ RESOLVED | `authMiddleware` on `verify-pin` + `trackLastLogin` (61ed52c) |
| EM-AUDIT-001 | ✅ RESOLVED | Role check `admin`→`dentist_owner` in `getAuditEvents.ts` (481af31) |
| EM-AUDIT-002 | ✅ RESOLVED | `assertBranchAccess` in `getAuditEvents.ts` (481af31) |
| EM-AUDIT-003 | ✅ RESOLVED | `displayName` removed from PIN audit log details (144f74e) |
| EM-AUDIT-004 | ✅ RESOLVED | `repo.logEvent()` removed from `listAuditLogs` (9bc870d) |
| UJ-IMG-002 | ✅ RESOLVED | XSS: JSX already escapes annotation text (already-fixed) |
| UJ-IMG-007 | ✅ RESOLVED | No `innerHTML` in imaging UI (already-fixed) |
| UJ-ORG-003 | ✅ RESOLVED | PIN session timer resets on activity (ab78a03) |
| UJ-ORG-004 | ✅ RESOLVED | PIN keys written to `localStorage` on selection (48f1d4a) |
| EM-BILL-001 | ✅ RESOLVED | `taxRate` stripped from `createDentalInvoice` (1fabc23) |
| EM-BILL-006 | ✅ RESOLVED | UUID-based invoice numbering, no MAX race (e429dcb) |
| EM-PMD-005 | ✅ RESOLVED | Real `node:crypto` SHA-256 (096e455) |
| TR-5B-003 | ✅ RESOLVED | pg-boss consumer for dental-audit domain events (40d433c) |
| TR-5A-003 | ✅ RESOLVED | `chart_layer` enum in `dental_chart` schema (b045539) |

### 10.2 Before New Work — P0 Auth/Security Fixes ✅ ALL FIXED (run-4, commit 80f11f7)

| ID | Status | Fix |
|---|---|---|
| EM-PAT-007 | ✅ RESOLVED | Remove `if (patient.preferredBranchId)` guard — always assert branch access |
| EM-PAT-005 | ✅ RESOLVED | Make `branchId` required in `createDentalPatient` |
| EM-VISIT-001 | ✅ RESOLVED | Add `patientId` filter to `carryOverTreatments` dismissed-treatment query |
| EM-VISIT-003 | ✅ RESOLVED | Move `assertBranchRole` outside `if (visit)` guard in `updateDentalTreatment` |
| EM-PMD-004 | ✅ RESOLVED | Move authorization before data fetch in `getImportedPMD` |
| EF-ORG-001 | ✅ RESOLVED | Add `dentist_owner` role check to `deactivateMember.ts` |
| EF-ORG-002 | ✅ RESOLVED | Add `assertBranchAccess` to `DentalBranchManagement_get.ts` |
| UJ-SCHED-003 | ✅ RESOLVED | Fix edit modal to call `updateAppointment` not `createAppointment` |

### 10.3 When Touching — Opportunistic Fixes

Address these when the module is being worked on:
- All EM-CLIN-*/EF-CLIN-*: Visit immutability enforcement on 6 missing handlers
- All EF-SCHED-001 to 006: API field name alignment with contract
- EM-PERIO-001/002: HTTP code corrections (422 → 409)
- EM-BILL-010: `formatPlanStatus` camelCase/snake_case fix
- EF-IMAGING-009/010: Add `status` column to `imaging_annotation`; implement SM-01

### 10.4 Track — P2/P3 Items

Tracked in this baseline; not blocking. Address in backlog:
- All TR-5C-* (unspecced implementations): decide ownership or write MODULE_SPECs
- All TR-5E-* (workflow gaps): schedule WFG-002, WFG-004, WFG-006 specifically
- EC-DPAT-001: Resolve treatment plan module ownership formally
- EC-DORG-001: Add PIN endpoints to MODULE_SPEC §10

---

## 11. What's Next

**Branch 2 — P0 Volume (146 open P0s; 27 resolved: 19 P0 sprint + 8 §10.2 auth):**
§10.2 all 8 auth/IDOR P0s RESOLVED (commit 80f11f7). EX-006 (event bus) remains BLOCKED as own phase. Next: work down remaining 146 P0s — highest density modules: dental-imaging (26), dental-billing (21), dental-clinical (17). Use `/oli-enforce-fix --module <name>` per module.

**Branch 4 — Coverage Below 70% (5 modules):**
After fixing EC- items from Phase 0, rerun `/oli-enforce-coverage` for dental-audit (52%), dental-patient (55%), dental-imaging (61%), dental-org (64%), dental-clinical (68%). Write missing API_CONTRACTS for the 145 unspecced handlers.

**Branch 5 — Trace Gaps (open):**
- **TR-5E-003 / WFG-006** (P1, Legal): GDPR patient erasure — schedule spike
- **TR-5C-001** (P1): Resolve QueueItem spec ownership
- TR-5A-003 / TR-5B-003 both RESOLVED (P0 sprint).

**Branch 1 — Regressions:** None.

**Branch 3 — Not Applicable:** dental-emr-integration is correctly deferred. No new module specs needed.

---

## Appendix A: Reference Standard Alignment (IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md)

> Cross-check of enforcement suite output against IDEAL standard prescriptive requirements.

| IDEAL Section | Verdict | Reason | Key Finding References |
|---|---|---|---|
| **§3 Bounded Contexts (13 contexts, §3.1–3.13)** | **PARTIAL** | 11 of 13 contexts present as modules. Missing: Claims/Insurance (unspecced handlers exist in dental-patient via TR-5C-005 but no MODULE_SPEC), and Notifications (no dental-notifs module; `notifs` is upstream platform module with unconfirmed dental consumers). | TR-5C-005, TR-5D-005, EC-DPAT-001 |
| **§4 End-to-End Workflows (4.1–4.6)** | **PARTIAL** | 4.1 (new patient→chart) partial (TR-5B-003: audit consumer absent; TR-5A-003: chart layers absent). 4.2 (recall) partial (no recall E2E spec). 4.3 (walk-in) partial (UJ-SCHED-002: `_walkIn` flag disabled). 4.4 (treatment plan partial completion) covered (journeys/06). 4.5 (imaging attachment) partial (EF-IMG-002/003/004: study list, upload, annotation endpoints all missing). 4.6 (offline) GAP (Cadence CRDT not activated). | TR-5A-003, UJ-SCHED-002, EF-IMG-002, TR-5E-008 |
| **§5 Business Rule Registry (50+ BRs, PAT/APT/ENC/CHART/TP/PROC/BILL/CLAIM/ATT/LF/AUD)** | **PARTIAL** | 9 confirmed orphan BRs (TR-5A-001..009): most critical are CHART-BR-001/002/006 (P0, layer separation entirely absent), LF-BR-001/002 (offline localId), AUD-BR-004 (metadata dropped). BILL/CLAIM/PROC registries partially covered; CLAIM entirely unspecced. | TR-5A-001..009, EM-BILL-001..015, EM-AUDIT-009 |
| **§6 Entity Reference (8 entity tables)** | **PARTIAL** | Domain terms present across module schemas. Cross-module FKs on `imaging_finding` (EF-IMG-011) and `pmd_document` (EF-PMD-006) violate the loose-coupling invariant from §6. `dental_perio_tooth_reading` missing 2 declared fields (EF-PERIO-008). `patient` table diverges on consent fields (EF-PAT-009). | EF-IMG-011, EF-PMD-006, EF-PERIO-008, EF-PAT-009 |
| **§7 Permission Matrix (8 roles + permission matrix)** | **GAP** | Systemic permission gaps across 6 modules: `admin` vs `dentist_owner` mismatch in audit (EM-AUDIT-001), `staff_full` locked out of billing (UJ-BILL-001), `staff_scheduling` admitted to clinical reads (EM-PERIO-003), role checks entirely absent in scheduling (EF-SCHED-005), associate billing scope unenforced (TR-5F-003). ROLE_PERMISSION_MATRIX.md has no rows for dental-emr-integration. | EM-AUDIT-001, UJ-BILL-001, EF-SCHED-005, TR-5F-001..003 |
| **§8 UI/UX Standard (4 sub-standards: iPad-first, layer separation, status chips, navigation)** | **PARTIAL** | iPad-first responsive layouts baseline implemented. Layer separation (baseline/proposed/completed) in dental chart: ENTIRELY ABSENT (UJ-VISIT-003, TR-5A-003 — `entryClassification` dead code). Status chips partially implemented. Navigation integrity broken in 3+ journey flows (UJ-ORG-004: empty PIN list; UJ-PMD-005: PMD viewer unreachable; UJ-SCHED-005: cancel absent). | UJ-VISIT-003, TR-5A-003, UJ-ORG-004, UJ-PMD-005 |
| **§9 Test Coverage Standard (E2E-001..010, BR mapping)** | **PARTIAL** | 7/10 E2E journeys covered (E2E-001..004 covered; E2E-005/006/008/009 partial; E2E-010 missing). BR-test linkage documented for BR-001..009 in visit/billing modules. 6 carousel tests permanently skipped (EF-VISIT-014). `imaging_finding.fsm.property.test.ts` empty (EF-IMG-013). `dental-audit` has no HTTP-level handler test (EM-AUDIT-014). | E2E-005, E2E-006, E2E-010, EF-VISIT-014, EF-IMG-013 |
| **§10 Seed Data Expectations** | **PARTIAL** | Seed has 10 patient scenarios (`P[0]`..`P[9]`); §10.1 requires 20+. Code comment `GAP-007: expand to 20+ patients per IDEAL §10.1` confirms the gap is known. Imaging seeded for P[5]+ patients. 3 consent templates present. Medical history, recalls, and follow-up notes seeded for subset. Missing: pediatric patient scenario, orthodontic scenario, full perio history scenario required by §10.2. | `scripts/seed-demo.ts:466` comment `GAP-007` |

---

*End of Enforcement Report — oli-enforce-all v1.0 | 2026-05-27 | baseline-001 | 486 total findings*
