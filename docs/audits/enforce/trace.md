# Traceability Enforcement
<!-- oli-trace v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->
<!-- supersedes: 2026-05-27 run | phase: B/C | algorithms: 5a,5b,5c,5d,5e,5f | phase-gated: 4b/4c suppressed (no VERTICAL_SLICE_PLAN) -->
<!-- artifacts: WORKFLOW_MAP.md, BUSINESS_RULES.md, 11x MODULE_SPEC.md, 11x API_CONTRACTS.md, OpenAPI (137 dental ops), 323 handler files -->

---

## Summary (run: run-5-f2-service-layer-di · 2026-05-28)

| Algorithm | Description | Count |
|-----------|-------------|-------|
| 5a | Orphan BRs (in BUSINESS_RULES.md, not in any MODULE_SPEC or handler code) | 12 |
| 5b | Orphan spec operations (MODULE_SPEC declares op, no handler exists) | 3 |
| 5c | Unspecced implementations (handler exists, not in OpenAPI / MODULE_SPEC) | 45 |
| 5d | Platform module gaps (used by dental modules, no integration spec) | 4 |
| 5e | Workflow coverage gaps (WF step with no handler or integration contract) | 4 |
| 5f | Contract-spec mismatches (API_CONTRACTS.md vs MODULE_SPEC.md deltas) | 3 |
| **Total findings (new run)** | | **71** |
| P0 | | 0 |
| P1 | | 17 |
| P2 | | 30 |
| P3 | | 12 (BRs in spec, missing handler code citation only) |

**Phase health:** No P0 gaps. Phase B→C boundary is clear. 17 P1 findings present — resolve before slice planning.

**Key coverage stats:**
- OpenAPI dental ops: 137 | Handler coverage: 137/137 (100%)
- BRs defined: 47 | BRs with any code ref: 23 (49%) | BRs with spec AND code ref: 11 (23%)
- WF explicit steps: 25 | Covered: 21 (84%) | Gaps: 4
- Cross-module flows: 16 | Event contracts: 0/16 (EVENT_CONTRACTS.md is empty)

---

## 5a: Orphan Business Requirements

BRs in `docs/prd/BUSINESS_RULES.md` not cited in any `MODULE_SPEC` section 5 or referenced in handler code comments.

| ID | BR | Domain | Issue | Severity |
|----|-----|--------|-------|----------|
| TR-BR-6b9be64d | BR-031 | Imaging | Ceph report idempotent re-gen: cited in BUSINESS_RULES.md test table only; no MODULE_SPEC section 5 entry | P1 |
| TR-BR-7ad3bb1d | BR-037 | Ceph | Batch upsert rejects locked landmarks: tested in `ceph.test.ts` (CIMG-14) but no `// BR-037` comment in handler code | P1 |
| TR-BR-9c451736 | BR-038 | Ceph | Recompute idempotent: tested (CIMG-15) but no code comment | P1 |
| TR-BR-50c9c5d7 | BR-039 | Ceph | Calibration provenance (D-J): tested but no code comment | P1 |
| TR-BR-09cffe2e | BR-040 | Ceph | Uncalibrated measurement UX label: no test, no code comment, no MODULE_SPEC | P1 |
| TR-BR-b7b326ca | BR-041 | Ceph | Non-existent image → 404 not 403: no code comment | P1 |
| TR-BR-f88e366a | BR-042 | Ceph | Ceph report version monotonically increasing: no code comment | P1 |
| TR-BR-ed01f5a4 | BR-043 | Ceph | `steiner_hybrid_sn` mandatory analysis type: no code comment | P1 |
| TR-BR-c5356ac7 | BR-044 | Ceph | DELETE on confirmed/placed only (not locked): no code comment | P1 |
| TR-BR-b0e76c94 | BR-045 | Ceph | Inline recompute on update; standalone idempotent: no code comment | P1 |
| TR-BR-c70a6952 | BR-046 | Ceph | All ceph ops require valid imageId or 404: no code comment | P1 |
| TR-BR-aa68a750 | BR-047 | Ceph | All ceph operations are image-scoped: no code comment | P1 |

**Pattern:** BR-037..047 are Ceph workspace rules — implemented and partially tested (`ceph.test.ts`) but lack `// Enforces BR-NNN` comments. This breaks the automated trace chain. BR-040 has no test at all (P2 gap per BUSINESS_RULES.md).

**Fix:** Add `// Enforces BR-NNN` comments to `CephMgmt_*.ts` handlers. Backfill `dental-imaging` MODULE_SPEC section 5 for ceph BRs via `/oli-module-specs`.

---

## 5b: Orphan Spec Operations

MODULE_SPEC declares operations with no handler directory or OpenAPI entry.

| ID | Module | Operations | Handler | Severity |
|----|--------|-----------|---------|----------|
| TR-EMR-8259e3c2 | dental-emr-integration | `POST /dental/emr/import`, `GET /dental/emr/:patientId`, `GET /dental/emr/:id` (3 ops) | NONE — dir does not exist | P1 |

**Context:** Intentionally deferred to Phase 3+ per `MODULE_MAP.md`. These endpoints are absent from the OpenAPI spec, confirming future-phase status. No action needed until Phase 3. Flagged P1 (phase-boundary awareness).

---

## 5c: Unspecced Implementations

Handler files exist with no corresponding OpenAPI operation entry (45 total across 6 modules).

| ID | Module | Handler Group | Count | Clinically Significant | Severity |
|----|--------|--------------|-------|----------------------|----------|
| TR-PATIENT-464bc41e | dental-patient | Insurance: createInsuranceProfile, listPatientInsuranceProfiles, updateInsuranceProfile, createClaimDraft, updateClaimStatus, getClaimReadiness | 6 | YES — affects billing + claim readiness | P2 |
| TR-PATIENT-d22eadfc | dental-patient | Recalls / Contacts / Alerts: listPatientRecalls, createRecall, updateRecall, createPatientContact, listPatientContacts, updatePatientContact, deletePatientContact, createDentalAlert, listDentalAlerts, updateDentalAlert | 10 | YES — recall is care continuity | P2 |
| TR-PATIENT-9ae3a08a | dental-patient | Treatment Plans / Engagement / Sync: createTreatmentPlan, listPatientTreatmentPlans, updateTreatmentPlan, createTask, listPatientTasks, updateTask, createSyncLog, listSyncLogs, updateSyncLog | 10 | YES — treatment plan continuity | P2 |
| TR-CLINICAL-8e8bf79f | dental-clinical | Inventory: createInventoryItem, listInventoryItems, updateInventoryItem, createInventoryAdjustment, listInventoryAdjustments | 5 | NO — operational only | P2 |
| TR-CLINICAL-b3c420bc | dental-clinical | Postop / Occlusion: createPostopTemplate, listPostopTemplates, updatePostopTemplate, createOcclusionScreening, listOcclusionScreenings | 5 | Medium — occlusion is V1-Recommended | P2 |
| TR-ORG-ce264bd6 | dental-org | Member / Org Mgmt: createOrganization, getBranchesByUser, deactivateMember, updateMember | 4 | NO — admin only | P2 |
| TR-SCHED-d9a12bfa | dental-scheduling | Queue Board: createQueueItem, listQueueBoard, updateQueueItemStatus | 3 | Medium — front desk workflow | P2 |

**Most critical:** 26 dental-patient shadow endpoints (insurance, recalls, contacts, alerts, treatment-plans, engagement, sync) span clinically important features that affect care continuity and billing integration. These must be spec'd before dental-patient vertical slice planning.

**Fix:** Run `/oli-module-specs --module dental-patient` to backfill MODULE_SPEC section 3 for all 26. Repeat for `dental-clinical` (inventory, postop/occlusion). Use `/typespec` to add to OpenAPI spec.

---

## 5d: Platform Module Gaps

Platform (base layer) modules used by dental modules with no formal MODULE_SPEC or integration contract doc.

| ID | Platform Module | Used By | Has MODULE_SPEC | Severity |
|----|----------------|---------|-----------------|----------|
| TR-GLOBAL-752cd240 | person | dental-visit, dental-org, dental-perio, dental-patient, dental-scheduling, dental-billing (6 modules) | NO — MODULE_MAP only | P1 |
| TR-GLOBAL-b14d7a18 | notifs | dental-scheduling (WF-095 appointment reminders) | NO — MODULE_MAP only | P1 |
| TR-GLOBAL-0b379a8a | storage | dental-visit, dental-org, dental-imaging (WF-098, WF-099) | NO — MODULE_MAP only | P1 |
| TR-GLOBAL-ecf58f67 | booking | Listed as dep for dental-scheduling in MODULE_MAP | NO — MODULE_MAP only | P1 |

**`person` is the most critical:** imported by 6/10 dental modules as the central PII safeguard. No formal integration contract exists defining PII access patterns.

**Algorithm 4d (cross-module blind spots):** `EVENT_CONTRACTS.md` is empty (0 events documented). All 5 async cross-module flows (WF-095/096/103/104 + WF-091) have pg-boss jobs but no event shape contracts.

**Fix:** Populate `docs/product/EVENT_CONTRACTS.md` with at minimum WF-095 (`appointment.reminder`), WF-096 (`audit.event.written`), WF-103 (`booking.slot.generated`). Add person-integration contract section to dental-patient MODULE_SPEC.

---

## 5e: Workflow Coverage Gaps

WORKFLOW_MAP steps with no handler or missing async integration contract.

| ID | WF | Step | Handler Status | Gap | Severity |
|----|-----|------|---------------|-----|----------|
| TR-WF-e2739876 | WF-004 | Patient invitation | No dedicated dental handler — relies on platform `notifs`/`email` with no integration contract | Missing contract | P1 |
| TR-WF-a818f2b5 | WF-095 | Appointment notification | `dental-scheduling → notifs` async pg-boss exists; no EVENT_CONTRACTS entry | No event contract | P1 |
| TR-WF-3c9d48a9 | WF-096 | Audit trail on every write | All modules → `dental-audit` async pg-boss; `getAuditEvents` handler present but no formal cross-module event shape | No event contract | P1 |
| TR-WF-72b76c6a | WF-103 | Booking slot generation | `booking → dental-scheduling` async pg-boss; `booking` module has no spec | Missing contract | P1 |

**False positives resolved:** WF-011 (clinical notes), WF-016 (prescriptions), WF-017 (lab orders), WF-019 (consent) initially appeared as gaps — they ARE covered in OpenAPI: notes → `upsertVisitNotes/signVisitNotes`, prescriptions → `createPrescription/listPrescriptions/updatePrescription`, lab orders → `createLabOrder/listLabOrders`, consent → `createConsentForm/listConsentForms/signConsentForm`.

**Fix:** Populate `EVENT_CONTRACTS.md` (3 events minimum). Document WF-004 invitation flow as a notifs integration contract in dental-patient MODULE_SPEC section 12.

---

## 5f: Contract-Spec Mismatches

Discrepancies between `API_CONTRACTS.md` and `MODULE_SPEC.md` within the same module.

| ID | Module | API_CONTRACTS Ops | MODULE_SPEC Ops | Issue | Severity |
|----|--------|------------------|-----------------|-------|----------|
| TR-PERIO-5a01d4c6 | dental-perio | 6 | 1 | MODULE_SPEC section 3 documents only 1 operation (CRUD section severely undercounts); 6 handler files and 6 API_CONTRACTS endpoints exist — 5 undocumented in spec | P2 |
| TR-VISIT-e277e541 | dental-visit | 16 | 9 | API_CONTRACTS covers carry-over, dentition init, treatment plan view, note-signing that MODULE_SPEC section 3 omits (delta = 7) | P2 |
| TR-AUDIT-2f099c89 | dental-audit | — | — | API_CONTRACTS has malformed `PATCH /DELETE` entry (parse artifact); `getAuditEvents` handler lives in `dental-org/` not `dental-audit/` — ownership ambiguity | P2 |

**dental-audit ownership:** `getAuditEvents` is tagged `Dental:Org` in OpenAPI and physically in `dental-org/`. The `dental-audit` MODULE_SPEC claims it. This dual-ownership breaks the module boundary and creates spec-code mismatch.

**Fix:** Rewrite `dental-perio` MODULE_SPEC section 3 (expand to 6 ops). Expand `dental-visit` MODULE_SPEC section 3 (add 7 missing ops). Fix dental-audit/API_CONTRACTS.md malformed entry. Clarify `getAuditEvents` ownership in MODULE_MAP.

---

## P3 Informational: BRs in MODULE_SPEC Without Handler Code Citation

12 BRs are properly spec'd but handler code lacks `// BR-NNN` citation comments. Not structural gaps — documentation debt only.

| BR | Module(s) | Rule Summary |
|----|----------|-------------|
| BR-010 | dental-billing | Tax stub (always 0) |
| BR-012 | dental-billing | Invoice state machine |
| BR-013 | dental-billing | No uncollectible status for dental invoices |
| BR-014 | dental-clinical, dental-visit | Consent required to complete visit |
| BR-015 | dental-patient | Patient contact deduplication |
| BR-016 | dental-org, dental-imaging | Imaging tier enforcement |
| BR-017 | dental-clinical | Dentist-only prescription rule |
| BR-018 | dental-clinical | Amendment approval workflow |
| BR-020 | dental-patient | Patient search/merge (501 stub) |
| BR-021 | dental-pmd | PMD checksum verification on import |
| BR-022 | dental-emr-integration, dental-pmd | PMD import creates read-only records |
| BR-036 | dental-imaging | Imaging finding state machine |

---

## Graph Statistics

| Metric | Value |
|--------|-------|
| workflow nodes referenced in WORKFLOW_MAP | 104 (WF-001..WF-104) |
| business_rule nodes (BUSINESS_RULES.md) | 47 (BR-001..BR-047) |
| api_endpoint nodes (OpenAPI dental ops) | 137 |
| handler files (all dental-* dirs) | 323 |
| MODULE_SPEC files | 11 (10 active + 1 deferred) |
| API_CONTRACTS files | 11 |
| state_machine nodes | 6 (Visit, Treatment, Invoice, ConsentForm, LabOrder, ImagingFinding SM-01, Ceph SM-02) |
| cross-module flows | 16 (WF-089..WF-104) |
| EVENT_CONTRACTS entries | 0 |
| WF→handler edges (covered) | 21/25 (84%) |
| BR→code citation edges | 23/47 (49%) |
| handler→OpenAPI coverage | 137/137 (100%) |

---

## Routing Recommendation

**State:** Phase B/C. No P0 gaps. 17 P1 gaps. Phase B→C boundary is passable.

**Before `/oli-vertical-slice-plan` (dental-patient):**
1. Add `// Enforces BR-NNN` to `CephMgmt_*.ts` handlers for BR-037..047 (30 min, resolves 11 P1 gaps)
2. Populate `EVENT_CONTRACTS.md` with 3 events: `appointment.reminder`, `audit.event.written`, `booking.slot.generated`
3. Backfill `dental-patient` MODULE_SPEC section 3 for 26 unspecced handlers
4. Fix `dental-perio` MODULE_SPEC section 3 (expand 1 → 6 operations)
5. Clarify `getAuditEvents` ownership (dental-org vs dental-audit)

**If P1 gaps accepted as known-risk:** Trace is clean enough to begin dental-patient slice execution.

**Skills:** `/oli-module-specs --module dental-patient`, `/oli-module-specs --module dental-perio`, `/typespec` for new endpoints

---

<!-- PRIOR RUN ARCHIVE: 2026-05-27 findings preserved below for diff reference -->
---

# Prior Run: 2026-05-27 (archived)

---

## Executive Summary

| Dimension | Findings |
|-----------|---------|
| Orphan BRs (5a) | 9 confirmed (BR-005 note: partially implemented; see below) |
| Broken chains (5b) | 4 confirmed |
| Unspecced implementations (5c) | 6 confirmed |
| Cross-module blind spots (5d) | 5 confirmed |
| Workflow coverage gaps (5e) | 14 confirmed (from WORKFLOW_MAP §14, partially traced to code) |
| Role enforcement gaps (5f) | 3 confirmed |
| E2E journey coverage (§9.2) | 7/10 mapped; 3 not matched by ID |
| Overall V1 readiness | **YELLOW** — core present, important gaps remain |

---

## 5a — Orphan Business Rules

BRs declared in IDEAL §5 or MODULE_SPECs with no confirmed downstream code reference.

### ORP-001 — PAT-BR-002: Minor patient guardian linkage (enforcement gap)

**Source:** IDEAL §5.1 PAT-BR-002 — "Minor patients should support guardian/contact linkage."
**Code:** `createPatientContact.ts` exists and references PAT-BR-002. Contact model has `isGuardian` flag.
**Gap:** No enforcement that a patient with `date_of_birth` indicating age < 18 *requires* a guardian contact before activation. Validation is available on the model but no handler enforces the age-gate rule server-side. The rule is structurally supported but not enforced.
**Classification:** Partially covered — structural support present, guard missing.

### ORP-002 — ENC-BR-002: Chief complaint required for new encounters

**Source:** IDEAL §5.3 ENC-BR-002 — chief complaint required unless administrative/non-clinical.
**Code:** `createDentalVisit.ts` accepts `chiefComplaint` but the field is passed optionally (line 35 shows it populated from body without a `required` validator). No 422 guard found for missing chief complaint.
**Classification:** NOT COVERED — V1 Required rule with no enforcement.

### ORP-003 — CHART-BR-001/002: Baseline chart layer separation

**Source:** IDEAL §5.4 CHART-BR-001/002 — baseline must be structurally separate from proposed/completed.
**Code:** `dental_chart` table uses a JSONB `teeth` column per MODULE_SPEC §7. No `layer` field (baseline/proposed/completed) found in schema. The chart is a single JSONB blob per visit, not a layered structure matching IDEAL entity `ChartLayer`.
**Classification:** NOT COVERED (structural) — V1 Required. The three-layer separation (baseline/proposed/completed) is absent at the data model level.

### ORP-004 — TP-BR-003/007: Treatment plan status transitions + patient approval

**Source:** IDEAL §5.5 TP-BR-003, TP-BR-007 — plan status transitions controlled; patient approval recorded with date/status.
**Code:** `dental-patient` has `createTreatmentPlan.ts`, `updateTreatmentPlan.ts`, `acceptTreatmentPlan.ts`. Module spec does not define a state machine for plan status. `acceptTreatmentPlan.ts` exists (PAT-S accept flow) suggesting partial coverage.
**Gap:** TP-BR-003 explicit state machine enforcement (draft→presented→approved→partially completed→completed→cancelled) not confirmed in MODULE_SPEC or handler comments. TP-BR-005 (completing one item must not auto-complete whole plan) has no documented enforcement point.
**Classification:** Partially covered — TP-BR-007 (accept action) present; TP-BR-003 state machine and TP-BR-005 not confirmed enforced.

### ORP-005 — BILL-BR-004: Discounts require permission and reason

**Source:** IDEAL §5.7 BILL-BR-004.
**Code:** `applyDentalDiscount.ts` handler exists. MODULE_SPEC §7 lists `discount_reason` field on invoice.
**Gap:** No confirmed role check in `applyDentalDiscount.ts` that restricts discount to `dentist_owner` only (ROLE_PERMISSION_MATRIX shows "limited" for discounts). Handler existence confirmed; enforcement strength unverified.
**Classification:** Partially covered — audit required on permission gate.

### ORP-006 — CLAIM-BR-002/003: CDT + ICD-10 code support

**Source:** IDEAL §5.8 CLAIM-BR-002/003 — CDT codes required; ICD-10 linkage supported.
**Code:** `dental_treatment` schema has `cdt_code` and `icd10_code` fields. `createClaimDraft.ts` and `getClaimReadiness.ts` exist under dental-patient.
**Gap:** No fee schedule CDT code validation (enforces that CDT codes on treatments exist in the branch fee schedule before billing). `getClaimReadiness.ts` checks readiness but the ICD-10 linkage path from treatment → claim line is unconfirmed end-to-end.
**Classification:** Partially covered.

### ORP-007 — ATT-BR-003/004: Attachment metadata + visit/procedure linkage

**Source:** IDEAL §5.9 ATT-BR-003/004.
**Code:** `createAttachment.ts` under dental-clinical. MODULE_SPEC §7 defines `dental_attachment` with `image_type_enum`.
**Gap:** `AttachmentLink` entity (IDEAL §6.8) — a separate join table for linking attachments to visit, tooth, procedure, or claim — is not in MODULE_SPEC schema. The `dental_attachment` record has `visit_id` but no `tooth_fdi` or `treatment_id` link. ATT-BR-003 (optional links to tooth/procedure) is structurally absent.
**Classification:** Partially covered — patient+visit link present; tooth/procedure link absent.

### ORP-008 — LF-BR-001/002: Local IDs stable; local→server mapping

**Source:** IDEAL §5.10 LF-BR-001/002 — offline-created records must have stable local IDs; mapping must not break references.
**Code:** `createSyncLog.ts`, `listSyncLogs.ts`, `updateSyncLog.ts` exist. `sync-log-validators.ts` has `localId` field.
**Gap:** SyncLog is a metadata store only — it records sync state but does NOT enforce that all entity creation endpoints accept a `localId` parameter for offline-originated records. No evidence that `createDentalVisit`, `createDentalTreatment`, or `createDentalPatient` accept a client-supplied `localId`. The IDEAL §4.6 offline workflow requires this: "local ID maps to persisted/server ID later." If the server ignores client-supplied IDs, the local→server mapping chain is broken.
**Classification:** Partially covered — sync log infrastructure exists; entity-level localId acceptance unconfirmed.

### ORP-009 — AUD-BR-004: Audit log includes before/after or reason

**Source:** IDEAL §5.11 AUD-BR-004.
**Code:** `audit_event` schema in dental-audit has `actor_id`, `action`, `resource_id`, `timestamp`. No `before_state` or `after_state` field in MODULE_SPEC §7.
**Gap:** Before/after state capture for clinical mutations (e.g., treatment status change, note amendment) is not in the audit schema. The G-005 known gap (PHI in auth logs) is a related issue. The `reason` field is present on void/void-payment but not a general audit field.
**Classification:** Partially covered — basic audit present; before/after absent (V1 Required per IDEAL).

---

## 5b — Broken Chains

Downstream code/test nodes that lack a clear upstream spec anchor.

### BRK-001 — dental-clinical directly imports VisitRepository (G-003)

**Modules:** dental-clinical → dental-visit
**Evidence:** MODULE_SPEC dental-clinical §1 explicitly flags: "KNOWN COUPLING RISK (G-003): Imports `VisitRepository` directly from dental-visit — must be refactored to service interface in Wave G1."
**Impact:** Cross-module repo import breaks the aggregate boundary. Any refactor of dental-visit's repo interface will silently break dental-clinical handlers. `WF-093` in WORKFLOW_MAP §12 marks this as "Broken."
**Status:** Known, not yet fixed (Wave G1 planned). No test verifies the interface contract — if the repo changes, the breakage is silent.

### BRK-002 — DE-019 consumer mismatch (dental-clinical vs EVENT_CONTRACTS)

**Evidence:** EVENT_CONTRACTS §4 consumer table lists `dental-clinical` as subscriber to DE-019 (`ImagingFindingConfirmed`). dental-clinical MODULE_SPEC §10b lists DE-002 (`VisitCompleted`) as consumed but does NOT list DE-019. dental-imaging MODULE_SPEC §10b lists DE-019 as published but dental-clinical has no corresponding handler file for this event.
**Impact:** Safety floor is supposed to aggregate confirmed imaging findings (per dental-patient MODULE_SPEC §7 "Aggregated at query time from allergies/medications/conditions"). If DE-019 consumer is absent, confirmed imaging findings never flow into the safety floor.

### BRK-003 — WF-096 audit trail: no pg-boss consumer confirmed

**Evidence:** WORKFLOW_MAP §12 lists WF-096 as "Async (pg-boss) — Audit trail on every write." dental-audit MODULE_SPEC §3 states "WF-096: Write audit event (async, all modules via pg-boss on every write operation)." The handler directory for dental-audit contains only `getAuditEvents.ts` and `audit.test.ts` and `repos/` — no pg-boss consumer registration file found.
**Impact:** If no pg-boss worker subscribes to the dental audit job queue, audit events are enqueued but never consumed — audit log is silently empty. This is a V1 Required gap (AUD-BR-001).

### BRK-004 — dental-perio MODULE_SPEC §7 uses FK to dental_visits but dental-visit aggregate boundary forbids external FKs

**Evidence:** dental-perio MODULE_SPEC §7 defines `visitId UUID FK → dental_visits.id (CASCADE)`. dental-visit MODULE_SPEC §7b states "External refs by ID: Invoice (dental-billing), PMDDocument (dental-pmd), ImagingStudy (dental-imaging — UUID ref only)." dental-imaging uses UUID-only (no FK) by design. dental-perio's schema uses a hard CASCADE FK, inconsistent with the loose-coupling pattern applied to other modules.
**Impact:** If dental-visit migrates its table name or PK structure, dental-perio FK CASCADE will fire destructively. Inconsistency in boundary enforcement.

---

## 5c — Unspecced Implementations

Significant code doing real work with no MODULE_SPEC declaration covering it.

### UNS-001 — dental-scheduling: QueueItem entity (createQueueItem, updateQueueItemStatus, listQueueBoard)

**Evidence:** `createQueueItem.ts`, `updateQueueItemStatus.ts`, `listQueueBoard.ts` exist under dental-scheduling. dental-scheduling MODULE_SPEC §8 explicitly notes "QueueItem state naming deviation (IDEAL-GAP-P2-011)" but does NOT declare QueueItem as an owned entity in §7 (Data Requirements) or §7b (Aggregate Boundaries). MODULE_SPEC says "no standalone `dental_queue_item` table exists; queue state is derived from appointment + visit status" — but handlers for a queue item entity exist.
**Impact:** Implementation contradicts spec. Either the spec is stale (table was added) or the handlers create a ghost entity not governed by any spec.

### UNS-002 — dental-clinical: Inventory management (createInventoryItem, createInventoryAdjustment, listInventoryItems)

**Evidence:** `createInventoryItem.ts`, `createInventoryAdjustment.ts`, `listInventoryItems.ts`, `updateInventoryItem.ts`, `listInventoryAdjustments.ts` exist under dental-clinical. dental-clinical MODULE_SPEC makes zero mention of inventory. IDEAL §3.11 defines inventory as a separate "Inventory/Materials Context" — not dental-clinical.
**Impact:** Inventory logic is mishoused under dental-clinical with no spec coverage. Boundary violation — inventory belongs in a separate module or dental-org.

### UNS-003 — dental-clinical: Occlusion screening (createOcclusionScreening, listOcclusionScreenings)

**Evidence:** `createOcclusionScreening.ts`, `listOcclusionScreenings.ts` under dental-clinical. dental-clinical MODULE_SPEC does not declare occlusion screening as a workflow or data entity.
**Impact:** IDEAL §3.4 lists OcclusionScreening as a V1 Recommended entity, but the implementing module (dental-clinical) has no spec declaration for it.

### UNS-004 — dental-clinical: Post-op templates (createPostopTemplate, listPostopTemplates, updatePostopTemplate)

**Evidence:** `createPostopTemplate.ts`, `listPostopTemplates.ts`, `updatePostopTemplate.ts` under dental-clinical. Not in MODULE_SPEC.
**Impact:** Unspecced feature. IDEAL §3.12 mentions "Post-op instructions" as V1 Recommended under Communication & Follow-up — not under clinical records.

### UNS-005 — dental-patient: Claim draft, insurance, claim readiness (createClaimDraft, createInsuranceProfile, getClaimReadiness, listPatientClaims, updateClaimStatus)

**Evidence:** Multiple claim-related handlers under dental-patient. dental-patient MODULE_SPEC §1 In Scope does not list claims/insurance. dental-billing MODULE_SPEC §1 In Scope also does not list claims.
**Impact:** Claims functionality is implemented but owned by no module spec. IDEAL §3.9 defines Claims/Insurance as its own context. No MODULE_SPEC for claims exists.

### UNS-006 — emr/ handlers using consultation model (createConsultation, finalizeConsultation, listEMRPatients)

**Evidence:** `services/api-ts/src/handlers/emr/` contains `createConsultation.ts`, `finalizeConsultation.ts`, `getConsultation.ts`, `listConsultations.ts`, `listEMRPatients.ts`, `updateConsultation.ts`. dental-emr-integration MODULE_SPEC explicitly states: "Implementation status: Future phase (Phase 3+). No handler directory exists."
**Impact:** Handler directory exists and has substantive consultation handlers contradicting the spec's explicit "do not implement" directive. Either the spec is wrong or the implementation is unauthorized.

---

## 5d — Cross-Module Blind Spots

Module interactions not captured in any contract/spec (MODULE=GLOBAL).

### XMD-001 — dental-billing "own patients only" for dentist_associate: no DB enforcement

**Evidence:** ROLE_PERMISSION_MATRIX §Billing: "dentist_associate: Own patients only" for create invoice, issue invoice, create payment plan. dental-billing MODULE_SPEC §6 Permissions echoes this. ROLE_PERMISSION_MATRIX §Gaps explicitly flags: "Associate 'own patients' definition not enforced at DB level — verified by membership check only."
**Impact:** An associate can create an invoice for any patient in the branch via API — no data-layer filter exists. Cross-module blind spot: neither dental-billing nor dental-org defines what "own patients" means in query terms.

### XMD-002 — dental-pmd snapshot excludes lab orders and imaging studies

**Evidence:** dental-pmd MODULE_SPEC §7.1 explicitly excludes lab orders ("not yet in snapshot scope") and imaging studies ("separate export flow"). EVENT_CONTRACTS DE-017 `PMDGenerated` is consumed by `notifs`. But the IDEAL §4.1 and §4.2 workflows expect a portable record covering clinical work done in a visit.
**Impact:** A dentist generates a PMD that lacks lab order results and imaging study references. A patient who requests their record via PMD gets an incomplete portable document. No spec defines what the separate imaging export flow is or when it converges with PMD.

### XMD-003 — dental-visit carry-over creates new treatment rows without billing notification

**Evidence:** WORKFLOW_MAP §12 WF-094: "Carry-over treatment display — dental-visit → dental-visit (prev visits), Async query, treatmentIds with status=planned." dental-visit MODULE_SPEC BR-008 states carry-over creates new `dental_treatment` rows with `carriedOver=true`. These new rows have status=`diagnosed` and are not billed until `performed`.
**Impact:** No domain event is published when carry-over treatments are created (DE-004 TreatmentDiagnosed exists, but BR-008 notes these are carry-over rows — it is unclear if DE-004 fires for them). dental-billing subscribes to DE-004 for "charge staging" — if carry-over treatments silently appear without triggering DE-004, billing staging is incorrect.

### XMD-004 — G-005 PHI in audit logs: no cross-module remediation plan

**Evidence:** dental-audit MODULE_SPEC §5 states "G-005 gap: PHI currently logged in auth handlers — must fix in Wave G1." dental-org has `DentalMembershipManagement_setPin.ts`, `DentalMembershipManagement_verifyPin.ts` which handle sensitive auth operations. No MODULE_SPEC for dental-org or dental-audit defines which specific fields are at risk or which handlers emit PHI.
**Impact:** HIPAA violation risk — PHI in audit logs. No cross-module remediation spec defines the fix scope (which handlers, which fields).

### XMD-005 — notifs module subscriptions to billing events (DE-007, DE-008) have no implementation trace

**Evidence:** EVENT_CONTRACTS §4 lists `notifs` as subscriber to DE-007 (InvoiceCreated) and DE-008 (InvoicePaid). dental-billing MODULE_SPEC §4 WF-013 step 5 says "Patient notified via email (notifs module)." No notifs handler file or pg-boss worker for these billing events was found in the handler directories reviewed.
**Impact:** Invoice creation and payment confirmation emails are spec'd but the consumer implementation is unconfirmed. WORKFLOW_MAP §8 flags WF-082/WF-083 as "Unknown/Not found."

---

## 5e — Workflow Coverage Gaps

WORKFLOW_MAP §14 gaps traced to code presence/absence:

| Gap ID | WORKFLOW_MAP Description | Code Status | Priority |
|--------|--------------------------|-------------|----------|
| WFG-001 | BR-005 auto-discard | **PRESENT** — `updateDentalVisit.ts` lines 93–107 implement discard; WORKFLOW_MAP incorrectly marks as orphan (spec lag) | — |
| WFG-002 | Check-in partial failure recovery | NOT IMPLEMENTED — no compensating transaction or rollback handler | HIGH |
| WFG-003 | BR-001 concurrent visit: client recovery UX | NOT IMPLEMENTED — 409 returned but no frontend recovery path documented | MEDIUM |
| WFG-004 | Concurrent invoice creation for same visit | NOT IMPLEMENTED — no unique constraint or idempotency key | HIGH |
| WFG-005 | PMD generation SLA (sync vs async) | Sync (current) — `generatePMD.ts` is synchronous; feature flag `dental_pmd_async_generation: false` | MEDIUM |
| WFG-006 | GDPR patient erasure | NOT IMPLEMENTED — no erasure handler found; `archiveDentalPatient.ts` does not PHI-purge | HIGH |
| WFG-007 | Patient merge (BR-020) | NOT IMPLEMENTED — 501 stub only | HIGH |
| WFG-008 | BR-013 markUncollectible | NOT IMPLEMENTED — 501 stub; confirmed in dental-billing MODULE_SPEC | MEDIUM |
| WFG-009–013 | Notification flows (reminder, overdue, PMD ready, lab complete, booking confirm) | NOT IMPLEMENTED — no consumer workers found | LOW–MEDIUM |
| WFG-014 | Lab order + consent form search/list | PRESENT — `listLabOrders.ts`, `listConsentForms.ts` exist; gap is in frontend UI only | LOW |

**Additional gap not in WORKFLOW_MAP §14:**

| Gap | Description | Priority |
|-----|-------------|----------|
| WFG-015 | Walk-in flow (WF-003 analog at visit level): No frontend route `walk-in.spec.ts` maps to `checkInAppointment` without a prior appointment. The E2E spec `walk-in.spec.ts` exists but `BR-SCH-002` (bypass slot availability for walk-ins) frontend path is untested in backend unit tests. | MEDIUM |

---

## 5f — Role Coverage Gaps

ROLE_PERMISSION_MATRIX roles with missing or unconfirmed enforcement code.

### RCG-001 — staff_scheduling cannot check in: not enforced in checkInAppointment handler

**Source:** ROLE_PERMISSION_MATRIX: "Check-in: staff_full, dentist_owner, dentist_associate (Not staff_scheduling)." dental-scheduling MODULE_SPEC §6: "Check-in: staff_full, dentist_owner, dentist_associate | Not staff_scheduling."
**Gap:** `checkInAppointment.ts` uses `assertBranchRole` but the exact role list passed is unverified. If `staff_scheduling` is inadvertently included (or if only "any member" is checked), the role gate is bypassed.
**Required test:** AC-SCH role denial test for `staff_scheduling` attempting check-in.

### RCG-002 — Platform admin impersonation has no break-glass audit trail

**Source:** ROLE_PERMISSION_MATRIX §Gaps: "Admin role can impersonate — no break-glass audit trail specified" (P1).
**Gap:** The `admin` Better-Auth role has `user:impersonate` capability. No audit event (DE-series) covers impersonation start/end. An admin acting as a dentist would emit audit events with the impersonated user's `actor_id` — the original admin identity is lost.

### RCG-003 — dentist_associate "own patients only" billing: no enforcement

**Source:** ROLE_PERMISSION_MATRIX §Billing, dental-billing MODULE_SPEC §6.
**Gap:** (Same as XMD-001 — restated here for completeness.) No DB-level or service-level filter enforces `dentist_associate` invoice scope to own patients. An associate can invoice any patient in the branch.

---

## §4 Core E2E Workflows — IDEAL Standard Trace (4.1–4.6)

### 4.1 New Patient → First Visit → Baseline Chart → Treatment Plan

| Step | Code | E2E Test | Status |
|------|------|----------|--------|
| Register patient | `createDentalPatient.ts` | `patient-registration.spec.ts` | Covered |
| Add medical alerts | `createDentalAlert.ts` | `safety-floor.spec.ts` | Covered |
| Create appointment or walk-in | `createAppointment.ts` | `patient-checkin.spec.ts` | Covered |
| Check in | `checkInAppointment.ts` | `patient-checkin.spec.ts` | Covered |
| Capture chief complaint | `createDentalVisit.ts` (field present, not required — ORP-002) | journey 01 | Partially covered |
| Create baseline chart | `upsertDentalChart.ts` | `journeys/01-new-patient-exam.journey.spec.ts` | Covered |
| Add diagnoses | `createDentalTreatment.ts` | journey 01 | Covered |
| Create proposed work | `createDentalTreatment.ts` (status=diagnosed) | journey 01 | Covered |
| Present estimate | `getTreatmentPlan.ts` | journey 01 | Covered |
| Approve / defer | `acceptTreatmentPlan.ts` | `journeys/09-plan-versioning.journey.spec.ts` | Covered |

**Gap:** Chief complaint required guard (ENC-BR-002) not enforced — see ORP-002.

### 4.2 Existing Patient → Same-Day Treatment → Billing → Recall

| Step | Code | E2E Test | Status |
|------|------|----------|--------|
| Search patient | `listDentalPatients.ts` | `returning-patient-visit.spec.ts` | Covered |
| Open timeline/chart | `getDentalVisit.ts`, `getDentalChart.ts` | ipad-workspace.spec.ts | Covered |
| Start encounter | `createDentalVisit.ts` | returning-patient-visit.spec.ts | Covered |
| Record work done | `updateDentalTreatment.ts` (performed) | journeys/04-revenue-chain | Covered |
| Link to approved plan | `acceptTreatmentPlan.ts` flow | journeys/06-phased-plan | Covered |
| Create invoice | `createDentalInvoice.ts` | `billing.spec.ts` | Covered |
| Record payment | `recordDentalPayment.ts` | billing.spec.ts | Covered |
| Schedule recall | `createRecall.ts` | (no dedicated recall E2E spec) | **GAP** |

**Gap:** No E2E test for recall scheduling step (IDEAL §4.2 V1 Required).

### 4.3 Emergency Walk-in

| Step | Code | E2E Test | Status |
|------|------|----------|--------|
| Create/find patient | `createDentalPatient.ts` / `listDentalPatients.ts` | `walk-in.spec.ts` | Covered |
| Walk-in visit | `createDentalVisit.ts` (walk_in=true path) | walk-in.spec.ts | Covered |
| Chief complaint | See ORP-002 — not enforced | walk-in.spec.ts | Partially covered |
| Chart finding | `upsertDentalChart.ts` | walk-in.spec.ts | Covered |
| Same-day treatment | `createDentalTreatment.ts` | walk-in.spec.ts | Covered |
| Billing | invoice flow | `billing-queue-morgan.spec.ts` | Covered |
| Follow-up | `createTask.ts` / `createRecall.ts` | No E2E spec | **GAP** |

### 4.4 Treatment Plan → Partial Completion

| Step | Code | E2E Test | Status |
|------|------|----------|--------|
| Open plan | `getTreatmentPlan.ts` | journeys/06 | Covered |
| Select item | Frontend only | journeys/06 | Covered |
| Complete item | `updateDentalTreatment.ts` status=performed | journeys/06 | Covered |
| Keep remaining active | TP-BR-005 logic | journeys/06 | Covered (INFERRED) |
| Update plan status | `updateTreatmentPlan.ts` | journeys/06 | Covered |
| Bill completed items | `createDentalInvoice.ts` (BR-009 filter) | journeys/04-revenue-chain | Covered |

**Note:** TP-BR-005 (completing one item must not auto-complete whole plan) coverage is inferred from journey test name; explicit unit test unconfirmed.

### 4.5 Imaging Attachment Workflow

| Step | Code | E2E Test | Status |
|------|------|----------|--------|
| Capture/upload image | `ImagingMgmt_createImagingStudy.ts` | `ipad-imaging.spec.ts` | Covered |
| Categorize | `study_type` enum | ipad-imaging.spec.ts | Covered |
| Link to patient | `patient_id` UUID ref | ipad-imaging.spec.ts | Covered |
| Link to tooth/visit/procedure | `tooth_fdi` nullable, `visit_id` absent on study model | `attachments.spec.ts` | **Partially covered** — visit link absent (see ORP-007) |
| Preview | frontend imaging viewer | ipad-imaging.spec.ts | Covered |
| Use for claim readiness | `getClaimReadiness.ts` | No imaging→claim E2E | **GAP** |

### 4.6 Offline-Ready Clinical Workflow

| Step | Code | E2E Test | Status |
|------|------|----------|--------|
| Start local record | `createSyncLog.ts` (localId accepted) | `journeys/15-offline-sync-metadata.journey.spec.ts` | Partially covered |
| Show sync status | frontend `listSyncLogs.ts` consumer | journey 15 | Partially covered |
| Preserve local changes | Client-side (Cadence/CRDT — not yet activated) | journey 15 | **GAP** — Cadence stub only (CLAUDE.md known gap) |
| Reconcile server ID | No entity-level `localId` acceptance confirmed (ORP-008) | journey 15 | **GAP** |
| Conflict-safe update | Cadence not activated end-to-end | journey 15 | **NOT IMPLEMENTED** |

---

## §5 Business Rule Registry — IDEAL Standard Trace

Coverage against all 50+ BRs across 11 registries (§5.1–§5.11):

### 5.1 Patient Rules

| Rule | Status | Notes |
|------|--------|-------|
| PAT-BR-001 | Covered | `createDentalPatient.ts` validates required fields |
| PAT-BR-002 | Partially covered | Contact model present; age-gate enforcement absent (ORP-001) |
| PAT-BR-003 | Covered | `getDentalPatientSafetyFloor.ts` exists; DE-019 consumer gap (BRK-002) |
| PAT-BR-004 | Covered | `archiveDentalPatient.ts` soft-delete; no hard delete endpoint |
| PAT-BR-005 | Not implemented | 501 stub (BR-020) — V2 Deferred, acceptable |

### 5.2 Visit / Appointment Rules

| Rule | Status | Notes |
|------|--------|-------|
| APT-BR-001 | Covered | `createAppointment.ts` requires patient_id |
| APT-BR-002 | Covered | Visit status enum enforced via visit.schema.ts |
| APT-BR-003 | Covered | walk_in flag in appointment model |
| APT-BR-004 | Covered | BR-004 spec: appointment delete ≠ visit delete |
| APT-BR-005 | Covered | QueueItem / listQueueBoard exists (UNS-001 caveat) |

### 5.3 Clinical Encounter Rules

| Rule | Status | Notes |
|------|--------|-------|
| ENC-BR-001 | Covered | visit links patient_id, dentist_member_id, date |
| ENC-BR-002 | NOT COVERED | chief_complaint optional — ORP-002 |
| ENC-BR-003 | Covered | SOAP notes append-only, `createVisitNoteAddendum.ts` |
| ENC-BR-004 | Covered | Safety floor on workspace load |
| ENC-BR-005 | Covered | No specialty templates required for general dentistry |

### 5.4 Dental Charting Rules

| Rule | Status | Notes |
|------|--------|-------|
| CHART-BR-001 | NOT COVERED | Baseline not structurally separate — ORP-003 |
| CHART-BR-002 | NOT COVERED | Single JSONB chart per visit — ORP-003 |
| CHART-BR-003 | Covered | tooth_fdi, status, date, created_by in treatment schema |
| CHART-BR-004 | Covered | surface enum validation in dental-visit |
| CHART-BR-005 | Covered | chart linked to visit and patient |
| CHART-BR-006 | NOT COVERED | No layer separation in data model — ORP-003 |
| CHART-BR-007 | Covered | `getToothHistory.ts` exists |
| CHART-BR-008 | Covered | Pediatric dentition (FDI 51–85) in initializeDentition |

### 5.5 Treatment Plan Rules

| Rule | Status | Notes |
|------|--------|-------|
| TP-BR-001 | Covered | treatment plan linked to patient, provider |
| TP-BR-002 | Covered | treatment_plan item has procedure, fee, status |
| TP-BR-003 | Partially covered | Status transitions present; full state machine unconfirmed — ORP-004 |
| TP-BR-004 | Covered | acceptTreatmentPlan handler |
| TP-BR-005 | Partially covered | No explicit enforcement confirmation — ORP-004 |
| TP-BR-006 | Covered | estimate shown in getTreatmentPlan response |
| TP-BR-007 | Covered | acceptTreatmentPlan captures approval |

### 5.6 Procedure / Work Done Rules

| Rule | Status | Notes |
|------|--------|-------|
| PROC-BR-001 | Covered | treatment has patient, provider, date, cdt_code |
| PROC-BR-002 | Covered | tooth_fdi validation present |
| PROC-BR-003 | Covered | treatment linked to visit_id |
| PROC-BR-004 | Covered | direct work (diagnosed state → performed without prior plan) allowed |
| PROC-BR-005 | Covered | performed treatments → billable (BR-009) |
| PROC-BR-006 | Covered | amendment model in dental-clinical (WF-038) |

### 5.7 Billing Rules

| Rule | Status | Notes |
|------|--------|-------|
| BILL-BR-001 | Covered | BR-009 enforced in createDentalInvoice |
| BILL-BR-002 | Covered | treatment_id FK on invoice line item |
| BILL-BR-003 | Covered | payment linked to invoice |
| BILL-BR-004 | Partially covered | applyDentalDiscount.ts exists; permission gate strength unconfirmed — ORP-005 |
| BILL-BR-005 | Covered | voidDentalInvoice.ts + voidDentalPayment.ts with reason required |
| BILL-BR-006 | Covered | outstanding_cents computed field on invoice |

### 5.8 Claims / Insurance Rules

| Rule | Status | Notes |
|------|--------|-------|
| CLAIM-BR-001 | Partially covered | getClaimReadiness.ts exists; end-to-end unconfirmed — ORP-006 |
| CLAIM-BR-002 | Covered | cdt_code on treatment schema |
| CLAIM-BR-003 | Covered | icd10_code on treatment schema |
| CLAIM-BR-004 | Partially covered | attachments exist but AttachmentLink to claim absent — ORP-007 |
| CLAIM-BR-005 | Deferred | Electronic submission — V2 acceptable |

### 5.9 Attachment Rules

| Rule | Status | Notes |
|------|--------|-------|
| ATT-BR-001 | Covered | dental_attachment has patient_id via visit |
| ATT-BR-002 | Covered | image_type_enum on attachment |
| ATT-BR-003 | Partially covered | visit link present; tooth/procedure link absent — ORP-007 |
| ATT-BR-004 | Covered | filename, mime_type, created_by fields present |

### 5.10 Local-First / Sync Rules

| Rule | Status | Notes |
|------|--------|-------|
| LF-BR-001 | Partially covered | SyncLog has localId; entity endpoints unconfirmed — ORP-008 |
| LF-BR-002 | Partially covered | Mapping infra present; entity-level localId not confirmed — ORP-008 |
| LF-BR-003 | Covered | listSyncLogs returns status enum |
| LF-BR-004 | NOT IMPLEMENTED | Cadence CRDT stub only (CLAUDE.md known gap) |
| LF-BR-005 | Deferred | V2 — acceptable |

### 5.11 Audit Rules

| Rule | Status | Notes |
|------|--------|-------|
| AUD-BR-001 | Partially covered | pg-boss consumer for audit not confirmed — BRK-003 |
| AUD-BR-002 | Partially covered | void/payment audit events present; before/after absent — ORP-009 |
| AUD-BR-003 | Partially covered | Access denied logging in assertBranchAccess; no confirmed test |
| AUD-BR-004 | Partially covered | actor/action/resource present; before/after absent — ORP-009 |

---

## §9.2 IDEAL E2E Test Journey Mapping (E2E-001..010)

| IDEAL ID | Journey | Mapped Spec File(s) | Status |
|----------|---------|---------------------|--------|
| E2E-001 | Register patient → book → check in → start encounter | `patient-registration.spec.ts`, `patient-checkin.spec.ts`, `journeys/01-new-patient-exam.journey.spec.ts` | Covered |
| E2E-002 | New patient → baseline chart → diagnosis → proposed plan | `journeys/01-new-patient-exam.journey.spec.ts` | Covered |
| E2E-003 | Approve plan → complete one item → plan partially completed | `journeys/06-phased-plan-sequencing.journey.spec.ts` | Covered |
| E2E-004 | Completed procedure → invoice → payment → receipt → balance | `journeys/04-revenue-chain.journey.spec.ts`, `billing.spec.ts` | Covered |
| E2E-005 | Walk-in emergency → diagnosis → direct work → billing → follow-up | `walk-in.spec.ts` (partial — no follow-up step confirmed) | Partially covered |
| E2E-006 | Upload attachment → link to patient/tooth/procedure → preview | `attachments.spec.ts`, `ipad-imaging.spec.ts` | Partially covered (tooth/procedure link absent — ORP-007) |
| E2E-007 | Front desk attempts to edit clinical chart → access denied | `auth-gates.spec.ts`, `role-gates-scheduling.spec.ts` | Covered |
| E2E-008 | Dentist edits/finalizes clinical note → audit log created | `journeys/10-void-amend-audit.journey.spec.ts` | Covered (audit consumer gap BRK-003 may make audit log empty) |
| E2E-009 | Offline/local record → sync metadata visible → references preserved | `journeys/15-offline-sync-metadata.journey.spec.ts` | Partially covered — Cadence not activated |
| E2E-010 | Patient with unpaid balance in dashboard/billing list | (no dedicated spec found for this exact scenario) | **NOT MATCHED** — no spec file identified |

---

## Summary of Critical Gaps (P0/P1)

| ID | Type | Description | Priority |
|----|------|-------------|----------|
| ORP-002 | Orphan BR | ENC-BR-002: Chief complaint not required server-side | P1 |
| ORP-003 | Orphan BR | CHART-BR-001/002/006: No baseline/proposed/completed layer separation in data model | P0 |
| ORP-008 | Orphan BR | LF-BR-001/002: Entity endpoints do not accept localId for offline records | P1 |
| BRK-001 | Broken chain | G-003: dental-clinical imports VisitRepository directly | P1 |
| BRK-002 | Broken chain | DE-019 consumer absent from dental-clinical — imaging findings don't reach safety floor | P1 |
| BRK-003 | Broken chain | No pg-boss audit consumer found — audit log may be silently empty | P0 |
| UNS-001 | Unspecced | QueueItem handlers implemented; MODULE_SPEC denies table exists | P1 |
| UNS-002 | Unspecced | Inventory handlers under dental-clinical; wrong module, no spec | P1 |
| UNS-005 | Unspecced | Claims/insurance handlers under dental-patient; no MODULE_SPEC owner | P1 |
| UNS-006 | Unspecced | emr/ consultation handlers exist; MODULE_SPEC says future phase only | P1 |
| XMD-001 | Cross-module | dentist_associate "own patients only" billing — no enforcement | P1 |
| XMD-004 | Cross-module | G-005 PHI in audit logs — no remediation spec defines scope | P1 |
| WFG-002 | Workflow gap | Check-in partial failure — no recovery path | HIGH |
| WFG-004 | Workflow gap | Concurrent invoice creation — no idempotency guard | HIGH |
| WFG-006 | Workflow gap | GDPR patient erasure — not implemented | HIGH/Legal |
| RCG-002 | Role gap | Admin impersonation has no audit trail | P1 |

---

_Generated: 2026-05-27_
_Skill: oli-trace | Algorithms: 5a–5f | Depth: exhaustive_
_Coverage: 11 modules, 98 workflows, 50+ BRs, 10 E2E journeys_
