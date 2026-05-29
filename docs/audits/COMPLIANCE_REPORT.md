# Compliance Report

---
oli-version: "1.0"
Audit Date: 2026-05-30
Audit Type: code-vs-spec compliance (read-only)
Modules Audited: dental-patient, dental-org, dental-visit, dental-clinical, dental-billing, dental-scheduling, dental-imaging, dental-perio, dental-pmd, dental-audit, emr-consultation, external-records-import (planned-only)
Run by: oli-check --compliance (parallel per-module audit)
last-modified: 2026-05-30
last-modified-by: oli-check
---

## Audit Scope

| Artifact | Available | Steps Executed |
|----------|-----------|----------------|
| MODULE_SPEC.md | ✓ (12 modules) | Business rules, ACs, permissions, state transitions, data validation, API contracts |
| API_CONTRACTS.md (per module) | ✓ (11 of 12; emr-consultation has none) | Schema-level contract compliance |
| DOMAIN_GLOSSARY.md / DOMAIN_MODEL.md | ✓ | Terminology + bounded-context integrity |
| ROLE_PERMISSION_MATRIX.md | ✓ | Permission coverage + Better-Auth role sync |
| ERROR_TAXONOMY.md | ✓ | Error-code cross-reference |
| EVENT_CONTRACTS.md | ✓ | Domain-event publisher/consumer verification |
| AUDIT_CONTRACTS.md | ✓ | Audit-logging compliance |
| DATA_GOVERNANCE.md | ✓ (present; Step 9e not force-run — `--regulated` not passed) | PII leaks still caught under permissions/API-contract steps |

> **Generated code excluded:** `services/api-ts/src/generated/**` and `*.generated.*` are not audited for compliance. Hand-written handlers/repos/schemas/components that consume generated types ARE in scope. Where a generated validator IS the implemented wire contract, drift from API_CONTRACTS.md is reported as documentation/spec drift.

> **Spec paradox disclaimer:** This audit validates code against specs. Where specs internally contradict (e.g. MODULE_SPEC §6 vs ROLE_PERMISSION_MATRIX, or §10 vs §15 error statuses), the contradiction is reported as a **spec gap** and the cross-cutting artifact (matrix / taxonomy) is treated as source of truth.

## Executive Summary

- **Overall verdict:** 🔴 **BLOCK** — 15 P0 violations present (quality gate blocks on any P0).
- **Modules implemented & audited:** 11 (external-records-import is planned-only / spec-ahead-of-code — no live route, excluded from totals).
- **P0 (fix now):** 15
- **P1 (fix before new work):** 59
- **P2 (fix when touching):** 40
- **P3 (track):** 7
- **Total findings:** 121
- **Spec gaps (specs incomplete/contradictory, NOT code bugs):** ~42 across modules

### Top systemic risks (recurring across modules)

1. **PHI in the immutable audit log (P0, dental-audit V-AUD-001):** `createMember` writes a person `displayName` into audit `metadata`, returned raw by the viewer. Append-only + never-deleted = unremediable once written. Direct AC-AUD-004 / HIPAA breach.
2. **Authorization guards silently skipped (P0, dental-patient V-PAT-002/003):** archive/restore/update/follow-up skip role+branch checks when `preferredBranchId` is falsy — owner-only writes become unguarded for branchless patients.
3. **Money-integrity holes (P0, dental-billing V-BIL-001/002):** discount `percentageRate` has no 0–100 bound (negative totals possible); payment-plan installment count unbounded (0 → division by `Infinity`).
4. **Domain events are dead code everywhere.** dental-visit, dental-clinical, dental-imaging, dental-pmd, dental-perio, dental-org all declare published events (DE-xxx) with documented consumers, but **no event bus exists** in api-ts — publishers are unwired or absent. Every cross-module automation keyed on these events silently never fires.
5. **Error-code/status drift is pervasive (P0/P1).** Handlers throw generic `CONFLICT`/`VALIDATION_ERROR`/`FORBIDDEN` (400/403/409) where ERROR_TAXONOMY mandates specific codes/statuses (`DOUBLE_BOOKING`, `CONSENT_FORM_SIGNED 422`, `IMAGING_TIER_REQUIRED 403`, `PATIENT_ARCHIVED 403`, `VISIT_NOT_COMPLETED 422`, …). Clients/contract-tests keyed on `error.code` break.
6. **Audit-write coverage is thin on clinical PHI paths.** Prescriptions, consent sign/revoke, perio chart create/complete, imaging finding/ceph access, PMD import, EMR finalize/update — all AUDIT_CONTRACTS-required — write no `dental_audit_log` row (only Pino `logger.info`).

## Category / Module Summary

| Module | Compliance | P0 | P1 | P2 | P3 | Spec Gaps | Verdict |
|--------|-----------:|---:|---:|---:|---:|----------:|---------|
| dental-patient | 58% | 4 | 8 | 2 | 0 | 3 | 🔴 BLOCK |
| dental-billing | 68% | 3 | 7 | 4 | 1 | 4 | 🔴 BLOCK |
| dental-pmd | 64% | 2 | 6 | 3 | 1 | 4 | 🔴 BLOCK |
| dental-scheduling | 78% | 2 | 5 | 4 | 1 | 3 | 🔴 BLOCK |
| dental-visit | 78% | 1 | 5 | 4 | 0 | 3 | 🔴 BLOCK |
| dental-imaging | 72% | 1 | 7 | 3 | 1 | 4 | 🔴 BLOCK |
| dental-perio | 76% | 1 | 5 | 4 | 0 | 4 | 🔴 BLOCK |
| dental-audit | 72% | 1 | 3 | 4 | 0 | 3 | 🔴 BLOCK |
| dental-clinical | 72% | 0 | 6 | 4 | 1 | 5 | 🟡 WARN |
| emr-consultation | 82% | 0 | 4 | 3 | 1 | 5 | 🟡 WARN |
| dental-org | 86% | 0 | 3 | 5 | 1 | 3 | 🟡 WARN |
| external-records-import | N/A | 0 | 0 | 0 | 0 | 4 | ⚪ planned-only |
| **TOTAL** | — | **15** | **59** | **40** | **7** | **~42** | 🔴 **BLOCK** |

---

## Violations by Module

### dental-patient — 58% (🔴 4×P0)

| ID | Category | Sev | Description | File:Line | Fix |
|----|----------|-----|-------------|-----------|-----|
| V-PAT-001 | Business Rules / State | P0 | BR-015b/AC-PAT-002 require **403** on writes to archived patient; impl throws `PATIENT_ARCHIVED`→**422**, tests codify the wrong status | `identity/updateDentalPatient.ts:35`, `engagement/followUpNotes.ts:63`, `core/errors.ts:43` | Throw `ForbiddenError`/403 |
| V-PAT-002 | Permissions | P0 | Archive/restore/update/follow-up **skip** role+branch auth when `preferredBranchId` falsy → branchless patient mutable by any authed user | `identity/archiveDentalPatient.ts:33`, `restoreDentalPatient.ts:30`, `updateDentalPatient.ts:40`, `engagement/followUpNotes.ts:68` | Deny (403) when branch missing |
| V-PAT-003 | Permissions | P0 | `addFollowUpNote`/`listFollowUpNotes` enforce no role — any member incl. read_only/scheduling | `engagement/followUpNotes.ts:67` | Add `assertBranchRole(['staff_full','dentist_associate','dentist_owner'])` |
| V-PAT-004 | API Contracts | P0 | Implemented create body fundamentally different from API_CONTRACTS (single `consentGiven` vs 4 consents; no split name/contact/emergency; required fields unvalidated) | `generated/openapi/validators.ts:1643` → `identity/createDentalPatient.ts:35` | Reconcile TypeSpec for POST /dental/patients with API_CONTRACTS |
| V-PAT-005 | Business Rules / Validation | P1 | Consent validated then **discarded** — never persisted as JSONB on person (BR-015/WF-044) | `identity/createDentalPatient.ts:38,59`; `person/repos/person-dental-patient.facade.ts:11` | Persist consent JSONB at creation |
| V-PAT-006 | Events | P1 | DE-021 PatientRegistered never published (consumers: dental-audit, notifs) | `identity/createDentalPatient.ts:71` | Publish DE-021 |
| V-PAT-007 | API Contracts | P1 | GET /:id omits safety floor / follow_up_notes / consents; AC-PAT-003 unsatisfiable on profile endpoint | `identity/getDentalPatient.ts:74` | Include safety-floor aggregation or repoint AC |
| V-PAT-008 | Permissions | P1 | Search role list denies staff_scheduling/dental_assistant/front_desk/billing_staff/read_only (matrix: all dental roles view) | `identity/listDentalPatients.ts:33` | Align allowed roles with matrix |
| V-PAT-009 | API Contracts / Errors | P1 | Already-archived returns 422 `ARCHIVE_BLOCKED`; spec wants **409 PATIENT_ALREADY_ARCHIVED** | `identity/archiveDentalPatient.ts:50`; `patient/repos/patient.repo.ts:295` | Map to ConflictError(409) |
| V-PAT-010 | Acceptance Criteria | P1 | AC-PAT-004 cross-branch isolation untested (no two-branch same-name test) | `dental-patient.test.ts` | Add two-branch isolation test |
| V-PAT-011 | Acceptance Criteria | P1 | AC-PAT-003 safety-floor counts untested | `dental-patient-records.test.ts` | Add 2-allergy/1-medication assertion |
| V-PAT-012 | API Contracts / Validation | P1 | bulk-archive uses `{patientIds}`, no `reason`; contract wants `{ids[≤50], reason[5–500] required}` | `identity/bulkArchiveDentalPatients.ts:23` | Rename, require reason, cap 50 |
| V-PAT-013 | Data Validation | P2 | Follow-up note `text` min(1); contract min:5/max:2000 | `engagement/followUpNotes.ts:19`; `patients/components/follow-up-notes.tsx:36` | Enforce 5–2000 |
| V-PAT-014 | API Contracts | P2 | `getDentalPatient` spreads full `person` object → undeclared PII risk | `identity/getDentalPatient.ts:93` | Return declared subset only |

### dental-billing — 68% (🔴 3×P0)

| ID | Category | Sev | Description | File:Line | Fix |
|----|----------|-----|-------------|-----------|-----|
| V-BIL-001 | Validation / Bounded-ctx | P0 | `percentageRate` never bounds-checked → rate>100 yields negative `totalCents`/`balanceCents` (money-integrity breach) | `applyDentalDiscount.ts:46`; `utils/rounding.ts:37`; `generated validators.ts:109` | Validate 0≤rate≤100 (422); add `.min(0).max(100)` in TypeSpec |
| V-BIL-002 | Validation / State | P0 | `numberOfInstallments` not bounded (contract 2–24); count=0 → `Math.floor(total/0)=Infinity` | `createDentalPaymentPlan.ts:49`; `repos/dental-payment-plan.repo.ts:69`; `generated validators.ts:767` | Reject <2/>24 (422); add `.gte(2).lte(24)` |
| V-BIL-003 | Permissions | P0 | `staff_full` granted create-invoice/create-plan; matrix says owner+associate-own-only | `createDentalInvoice.ts:32`; `createDentalPaymentPlan.ts:30` | Remove staff_full; constrain associate; reconcile MODULE_SPEC §6 vs matrix |
| V-BIL-004 | API / Terminology | P1 | Overpayment code `OVERPAYMENT`; taxonomy wants `PAYMENT_EXCEEDS_BALANCE` | `recordDentalPayment.ts:53` | Rename code |
| V-BIL-005 | API / Terminology | P1 | Payment on paid/voided → `ALREADY_PAID`/`VOIDED_INVOICE`; taxonomy wants `INVOICE_IMMUTABLE 422` | `recordDentalPayment.ts:43,47` | Use INVOICE_IMMUTABLE |
| V-BIL-006 | Acceptance / BR | P1 | BR-013/AC-BIL-005 `markUncollectible`→501; no dental handler exists | (no handler) | Add 501 stub |
| V-BIL-007 | Business Rules | P1 | Undocumented `CONSENT_REQUIRED` gate mislabeled "BR-011" (BR-011 is void/payment-plan) | `createDentalInvoice.ts:34` | Document with own BR-id or remove; fix mislabel |
| V-BIL-008 | API Contracts | P1 | Issue is `POST /dental/billing/invoices/:id/issue`; spec wants `PATCH /dental/invoices/:id/issue` | `generated routes.ts:444`; `issueDentalInvoice.ts:4` | Reconcile method/path |
| V-BIL-009 | API / Validation | P1 | `receiptNumber`/`recordedByMemberId` required but contract marks `reference` optional, defines `payment_date` (absent) | `generated validators.ts:16845` | Align body with contract |
| V-BIL-010 | Data Validation | P1 | `amount_cents` contract min:1; validator only `int()` (handler defends, schema doesn't) | `generated validators.ts:16846` | Add `.gte(1)` |
| V-BIL-011 | Events | P2 | DE-008 InvoicePaid emitted on every payment incl. partial | `recordDentalPayment.ts:95` | Gate on transition to `paid` |
| V-BIL-012 | Terminology / 7b | P2 | Response `balanceCents` vs contract `outstanding_cents` | `repos/dental-invoice.schema.ts:35`; `getDentalInvoice.ts:61` | Add alias or update contract |
| V-BIL-013 | Audit Logging | P2 | `voidDentalPayment` (financial reversal) writes no audit event | `voidDentalPayment.ts:47` | Add `logAuditEvent('payment.void')` |
| V-BIL-014 | State Transitions | P2 | `markOverdueInvoices` idempotency relies on status filter, untested vs §13 | `repos/dental-invoice.repo.ts:239` | Add paid/voided-never-overdue test |
| V-BIL-015 | Terminology | P3 | API_CONTRACTS FSM `sent` vs MODULE_SPEC/code `issued`; payment_method enum drift | `API_CONTRACTS.md:9,131` vs `MODULE_SPEC.md:127` | Unify across docs |

### dental-pmd — 64% (🔴 2×P0)

| ID | Category | Sev | Description | File:Line | Fix |
|----|----------|-----|-------------|-----------|-----|
| V-PMD-001 | BR / Bounded-ctx / AC | P0 | BR-022/AC-PMD-002: PATCH/PUT/DELETE on imported PMD must be **405 IMPORTED_PMD_IMMUTABLE**; no guard exists → default 404 | `app.ts:214` (only audit guard); none in `handlers/dental-pmd/` | Add 405 immutability routes |
| V-PMD-002 | Bounded-ctx (integrity) | P0 | §7.2/§20 mandate UUID-only refs (no DB FK) for loose coupling; schema declares hard FKs on `imported_pmd.patient_id` + `pmd_document` refs → blocks imports from defunct facilities | `repos/pmd-document.schema.ts:23,41` | Drop `.references(...)`, use plain `uuid()` |
| V-PMD-003 | API / Errors / AC | P1 | Non-completed-visit generate → 400 VALIDATION_ERROR; spec wants 422 VISIT_NOT_COMPLETED (test also wrong) | `generatePMD.ts:51`; `core/errors.ts:37` | Throw BusinessLogicError(VISIT_NOT_COMPLETED); fix test |
| V-PMD-004 | Events | P1 | DE-017 PMDGenerated never published (consumers: notifs, dental-audit) | `generatePMD.ts` | Emit DE-017 |
| V-PMD-005 | API / Validation | P1 | Frontend import omits required `sourceDescription` (NOT NULL) → all UI imports fail | `pmd/components/pmd-import.tsx:74` | Add required input |
| V-PMD-006 | API Contracts | P1 | List/download routes diverge from contract; no presigned-URL download (returns JSON blob) | `generated routes.ts:1119,1322`; `exportPMD.ts:77`; `API_CONTRACTS.md:49` | Reconcile routes + download shape |
| V-PMD-007 | Audit Logging | P1 | `importPMD` (PHI ingestion) writes no audit event | `importPMD.ts:59` | Add `logAuditEvent('pmd.import')` |
| V-PMD-008 | Permissions | P1 | List/view use `assertBranchAccess` only, no patient-self path (§6 "Download: patient own PMDs") | `getPMDForVisit.ts:24`; `listPMDs.ts:29`; `listImportedPMDs.ts:29` | Add patient-self auth path |
| V-PMD-009 | Terminology | P2 | "PMD" expanded inconsistently (Portable Medical Document vs Patient Medical Data/Dossier) | `repos/pmd-document.schema.ts:1`; `dental-pmd.tsp:2`; `API_CONTRACTS.md:9` | Standardize |
| V-PMD-010 | Data Validation | P2 | `branch_id` absent from validators; no max:200 on source_description | `generated validators.ts:2157,16036` | Decide branch_id SoT; add max-length |
| V-PMD-011 | AC / Bounded-ctx | P2 | `supersede()` mutates old row status to `superseded`; §8 says `generated` terminal (undocumented transition) | `repos/pmd-document.repo.ts:67`; §8/§13 | Document transition |
| V-PMD-012 | Terminology | P3 | "Safety Floor merge" used in code, undefined in PMD spec (cross-module leakage from clinical) | `repos/pmd-document.schema.ts:49`; `pmd-import.tsx:4` | Define or remove |

### dental-scheduling — 78% (🔴 2×P0)

| ID | Category | Sev | Description | File:Line | Fix |
|----|----------|-----|-------------|-----------|-----|
| V-SCH-001 | API / AC | P0 | Reschedule conflict → generic `CONFLICT 409`, not `DOUBLE_BOOKING`/`RESCHEDULE_CONFLICT` (AC-SCH-002) | `updateAppointment.ts:98` | Throw ConflictError with specific code |
| V-SCH-002 | API / AC | P0 | Check-in active-visit → generic `CONFLICT`, not `CHECKIN_ACTIVE_VISIT` (AC-SCH-003) | `checkInAppointment.ts:50` | Throw specific code |
| V-SCH-003 | API Contracts | P1 | Cancel reads body `cancellationReason` (no min/max); contract wants query `reason` min:5/max:500 | `cancelAppointment.ts:45` | Align param + length |
| V-SCH-004 | API Contracts | P1 | List takes single optional `date`+`limit/offset`; contract wants required `date_from/date_to` (31-day cap)+`page/per_page` | `listAppointments.ts:25`; `validators.ts:17909` | Add range+pagination |
| V-SCH-005 | AC / UI | P1 | Backend returns `warnings:['DOUBLE_BOOKING']` but frontend ignores it — no warning shown (AC-SCH-001/§9) | `scheduling/components/appointment-modal.tsx:138` | Render warning modal |
| V-SCH-006 | API Contracts | P1 | Response field names diverge (`provider_id/start_at/end_at/visit_type` vs `dentistMemberId/scheduledAt/durationMinutes/serviceType`) | `repos/dental-appointment.schema.ts:26`; `validators.ts:519` | Reconcile field names |
| V-SCH-007 | Terminology | P1 | `serviceType` free-text vs spec `visit_type` enum (checkup/treatment/emergency/recall) | `repos/dental-appointment.schema.ts:31` | Rename + constrain enum |
| V-SCH-008 | Data Validation | P2 | No `end_at > start_at` validation (duration-only model) | `createAppointment.ts:39` | Validate or document |
| V-SCH-009 | State Transitions | P2 | Extra unspecified transitions (`checked_in→cancelled/no_show`, `no_show→completed`) | `repos/dental-appointment.schema.ts:62` | Confirm FSM / update §8 |
| V-SCH-010 | Events | P2 | DE-001 VisitCheckedIn ownership ambiguous (contract vs §10b) | `checkInAppointment.ts:54` | Clarify ownership |
| V-SCH-011 | Permissions | P2 | API_CONTRACTS cancel auth includes staff_scheduling; MODULE_SPEC/code = owner+staff_full (contract is outlier) | `cancelAppointment.ts:34` | Align contract with §6 |
| V-SCH-012 | Audit Logging | P3 | Double-booking WARN observable not emitted as structured log | `createAppointment.ts:57` | Emit WARN log |

### dental-visit — 78% (🔴 1×P0)

| ID | Category | Sev | Description | File:Line | Fix |
|----|----------|-----|-------------|-----------|-----|
| V-VIS-002 | Permissions | P0 | `createDentalVisit` permits `hygienist`; matrix = owner+associate only | `visits/createDentalVisit.ts:27` | Remove hygienist or amend matrix |
| V-VIS-001 | Events | P1 | DE-001..006 domain events defined but never called; no consumer for queue | `domain-events.ts:98`; `updateDentalVisit.ts:121`; `updateDentalTreatment.ts:102` | Wire emit calls + consumer |
| V-VIS-003 | Business Rules (BR-001) | P1 | Concurrent-active-visit guard enforced in check-in path but NOT in direct POST /visits or activate path (relies on DB index → 500 not 409) | `createDentalVisit.ts:31`; `updateDentalVisit.ts:73`; `visit.repo.ts:77` | App-level guard before create/activate |
| V-VIS-004 | Business Rules (BR-005) | P1 | Auto-discard unconditionally implemented though §5/§18 mark it deferred behind default-false flag | `updateDentalVisit.ts:91`; `visit.repo.ts:108` | Gate behind flag or update spec |
| V-VIS-005 | Business Rules (BR-006) | P1 | API_CONTRACTS PATCH treatment status enum omits `verified`/`declined` that the FSM allows | `repos/treatment.schema.ts:91` vs `API_CONTRACTS.md:133` | Update contract enum |
| V-VIS-006 | Audit Logging | P1 | treatment `dismissed`/`declined` (incl. patient refusal) emit no audit; only `performed` logs | `updateDentalTreatment.ts:76` | Add audit for dismiss/decline |
| V-VIS-007 | API Contracts (drift) | P2 | POST /visits doc body snake_case+`visit_type`/`appointment_id`; impl camelCase, no those fields | `validators.ts:786` vs `API_CONTRACTS.md:23` | Regenerate contract |
| V-VIS-008 | API Contracts (drift) | P2 | Contract `started_at`+`active` status; impl `draft`+`activatedAt` | `createDentalVisit.ts:31`; `visit.schema.ts:29` | Reconcile |
| V-VIS-009 | Terminology | P2 | SOAP modeled 3 ways (spec `visit_notes.content` / contract `ClinicalNote[]` / code 4 columns) | `repos/treatment.schema.ts:48` | Align docs to code |
| V-VIS-010 | API Contracts | P2 | Sign route `/notes/sign` (single per-visit note) vs documented `/notes/:nid/sign` | `signVisitNotes.ts:27` vs `API_CONTRACTS.md:227` | Reconcile route shape |

> Note: completion **hard gates are real and server-enforced** (open treatments / unsigned consent / unsigned notes → 422); "Complete anyway" only relaxes the soft UI checklist and is still blocked by the backend. Treatment FSM (diagnosed→planned→performed) is enforced. No transition-bypass P0 found.

### dental-imaging — 72% (🔴 1×P0)

| ID | Category | Sev | Description | File:Line | Fix |
|----|----------|-----|-------------|-----------|-----|
| V-IMG-001 | AC / API | P0 | AC-IMG-001: ceph study upload without addon tier must 403; `createImagingStudy` has NO tier gate (only downstream ceph endpoints gated) | `createImagingStudy.ts:50` | Gate cephalometric modality at create with IMAGING_TIER_REQUIRED |
| V-IMG-002 | Errors / API | P1 | Tier block throws `FORBIDDEN`; spec wants `IMAGING_TIER_REQUIRED 403` (breaks §9 upgrade UI) | `batchUpsertCephLandmarks.ts:60`; `recomputeCephAnalysis.ts:50`; +6 ceph handlers | Dedicated error code |
| V-IMG-003 | Errors / Validation | P1 | Unsupported MIME → 400 VALIDATION_ERROR; spec wants 422 UNSUPPORTED_MIME_TYPE | `createImagingStudy.ts:40` | Throw BusinessLogicError(422) |
| V-IMG-004 | API / Edge | P1 | Recompute never enforces NOT_CALIBRATED/INSUFFICIENT_LANDMARKS (always 200) | `recomputeCephAnalysis.ts:53` | Throw 422 on uncalibrated/missing |
| V-IMG-005 | Events | P1 | DE-018/019/020 never emitted (study upload, finding confirmed, ceph computed) | `createImagingStudy.ts`; `updateFinding.ts:65`; `recomputeCephAnalysis.ts` | Emit events |
| V-IMG-006 | Audit Logging | P1 | PHI radiograph access largely unaudited (findings/annotations/ceph landmarks/analysis/report) | `createFinding.ts`; `getCephAnalysis.ts`; `getCephReport.ts`; +others | Add `logAuditEvent` on PHI read/mutate |
| V-IMG-007 | Terminology / Validation | P1 | Finding FSM adds `suspected`/`monitoring`, defaults to `suspected`; spec SM-01 = `draft→confirmed→resolved` (create even rejects `draft`) | `repos/imaging_finding.schema.ts:38`; `createFinding.ts:26` | Align to spec or update §2/§8 |
| V-IMG-008 | Terminology / API | P2 | Annotation type/status enum diverges; no status column on `imaging_annotation` | `repos/imaging.schema.ts:41` | Reconcile |
| V-IMG-009 | API Contracts | P2 | API surface image-centric vs contract study-centric (no `ceph-analyses` resource) | `generated routes.ts:598`; `createImagingStudy.ts:95` | Regenerate or update contract |
| V-IMG-010 | Terminology | P3 | Modality enum omits `cbct`; spec WF-019/§7 references it | `repos/imaging.schema.ts:29` | Add cbct |

> Bounded-context loose coupling correctly upheld (UUID-only cross-module refs, no FKs). Ceph math engine is pure/deterministic (fixed 2-dp rounding for cross-runtime parity) per D-A..D-P. All routes carry authMiddleware + branch scoping.

### dental-perio — 76% (🔴 1×P0)

| ID | Category | Sev | Description | File:Line | Fix |
|----|----------|-----|-------------|-----------|-----|
| V-PER-006 | Audit Logging | P0 | Chart create/complete touch clinical PHI but write nothing to `dental_audit_log` (only Pino); violates §4/§17 + audit-convergence requirement | `createPerioChart.ts:68`; `completePerioChart.ts:103` | Route through dental_audit_log writer |
| V-PER-001 | AC / API | P1 | Complete already-completed → 422 `PERIO_CHART_ALREADY_COMPLETE`; spec wants 409 CHART_COMPLETED | `completePerioChart.ts:44` | Use ConflictError(409) |
| V-PER-002 | API / Terminology | P1 | Write to completed chart → `PERIO_CHART_LOCKED`; contract wants `CHART_COMPLETED` | `upsertToothReading.ts:51` | Emit CHART_COMPLETED |
| V-PER-003 | Errors / Terminology | P1 | Prefixed codes (`PERIO_VISIT_LOCKED`, `PERIO_INSUFFICIENT_READINGS`) vs canonical (`VISIT_LOCKED`, `INSUFFICIENT_READINGS`) | `createPerioChart.ts:39`; `completePerioChart.ts:63` | Align codes |
| V-PER-004 | Data Validation | P1 | `mobility`/`furcation` accept any int (no 0–3 range); invalid grades persist | `upsertToothReading.ts:43,81`; `validators.ts:17272` | Add 0–3 range assertion |
| V-PER-005 | Events | P1 | `perio.chart.created/completed/locked` never emitted (no domain-events module) | `createPerioChart.ts:68`; `completePerioChart.ts:103` | Emit events |
| V-PER-007 | State Transitions | P1 | `locked` state dead — no visit-lock→chart-lock cascade, lock event never fires | `perio-chart.repo.ts` (no lock cascade) | Add cascade + event |
| V-PER-008 | Data Validation | P2 | BR-P04 wording "11–48" too loose vs impl quadrant ranges (impl correct, doc wrong) | `BR-P04` vs `perio-validation.ts:11` | Tighten BR wording |
| V-PER-009 | Data Validation | P2 | recession range -5..20 invented (unspecified in spec) | `utils/perio-validation.ts:40` | Document range |
| V-PER-010 | Acceptance Criteria | P2 | toothNumber path param unconstrained in validator (relies on handler assert) | `validators.ts ~18758` | Add FDI refine in TypeSpec |
| V-PER-011 | Frontend / AC | P2 | No perio chart-grid UI in apps/dentalemon (§9/WF-P01..P05); backend-only | `workspace/components/` (none) | Build UI or mark slice not-yet-implemented |

> Tenant/branch scoping correct on every endpoint; staff_scheduling correctly excluded from reads. Bounded-context matches §7b.

### dental-audit — 72% (🔴 1×P0)

| ID | Category | Sev | Description | File:Line | Fix |
|----|----------|-----|-------------|-----------|-----|
| V-AUD-001 | API / Audit | P0 | `createMember` writes person `displayName` into audit `metadata` (returned raw by viewer) — AC-AUD-004 / HIPAA PHI-in-audit breach in append-only table | `dental-org/createMember.ts:106` | Drop displayName from metadata; add PHI lint in `logAuditEvent` |
| V-AUD-002 | API / Validation | P1 | No `INVALID_DATE_RANGE 422` when from>to (silently returns empty set) | `getAuditEvents.ts:46` | Validate from≤to |
| V-AUD-003 | API Contracts | P1 | Returns raw DB rows (camelCase, `targetType/timestamp`) + `beforeSnapshot/afterSnapshot` (latent PHI) not in contract | `getAuditEvents.ts:66` | Map to contract DTO; drop snapshots |
| V-AUD-004 | API Contracts | P1 | Query params diverge (`from/to/limit/offset/resourceType`); no `event_type` filter | `getAuditEvents.ts:29`; `repos/audit-log.repo.ts:36` | Accept contract params + add filters |
| V-AUD-005 | Terminology / API | P2 | Append-only code `AUDIT_APPEND_ONLY` vs taxonomy `AUDIT_EVENT_IMMUTABLE` | `app.ts:214,217,220` | Rename code |
| V-AUD-006 | Permissions / Terminology | P2 | `assertBranchAccess` throws `FORBIDDEN`, not `BRANCH_ACCESS_DENIED 403` | `shared/assert-branch-access.ts:31` | Use specific code |
| V-AUD-007 | Bounded-ctx | P2 | ADR-005 mandates fail-closed for security events; `logAuditEvent` swallows all errors (fire-and-forget) | `core/audit-logger.ts:90,110` | Rethrow for security-class events |
| V-AUD-008 | AC (test quality) | P2 | AC-AUD-002 immutability test uses inline closures, not real registered routes | `dental-audit/audit-append-only.test.ts:15` | Assert against real app/router |

> Cross-tenant audit leak (historical P0) is **mitigated**: getAuditEvents requires branchId + assertBranchAccess + EM-AUD-002 guard test. But repo `list()` applies no scope when branchId absent — guard is the single point of failure.

### dental-clinical — 72% (🟡 WARN, no P0)

| ID | Category | Sev | Description | File:Line | Fix |
|----|----------|-----|-------------|-----------|-----|
| V-CLN-001 | Audit Logging | P1 | "Write prescription" (AUDIT_CONTRACTS) only `logger.info`, no audit.logEvent | `prescriptions/createPrescription.ts:75` | Add audit event |
| V-CLN-002 | Audit Logging | P1 | "Sign consent" no audit event | `consent/signConsentForm.ts:42` | Emit audit |
| V-CLN-003 | Audit Logging | P1 | "Revoke consent" emits DE-013 but queue has no consumer → no audit row | `consent/revokeConsentForm.ts:62`; `domain-events.ts:12` | Register consumer or log directly |
| V-CLN-004 | Events | P1 | 4 of 5 declared events (DE-012/014/015/016) never published | `domain-events.ts:14` | Add emit functions + call sites |
| V-CLN-005 | API / Errors | P1 | Sign-after-signed → VALIDATION_ERROR 400; spec wants CONSENT_FORM_SIGNED 422 | `consent/signConsentForm.ts:36` | Throw BusinessLogicError(422) |
| V-CLN-006 | Permissions | P1 | createConsentForm grants `hygienist`; matrix = dentist roles only | `consent/createConsentForm.ts:29` | Remove hygienist |
| V-CLN-007 | Errors | P2 | Immutable-write code `VISIT_LOCKED` vs canonical `VISIT_IMMUTABLE` (prescription+consent) | `createPrescription.ts:36`; `createConsentForm.ts:33` | Use VISIT_IMMUTABLE |
| V-CLN-008 | Errors | P2 | Invalid lab FSM → VALIDATION_ERROR 400; spec wants INVALID_STATUS_TRANSITION 422 | `lab-orders/updateLabOrder.ts:43` | Throw 422 |
| V-CLN-009 | Errors | P2 | Medical-history PATCH → APPEND_ONLY_VIOLATION 422; spec wants MEDICAL_HISTORY_IMMUTABLE 405 | `medical-history/updateMedicalHistoryEntry.ts:25` | Return 405 |
| V-CLN-010 | Business Rules | P2 | WF-038 `clinical.amendment.created` audit not emitted | `amendments/createAmendment.ts:43` | Emit audit referencing original+amendment IDs |
| V-CLN-011 | Data Validation | P3 | createAmendment doesn't verify originalRecordId exists (dangling ref) | `amendments/createAmendment.ts:43` | Validate FK resolves |

> Note: tooth charting / treatment state machine / `dental_patient_chart_baseline` are owned by **dental-visit**, not dental-clinical. This module = prescriptions/lab-orders/consent/medical-history/attachments/amendments. State-transition enforcement is solid (lab FSM forward-only, consent signed-immutable, medical-history append-only — backend + frontend). Issues are wrong error codes, not unblocked transitions.

### emr-consultation — 82% (🟡 WARN, no P0)

| ID | Category | Sev | Description | File:Line | Fix |
|----|----------|-----|-------------|-----------|-----|
| V-EMR-001 | State / AC | P1 | `finalized→amended→finalized` FSM + WF-EMRC-004 unreachable (no amend endpoint; finalize rejects non-draft) | `finalizeConsultation.ts:64`; `updateConsultation.ts:68`; `emr.tsp:287` | Add amend endpoint or strike workflow |
| V-EMR-002 | Audit Logging | P1 | `finalizeConsultation` (lock authoritative record) emits no persisted audit | `finalizeConsultation.ts:73` | Add logAuditEvent |
| V-EMR-003 | Audit Logging | P1 | `updateConsultation` mutates PHI, no persisted audit | `updateConsultation.ts:82` | Add audit |
| V-EMR-004 | Audit Logging | P1 | `listConsultations`/`listEMRPatients` return PHI, no read audit (getConsultation does) | `listConsultations.ts:114`; `listEMRPatients.ts:172` | Add read audit |
| V-EMR-005 | Audit / Integrity | P2 | Audit `tenantId` falls back to **patient UUID** when null → PHI-id in tenant slot | `createConsultation.ts:109`; `getConsultation.ts:91` | Use non-PHI sentinel |
| V-EMR-006 | Terminology | P2 | Audit verbs dotted lowercase vs AUDIT_CONTRACTS `CREATED|READ|UPDATED|…` | `createConsultation.ts:111`; `getConsultation.ts:93` | Align or document |
| V-EMR-007 | Permissions | P2 | Comment claims "Support sees all" but no support role checked | `listConsultations.ts:21` | Remove misleading comment |
| V-EMR-008 | Data Validation | P3 | `externalDocumentation` settable on update but not create (undocumented) | `createConsultation.ts:81`; `repos/emr.schema.ts:218` | Wire through create or document |

> Bounded-context decoupling (commit 7ee24c36) is **clean** — facade-only cross-module access, no dental-* deps, no DB FKs. Note: `soap-notes-sheet.tsx` is wired to dental-visit EMR (`use-visit-notes`), NOT this module — `/emr` has no frontend caller in apps/dentalemon.

### external-records-import — planned-only (⚪)

**Implementation status:** planned-only — no handler dir, no TypeSpec namespace, no `/dental/emr-import` OpenAPI path, no `emr_record` table, no frontend. Spec self-declares `future_phase (Phase 3+)`. All BR/AC/permission items are MISSING-unbuilt (spec-ahead-of-code), **not** P0/P1, because no live route exists. Build-time P0 items (untrusted-file validation, parse-error handling, presigned-URL TTL, import provenance audit, tenant isolation) are correctly deferred but must not be skipped under demo pressure.

---

## Spec Gaps (specs incomplete or self-contradictory — NOT code bugs)

Key cross-cutting gaps requiring spec reconciliation (full per-module gaps in module sections above):

| Module | Gap | Recommendation |
|--------|-----|----------------|
| dental-patient | AC-PAT-002 "403" but no `PATIENT_ARCHIVED` code in ERROR_TAXONOMY; §6 vs API_CONTRACTS role lists conflict; follow-up path mismatch | Add code to taxonomy; pick authoritative role list/path |
| dental-billing | §6 (staff_full allowed) contradicts ROLE_PERMISSION_MATRIX (denied); undocumented CONSENT_REQUIRED gate; `applyDiscount`/balance/collections endpoints absent from §10; `sent` vs `issued` FSM | Reconcile matrix vs §6; document endpoints + bounds |
| dental-pmd | import transport contradictory (multipart vs JSON `content`); supersede transition unspecified; async generation/presigned-URL specced but unbuilt | Choose transport; document supersede; descope or mark future |
| dental-audit | ADR-005 (inline-sync) vs AUDIT_CONTRACTS §4 (async pg-boss/DLQ) stale; §6 DB-level append-only trigger/RLS absent (HTTP-only enforcement); no AUDIT_CONTRACTS coverage matrix test | Update §4 to cite ADR-005; add DB trigger/RLS; add coverage test |
| dental-perio | No perio entries in AUDIT_CONTRACTS / EVENT_CONTRACTS / ERROR_TAXONOMY; §6 omits hygienist (matrix grants it) | Register perio events/codes; add hygienist to §6 |
| emr-consultation | No rows in AUDIT_CONTRACTS / ERROR_TAXONOMY / ROLE_PERMISSION_MATRIX (all dental-* only); amend workflow specced but unbuilt | Add emr rows or confirm platform-module exemption |
| dental-imaging | `suspected`/`monitoring` finding states ambiguous; recompute 202-async contract vs sync reality; no imaging audit-event list | Resolve finding state set; reconcile async/sync; list audit events |
| dental-scheduling | §7 vs API_CONTRACTS field-name divergence; DE-001 ownership ambiguous; pagination params absent from TypeSpec | Pick canonical wire schema; clarify event ownership |

---

## Stabilization Plan

### Fix Now (P0 — 15)
Security, data-integrity, and broken-business-logic. **Must clear before ship.**
1. **V-AUD-001** — strip `displayName` PHI from audit metadata + add PHI guard in `logAuditEvent`. *(Once written to the append-only log it cannot be deleted — highest urgency.)*
2. **V-PAT-002 / V-PAT-003** — deny (403) instead of skipping auth guards when `preferredBranchId` is falsy; add role guard on follow-up writes.
3. **V-BIL-001 / V-BIL-002** — bound discount rate (0–100) and installment count (2–24); add to TypeSpec validators.
4. **V-BIL-003** — remove `staff_full` from financial-create role checks (reconcile §6 vs matrix).
5. **V-PMD-001 / V-PMD-002** — add 405 immutability guard on imported PMD mutation routes; drop hard FKs on PMD tables (UUID-only per §7.2/§20).
6. **V-SCH-001 / V-SCH-002** — emit specific conflict codes (`DOUBLE_BOOKING`, `CHECKIN_ACTIVE_VISIT`).
7. **V-PAT-001** — return 403 (not 422) on archived-patient writes; fix the tests that codify 422.
8. **V-VIS-002** — remove `hygienist` from visit-create roles (or amend matrix).
9. **V-IMG-001** — gate cephalometric study creation on addon tier (403).
10. **V-PER-006** — route perio chart create/complete writes to `dental_audit_log`.
11. **V-PAT-004** — reconcile create-patient contract (consent model + required fields).

### Fix Before New Work (P1 — 59)
Grouped themes: (a) **error-code/status alignment** to ERROR_TAXONOMY across all modules; (b) **wire domain-event publishers** (or formally descope §10b to "audit-only — no bus" given no event infra exists); (c) **audit-write coverage** on clinical PHI paths (prescription, consent, perio, imaging findings/ceph, PMD import, EMR finalize/update/list); (d) **API-contract field/param reconciliation** (scheduling, visit, pmd, billing, audit); (e) **missing/weak tests** for security-relevant ACs.

### Fix When Touching Module (P2 — 40)
Terminology drift, field-name aliases, idempotency tests, FSM documentation, annotation/modality enum reconciliation.

### Track (P3 — 7)
Cosmetic enum/naming/doc inconsistencies; no runtime impact.

---

## What's Next

- **15 P0 violations block ship.** Fix the P0 list above, then re-run `/oli-check --compliance --module <name>` on each affected module to confirm resolution.
- Get concrete fix diffs: re-run with `/oli-check --compliance --fix` (suggest/dry-run; never auto-writes).
- **Systemic decision needed:** domain events are declared across 6 modules but no event bus exists. Either build the publisher/bus, or amend EVENT_CONTRACTS + §10b sections to mark events "audit-log only" — this resolves ~8 P1s at once.
- **Systemic decision needed:** ERROR_TAXONOMY alignment — a single sweep mapping handler error codes/statuses to the taxonomy resolves 2 P0s + ~12 P1s.
- For per-module enforcement with baseline/ratchet tracking: `/oli-check --enforcement`.
- For test-confidence scoring (this audit checks test existence, not quality): `/oli-check --confidence`.
