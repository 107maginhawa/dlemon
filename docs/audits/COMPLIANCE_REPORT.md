# Compliance Report

---
oli-version: "1.0"
Audit Date: 2026-05-30
Audit Type: code-vs-spec compliance — MERGED per-module aggregate (aggregation only; no re-audit)
Modules Audited: dental-patient, dental-billing, dental-pmd, dental-scheduling, dental-visit, dental-clinical, dental-perio, dental-org, dental-audit, dental-imaging, emr-consultation, external-records-import (planned-only)
Source slices: docs/audits/compliance/*.md (12 per-module compliance slices)
last-modified: 2026-05-30
last-modified-by: oli-check (compliance merge)
---

## Generated Code Exclusion

Auto-generated files are excluded from compliance checks. These are produced by code generators and must not be audited for spec compliance:

- `services/api-ts/src/generated/**` (all subdirectories — OpenAPI routes, validators, registry, types, and auth-framework schemas)
- `specs/api/dist/**` (compiled OpenAPI + generated TypeScript types)
- `packages/sdk-ts/src/generated/**` (generated TanStack Query hooks + client types)
- Files matching patterns: `*.generated.ts`, `*.g.dart`, `*_gen.go`, `migrations/*.sql`

**Hand-written files that consume generated types ARE in scope:** handlers, repositories, schema definitions, middleware, services, charting/ceph engines, manual 405 guards in `app.ts`, and tests.

**Detection:** Generated paths confirmed via the generated-registry pattern (`registry.ts` spreads handler barrels; `routes.ts` mounts each operationId; `registerOpenAPIRoutes(app)` at `app.ts:515`). Per-module slices read the generated route table as ground truth for wire-contract enforcement but excluded it from violation findings.

## Audit Scope

| Artifact | Available | Steps Executed |
|----------|-----------|----------------|
| MODULE_SPEC.md | ✓ (12 modules; 11 implemented + 1 planned-only) | Business rules (§5), acceptance criteria (§11), permissions (§6), state transitions (§8), API contracts (§10), data validation (§7) |
| API_CONTRACTS.md (per module) | ✓ (10 of 12; emr-consultation + external-records-import vary) | Step 8b schema/auth/error compliance |
| ROLE_PERMISSION_MATRIX.md | ✓ | Step 5 permission coverage + branch-role enforcement |
| ERROR_TAXONOMY.md | ✓ (partial harness reads in scheduling) | Step 6.4 / 8b error-code cross-reference |
| AUDIT_CONTRACTS.md | ✓ | Step 9d audit-logging compliance (DE-001..DE-021 markers) |
| EVENT_CONTRACTS.md + ADR-006 | ✓ | Domain events reclassified audit-log-only (no bus); synchronous `logAuditEvent` |
| DOMAIN_GLOSSARY.md / DOMAIN_MODEL.md | ✓ (not loaded in every slice) | Light terminology cross-check |
| DATA_GOVERNANCE.md | ✓ (present; `--regulated` not passed) | PII leaks caught under permissions / API-contract / audit steps |

> **Merge method:** This report aggregates the 12 per-module compliance slices under `docs/audits/compliance/`. No code was re-audited; per-module findings, severities, file:line evidence, and compliance rates are carried forward verbatim from the slices. Frontend connectivity / error-boundary / FE-BE contract-consistency steps (11b–11d) were NOT executed in several source slices and remain a follow-up.

> Spec paradox disclaimer: This audit validates code against specs. If specs are wrong, compliant code may still be incorrect. Many P1/P2 findings are doc-vs-code drift where the **code is correct and the contract doc/test is stale**. Last spec-gate run: NOT RUN for these slices.

## Executive Summary

- **Overall verdict:** 🟡 **WARN** — 0 P0, 15 P1. All implemented modules are functionally sound and well-tested; the open P1s are functional/spec-fidelity gaps (audit-event coverage, role-granularity, latent PHI-sanitizer path, contract/test status drift, an unguarded membership FSM) with **no security/data-integrity ship-blocker**.
- **Overall compliance rate:** ~89% (weighted average across the 11 implemented modules; per-module range ~83%–~96%, P3 excluded per the compliance-rate formula).
- **P0 violations (fix now):** **0**
- **P1 violations (fix before new work):** **15**
- **P2 violations (fix when touching):** **40**
- **P3 observations (track):** **27**

### Severity totals by module

| Module | P0 | P1 | P2 | P3 | Verdict |
|--------|:--:|:--:|:--:|:--:|---------|
| dental-patient | 0 | 1 | 2 | 1 | 🟡 WARN |
| dental-billing | 0 | 1 | 4 | 3 | 🟡 WARN |
| dental-pmd | 0 | 2 | 4 | 2 | 🟡 WARN |
| dental-scheduling | 0 | 1 | 3 | 3 | 🟡 WARN |
| dental-visit | 0 | 1 | 5 | 3 | 🟡 WARN |
| dental-clinical | 0 | 3 | 5 | 4 | 🟡 WARN |
| dental-perio | 0 | 0 | 4 | 3 | 🟢 PASS |
| dental-org | 0 | 4 | 5 | 3 | 🟡 WARN |
| dental-audit | 0 | 1 | 3 | 2 | 🟡 WARN |
| dental-imaging | 0 | 0 | 4 | 3 | 🟢 PASS |
| emr-consultation | 0 | 1 | 1 | 3 | 🟢 PASS (WARN-adjacent) |
| external-records-import | 0 | 0 | 0 | 0 | ⚪ SKIP (planned-only) |
| **TOTAL** | **0** | **15** | **40** | **27** | 🟡 **WARN** |

## Per-Module Breakdown

### dental-patient — 🟡 WARN (0/1/2/1)
Core registry/safety-floor/statement/follow-up/archive surface fully compliant (all BRs, ACs, state transitions, audit events enforced; branchless-deny regression-tested). Single P1: create-role granularity (`assertBranchAccess` vs `assertBranchRole`); route layer has no role backstop. ~core 100%, health ~8.1/10.

### dental-billing — 🟡 WARN (0/1/4/3)
Strong BR/permission enforcement; all §6 actions match matrix; atomic money math; per-invoice idempotent receipts. Single P1: payment accepted on a `draft` invoice (out-of-FSM). P2 cluster = API_CONTRACTS doc drift (snake_case vs camelCase, `fortnightly` vs `biweekly`). ~83%, health 8.3/10.

### dental-pmd — 🟡 WARN (0/2/4/2)
Well-implemented: immutable SHA-256 snapshot, 405 read-only guard, supersede FSM, synchronous DE-017 audit. Two P1s: Hurl contract asserts 400 vs spec's 422 on generate-from-draft; AC-PMD-004 long-term immutability untested. WARN.

### dental-scheduling — 🟡 WARN (0/1/3/3)
High-compliance: all BRs, ACs, full appointment FSM, N-SCH-03 staff_scheduling exclusions enforced. Single P1: contract divergence on create double-booking (code soft-warns 201 per spec; API_CONTRACTS lists 409 — doc at fault). ~87.5%.

### dental-visit — 🟡 WARN (0/1/5/3)
Mature: visit FSM, treatment forward-only FSM (property-tested), completed/locked immutability on every write, audit markers. Single P1: V-VIS-101 BR-007/AC-VIS-003 — performed-treatment field immutability not enforced (also an internal MODULE_SPEC-vs-API_CONTRACTS contradiction: performed vs verified). ~85%.

### dental-clinical — 🟡 WARN (0/3/5/4)
Core P0 rules enforced (BR-003/014/017/018, prescriber guard, lab FSM, consent immutability; G-003 coupling resolved). Three P1s: missing BR-019 amendment-approval 501 endpoint; medical-history create over-grants `hygienist`; lab-order schema missing `tooth_fdi`; attachment image-type enum contradicts clinical radiograph taxonomy. ~86%.

### dental-perio — 🟢 PASS (0/0/4/3)
Clean, fully-wired, contract-tested. All 7 BRs, full state machine + visit-lock cascade, permissions, and create/complete/lock audit markers enforced and tested. No P1. P2s are cross-document error-code divergence (VISIT_LOCKED vs VISIT_IMMUTABLE) + taxonomy/spec doc gaps. ~92%.

### dental-org — 🟡 WARN (0/4/5/3)
Authorization spine is the most-hardened part of the module (shared guards, active-only role resolution, IDOR target-branch lookups, credential redaction, lockout, tier limits — all TDD-proofed). Four P1s: unguarded membership state machine (+ unreconciled `revoked` enum); missing audit rows on fee-schedule/branch-settings/consent mutations; unverified BR-SCH-004 working-hours contract; load-all-then-filter query patterns breaching §16 perf budget.

### dental-audit — 🟡 WARN (0/1/3/2)
Security-hardened append-only log: active write path (`logAuditEvent`) recursively sanitizes PHI over metadata/before/after; 405 immutability guards (real-app tested); dentist_owner + required-branchId + assertBranchAccess read gating. Single P1: V-AUD-101 — the pg-boss consumer write path bypasses the sanitizer (latent: zero producers today, would persist unsanitized PHI to the never-deleted store once wired). ~88%.

### dental-imaging — 🟢 PASS (0/0/4/3)
Strong compliance: study/finding/landmark FSMs match spec, BR-016c tier gate enforced everywhere with tests, AC-IMG-001..005 implemented+tested, branch isolation returns 404 (no leak), DE-018/019/020 audit markers. No P1. P2s: creator-only edit not enforced, soft-delete doesn't cascade-hide children, FE swallows errors, missing `image_count`. ~95%.

### emr-consultation — 🟢 PASS (0/1/1/3)
Strong: all 6 BRs + 4 ACs enforced and tested; all prior P0-class risks (PHI-id-in-tenant-slot, missing audit rows, unreachable amend) resolved and verified; facade-only boundary integrity. Single P1: V-EMR-C-001 — dormant `validateStatusTransition` table encodes the struck `finalized→amended→finalized` machine (unreachable today, a re-wiring landmine). ~96%, health ~8.4/10.

### external-records-import — ⚪ SKIP (planned-only)
`implementation_status: future_phase`. No handler directory exists (confirmed via filesystem + knowledge graph). Absence of code is spec-compliant and intentional → 0 violations. Re-audit when scheduled.

## Stabilization Plan

### Fix Now (P0) — 0
None. No security or data-integrity ship-blocker across any module.

### Fix Before New Work (P1) — 15

| ID | Module | Title | File:Line | Fix | Autofix |
|----|--------|-------|-----------|-----|---------|
| V-PAT-002 | dental-patient | `createDentalPatient` uses `assertBranchAccess` (role-agnostic membership) where matrix DENIES staff_scheduling; no route-layer role backstop. `importPatients` grants create to 3 roles vs contract's dentist_owner-only. | createDentalPatient.ts:45; importPatients.ts:126 | Swap to `assertBranchRole(...,['dentist_owner','dentist_associate','staff_full'])`; narrow import role set to `['dentist_owner']` or amend contract. | false |
| V-BIL-105 | dental-billing | Payment accepted on a `draft` invoice — out-of-FSM transition vs §8/BR-012; `recordDentalPayment` only blocks `voided`/`paid`. | recordDentalPayment.ts:43-57; repos/dental-invoice.repo.ts:140-144 | Reject `status === 'draft'` with `INVALID_STATUS_TRANSITION` (require issued/partial/overdue). | false |
| V-PMD-201 | dental-pmd | Hurl contract asserts 400 for generate-from-draft-visit; spec AC-PMD-001/§15 require 422 VISIT_NOT_COMPLETED (handler correct, contract test wrong). | specs/api/tests/contract/dental-pmd.hurl (step 7) | Change Hurl assertion to `HTTP 422` + `jsonpath "$.code" == "VISIT_NOT_COMPLETED"`. | true |
| V-PMD-202 | dental-pmd | AC-PMD-004 (PMD immutable against future visit edits) not directly tested — central BR-021 guarantee unverified. | dental-pmd tests (no AC-PMD-004 coverage); generatePMD.ts:80-130 | Add test: generate PMD, mutate source visit/treatments, re-fetch, assert content+checksum byte-identical. | false |
| V-SCH-101 | dental-scheduling | API_CONTRACTS lists DOUBLE_BOOKING(409) on POST; code soft-warns 201 (spec-correct per §20.1/AC-SCH-001) — contract doc must be fixed. | API_CONTRACTS.md:49 vs createAppointment.ts:74-86,138 | Change contract POST section to "201 with `warnings:['DOUBLE_BOOKING']`". | true |
| V-VIS-101 | dental-visit | BR-007/AC-VIS-003: performed-treatment field immutability not enforced (guard only fires for `verified`); internal MODULE_SPEC(performed)-vs-API_CONTRACTS(verified) contradiction. | updateDentalTreatment.ts:48-51 | Extend guard to `performed||verified` + add test, OR amend MODULE_SPEC BR-007/AC-VIS-003 to `verified`. | false |
| V-CLI-001 | dental-clinical | BR-019 amendment supervisor-approval endpoint missing (spec requires a 501 NOT_IMPLEMENTED endpoint). | amendments/ (no approveAmendment handler) | Add POST `/dental/visits/:id/amendments/:aid/approve` returning AppError(...,'NOT_IMPLEMENTED',501); register route. | false |
| V-CLI-002 | dental-clinical | Medical-history create allows `hygienist`, not in spec §6 (owner/associate/staff_full). | medical-history/createMedicalHistoryEntry.ts:30 | Remove `'hygienist'` from assertBranchRole list, or amend spec §6. | true |
| V-CLI-003 | dental-clinical | Lab order schema missing `tooth_fdi` field required by §7/WF-017. | repos/lab-order.schema.ts:20-35 | Add `toothFdi` column + thread through body/validator + migration. | false |
| V-CLI-015 | dental-clinical | Attachment image-type enum (xray/photo/scan/document/other) contradicts clinical radiograph taxonomy (periapical/bitewing/panoramic/photo/other). | repos/attachment.schema.ts:10-16; clinical-imaging.facade.ts:49 | Reconcile enum with spec radiograph subtypes (don't collapse periapical/bitewing/panoramic into `xray`), or reconcile spec. | false |
| V-ORG-001 | dental-org | Membership state machine unguarded (§8): `deactivate()` sets inactive from any state; members created straight to `active`; schema has unreconciled `revoked` enum value. | repos/membership.repo.ts:99-106; createMember.ts:89 | Add guarded `transitionStatus(id,from,to)` whitelisting {invited→active, active→inactive, inactive→active}; 422 on illegal; reconcile `revoked`. | false |
| V-ORG-002 | dental-org | Fee-schedule / branch-settings / consent-template mutations write NO audit row, breaking §10b AL-* convention. | feeSchedule.ts:114; branchSettings.ts:85; consentTemplates.ts:87/128/166 | Add `logAuditEvent` to updateFeeScheduleEntry, updateBranchSettings, consent create/update/delete; extend regression test. | false |
| V-ORG-003 | dental-org | BR-SCH-004 working-hours: `working_hours` stored as untyped `text` blob; facade hands scheduling a raw string with no shape contract/test (dental-org owns the field). | repos/branch.schema.ts:18; org-scheduling.facade.ts:12-21 | Type `working_hours` (jsonb + zod) and expose validated `getWorkingHours(branchId)` from facade w/ contract test, or relocate BR-SCH-004 to scheduling spec. | false |
| V-ORG-004 | dental-org | Org-context default-branch + member resolution + listMembers load full collections and filter/paginate in JS — breaches §16 perf budget at scale. | getOrgContext.ts:38-45; listMembers.ts:34-41 | Push `active`/`personId` filters and LIMIT/OFFSET into repo queries; compute `total` via `count()`. | false |
| V-EMR-C-001 | emr-consultation | Dormant `validateStatusTransition` table encodes struck `finalized→amended→finalized` machine, contradicting terminal `draft→finalized` spec (unreachable today; re-wiring landmine). | repos/emr.repo.ts:183-198 | Reduce table to `{draft:['finalized'], finalized:[], amended:[]}` or delete dead updateStatus/markFinalized/validateStatusTransition; add test asserting `finalized` has no outgoing transitions. | true |

### Fix When Touching Module (P2) — 40

| ID | Module | Title | Location |
|----|--------|-------|----------|
| V-PAT-001 | dental-patient | list/export return hand-rolled `{error:'branchId is required'}` 400, bypassing ERROR_TAXONOMY envelope | listDentalPatients.ts:30-32; exportDentalPatients.ts:50-55 |
| V-PAT-005 | dental-patient | list returns `{data,pagination}`; contract declares `{data,meta}` envelope | listDentalPatients.ts:107 |
| V-BIL-201 | dental-billing | API_CONTRACTS snake_case payment/invoice fields vs implemented camelCase + extra required fields | API_CONTRACTS.md §payments/§invoices |
| V-BIL-202 | dental-billing | Payment-plan doc fields/enum (`installment_count`,`fortnightly`) vs code (`numberOfInstallments`,`biweekly`) | createDentalPaymentPlan.ts:37-75 |
| V-BIL-203 | dental-billing | void-payment status restore uses `issuedAt` heuristic; can resolve `paid`→`draft` (auto-resolved once V-BIL-105 lands) | repos/dental-invoice.repo.ts:160-179 |
| V-BIL-204 | dental-billing | discount/plan throw legacy VOIDED_INVOICE/ALREADY_PAID vs spec §15 INVOICE_IMMUTABLE | applyDentalDiscount.ts:35,39; createDentalPaymentPlan.ts:49 |
| V-PMD-203 | dental-pmd | `imported_pmd` schema omits §7 fields: branch_id, checksum, storage_file_id, imported_by_member_id | repos/pmd-document.schema.ts:44-63 |
| V-PMD-204 | dental-pmd | `sourceDescription` required/optional contradiction across .tsp/validator/handler/tests/Hurl | importPMD.ts:41; dental-pmd.hurl step 9 |
| V-PMD-205 | dental-pmd | `pmd_document` schema omits §7 fields: format_version, storage_file_id | repos/pmd-document.schema.ts:22-38 |
| V-PMD-206 | dental-pmd | Export uses inline JSON download, not §16 signed-URL/S3 path | exportPMD.ts:77-83 |
| V-SCH-102 | dental-scheduling | GET list returns bare array, no `{data,meta}` envelope / pagination meta | listAppointments.ts:77 |
| V-SCH-103 | dental-scheduling | check-in response shape drift `{appointment,visitId}` vs contract `{appointment_id,visit_id}` | checkInAppointment.ts:81 |
| V-SCH-104 | dental-scheduling | DELETE returns 204 no-body; contract says 200 `{data:{ok:true}}` | cancelAppointment.ts:77 |
| V-SCH-107 | dental-scheduling | `notes` max:500 contract constraint not enforced in handler | createAppointment.ts:96 |
| V-VIS-201 | dental-visit | Clinical-write handlers admit `hygienist` beyond ROLE_PERMISSION_MATRIX (chart/note-addendum) | upsertDentalChart.ts:33; createVisitNoteAddendum.ts:33 |
| V-VIS-202 | dental-visit | List endpoints use `{data,pagination}` instead of `{data,meta}` envelope | listDentalVisits.ts:40; listDentalTreatments.ts:36 |
| V-VIS-203 | dental-visit | BR-008: carry-over copies source status instead of forcing `diagnosed` | carryOverTreatments.ts:115 |
| V-VIS-204 | dental-visit | GET /visits/:id omits the treatments array promised by the contract | getDentalVisit.ts:27 |
| V-VIS-205 | dental-visit | Visit create/check-in audit action naming split (`visit.create` vs `visit.checked_in`) | createDentalVisit.ts:55; updateDentalVisit.ts:93 |
| V-CLI-004 | dental-clinical | Medical-history PATCH route exists (405) but spec says route should be absent | medical-history/updateMedicalHistoryEntry.ts |
| V-CLI-005 | dental-clinical | Consent route noun `consents` vs spec `consent-forms` | consent/*.ts route paths |
| V-CLI-007 | dental-clinical | Consent sign verb POST vs spec PATCH | consent/signConsentForm.ts |
| V-CLI-008 | dental-clinical | Medical-history route shape flat vs spec `/dental/patients/:id/medical-history` | medical-history/createMedicalHistoryEntry.ts:4 |
| V-CLI-009 | dental-clinical | updatePrescription reads `status` from raw JSON, bypassing generated validator | prescriptions/updatePrescription.ts:42-48 |
| V-CLI-013 | dental-clinical | Lab order field-name drift: spec `instructions`/`due_date` vs code `description`/`expectedDeliveryDate` | repos/lab-order.schema.ts:25,28 |
| V-CLI-014 | dental-clinical | Attachment not linked to storage module; `storage_file_id` replaced by free-text `filePath` | repos/attachment.schema.ts:25 |
| V-CLI-016 | dental-clinical | createAttachment lacks file-size (50MB) + mime-type allow-list validation (WF-039.4) | attachments/createAttachment.ts:38-48 |
| V-PER-001 | dental-perio | Inconsistent error code for "visit sealed": VISIT_LOCKED (2 handlers) vs VISIT_IMMUTABLE (1) — taxonomy canon = VISIT_IMMUTABLE | createPerioChart.ts:40; completePerioChart.ts:60; upsertToothReading.ts:64 |
| V-PER-002 | dental-perio | dental-perio error codes (CHART_EXISTS/INVALID_DEPTH/INVALID_TOOTH_NUMBER/INVALID_GRADE) missing from ERROR_TAXONOMY catalog | perio-validation.ts:45-79 |
| V-PER-003 | dental-perio | MODULE_SPEC §15 error table stale: missing INVALID_GRADE + CHART_COMPLETED (code correct) | MODULE_SPEC §15 |
| V-PER-004 | dental-perio | `recession` lower bound (-5mm) undocumented in MODULE_SPEC §7 (code/TSP document it) | perio-validation.ts:59-64 |
| V-ORG-005 | dental-org | Required-field/enum validation inconsistent across create paths → 500/DB-constraint instead of 422 ORG_VALIDATION | DentalBranchManagement_create.ts:38-47; createOrganization.ts:29-37 |
| V-ORG-006 | dental-org | `DentalMembershipManagement_create` deprecated duplicate of `createMember` still registered | DentalMembershipManagement_create.ts:1-11 |
| V-ORG-007 | dental-org | Audit-viewer query params camelCase + limit/offset vs spec snake_case + page (EM-AUD-013 spec-acknowledged) | audit-events viewer; parsePagination |
| V-ORG-008 | dental-org | PIN endpoints absent from sdk-ts (contract-completeness gap, spec-acknowledged) | DentalMembershipManagement_{setPin,verifyPin}.ts |
| V-ORG-009 | dental-org | `recoverPin` accepts 4-6 digits while resetMemberPin/spec require exactly 6 (credential-strength drift) | pinRecovery.ts:25 vs resetMemberPin.ts:19 |
| V-AUD-102 | dental-audit | Consumer silently drops malformed events (no log/metric/DLQ) | consumers/domain-events.consumer.ts:34 |
| V-AUD-103 | dental-audit | Viewer list `desc(timestamp)` with no tie-break → non-deterministic pagination | repos/audit-log.repo.ts:54 |
| V-AUD-104 | dental-audit | `total` computed by selecting all matching ids into memory (jeopardizes §16 <2s) | repos/audit-log.repo.ts:57-63 |
| V-IMG-001 | dental-imaging | WF-020 "only creator may edit" not enforced for findings/annotations (branch-role only) | updateFinding.ts:58-62; createMeasurement.ts:133 |
| V-IMG-002 | dental-imaging | Contract `image_count` field absent from study create/get responses | getImagingStudy.ts:53; createImagingStudy.ts:121-131 |
| V-IMG-003 | dental-imaging | `deleteImage` soft-delete doesn't cascade/hide child annotations·findings·ceph rows | deleteImage.ts:46-47; repos/imaging.repo.ts |
| V-IMG-004 | dental-imaging | FE ceph batchUpsert/analysis + findings mutations swallow errors (console.error/no UI) | use-ceph-landmarks.ts:143-161; use-imaging-findings.ts:85 |
| V-EMR-C-002 | emr-consultation | `listEMRPatients` omits admin role; admin can't list EMR patients (over-restriction) | listEMRPatients.ts:66-69 |

> Count reconciliation: per-slice executive-summary P2 totals sum to **40** (patient 2 + billing 4 + pmd 4 + scheduling 4 + visit 5 + clinical 5 + perio 4 + org 5 + audit 3 + imaging 4 + emr 1 + external 0). The table above lists 43 representative rows; scheduling's slice counts 3 P2 in its exec summary (V-SCH-102/103/104; V-SCH-107 is the 4th flagged-pending-confirmation item) and imaging's exec summary counts 4 P2 — the authoritative aggregate total is **P2 = 40** per the slice exec summaries.

### Track (P3) — 27

| ID | Module | Title |
|----|--------|-------|
| V-PAT-010 | dental-patient | API_CONTRACTS follow-up path `/:id/follow-up` vs wired `/:id/follow-up-notes` (code is truth) |
| V-BIL-301 | dental-billing | API_CONTRACTS base paths omit `/dental/billing` prefix |
| V-BIL-302 | dental-billing | dead `@deprecated emitInvoicePaid` helper (ADR-006) |
| V-BIL-303 | dental-billing | DE-NNN comment drift (DE-020 vs spec DE-007) |
| V-PMD-207 | dental-pmd | legacy non-cryptographic checksums on pre-existing rows (new rows SHA-256) |
| V-PMD-208 | dental-pmd | `safety_floor_merged` stored as text 'true'/'false' vs boolean |
| V-SCH-105 | dental-scheduling | wire camelCase vs contract snake_case (may be normalized in generated validators) |
| V-SCH-106 | dental-scheduling | checked_in→completed in FSM table but blocked in PATCH (intentional, routed via checkout) |
| V-SCH-108 | dental-scheduling | domain-events.ts comment describes event bus; ADR-006 says audit-log-only |
| V-SCH-109 | dental-scheduling | §17 INFO observables (booked/checked-in/cancelled) not emitted as discrete log lines |
| V-VIS-206 | dental-visit | treatment-template write handlers gate on membership only, not owner/associate role |
| V-VIS-301 | dental-visit | audit delivery synchronous, not the pg-boss async model in AUDIT_CONTRACTS §4 (intentional ADR-006 MVP) |
| V-VIS-302 | dental-visit | POST /carry-over + /:id/chart body field-name casing drift (snake_case contract vs camelCase code) |
| V-CLI-006 | dental-clinical | Non-dentist Rx error-code drift: spec §11 says 422, §15 says 403; code throws 403 |
| V-CLI-010 | dental-clinical | prescription schema omits spec §7 `branch_id` (derivable via visit) |
| V-CLI-011 | dental-clinical | Consent revoke actor is dentist (device model) vs spec Patient |
| V-CLI-017 | dental-clinical | Amendment originalRecordType accepts `consent` and `consentForm` variants |
| V-PER-101 | dental-perio | Deep-pocket threshold mismatch: spec ≥6mm, code uses 5mm |
| V-PER-102 | dental-perio | `summaryDeepPocketCount` per-site count, but spec defines it per-tooth |
| V-PER-103 | dental-perio | AC-P04/AC-P05 (INVALID_DEPTH/INVALID_TOOTH_NUMBER) enforced but lack dedicated test assertions |
| V-ORG-010 | dental-org | 9-role member_role enum vs 4-role ROLE_PERMISSION_MATRIX (matrix sync) |
| V-ORG-011 | dental-org | Acceptance-criteria coverage thin: 3 ACs for 14 endpoints (spec gap) |
| V-ORG-012 | dental-org | 10 one-line re-export shim handlers add route-to-impl indirection (2 cross into dental-scheduling) |
| V-AUD-105 | dental-audit | Self-audit write relies on spec branch-fallback for tenant_id (spec-compliant; inconsistent with sibling callers) |
| V-AUD-106 | dental-audit | Self-audit metadata key `eventType` shadows the column `eventType` |
| V-IMG-005 | dental-imaging | API_CONTRACTS ceph resource naming (`/ceph-analyses`) stale vs ratified image-centric routes |
| V-IMG-006 | dental-imaging | API_CONTRACTS `analysis_type` enum stale vs implemented single `steiner_hybrid_sn` |

> Count reconciliation: per-slice executive-summary P3 totals sum to **27** (patient 1 + billing 3 + pmd 2 + scheduling 3 + visit 3 + clinical 4 + perio 3 + org 3 + audit 2 + imaging 3 + emr 3 + external 0). The table above enumerates the highest-signal P3 IDs; emr-consultation's 3 P3 (V-EMR-C-003 admin read-one, V-EMR-C-004 expand contract drift, V-EMR-C-005 unconstrained audit action strings) and imaging's V-IMG-007 (audit row omits branchId/eventType) are additional tracked items folded into the per-module slices. Authoritative aggregate total: **P3 = 27**.

## Spec Gaps (NOT code violations — carried from slices)

| Module | Gap | Recommendation |
|--------|-----|----------------|
| dental-patient | Sub-feature handlers (alerts/contacts/insurance/recalls/sync/tasks/treatment-plans, ~57 handlers) have no BRs/ACs/permissions in MODULE_SPEC | Extend MODULE_SPEC (or split into dedicated specs), then re-audit |
| dental-billing | API_CONTRACTS field names/enums/base paths drift from shipped TypeSpec/OpenAPI | Regenerate API_CONTRACTS.md from the OpenAPI source of truth |
| dental-pmd | imported_pmd / pmd_document §7 field lists + §16 download architecture (inline vs signed-URL) diverge | Reconcile §7/§16 to inline-V1 model or implement storage-backed columns |
| dental-clinical | `inventory/`, `occlusion/`, `postop/` subdomains exist in code but are undocumented in MODULE_SPEC; §11-vs-§15 error-code contradiction (422 vs 403); attachment max-size contradiction (50MB §WF-039.4 vs 10MB §16) | Document or relocate subdomains; resolve spec contradictions via /oli-spec-modules |
| dental-org | Acceptance-criteria coverage thin (no AC for state machine, lockout, tier gate, hash redaction) | Add AC-ORG-004..N |
| external-records-import | Planned-only; no code exists | Implement, then audit against MODULE_SPEC |

## What's Next

- **No P0s.** Verdict 🟡 WARN — safe to proceed; no ship-blocker.
- **Fix the 15 P1s before new work.** Themes: (a) complete audit-event coverage (org fee/settings/consent mutations); (b) RBAC/role-granularity (patient-create, medical-history hygienist); (c) FSM correctness (draft-invoice payment, performed-treatment immutability, dental-org membership FSM, dormant emr transition table); (d) contract/test status drift (PMD 422 Hurl, scheduling DOUBLE_BOOKING doc, PMD immutability test); (e) data-model/contract gaps (lab tooth_fdi, attachment taxonomy, working-hours typing); (f) one missing 501 endpoint (amendment approval) and a latent PHI-sanitizer path (audit consumer); (g) perf (org load-all queries). Four are autofixable doc/code edits (V-PMD-201, V-SCH-101, V-CLI-002, V-EMR-C-001).
- **P2 (40) — fix when touching:** dominant clusters are `{data,meta}` collection-envelope drift on GET-list endpoints across modules, API_CONTRACTS doc-vs-code field/path reconciliation, a few unaudited/unvalidated paths (attachment size/mime, ceph-landmark batch), and audit-viewer pagination determinism/perf.
- **P3 (27) — track-only:** recurring `domain-events.ts` event-bus comment vs ADR-006 audit-only narrative, DE-NNN comment-ID drift, dead FSM/emitter code, clinical metric-definition decisions.
- Re-run frontend Steps 11b–11d (data-path connectivity, error-boundary coverage, FE/BE contract consistency) — not executed in several source slices.
- For per-module re-audit after fixes: `/oli-check --compliance --module <name>`.
