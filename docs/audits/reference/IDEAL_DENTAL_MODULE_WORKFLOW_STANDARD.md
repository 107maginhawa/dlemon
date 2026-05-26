# IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md

**Target path:** `docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md`  
**Product:** Dentalemon Dental Management System  
**Purpose:** Production-grade reference standard for module design, workflow coverage, business rules, UI/UX expectations, permissions, tests, and seed data.  
**Audience:** AI coding agents, auditors, product owners, QA, and engineering team.  
**Operating model:** Small-to-mid-sized dental clinic, iPad-first, local-first-ready, practical, not overengineered.  
**Priority tags:** `V1 Required`, `V1 Recommended`, `V2 / Deferred`  

---

## 0. How This Standard Should Be Used

This document is the ideal reference standard for Dentalemon. It is not limited to the current implementation and should be used as the baseline when auditing, improving, refactoring, testing, or seeding the Dentalemon codebase.

Use this standard to answer:

1. Are the correct bounded contexts/modules present?
2. Are dental clinic workflows complete enough for production use?
3. Are business rules explicitly implemented and tested?
4. Are clinical, billing, and operational records traceable?
5. Is the UI practical for iPad-first chairside workflows?
6. Is the system local-first-ready without overengineering V1?
7. Are there enough tests to support TDD/spec-driven development?
8. Is seed data realistic enough to test full end-to-end dental operations?

This standard should be used together with the OLI process and execution gate:

- **O — Observe:** Inspect actual code, schema, routes, UI, tests, seed data, and existing docs before making claims.
- **L — Link:** Map every finding to a module, workflow, business rule, entity, UI expectation, permission, test, or seed-data requirement in this standard.
- **I — Implement / Improve:** Recommend or implement changes only after gaps are proven and prioritized.
- **Execution Gate:** Use `/oli-execution-gate` before implementation to confirm scope, evidence, test expectations, and acceptance criteria.

---

## 1. Product Principles

| Principle | Standard | Priority |
|---|---|---|
| Small-to-mid clinic first | Optimize for solo dentists, group practices, and small-to-mid dental clinics, not hospital-scale complexity. | V1 Required |
| iPad-first | Core clinical and chairside workflows must be usable on iPad with touch-friendly controls. | V1 Required |
| Local-first-ready | V1 should be designed so offline/local records, local IDs, sync status, and conflict handling can be added or expanded cleanly. | V1 Required |
| Not overengineered | Avoid complex enterprise workflows unless they directly support practical dental operations. | V1 Required |
| Visual-first dentistry | Dental chart, tooth-level views, and treatment statuses should be more central than generic tables. | V1 Required |
| Fast clinical entry | Dentists should be able to document common actions quickly while still preserving legal/clinical traceability. | V1 Required |
| Clear separation of record states | Baseline, proposed work, and completed work must not be mixed or overwritten. | V1 Required |
| Auditability | Clinical, financial, and permission-sensitive changes must be traceable. | V1 Required |
| Progressive complexity | Advanced features should be deferred if they slow down V1 production readiness. | V1 Required |
| AI-ready, not AI-dependent | The product should structure data for future AI but should not depend on AI to complete normal clinic operations. | V1 Required |

---

## 2. Priority Definitions

### V1 Required
Must exist or be clearly supported for Dentalemon to be credible as a production-grade dental management system for a small-to-mid-sized clinic.

### V1 Recommended
Strongly useful for V1 but can be phased if time is limited. Should be designed for, but may not block initial release if core workflows are safe.

### V2 / Deferred
Useful later, but should not be forced into V1 if it increases complexity, risk, or implementation noise.

---

## 3. Ideal Bounded Contexts / Modules

### 3.1 Clinic & Organization Context

**Purpose:** Manage clinic identity, settings, users, membership, locations, and operational structure.

| Item | Description | Priority |
|---|---|---|
| Organization profile | Clinic/business profile, contact details, billing identity, branding. | V1 Required |
| Clinic locations | Support at least one location; multi-location should be structurally possible. | V1 Required |
| Chairs / operatories | Basic treatment chair setup for appointments and queue. | V1 Recommended |
| User/member management | Invite, activate, deactivate, assign roles. | V1 Required |
| Role-based permissions | Practical permission matrix by role. | V1 Required |
| Org switcher / membership UX | Slack-style or icon-rail organization switching where applicable. | V1 Recommended |
| Clinic settings | Procedure pricing, numbering, visit settings, receipt settings, charting defaults. | V1 Required |
| Audit settings | Enable clinical/billing audit trail rules. | V1 Required |
| Advanced enterprise admin | Multi-branch hierarchy, department-level permissions, complex approval chains. | V2 / Deferred |

---

### 3.2 Patient Context

**Purpose:** Maintain the patient’s demographic, contact, medical, dental, and consent profile.

| Item | Description | Priority |
|---|---|---|
| Patient profile | Name, birthdate, sex, contact details, address, identifiers. | V1 Required |
| Patient search | Fast search by name, phone, ID, birthdate. | V1 Required |
| Guardian/contact support | Required for minors and optional for adults. | V1 Required |
| Medical alerts | Allergies, medications, pregnancy, hypertension, diabetes, bleeding risks, other flags. | V1 Required |
| Dental alerts | Anxiety, anesthesia sensitivity, orthodontic status, prosthetics, implants, periodontal risk. | V1 Recommended |
| Consent records | Basic consent capture or consent status tracking. | V1 Recommended |
| Patient timeline | Chronological view of visits, procedures, notes, attachments, invoices, recalls. | V1 Required |
| Patient merge | Merge duplicate patients with audit trail. | V2 / Deferred |
| Patient portal / app | Patient-facing access, messaging, forms. | V2 / Deferred |

---

### 3.3 Appointment & Queue Context

**Purpose:** Manage patient scheduling, walk-ins, chairside queue, and visit lifecycle.

| Item | Description | Priority |
|---|---|---|
| Appointment creation | Create appointment with patient, provider, date/time, service reason, status. | V1 Required |
| Calendar view | Day/week schedule optimized for clinic operations. | V1 Required |
| Walk-in flow | Create visit without prior appointment. | V1 Required |
| Visit lifecycle | Scheduled → Checked-in → In chair → Completed → Checked-out / Cancelled / No-show. | V1 Required |
| Provider schedule | Assign dentist or hygienist to appointment. | V1 Recommended |
| Queue board | Chairside waiting/in-progress/completed board. | V1 Recommended |
| Multi-chair view | Display chair/operatories and active visits. | V1 Recommended |
| Automated reminders | SMS/email reminders or integrations. | V2 / Deferred |

---

### 3.4 Clinical Encounter Context

**Purpose:** Capture the clinical visit, chief complaint, findings, diagnoses, notes, and care decisions.

| Item | Description | Priority |
|---|---|---|
| Encounter record | A visit-specific clinical record linked to patient, provider, and date. | V1 Required |
| Chief complaint | Fast capture of reason for visit. | V1 Required |
| Clinical notes | Structured and free-text notes. | V1 Required |
| Dental screening | Gingivitis, early periodontitis, moderate, advanced, and related findings. | V1 Required |
| Occlusion screening | Class molar, overjet, overbite, midline deviation, crossbite. | V1 Recommended |
| Appliances | Orthodontic, stayplate, dentures, implants, others. | V1 Recommended |
| TMD screening | Clenching, clicking, trismus, muscle spasm. | V1 Recommended |
| Diagnosis entry | ICD-10 or dental diagnosis support per patient/tooth/surface where applicable. | V1 Required |
| Provider signature / finalization | Mark encounter as finalized/locked or clinically reviewed. | V1 Recommended |
| Advanced specialty templates | Endodontic, orthodontic, surgery, perio specialty templates. | V2 / Deferred |

---

### 3.5 Dental Charting Context

**Purpose:** Provide the visual and structured dental charting foundation of the system.

| Item | Description | Priority |
|---|---|---|
| Odontogram | Visual tooth chart supporting permanent and pediatric dentition. | V1 Required |
| Per-tooth charting | Record status, diagnosis, procedure, remarks, and dates per tooth. | V1 Required |
| Per-surface charting | Support surfaces where relevant: mesial, distal, occlusal/incisal, buccal/facial, lingual/palatal. | V1 Required |
| Baseline chart | Existing patient condition at first charting; should not be overwritten by proposed/completed work. | V1 Required |
| Proposed work layer | Planned procedures separate from baseline and completed work. | V1 Required |
| Completed work layer | Finished procedures with provider, date, notes, and billing linkage. | V1 Required |
| Visual status legend | Missing, caries, filling, crown, implant, extraction, root canal, etc. | V1 Required |
| Tooth history | Per-tooth timeline of findings, proposed work, and completed work. | V1 Recommended |
| Bulk/common actions | Quick actions for common diagnoses/procedures. | V1 Recommended |
| Advanced periodontal chart | Full perio probing, mobility, recession, bleeding points. | V2 / Deferred |
| Cephalometric workspace | Landmarking, tracing overlays, measurements, AI-assisted landmarks. | V2 / Deferred |

---

### 3.6 Treatment Plan Context

**Purpose:** Convert findings and diagnoses into proposed work, estimates, approvals, and sequenced care.

| Item | Description | Priority |
|---|---|---|
| Treatment plan creation | Create plan linked to patient, provider, and date. | V1 Required |
| Treatment plan items | Procedure, tooth/surface, diagnosis, fee, status, priority, notes. | V1 Required |
| Plan status | Draft → Presented → Approved → Partially completed → Completed → Cancelled. | V1 Required |
| Patient approval | Capture approval status, date, and optionally signature. | V1 Required |
| Estimate | Show fees, discounts, insurance estimate if available, patient responsibility. | V1 Required |
| Sequencing | Phase or order treatment items. | V1 Recommended |
| Convert to work done | Approved items can transition into completed procedures. | V1 Required |
| Treatment templates | Common packages or procedure bundles. | V1 Recommended |
| Advanced case presentation | Rich visual proposal decks, before/after simulations. | V2 / Deferred |

---

### 3.7 Procedure & Clinical Work Context

**Purpose:** Record actual dental work performed and preserve clinical/legal history.

| Item | Description | Priority |
|---|---|---|
| Completed procedure | Procedure done with patient, provider, date, tooth/surface, procedure code, notes. | V1 Required |
| Work done from treatment plan | Convert approved plan item to completed procedure with controlled transition. | V1 Required |
| Direct work done | Allow emergency or same-day work even without pre-approved plan, with reason/audit. | V1 Required |
| Clinical note linkage | Completed work should link to encounter note. | V1 Required |
| Materials used | Basic materials/consumables linked to procedure where useful. | V1 Recommended |
| Reversal/correction | Correct mistakes through addendum/reversal, not silent deletion. | V1 Required |
| Specialty procedure records | Endo measurements, ortho adjustments, perio maintenance details. | V2 / Deferred |

---

### 3.8 Billing & Payments Context

**Purpose:** Convert approved/completed services into charges, invoices, receipts, and balances.

| Item | Description | Priority |
|---|---|---|
| Invoice creation | Generate invoice from completed procedures and manual charges. | V1 Required |
| Invoice items | Procedure code, description, amount, discount, tax if applicable. | V1 Required |
| Payment recording | Cash/card/bank/e-wallet/other payment method. | V1 Required |
| Receipt generation | Payment receipt with clinic and patient details. | V1 Required |
| Patient balance | Show unpaid balance and invoice status. | V1 Required |
| Discounts | Role-restricted discounts with reason/audit. | V1 Required |
| Voids/refunds | Controlled void or refund flow with reason. | V1 Recommended |
| Accounts receivable | Basic aging or unpaid invoice list. | V1 Recommended |
| Advanced accounting | GL export, tax accounting, full bookkeeping. | V2 / Deferred |

---

### 3.9 Claims / Insurance Context

**Purpose:** Structure data so insurance/claims workflows can be supported without forcing complex clearinghouse integrations in V1.

| Item | Description | Priority |
|---|---|---|
| Insurance profile | Payer, policy/member info, coverage notes. | V1 Recommended |
| CDT support | Procedure code support for dental claims readiness. | V1 Required |
| ICD-10 support | Diagnosis code support where needed. | V1 Required |
| Claim readiness review | Check missing patient, provider, diagnosis, procedure, tooth/surface, attachments. | V1 Recommended |
| Claim draft | Create claim-ready data package, even if not submitted electronically. | V1 Recommended |
| Attachment support | Link x-rays/photos/docs to claim draft. | V1 Recommended |
| Clearinghouse integration | Electronic submission to provider such as clearinghouse. | V2 / Deferred |
| ERA/EOB processing | Remittance and adjudication processing. | V2 / Deferred |

---

### 3.10 Imaging & Attachments Context

**Purpose:** Attach and organize clinical images/documents to support diagnosis, treatment, claims, and history.

| Item | Description | Priority |
|---|---|---|
| File attachment | Upload or capture image/document. | V1 Required |
| Image categories | X-ray, intraoral photo, consent, referral, lab result, document. | V1 Required |
| Link to patient | Every attachment must link to patient. | V1 Required |
| Link to visit/tooth/procedure | Optional structured links to clinical context. | V1 Recommended |
| iPad camera capture | Capture from device camera where possible. | V1 Recommended |
| Preview and annotate | Basic preview; annotation may be minimal. | V1 Recommended |
| Advanced imaging tools | Measurements, AI findings, ceph tracing, DICOM support. | V2 / Deferred |

---

### 3.11 Inventory / Materials Context

**Purpose:** Provide practical, lightweight inventory support for materials and consumables.

| Item | Description | Priority |
|---|---|---|
| Inventory item | Name, category, unit, quantity, threshold. | V1 Recommended |
| Stock adjustment | Add/remove stock with reason. | V1 Recommended |
| Material usage | Link material use to completed procedure. | V1 Recommended |
| Low-stock warning | Flag items below threshold. | V1 Recommended |
| Supplier management | Supplier list and purchase orders. | V2 / Deferred |
| Full inventory accounting | Costing, batch/expiry, warehouse controls. | V2 / Deferred |

---

### 3.12 Communication & Follow-up Context

**Purpose:** Manage patient recalls, follow-ups, instructions, and tasks.

| Item | Description | Priority |
|---|---|---|
| Recall scheduling | Set next cleaning/follow-up appointment reminder. | V1 Required |
| Follow-up task | Assign staff task linked to patient/visit. | V1 Recommended |
| Post-op instructions | Template instructions for extraction, surgery, RCT, etc. | V1 Recommended |
| Manual patient messages | Record communication notes. | V1 Recommended |
| Automated messaging | SMS/email automation. | V2 / Deferred |
| Patient relationship management | Campaigns, segmented reminders, retention workflows. | V2 / Deferred |

---

### 3.13 Audit, Local-First & Sync Context

**Purpose:** Preserve trust, offline readiness, and eventual sync integrity.

| Item | Description | Priority |
|---|---|---|
| Audit log | Track create/update/delete/finalize/void actions for sensitive records. | V1 Required |
| Soft delete / reversal | Avoid hard deletion for clinical and billing records. | V1 Required |
| Local IDs | Support temporary local IDs for offline-created records. | V1 Required |
| Sync metadata | Track sync status, created locally, updated locally, server-confirmed. | V1 Required |
| Offline-safe workflows | Core clinical charting and work done should be structurally offline-ready. | V1 Required |
| Conflict preservation | Preserve conflicting versions instead of silent overwrite. | V1 Recommended |
| Conflict resolution UI | Human-friendly conflict review and resolution. | V2 / Deferred |
| Advanced peer-to-peer sync | Full CRDT/P2P implementation. | V2 / Deferred |

---

## 4. Core End-to-End Workflows

### 4.1 New Patient → First Visit → Baseline Chart → Treatment Plan

| Step | Expected Behavior | Priority |
|---|---|---|
| Register patient | Staff creates patient with required demographics and contact details. | V1 Required |
| Add medical alerts | Staff or dentist records allergies/conditions/medications. | V1 Required |
| Create appointment or walk-in | Patient is scheduled or added as walk-in. | V1 Required |
| Check in | Visit record is created or activated. | V1 Required |
| Capture chief complaint | Dentist records reason for visit. | V1 Required |
| Create baseline chart | Dentist records existing dental condition. | V1 Required |
| Add diagnoses | Diagnosis is linked to patient/tooth/surface where applicable. | V1 Required |
| Create proposed work | Treatment plan items are created from findings. | V1 Required |
| Present estimate | Plan shows procedure, fee, tooth, priority, and total. | V1 Required |
| Approve or defer | Patient accepts, partially accepts, or defers. | V1 Required |

---

### 4.2 Existing Patient → Same-Day Treatment → Billing → Recall

| Step | Expected Behavior | Priority |
|---|---|---|
| Search patient | User finds patient quickly. | V1 Required |
| Open timeline/chart | Dentist sees relevant history and alerts. | V1 Required |
| Start encounter | Visit/encounter is opened. | V1 Required |
| Record work done | Procedure is recorded with code, tooth/surface, provider, date, notes. | V1 Required |
| Link to approved plan | If plan exists, item transitions to completed. | V1 Required |
| Create invoice | Completed work generates invoice item or is added to invoice. | V1 Required |
| Record payment | Payment is captured and receipt generated. | V1 Required |
| Schedule recall | Next follow-up/cleaning is scheduled or recall reminder created. | V1 Required |

---

### 4.3 Emergency Walk-in Toothache

| Step | Expected Behavior | Priority |
|---|---|---|
| Create/find patient | Patient record is created or retrieved. | V1 Required |
| Walk-in visit | Visit starts without appointment. | V1 Required |
| Chief complaint | Toothache/emergency reason captured. | V1 Required |
| Chart finding | Tooth-level finding and diagnosis entered. | V1 Required |
| Same-day treatment | Treatment may be recorded without prior formal plan, with reason. | V1 Required |
| Billing | Charges and payment handled. | V1 Required |
| Follow-up | Follow-up appointment or task created. | V1 Required |

---

### 4.4 Treatment Plan Approval → Partial Completion

| Step | Expected Behavior | Priority |
|---|---|---|
| Open plan | Dentist/staff opens approved treatment plan. | V1 Required |
| Select item | One or more plan items selected for today. | V1 Required |
| Complete item | Item transitions from approved to completed procedure. | V1 Required |
| Keep remaining items active | Other approved items remain pending. | V1 Required |
| Update plan status | Plan becomes partially completed. | V1 Required |
| Bill completed items | Only completed billable items are invoiced unless deposit/estimate rules apply. | V1 Required |

---

### 4.5 Imaging Attachment Workflow

| Step | Expected Behavior | Priority |
|---|---|---|
| Capture/upload image | X-ray/photo/document added. | V1 Required |
| Categorize | User selects attachment type. | V1 Required |
| Link to patient | Attachment is linked to patient. | V1 Required |
| Link to tooth/visit/procedure | Optional but should be possible. | V1 Recommended |
| Preview | User can view attachment in patient context. | V1 Required |
| Use for claim readiness | Attachment can be associated with claim draft. | V1 Recommended |

---

### 4.6 Offline-Ready Clinical Workflow

| Step | Expected Behavior | Priority |
|---|---|---|
| Start local record | User can create patient/visit/chart/procedure with local ID. | V1 Required |
| Show sync status | UI indicates unsynced/local changes. | V1 Required |
| Preserve local changes | Local records are not lost on refresh/reopen. | V1 Required |
| Reconcile server ID | Local ID maps to persisted/server ID later. | V1 Required |
| Conflict-safe update | Conflicting updates do not silently overwrite clinical/billing data. | V1 Recommended |
| Conflict resolution | User-facing resolution workflow. | V2 / Deferred |

---

## 5. Business Rule Registry

### 5.1 Patient Rules

| Rule ID | Rule | Priority | Test Expectation |
|---|---|---|---|
| PAT-BR-001 | A patient must have at least name and one reliable identifier/contact method before becoming active. | V1 Required | Unit + form validation test |
| PAT-BR-002 | Minor patients should support guardian/contact linkage. | V1 Required | Unit + E2E test |
| PAT-BR-003 | Medical alerts must be visible in clinical encounter and charting contexts. | V1 Required | E2E test |
| PAT-BR-004 | Patient records should not be hard-deleted if clinical or billing history exists. | V1 Required | Unit/integration test |
| PAT-BR-005 | Duplicate patient merge must preserve history and audit trail. | V2 / Deferred | Integration test when implemented |

### 5.2 Visit / Appointment Rules

| Rule ID | Rule | Priority | Test Expectation |
|---|---|---|---|
| APT-BR-001 | An appointment must belong to a patient or a valid new-patient placeholder. | V1 Required | Unit/integration test |
| APT-BR-002 | A visit must have a lifecycle status. | V1 Required | Unit test |
| APT-BR-003 | Walk-ins must create a visit without requiring prior appointment. | V1 Required | E2E test |
| APT-BR-004 | Cancelled/no-show appointments must not create completed clinical work. | V1 Required | Integration test |
| APT-BR-005 | Checked-in patients should appear in queue or active visit list. | V1 Recommended | E2E test |

### 5.3 Clinical Encounter Rules

| Rule ID | Rule | Priority | Test Expectation |
|---|---|---|---|
| ENC-BR-001 | Clinical encounters must be linked to patient, provider, date, and visit/context. | V1 Required | Unit/integration test |
| ENC-BR-002 | Chief complaint is required for new clinical encounters unless explicitly marked as administrative/non-clinical. | V1 Required | Unit + E2E test |
| ENC-BR-003 | Finalized clinical notes should not be silently edited; edits require addendum or audit log. | V1 Required | Integration/audit test |
| ENC-BR-004 | Clinical alerts must be visible before or during treatment documentation. | V1 Required | E2E test |
| ENC-BR-005 | Specialty templates should not be required for general dentistry V1. | V1 Required | Audit expectation |

### 5.4 Dental Charting Rules

| Rule ID | Rule | Priority | Test Expectation |
|---|---|---|---|
| CHART-BR-001 | Baseline chart entries must be separate from proposed and completed work. | V1 Required | Unit + integration test |
| CHART-BR-002 | Completed work must not overwrite baseline condition. | V1 Required | Unit/integration test |
| CHART-BR-003 | Tooth-level entries must support tooth identifier, status/type, date, provider/user, and notes. | V1 Required | Unit/schema test |
| CHART-BR-004 | Surface-specific entries must validate allowed surfaces. | V1 Required | Unit test |
| CHART-BR-005 | A chart entry must be linked to patient and optionally visit/procedure depending on type. | V1 Required | Integration test |
| CHART-BR-006 | Proposed work must remain distinguishable visually and structurally from completed work. | V1 Required | UI/E2E test |
| CHART-BR-007 | Tooth history should be reconstructable from chart/procedure events. | V1 Recommended | Integration test |
| CHART-BR-008 | Pediatric and permanent dentition should be supported or clearly scoped. | V1 Required | Unit/UI test |

### 5.5 Treatment Plan Rules

| Rule ID | Rule | Priority | Test Expectation |
|---|---|---|---|
| TP-BR-001 | Treatment plan must belong to patient and provider/creator. | V1 Required | Unit/integration test |
| TP-BR-002 | Treatment plan item must have procedure, fee, status, and clinical target where applicable. | V1 Required | Unit/schema test |
| TP-BR-003 | Treatment plan status transitions must be controlled. | V1 Required | Unit test |
| TP-BR-004 | Approved items can become completed procedures; draft/unapproved items require override reason. | V1 Required | Integration/E2E test |
| TP-BR-005 | Completing one item must not automatically complete the whole plan unless all items are completed. | V1 Required | Unit/integration test |
| TP-BR-006 | Treatment estimates must show total and item-level fees. | V1 Required | E2E test |
| TP-BR-007 | Patient approval should be recorded with date/status. | V1 Required | Integration test |

### 5.6 Procedure / Work Done Rules

| Rule ID | Rule | Priority | Test Expectation |
|---|---|---|---|
| PROC-BR-001 | Completed procedure must link to patient, provider, date, and procedure code. | V1 Required | Unit/schema test |
| PROC-BR-002 | Tooth/surface is required for tooth-specific procedures. | V1 Required | Unit test |
| PROC-BR-003 | Work done should link to encounter/visit when performed during a visit. | V1 Required | Integration test |
| PROC-BR-004 | Direct same-day work without approved plan is allowed but should be auditable. | V1 Required | Integration/audit test |
| PROC-BR-005 | Completed procedures should be billable unless marked non-billable with reason. | V1 Required | Unit/integration test |
| PROC-BR-006 | Clinical corrections should use addendum/reversal, not silent deletion. | V1 Required | Integration/audit test |

### 5.7 Billing Rules

| Rule ID | Rule | Priority | Test Expectation |
|---|---|---|---|
| BILL-BR-001 | Invoice must belong to patient and contain at least one invoice item before finalization. | V1 Required | Unit/integration test |
| BILL-BR-002 | Invoice item generated from completed procedure must preserve procedure reference. | V1 Required | Integration test |
| BILL-BR-003 | Payments must link to invoice or patient account. | V1 Required | Unit/integration test |
| BILL-BR-004 | Discounts/write-offs require permission and reason. | V1 Required | Permission + audit test |
| BILL-BR-005 | Voids/refunds must be auditable. | V1 Recommended | Integration/audit test |
| BILL-BR-006 | Patient balance must reflect invoices minus payments/adjustments. | V1 Required | Unit/integration test |

### 5.8 Claims / Insurance Rules

| Rule ID | Rule | Priority | Test Expectation |
|---|---|---|---|
| CLAIM-BR-001 | Claim-ready procedure must have patient, provider, procedure code, date, fee, and tooth/surface where applicable. | V1 Recommended | Unit/integration test |
| CLAIM-BR-002 | CDT codes should be supported for dental procedure coding. | V1 Required | Schema/seed test |
| CLAIM-BR-003 | ICD-10 diagnosis linkage should be supported where required. | V1 Required | Schema/seed test |
| CLAIM-BR-004 | Attachments should be linkable to claim draft. | V1 Recommended | Integration test |
| CLAIM-BR-005 | Electronic clearinghouse submission is deferred unless explicitly in scope. | V2 / Deferred | N/A |

### 5.9 Attachment Rules

| Rule ID | Rule | Priority | Test Expectation |
|---|---|---|---|
| ATT-BR-001 | Attachment must link to patient. | V1 Required | Unit/schema test |
| ATT-BR-002 | Attachment should have category/type. | V1 Required | Unit/schema test |
| ATT-BR-003 | Attachment may link to visit, tooth, procedure, or claim draft. | V1 Recommended | Integration test |
| ATT-BR-004 | Attachment metadata should preserve filename/type/date/uploader. | V1 Required | Unit/schema test |

### 5.10 Local-First / Sync Rules

| Rule ID | Rule | Priority | Test Expectation |
|---|---|---|---|
| LF-BR-001 | Offline-created records must have stable local IDs. | V1 Required | Unit/integration test |
| LF-BR-002 | Local ID to server ID mapping must not break references. | V1 Required | Integration test |
| LF-BR-003 | Unsynced records should be visible as pending/syncing/synced/failed. | V1 Required | UI/E2E test |
| LF-BR-004 | Clinical and billing conflicts should not be silently overwritten. | V1 Recommended | Integration test |
| LF-BR-005 | Full human conflict resolution UI may be deferred. | V2 / Deferred | N/A |

### 5.11 Audit Rules

| Rule ID | Rule | Priority | Test Expectation |
|---|---|---|---|
| AUD-BR-001 | Clinical create/update/finalize/delete/reversal actions must be auditable. | V1 Required | Integration/audit test |
| AUD-BR-002 | Billing discounts, voids, refunds, and payment changes must be auditable. | V1 Required | Integration/audit test |
| AUD-BR-003 | Permission-denied attempts for sensitive operations should be detectable or logged where practical. | V1 Recommended | Permission test |
| AUD-BR-004 | Audit logs should include actor, action, target, timestamp, and before/after or reason where appropriate. | V1 Required | Unit/schema test |

---

## 6. Entity Reference Standard

These are ideal domain entities. They do not have to map 1:1 to database tables, but the system should clearly support these concepts.

### 6.1 Clinic & User Entities

| Entity | Key Fields / Concepts | Priority |
|---|---|---|
| Organization | id, name, legalName, contactInfo, address, status, settings | V1 Required |
| ClinicLocation | id, organizationId, name, address, contactInfo, status | V1 Required |
| Chair / Operatory | id, locationId, name, status | V1 Recommended |
| User | id, name, email/phone, status, auth identity | V1 Required |
| Membership | userId, organizationId, roleId, status | V1 Required |
| Role | id, name, permissions | V1 Required |
| Permission | action/resource-based permission keys | V1 Required |

### 6.2 Patient Entities

| Entity | Key Fields / Concepts | Priority |
|---|---|---|
| Patient | id, name, birthdate, sex, contactInfo, address, status, identifiers | V1 Required |
| PatientContact | patientId, name, relationship, phone/email, isGuardian, emergencyContact | V1 Required |
| MedicalAlert | patientId, type, description, severity, status | V1 Required |
| DentalAlert | patientId, type, description, status | V1 Recommended |
| ConsentRecord | patientId, consentType, status, date, attachment/signatureRef | V1 Recommended |

### 6.3 Appointment / Visit Entities

| Entity | Key Fields / Concepts | Priority |
|---|---|---|
| Appointment | patientId, providerId, locationId, chairId, start/end, reason, status | V1 Required |
| Visit | patientId, appointmentId, status, checkedInAt, startedAt, completedAt | V1 Required |
| QueueItem | visitId, chairId, providerId, status, priority | V1 Recommended |

### 6.4 Clinical Entities

| Entity | Key Fields / Concepts | Priority |
|---|---|---|
| Encounter | patientId, visitId, providerId, date, chiefComplaint, notes, status | V1 Required |
| DentalScreening | encounterId, gingivitis/perio level, remarks | V1 Required |
| OcclusionScreening | encounterId, classMolar, overjet, overbite, midlineDeviation, crossbite | V1 Recommended |
| ApplianceRecord | patientId/encounterId, type, notes, status | V1 Recommended |
| TMDScreening | encounterId, clenching, clicking, trismus, muscleSpasm, notes | V1 Recommended |
| Diagnosis | code, system, description, category, status | V1 Required |
| PatientDiagnosis | patientId, encounterId, toothId/surface, diagnosisId, notes | V1 Required |

### 6.5 Dental Chart Entities

| Entity | Key Fields / Concepts | Priority |
|---|---|---|
| Tooth | notationSystem, toothNumber, dentitionType, quadrant | V1 Required |
| ToothChartEntry | patientId, toothId, surfaces, layer, status, diagnosisId, notes, date, providerId | V1 Required |
| ChartLayer | baseline, proposed, completed | V1 Required |
| ToothHistoryEvent | patientId, toothId, eventType, refId, date, actorId | V1 Recommended |

### 6.6 Treatment / Procedure Entities

| Entity | Key Fields / Concepts | Priority |
|---|---|---|
| ProcedureCode | code, system, description, defaultFee, category, active | V1 Required |
| TreatmentPlan | patientId, providerId, status, presentedAt, approvedAt, totalEstimate | V1 Required |
| TreatmentPlanItem | planId, procedureCode, tooth/surface, diagnosisId, fee, priority, status, notes | V1 Required |
| CompletedProcedure | patientId, encounterId, providerId, procedureCode, tooth/surface, date, notes, billableStatus | V1 Required |
| MaterialUsage | procedureId, inventoryItemId, quantity, unit | V1 Recommended |

### 6.7 Billing / Claims Entities

| Entity | Key Fields / Concepts | Priority |
|---|---|---|
| Invoice | patientId, status, subtotal, discount, total, balance, issuedAt | V1 Required |
| InvoiceItem | invoiceId, procedureId, description, code, amount, discount, status | V1 Required |
| Payment | patientId, invoiceId, amount, method, reference, paidAt, status | V1 Required |
| Adjustment | invoiceId, type, amount, reason, approvedBy | V1 Recommended |
| InsuranceProfile | patientId, payer, memberId, policyInfo, coverageNotes | V1 Recommended |
| ClaimDraft | patientId, insuranceProfileId, status, total, readinessIssues | V1 Recommended |
| ClaimLine | claimDraftId, procedureId, diagnosisId, amount, tooth/surface | V1 Recommended |

### 6.8 Attachment / Inventory / Audit Entities

| Entity | Key Fields / Concepts | Priority |
|---|---|---|
| Attachment | patientId, category, fileRef, filename, mimeType, uploadedBy, createdAt | V1 Required |
| AttachmentLink | attachmentId, targetType, targetId | V1 Recommended |
| InventoryItem | name, category, unit, quantity, threshold, status | V1 Recommended |
| StockAdjustment | inventoryItemId, quantityChange, reason, actorId, date | V1 Recommended |
| Recall | patientId, type, dueDate, status, notes | V1 Required |
| Task | assigneeId, patientId, visitId, type, dueDate, status | V1 Recommended |
| AuditLog | actorId, action, targetType, targetId, timestamp, reason, before/after | V1 Required |
| SyncLog / SyncState | localId, serverId, entityType, status, lastSyncAt, error | V1 Required |

---

## 7. Permission Reference Standard

### 7.1 Standard Roles

| Role | Description | Priority |
|---|---|---|
| Owner/Admin | Full clinic setup, user management, settings, reports, overrides. | V1 Required |
| Dentist | Clinical charting, diagnoses, treatment plans, completed work, clinical notes. | V1 Required |
| Associate Dentist | Similar to dentist, with optional limitations on settings/financial overrides. | V1 Recommended |
| Hygienist | Limited clinical charting, hygiene visits, perio/cleaning-related entries. | V1 Recommended |
| Dental Assistant | Assist with encounter prep, attachments, non-final clinical support tasks. | V1 Required |
| Front Desk | Patient registration, appointments, check-in/out, basic billing, recalls. | V1 Required |
| Billing Staff | Invoices, payments, claims readiness, balances. | V1 Required |
| Read-only / Auditor | View records and audit logs without edit rights. | V1 Recommended |

### 7.2 Permission Matrix

| Area | Admin | Dentist | Assistant | Front Desk | Billing | Priority |
|---|---:|---:|---:|---:|---:|---|
| Manage clinic settings | Yes | No | No | No | No | V1 Required |
| Manage users/roles | Yes | No | No | No | No | V1 Required |
| Create/edit patient | Yes | Yes | Yes | Yes | Limited | V1 Required |
| View medical alerts | Yes | Yes | Yes | Yes | Limited | V1 Required |
| Create encounter | Yes | Yes | Limited | No | No | V1 Required |
| Edit clinical chart | Yes | Yes | Limited/assist only | No | No | V1 Required |
| Finalize clinical note | Yes | Yes | No | No | No | V1 Required |
| Create treatment plan | Yes | Yes | No/Limited | No | No | V1 Required |
| Approve treatment plan | Yes | Yes | No | No | No | V1 Required |
| Record completed procedure | Yes | Yes | Limited/assist only | No | No | V1 Required |
| Create invoice | Yes | Yes/Limited | No | Yes/Limited | Yes | V1 Required |
| Record payment | Yes | No/Limited | No | Yes | Yes | V1 Required |
| Apply discount/write-off | Yes | Limited | No | Limited | Limited | V1 Required |
| Void/refund | Yes | No | No | No/Limited | Limited | V1 Recommended |
| View audit logs | Yes | Limited | No | No | Limited | V1 Required |
| Export data | Yes | No/Limited | No | No | Limited | V1 Recommended |

---

## 8. UI/UX Reference Standard

### 8.1 Global UI Principles

| Expectation | Description | Priority |
|---|---|---|
| iPad-first layout | Works comfortably on iPad landscape and portrait, not just desktop. | V1 Required |
| Touch targets | Primary actions should have touch-friendly spacing and target size. | V1 Required |
| Carousel concept | Use carousel/module cards for major workflow entry points where it helps fast navigation. | V1 Recommended |
| Patient context persistence | When inside patient workflow, patient name, alerts, balance/status, and key actions should remain easy to access. | V1 Required |
| Fast action hierarchy | The next most likely action should be visually obvious. | V1 Required |
| Minimal modal stacking | Avoid nested modals that break iPad usability. | V1 Required |
| Clear empty states | Empty states should explain what to do next. | V1 Required |
| Offline/sync indicator | Show unobtrusive local/sync status where relevant. | V1 Required |
| No hover dependency | All controls must work without hover. | V1 Required |
| Status chips | Use clear chips for draft, approved, completed, unpaid, synced, pending, etc. | V1 Required |
| Progressive forms | Avoid overwhelming forms; reveal advanced fields when needed. | V1 Required |

### 8.2 Dashboard / Navigation Expectations

| Expectation | Description | Priority |
|---|---|---|
| Clinic command center | Dashboard should surface today’s appointments, queue, tasks, balances, recalls. | V1 Required |
| Role-aware dashboard | Dentist sees clinical work; front desk sees schedule/check-in; billing sees balances. | V1 Recommended |
| Stripe-like clarity | Use clean operational summaries, not decorative charts. | V1 Recommended |
| Linear-like workflow speed | Fast status scanning and transitions. | V1 Recommended |
| Slack-style org switcher | Useful if multi-org/membership exists. | V1 Recommended |
| Avoid enterprise dashboard bloat | Do not overfocus on analytics before core workflows are complete. | V1 Required |

### 8.3 Clinical UI Expectations

| Expectation | Description | Priority |
|---|---|---|
| Tooth chart is central | Clinical workspace should center around odontogram and patient context. | V1 Required |
| Separate layers visually | Baseline, proposed, completed should be clearly distinct. | V1 Required |
| Fast tooth selection | Dentist can select tooth/surface quickly on iPad. | V1 Required |
| Quick-add findings | Common diagnoses/procedures available in quick-add patterns. | V1 Recommended |
| Per-tooth history | Tooth timeline/history accessible without leaving chart. | V1 Recommended |
| Chairside mode | Minimize distractions for treatment-room usage. | V1 Recommended |
| Image linking | X-rays/photos can be opened from relevant tooth/visit/procedure. | V1 Recommended |

### 8.4 Billing UI Expectations

| Expectation | Description | Priority |
|---|---|---|
| From work to invoice | Completed procedures should flow naturally into invoice creation. | V1 Required |
| Clear balance | Patient balance should be obvious. | V1 Required |
| Payment-first checkout | Check-out should make payment/receipt straightforward. | V1 Required |
| Discount reason | UI should require reason if discount/write-off is applied. | V1 Required |
| Receipt preview | Basic receipt generation/preview. | V1 Required |

---

## 9. Test Expectations

### 9.1 Test Coverage Standard

| Test Type | Required Coverage | Priority |
|---|---|---|
| Unit tests | Business rules, validators, status transitions, calculations. | V1 Required |
| Integration tests | API/service/database flows across modules. | V1 Required |
| E2E tests | Critical clinic journeys from UI. | V1 Required |
| Permission tests | Role-based allow/deny for sensitive actions. | V1 Required |
| Audit tests | Clinical and billing audit trail creation. | V1 Required |
| Local-first tests | Local IDs, sync metadata, unsynced state, conflict-safe behavior. | V1 Required |
| Visual/UI tests | Key iPad layouts and dental chart interactions. | V1 Recommended |
| Seed scenario tests | Validate seed data supports full workflows. | V1 Recommended |

### 9.2 Required E2E Test Journeys

| Test ID | Journey | Priority |
|---|---|---|
| E2E-001 | Register patient → book appointment → check in → start encounter. | V1 Required |
| E2E-002 | New patient → baseline chart → diagnosis → proposed treatment plan. | V1 Required |
| E2E-003 | Approve treatment plan → complete one item → plan becomes partially completed. | V1 Required |
| E2E-004 | Completed procedure → invoice → payment → receipt → balance updates. | V1 Required |
| E2E-005 | Walk-in emergency → diagnosis → direct work done → billing → follow-up. | V1 Required |
| E2E-006 | Upload/capture attachment → link to patient/tooth/procedure → preview. | V1 Recommended |
| E2E-007 | Front desk attempts to edit clinical chart → access denied. | V1 Required |
| E2E-008 | Dentist edits/finalizes clinical note → audit log created. | V1 Required |
| E2E-009 | Offline/local record created → sync metadata visible → references preserved. | V1 Required |
| E2E-010 | Patient with unpaid balance appears correctly in dashboard/billing list. | V1 Recommended |

### 9.3 Business Rule Test Mapping

Each business rule in Section 5 should have at least one test reference or documented gap. The audit should produce a matrix:

| Rule ID | Existing Test? | Test File | Status | Gap / Recommendation |
|---|---|---|---|---|

Status values:

- `Covered`
- `Partially Covered`
- `Not Covered`
- `Not Implemented`
- `Unclear / Needs Manual Review`

---

## 10. Seed Data Expectations

Seed data should support demos, E2E tests, integration tests, and realistic UI review. It should not be random filler.

### 10.1 Required Seed Dataset

| Seed Item | Description | Priority |
|---|---|---|
| Organization | One small-to-mid dental clinic. | V1 Required |
| Users | Admin/owner, 2 dentists, assistant, front desk, billing user. | V1 Required |
| Roles/permissions | Seed role matrix aligned with this standard. | V1 Required |
| Chairs/operatories | 2–4 chairs. | V1 Recommended |
| Procedure codes | Common CDT-like procedure list and fees. | V1 Required |
| Diagnosis codes | Common dental-related ICD-10-like diagnoses or mapped diagnosis list. | V1 Required |
| Patients | 20–50 realistic patients. | V1 Required |
| Appointments | Today, this week, cancelled, no-show, completed. | V1 Required |
| Visits/encounters | Mixed completed and active encounters. | V1 Required |
| Dental charts | Baseline/proposed/completed examples. | V1 Required |
| Treatment plans | Draft, presented, approved, partially completed, completed. | V1 Required |
| Completed procedures | Linked to plan and direct same-day procedures. | V1 Required |
| Invoices/payments | Paid, unpaid, partial, discounted. | V1 Required |
| Attachments | Example x-ray/photo/document metadata. | V1 Recommended |
| Recalls/tasks | Due, overdue, completed. | V1 Required |
| Audit logs | Clinical and billing examples. | V1 Required |
| Local/sync records | Unsynced local record sample. | V1 Required |

### 10.2 Required Patient Scenarios

| Scenario | Description | Priority |
|---|---|---|
| Adult routine cleaning | Baseline chart, completed prophylaxis, recall. | V1 Required |
| Emergency toothache | Walk-in, diagnosis, same-day procedure, follow-up. | V1 Required |
| Child patient | Guardian/contact required. | V1 Required |
| Orthodontic candidate | Occlusion/appliance findings, proposed plan. | V1 Recommended |
| Patient with allergy | Medical alert visible in encounter. | V1 Required |
| Patient with unpaid balance | Billing dashboard and patient profile show balance. | V1 Required |
| Patient with approved plan | Multi-item treatment plan ready for partial completion. | V1 Required |
| Completed but unbilled work | Procedure awaiting invoice. | V1 Required |
| Patient with attachment | X-ray/photo linked to tooth or visit. | V1 Recommended |
| Offline-created record | Local ID and sync status visible. | V1 Required |

---

## 11. Audit Output Expectations

Any audit against this standard must produce:

1. Executive summary
2. Current implementation map
3. Module/context gap matrix
4. Workflow gap matrix
5. Business rule coverage matrix
6. Entity/schema gap matrix
7. Permission gap matrix
8. UI/UX gap matrix
9. Test coverage gap matrix
10. Seed data gap matrix
11. V1 readiness rating
12. Prioritized remediation roadmap
13. Clear distinction between:
    - Missing feature
    - Partially implemented feature
    - Implemented but untested
    - Tested but not production-safe
    - V2/deferred feature that should not block V1

### 11.1 V1 Readiness Rating

Use this rating scale:

| Rating | Meaning |
|---|---|
| Green | V1 Required items are mostly implemented, tested, and usable. |
| Yellow | Core is present but important V1 gaps remain. |
| Orange | Many core workflows or rules are missing/untested. |
| Red | Not production-ready for dental clinic operations. |

### 11.2 Remediation Priority

Use this priority scale:

| Priority | Meaning |
|---|---|
| P0 | Blocks safe V1 clinical/billing workflow. |
| P1 | Important V1 gap; should be fixed before production. |
| P2 | V1 recommended improvement. |
| P3 | V2/deferred; document but do not block V1. |

---

## 12. Non-Goals for V1

The following should not be forced into V1 unless explicitly required:

| Non-Goal | Reason | Priority |
|---|---|---|
| Full electronic clearinghouse submission | Claims readiness is enough for V1 unless integration is in scope. | V2 / Deferred |
| Advanced perio charting | Useful but can slow core release. | V2 / Deferred |
| Cephalometric AI workspace | Strong future module but not necessary for general clinic V1. | V2 / Deferred |
| Full orthodontic case management | Specialty workflow; defer unless target market requires it. | V2 / Deferred |
| Full inventory accounting | Basic material tracking is enough. | V2 / Deferred |
| Enterprise analytics | Operational dashboard is more important for V1. | V2 / Deferred |
| Full patient app | Good future product, not required for clinic-side V1. | V2 / Deferred |
| Complex sync conflict UI | Preserve conflicts first; advanced UI later. | V2 / Deferred |
| AI-dependent clinical decisions | Data should be AI-ready, but workflows should work without AI. | V2 / Deferred |

---

## 13. Acceptance Criteria for Production-Grade V1

Dentalemon can be considered V1 production-grade for a small-to-mid-sized dental clinic when:

1. A clinic can register patients, book visits, handle walk-ins, and maintain patient timelines.
2. Dentists can perform chairside charting on iPad without desktop-only interactions.
3. Baseline, proposed work, and completed work are structurally and visually separate.
4. Treatment plans can be created, approved, partially completed, and completed.
5. Completed procedures can become invoice items.
6. Payments and receipts can be recorded.
7. Medical alerts are visible before/during clinical work.
8. Role-based permissions prevent inappropriate clinical/billing edits.
9. Clinical and billing changes have audit trails.
10. Core records are local-first-ready using local IDs and sync metadata.
11. Critical end-to-end workflows are covered by tests.
12. Seed data supports realistic demos and automated validation.
13. V2/deferred items are documented but not mixed into V1 blockers.

---

## 14. Recommended File Location

Place this file at:

```txt
/docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md
```

Use it as the canonical reference for:

- Dentalemon module audits
- Workflow audits
- UI/UX audits
- TDD/spec-driven coverage audits
- Seed data generation prompts
- AI implementation planning
- `/oli-execution-gate` compliance checks

