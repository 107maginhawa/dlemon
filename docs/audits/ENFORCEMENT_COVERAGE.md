# Enforcement Coverage Report — Run 6 Strict
<!-- oli-enforce-coverage --strict | generated: 2026-05-29 | run: run-6-strict-2026-05-29 -->

**Phase:** 0 — Breadth + Depth Gate (WARN if coverage < 40%)  
**Scope:** 11 modules × 22 spec sections  
**Date:** 2026-05-29

---

## Summary Table

| Module | Breadth% | Depth% | Coverage Score | Gate |
|--------|----------|--------|----------------|------|
| dental-audit | 50% | 41% | **41%** | WARN |
| dental-billing | 100% | 95% | **95%** | PASS |
| dental-clinical | 93% | 100% | **100%** | PASS |
| dental-emr-integration | 50% | 41% | **41%** | WARN |
| dental-imaging | 95% | 100% | **100%** | PASS |
| dental-org | 83% | 100% | **100%** | PASS |
| dental-patient | 85% | 100% | **100%** | PASS |
| dental-perio | 100% | 95% | **95%** | PASS |
| dental-pmd | 71% | 64% | **64%** | PASS |
| dental-scheduling | 83% | 91% | **91%** | PASS |
| dental-visit | 93% | 100% | **100%** | PASS |

> **Coverage Score = depth% (sections detailed / 22 × 100). Gate = WARN if < 40%, no module below threshold.**

---

## Overall Summary

| Metric | Value |
|--------|-------|
| Average coverage score | **84%** |
| Modules below 70% | dental-audit (41%), dental-emr-integration (41%) |
| Modules below 40% (hard gate) | 0 |
| Total ABSENT sections | 22 |
| Total STUB sections | 17 |
| Total findings (EC- IDs) | 34 |

---

## Per-Module Analysis

### dental-audit

**Handlers dir:** `services/api-ts/src/handlers/dental-audit/`  
**Handler files (non-test):** `getAuditEvents.ts`, `domain-events.consumer.ts` (2 total)  
**Breadth:** 50% — `domain-events.consumer.ts` is infra consumer with no spec coverage  
**Depth:** 41% (9/22 detailed)

| Section | Status | Notes |
|---------|--------|-------|
| §1 Overview | OK | Purpose, users, scope described |
| §2 Domain Terms | OK | Audit Event, Retention defined |
| §3 Workflows | OK | WF-AUD-001/002 listed |
| §4 Workflow Details | **ABSENT** | No per-workflow step detail |
| §5 Business Rules | STUB(2) | Only 2 lines: append-only + 7-year retention |
| §6 Permissions | STUB(2) | Role list only, no per-operation matrix |
| §7 Data Requirements | STUB(2) | 2 lines; no field table |
| §7b Aggregate Boundaries | STUB(2) | Single line only |
| §8 State Transitions | STUB(2) | "immutable, no transitions" — valid but stub |
| §9 UI/UX Requirements | **ABSENT** | No screen/component description |
| §10 API Expectations | OK | Endpoints listed |
| §10b Domain Events | STUB(2) | Header only, no event table |
| §11 Acceptance Criteria | OK | AC-AUD-001–003 present |
| §12 Test Expectations | **ABSENT** | No test strategy |
| §13 Edge Cases | **ABSENT** | No edge cases |
| §14 Dependencies | OK | Internal deps listed |
| §15 Error Handling | **ABSENT** | No error codes |
| §16 Performance | OK | p99 target present |
| §17 Observability | STUB(2) | 1 metric line only |
| §18 Feature Flags | **ABSENT** | No flags section |
| §19 Vertical Slice Plan | OK | Slices AUD-S1/S2 listed |
| §20 AI Instructions | OK | Implementation guidance present |

**Findings:**
- EC-AUD-001: §4 Workflow Details ABSENT — no step-by-step for WF-AUD-001/002
- EC-AUD-002: §9 UI/UX ABSENT — audit log viewer screen not described
- EC-AUD-003: §12 Test Expectations ABSENT — no unit/integration test strategy
- EC-AUD-004: §13 Edge Cases ABSENT — no concurrent write/tamper scenarios
- EC-AUD-005: §15 Error Handling ABSENT — no 403/404/rate-limit codes
- EC-AUD-006: §18 Feature Flags ABSENT — no flags section

---

### dental-billing

**Handlers dir:** `services/api-ts/src/handlers/dental-billing/`  
**Handler files (non-test):** 16 total (createDentalInvoice, issueDentalInvoice, voidDentalInvoice, getDentalInvoice, listDentalInvoices, recordDentalPayment, voidDentalPayment, listDentalPayments, createDentalPaymentPlan, getDentalPaymentPlan, updateDentalPaymentPlan, getDentalPaymentReceipt, applyDentalDiscount, getCollectionsSummary, getPatientBalance + util)  
**Breadth:** 100% — all handler operations covered by spec WFs  
**Depth:** 95% (21/22 detailed)

| Section | Status | Notes |
|---------|--------|-------|
| §7b Aggregate Boundaries | STUB(2) | Invoice/PaymentPlan root ownership not enumerated |
| All others | OK | 21 sections fully detailed |

**Findings:**
- EC-BIL-001: §7b Aggregate Boundaries STUB — Invoice/PaymentPlan aggregate root ownership not enumerated

---

### dental-clinical

**Handlers dir:** `services/api-ts/src/handlers/dental-clinical/`  
**Handler files (non-test):** 30 total  
**Breadth:** 93% — 2 utility/internal files not explicitly spec'd  
**Depth:** 100% (22/22 detailed)

No gap findings. Fully spec'd.

---

### dental-emr-integration

**Handlers dir:** `services/api-ts/src/handlers/emr/`  
**IDENTITY NOTE:** Spec module is `dental-emr-integration`; handler directory is `emr/`. Handler operations (createConsultation, finalizeConsultation, updateConsultation) describe mutable consultation CRUD; spec describes read-only import of external EMR records. **Architecturally misaligned.**  
**Handler files (non-test):** `createConsultation.ts`, `finalizeConsultation.ts`, `getConsultation.ts`, `listConsultations.ts`, `listEMRPatients.ts`, `updateConsultation.ts` (6 total)  
**Breadth:** 50% — createConsultation, finalizeConsultation, updateConsultation not implied by spec (spec says read-only after import)  
**Depth:** 41% (9/22 detailed)

| Section | Status | Notes |
|---------|--------|-------|
| §1 Overview | OK | Purpose described |
| §2 Domain Terms | OK | EMR Record, Import Source, Treatment History defined |
| §3 Workflows | OK | Import + view listed |
| §4 Workflow Details | **ABSENT** | No per-workflow step detail |
| §5 Business Rules | STUB(2) | 2 lines only |
| §6 Permissions | STUB(2) | Role list only |
| §7 Data Requirements | STUB(2) | 2 lines; no field table |
| §7b Aggregate Boundaries | STUB(2) | Single line |
| §8 State Transitions | STUB(2) | 2 lines only |
| §9 UI/UX Requirements | **ABSENT** | No screen description |
| §10 API Expectations | OK | Endpoints listed |
| §10b Domain Events | **ABSENT** | No events defined |
| §11 Acceptance Criteria | OK | AC-EMR-001/002 present |
| §12 Test Expectations | **ABSENT** | No test strategy |
| §13 Edge Cases | **ABSENT** | No duplicate-import/partial-import scenarios |
| §14 Dependencies | OK | Deps listed |
| §15 Error Handling | **ABSENT** | No import-failure error codes |
| §16 Performance | OK | Target present |
| §17 Observability | **ABSENT** | No import metrics |
| §18 Feature Flags | **ABSENT** | No flags section |
| §19 Vertical Slice Plan | OK | EMR-S1/S2 listed |
| §20 AI Instructions | OK | Guidance present |

**Findings:**
- EC-EMR-001: §4 Workflow Details ABSENT — no step-by-step for import workflow
- EC-EMR-002: §9 UI/UX ABSENT — EMR viewer/import screen not described
- EC-EMR-003: §10b Domain Events ABSENT — no events defined
- EC-EMR-004: §12 Test Expectations ABSENT — no test strategy
- EC-EMR-005: §13 Edge Cases ABSENT — no duplicate-import/partial-import scenarios
- EC-EMR-006: §15 Error Handling ABSENT — no import-failure error codes
- EC-EMR-007: §17 Observability ABSENT — no import metrics
- EC-EMR-008: §18 Feature Flags ABSENT — no flags section
- EC-EMR-009: IDENTITY GAP — spec=read-only import store; code=mutable consultation CRUD; dir `emr/` vs module `dental-emr-integration`; createConsultation/updateConsultation/finalizeConsultation not covered by spec

---

### dental-imaging

**Handlers dir:** `services/api-ts/src/handlers/dental-imaging/`  
**Handler files (non-test):** 42 total  
**Breadth:** 95% — 2 utility files not explicitly spec'd  
**Depth:** 100% (22/22 detailed)

No gap findings. Fully spec'd including v1.4 ceph extensions.

---

### dental-org

**Handlers dir:** `services/api-ts/src/handlers/dental-org/`  
**Handler files (non-test):** 36 total  
**Breadth:** 83% — PIN management handlers (setPin, verifyPin, resetMemberPin, recoverPin, pinRecovery, DentalMembershipManagement_setPin, DentalMembershipManagement_verifyPin) partially spec'd under membership; getDashboardSummary not in spec  
**Depth:** 100% (22/22 detailed)

No depth findings. Breadth gaps only:
- EC-ORG-001: `getDashboardSummary.ts` not referenced in §3 Workflows or §10 API
- EC-ORG-002: PIN management workflow (recoverPin, pinRecovery, resetMemberPin, setSecurityQuestion + 2 membership PIN handlers) not spec'd in §4 Workflow Details — 6 handlers without a spec workflow

---

### dental-patient

**Handlers dir:** `services/api-ts/src/handlers/dental-patient/`  
**Handler files (non-test):** 53 total (across alerts, contacts, engagement, identity, insurance, recalls, sync, treatment-plans subdirs)  
**Breadth:** 85% — `sync/` subdirectory and `treatment-plans/` subdirectory handlers overlap dental-visit/dental-scheduling scope  
**Depth:** 100% (22/22 detailed)

No depth findings. Breadth gaps only:
- EC-PAT-001: `sync/` subdirectory handlers not referenced in §3 Workflows or §10 API
- EC-PAT-002: `treatment-plans/` handlers under dental-patient duplicate dental-visit scope; cross-module ownership not resolved in §7b

---

### dental-perio

**Handlers dir:** `services/api-ts/src/handlers/dental-perio/`  
**Handler files (non-test):** 6 total (createPerioChart, upsertToothReading, completePerioChart, getVisitPerioChart, getPerioChart + 1)  
**Breadth:** 100% — all handlers covered by WF-P01–WF-P05  
**Depth:** 95% (21/22 detailed)

| Section | Status | Notes |
|---------|--------|-------|
| §20 AI Instructions | **ABSENT** | Not present in spec |
| All others | OK | 21 sections fully detailed |

**Findings:**
- EC-PER-001: §20 AI Instructions ABSENT — no implementation guidance for agents

---

### dental-pmd

**Handlers dir:** `services/api-ts/src/handlers/dental-pmd/`  
**Handler files (non-test):** `exportPMD.ts`, `generatePMD.ts`, `getImportedPMD.ts`, `getPMDForVisit.ts`, `importPMD.ts`, `listImportedPMDs.ts`, `listPMDs.ts` (7 total)  
**Breadth:** 71% — `exportPMD.ts` not referenced in spec workflows; `getImportedPMD.ts` only implied  
**Depth:** 64% (14/22 detailed)

| Section | Status | Notes |
|---------|--------|-------|
| §1 Overview | OK | Purpose described |
| §2 Domain Terms | OK | PMD, Checksum, ImportedPMD defined |
| §3 Workflows | STUB(2) | 2 lines: generate + import only; no WF table |
| §4 Workflow Details | **ABSENT** | No per-workflow step detail |
| §5 Business Rules | OK | BR-021/022 present |
| §6 Permissions | STUB(2) | Role list only |
| §7 Data Requirements | OK | §7.1 Data Scope + §7.2 Import Contract detailed |
| §7b Aggregate Boundaries | STUB(2) | Single line |
| §8 State Transitions | STUB(2) | 2 lines only |
| §9 UI/UX Requirements | OK | Screen descriptions present |
| §10 API Expectations | OK | Endpoints listed |
| §10b Domain Events | OK | Events listed |
| §11 Acceptance Criteria | OK | ACs present |
| §12 Test Expectations | OK | Test cases listed |
| §13 Edge Cases | OK | GDPR, checksum, version cases |
| §14 Dependencies | STUB(2) | 2 lines only |
| §15 Error Handling | STUB(2) | 2 lines only |
| §16 Performance | OK | Target present |
| §17 Observability | OK | Hooks present |
| §18 Feature Flags | STUB(2) | 2 lines only |
| §19 Vertical Slice Plan | OK | PMD-S1/S2 listed |
| §20 AI Instructions | OK | Guidance present |

**Findings:**
- EC-PMD-001: §3 Workflows STUB — no WF table; only 2-line mention
- EC-PMD-002: §4 Workflow Details ABSENT — no step-by-step for any workflow
- EC-PMD-003: §6 Permissions STUB — no per-operation role matrix
- EC-PMD-004: §7b Aggregate Boundaries STUB — PMD root ownership not enumerated
- EC-PMD-005: §8 State Transitions STUB — PMD lifecycle states not enumerated
- EC-PMD-006: §14 Dependencies STUB — only 2 lines; no dependency table
- EC-PMD-007: §15 Error Handling STUB — no error code enumeration
- EC-PMD-008: §18 Feature Flags STUB — no flag list

---

### dental-scheduling

**Handlers dir:** `services/api-ts/src/handlers/dental-scheduling/`  
**Handler files (non-test):** 12 total (bookAppointment, getAppointment, listAppointments, updateAppointment, cancelAppointment, checkInPatient, listQueueBoard, getQueueItem, rescheduleAppointment, noShowAppointment + queue-item-validators.ts + util)  
**Breadth:** 83% — `queue-item-validators.ts` is infra; `noShowAppointment` and `rescheduleAppointment` not covered by WF-006/WF-007  
**Depth:** 91% (20/22 detailed)

| Section | Status | Notes |
|---------|--------|-------|
| §7 Data Requirements | STUB(2) | 2 lines only; no field table for Appointment/QueueItem |
| §7b Aggregate Boundaries | STUB(2) | Single line |
| All others | OK | 20 sections fully detailed |

**Findings:**
- EC-SCH-001: §7 Data Requirements STUB — no field table for Appointment/QueueItem entities
- EC-SCH-002: §7b Aggregate Boundaries STUB — Appointment aggregate root not enumerated
- EC-SCH-003: `noShowAppointment.ts` not spec'd — no-show state transition absent from §3/§4
- EC-SCH-004: `rescheduleAppointment.ts` not spec'd — reschedule is a distinct workflow absent from §3

---

### dental-visit

**Handlers dir:** `services/api-ts/src/handlers/dental-visit/`  
**Handler files (non-test):** 28 total (across chart, notes, templates, treatment-plans, treatments, utils, visits subdirs)  
**Breadth:** 93% — 2 utility files not explicitly spec'd  
**Depth:** 100% (22/22 detailed)

No gap findings. Fully spec'd.

---

## All Findings (EC- Index)

| Finding ID | Module | Section | Status | Description |
|-----------|--------|---------|--------|-------------|
| EC-AUD-001 | dental-audit | §4 Workflow Details | ABSENT | No step-by-step workflow detail |
| EC-AUD-002 | dental-audit | §9 UI/UX | ABSENT | Audit log viewer screen not described |
| EC-AUD-003 | dental-audit | §12 Test Expectations | ABSENT | No test strategy |
| EC-AUD-004 | dental-audit | §13 Edge Cases | ABSENT | No concurrent-write/tamper scenarios |
| EC-AUD-005 | dental-audit | §15 Error Handling | ABSENT | No error codes |
| EC-AUD-006 | dental-audit | §18 Feature Flags | ABSENT | No flags section |
| EC-BIL-001 | dental-billing | §7b Aggregate Boundaries | STUB | Invoice/PaymentPlan root ownership not enumerated |
| EC-EMR-001 | dental-emr-integration | §4 Workflow Details | ABSENT | No step-by-step for import workflow |
| EC-EMR-002 | dental-emr-integration | §9 UI/UX | ABSENT | EMR viewer/import screen not described |
| EC-EMR-003 | dental-emr-integration | §10b Domain Events | ABSENT | No events defined |
| EC-EMR-004 | dental-emr-integration | §12 Test Expectations | ABSENT | No test strategy |
| EC-EMR-005 | dental-emr-integration | §13 Edge Cases | ABSENT | No duplicate-import scenarios |
| EC-EMR-006 | dental-emr-integration | §15 Error Handling | ABSENT | No import-failure error codes |
| EC-EMR-007 | dental-emr-integration | §17 Observability | ABSENT | No import metrics |
| EC-EMR-008 | dental-emr-integration | §18 Feature Flags | ABSENT | No flags section |
| EC-EMR-009 | dental-emr-integration | BREADTH | IDENTITY GAP | Spec=read-only import; code=mutable consultation CRUD; dir `emr/` vs module `dental-emr-integration` |
| EC-ORG-001 | dental-org | BREADTH | UNSPEC'D HANDLER | `getDashboardSummary.ts` not in spec workflows or API |
| EC-ORG-002 | dental-org | §4 Workflow Details | MISSING WF | PIN management flow (6 handlers) not spec'd in §4 |
| EC-PAT-001 | dental-patient | BREADTH | UNSPEC'D HANDLER | `sync/` subdirectory handlers not in spec |
| EC-PAT-002 | dental-patient | §7b Aggregate Boundaries | BOUNDARY GAP | treatment-plans handlers overlap dental-visit; ownership unclear |
| EC-PER-001 | dental-perio | §20 AI Instructions | ABSENT | No implementation guidance for agents |
| EC-PMD-001 | dental-pmd | §3 Workflows | STUB | No WF table; only 2-line mention |
| EC-PMD-002 | dental-pmd | §4 Workflow Details | ABSENT | No step-by-step for any workflow |
| EC-PMD-003 | dental-pmd | §6 Permissions | STUB | No per-operation role matrix |
| EC-PMD-004 | dental-pmd | §7b Aggregate Boundaries | STUB | PMD root ownership not enumerated |
| EC-PMD-005 | dental-pmd | §8 State Transitions | STUB | PMD lifecycle states not enumerated |
| EC-PMD-006 | dental-pmd | §14 Dependencies | STUB | No dependency table |
| EC-PMD-007 | dental-pmd | §15 Error Handling | STUB | No error code enumeration |
| EC-PMD-008 | dental-pmd | §18 Feature Flags | STUB | No flag list |
| EC-SCH-001 | dental-scheduling | §7 Data Requirements | STUB | No field table for Appointment/QueueItem |
| EC-SCH-002 | dental-scheduling | §7b Aggregate Boundaries | STUB | Appointment aggregate not enumerated |
| EC-SCH-003 | dental-scheduling | §3 Workflows | MISSING WF | `noShowAppointment.ts` exists; no-show workflow absent from spec |
| EC-SCH-004 | dental-scheduling | §3 Workflows | MISSING WF | `rescheduleAppointment.ts` exists; reschedule workflow absent from spec |
| EC-VIS-000 | dental-visit | — | NONE | Fully spec'd, no findings |

---

## Section Coverage Matrix

| Section | AUD | BIL | CLI | EMR | IMG | ORG | PAT | PER | PMD | SCH | VIS |
|---------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| §1 Overview | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| §2 Domain Terms | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| §3 Workflows | OK | OK | OK | OK | OK | OK | OK | OK | **S** | OK | OK |
| §4 Workflow Details | **A** | OK | OK | **A** | OK | OK | OK | OK | **A** | OK | OK |
| §5 Business Rules | **S** | OK | OK | **S** | OK | OK | OK | OK | OK | OK | OK |
| §6 Permissions | **S** | OK | OK | **S** | OK | OK | OK | OK | **S** | OK | OK |
| §7 Data Requirements | **S** | OK | OK | **S** | OK | OK | OK | OK | OK | **S** | OK |
| §7b Aggregate Bounds | **S** | **S** | OK | **S** | OK | OK | OK | OK | **S** | **S** | OK |
| §8 State Transitions | **S** | OK | OK | **S** | OK | OK | OK | OK | **S** | OK | OK |
| §9 UI/UX | **A** | OK | OK | **A** | OK | OK | OK | OK | OK | OK | OK |
| §10 API | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| §10b Domain Events | **S** | OK | OK | **A** | OK | OK | OK | OK | OK | OK | OK |
| §11 Acceptance Criteria | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| §12 Test Expectations | **A** | OK | OK | **A** | OK | OK | OK | OK | OK | OK | OK |
| §13 Edge Cases | **A** | OK | OK | **A** | OK | OK | OK | OK | OK | OK | OK |
| §14 Dependencies | OK | OK | OK | OK | OK | OK | OK | OK | **S** | OK | OK |
| §15 Error Handling | **A** | OK | OK | **A** | OK | OK | OK | OK | **S** | OK | OK |
| §16 Performance | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| §17 Observability | **S** | OK | OK | **A** | OK | OK | OK | OK | OK | OK | OK |
| §18 Feature Flags | **A** | OK | OK | **A** | OK | OK | OK | OK | **S** | OK | OK |
| §19 Vertical Slice | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| §20 AI Instructions | OK | OK | OK | OK | OK | OK | OK | **A** | OK | OK | OK |

**Key:** OK = detailed (≥3 substantive lines) | **S** = STUB (<3 lines) | **A** = ABSENT

---

## Remediation Priority

### P0 — Block before next development phase
1. **EC-EMR-009** — Identity/architecture gap: spec and code describe fundamentally different systems. Must resolve before any EMR feature work.
2. **EC-AUD-001–006** — Audit is compliance-critical; 6 ABSENT sections including §12 test expectations and §15 error handling.

### P1 — Fix before module work resumes
3. **EC-EMR-001–008** — 8 absent sections at 41% depth; cannot safely develop without workflow and error handling spec.
4. **EC-PMD-001–008** — 7 stub/absent sections at 64% depth; `exportPMD.ts` has zero spec backing.

### P2 — Cleanup
5. **EC-SCH-003–004** — noShow + reschedule handlers exist without spec backing.
6. **EC-ORG-002** — 6 PIN handlers unspec'd in §4.
7. **EC-PER-001** — Single absent §20; trivial one-paragraph fix.
