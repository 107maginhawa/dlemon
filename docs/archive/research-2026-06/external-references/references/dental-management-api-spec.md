# Dental Management API — Comprehensive Reference Spec

**Version:** 1.0.0-draft  
**Date:** 2026-04-16  
**Format:** Lightweight PRD (entities + workflows + business rules + state machines + endpoints)  
**Purpose:** Handoff document for AI-assisted API generation. Covers all 48 domains of a comprehensive dental management system.  
**Output target:** Single AI-readable API spec markdown at `/dental-management-api-spec.md`

---

## How to Use This Document

This document is the **domain skeleton** for generating a full AI-readable API spec (per `ai-readable-api-spec-guide.md`). For each domain:

1. Use the **Key Entities** to define canonical schemas with typed fields, required markers, and descriptions
2. Use the **Key Workflows** to derive state machine transitions and use-case mappings
3. Use the **Key Business Rules** to populate `x-business-rules`, `x-invariants`, and field-level validations
4. Use the **State Machine** to define status enums and allowed transitions
5. Use the **Key Endpoints** to derive operationIds, methods, paths, and role annotations
6. Add request/response examples, error shapes, and FHIR mapping notes per the guide

**Do not invent** entities, business rules, or state machines not listed here. Mark gaps as `UNKNOWN` or `REQUIRES_DECISION`.

---

## AI Instruction Block

> Generate APIs only from explicitly defined requirements in this document.  
> Do not invent fields, workflows, business rules, state transitions, or permissions.  
> If something is missing, mark it as `UNKNOWN` or `REQUIRES_DECISION`.  
> Use canonical schemas, strict typing, camelCase naming, and ISO 8601 timestamps.  
> Standard error shape: `{ code, message, details }`.  
> Standard ID format: `string` (CUID or UUID — specify per domain).  
> All timestamps: ISO 8601 UTC (`createdAt`, `updatedAt`).  
> All entities include: `id`, `tenantId`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

---

## Table of Contents

### Core Shared Health Domains (1–18)
1. [Patient Management](#1-patient-management)
2. [Medical History & Health Questionnaires](#2-medical-history--health-questionnaires)
3. [Encounter / Visit](#3-encounter--visit)
4. [Practitioner](#4-practitioner)
5. [Professional Licensing & Continuing Education](#5-professional-licensing--continuing-education)
6. [Organization & Multi-Location](#6-organization--multi-location)
7. [Staff Scheduling & Workforce](#7-staff-scheduling--workforce)
8. [Scheduling](#8-scheduling)
9. [Fee Schedules & Contract Management](#9-fee-schedules--contract-management)
10. [Billing & Financial](#10-billing--financial)
11. [Document Management](#11-document-management)
12. [Communication](#12-communication)
13. [Consent Management](#13-consent-management)
14. [Prescription Management](#14-prescription-management)
15. [Audit & Compliance](#15-audit--compliance)
16. [Auth & Access Control](#16-auth--access-control)
17. [Reporting & Analytics](#17-reporting--analytics)
18. [Data Import / Export](#18-data-import--export)

### Dental-Specific Clinical Domains (19–32)
19. [Dental Charting](#19-dental-charting)
20. [Treatment Planning & Lifecycle](#20-treatment-planning--lifecycle)
21. [Periodontal Charting](#21-periodontal-charting)
22. [Orthodontic Management](#22-orthodontic-management)
23. [Endodontic Records](#23-endodontic-records)
24. [Prosthodontic Records](#24-prosthodontic-records)
25. [Oral Surgery](#25-oral-surgery)
26. [Pediatric Dentistry](#26-pediatric-dentistry)
27. [Cosmetic Dentistry](#27-cosmetic-dentistry)
28. [Clinical Imaging](#28-clinical-imaging)
29. [Implant Registry](#29-implant-registry)
30. [Clinical Decision Support](#30-clinical-decision-support)
31. [Sedation & Anesthesia Records](#31-sedation--anesthesia-records)
32. [Operatory / Chair Management](#32-operatory--chair-management)

### Dental Practice Operations (33–44)
33. [Insurance & Claims](#33-insurance--claims)
34. [Lab Orders](#34-lab-orders)
35. [Referral Management](#35-referral-management)
36. [Inventory & Supply Management](#36-inventory--supply-management)
37. [Sterilization & Infection Control](#37-sterilization--infection-control)
38. [Recall & Follow-Up](#38-recall--follow-up)
39. [Patient Portal](#39-patient-portal)
40. [Telehealth](#40-telehealth)
41. [Quality & Clinical Outcomes](#41-quality--clinical-outcomes)
42. [Patient Engagement](#42-patient-engagement)
43. [Waiting List](#43-waiting-list)
44. [Emergency Protocols](#44-emergency-protocols)

### Integration & Interoperability (45–48)
45. [FHIR / HL7 Interoperability](#45-fhir--hl7-interoperability)
46. [Webhook & Event Subscriptions](#46-webhook--event-subscriptions)
47. [External System Connectors](#47-external-system-connectors)
48. [Task & Workflow Automation](#48-task--workflow-automation)

---

## Domain Glossary

| Term | Definition |
|------|-----------|
| **Encounter** | A clinical interaction between a patient and one or more providers, anchoring all clinical records for a visit |
| **Treatment Plan** | A structured list of diagnosed conditions and proposed procedures with cost estimates, subject to patient acceptance |
| **CDT Code** | Current Dental Terminology — ADA-copyrighted procedure codes (referenced externally, not stored inline) |
| **UCR Fee** | Usual, Customary, and Reasonable fee — the practice's standard fee before insurance adjustments |
| **Write-off** | Financial reduction of a balance that is not collected, distinct from a refund or payment |
| **EOB** | Explanation of Benefits — insurer document detailing claim adjudication, patient liability, and payment |
| **Pre-authorization** | Insurer approval required before certain procedures; not a guarantee of payment |
| **COB** | Coordination of Benefits — process for patients with multiple insurance plans to determine primary/secondary payer |
| **Pocket Depth** | Millimeter measurement from gingival margin to base of periodontal sulcus |
| **CAL** | Clinical Attachment Loss — pocket depth + recession; primary indicator of periodontal disease severity |
| **BOP** | Bleeding on Probing — boolean indicator of gingival inflammation at each periodontal site |
| **Furcation** | Area where roots diverge in multi-rooted teeth; graded I–III for involvement severity |
| **FDI Notation** | International two-digit tooth numbering system (e.g., 11–48) |
| **Universal Notation** | US standard single/two-digit tooth numbering system (1–32 permanent, A–T primary) |
| **Palmer Notation** | Quadrant-based symbol system with numbers 1–8 and quadrant brackets |
| **Obturation** | Filling of root canals after shaping and cleaning; final step of root canal therapy |
| **Osseointegration** | Biological process of bone fusing to a titanium implant surface |
| **Void** | Financial reversal — marks a transaction as invalid; creates amendment record, not deletion |
| **Recall** | Scheduled follow-up appointment based on procedure history (e.g., 6-month cleaning) |
| **ASA Classification** | American Society of Anesthesiologists physical status classification (I–VI) for anesthesia risk |
| **DEA Registration** | Drug Enforcement Administration number required to prescribe controlled substances |
| **PDMP** | Prescription Drug Monitoring Program — state-run database of controlled substance prescriptions |
| **DICOM** | Digital Imaging and Communications in Medicine — standard for medical imaging files (used for CBCT) |
| **CBCT** | Cone Beam Computed Tomography — 3D dental imaging used for implants, ortho, and endo |
| **Shade Guide** | Standardized dental color reference system (e.g., VITA Classical, VITA 3D-Master, Chromascop) |
| **Tenant** | An organization (practice group) with isolated data; multi-tenancy boundary |
| **Branch** | A physical clinic location belonging to an organization/tenant |
| **Operatory** | A dental treatment room or chair unit where clinical procedures are performed |
| **Morning Huddle** | Daily pre-session team meeting; auto-generated snapshot of day's appointments, outstanding tasks, and alerts |
| **Space Maintainer** | Orthodontic appliance placed after early primary tooth loss to preserve space for permanent tooth eruption |

---

## Cross-Domain Entity Map

```
Organization (1) ──── Branch (many)
Branch (1) ──── Operatory (many)
Branch (1) ──── Practitioner (many, via PractitionerRole)
Patient (1) ──── Encounter (many)
Patient (1) ──── MedicalHistory (1)
Patient (1) ──── PatientCoverage (many)
Patient (1) ──── TreatmentPlan (many)
Patient (1) ──── DentalChart (1 per dentition type)
Encounter (1) ──── EncounterNote (many)
Encounter (1) ──── Treatment (many)
Encounter (1) ──── Invoice (1..many)
Encounter (1) ──── ImagingStudy (many)
Encounter (1) ──── SedationRecord (0..1)
TreatmentPlan (1) ──── TreatmentPlanItem (many)
TreatmentPlanItem (1) ──── Claim (0..1)
TreatmentPlanItem (1) ──── LabOrder (0..1)
Implant (1) ──── ProsthoRecord (0..1, implant-supported)
LabOrder (1) ──── ProsthoRecord (1)
Prescription (1) ──── Encounter (1)
ConsentForm (1) ──── Encounter (1)
AuditLog (*) ──── Any entity (polymorphic)
Document (*) ──── Any entity (polymorphic attachment)
```

---

## Core Shared Health Domains

---

### 1. Patient Management

**Category:** Core Shared  
**FHIR Mapping:** `Patient`, `RelatedPerson`

**Purpose:** Central registry for patient demographics, identity, status, and cross-domain references. Every clinical and administrative transaction links to a Patient record. Supports search, deduplication, merge, and anonymization.

**Key Entities:** `Patient`, `PatientIdentifier`, `PatientContact`, `PatientMergeLog`, `PatientTag`

**Key Workflows:**
- Register patient → verify identity → assign MRN → activate record
- Search for existing patient before creating (deduplication check)
- Merge duplicate records (source + target; source becomes inactive, records re-linked)
- Anonymize patient record for data retention compliance
- Transfer patient to another branch

**Key Business Rules:**
- MRN (Medical Record Number) must be unique per tenant
- Date of birth cannot be in the future
- Patient status drives access rules (inactive patients cannot book appointments)
- Soft-delete only — no hard deletes (audit and legal requirement)
- Merge requires admin role and creates immutable `PatientMergeLog`
- At least one contact method (phone or email) required

**State Machine:** `active` → `inactive` | `deceased` | `transferred` | `anonymized`  
Transitions: admin or clinician can set inactive/deceased; transfer requires target branch consent; anonymization is irreversible

**Key Endpoints:**
- `listPatients` — paginated patient list with filters (name, MRN, DOB, status)
- `createPatient` — register new patient
- `getPatientById` — full patient record
- `updatePatient` — update demographics (demographics changes logged)
- `searchPatients` — fuzzy search for deduplication
- `mergePatients` — merge source into target
- `anonymizePatient` — irreversible anonymization
- `getPatientTimeline` — chronological list of all encounters, treatments, payments

---

### 2. Medical History & Health Questionnaires

**Category:** Core Shared  
**FHIR Mapping:** `AllergyIntolerance`, `Condition`, `MedicationStatement`, `Questionnaire`, `QuestionnaireResponse`

**Purpose:** Pre-clinical health information capture — medical conditions, allergies, current medications, ASA classification, and custom intake questionnaires. Used by Clinical Decision Support for contraindication checking.

**Key Entities:** `MedicalHistory`, `Allergy`, `CurrentMedication`, `MedicalCondition`, `Questionnaire`, `QuestionnaireResponse`, `ASAClassification`

**Key Workflows:**
- Patient completes intake form (portal or in-office) → clinician reviews → flags contraindications → attaches to encounter
- Clinician updates allergy list → triggers CDS re-evaluation
- New questionnaire version published → existing signed responses remain valid under old version
- ASA classification assigned or updated by clinician at each encounter

**Key Business Rules:**
- Allergies must include: allergen name, reaction type, severity (mild/moderate/severe/life-threatening)
- ASA classification (I–VI) assigned by clinician only (not patient-editable)
- Published questionnaire templates are immutable — create new version for changes
- Signed questionnaire responses are immutable
- Medical history updates generate audit log entry
- Medications must include: drug name, dose, frequency, prescribing provider (if known)

**State Machine:**  
`Questionnaire`: `draft` → `published` → `archived`  
`QuestionnaireResponse`: `in_progress` → `submitted` → `reviewed`

**Key Endpoints:**
- `getMedicalHistory` — full medical history for a patient
- `updateMedicalHistory` — update conditions, medications list
- `listAllergies` — patient allergy list
- `createAllergy` — add allergy record
- `updateAllergy` — update severity or reaction (version-tracked)
- `listMedications` — current medication list
- `createMedication` / `updateMedication` — add/update medication
- `listQuestionnaires` — available questionnaire templates
- `submitQuestionnaireResponse` — patient or staff submits response
- `getQuestionnaireResponse` — retrieve completed response

---

### 3. Encounter / Visit

**Category:** Core Shared  
**FHIR Mapping:** `Encounter`, `Observation` (vitals)

**Purpose:** Represents a clinical interaction between a patient and one or more providers. The anchor entity for all clinical records generated during a visit — notes, treatments, prescriptions, images, and charges. Lifecycle from scheduled through locked.

**Key Entities:** `Encounter`, `EncounterNote`, `EncounterProvider`, `VitalSigns`, `ChiefComplaint`

**Key Workflows:**
- Appointment checked in → encounter created → document chief complaint → record vitals → clinical work performed → notes added → encounter completed → locked after review period
- Amendment workflow: request amendment to locked encounter → admin approves → amendment note attached (original immutable)
- Walk-in: encounter created without prior appointment

**Key Business Rules:**
- Encounter belongs to exactly one branch
- Notes cannot be edited after encounter is locked
- Locked encounters require amendment workflow for any changes (original preserved)
- Encounter duration auto-calculated from check-in/check-out timestamps
- An encounter must have at least one provider linked
- Vitals are optional but timestamped if recorded

**State Machine:** `scheduled` → `checked_in` → `in_progress` → `completed` → `locked`  
Also: `completed` → `cancelled` | `no_show` (before lock)

**Key Endpoints:**
- `listEncounters` — filter by patient, provider, date range, status
- `createEncounter` — open new encounter
- `getEncounterById` — full encounter with notes and providers
- `updateEncounter` — update chief complaint, status
- `lockEncounter` — finalize and lock (irreversible without amendment)
- `addEncounterNote` — SOAP or free-text clinical note
- `getEncounterNotes` — all notes for encounter
- `recordVitals` — blood pressure, pulse, O2, weight, height

---

### 4. Practitioner

**Category:** Core Shared  
**FHIR Mapping:** `Practitioner`, `PractitionerRole`

**Purpose:** Staff and provider profiles including credentials, specialties, and active status. Referenced by scheduling, clinical records, billing, and prescriptions.

**Key Entities:** `Practitioner`, `PractitionerRole`, `Specialty`, `Credential`, `PractitionerAvailability`

**Key Workflows:**
- Onboard practitioner → assign roles and specialties → link to organization/branch → set availability → activate
- Deactivate practitioner on departure (appointments must be reassigned first)
- Role change: update PractitionerRole (previous role retained in history)

**Key Business Rules:**
- Practitioner must have at least one active role
- Dental clinical procedures require a licensed provider (dentist/hygienist per procedure type — REQUIRES_DECISION on enforcement level)
- Deactivated practitioners cannot be booked for future appointments
- Credentials must include: type, issuing body, issue date, expiry date
- NPI (National Provider Identifier) required for billing-enabled practitioners

**State Machine:** `pending_onboarding` → `active` → `on_leave` → `inactive` | `terminated`

**Key Endpoints:**
- `listPractitioners` — filter by role, specialty, branch, status
- `createPractitioner` — onboard new practitioner
- `getPractitionerById` — full profile with roles and credentials
- `updatePractitioner` — update profile fields
- `deactivatePractitioner` — soft deactivate
- `listPractitionerRoles` — roles assigned to a practitioner
- `assignRole` — add role to practitioner
- `getPractitionerSchedule` — availability and upcoming appointments

---

### 5. Professional Licensing & Continuing Education

**Category:** Core Shared  
**FHIR Mapping:** dental-native (no direct FHIR mapping)

**Purpose:** Tracks state dental board licenses, DEA registration, malpractice insurance, ADA and state association memberships, and CE credit requirements. Generates renewal alerts and compliance status reports for regulatory audits.

**Key Entities:** `License`, `DEARegistration`, `MalpracticeInsurance`, `ContinuingEducationCredit`, `AssociationMembership`, `RenewalAlert`

**Key Workflows:**
- Add license → set expiry → system schedules renewal alerts → practitioner renews → update license record
- Upload CE credit certificate → log hours and category → track against state board requirements
- Add association membership (ADA, state dental association, specialty board) → track membership number and renewal
- Generate compliance status report per practitioner

**Key Business Rules:**
- License expiry generates alerts at 90, 60, and 30 days before expiration
- DEA registration required for controlled substance prescribing (checked by Prescription domain)
- CE credits tracked by: hours, category (clinical/ethics/infection control), completion date, provider
- State board requirements configurable per license type and state (REQUIRES_DECISION on pre-loaded rule set)
- Membership number unique per association per practitioner
- Expired licenses set to `expired` status automatically (scheduled job)

**State Machine:** `License`: `active` → `expiring_soon` → `expired` | `renewed`  
`RenewalAlert`: `pending` → `acknowledged` | `dismissed`

**Key Endpoints:**
- `listLicenses` — all licenses for a practitioner
- `createLicense` — add new license
- `updateLicense` — update or renew
- `listCECredits` — CE history for a practitioner
- `addCECredit` — log CE completion
- `getComplianceStatus` — summary of licenses, DEA, CE, memberships — compliant/at-risk/non-compliant
- `listMemberships` — association memberships
- `createMembership` / `updateMembership` — add or renew membership
- `listRenewalAlerts` — active alerts filterable by type and practitioner

---

### 6. Organization & Multi-Location

**Category:** Core Shared  
**FHIR Mapping:** `Organization`, `Location`

**Purpose:** Defines the practice hierarchy — organization (practice group), branches (clinic locations), and their settings. Supports multi-tenant isolation, locale configuration, inter-branch patient operations, and consolidated reporting.

**Key Entities:** `Organization`, `Branch`, `BranchSettings`, `InterBranchTransfer`, `OrganizationSettings`

**Key Workflows:**
- Create organization → configure settings → add branches → configure each branch independently
- Transfer patient between branches (with consent) → clinical records remain accessible across branches
- View consolidated dashboard across all branches (admin role)
- Manage shared resources (practitioners working across branches)

**Key Business Rules:**
- Every clinical record belongs to exactly one branch (billing and compliance boundary)
- Organization is the primary billing and tax entity
- Patient can be active across multiple branches (shared identity, branch-local appointments)
- Inter-branch patient transfer requires documented patient consent
- Branch settings override organization defaults (locale, fee schedule, notification templates)
- Branch cannot be deleted if it has active patients or appointments (must be suspended first)

**State Machine:** `Branch`: `setup` → `active` → `suspended` → `closed`

**Key Endpoints:**
- `getOrganization` — organization profile and settings
- `updateOrganization` — update org-level settings
- `listBranches` — all branches in the organization
- `createBranch` — add new clinic location
- `getBranchById` — branch profile with settings
- `updateBranch` — update branch settings
- `transferPatient` — initiate inter-branch transfer
- `getConsolidatedDashboard` — cross-branch KPIs and metrics
- `listBranchSettings` — configuration for a branch

---

### 7. Staff Scheduling & Workforce

**Category:** Core Shared  
**FHIR Mapping:** dental-native (no direct FHIR mapping)

**Purpose:** Manages provider and staff working hours, shift templates, time-off requests, and operatory/chair assignments. Distinct from patient appointment scheduling — this is the workforce layer that drives appointment availability.

**Key Entities:** `WorkSchedule`, `Shift`, `TimeOffRequest`, `AvailabilityTemplate`, `StaffAssignment`

**Key Workflows:**
- Create availability template per staff → generate weekly schedule → publish → staff views their schedule
- Staff submits PTO request → manager approves/denies → schedule updated → patient appointment slots affected
- Assign staff (provider, hygienist, assistant) to operatories per shift

**Key Business Rules:**
- Shift cannot overlap with another shift for the same staff member
- PTO approval required from admin or manager role
- Schedule must be published a configurable number of days in advance (default: 7 days)
- Operatory assignment conflicts (two providers booked same chair same time) must be flagged
- Deactivated staff cannot have future shifts created

**State Machine:**  
`TimeOffRequest`: `pending` → `approved` | `denied`  
`Shift`: `draft` → `published` → `completed` | `cancelled`

**Key Endpoints:**
- `listWorkSchedules` — schedules by staff member, branch, date range
- `createWorkSchedule` — define schedule for a staff member
- `getWorkScheduleById`
- `listShifts` — filter by branch, date, staff
- `createShift` / `updateShift`
- `requestTimeOff` — staff submits PTO request
- `approveTimeOff` / `denyTimeOff`
- `getStaffAvailability` — returns availability slots for a staff member on a date range (consumed by Scheduling domain)

---

### 8. Scheduling

**Category:** Core Shared  
**FHIR Mapping:** `Appointment`, `Schedule`, `Slot`

**Purpose:** Patient appointment booking across all appointment types — new patient, recall, treatment, specialist, emergency, and walk-in. Includes availability engine, conflict detection, recurring appointments, and waiting room management.

**Key Entities:** `Appointment`, `AppointmentSlot`, `AppointmentType`, `RecurringAppointment`, `WalkIn`, `WaitingRoomEntry`

**Key Workflows:**
- Check availability → select slot → book appointment → send confirmation → patient checks in → appointment progresses through encounter lifecycle
- Cancel appointment with reason → slot freed → waiting list notified
- Reschedule → cancel old slot → book new slot
- Walk-in: create appointment retroactively at check-in time

**Key Business Rules:**
- A slot can hold only one active appointment
- Appointments cannot be booked in the past (walk-in creation is an exception with retroactive timestamp)
- Cancelled appointments free the slot immediately
- No-show status triggers recall workflow (see Recall domain)
- Appointment type defines minimum duration (provider's schedule must accommodate)
- Double-booking requires explicit admin override with reason

**State Machine:** `scheduled` → `confirmed` → `checked_in` → `in_progress` → `completed` | `cancelled` | `no_show` | `rescheduled`

**Key Endpoints:**
- `listAppointments` — filter by patient, provider, branch, date range, status
- `createAppointment` — book new appointment
- `getAppointmentById`
- `updateAppointment` — change type, notes, duration
- `cancelAppointment` — cancel with reason code
- `checkAvailability` — returns available slots for given provider/date/duration
- `rescheduleAppointment` — atomic cancel + rebook
- `createWalkIn` — register same-day walk-in
- `getCalendarView` — day/week/month view for branch or provider
- `listAppointmentTypes` — available appointment type configurations

---

### 9. Fee Schedules & Contract Management

**Category:** Core Shared  
**FHIR Mapping:** `ChargeItemDefinition` (partial)

**Purpose:** UCR fee tables, insurance contract rates, provider-specific fee overrides, write-off policies, and multi-location fee assignment. Drives billing accuracy and insurance claim reconciliation.

**Key Entities:** `FeeSchedule`, `FeeScheduleItem`, `InsuranceContract`, `UCRFee`, `WriteOffPolicy`, `FeeOverride`

**Key Workflows:**
- Create UCR fee schedule → add CDT code fees → set effective date → activate
- Negotiate insurance contract → create contract with payer → link lower contracted rates per CDT code
- Override fee for specific provider or branch
- Sunset old fee schedule when new one activates

**Key Business Rules:**
- Fee schedule must have `effectiveDate` and optionally `expiryDate`
- CDT code must be valid before a fee can be created for it (CDT codeset referenced externally — ADA copyright)
- Fee schedule items are immutable after activation — create new schedule version for changes
- Insurance contract rate cannot exceed UCR fee for the same CDT code
- Multiple fee schedules can coexist with non-overlapping effective dates
- Write-off policies define: maximum write-off percentage, required authorization role

**State Machine:** `FeeSchedule`: `draft` → `active` → `expired` | `superseded`

**Key Endpoints:**
- `listFeeSchedules` — filter by type (UCR, insurance, provider), status
- `createFeeSchedule`
- `getFeeScheduleById`
- `addFeeScheduleItem` — add CDT code + fee to schedule
- `activateFeeSchedule` — set as active (supersedes previous)
- `listInsuranceContracts` — payer contracts
- `createInsuranceContract` / `updateInsuranceContract`
- `getFeeForProcedure` — resolve effective fee for CDT code + patient coverage + date
- `listFeeOverrides` — provider or branch-level overrides

---

### 10. Billing & Financial

**Category:** Core Shared  
**FHIR Mapping:** `Invoice`, `PaymentNotice`, `PaymentReconciliation`

**Purpose:** Invoicing, payment collection, payment plans, discounts, write-offs, receipts, and third-party financing (CareCredit, Sunbit). Covers both patient-pay and insurance-pay workflows.

**Key Entities:** `Invoice`, `InvoiceLineItem`, `Payment`, `PaymentPlan`, `PaymentPlanInstallment`, `Discount`, `WriteOff`, `Receipt`, `Amendment`

**Key Workflows:**
- Generate invoice from encounter/treatment → apply insurance adjustments → present patient portion → collect payment → issue receipt
- Set up payment plan → schedule installments → auto-alert on missed installment
- Process refund → generate amendment record
- Write off uncollectable balance → authorization required above threshold

**Key Business Rules:**
- Invoice total must equal sum of line items at all times (invariant)
- Payment cannot exceed outstanding invoice balance
- Discounts above a configurable threshold require authorization from admin/manager
- Voided payments create an `Amendment` record — original payment record is immutable
- Payment plan installments must sum to the plan total
- Receipts are generated on payment completion and cannot be modified

**State Machine:**  
`Invoice`: `draft` → `issued` → `partially_paid` → `paid` | `voided` | `written_off`  
`Payment`: `pending` → `completed` | `failed` | `refunded`  
`PaymentPlan`: `active` → `completed` | `defaulted` | `cancelled`

**Key Endpoints:**
- `listInvoices` — filter by patient, status, date range
- `createInvoice` — generate from encounter or manual
- `getInvoiceById`
- `voidInvoice` — void with reason (creates amendment)
- `listPayments` — filter by invoice, patient, method, date
- `createPayment` — post payment (cash, card, insurance)
- `refundPayment` — reverse payment with reason
- `createPaymentPlan` — set up installment schedule
- `listPaymentPlans`
- `applyDiscount` — apply percentage or fixed discount to invoice line
- `generateReceipt` — produce receipt for payment

---

### 11. Document Management

**Category:** Core Shared  
**FHIR Mapping:** `DocumentReference`

**Purpose:** Secure storage and retrieval of attachments across all domains — consent forms, referral letters, lab reports, X-ray files, intake PDFs. Supports file categories, galleries, access control, and HIPAA-compliant storage.

**Key Entities:** `Document`, `DocumentCategory`, `DocumentGallery`, `DocumentAccess`, `DocumentVersion`

**Key Workflows:**
- Upload document → classify by category → attach to one or more entities (patient, encounter, treatment) → make available for retrieval
- Generate signed URL for time-limited access (external sharing)
- Archive old document version when new version uploaded
- Audit log generated on every document access

**Key Business Rules:**
- Documents are immutable after upload — new upload creates new version (previous retained)
- Document must be attached to at least one entity (patient, encounter, treatment, etc.)
- PHI documents require audit log entry on every access (not just modification)
- Signed URLs expire after 24 hours (configurable)
- Maximum file size configurable per document category
- Deleted documents are soft-deleted (retained for configurable retention period)

**State Machine:** `Document`: `uploading` → `active` → `archived` | `soft_deleted`

**Key Endpoints:**
- `listDocuments` — filter by patient, entity type, category
- `uploadDocument` — initiate upload with metadata
- `getDocumentById`
- `archiveDocument`
- `listDocumentCategories`
- `createDocumentCategory`
- `getDownloadUrl` — generate signed URL
- `attachToEntity` — link document to an entity
- `listEntityDocuments` — all documents for a specific entity

---

### 12. Communication

**Category:** Core Shared  
**FHIR Mapping:** `Communication`, `CommunicationRequest`

**Purpose:** Outbound notifications, appointment reminders, recall notices, and secure patient messaging across channels (SMS, email, in-app, push). Template management and delivery tracking included.

**Key Entities:** `Message`, `MessageTemplate`, `NotificationRule`, `DeliveryLog`, `CommunicationChannel`, `MessageThread`

**Key Workflows:**
- Internal event triggers notification rule → render template with patient data → send via preferred channel → log delivery outcome
- Patient replies → message added to thread → staff notified
- Bulk recall campaign → batch messages queued and sent → outcomes tracked

**Key Business Rules:**
- Patient communication requires opt-in per channel (SMS, email, push)
- PHI must not appear in SMS body (regulatory constraint)
- Message templates must be approved (status `active`) before use in automated rules
- Delivery failures retry up to a configurable maximum (default: 3 attempts, exponential backoff)
- Opt-out is immediate and permanent unless patient explicitly re-opts in
- Bulk messages rate-limited per provider account (REQUIRES_DECISION on limits)

**State Machine:**  
`Message`: `queued` → `sending` → `delivered` | `failed` | `bounced`  
`MessageTemplate`: `draft` → `active` → `archived`

**Key Endpoints:**
- `sendMessage` — send ad-hoc message to patient
- `listMessages` — filter by patient, channel, status, date
- `getMessageById`
- `listMessageTemplates`
- `createTemplate` / `updateTemplate`
- `listDeliveryLogs` — delivery attempts for a message
- `listThreads` — secure message threads
- `getThread` — full thread with replies
- `replyToThread`
- `updateCommunicationPreferences` — patient channel opt-in/out

---

### 13. Consent Management

**Category:** Core Shared  
**FHIR Mapping:** `Consent`

**Purpose:** Procedure-specific informed consent, general treatment consent, privacy notices, and HIPAA authorization. Supports e-signature, template versioning, and consent withdrawal tracking.

**Key Entities:** `ConsentForm`, `ConsentTemplate`, `Signature`, `ConsentWithdrawal`, `ConsentEvent`

**Key Workflows:**
- Select consent template → generate form for patient → send for signature (in-office tablet or remote portal link) → patient signs → attach to encounter
- Patient withdraws consent → document reason and date → clinical team alerted
- Audit consent history for patient

**Key Business Rules:**
- Procedure cannot be marked `completed` without a signed consent form (configurable per procedure type)
- Consent templates are versioned — new version does not invalidate previously signed consents (signed under version N remains valid)
- Withdrawal must include: reason, date, requesting party
- E-signature must capture: patient name, IP address, timestamp, device type
- Minors require guardian signature — guardian identity documented
- Consent expiry configurable per template type (e.g., annual general consent)

**State Machine:** `ConsentForm`: `generated` → `sent` → `signed` → `active` | `withdrawn` | `expired`

**Key Endpoints:**
- `listConsentForms` — filter by patient, status, procedure type
- `createConsentForm` — generate from template
- `getConsentFormById`
- `signConsent` — record e-signature
- `withdrawConsent` — document withdrawal
- `listConsentTemplates`
- `createConsentTemplate` / `updateConsentTemplate`
- `publishConsentTemplate` — activate new template version
- `getConsentHistory` — full consent timeline for patient

---

### 14. Prescription Management

**Category:** Core Shared  
**FHIR Mapping:** `MedicationRequest`, `Medication`

**Purpose:** Drug prescribing for dental practitioners — antibiotics, analgesics, anti-inflammatories, and controlled substances. Includes drug-allergy interaction checking, formulary reference, Surescripts e-prescribing, and PDMP reporting.

**Key Entities:** `Prescription`, `Drug`, `Formulary`, `DrugInteractionAlert`, `PharmacyNetwork`, `PDMPReport`

**Key Workflows:**
- Clinician selects drug → system checks allergy + interaction → checks formulary coverage → clinician writes and signs prescription → sends electronically to pharmacy (Surescripts) or prints
- Controlled substance: prescription triggers PDMP state submission
- Patient or pharmacy requests refill → clinician reviews → approves or denies

**Key Business Rules:**
- Active DEA registration required to prescribe controlled substances (validated against Licensing domain)
- Drug-allergy check is mandatory and must be acknowledged before prescription is signed
- Controlled substances trigger PDMP submission (state-specific; configurable per state)
- Prescription cannot be backdated beyond the current day
- E-prescribing via Surescripts requires active Surescripts connector (External Connectors domain)
- Prescriptions are immutable after signing — cancel and re-prescribe for changes

**State Machine:** `Prescription`: `draft` → `signed` → `sent` → `dispensed` | `cancelled` | `expired`

**Key Endpoints:**
- `listPrescriptions` — filter by patient, drug class, date, status
- `createPrescription` — draft prescription
- `getPrescriptionById`
- `signPrescription` — finalize and sign
- `cancelPrescription` — cancel with reason
- `checkDrugInteractions` — check against patient's allergy and medication list
- `searchFormulary` — look up drugs with coverage information
- `sendEPrescription` — transmit to pharmacy via Surescripts
- `refillPrescription` — create refill from existing prescription
- `getPDMPReport` — retrieve or generate PDMP submission record

---

### 15. Audit & Compliance

**Category:** Core Shared  
**FHIR Mapping:** `AuditEvent`, `Provenance`

**Purpose:** Immutable audit trail for all record access, modifications, and deletions across the system. Supports HIPAA audit requirements, OSHA compliance, data retention policies, and government reporting.

**Key Entities:** `AuditLog`, `DataRetentionPolicy`, `ComplianceReport`, `AccessLog`, `GovernmentSubmission`

**Key Workflows:**
- Every write or PHI read → system generates audit log entry automatically (not manually triggered)
- Compliance officer runs access report → identifies unusual access patterns
- Data retention sweep (scheduled) → archives or anonymizes records past retention period
- Generate OSHA or state health department submission

**Key Business Rules:**
- Audit logs are immutable — no update or delete operations (append-only)
- Every log entry must capture: actor ID, action type, resource type, resource ID, timestamp, IP address, tenant ID
- PHI access must be logged (not just writes)
- Retention period configurable per data class (clinical records: minimum 7 years; REQUIRES_DECISION on jurisdiction-specific defaults)
- Government submissions are idempotent (resubmission allowed with same submission ID)

**State Machine:** No state machine — append-only log

**Key Endpoints:**
- `listAuditLogs` — filter by actor, resource type, action, date range
- `getAuditLogById`
- `searchAuditLogs` — full-text search across log entries
- `getAccessReport` — PHI access summary for a patient (for patient rights requests)
- `listRetentionPolicies`
- `createRetentionPolicy` / `updateRetentionPolicy`
- `generateComplianceReport` — HIPAA, OSHA, or custom compliance report
- `listGovernmentSubmissions`

---

### 16. Auth & Access Control

**Category:** Core Shared  
**FHIR Mapping:** dental-native (no direct FHIR mapping)

**Purpose:** Authentication (password, PIN, SSO, MFA), session management, RBAC with per-branch role scoping, permission management, lockout policies, and break-glass emergency access.

**Key Entities:** `User`, `Role`, `Permission`, `Session`, `MFADevice`, `AccessPolicy`, `BreakGlassLog`

**Key Workflows:**
- Login → MFA challenge → issue session token → token validated on every request
- Failed login threshold → account locked → admin unlocks or time-based auto-unlock
- Break-glass: emergency access override → all activity during break-glass session logged and alerted
- Role assignment: admin assigns role to user at branch level → permissions take effect immediately

**Key Business Rules:**
- Session expires after configurable idle timeout (default: 30 minutes for clinical roles)
- Maximum failed login attempts before lockout (configurable; default: 5)
- MFA required for admin and clinical roles (enforced, not optional)
- Permissions are always tenant-scoped (no cross-tenant access)
- Break-glass access must include stated reason and generates immediate alert to compliance admin
- Role changes are effective immediately (no cache delay)

**State Machine:**  
`Session`: `active` → `expired` | `revoked`  
`User`: `active` → `locked` → `active` (unlocked) | `deactivated`

**Key Endpoints:**
- `login` — authenticate user, returns session token
- `logout` — revoke session
- `refreshToken` — extend session
- `listMFADevices` — enrolled MFA devices for user
- `enrollMFA` / `verifyMFA` — enroll and verify MFA device
- `listRoles` — available roles in tenant
- `createRole` / `updateRole`
- `assignRole` — assign role to user (scoped to branch)
- `listPermissions` — permissions in a role
- `updatePermissions`
- `lockUser` / `unlockUser`
- `triggerBreakGlass` — log emergency access event

---

### 17. Reporting & Analytics

**Category:** Core Shared  
**FHIR Mapping:** `MeasureReport` (partial)

**Purpose:** Configurable production reports, KPI dashboards, collections reports, and scheduled exports. Supports date range filtering, multi-location aggregation, and export to CSV or PDF.

**Key Entities:** `Report`, `ReportTemplate`, `Dashboard`, `KPIWidget`, `ScheduledReport`, `ExportJob`

**Key Workflows:**
- Select report template → set date range and filters → run report → view results in browser or export
- Pin KPIs to dashboard (production per provider, collections rate, new patients, etc.)
- Schedule recurring report → runs in background → results available for download
- Export report to CSV or PDF with time-limited download link

**Key Business Rules:**
- Reports are strictly tenant-scoped (no cross-tenant data exposure)
- Scheduled reports run asynchronously (results stored, not delivered in real time)
- KPI widgets must define: metric name, aggregation function (sum/avg/count), time window
- Export download links have configurable TTL (default: 24 hours)
- Report access controlled by role (e.g., collections report visible only to admin/biller)

**State Machine:**  
`ExportJob`: `queued` → `processing` → `ready` → `expired`  
`ScheduledReport`: `active` → `paused` → `cancelled`

**Key Endpoints:**
- `listReportTemplates` — available report types
- `createReport` — run ad-hoc report
- `getReportById`
- `listDashboards`
- `createDashboard` / `updateDashboard`
- `addKPIWidget` / `updateKPIWidget`
- `scheduleReport` — set recurring report
- `listScheduledReports`
- `exportReport` — create export job
- `getExportDownloadUrl` — retrieve time-limited download URL

---

### 18. Data Import / Export

**Category:** Core Shared  
**FHIR Mapping:** FHIR Bulk Data Access (`$export` operation, R4)

**Purpose:** Bulk patient data migration, practice data export for compliance or acquisition, CSV/JSON import of historical records from previous practice management software.

**Key Entities:** `ImportJob`, `ExportJob`, `ImportTemplate`, `MigrationMapping`, `ValidationReport`

**Key Workflows:**
- Upload data file (CSV/JSON) → validate against import template schema → map fields to internal schema → dry-run preview (show what would change) → commit import
- Export all patient records → generates compliance data package → encrypted download
- Abandoned imports can be cancelled before commit

**Key Business Rules:**
- Import is transactional per batch — all records commit or all rollback (configurable batch size)
- Dry-run is mandatory before commit (cannot skip)
- Duplicate patient detection runs during import (matches on name + DOB + contact)
- Export includes full audit trail for the exported records
- PII in transit must be encrypted (TLS 1.2 minimum)
- Import jobs expire if not committed within 48 hours of dry-run

**State Machine:** `ImportJob`: `uploaded` → `validating` → `preview_ready` → `dry_run` → `committed` | `failed` | `cancelled`

**Key Endpoints:**
- `createImportJob` — initiate import job
- `getImportJobById`
- `uploadImportFile` — attach data file to job
- `previewImport` — dry-run, returns what would be created/updated
- `commitImport` — finalize import
- `cancelImportJob`
- `createExportJob` — initiate bulk export
- `getExportJobById`
- `downloadExport` — download completed export
- `listImportTemplates` — available import format templates

---

## Dental-Specific Clinical Domains

---

### 19. Dental Charting

**Category:** Dental-Clinical  
**FHIR Mapping:** dental-native (`Observation` with dental profile extensions)

**Purpose:** The core clinical record of tooth states, conditions, restorations, and planned procedures using dental notation systems (FDI/Universal/Palmer). Supports primary, permanent, and mixed dentition. Chart snapshots enable clinical comparison over time.

**Key Entities:** `DentalChart`, `ToothRecord`, `ToothCondition`, `ToothRestoration`, `ChartSnapshot`, `Surface`, `DentitionType`

**Key Workflows:**
- Open patient chart → record conditions per tooth and surface → link planned treatments → take chart snapshot for baseline
- Switch notation system view (FDI/Universal/Palmer) — display preference only, data stored in canonical notation
- Compare snapshots across visits to track clinical progression

**Key Business Rules:**
- Chart auto-initialized on first encounter with 32 permanent tooth slots (or 20 primary, depending on patient age — REQUIRES_DECISION on auto-detection threshold)
- Conditions have a start date; treated or extracted conditions retain history
- Restorations reference a `TreatmentPlan` item (cannot exist without a treatment record)
- Chart entries are read-only after encounter is locked (amendment workflow required)
- Surfaces: M (mesial), D (distal), O (occlusal), B/F (buccal/facial), L/P (lingual/palatal), I (incisal)
- Notation system is an organization-level preference; all records stored in FDI internally (REQUIRES_DECISION)

**State Machine:**  
`ToothCondition`: `active` → `treated` | `extracted` | `monitoring`  
`ChartSnapshot`: immutable upon creation

**Key Endpoints:**
- `getPatientChart` — full chart with all tooth records
- `updateToothRecord` — update tooth-level status (present, missing, implant, etc.)
- `addToothCondition` — record new condition on a tooth/surface
- `updateToothCondition` — update condition status
- `addRestoration` — record completed restoration
- `takeChartSnapshot` — create point-in-time snapshot
- `listChartSnapshots` — list snapshots with dates
- `getChartSnapshot` — retrieve snapshot contents
- `convertNotationView` — return chart data in requested notation system (FDI/Universal/Palmer)

---

### 20. Treatment Planning & Lifecycle

**Category:** Dental-Clinical  
**FHIR Mapping:** `CarePlan`, `ServiceRequest`

**Purpose:** End-to-end lifecycle from diagnosis through procedure completion — grouping procedures into plans, estimating costs, presenting to patients, tracking acceptance item by item, carrying over incomplete items between visits.

**Key Entities:** `TreatmentPlan`, `TreatmentPlanItem`, `Diagnosis`, `TreatmentEstimate`, `CasePresentation`, `CarryOver`

**Key Workflows:**
- Diagnose conditions → create treatment plan → add items with CDT codes → generate cost estimate → present plan to patient → record patient acceptance per item → schedule accepted items → complete items on subsequent visits
- Carry over unfinished items to next encounter
- Dismiss items patient declines (requires reason)

**Key Business Rules:**
- Treatment plan must reference at least one diagnosis
- Cost estimate must reference an active fee schedule
- Patient acceptance is item-level (partial acceptance is valid)
- Completed items are immutable
- Dismissed items require: reason, dismissing clinician, date
- One active plan per tooth-condition combination at a time (prevents duplicate planning)
- Carry-over creates a link to the originating plan item (not a duplicate)

**State Machine:**  
`TreatmentPlan`: `draft` → `presented` → `active` → `completed` | `dismissed`  
`TreatmentPlanItem`: `planned` → `accepted` | `declined` → `scheduled` → `in_progress` → `completed` | `dismissed`

**Key Endpoints:**
- `listTreatmentPlans` — filter by patient, status, date range
- `createTreatmentPlan`
- `getTreatmentPlanById`
- `addPlanItem` — add CDT code procedure to plan
- `updatePlanItem` — update status or details
- `presentTreatmentPlan` — mark as presented to patient (locks draft)
- `recordPatientAcceptance` — record item-level accept/decline
- `completeTreatmentItem` — mark item as done (links to encounter)
- `generateEstimate` — calculate cost estimate using active fee schedule and patient coverage
- `getCasePresentation` — summary format for patient-facing presentation

---

### 21. Periodontal Charting

**Category:** Dental-Clinical  
**FHIR Mapping:** dental-native (`Observation` with periodontal profile extensions)

**Purpose:** Clinical measurement of periodontal health — pocket depths, bleeding on probing (BOP), recession, clinical attachment loss (CAL), mobility grades, and furcation involvement. Enables comparison across exams to track disease progression or improvement.

**Key Entities:** `PerioExam`, `PerioSite`, `PerioMeasurement`, `BOP`, `RecessionMeasurement`, `FurcationRecord`, `MobilityRecord`, `PerioComparison`

**Key Workflows:**
- Initiate perio exam → record 6 sites per tooth (MB, B, DB, ML, L, DL) → system calculates CAL from pocket + recession → flag pathological readings → complete exam → lock
- Compare two exams to identify improvement or progression
- Generate perio chart report for patient or referral

**Key Business Rules:**
- 6 sites per tooth, standard positions: MB (mesio-buccal), B (buccal), DB (disto-buccal), ML (mesio-lingual), L (lingual), DL (disto-lingual)
- Pocket depth range: 1–12 mm (values outside flagged as data entry error)
- CAL = recession (mm) + pocket depth (mm); calculated automatically
- Furcation grades: I (early, probe enters slightly), II (moderate, probe enters but not through), III (through-and-through)
- Mobility grades: 0 (none), 1 (slight, <1mm), 2 (moderate, 1–2mm), 3 (severe, >2mm or vertical)
- BOP recorded as boolean per site
- Exam requires: date, examiner (practitioner ID), and must be linked to an encounter
- Comparison requires minimum 2 completed exams for the same patient

**State Machine:** `PerioExam`: `in_progress` → `completed` → `locked`

**Key Endpoints:**
- `listPerioExams` — filter by patient, date range
- `createPerioExam` — initiate new exam
- `getPerioExamById`
- `recordPerioSite` — record measurements for one site
- `bulkUpdatePerioSites` — batch record all sites for an exam
- `completePerioExam` — finalize exam
- `comparePerioExams` — delta report between two exams
- `getPerioReport` — formatted chart output for patient/referral
- `listPerioExamsByPatient`

---

### 22. Orthodontic Management

**Category:** Dental-Clinical  
**FHIR Mapping:** dental-native (`CarePlan` with orthodontic extensions)

**Purpose:** End-to-end orthodontic case management — appliance selection, treatment stage tracking, progress documentation, aligner series (Invisalign/clear aligner) tray management, retention phase, and cephalometric reference documentation.

**Key Entities:** `OrthoCase`, `OrthoStage`, `Appliance`, `ProgressRecord`, `AlignerSeries`, `AlignerTray`, `RetentionRecord`, `CephalometricReference`

**Key Workflows:**
- Initiate ortho case → select appliance type (braces, clear aligners, functional appliance) → define treatment stages → track progress per visit → upload progress photos per stage → transition to retention phase → complete case
- Aligner series: define total tray count → activate trays sequentially → track wear compliance → advance to next tray

**Key Business Rules:**
- Case must have a treatment start date
- Aligner tray numbers must be sequential (no gaps on activation)
- Active tray cannot be skipped without documented clinical reason
- Retention phase can only start after active treatment is completed
- Progress photos required per stage (configurable — REQUIRES_DECISION on enforcement)
- Case completion requires all defined stages to be marked done
- Cephalometric reference is for documentation only (not analyzed within the system — links to external analysis file)

**State Machine:**  
`OrthoCase`: `assessment` → `active_treatment` → `retention` → `completed` | `discontinued`  
`AlignerTray`: `pending` → `active` → `completed` | `skipped`

**Key Endpoints:**
- `listOrthoCases` — filter by patient, status
- `createOrthoCase`
- `getOrthoCaseById`
- `updateOrthoCase`
- `addOrthoStage` / `updateOrthoStage`
- `recordProgress` — document progress visit with notes and photos
- `listAlignerSeries` — aligner series for a case
- `createAlignerSeries`
- `advanceAlignerTray` — mark current tray complete, activate next
- `startRetention` — transition case to retention phase
- `completeOrthoCase`

---

### 23. Endodontic Records

**Category:** Dental-Clinical  
**FHIR Mapping:** dental-native (`Procedure` with endodontic extensions)

**Purpose:** Root canal procedure records — tooth canal anatomy, canal count and naming, working lengths (electronic apex locator + radiograph confirmation), irrigation protocol, obturation method, and re-treatment tracking.

**Key Entities:** `EndoRecord`, `Canal`, `WorkingLength`, `Obturation`, `IrrigationRecord`, `EndoRetreatment`

**Key Workflows:**
- Initiate endo record for tooth → map canals (count and name) → record working lengths per canal → document irrigation → obturate → complete; schedule radiographic review
- Re-treatment: prior endo failed → create re-treatment record linked to original → document reason for failure and new findings

**Key Business Rules:**
- Working length required per canal before obturation can be recorded
- Canal naming follows standard: MB (mesio-buccal), DB (disto-buccal), P (palatal), ML (mesio-lingual), DL (disto-lingual), MB2 for additional canals
- Obturation method recorded: lateral condensation, warm vertical compaction, single cone, carrier-based
- Re-treatment references the original endo record (not a standalone new record)
- Apex locator reading and radiographic confirmation are separate fields (both recommended)
- Endo record links to tooth record in Dental Chart domain

**State Machine:** `EndoRecord`: `initiated` → `access_opened` → `canals_shaped` → `obturated` → `completed` | `referred_out`

**Key Endpoints:**
- `listEndoRecords` — filter by patient, tooth, status
- `createEndoRecord`
- `getEndoRecordById`
- `addCanal` — add canal with name and anatomy notes
- `updateCanal`
- `recordWorkingLength` — apex locator and/or radiographic measurement per canal
- `recordObturation` — method, material, length per canal
- `completeEndoRecord`
- `createRetreatmentRecord` — linked re-treatment
- `getEndoHistory` — all endo records for a tooth

---

### 24. Prosthodontic Records

**Category:** Dental-Clinical  
**FHIR Mapping:** dental-native (`Procedure` with prosthodontic extensions)

**Purpose:** Tracks fabrication and delivery workflow for crowns, bridges, dentures, partial dentures, and implant-supported restorations. Includes shade matching, material selection, impression records, try-in, delivery, and cementation.

**Key Entities:** `ProsthoRecord`, `Restoration`, `ShadeSelection`, `Material`, `Impression`, `TryIn`, `Delivery`, `LabCaseLink`

**Key Workflows:**
- Diagnose → plan restoration → prepare tooth → take impression → record shade → send to lab (creates LabOrder) → receive case → try-in (adjust if needed) → deliver and cement → link to tooth chart
- Implant-supported: link to implant record (Implant Registry domain) before creating prostho record

**Key Business Rules:**
- Shade must reference a shade guide system name and shade value (e.g., VITA Classical A2)
- Material documented: zirconia, PFM (porcelain-fused-to-metal), full-cast gold, acrylic, composite, lithium disilicate, etc.
- Lab case (LabOrder) created from prostho record at impression stage
- Cementation date and cement type recorded on delivery
- For implant-supported restorations, implant record must exist and be in `restored` or `osseointegrating` status
- Remade cases link back to original prostho record with reason

**State Machine:** `ProsthoRecord`: `planned` → `impression_taken` → `lab_sent` → `try_in` → `delivered` | `remade`

**Key Endpoints:**
- `listProsthoRecords` — filter by patient, restoration type, status
- `createProsthoRecord`
- `getProsthoRecordById`
- `updateProsthoRecord`
- `recordImpression` — impression type, material, date
- `recordShadeSelection` — guide system, shade value, notes
- `linkLabCase` — associate lab order with prostho record
- `recordTryIn` — try-in notes, adjustments required
- `recordDelivery` — cement type, delivery date, final notes

---

### 25. Oral Surgery

**Category:** Dental-Clinical  
**FHIR Mapping:** `Procedure`, `Specimen` (for pathology)

**Purpose:** Surgical procedure records — simple and surgical extractions, impacted third molars, alveoloplasty, frenectomy, biopsy, cyst removal, and preprosthetic surgery. Includes surgical planning, healing follow-up, post-op instructions, and pathology chain of custody.

**Key Entities:** `SurgicalRecord`, `ExtractedTooth`, `SurgicalPlan`, `PostOpInstruction`, `HealingFollowUp`, `PathologySpecimen`, `Complication`

**Key Workflows:**
- Plan surgery → obtain signed consent → perform procedure → document findings (bone level, tissue removed) → issue post-op instructions → schedule healing check at 1 week and 1 month
- Biopsy: collect specimen → document chain of custody → send to pathology lab → receive report → attach to surgical record
- Complication reported post-surgery → document type, severity, management → flag for quality review

**Key Business Rules:**
- Surgical record requires an associated signed consent form before procedure can be marked complete
- Post-op instructions are version-controlled per procedure type (e.g., extraction v2, implant v3)
- Complications documented with procedure code, complication type, and severity (mild/moderate/severe)
- Pathology specimen requires: collection date, site, suspected diagnosis, receiving lab name
- Suture type and count recorded
- Extracted tooth linked to Dental Chart (updates tooth status to `extracted`)

**State Machine:** `SurgicalRecord`: `planned` → `completed` → `healing` → `closed` | `complication_reported`

**Key Endpoints:**
- `listSurgicalRecords` — filter by patient, procedure type, date
- `createSurgicalRecord`
- `getSurgicalRecordById`
- `updateSurgicalRecord`
- `addPostOpInstructions` — attach versioned post-op instructions
- `recordHealingFollowUp` — document healing check findings
- `addPathologySpecimen` — log specimen with chain of custody
- `reportComplication` — log complication with severity

---

### 26. Pediatric Dentistry

**Category:** Dental-Clinical  
**FHIR Mapping:** dental-native (`Observation` with pediatric dental profiles)

**Purpose:** Child-specific clinical tracking — primary tooth eruption and exfoliation, growth monitoring notes, behavior management scores per visit, fluoride varnish history, sealant placement and maintenance, and space maintainer tracking.

**Key Entities:** `EruptionRecord`, `ExfoliationRecord`, `BehaviorScore`, `FluorideApplication`, `SealantRecord`, `SpaceMaintainer`, `GrowthNote`

**Key Workflows:**
- Record erupted or exfoliated teeth → update dentition status in Dental Chart
- Score patient behavior at each visit (Frankl or ADPBRS scale) → track over visits for trend
- Document fluoride varnish application → type, concentration, date
- Place sealant → track per surface → monitor at recall (intact/repaired/lost)
- Extract primary tooth early → fit space maintainer → track until removal

**Key Business Rules:**
- Primary dentition: 20 teeth (A–T Universal notation, or 51–85 in FDI)
- Eruption dates are patient-specific (not auto-assigned from norms)
- Behavior scoring scale configured per practice (Frankl scale: 1–4; ADPBRS: 0–4)
- Fluoride application must record: product name, fluoride concentration (% or ppm), application method
- Sealants tracked per individual surface (not per tooth)
- Space maintainer links to the specific extracted primary tooth record

**State Machine:**  
`SealantRecord`: `placed` → `intact` → `repaired` | `lost`  
`SpaceMaintainer`: `placed` → `active` → `removed`

**Key Endpoints:**
- `listEruptionRecords` — eruption timeline for patient
- `recordEruption` — log erupted tooth
- `recordExfoliation` — log shed primary tooth
- `listBehaviorScores` — behavior history across visits
- `recordBehaviorScore` — score behavior for a visit
- `listFluorideApplications`
- `recordFluorideApplication`
- `listSealantRecords`
- `recordSealant` — place sealant on surface
- `updateSealantStatus` — intact/repaired/lost
- `createSpaceMaintainer`
- `updateSpaceMaintainer` — update status or note removal

---

### 27. Cosmetic Dentistry

**Category:** Dental-Clinical  
**FHIR Mapping:** dental-native (no direct FHIR mapping)

**Purpose:** Case documentation for elective cosmetic procedures — smile design, shade selection, tooth whitening, porcelain veneers, composite bonding, and digital smile preview. Includes before/after photo documentation and patient approval workflow.

**Key Entities:** `CosmeticCase`, `SmileDesign`, `WhiteningRecord`, `BeforeAfterPhoto`, `ShadeSelection`, `VeneerRecord`, `PatientApproval`

**Key Workflows:**
- Consultation → capture before photos → create smile design (digital or wax-up reference) → present to patient → patient approves → select shade → perform procedure → capture after photos
- Whitening: document each session → record sensitivity score → track shade change from baseline
- Veneer case: record each unit's shade, material, and prep design

**Key Business Rules:**
- Before photo required before any cosmetic procedure is started (cannot be added retroactively after completion)
- Shade selection must reference guide name and shade value
- Digital smile design file linked as a Document (Document Management domain)
- Patient approval documented before any irreversible procedure begins
- Whitening sensitivity scored per session (scale 0–10)
- After photos required to close a cosmetic case

**State Machine:** `CosmeticCase`: `consultation` → `design_approved` → `in_treatment` → `completed`

**Key Endpoints:**
- `listCosmeticCases`
- `createCosmeticCase`
- `getCosmeticCaseById`
- `updateCosmeticCase`
- `addSmileDesign` — attach design reference or file
- `recordPatientApproval` — document patient sign-off
- `recordShadeSelection`
- `uploadBeforeAfterPhoto` — tag as before or after
- `createWhiteningRecord`
- `updateWhiteningRecord` — add session data (sensitivity, shade progress)

---

### 28. Clinical Imaging

**Category:** Dental-Clinical  
**FHIR Mapping:** `ImagingStudy`, `ImagingSelection`

**Purpose:** Capture, storage, organization, and retrieval of dental radiographs and clinical photos — periapical, bitewing, panoramic, CBCT, and intraoral photos. Supports DICOM for CBCT, series management, AI-assisted annotation, and comparison across visits.

**Key Entities:** `ImagingStudy`, `ImagingInstance`, `ImageSeries`, `DicomStudy`, `AIAnnotation`, `ImageTag`

**Key Workflows:**
- Capture image (sensor/camera/CBCT) → assign to patient and encounter → optionally link to specific tooth or treatment → organize in series → annotate → serve to clinician
- Import DICOM study from CBCT unit → parse SOPUID → store instances
- Request AI analysis on radiograph → receive annotation overlay → clinician reviews and accepts/dismisses findings

**Key Business Rules:**
- Images linked to patient; encounter and tooth linkage are optional but recommended
- DICOM studies identified by SOPUID (must be unique per tenant)
- Series ordered by capture date (ascending)
- AI annotations are non-destructive overlays — original image never modified
- Original image files are immutable after upload
- Storage must be HIPAA-compliant (encrypted at rest and in transit)
- PHI access to images generates audit log entry

**State Machine:** `ImagingStudy`: `pending` → `available` → `archived`

**Key Endpoints:**
- `listImagingStudies` — filter by patient, type, date, tooth
- `createImagingStudy`
- `getImagingStudyById`
- `uploadImage` — attach image to study
- `listImageInstances` — images within a study
- `getImageInstance`
- `getImageDownloadUrl` — signed URL for image retrieval
- `createImageSeries` — group images into a series
- `addToSeries`
- `requestAIAnalysis` — trigger AI annotation job
- `getAIAnnotations` — retrieve annotations for an image

---

### 29. Implant Registry

**Category:** Dental-Clinical  
**FHIR Mapping:** `Device` (medical device registry)

**Purpose:** Placement and component tracking for dental implants — fixture manufacturer, lot number, dimensions, placement date, restoring provider, abutment and crown details, osseointegration follow-up scheduling, and warranty data. Enables manufacturer recall tracking by lot number.

**Key Entities:** `Implant`, `ImplantFixture`, `Abutment`, `ImplantCrown`, `OsseointegrationCheck`, `ImplantManufacturer`, `ImplantWarranty`

**Key Workflows:**
- Place implant → record fixture details (brand, lot, dimensions, torque) → schedule osseointegration check at 3 months → osseointegration confirmed → restore with abutment + crown → close case
- Record warranty dates (auto-calculated from placement date per manufacturer policy)
- Manufacturer recall: search implants by lot number → identify affected patients

**Key Business Rules:**
- Implant fixture record is immutable after placement (only clinical notes editable)
- Abutment must link to an existing implant fixture
- Osseointegration check required at configurable interval (default: 3 months post-placement)
- Lot number is mandatory for manufacturer recall tracking
- Warranty end date calculated automatically from manufacturer's warranty period + placement date
- Implant links to tooth position in Dental Chart (updates tooth record to `implant` status)

**State Machine:** `Implant`: `placed` → `osseointegrating` → `restored` → `failed` | `explanted`

**Key Endpoints:**
- `listImplants` — filter by patient, manufacturer, status
- `createImplant` — record placement
- `getImplantById`
- `updateImplantNotes` — notes only (fixture data immutable)
- `addAbutment`
- `addImplantCrown` — link prostho restoration to implant
- `recordOsseointegrationCheck`
- `linkWarranty`
- `listImplantsByManufacturer`
- `getRecallList` — patients with implants matching a given lot number

---

### 30. Clinical Decision Support

**Category:** Dental-Clinical  
**FHIR Mapping:** `DetectedIssue`, `GuidanceResponse`

**Purpose:** Real-time clinical alerts derived from patient context — drug-allergy interactions, medical history contraindications, overdue treatment flags, and protocol-based recommendations. Integrated at encounter open and prescription creation.

**Key Entities:** `ClinicalAlert`, `AlertRule`, `Contraindication`, `ProtocolRecommendation`, `OverdueTreatmentFlag`

**Key Workflows:**
- Encounter opened → CDS engine evaluates patient's medical history, allergies, medications, and active treatment plan → generates alerts
- Prescription drafted → drug-allergy and drug-drug interaction check → alert if found → clinician must acknowledge before signing
- Overdue treatment flags: planned items past scheduled date by configurable threshold → flag generated → appears on dashboard
- Protocol recommendations: based on diagnosis or procedure → suggest evidence-based next steps

**Key Business Rules:**
- All alerts are non-blocking (clinician can override with documented reason)
- Drug-allergy alerts cannot be suppressed at the system level (only overridden per instance)
- Override requires: clinical reason text, overriding clinician ID, timestamp
- Overdue flags generated at configurable intervals (e.g., 30/60/90 days past scheduled date)
- Protocol recommendations must cite evidence source (REQUIRES_DECISION on source data)
- Alert rules are configurable at org level (enable/disable specific rule types)

**State Machine:** `ClinicalAlert`: `active` → `acknowledged` | `overridden` → `resolved`

**Key Endpoints:**
- `getPatientAlerts` — all active alerts for a patient at encounter open
- `acknowledgeAlert`
- `overrideAlert` — override with documented reason
- `listAlertRules` — configured rule set for the org
- `createAlertRule` / `updateAlertRule`
- `getContraindications` — contraindications for a planned procedure given patient history
- `listOverdueTreatmentFlags`
- `getProtocolRecommendations` — recommendations for a diagnosis or procedure type

---

### 31. Sedation & Anesthesia Records

**Category:** Dental-Clinical  
**FHIR Mapping:** `MedicationAdministration`, `Observation` (vital signs)

**Purpose:** Documents sedation and local anesthesia administration — sedation level, drug/dose/route, continuous vital sign monitoring during procedure, recovery documentation, discharge criteria, and sedation permit tracking per provider.

**Key Entities:** `SedationRecord`, `AnesthesiaAdministration`, `VitalMonitoring`, `RecoveryRecord`, `SedationPermit`, `DischargeCriteria`

**Key Workflows:**
- Pre-sedation assessment → obtain sedation consent → verify provider sedation permit → administer sedation → monitor vitals per protocol → complete procedure → document recovery → verify discharge criteria met → discharge
- Local anesthesia (non-sedation): record drug, concentration, cartridge count, injection sites

**Key Business Rules:**
- Sedation requires pre-assessment completion (medical history review, ASA classification confirmed)
- Vital signs must be recorded at: start, every 5 minutes during procedure, at recovery entry (interval configurable)
- Provider must hold a valid sedation permit for the level of sedation administered (validated against Licensing domain)
- Patient must meet all discharge criteria before release (checklist-based)
- Local anesthesia fields: drug name (lidocaine, articaine, mepivacaine, etc.), concentration (e.g., 2% with 1:100,000 epi), cartridge count, injection site
- Sedation record links to the encounter it belongs to

**State Machine:** `SedationRecord`: `pre_assessment` → `active` → `recovery` → `discharged` | `transferred_emergency`

**Key Endpoints:**
- `listSedationRecords` — filter by patient, provider, date
- `createSedationRecord`
- `getSedationRecordById`
- `recordAnesthesiaAdministration` — drug, dose, route, time
- `recordVitalMonitoring` — vitals at a timestamped interval
- `recordRecovery` — recovery notes and scores
- `completeDischarge` — confirm discharge criteria met
- `listSedationPermits` — permits for a practitioner
- `addSedationPermit` / `updateSedationPermit`

---

### 32. Operatory / Chair Management

**Category:** Dental-Clinical  
**FHIR Mapping:** dental-native (`Location` with operatory type extension)

**Purpose:** Physical operatory (treatment room/chair) status tracking, provider-to-chair assignment, appointment-to-operatory mapping, turnover time recording, and maintenance blocking. Feeds the operatory status board for front-desk visibility.

**Key Entities:** `Operatory`, `OperatoryAssignment`, `ChairTimeBlock`, `TurnoverEvent`, `MaintenanceBlock`

**Key Workflows:**
- Open day → assign providers to operatories → patients checked in → appointment linked to operatory → procedure completed → turnover recorded → operatory available again
- Schedule maintenance block → operatory unavailable during window → resumes afterward
- View real-time operatory status board (available / occupied / turnover / maintenance)

**Key Business Rules:**
- One primary provider assignment per operatory per shift (multiple guest providers allowed)
- Appointment assigned to operatory at check-in (not at booking — REQUIRES_DECISION)
- Turnover time tracked between consecutive appointments (end of one to start of next)
- Maintenance block prevents appointment booking during the specified window
- Operatory belongs to a branch (cannot span branches)
- Decommissioned operatories retain historical records

**State Machine:**  
`Operatory`: `available` → `occupied` → `turnover` → `available`  
`MaintenanceBlock`: `scheduled` → `active` → `completed`

**Key Endpoints:**
- `listOperatories` — operatories for a branch
- `createOperatory`
- `getOperatoryById`
- `updateOperatory`
- `assignProviderToOperatory` — link provider to operatory for a shift
- `getOperatoryStatusBoard` — real-time status of all operatories in a branch
- `blockForMaintenance` — create maintenance block
- `recordTurnover` — log turnover start and end times
- `getChairUtilizationReport` — utilization metrics per operatory

---

## Dental Practice Operations

---

### 33. Insurance & Claims

**Category:** Practice-Operations  
**FHIR Mapping:** `Coverage`, `Claim`, `ClaimResponse`, `ExplanationOfBenefit`

**Purpose:** Dental insurance eligibility verification, pre-authorization, claim submission (837D EDI format), EOB processing (835), CDT code management, annual maximum and deductible tracking, frequency limitations, and coordination of benefits (COB) for patients with multiple plans.

**Key Entities:** `InsurancePlan`, `Payer`, `PatientCoverage`, `EligibilityVerification`, `PreAuthorization`, `Claim`, `ClaimLine`, `EOB`, `EOBLine`, `BenefitsTracking`, `FrequencyLimitation`

**Key Workflows:**
- Add patient coverage → verify eligibility (real-time or batch) → check frequency limitations → submit pre-auth if required → post treatment → create claim → submit → receive EOB → post insurance payment → identify patient balance
- Handle denial → review EOB denial code → correct and resubmit or appeal
- COB: determine primary vs secondary payer → submit to primary → coordinate secondary

**Key Business Rules:**
- CDT codes referenced externally (ADA copyright — system stores code string, not a managed codeset)
- Claim must reference: encounter, treating provider NPI, billing provider NPI, patient coverage
- Pre-authorization required flag configured per payer and CDT code
- EOB payment amount must reconcile with claim submitted amount (variance flagged)
- Annual maximum and deductible tracked per patient per plan year (calendar or benefit year)
- Frequency limitations: e.g., bitewing X-rays covered once per 12 months — system tracks last date
- COB: primary pays first; secondary pays up to their portion of remaining balance
- Claim void only allowed if payment not yet posted

**State Machine:**  
`Claim`: `draft` → `submitted` → `in_review` → `paid` | `denied` | `appealed` | `voided`  
`PreAuthorization`: `pending` → `approved` | `denied` | `expired`  
`EligibilityVerification`: `pending` → `verified` | `failed`

**Key Endpoints:**
- `listInsurancePlans` — payer plan catalog
- `addPatientCoverage` — link patient to insurance plan
- `verifyEligibility` — real-time or queued eligibility check
- `checkFrequencyLimitations` — validate CDT code against patient's frequency history
- `submitPreAuthorization`
- `getPreAuthStatus`
- `createClaim` — draft claim from encounter
- `getClaimById`
- `submitClaim` — send to payer (EDI or clearinghouse)
- `processEOB` — import and parse EOB
- `getEOBById`
- `listClaims` — filter by patient, payer, status, date
- `listDenials` — denied claims requiring action
- `appealClaim`
- `getBenefitsTracking` — annual max used, deductible met, frequency history

---

### 34. Lab Orders

**Category:** Practice-Operations  
**FHIR Mapping:** `ServiceRequest`, `Task` (for status tracking)

**Purpose:** Dental laboratory case management — creating lab cases from treatment plans, specifying materials and shade, shipment tracking, lab communication notes, case delivery, and return/remake workflows.

**Key Entities:** `LabOrder`, `LabCase`, `LabCaseLine`, `LabProvider`, `LabCommunicationNote`, `ReturnCase`

**Key Workflows:**
- Treatment plan item requires lab work → create lab order → specify case details (restoration type, material, shade, units) → ship case to lab → track fabrication status → receive case at clinic → inspect → deliver to patient or return for remake

**Key Business Rules:**
- Lab order references a treatment plan item (cannot be created without one)
- Patient appointment date (pan date) must be set before the case due date can be confirmed
- Case rejection (return for remake) requires documented reason
- Material specification must include shade guide name (if tooth-colored restoration)
- Due date cannot be in the past at time of creation
- Cases cannot be delivered to patient if not marked as received at clinic first

**State Machine:** `LabCase`: `draft` → `sent` → `in_fabrication` → `shipped_to_clinic` → `received` → `delivered` | `returned`

**Key Endpoints:**
- `listLabOrders`
- `createLabOrder`
- `getLabOrderById`
- `updateLabOrder`
- `listLabCases`
- `createLabCase` — case specification
- `updateLabCase`
- `receiveLabCase` — mark as received at clinic
- `returnLabCase` — return for remake with reason
- `addLabNote` — communication note with lab
- `listLabProviders`
- `createLabProvider` / `updateLabProvider`

---

### 35. Referral Management

**Category:** Practice-Operations  
**FHIR Mapping:** `ServiceRequest` (referral intent), `Task`

**Purpose:** Outbound specialist referrals (ortho, perio, endo, oral surgery, prostho, general medicine) with tracking, shared record access, feedback loop management, and overdue referral alerts.

**Key Entities:** `Referral`, `ReferralProvider`, `SharedRecord`, `ReferralFeedback`, `ReferralReason`

**Key Workflows:**
- Create referral → select specialist → specify reason and urgency → share relevant records (radiographs, notes, consent) → send referral → track acceptance and appointment → receive specialist feedback → attach feedback to patient record

**Key Business Rules:**
- Referral must include: reason for referral and at least one shared clinical record (minimum: recent radiograph or clinical note)
- Specialist must be in referral network or explicitly marked out-of-network
- Feedback expected within configurable days (default: 30 days) — overdue alert generated
- Shared record access expires after configurable TTL (default: 90 days)
- Patient consent required for sharing records with out-of-network providers (REQUIRES_DECISION)

**State Machine:** `Referral`: `created` → `sent` → `accepted` → `in_progress` → `completed` | `feedback_received` | `no_response`

**Key Endpoints:**
- `listReferrals` — filter by patient, specialist, status
- `createReferral`
- `getReferralById`
- `updateReferral`
- `sendReferral` — transmit to specialist
- `receiveReferralFeedback` — log specialist feedback
- `listReferralProviders` — specialist network
- `addReferralProvider` / `updateReferralProvider`
- `shareRecords` — grant time-limited access to patient records
- `getReferralTimeline` — full referral activity log

---

### 36. Inventory & Supply Management

**Category:** Practice-Operations  
**FHIR Mapping:** `SupplyDelivery`, `SupplyRequest`

**Purpose:** Dental supply catalog, stock level tracking, par-level reorder alerts, vendor management, purchase orders, expiry tracking for clinical consumables, and procedure-level consumption logging.

**Key Entities:** `InventoryItem`, `SupplyCategory`, `StockLevel`, `ReorderAlert`, `Vendor`, `PurchaseOrder`, `PurchaseOrderLine`, `ConsumptionLog`, `ExpiryRecord`

**Key Workflows:**
- Add item to catalog → set par level → track stock adjustments → auto-generate reorder alert when stock hits par → create purchase order → receive stock → update levels
- Log supply consumption per procedure/encounter
- Track expiry dates on clinical consumables (anesthetic, materials, etc.)

**Key Business Rules:**
- Stock level cannot go below 0 (system prevents negative adjustments without override)
- Expiry tracking mandatory for: clinical consumables, drugs (emergency kit), sterilization biologicals
- Reorder alert generated when stock ≤ par level
- Purchase order must reference a vendor record
- Consumption log references: encounter ID, item, quantity used
- Lot number tracked for all drug kit items (required for recall tracking)

**State Machine:**  
`PurchaseOrder`: `draft` → `submitted` → `partial_receipt` → `received` | `cancelled`  
`InventoryItem`: `active` → `discontinued` | `out_of_stock`

**Key Endpoints:**
- `listInventoryItems`
- `createInventoryItem`
- `getInventoryItemById`
- `updateStockLevel` — adjustment with reason (receipt, consumption, write-off)
- `listReorderAlerts`
- `createPurchaseOrder`
- `updatePurchaseOrder`
- `receivePurchaseOrder` — record received quantities
- `listVendors`
- `createVendor` / `updateVendor`
- `logConsumption` — record supply used in an encounter
- `getExpiryReport` — items expiring within a date window

---

### 37. Sterilization & Infection Control

**Category:** Practice-Operations  
**FHIR Mapping:** dental-native (no direct FHIR mapping)

**Purpose:** Instrument processing lifecycle from decontamination through sterile storage — packaging, autoclave cycle logging, biological indicator (spore test) tracking, cycle validation, and OSHA/state dental board compliance documentation.

**Key Entities:** `Instrument`, `InstrumentSet`, `AutoclaveCycle`, `BiologicalIndicator`, `SterilizationLog`, `InfectionControlChecklist`

**Key Workflows:**
- Collect used instruments → decontaminate → package → run autoclave cycle → record cycle parameters → incubate biological indicator → record result → store if pass; quarantine and re-run if fail
- Weekly biological indicator (spore) test regardless of volume
- Complete daily/weekly infection control checklist
- Generate compliance report for state inspection

**Key Business Rules:**
- Every autoclave cycle must be logged (no cycles without a log entry)
- Biological indicator tested weekly at minimum (configurable to more frequent)
- Failed spore test triggers: instrument quarantine, cycle investigation, mandatory re-run
- Instruments cannot be used if their last cycle is not validated (`pass` status)
- Cycle parameters required: temperature (°C), pressure (kPa), duration (minutes)
- Sterilization log is immutable (append-only)

**State Machine:**  
`AutoclaveCycle`: `pending` → `running` → `completed` → `validated` | `failed`  
`BiologicalIndicator`: `incubating` → `pass` | `fail`

**Key Endpoints:**
- `listInstruments`
- `createInstrument` / `updateInstrument`
- `listInstrumentSets`
- `createInstrumentSet`
- `createAutoclaveCycle` — log cycle with parameters
- `recordCycleResult` — pass/fail
- `listBiologicalIndicators`
- `recordBIResult` — spore test result
- `getSterilizationLog` — filter by date range, cycle type
- `generateSterilizationComplianceReport`
- `listInfectionControlChecklists`
- `submitChecklist` — complete daily/weekly checklist

---

### 38. Recall & Follow-Up

**Category:** Practice-Operations  
**FHIR Mapping:** `Appointment` (recall type), `Communication`

**Purpose:** Automated recall scheduling based on procedure history, overdue patient identification, recall campaign management with contact attempt logging, and recall dismissal workflow.

**Key Entities:** `RecallSchedule`, `RecallRule`, `RecallCampaign`, `RecallContactLog`, `OverduePatient`

**Key Workflows:**
- Procedure completed → recall rule matches → recall schedule auto-created at configured interval
- Recall date approaching → automated outreach begins (SMS/email/phone per patient preference) → contact attempts logged
- Patient books recall appointment → recall schedule linked to appointment
- Patient unresponsive after max contact attempts → marked `unresponsive` → periodic retry or dismiss

**Key Business Rules:**
- Recall interval configured per procedure type (e.g., prophylaxis = 6 months, perio maintenance = 3 months)
- Patient communication channel for recall follows communication preferences (opt-in required)
- Maximum contact attempts before `unresponsive` status: configurable (default: 3)
- Dismissal requires: reason, dismissing user ID, date
- Recall linked to appointment upon booking (status auto-updates to `booked`)
- No-show on recall appointment resets recall schedule to a shorter interval (configurable)

**State Machine:** `RecallSchedule`: `scheduled` → `contacted` → `booked` | `dismissed` | `unresponsive`

**Key Endpoints:**
- `listRecallSchedules` — filter by patient, due date, status
- `createRecallSchedule` — manual or triggered by procedure completion
- `getRecallScheduleById`
- `listRecallRules` — procedure-type recall configuration
- `createRecallRule` / `updateRecallRule`
- `runRecallCampaign` — batch outreach for overdue patients
- `listRecallCampaigns`
- `logContactAttempt` — record outreach attempt and outcome
- `getOverduePatientList` — patients with overdue recalls
- `dismissRecall` — dismiss with reason

---

### 39. Patient Portal

**Category:** Practice-Operations  
**FHIR Mapping:** `Patient` (portal access), `Communication`

**Purpose:** Self-service patient interface — online appointment booking, intake form completion, treatment summary access, secure messaging with the practice, and online payment of outstanding balances.

**Key Entities:** `PortalUser`, `PortalSession`, `OnlineBookingRequest`, `PortalIntakeForm`, `PortalMessage`, `PortalPayment`

**Key Workflows:**
- Patient registers portal account → links to patient record → books appointment online → completes intake forms → receives confirmation
- Patient views upcoming appointments, past visits, and balance
- Patient sends secure message to practice → front desk responds
- Patient pays outstanding balance via portal → receipt generated

**Key Business Rules:**
- Portal user must link to exactly one patient record (one-to-one)
- Online booking requests require staff confirmation by default (configurable to auto-confirm)
- Intake forms expire if not submitted before appointment (configurable lead time before expiry)
- Portal messages route to front desk queue by default (not directly to provider)
- Online payment requires PCI-compliant payment gateway (External Connectors domain)
- Portal user account disabled if patient record is anonymized or deceased

**State Machine:**  
`OnlineBookingRequest`: `pending` → `confirmed` | `declined`  
`PortalIntakeForm`: `sent` → `in_progress` → `submitted` | `expired`

**Key Endpoints:**
- `registerPortalUser`
- `linkPatientRecord` — associate portal account to patient record
- `createOnlineBookingRequest`
- `confirmBookingRequest` / `declineBookingRequest` — staff actions
- `getPortalAppointments`
- `submitPortalIntakeForm`
- `getPortalMedicalSummary` — read-only treatment history for patient
- `sendPortalMessage`
- `listPortalMessages`
- `initiatePortalPayment`
- `getPortalPaymentHistory`

---

### 40. Telehealth

**Category:** Practice-Operations  
**FHIR Mapping:** `Appointment` (virtual type), `Communication`

**Purpose:** Virtual dental consultations — scheduled video visits, asynchronous store-and-forward (patient submits photos, provider responds), remote triage, and telehealth-specific consent and documentation.

**Key Entities:** `TelehealthSession`, `TelehealthConsent`, `AsyncConsultation`, `TriageRecord`, `VideoSession`

**Key Workflows:**
- Schedule telehealth appointment → send join link to patient → conduct video session → document findings → issue prescription or referral if needed → close encounter
- Async consultation: patient submits symptoms + photos → provider reviews asynchronously → responds with assessment and recommendation → patient notified

**Key Business Rules:**
- Telehealth requires a separate consent form from standard treatment consent
- Video sessions use an embedded HIPAA-compliant video provider (External Connectors domain — REQUIRES_DECISION on provider)
- Async consultation response time tracked; alert generated if overdue (configurable, default: 24 hours)
- Prescriptions issued from telehealth encounters follow same rules as in-person prescriptions
- Provider must be licensed in patient's state of residence at time of visit (state licensure check — REQUIRES_DECISION on enforcement)
- Telehealth encounter creates a standard Encounter record (same lifecycle)

**State Machine:**  
`TelehealthSession`: `scheduled` → `waiting_room` → `in_progress` → `completed` | `no_show`  
`AsyncConsultation`: `submitted` → `in_review` → `responded` | `escalated`

**Key Endpoints:**
- `createTelehealthSession`
- `getTelehealthSessionById`
- `startVideoSession` — generate video room and join links
- `endVideoSession`
- `getTelehealthConsent` — retrieve or generate telehealth consent form
- `submitAsyncConsultation` — patient submits symptoms and photos
- `getAsyncConsultationById`
- `respondToAsyncConsultation` — provider response
- `createTriageRecord`
- `listTelehealthSessions` — filter by patient, provider, date

---

### 41. Quality & Clinical Outcomes

**Category:** Practice-Operations  
**FHIR Mapping:** `MeasureReport`, `Observation` (outcome)

**Purpose:** Treatment outcome tracking at defined follow-up intervals, complication monitoring with severity classification, clinical benchmark comparison, and periodic quality reports for continuous improvement programs.

**Key Entities:** `OutcomeRecord`, `ComplicationRecord`, `ClinicalBenchmark`, `QualityReport`, `OutcomeFollowUp`

**Key Workflows:**
- Procedure completed → outcome tracking triggered at configured intervals (e.g., implant: 6 months and 12 months) → outcome recorded at follow-up encounter → compared to benchmark
- Complication reported (intra-op or post-op) → severity classified → investigation assigned → resolved
- Quality report generated for a period → read-only snapshot

**Key Business Rules:**
- Outcome tracking intervals configured per procedure type
- Complication severity: mild (no clinical impact), moderate (treatment modified), severe (significant harm or hospitalization)
- Benchmark values configurable per practice or pulled from a pre-loaded industry standard (REQUIRES_DECISION on source data)
- Quality reports are immutable read-only snapshots (generated at a point in time)
- Outcome records link to the original treatment plan item and encounter

**State Machine:**  
`OutcomeRecord`: `pending` → `recorded` → `reviewed`  
`ComplicationRecord`: `reported` → `under_investigation` → `resolved`

**Key Endpoints:**
- `listOutcomeRecords` — filter by patient, procedure type, status
- `createOutcomeRecord`
- `getOutcomeRecordById`
- `listComplicationRecords`
- `reportComplication`
- `resolveComplication`
- `listClinicalBenchmarks`
- `updateBenchmark`
- `generateQualityReport`
- `getTreatmentSuccessRate` — aggregated success rate by procedure type

---

### 42. Patient Engagement

**Category:** Practice-Operations  
**FHIR Mapping:** dental-native (no direct FHIR mapping)

**Purpose:** Thin integration-point spec. Post-visit satisfaction surveys (NPS), online review management hooks, marketing campaign attribution, and referral source tracking. Emits webhook events for external CRM or marketing automation tools.

**Key Entities:** `SatisfactionSurvey`, `SurveyResponse`, `NPSScore`, `ReferralSource`, `CampaignAttribution`

**Key Workflows:**
- Visit completed → survey triggered within 24 hours → patient completes → NPS recorded → low score alert to admin
- New patient registered → referral source captured → campaign attribution applied if from marketing channel
- External CRM receives webhook events for new patient, completed visit, NPS response

**Key Business Rules:**
- Survey triggered within configurable window after visit completion (default: 24 hours)
- Patient opt-out from surveys is permanent per channel
- NPS score range: 0–10 (0–6 detractor, 7–8 passive, 9–10 promoter)
- Referral source required on all new patients (default: `unknown` if not captured)
- This domain emits events to the Webhook domain but does not manage CRM or marketing campaign logic internally

**State Machine:** `SatisfactionSurvey`: `sent` → `completed` | `expired` | `skipped`

**Key Endpoints:**
- `sendSatisfactionSurvey`
- `getSurveyById`
- `submitSurveyResponse`
- `getNPSSummary` — NPS breakdown for a period
- `listReferralSources`
- `createReferralSource` / `updateReferralSource`
- `trackCampaignAttribution` — link new patient to campaign
- `getAttributionReport`
- `listSurveyResponses`

---

### 43. Waiting List

**Category:** Practice-Operations  
**FHIR Mapping:** dental-native (no direct FHIR mapping)

**Purpose:** Cancellation backfill queue — patients requesting earlier appointments added to a prioritized waiting list, automatically matched when a cancellation opens a compatible slot, with configurable hold time for patient response.

**Key Entities:** `WaitingListEntry`, `CancellationMatch`, `WaitingListNotification`, `MatchCriteria`

**Key Workflows:**
- Patient requests earlier appointment → added to waiting list with criteria (provider preference, time-of-day, procedure type) → cancellation occurs → system matches against waiting list → notifies first match → patient has configurable hold time to confirm → confirmed: new appointment booked; declined: next match notified

**Key Business Rules:**
- Matching criteria: provider preference, time-of-day preference, procedure type compatibility
- Hold time: patient has configurable window to respond before moving to next match (default: 2 hours)
- Declined match does not remove patient from waiting list (remains for future openings)
- Waiting list entries expire after configurable days (default: 90 days)
- Priority tiers: urgent (same-day pain), high, standard
- One active match per waiting list entry at a time

**State Machine:** `WaitingListEntry`: `active` → `matched` → `confirmed` | `declined` → `expired`  
Declined entries return to `active`

**Key Endpoints:**
- `listWaitingListEntries` — filter by patient, procedure type, priority
- `addToWaitingList`
- `getWaitingListEntryById`
- `updateWaitingListEntry` — update criteria or priority
- `removeFromWaitingList`
- `runCancellationMatch` — triggered on appointment cancellation
- `respondToMatch` — patient confirms or declines
- `getWaitingListReport` — queue depth and match rate metrics

---

### 44. Emergency Protocols

**Category:** Practice-Operations  
**FHIR Mapping:** dental-native (no direct FHIR mapping)

**Purpose:** In-office medical emergency documentation, drug kit inventory and monthly inspection compliance, AED device and supply expiry tracking, emergency contact management, and incident report filing.

**Key Entities:** `EmergencyEvent`, `DrugKit`, `DrugKitItem`, `EmergencyContact`, `AEDDevice`, `IncidentReport`, `StaffEmergencyTraining`

**Key Workflows:**
- Emergency occurs → log event with type and response taken → file incident report within 24 hours
- Monthly drug kit check → inspect each item → record expiry dates and stock levels → generate compliance record
- AED battery and pad expiry tracked → alert before expiry

**Key Business Rules:**
- Drug kit check mandatory monthly (alert generated if overdue by 5 days)
- AED pad and battery expiry tracked separately; alert at 60 and 30 days before expiry
- Incident report must be filed within 24 hours of emergency event
- Drug kit items require: item name, lot number, expiry date, quantity
- Emergency contacts include: nearest hospital, poison control (1-800-222-1222 US), patient emergency contact
- Emergency event log is immutable after filing

**State Machine:**  
`DrugKitItem`: `in_stock` → `low` → `expired` | `depleted`  
`EmergencyEvent`: `active` → `resolved` → `reported`  
`AEDDevice`: `operational` → `maintenance_required` → `operational`

**Key Endpoints:**
- `listEmergencyEvents`
- `createEmergencyEvent`
- `resolveEmergencyEvent`
- `createIncidentReport`
- `listDrugKits`
- `performDrugKitCheck` — log monthly inspection
- `listDrugKitItems`
- `updateDrugKitItem`
- `listAEDDevices`
- `createAEDDevice`
- `updateAEDStatus`
- `listEmergencyContacts`
- `updateEmergencyContacts`

---

## Integration & Interoperability

---

### 45. FHIR / HL7 Interoperability

**Category:** Integration  
**FHIR Mapping:** All applicable FHIR R4 resources (this domain is the mapping layer)

**Purpose:** FHIR R4 resource exposure and mapping, dental data exchange profiles, CDA document generation for referrals, and HIE (Health Information Exchange) integration. Enables data sharing with hospitals, payers, and public health systems.

**Key Entities:** `FHIRBundle`, `CDADocument`, `DataExchangeProfile`, `HIEConnection`, `FHIRCapabilityStatement`

**Key Workflows:**
- Export patient data as FHIR bundle → send to HIE on request
- Receive FHIR resource from external system → map to internal schema → import
- Generate CDA document (continuity of care) for specialist referral
- Respond to FHIR queries from payers (eligibility, claims)

**Key Business Rules:**
- FHIR resources must include tenant context in `meta.tag`
- PHI in FHIR bundles requires TLS 1.2+ transport encryption
- External FHIR access is read-only (no writes via FHIR API to internal records)
- CDA documents generated on demand and not stored internally (rendered each time)
- Any data loss in FHIR mapping must be documented with `UNKNOWN` or `REQUIRES_DECISION` markers in the profile

**State Machine:** `HIEConnection`: `pending` → `active` → `suspended` → `terminated`

**Key Endpoints:**
- `getFHIRPatient` — FHIR Patient resource for a patient
- `getFHIREncounter` — FHIR Encounter for an encounter
- `getFHIRBundle` — full patient record as FHIR bundle
- `generateCDADocument` — continuity of care document
- `listHIEConnections`
- `createHIEConnection`
- `testHIEConnection`
- `getFHIRCapabilityStatement` — FHIR server capabilities declaration
- `validateFHIRResource` — validate a submitted FHIR resource against the profile

---

### 46. Webhook & Event Subscriptions

**Category:** Integration  
**FHIR Mapping:** `Subscription` (FHIR R4)

**Purpose:** Real-time outbound event delivery to external systems. Covers all significant domain events (appointment created, claim submitted, payment posted, etc.) with subscription management, signed payloads, and retry policies.

**Key Entities:** `WebhookSubscription`, `WebhookEvent`, `DeliveryAttempt`, `EventCatalog`, `WebhookSecret`

**Key Workflows:**
- External system creates subscription for event types → events fire internally → payload signed and delivered to endpoint → delivery confirmed by 2xx response → failures retried with backoff
- Subscription suspended after max retry failures → operator re-enables manually
- Rotate webhook secret without downtime

**Key Business Rules:**
- Webhook payload signed with HMAC-SHA256 using `WebhookSecret` (signature in header)
- Retry policy: up to 5 attempts with exponential backoff (1s, 2s, 4s, 8s, 16s)
- Subscription suspended after max retry failures (operator must re-enable)
- Subscriptions must specify event type filters (no catch-all wildcard by default)
- Payload size limit: 256KB (larger payloads replaced with a reference URL)
- Event catalog is read-only (events are system-defined)

**State Machine:**  
`WebhookSubscription`: `active` → `suspended` | `deleted`  
`DeliveryAttempt`: `pending` → `delivered` | `failed`

**Key Endpoints:**
- `listWebhookSubscriptions`
- `createWebhookSubscription`
- `getWebhookSubscriptionById`
- `updateWebhookSubscription` — update URL or event filters
- `deleteWebhookSubscription`
- `listEventCatalog` — all subscribable event types
- `listWebhookEvents` — event history
- `getWebhookEventById`
- `retryDelivery` — manually retry a failed event
- `rotateWebhookSecret` — issue new secret, old remains valid for 24 hours during rotation

---

### 47. External System Connectors

**Category:** Integration  
**FHIR Mapping:** dental-native (integration layer)

**Purpose:** Configuration and lifecycle management of external integrations — payment gateways, SMS/email providers, cloud storage, CBCT imaging software, dental imaging systems, e-prescribing, and third-party apps. Stores credentials securely and monitors connector health.

**Key Entities:** `Connector`, `ConnectorConfig`, `ConnectorCredential`, `ConnectorHealthCheck`, `ConnectorType`

**Connector Type Examples:**
- Payment: Stripe, Square, CareCredit, Sunbit
- Messaging: Twilio (SMS), SendGrid (email)
- Storage: AWS S3, Google Cloud Storage
- Imaging: Carestream, Planmeca, Dentsply Sirona
- E-prescribing: Surescripts
- Video (Telehealth): REQUIRES_DECISION on provider
- Clearinghouse (Claims): Change Healthcare, Availity

**Key Workflows:**
- Select connector type → provide configuration and credentials → test connection → activate → monitor health on schedule
- Credential rotation: provide new credentials → validate → activate new → invalidate old
- Disable connector on service disruption → re-enable when resolved

**Key Business Rules:**
- Credentials stored encrypted (never returned in any API response — write-only)
- Each connector type has a validation schema for its configuration
- Health check runs on configurable schedule (default: every 15 minutes)
- Credential rotation does not interrupt active sessions in flight
- Connector configuration is tenant-scoped (no cross-tenant connector sharing)

**State Machine:** `Connector`: `configured` → `testing` → `active` → `degraded` | `disabled`

**Key Endpoints:**
- `listConnectors` — all configured connectors for tenant
- `listConnectorTypes` — available connector types and their config schemas
- `createConnector`
- `getConnectorById`
- `updateConnectorConfig`
- `testConnector` — validate connection
- `activateConnector`
- `disableConnector`
- `rotateConnectorCredentials`
- `getConnectorHealthStatus`

---

### 48. Task & Workflow Automation

**Category:** Integration  
**FHIR Mapping:** `Task` (FHIR R4), `PlanDefinition` (workflow)

**Purpose:** Internal task queues, clinical and administrative to-do lists, morning huddle data aggregation, office checklist management, and event-driven workflow triggers (e.g., "when appointment is completed, create recall task and send NPS survey").

**Key Entities:** `Task`, `TaskQueue`, `WorkflowTrigger`, `WorkflowAction`, `MorningHuddle`, `OfficeChecklist`

**Key Workflows:**
- Configure workflow trigger (event + conditions + actions) → event fires → trigger evaluates → creates task(s) or sends message(s)
- Staff view task queue → pick up and complete tasks → mark done
- Morning huddle auto-generated at configurable time: day's appointments, outstanding tasks, recalls due, alerts
- Office checklist: opening/closing tasks completed and logged per session

**Key Business Rules:**
- Workflow triggers are event-driven (no polling-based triggers)
- Circular trigger prevention: max 3 levels of chained triggers (trigger A → trigger B → trigger C, no further chaining)
- Task priority levels: urgent, high, normal, low
- Tasks can be assigned to: specific user, role (any user in role), or unassigned queue
- Morning huddle snapshot is immutable once generated (point-in-time)
- Office checklists versioned per template; completions reference template version

**State Machine:**  
`Task`: `created` → `assigned` → `in_progress` → `completed` | `cancelled`  
`WorkflowTrigger`: `active` → `paused` → `deleted`

**Key Endpoints:**
- `listTasks` — filter by assignee, priority, status, queue
- `createTask`
- `getTaskById`
- `assignTask`
- `updateTaskStatus`
- `listTaskQueues`
- `createTaskQueue`
- `listWorkflowTriggers`
- `createWorkflowTrigger`
- `updateWorkflowTrigger` — activate, pause, update conditions
- `getMorningHuddle` — today's huddle snapshot
- `listOfficeChecklists`
- `submitChecklist` — mark checklist complete

---

## Appendix

### Open Questions / UNKNOWN Markers

| # | Domain | Question | Default/Assumption |
|---|--------|----------|--------------------|
| 1 | Dental Charting | Notation system stored internally: FDI or as-entered? | Assume FDI internally, convert on read |
| 2 | Patient Management | Auto-detect primary vs mixed dentition by age? | REQUIRES_DECISION — threshold age |
| 3 | Scheduling | Assign operatory at booking or at check-in? | REQUIRES_DECISION |
| 4 | Insurance & Claims | CDT codeset: store inline or reference external API? | Reference external only (ADA copyright) |
| 5 | Clinical Decision Support | Source data for protocol recommendations? | REQUIRES_DECISION on evidence database |
| 6 | Telehealth | HIPAA-compliant video provider? | REQUIRES_DECISION (Daily.co, Zoom Health, Doxy.me) |
| 7 | Telehealth | Enforce state licensure check at visit time? | REQUIRES_DECISION |
| 8 | Referral Management | Consent required to share records with out-of-network? | REQUIRES_DECISION on enforcement |
| 9 | Professional Licensing | Pre-load state board CE requirements? | REQUIRES_DECISION on data source |
| 10 | Communication | SMS bulk rate limits? | REQUIRES_DECISION — per provider SLA |
| 11 | Quality & Outcomes | Industry benchmark data source? | REQUIRES_DECISION |
| 12 | FHIR Interoperability | Dental-specific FHIR profiles: use Da Vinci? | REQUIRES_DECISION |

---

### Domain-to-Category Quick Reference

| # | Domain | Category | Endpoints (est.) |
|---|--------|----------|-----------------|
| 1 | Patient Management | Core Shared | 8 |
| 2 | Medical History & Questionnaires | Core Shared | 10 |
| 3 | Encounter / Visit | Core Shared | 8 |
| 4 | Practitioner | Core Shared | 8 |
| 5 | Professional Licensing & CE | Core Shared | 9 |
| 6 | Organization & Multi-Location | Core Shared | 9 |
| 7 | Staff Scheduling & Workforce | Core Shared | 9 |
| 8 | Scheduling | Core Shared | 10 |
| 9 | Fee Schedules & Contract Management | Core Shared | 9 |
| 10 | Billing & Financial | Core Shared | 11 |
| 11 | Document Management | Core Shared | 9 |
| 12 | Communication | Core Shared | 10 |
| 13 | Consent Management | Core Shared | 9 |
| 14 | Prescription Management | Core Shared | 10 |
| 15 | Audit & Compliance | Core Shared | 8 |
| 16 | Auth & Access Control | Core Shared | 13 |
| 17 | Reporting & Analytics | Core Shared | 11 |
| 18 | Data Import / Export | Core Shared | 10 |
| 19 | Dental Charting | Dental-Clinical | 9 |
| 20 | Treatment Planning & Lifecycle | Dental-Clinical | 10 |
| 21 | Periodontal Charting | Dental-Clinical | 9 |
| 22 | Orthodontic Management | Dental-Clinical | 11 |
| 23 | Endodontic Records | Dental-Clinical | 10 |
| 24 | Prosthodontic Records | Dental-Clinical | 9 |
| 25 | Oral Surgery | Dental-Clinical | 8 |
| 26 | Pediatric Dentistry | Dental-Clinical | 12 |
| 27 | Cosmetic Dentistry | Dental-Clinical | 10 |
| 28 | Clinical Imaging | Dental-Clinical | 11 |
| 29 | Implant Registry | Dental-Clinical | 10 |
| 30 | Clinical Decision Support | Dental-Clinical | 8 |
| 31 | Sedation & Anesthesia Records | Dental-Clinical | 9 |
| 32 | Operatory / Chair Management | Dental-Clinical | 9 |
| 33 | Insurance & Claims | Practice-Operations | 15 |
| 34 | Lab Orders | Practice-Operations | 12 |
| 35 | Referral Management | Practice-Operations | 10 |
| 36 | Inventory & Supply Management | Practice-Operations | 12 |
| 37 | Sterilization & Infection Control | Practice-Operations | 12 |
| 38 | Recall & Follow-Up | Practice-Operations | 10 |
| 39 | Patient Portal | Practice-Operations | 11 |
| 40 | Telehealth | Practice-Operations | 10 |
| 41 | Quality & Clinical Outcomes | Practice-Operations | 10 |
| 42 | Patient Engagement | Practice-Operations | 9 |
| 43 | Waiting List | Practice-Operations | 8 |
| 44 | Emergency Protocols | Practice-Operations | 13 |
| 45 | FHIR / HL7 Interoperability | Integration | 9 |
| 46 | Webhook & Event Subscriptions | Integration | 10 |
| 47 | External System Connectors | Integration | 10 |
| 48 | Task & Workflow Automation | Integration | 13 |

**Total estimated endpoints: ~470**

---

*Dental Management API Spec v1.0.0-draft — 48 domains, lightweight PRD format — ready for AI-assisted API generation*
