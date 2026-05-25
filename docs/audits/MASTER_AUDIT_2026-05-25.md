# MASTER AUDIT — Dentalemon vs. IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD

**Date:** 2026-05-25  
**Auditor:** Claude Code (AI) — Standards-compliance audit  
**Reference:** `docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md`  
**Branch:** `feat/v1.5-g1-foundation`  
**Method:** OLI — Observe (codebase inspection), Link (map to standard), Implement (remediation plan)

---

## 1. Executive Summary

Dentalemon has a **strong backend foundation** for dental clinic operations. The core clinical, billing, scheduling, and imaging modules are substantially implemented. The codebase exceeds the standard in several areas (PMD immutable records, cephalometric workspace, perio charting, FSM-enforced state machines) while having critical V1 gaps that must be resolved before production readiness.

**Top 5 critical gaps:**

1. **Local-first / Sync** — No `syncStatus`, `localId`, or `SyncLog` anywhere in the codebase. Standard §3.13 marks these V1 Required. Entire offline workflow is missing.
2. **Recall / Task** — No Recall or Task entity/handler exists. Standard §3.12 marks recall V1 Required.
3. **Role granularity** — Only 4 roles (`dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling`). Missing: Dental Assistant (separate), Front Desk, Billing Staff, Read-only/Auditor — all V1 Required or Recommended.
4. **Seed patient volume** — Only 5 patients seeded. Standard requires 20–50 realistic patients. Child patient, allergy patient, and offline-created record scenarios absent.
5. **Explicit treatment plan status** — No top-level `TreatmentPlan` entity with `draft→presented→approved→partially_completed→completed→cancelled` status. Plan state is inferred from treatment statuses, which prevents reliable plan-level audit and presentation tracking.

**V1 Readiness: 🟡 Yellow** — Core is present and functional but 3 V1 Required gaps (local-first, recall, plan status) must be resolved before claiming production readiness.

---

## 2. Current Implementation Map

### Backend Modules (`services/api-ts/src/handlers/`)

| Module | Status | Key Capabilities |
|---|---|---|
| `dental-org` | ✅ Implemented | Organization, branch, membership CRUD, working hours, consent templates, dashboard summary, branch settings, PIN auth |
| `dental-patient` | ✅ Implemented | Patient CRUD, archive/restore, bulk ops, import/export, follow-up notes, treatment plan (patient-side), conditions, safety floor, dentition init |
| `dental-visit` | ✅ Implemented | Visit lifecycle FSM, dental chart (JSONB), treatments FSM (diagnosed→planned→performed→verified), SOAP notes, addendum, tooth history, carry-over, templates |
| `dental-clinical` | ✅ Implemented | Amendment, attachment, consent form, lab order, medical history, prescription |
| `dental-billing` | ✅ Implemented | Invoice FSM (draft→issued→partial→paid→voided), payment, payment plan, discount, receipt, void, patient balance, collections summary |
| `dental-scheduling` | ✅ Implemented | Appointment FSM (scheduled→checked_in→completed|cancelled|no_show), walk-in, working hours |
| `dental-imaging` | ✅ Implemented | Image upload/categorize, finding, cephalometric landmarks and measurements |
| `dental-perio` | ✅ Implemented | Perio chart with BOP%, mean depth, deep pocket count summary |
| `dental-pmd` | ✅ Implemented | Immutable signed clinical records with supersession chain (EXCEEDS standard) |
| `dental-audit` | ✅ Implemented | Audit event query |
| Recall / Task | ❌ Missing | No entity, no handler |
| Inventory | ❌ Missing | No entity, no handler |
| Insurance / Claims | ⚠️ Partial | CDT code on treatment, ICD-10 on medical history; no InsuranceProfile/ClaimDraft entity |
| Local-first / Sync | ❌ Missing | No syncStatus, localId, SyncLog anywhere |
| Queue Board | ⚠️ Partial | Appointment check-in exists but no QueueItem entity or active board |
| Chair / Operatory | ⚠️ Partial | `operatoryId` UUID reserved on appointment schema; no Operatory table |

### Frontend App (`apps/dentalemon/src/features/`)

| Feature | Status |
|---|---|
| `workspace` | ✅ Full clinical workspace: chart, surface selector, SOAP notes, prescriptions, lab orders, consent, treatment table, pre-completion checklist |
| `patients` | ✅ Patient list, chart thumbnail, follow-up notes, filter tabs |
| `billing` | ✅ Invoice detail, invoice list |
| `scheduling` | ✅ Calendar (day/week/month), appointment card, appointment modal |
| `imaging` | ✅ Patient image list |
| `dashboard` | ✅ Dashboard present |
| `settings` | ✅ Clinic settings, fee schedule, locale, notifications |
| `staff` | ✅ Staff management |
| `reports` | ✅ Revenue, treatment, patient reports |
| `pmd` | ✅ PMD document UI |
| `onboarding` | ✅ Onboarding wizard |
| Queue board UI | ❌ Missing |
| Recall UI | ❌ Missing |
| Inventory UI | ❌ Missing |

---

## 3. Module / Context Gap Matrix

| Standard Context (§3.x) | Implemented | Gap | Priority |
|---|---|---|---|
| 3.1 Clinic & Org | ✅ Yes | Missing advanced org settings (procedure pricing as configurable list) | V1 Recommended |
| 3.2 Patient | ✅ Yes | Missing `DentalAlert` entity; guardian/contact schema unclear | V1 Recommended |
| 3.3 Appointment & Queue | ⚠️ Partial | Queue board (QueueItem) missing; Operatory table missing | V1 Recommended |
| 3.4 Clinical Encounter | ✅ Yes | Chief complaint ✅; dental screening (perio chart) ✅; no occlusion/TMD dedicated entity | V1 Recommended |
| 3.5 Dental Charting | ⚠️ Partial | Chart is per-visit JSONB; no cumulative patient-level baseline chart snapshot | V1 Required |
| 3.6 Treatment Plan | ⚠️ Partial | No explicit TreatmentPlan entity with plan-level status field | V1 Required |
| 3.7 Procedure & Work | ✅ Yes | Completed work via treatment `performed` status; addendum/correction supported | V1 Required |
| 3.8 Billing & Payments | ✅ Yes | Invoice, payment, void, receipt, balance, payment plan, discount | V1 Required |
| 3.9 Claims / Insurance | ⚠️ Partial | CDT codes ✅; ICD-10 ✅; InsuranceProfile ❌; ClaimDraft ❌ | V1 Recommended |
| 3.10 Imaging & Attachments | ✅ Yes | Upload, categories, patient link, ceph workspace | V1 Required |
| 3.11 Inventory / Materials | ❌ Missing | No inventory schema or handler | V1 Recommended |
| 3.12 Communication & Follow-up | ⚠️ Partial | Follow-up notes ✅; Recall ❌; Task ❌; post-op instructions ❌ | V1 Required (Recall) |
| 3.13 Audit / Local-first / Sync | ⚠️ Partial | Audit log ✅; local-first ❌; sync metadata ❌ | V1 Required |

---

## 4. Workflow Gap Matrix

| Standard Workflow (§4.x) | Status | Gap |
|---|---|---|
| 4.1 New Patient → First Visit → Baseline Chart → Treatment Plan | ⚠️ Partial | Patient creation ✅; appointment ✅; visit ✅; chart ✅; treatment creation ✅; but no plan-level approval step separate from treatment status |
| 4.2 Existing Patient → Same-Day Treatment → Billing → Recall | ⚠️ Partial | Treatment→Invoice→Payment ✅; Recall step ❌ |
| 4.3 Emergency Walk-in Toothache | ✅ Implemented | Walk-in flag ✅; same-day treatment ✅; billing ✅; follow-up notes ✅ (no formal recall) |
| 4.4 Treatment Plan Approval → Partial Completion | ⚠️ Partial | Item-level status transitions ✅; no plan-level "Presented" or "Approved" status |
| 4.5 Imaging Attachment Workflow | ✅ Implemented | Upload ✅; categorize ✅; patient link ✅; tooth/visit link ✅; preview needs UI verification |
| 4.6 Offline-Ready Clinical Workflow | ❌ Missing | No localId, no syncStatus, no offline-safe workflow |

---

## 5. Business Rule Coverage Matrix

### 5.1 Patient Rules

| Rule ID | Rule | Status | Test File | Gap |
|---|---|---|---|---|
| PAT-BR-001 | Name + contact required | Covered | `createDentalPatient.test.ts` | — |
| PAT-BR-002 | Minor patient guardian support | Not Covered | — | No guardian/contact entity found |
| PAT-BR-003 | Medical alerts visible in encounter | Partially Covered | — | Medical history exists; UI wiring needs E2E verification |
| PAT-BR-004 | No hard-delete if history exists | Covered | `dental-patient.test.ts` (archive/restore pattern) | — |
| PAT-BR-005 | Duplicate merge | V2 / Deferred | — | Not in scope |

### 5.2 Visit / Appointment Rules

| Rule ID | Rule | Status | Test File | Gap |
|---|---|---|---|---|
| APT-BR-001 | Appointment belongs to patient | Covered | Appointment schema FK | — |
| APT-BR-002 | Visit has lifecycle status | Covered | `visit.fsm.property.test.ts`, `dental-visit.test.ts` | — |
| APT-BR-003 | Walk-in without appointment | Covered | `walk-in.spec.ts` (E2E) | — |
| APT-BR-004 | Cancelled/no-show can't create work | Partially Covered | — | State machine enforces visit status; explicit test unclear |
| APT-BR-005 | Checked-in appears in queue | Not Covered | — | No QueueItem entity |

### 5.3 Clinical Encounter Rules

| Rule ID | Rule | Status | Test File | Gap |
|---|---|---|---|---|
| ENC-BR-001 | Encounter linked to patient/provider/date | Covered | Visit schema | — |
| ENC-BR-002 | Chief complaint required | Partially Covered | `dental-visit.test.ts` | Chief complaint on visit; enforcement unclear |
| ENC-BR-003 | Finalized notes require addendum | Covered | `createVisitNoteAddendum.ts`, `signVisitNotes.ts` | — |
| ENC-BR-004 | Clinical alerts visible before treatment | Not Covered (E2E) | — | `getDentalPatientSafetyFloor.ts` exists; E2E test needed |
| ENC-BR-005 | Specialty templates not required | Covered | Template system is optional | — |

### 5.4 Dental Charting Rules

| Rule ID | Rule | Status | Test File | Gap |
|---|---|---|---|---|
| CHART-BR-001 | Baseline separate from proposed/completed | Partially Covered | `surface-condition-map.test.ts` | `entryClassification` JSONB separates; no cumulative baseline snapshot |
| CHART-BR-002 | Completed work doesn't overwrite baseline | Partially Covered | — | Treatment status tracks completion; baseline preservation relies on JSONB immutability per visit |
| CHART-BR-003 | Tooth-level entries: status, date, provider, notes | Covered | Chart schema + treatment schema | — |
| CHART-BR-004 | Surface validation | Covered | `toothSurfaceEnum` + `surface-condition-map.test.ts` | — |
| CHART-BR-005 | Chart entry linked to patient/visit | Covered | Schema FK | — |
| CHART-BR-006 | Proposed vs completed visually distinct | Partially Covered | `dental-chart.tsx` component | Needs UI audit |
| CHART-BR-007 | Tooth history reconstructable | Covered | `getToothHistory.ts` | — |
| CHART-BR-008 | Pediatric and permanent dentition | Covered | `initializeDentition.ts`, `universal-tooth-fdi.tsx` | — |

### 5.5 Treatment Plan Rules

| Rule ID | Rule | Status | Test File | Gap |
|---|---|---|---|---|
| TP-BR-001 | Plan belongs to patient/provider | Partially Covered | `treatment_plan_version` has patientId | Provider link indirect via visit |
| TP-BR-002 | Plan item has procedure/fee/status | Covered | `dental_treatment` schema | — |
| TP-BR-003 | Plan status transitions controlled | Partially Covered | `treatment-fsm-http.test.ts` | Treatment-level FSM; no plan-level status FSM |
| TP-BR-004 | Approved items can become completed | Covered | `treatment.fsm.property.test.ts` | — |
| TP-BR-005 | Completing one item doesn't complete whole plan | Covered | Item-level status | — |
| TP-BR-006 | Estimates show total/item fees | Covered | Invoice line items, `getTreatmentPlan.ts` | — |
| TP-BR-007 | Patient approval recorded | Partially Covered | `acceptTreatmentPlan.ts` + `treatment_plan_version` | No explicit approval date/status at plan level |

### 5.6 Procedure / Work Done Rules

| Rule ID | Rule | Status | Test File | Gap |
|---|---|---|---|---|
| PROC-BR-001 | Completed procedure links patient/provider/date/code | Covered | `dental_treatment` schema | — |
| PROC-BR-002 | Tooth/surface required for tooth procedures | Covered | Schema + validation | — |
| PROC-BR-003 | Work links to encounter/visit | Covered | `visitId` FK on treatment | — |
| PROC-BR-004 | Direct same-day work auditable | Covered | `createDentalTreatment.ts` | — |
| PROC-BR-005 | Completed procedures billable | Covered | Invoice from performed treatments | — |
| PROC-BR-006 | Corrections via addendum/reversal | Covered | `createAmendment.ts`, `createVisitNoteAddendum.ts` | — |

### 5.7 Billing Rules

| Rule ID | Rule | Status | Test File | Gap |
|---|---|---|---|---|
| BILL-BR-001 | Invoice belongs to patient + has items | Covered | Schema + `dental-billing.test.ts` | — |
| BILL-BR-002 | Invoice item preserves procedure reference | Covered | `treatmentId` FK on line item | — |
| BILL-BR-003 | Payments link to invoice | Covered | Schema FK | — |
| BILL-BR-004 | Discounts require permission + reason | Covered | `applyDentalDiscount.ts` | Permission enforcement needs audit |
| BILL-BR-005 | Voids/refunds auditable | Covered | `voidDentalInvoice.ts`, `voidDentalPayment.ts` | — |
| BILL-BR-006 | Balance = invoices − payments | Covered | `getPatientBalance.ts` | — |

### 5.8 Claims / Insurance Rules

| Rule ID | Rule | Status | Test File | Gap |
|---|---|---|---|---|
| CLAIM-BR-001 | Claim-ready procedure has all fields | Partially Covered | CDT on treatment, diagnosis on medical history | No claim readiness check |
| CLAIM-BR-002 | CDT codes supported | Covered | `cdtCode` field on treatment + template | — |
| CLAIM-BR-003 | ICD-10 diagnosis supported | Covered | `medical_history_entry` with codeSystem | — |
| CLAIM-BR-004 | Attachments linkable to claim | Not Covered | — | No ClaimDraft entity |
| CLAIM-BR-005 | Clearinghouse deferred | V2 / Deferred | — | — |

### 5.9 Attachment Rules

| Rule ID | Rule | Status | Test File | Gap |
|---|---|---|---|---|
| ATT-BR-001 | Attachment links to patient | Covered | Schema | — |
| ATT-BR-002 | Attachment has category/type | Covered | `attachment.schema.ts` | — |
| ATT-BR-003 | Attachment may link to visit/tooth/procedure | Covered | Imaging schema has clinical links | — |
| ATT-BR-004 | Metadata preserved | Covered | Schema fields | — |

### 5.10 Local-First / Sync Rules

| Rule ID | Rule | Status | Test File | Gap |
|---|---|---|---|---|
| LF-BR-001 | Local IDs for offline records | ❌ Not Implemented | — | No localId concept anywhere |
| LF-BR-002 | Local→server ID mapping | ❌ Not Implemented | — | — |
| LF-BR-003 | Unsynced records show status | ❌ Not Implemented | — | No UI sync indicator |
| LF-BR-004 | Conflicts not silently overwritten | ❌ Not Implemented | — | — |
| LF-BR-005 | Conflict resolution UI deferred | V2 / Deferred | — | — |

### 5.11 Audit Rules

| Rule ID | Rule | Status | Test File | Gap |
|---|---|---|---|---|
| AUD-BR-001 | Clinical actions auditable | Covered | `dental-audit/getAuditEvents.ts`, `db/audit.test.ts` | — |
| AUD-BR-002 | Billing discounts/voids auditable | Covered | Audit system | — |
| AUD-BR-003 | Permission-denied attempts logged | Partially Covered | — | Needs verification |
| AUD-BR-004 | Audit log: actor/action/target/timestamp | Covered | `AuditLog` entity | — |

---

## 6. Entity / Schema Gap Matrix

| Standard Entity (§6.x) | Implemented | Gap |
|---|---|---|
| Organization | ✅ `dental_organization` | — |
| ClinicLocation / Branch | ✅ `dental_branch` | — |
| Chair / Operatory | ⚠️ `operatoryId` UUID on appointment | No `operatory` table |
| User | ✅ Better-Auth `person` | — |
| Membership | ✅ `dental_membership` | — |
| Role | ⚠️ 4 roles in enum | Missing billing_staff, front_desk, hygienist, dental_assistant, read_only |
| Permission | ⚠️ Role-based via enum | No fine-grained permission matrix |
| Patient | ✅ `patient` table | — |
| PatientContact / Guardian | ❌ Missing | No guardian/emergency contact entity |
| MedicalAlert | ✅ `medical_history_entry` (allergy/condition/medication) | — |
| DentalAlert | ❌ Missing | No dental-specific alert entity |
| ConsentRecord | ✅ `consent_form` schema | — |
| Appointment | ✅ `dental_appointment` | — |
| Visit | ✅ `dental_visit` | — |
| QueueItem | ❌ Missing | No queue board entity |
| Encounter / SOAP Notes | ✅ `visit_notes` (SOAP) | — |
| DentalScreening | ✅ Via perio chart | — |
| OcclusionScreening | ❌ Missing | No dedicated occlusion entity |
| ApplianceRecord | ❌ Missing | No dedicated appliance entity |
| TMDScreening | ❌ Missing | No dedicated TMD entity |
| Diagnosis / PatientDiagnosis | ⚠️ Via `medical_history_entry` + `conditionCode` on treatment | No standalone `Diagnosis` entity with ICD-10 for encounter-level linking |
| Tooth | ✅ `toothNumber` + FDI notation | — |
| ToothChartEntry | ✅ `dental_chart` JSONB `teeth` array | Per-visit, not cumulative per-patient |
| ChartLayer (baseline/proposed/completed) | ⚠️ `entryClassification` enum | Not three separate named snapshot layers |
| ToothHistoryEvent | ✅ `getToothHistory` handler | — |
| ProcedureCode | ⚠️ CDT code as text on treatment | No separate `ProcedureCode` lookup table |
| TreatmentPlan | ⚠️ `treatment_plan_version` (snapshot only) | No live TreatmentPlan entity with plan-level status |
| TreatmentPlanItem | ✅ `dental_treatment` with planned status | — |
| CompletedProcedure | ✅ `dental_treatment` with performed status | — |
| MaterialUsage | ❌ Missing | — |
| Invoice | ✅ `dental_invoice` | — |
| InvoiceItem | ✅ `dental_invoice_line_item` | — |
| Payment | ✅ `dental_payment` | — |
| Adjustment | ⚠️ Discount on invoice | No standalone Adjustment entity |
| InsuranceProfile | ❌ Missing | — |
| ClaimDraft | ❌ Missing | — |
| ClaimLine | ❌ Missing | — |
| Attachment | ✅ `attachment.schema.ts` + imaging | — |
| AttachmentLink | ✅ Via imaging schema clinical links | — |
| InventoryItem | ❌ Missing | — |
| StockAdjustment | ❌ Missing | — |
| Recall | ❌ Missing | V1 Required |
| Task | ❌ Missing | V1 Recommended |
| AuditLog | ✅ Audit module | — |
| SyncLog / SyncState | ❌ Missing | V1 Required |

---

## 7. Permission Gap Matrix

### Roles Present vs. Standard

| Standard Role | Implemented | Notes |
|---|---|---|
| Owner/Admin | ✅ `dentist_owner` | — |
| Dentist | ✅ `dentist_associate` | — |
| Associate Dentist | ✅ `dentist_associate` | Same enum value as Dentist |
| Hygienist | ❌ Missing | Bundled into `staff_full` |
| Dental Assistant | ❌ Missing | Bundled into `staff_full` |
| Front Desk | ❌ Missing | Bundled into `staff_scheduling` |
| Billing Staff | ❌ Missing | No dedicated billing role |
| Read-only / Auditor | ❌ Missing | — |

### Permission Matrix Gaps

Current implementation uses role enum (`dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling`) with inline `assertBranchAccess` checks in handlers. This is functional but lacks:

- Fine-grained permission keys (e.g., `can_apply_discount`, `can_finalize_clinical_note`)
- Per-action permission enforcement matrix
- Billing-only vs clinical-only role separation
- Read-only/auditor access path

| Permission Area | Status |
|---|---|
| Manage clinic settings | ✅ Role-gated |
| Create/edit patient | ✅ All roles |
| Create encounter | ✅ Dentist roles |
| Edit clinical chart | ✅ Dentist roles |
| Finalize clinical note | ✅ `signVisitNotes.ts` |
| Create treatment plan | ✅ Dentist roles |
| Record completed procedure | ✅ Dentist roles |
| Create invoice | ✅ |
| Apply discount | ✅ `applyDentalDiscount.ts` |
| Void/refund | ✅ `voidDentalInvoice.ts` |
| View audit logs | ✅ `getAuditEvents.ts` |
| Role-level billing restriction | ❌ No billing-only role |
| Hygienist-limited clinical scope | ❌ No hygienist role |

---

## 8. UI/UX Gap Matrix

### Global UI Principles (§8.1)

| Principle | Status | Notes |
|---|---|---|
| iPad-first layout | ✅ `ipad-workspace.spec.ts` E2E exists | — |
| Touch targets | Presumed (Tailwind + shadcn) | Needs manual audit |
| Carousel concept | ✅ `timeline-carousel.tsx` | — |
| Patient context persistence | ✅ Workspace layout | — |
| Fast action hierarchy | Presumed from workspace structure | — |
| Minimal modal stacking | Not verified | — |
| Clear empty states | ⚠️ Partially implemented | Known gap from prior sessions |
| Offline/sync indicator | ❌ Missing | No sync metadata to display |
| No hover dependency | Not verified | — |
| Status chips | ✅ `badge.tsx` component | — |
| Progressive forms | ✅ Multi-step workspace | — |

### Clinical UI (§8.3)

| Expectation | Status |
|---|---|
| Tooth chart central | ✅ `dental-chart.tsx` + `workspace` feature |
| Separate layers visually | ⚠️ `entryClassification` used; visual separation needs UI audit |
| Fast tooth selection | ✅ `five-surface-selector.tsx` |
| Quick-add findings | ✅ `cdt-code-browser.tsx` |
| Per-tooth history | ✅ `tooth-slideout.tsx` + `getToothHistory` |
| Chairside mode | ⚠️ `pre-completion-checklist.tsx` exists; full chairside mode not confirmed |
| Image linking | ✅ `patient-image-list.tsx` |

### Billing UI (§8.4)

| Expectation | Status |
|---|---|
| From work to invoice | ✅ Treatment → invoice flow |
| Clear balance | ✅ `getPatientBalance.ts` |
| Payment-first checkout | ✅ `recordDentalPayment.ts` |
| Discount reason required | ✅ `applyDentalDiscount.ts` |
| Receipt preview | ✅ `getDentalPaymentReceipt.ts` |

### Missing UI

- **Queue board / waiting room board**: No `QueueItem` UI
- **Recall scheduling UI**: No recall creation/management
- **Inventory UI**: No inventory UI

---

## 9. Test Coverage Gap Matrix

### Coverage Summary

| Test Type | Status | Count | Gap |
|---|---|---|---|
| Backend unit tests | ✅ Good | ~50+ test files | — |
| FSM property tests | ✅ Strong | Visit, treatment, invoice, consent, imaging FSMs | — |
| Integration / handler tests | ✅ Good | Per-module handler coverage tests | — |
| E2E tests | ✅ Good | 13+ spec files including journeys | — |
| Permission tests | ✅ Present | `role-gates-scheduling.spec.ts`, `cross-org-isolation.test.ts` | Billing role restrictions untested |
| Audit tests | ✅ Present | `db/audit.test.ts`, `listAuditLogs.test.ts` | — |
| Local-first tests | ❌ Missing | — | No sync/offline test suite |
| Visual/UI tests | ⚠️ Partial | `ipad-workspace.spec.ts` | — |
| Seed scenario tests | ❌ Missing | — | No test that validates seed data workflows |

### E2E Journey Coverage vs. Standard (§9.2)

| Standard Journey | Covered By |
|---|---|
| E2E-001: Register → book → check-in → encounter | `01-new-patient-exam.journey.spec.ts` |
| E2E-002: New patient → baseline chart → diagnosis → treatment plan | `new-patient-charting.spec.ts` |
| E2E-003: Approve plan → complete item → plan partially completed | `returning-patient-visit.spec.ts` |
| E2E-004: Procedure → invoice → payment → receipt → balance | `04-revenue-chain.journey.spec.ts` |
| E2E-005: Walk-in emergency → work done → billing → follow-up | `walk-in.spec.ts` |
| E2E-006: Upload attachment → link → preview | Not explicitly confirmed |
| E2E-007: Front desk denied clinical edit | `role-gates-scheduling.spec.ts` |
| E2E-008: Dentist finalizes note → audit log | `safety-floor.spec.ts` (partial) |
| E2E-009: Offline record → sync metadata visible | ❌ Missing |
| E2E-010: Unpaid balance in dashboard/billing | `reporting.spec.ts` (partial) |

---

## 10. Seed Data Gap Matrix

| Standard Seed Item | Status | Gap |
|---|---|---|
| Organization | ✅ "Reyes Dental Clinic" | — |
| Users (admin, 2 dentists, assistant, front desk, billing) | ⚠️ Partial | Only owner + Dr. Reyes + Ana Santos (3 members, 2 roles) |
| Roles/permissions | ⚠️ Partial | Only dentist_owner + 1 dentist_associate |
| Chairs/operatories | ❌ Missing | No operatory table |
| Procedure codes | ✅ CDT codes on treatments | No dedicated lookup table with fee schedule |
| Diagnosis codes | ✅ Medical history entries | No standalone ICD-10 list |
| Patients | ❌ Only 5 | Standard: 20–50 |
| Appointments | ✅ 20 appointment IDs seeded | — |
| Visits/encounters | ✅ 20 visits seeded | — |
| Dental charts | ✅ 20 charts seeded | — |
| Treatment plans | ✅ 25 treatments seeded | — |
| Completed procedures | ✅ Via performed treatment status | — |
| Invoices/payments | ✅ 8 invoices, 7 payments seeded | — |
| Attachments | ❌ Not confirmed in seed | — |
| Recalls/tasks | ❌ Missing | — |
| Audit logs | ❌ Not confirmed in seed | — |
| Local/sync records | ❌ Missing | — |

### Required Patient Scenarios vs. Seed

| Scenario | Status |
|---|---|
| Adult routine cleaning | ✅ Juan, Rosa |
| Emergency toothache | ✅ Carlos scenario likely |
| Child patient with guardian | ❌ No child patient |
| Orthodontic candidate | ❌ Not confirmed |
| Patient with allergy | ⚠️ Medical history exists; seed coverage unclear |
| Patient with unpaid balance | ✅ Invoices in various statuses |
| Patient with approved plan | ✅ Treatment versions seeded |
| Completed but unbilled work | ⚠️ Partial |
| Patient with attachment | ❌ Not confirmed |
| Offline-created record | ❌ Missing |

---

## 11. V1 Readiness Rating

**Overall: 🟡 Yellow**

| Criterion (§13) | Status |
|---|---|
| 1. Register patients, book visits, walk-ins, timelines | ✅ Met |
| 2. Chairside charting on iPad | ✅ Met |
| 3. Baseline, proposed, completed structurally separate | ⚠️ Partial (per-visit JSONB; no cumulative patient baseline) |
| 4. Treatment plans: create/approve/partially complete/complete | ⚠️ Partial (no plan-level status) |
| 5. Completed procedures → invoice items | ✅ Met |
| 6. Payments and receipts recorded | ✅ Met |
| 7. Medical alerts visible before/during clinical work | ⚠️ Partial (API exists; E2E enforcement not verified) |
| 8. Role-based permissions prevent inappropriate edits | ⚠️ Partial (4 roles; missing billing/front-desk separation) |
| 9. Clinical and billing audit trails | ✅ Met |
| 10. Core records local-first-ready | ❌ Not Met |
| 11. Critical E2E workflows covered by tests | ✅ Met (9/10 journeys) |
| 12. Seed data supports realistic demos | ⚠️ Partial (5 patients, limited scenarios) |
| 13. V2 items documented not mixed into V1 blockers | ✅ Met |

---

## 12. Prioritized Remediation Roadmap

### P0 — Blocks Safe V1 Clinical/Billing Workflow

| ID | Item | Module / File | Effort |
|---|---|---|---|
| P0-001 | ✅ CLOSED (534ea5e) Add `Recall` entity + handlers (create, list, update, complete) | New: `dental-recall/` | M |
| P0-002 | ✅ CLOSED (0f17781) Add sync metadata fields (`localId`, `syncStatus`, `lastSyncAt`) to Visit, Chart, Treatment, Invoice entities | Schema migrations | M |
| P0-003 | ✅ CLOSED (0f17781) Add `SyncLog` / `SyncState` table | New schema + migration | S |
| P0-004 | ✅ CLOSED (d70767d) Add `PatientContact` / Guardian entity + handlers | `dental-patient/` | S |
| P0-005 | ✅ CLOSED (dd1153f) Add plan-level `TreatmentPlan` entity with status FSM (`draft→presented→approved→partially_completed→completed→cancelled`) | `dental-visit/` or `dental-patient/` | M |

### P1 — Important V1 Gap; Fix Before Production

| ID | Item | Module / File | Effort |
|---|---|---|---|
| P1-001 | Expand roles to include `hygienist`, `dental_assistant`, `front_desk`, `billing_staff`, `read_only` | `membership.schema.ts` + all role-gated handlers | L |
| P1-002 | Add `Operatory` / Chair table + link to appointment | New schema + migration | S |
| P1-003 | Add `QueueItem` entity and queue board handlers | New: `dental-queue/` | M |
| P1-004 | Expand seed to 20–30 patients with child, allergy, unpaid-balance, and offline scenarios | `seed-data/` | M |
| P1-005 | Add E2E test for offline record creation with sync metadata visible (E2E-009) | `tests/e2e/` | S |
| P1-006 | Validate and test medical alert visibility during clinical encounter (ENC-BR-004, PAT-BR-003) | E2E spec | S |
| P1-007 | Add `InsuranceProfile` entity + basic claim readiness check | New: `dental-claims/` | M |
| P1-008 | Add `ProcedureCode` lookup table with CDT codes + default fees | New schema + seed | S |

### P2 — V1 Recommended Improvement

| ID | Item | Module / File | Effort |
|---|---|---|---|
| P2-001 | Add `DentalAlert` entity (separate from medical history) | `dental-patient/` | S |
| P2-002 | Add occlusion screening entity + form | `dental-clinical/` | S |
| P2-003 | Add `Task` entity + handlers for staff task management | New: `dental-task/` | M |
| P2-004 | Add `Inventory` entity + stock adjustment handlers | New: `dental-inventory/` | M |
| P2-005 | Add seed audit log entries | `seed-data/` | S |
| P2-006 | Add `Attachment` seed entries + patient-with-attachment scenario | `seed-data/` | S |
| P2-007 | Verify/test empty states across all workspace tabs | E2E + UI | S |
| P2-008 | Add post-op instruction templates to clinical module | `dental-clinical/` | S |
| P2-009 | Implement offline/sync UI indicator in frontend | `apps/dentalemon/` | M |
| P2-010 | Add queue board UI | `apps/dentalemon/src/features/` | M |

### P3 — V2 / Deferred (Document, Do Not Block V1)

| ID | Item |
|---|---|
| P3-001 | Full electronic clearinghouse submission |
| P3-002 | Full patient app |
| P3-003 | Complex sync conflict resolution UI |
| P3-004 | Advanced perio charting (already partially implemented — consider moving to V1 Recommended) |
| P3-005 | AI-dependent clinical decisions |
| P3-006 | ERA/EOB remittance processing |
| P3-007 | Full inventory accounting (costing, batch/expiry) |
| P3-008 | Enterprise analytics |

---

## 13. Status Classification Reference

| Category | Items |
|---|---|
| **Missing feature** | Recall, Task, Inventory, InsuranceProfile/ClaimDraft, PatientContact/Guardian, SyncLog/SyncState, localId metadata, OcclusionScreening, TMDScreening, ApplianceRecord, QueueItem, Operatory table |
| **Partially implemented** | TreatmentPlan entity (schema exists as snapshot only; no plan-level status FSM), Chart layers (per-visit JSONB; no cumulative patient baseline), Role matrix (4/8 roles), Permission enforcement (role-based but not fine-grained), ProcedureCode (code as text only; no lookup table) |
| **Implemented but untested** | Medical alert visibility during encounter (ENC-BR-004), Offline E2E journey (E2E-009), Discount permission enforcement (BILL-BR-004), Permission-denied audit logging (AUD-BR-003) |
| **Tested but not production-safe** | Local-first (no implementation = no tests; structural gap) |
| **V2/deferred — should not block V1** | Clearinghouse integration, Cephalometric workspace (already implemented as bonus), Full perio chart (already implemented), Patient app, CRDT conflict resolution UI, ERA/EOB processing, Advanced analytics |

---

*Generated by: Claude Code master audit vs. IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md*  
*Date: 2026-05-25 | Branch: feat/v1.5-g1-foundation*
