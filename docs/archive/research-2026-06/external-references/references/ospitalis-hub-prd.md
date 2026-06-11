# Health API Hub — Ospitalis Vertical
## AI-Readable API Specification Document

**Document Series:** Health API Hub — Ospitalis Vertical PRD
**Version:** 0.1.0-draft
**Date:** 2026-04-16
**Status:** DRAFT
**Maintained by:** Health API Hub Core Team

---

## Section 1 — Document Purpose

This document is an AI-readable API specification for the Ospitalis vertical of the Health API Hub. It is not a code file, not a full OpenAPI spec, and not end-user documentation. It is a domain knowledge artifact designed to be handed to an AI code-generation agent (Claude, Codex, or equivalent) so the agent can produce accurate, non-hallucinated OpenAPI 3.1 specifications, Zod schemas, and tRPC router definitions for a hospital information management system.

The specification covers four categories of domains:

| Category | Domain Count | Contents |
|----------|-------------|----------|
| 1 — Core Shared Health | 22 | Globally universal domains shared across all Health API Hub verticals |
| 2 — Hospital-Specific Clinical | 35 | Hospital clinical workflows (ADT, OR, ICU, pharmacy, lab, imaging, extended care) |
| 3 — Hospital Practice Operations | 43 | Hospital operational workflows (bed management, staffing, revenue cycle, patient experience, facilities, governance, education) |
| 4 — Integration & Interoperability | 28 | Standards adapters (HL7, FHIR, DICOM, IHE) + 14 Philippine localization adapters |

---

## Section 2 — AI Consumption Instructions

**READ THIS SECTION FIRST. These instructions govern how you interpret every domain specification in this document.**

### 2.1 What to Generate

From this document, generate:
- **OpenAPI 3.1 specifications** with full path definitions, request/response schemas, and error models. Do not emit placeholders such as `{}`, `TODO`, or `string // fill in`. Every field must have a type, description, and example.
- **Zod schemas** for all request bodies and response shapes, derived from the entity definitions and business rules in each domain.
- **tRPC router stubs** using the operationIds listed under Key Endpoints for each domain.

Do not generate implementation code, SQL migrations, or UI components from this document.

### 2.2 How to Interpret Extension Points

Extension Points are **slot declarations**, not full specifications. They announce that a named slot exists on an entity so that vertical domains and localization adapters can attach additional fields or sub-schemas. When generating Core OpenAPI specs, model extension slots as optional arrays or objects with a permissive schema (e.g., `additionalProperties: true` or a typed union). When generating vertical-specific specs, replace the permissive schema with the concrete type declared by the vertical adapter. See Section 5 (Extension Contract Pattern) for the full mechanics.

### 2.3 How to Handle UNKNOWN Markers

Inline `UNKNOWN: <question>` markers appear where the domain is genuinely underspecified. When you encounter one:
1. If the question is answerable from context elsewhere in this document, answer it and continue.
2. If not answerable from context, make the most conservative assumption — prefer nullable over required, prefer `string` over enum, prefer optional over mandatory — and annotate your output with a comment explaining the assumption.
3. Do not omit the field or endpoint. Make a decision and mark it.

### 2.4 How to Interpret State Machines

Every domain that declares a State Machine section defines the valid values for the primary entity's `status` field. Map these to a string enum type. The arrows (`→`) define valid forward transitions only. Reverse transitions are forbidden unless the domain explicitly states otherwise. Generate a transition validation function or middleware comment alongside the enum.

Example: `draft → active → suspended → inactive` maps to:
```typescript
type EncounterStatus = 'draft' | 'active' | 'suspended' | 'inactive';
const VALID_TRANSITIONS: Record<EncounterStatus, EncounterStatus[]> = {
  draft: ['active'],
  active: ['suspended', 'inactive'],
  suspended: ['active', 'inactive'],
  inactive: [],
};
```

### 2.5 How to Interpret Key Endpoints

Key Endpoints lists are **operationId declarations**. Each operationId implies:
- A path constructed from entity name and action semantics (e.g., `getPatient` → `GET /patients/{patientId}`)
- Path parameters derived from the entity's primary key (UUID by default)
- Query parameters derived from the entity's filterable fields (listed in Key Entities and Key Business Rules)
- Request/response schemas derived from the entity definition and business rules in the same domain block

Do not invent operationIds not listed. Do not omit operationIds that are listed. If a listed operationId is ambiguous, default to RESTful semantics.

### 2.6 ID and Timestamp Conventions

Unless a domain explicitly states otherwise:
- All primary keys are **UUIDs** (format: `uuid`, example: `"a3bb189e-8bf9-3888-9912-ace4e6543002"`)
- All timestamps are **ISO 8601** with UTC timezone (format: `date-time`, example: `"2026-04-16T08:30:00Z"`)
- All enums are **string literals** (not integers, not booleans)
- All monetary amounts are **integer cents** (not floating-point decimals) unless the domain specifies otherwise
- Tenant scoping fields (`organizationId`, `branchId`) are present on all entities and are required in all write operations

### 2.7 Localization Adapters and Core

Core domains are the base layer. They declare the canonical entity shapes and extension slots. Localization adapters (Category 4) extend Core by populating extension slots with jurisdiction-specific fields — they do not replace Core endpoints or schemas. When generating specs for a Philippine deployment, include Core schemas as the base and merge adapter schemas into the declared extension slots. Never embed adapter content into Core schemas.

### 2.8 Multi-Tenancy Scoping

All entities are scoped to `organizationId` (health system) and `branchId` (facility/campus). These fields are required on all create and update operations. All list operations must filter by at minimum `branchId`. The AI must include these as required request fields and as implicit filters on all query operations.

---

## Section 3 — Table of Contents

- [Section 1 — Document Purpose](#section-1--document-purpose)
- [Section 2 — AI Consumption Instructions](#section-2--ai-consumption-instructions)
- [Section 3 — Table of Contents](#section-3--table-of-contents)
- [Section 4 — Domain Glossary](#section-4--domain-glossary)
- [Section 5 — Cross-Domain Entity Relationship Map](#section-5--cross-domain-entity-relationship-map)
- [Section 6 — Extension Contract Pattern](#section-6--extension-contract-pattern)
- [Section 7 — Category 1: Core Shared Health (22 Domains)](#section-7--category-1-core-shared-health-22-domains)
  - [7.1 Patient / Person Master (MPI)](#71-patient--person-master-mpi)
  - [7.2 Encounter / Visit](#72-encounter--visit)
  - [7.3 Practitioner / Provider Directory](#73-practitioner--provider-directory)
  - [7.4 Organization & Location Registry](#74-organization--location-registry)
  - [7.5 Identity, Authentication & Session](#75-identity-authentication--session)
  - [7.6 Authorization & RBAC/ABAC](#76-authorization--rbacabac)
  - [7.7 Audit Log & Access Tracking](#77-audit-log--access-tracking)
  - [7.8 Consent Management](#78-consent-management)
  - [7.9 Scheduling Engine](#79-scheduling-engine)
  - [7.10 Appointments & Waitlist](#710-appointments--waitlist)
  - [7.11 Billing & Charges](#711-billing--charges)
  - [7.12 Payments & Patient Financial Services](#712-payments--patient-financial-services)
  - [7.13 Coverage & Insurance Eligibility](#713-coverage--insurance-eligibility)
  - [7.14 Document Management (DMS)](#714-document-management-dms)
  - [7.15 Communication & Messaging](#715-communication--messaging)
  - [7.16 Notifications & Alerting](#716-notifications--alerting)
  - [7.17 Tasks & Work Queues](#717-tasks--work-queues)
  - [7.18 Forms & Questionnaires](#718-forms--questionnaires)
  - [7.19 Terminology & Reference Data](#719-terminology--reference-data)
  - [7.20 Reporting & Analytics](#720-reporting--analytics)
  - [7.21 Patient Portal](#721-patient-portal)
  - [7.22 Telehealth / Virtual Care](#722-telehealth--virtual-care)
- **Category 2: Hospital-Specific Clinical (35 Domains)**
  - [Admission, Discharge, Transfer (ADT) & Inpatient Census](#admission-discharge-transfer-adt--inpatient-census)
  - [Emergency Department (ED) Tracker](#emergency-department-ed-tracker)
  - [Operating Room & Perioperative](#operating-room--perioperative)
  - [Anesthesia Information Management (AIMS)](#anesthesia-information-management-aims)
  - [Procedural Sedation](#procedural-sedation)
  - [ICU / Critical Care](#icu--critical-care)
  - [Ventilator & Respiratory Therapy](#ventilator--respiratory-therapy)
  - [Telemetry / Continuous Monitoring](#telemetry--continuous-monitoring)
  - [Labor & Delivery / Maternity](#labor--delivery--maternity)
  - [NICU](#nicu)
  - [Oncology / Chemotherapy](#oncology--chemotherapy)
  - [Dialysis](#dialysis)
  - [Behavioral Health / Psychiatry](#behavioral-health--psychiatry)
  - [Rehabilitation (PT/OT/ST)](#rehabilitation-ptotst)
  - [Wound Care](#wound-care)
  - [IV Therapy / Infusions](#iv-therapy--infusions)
  - [Pharmacy (Inpatient + Outpatient)](#pharmacy-inpatient--outpatient)
  - [Medication Administration Record (eMAR)](#medication-administration-record-emar)
  - [Medication Reconciliation](#medication-reconciliation)
  - [Allergy & Adverse Reaction Management](#allergy--adverse-reaction-management)
  - [Computerized Provider Order Entry (CPOE)](#computerized-provider-order-entry-cpoe)
  - [Order Sets & Care Pathways](#order-sets--care-pathways)
  - [Clinical Decision Support (CDS)](#clinical-decision-support-cds)
  - [Vitals & Flowsheets](#vitals--flowsheets)
  - [Nursing Assessments & Care Plans](#nursing-assessments--care-plans)
  - [Clinical Documentation & CDI](#clinical-documentation--cdi-clinical-documentation-integrity)
  - [Laboratory Information System (LIS)](#laboratory-information-system-lis)
  - [Pathology & Specimen Workflow](#pathology--specimen-workflow)
  - [Blood Bank / Transfusion Services](#blood-bank--transfusion-services)
  - [Radiology / RIS + PACS](#radiology--ris--pacs)
  - [Code Blue / Rapid Response](#code-blue--rapid-response)
  - [Discharge Summaries & Transitions of Care](#discharge-summaries--transitions-of-care)
  - [Palliative & Hospice Care](#palliative--hospice-care)
  - [Home Health Orders & Remote Care](#home-health-orders--remote-care)
  - [Long-Term Acute Care (LTAC) / Step-Down / Swing Bed](#long-term-acute-care-ltac--step-down--swing-bed)
- **Category 3: Hospital Practice Operations (43 Domains)**
  - [Bed Management & Capacity](#bed-management--capacity)
  - [Bed Cleaning / EVS Turnover](#bed-cleaning--evs-turnover)
  - [Patient Transport / Porter Services](#patient-transport--porter-services)
  - [Discharge Planning & Case Management](#discharge-planning--case-management)
  - [Utilization Review & Medical Necessity](#utilization-review--medical-necessity)
  - [Staff / Workforce Scheduling](#staff--workforce-scheduling)
  - [Credentialing & Privileging](#credentialing--privileging)
  - [Employee / Occupational Health](#employee--occupational-health)
  - [Volunteer Management](#volunteer-management)
  - [Supply Chain & Materials Management](#supply-chain--materials-management)
  - [Chargemaster (CDM)](#chargemaster-cdm)
  - [Revenue Cycle & Denials Management](#revenue-cycle--denials-management)
  - [Coding (ICD-10, DRG, HCC)](#coding-icd-10-drg-hcc)
  - [Health Information Management (HIM) / ROI & Chart Completion](#health-information-management-him--roi--chart-completion)
  - [Cost Accounting](#cost-accounting)
  - [Sterile Processing / CSSD](#sterile-processing--cssd)
  - [Biomedical Equipment Management](#biomedical-equipment-management)
  - [Linens & Laundry Services](#linens--laundry-services)
  - [Food & Nutrition / Dietary](#food--nutrition--dietary)
  - [Housekeeping / Environmental Services](#housekeeping--environmental-services)
  - [Mortuary / Morgue Management](#mortuary--morgue-management)
  - [Incident Reporting & Patient Safety Events](#incident-reporting--patient-safety-events)
  - [Risk Management & Legal Hold](#risk-management--legal-hold)
  - [Infection Prevention & HAI Surveillance](#infection-prevention--hai-surveillance)
  - [Antimicrobial Stewardship](#antimicrobial-stewardship)
  - [Quality Measures & Clinical Registries](#quality-measures--clinical-registries)
  - [Peer Review / M&M](#peer-review--mm)
  - [Emergency Preparedness / Disaster (HICS)](#emergency-preparedness--disaster-hics)
  - [Research, IRB & Clinical Trials](#research-irb--clinical-trials)
  - [Referral Management & Network](#referral-management--network)
  - [Population Health & SDOH](#population-health--sdoh)
  - [Value-Based Care / ACO / Bundled Payments](#value-based-care--aco--bundled-payments)
  - [Patient Experience & Grievance Management](#patient-experience--grievance-management)
  - [Interpreter & Language Access Services](#interpreter--language-access-services)
  - [Pastoral, Chaplaincy & Social Work Services](#pastoral-chaplaincy--social-work-services)
  - [Engineering Work Orders & Preventive Maintenance](#engineering-work-orders--preventive-maintenance)
  - [Biomedical & Hazardous Waste Management](#biomedical--hazardous-waste-management)
  - [Committee & Board Management](#committee--board-management)
  - [Payer & Vendor Contract Management](#payer--vendor-contract-management)
  - [Learning Management System & Mandatory Training](#learning-management-system--mandatory-training)
  - [GME & CME Tracking](#gme--cme-tracking)
  - [Medical Arts Building & Affiliated Clinic Tenancy](#medical-arts-building--affiliated-clinic-tenancy)
  - [Vendor Representative & Implant Rep Access](#vendor-representative--implant-rep-access)
- **Category 4: Integration & Interoperability (28 Domains)**
  - [HL7 v2 Interface Engine](#hl7-v2-interface-engine)
  - [FHIR R4 API Gateway](#fhir-r4-api-gateway)
  - [CCDA / C-CDA Document Exchange](#ccda--c-cda-document-exchange)
  - [DICOM & Imaging Interop](#dicom--imaging-interop)
  - [IHE Profiles](#ihe-profiles)
  - [Payer EDI](#payer-edi)
  - [ePrescribing & EPCS / PDMP](#eprescribing--epcs--pdmp)
  - [Public Health Reporting](#public-health-reporting)
  - [Medical Device & IoT Integration](#medical-device--iot-integration)
  - [Health Information Exchange (HIE) / Carequality / TEFCA](#health-information-exchange-hie--carequality--tefca)
  - [Identity Federation & Provider Directory Sync](#identity-federation--provider-directory-sync)
  - [Event Streaming & Webhooks](#event-streaming--webhooks)
  - [Teleradiology Service Integration](#teleradiology-service-integration)
  - [Reference & Send-Out Laboratory Integration](#reference--send-out-laboratory-integration)
  - *Localization Adapters — Philippines (14 adapters):*
  - [PH: PhilHealth Membership](#ph-philhealth-membership)
  - [PH: PhilHealth eClaims 3.0](#ph-philhealth-eclaims-30)
  - [PH: PhilHealth DSCA](#ph-philhealth-dsca)
  - [PH: DOH OHSRS Reporting](#ph-doh-ohsrs-reporting)
  - [PH: RA 9439 Anti-Hospital Detention Compliance](#ph-ra-9439-anti-hospital-detention-compliance)
  - [PH: RA 10173 Data Privacy](#ph-ra-10173-data-privacy)
  - [PH: PWD/Senior Discount Engine](#ph-pwdsenior-discount-engine)
  - [PH: PNDF Formulary + YAKAP Maternity API](#ph-pndf-formulary--yakap-maternity-api)
  - [PH: PhilHealth Member Programs](#ph-philhealth-member-programs)
  - [PH: PhilHealth Provider Accreditation](#ph-philhealth-provider-accreditation)
  - [PH: DOH National Health Facility Registry (NHFR)](#ph-doh-national-health-facility-registry-nhfr)
  - [PH: DOH FDA Controlled Substances eReporting](#ph-doh-fda-controlled-substances-ereporting)
  - [PH: DOH SPEED/ESR Epidemic Surveillance Reporting](#ph-doh-speedesr-epidemic-surveillance-reporting)
  - [PH: PSA PhilSys National ID](#ph-psa-philsys-national-id)

---

## Section 4 — Domain Glossary

This glossary defines every acronym and non-obvious clinical term used across all four categories of this specification. AI agents must use these definitions when resolving ambiguous field names or enum values.

### 4.1 Information Systems & Standards Acronyms

**ABAC** — Attribute-Based Access Control. Authorization model that grants access based on attributes of the user, resource, and environment, rather than predefined roles. Complements RBAC for fine-grained policies (e.g., "attending physician can access only their own patients").

**ACO** — Accountable Care Organization. A network of providers sharing responsibility for a patient population's cost and quality. Relevant to value-based care billing models.

**AIMS** — Anesthesia Information Management System. A specialized EHR module for anesthesia workflow, drug delivery tracking, and intraoperative monitoring.

**BCMA** — Barcode Medication Administration. A safety process where a nurse scans a barcode on the patient wristband and the medication package to verify the 5 Rights before administration.

**CAUTI** — Catheter-Associated Urinary Tract Infection. A healthcare-acquired infection (HAI) metric tracked for quality reporting.

**CCDA** — Consolidated Clinical Document Architecture. An HL7 standard for structuring clinical summary documents (discharge summaries, referral notes) for exchange between systems.

**CME** — Continuing Medical Education. Accredited educational activities fulfilling ongoing learning requirements for licensed practitioners to maintain specialty board certification and medical licensure.

**CDI** — Clinical Documentation Improvement. The process of reviewing and improving the accuracy and completeness of clinical documentation to ensure appropriate coding and reimbursement.

**CDM** — Charge Description Master. A hospital's comprehensive price list of every billable service, supply, and procedure. Drives charge capture.

**CDS** — Clinical Decision Support. Automated alerts, reminders, and recommendations surfaced at the point of care to guide clinical decisions (e.g., drug interaction alerts, duplicate order alerts).

**CDS Hooks** — A web standard for integrating CDS services into EHR workflows. Defines hook points (e.g., `patient-view`, `order-sign`) where external CDS services return cards with recommendations.

**CDiff** (also C. diff) — Clostridioides difficile infection. A HAI tracked for quality and infection control reporting.

**CLABSI** — Central Line-Associated Bloodstream Infection. A HAI quality metric.

**CPOE** — Computerized Physician Order Entry. The system through which clinicians enter medical orders electronically, replacing handwritten or verbal orders.

**CSSD** — Central Sterile Services Department. The hospital department responsible for cleaning, sterilizing, and distributing medical instruments and supplies.

**DICOMweb** — A set of RESTful services for accessing DICOM imaging data over the web. Comprises WADO-RS, STOW-RS, and QIDO-RS.

**DICOM** — Digital Imaging and Communications in Medicine. The international standard for medical imaging data storage and transmission.

**DMS** — Document Management System. The subsystem responsible for storing, versioning, retrieving, and controlling access to clinical and administrative documents.

**DRG** — Diagnosis-Related Group. A patient classification system that groups hospital cases by diagnosis, procedures, and complications for standardized payment. See also MS-DRG, APR-DRG.

**DSCA** — Discharge Summary and Clinical Abstract. The Philippine-specific term for the comprehensive clinical summary document prepared at patient discharge, required for PhilHealth eClaims submission.

**ELR** — Electronic Lab Reporting. Automated transmission of reportable laboratory results to public health authorities.

**eMAR** — Electronic Medication Administration Record. The digital version of the MAR, used by nurses to document medication administration.

**EPCS** — Electronic Prescribing for Controlled Substances. DEA-compliant electronic prescribing of Schedule II-V controlled substances (US context; Philippine equivalent references RA 9165 S2 prescriptions).

**FHIR** — Fast Healthcare Interoperability Resources. The HL7 R4 standard for representing and exchanging healthcare information as RESTful APIs with JSON/XML resources.

**FIM** — Functional Independence Measure. A standardized assessment tool scoring a patient's level of disability and burden of care across 18 functional items.

**FPPE** — Focused Professional Practice Evaluation. A time-limited evaluation of a new or provisional medical staff member's competence for specific privileges.

**GME** — Graduate Medical Education. Post-graduate clinical training for physicians (residents, fellows) in accredited hospital programs, covering duty-hour limits, rotation requirements, and competency-based evaluations.

**HAI** — Healthcare-Associated Infection. An infection a patient acquires during the course of receiving healthcare. Includes CAUTI, CLABSI, SSI, CDiff, and VAP.

**HCAHPS** — Hospital Consumer Assessment of Healthcare Providers and Systems. A standardized national patient satisfaction survey instrument used (originated in the US, widely adopted internationally) to measure inpatient experience across domains including communication, responsiveness, pain management, and discharge information.

**HCC** — Hierarchical Condition Category. A risk-adjustment model used in value-based care and Medicare Advantage to predict healthcare costs based on patient diagnoses.

**HIE** — Health Information Exchange. The electronic sharing of patient health information across organizations and systems.

**HICS** — Hospital Incident Command System. The emergency management framework used by hospitals for disaster and mass casualty response.

**HIM** — Health Information Management. The department and discipline responsible for managing patient records, coding, release of information, and data integrity.

**HL7** — Health Level Seven International. The standards organization that produces FHIR, HL7 v2, and CDA messaging standards for healthcare interoperability.

**IHE** — Integrating the Healthcare Enterprise. An organization that publishes integration profiles (XDS, PIX/PDQ, etc.) defining how HL7 and DICOM standards work together.

**IIS** — Immunization Information System. A confidential, population-based computerized database tracking immunization histories. Used for ELR and public health reporting.

**IRB** — Institutional Review Board. The ethics committee that reviews and approves research involving human subjects.

**L&D** — Labor and Delivery. The obstetrics unit handling childbirth. Associated with partograms, fetal monitoring, and delivery documentation.

**LIS** — Laboratory Information System. The system managing lab orders, specimen tracking, result entry, quality control, and result reporting.

**LMS** — Learning Management System. A platform for delivering, tracking, and managing employee training curricula, compliance certifications, and clinical skill checkoffs.

**LOINC** — Logical Observation Identifiers Names and Codes. A universal standard for identifying medical laboratory observations, clinical measurements, and document types.

**LTAC** — Long-Term Acute Care. An inpatient care category for medically complex patients requiring extended hospitalization beyond the standard acute DRG window, governed by distinct payer criteria and billing classifications.

**MAR** — Medication Administration Record. A legal document recording every medication administered to a patient, including drug, dose, route, time, and administering nurse.

**MDM** — Master Data Management. The discipline ensuring a single, authoritative, and consistent record of key entities (patients, practitioners, organizations) across systems.

**MEC** — Medical Executive Committee. The governing body of the organized medical staff in a hospital, responsible for medical staff credentialing oversight, privilege delineation, and bylaws enforcement.

**MFA** — Multi-Factor Authentication. Authentication requiring two or more verification factors (password plus TOTP code, hardware key, etc.).

**MPI** — Master Patient Index. The authoritative registry of patient identities across a health system, responsible for matching records and preventing duplicates.

**MS-DRG** — Medicare Severity Diagnosis-Related Group. The DRG variant used by US Medicare. See also APR-DRG (All Patient Refined DRG, used in pediatric and severity-adjusted contexts).

**APR-DRG** — All Patient Refined Diagnosis-Related Group. A DRG classification system that incorporates severity of illness and risk of mortality, used beyond Medicare patients.

**MWL** — Modality Worklist. A DICOM service delivering scheduled procedure information to imaging devices so technicians can select the correct patient and study.

**NICU** — Neonatal Intensive Care Unit. The specialized unit caring for premature and critically ill newborns.

**NPPES** — National Plan and Provider Enumeration System. The US registry that issues NPIs to healthcare providers.

**NPI** — National Provider Identifier. The unique 10-digit identification number for US healthcare providers. Philippine equivalent is PRC license number + PhilHealth accreditation number.

**OPPE** — Ongoing Professional Practice Evaluation. Continuous monitoring of a credentialed practitioner's performance through quality metrics and peer review.

**P&T Committee** — Pharmacy and Therapeutics Committee. A multidisciplinary committee governing the hospital formulary, medication use policy, and drug utilization review. Formulary decisions made by P&T are binding on the pharmacy and prescribing medical staff.

**PACS** — Picture Archiving and Communication System. The system for storing, retrieving, distributing, and displaying medical images (X-ray, CT, MRI, ultrasound).

**PDMP** — Prescription Drug Monitoring Program. A statewide electronic database tracking controlled substance prescriptions to detect diversion and misuse.

**PIX/PDQ** — Patient Identifier Cross-Referencing / Patient Demographics Query. IHE integration profiles for cross-facility patient matching and demographic lookup.

**PT/OT/ST** — Physical Therapy / Occupational Therapy / Speech Therapy. Allied health rehabilitation services.

**QHIN** — Qualified Health Information Network. A TEFCA-designated network operator enabling nationwide health information exchange in the US.

**QIDO** — Query based on ID for DICOM Objects. A DICOMweb service for querying DICOM studies, series, and instances via RESTful HTTP.

**RBAC** — Role-Based Access Control. Authorization model granting permissions based on assigned roles (e.g., physician, nurse, billing clerk).

**RCA** — Root Cause Analysis. A structured methodology for identifying the underlying causes of adverse events or near-misses in healthcare.

**RIS** — Radiology Information System. The system managing radiology workflow including order tracking, scheduling, reporting, and billing for imaging services.

**ROI** — Release of Information. The HIM process for responding to requests for patient records from patients, providers, insurers, and legal entities.

**RxNorm** — A normalized nomenclature for clinical drugs maintained by the US National Library of Medicine. Provides standard names and identifiers for medications and drug interactions.

**SDOH** — Social Determinants of Health. Non-clinical factors (housing, food security, transportation, income) affecting health outcomes. Increasingly captured in clinical systems.

**SMART-on-FHIR** — Substitutable Medical Applications, Reusable Technologies on FHIR. A standard enabling third-party apps to launch within an EHR using OAuth2 and FHIR APIs.

**SNOMED** (SNOMED CT) — Systematized Nomenclature of Medicine — Clinical Terms. A comprehensive multilingual clinical terminology covering diagnoses, procedures, findings, and body structures.

**SSE** — Serious Safety Event. A patient safety incident that reaches the patient and results in death or serious harm. Triggers RCA and regulatory reporting.

**SSI** — Surgical Site Infection. A HAI occurring at or near a surgical incision within 30 days of an operation.

**STOW** (STOW-RS) — Store Over the Web. A DICOMweb service for storing DICOM instances to a server via HTTP POST.

**TEFCA** — Trusted Exchange Framework and Common Agreement. The US framework establishing rules and infrastructure for nationwide HIE.

**VBC** — Value-Based Care. A healthcare delivery model tying reimbursement to patient outcomes and cost efficiency rather than volume of services.

**VTE** — Venous Thromboembolism. A condition encompassing deep vein thrombosis (DVT) and pulmonary embolism (PE), tracked as a preventable HAI quality metric.

**WADO** (WADO-RS) — Web Access to DICOM Objects. A DICOMweb service for retrieving DICOM instances, rendered images, or metadata via HTTP GET.

**XCA** — Cross-Community Access. An IHE profile enabling HIE queries across different health information exchange communities.

**XDS** — Cross-Enterprise Document Sharing. An IHE profile for sharing clinical documents across organizations using a registry/repository architecture.

### 4.2 Philippine-Specific Acronyms

**DOH (PH)** — Department of Health (Philippines). The national government agency responsible for health regulation, hospital licensing, and public health policy. Issues Administrative Orders (AO) and Department Circulars (DC) governing healthcare operations.

**DSCA** — See Section 4.1. In Philippine context specifically: the combined Discharge Summary and Clinical Abstract document required by PhilHealth for inpatient claim submission (CF2 data source).

**eSOA** — Electronic Statement of Account. The machine-readable SOA format required by PhilHealth Circular 2023-0026 for submission with eClaims.

**OHSRS** — Online Hospital Statistical Reporting System. The DOH web portal for submitting monthly/quarterly/annual hospital statistical reports.

**PhilHealth** — Philippine Health Insurance Corporation. The national health insurance program providing coverage for Filipinos. Issues the PhilHealth Circular series governing eClaims, YAKAP, and benefit packages.

**PNDF** — Philippine National Drug Formulary. The official list of essential medicines for the Philippines, maintained by DOH. Used for medication order validation and generic substitution.

**RA 9439** — Republic Act 9439 (Hospital Detention Law). Prohibits hospitals from detaining patients who are unable to pay their hospital bills. Requires discharge regardless of payment status with promissory note option.

**YAKAP** — Yunit ng Kahusayan sa Pangangalagang Pangkalusugan (Unit of Excellence in Healthcare). PhilHealth's program mandating EMR adoption by ~800 private hospitals by June 2026 as a condition for continued PhilHealth accreditation.

**ACR (PH)** — Accreditation Category Rating. PhilHealth's classification system for accredited health facilities: Primary, Secondary, Tertiary, Special. The ACR category determines which benefit packages and case rates a facility may bill.

**DDB** — Dangerous Drugs Board. The Philippine government agency responsible for regulating dangerous drugs, implementing RA 9165, and maintaining the Prescription Monitoring Program.

**ESR** — Epidemiology and Surveillance Report. A DOH reporting format for notifiable disease data under the PIDSR framework, submitted weekly per epidemiological week.

**IHCP** — Individual Health Care Provider. The PhilHealth accreditation category for individual physicians and allied health professionals. IHCP-accredited status is required for a practitioner to appear as attending physician on a PhilHealth claim.

**KONSULTA** — The PhilHealth primary care capitation program (short for Kalusugang Pangkalahatan sa Komunidad). Facilities enroll as Konsulta providers; enrolled beneficiaries receive primary care from a single accredited facility; facility receives capitation payment per enrolled member per month.

**NHFR** — National Health Facility Registry. The DOH-maintained authoritative registry of all licensed health facilities in the Philippines. The NHFR-assigned facility ID is used as the canonical identifier in PhilHealth and DOH reporting systems.

**PIDSR** — Philippine Integrated Disease Surveillance and Response. The DOH framework for reporting, monitoring, and responding to nationally notifiable diseases and public health events, using ESR and immediate notification workflows.

**PhilSys** — Philippine Identification System. The national ID system established under RA 11055, administered by the Philippine Statistics Authority (PSA). Assigns a unique, lifetime PhilSys Number (PSN) to every Filipino citizen and resident.

**PSN** — PhilSys Number. The unique lifetime identification number issued under the PhilSys national ID program. Serves as a patient identity anchor across government health and social services systems.

**SPEED** — Surveillance in Post Extreme Emergencies and Disasters. A DOH rapid health assessment and surveillance system deployed during natural disasters, disease outbreaks, and public health emergencies.

**Z-Benefit** — A PhilHealth benefit program providing coverage for specified catastrophic conditions (cancer, end-stage renal disease, heart disease, stroke, etc.) at defined fixed case rates, regardless of actual cost incurred.

### 4.3 Clinical Terms (Non-Obvious)

**5 Rights** — The five medication safety checks performed before administration: Right Patient, Right Drug, Right Dose, Right Route, Right Time. Some institutions add a 6th (Right Documentation) and 7th (Right Reason). BCMA systems enforce these electronically.

**Care Pathway** — A multidisciplinary management plan defining the expected sequence of care for a specific condition or procedure (e.g., "Total Hip Replacement Pathway"). Distinct from an order set in that it spans the full episode of care.

**Care Plan** — A documented, personalized plan of care for an individual patient, including goals, interventions, responsible parties, and expected outcomes. May be short-term (admission) or long-term (chronic disease management).

**Crossmatch** — A pre-transfusion compatibility test confirming that donor blood is compatible with the recipient's blood. Results must be verified before any blood product transfusion.

**Flowsheet** — A time-series tabular display of clinical parameters (vitals, lab values, I&O, medications) across multiple time points, enabling trend visualization. The primary nursing charting format for ICU and high-dependency patients.

**H&P** — History and Physical. The initial physician assessment documenting a patient's medical history and physical examination findings, typically completed within 24 hours of admission.

**I&O** — Intake and Output. The measurement and documentation of all fluid entering (IV fluids, oral intake, blood products) and leaving (urine, drainage, emesis) a patient's body over a period (typically 24 hours), used to assess fluid balance.

**Order Set** — A pre-defined, evidence-based collection of orders for a specific clinical scenario (e.g., "Admission Orders — Community-Acquired Pneumonia"). Reduces variation and cognitive load. Individual orders within a set are editable before signing.

**OPPE** — See Section 4.1.

**Partogram** — A graphical record of labor progress tracking cervical dilation, fetal descent, uterine contractions, fetal heart rate, and maternal vital signs over time. Used in L&D to detect abnormal labor progress.

**PM Schedule** — Preventive Maintenance Schedule. The planned schedule of equipment inspections and maintenance tasks to ensure clinical equipment is in safe operating condition.

**POLST/MOLST** — Physician Orders for Life-Sustaining Treatment / Medical Orders for Life-Sustaining Treatment. Portable medical orders documenting a patient's wishes regarding CPR, mechanical ventilation, and other life-sustaining interventions.

**RCA** — See Section 4.1.

**Regimen** — A structured treatment protocol specifying drug combinations, doses, schedules, and durations for a specific condition (e.g., a chemotherapy regimen). More complex and longitudinal than a single order or order set.

**SOAP** — Subjective, Objective, Assessment, Plan. The structured format for physician progress notes: patient-reported symptoms (S), objective findings including vitals and labs (O), clinical assessment and diagnoses (A), and treatment plan (P).

**Sterilization Cycle** — A complete CSSD processing run for a batch of instruments, including cleaning, packaging, sterilization (autoclave or chemical), and quality verification. Each cycle is logged with cycle parameters and biological indicator results.

**FPPE** — See Section 4.1.

---

## Section 5 — Cross-Domain Entity Relationship Map

This table maps every major entity to the domain that owns its lifecycle and the domains that reference (but do not own) it. An "owned" entity means that domain is the authoritative source for creates, updates, and deletes. A "referenced" entity means that domain holds a foreign key or projection copy only.

| Entity | Owned By | Referenced By |
|--------|----------|---------------|
| Patient | Patient/Person Master (MPI) | Encounter, Scheduling, Billing, Coverage, Consent, Appointment, Document, Notification, Task, Telehealth, Patient Portal, all Clinical domains |
| Encounter | Encounter/Visit | Billing, CPOE, LIS, Pharmacy, Imaging, Nursing, Document, AuditEvent, Telehealth, Coverage |
| Practitioner | Practitioner/Provider Directory | Encounter, Scheduling, Appointment, CPOE, Document, Coverage, Billing, AuditEvent, Task |
| PractitionerRole | Practitioner/Provider Directory | Authorization, Scheduling, Appointment, Encounter |
| Organization | Organization & Location Registry | Practitioner, Patient, Encounter, Billing, Coverage, Document, AuditEvent |
| Location | Organization & Location Registry | Encounter, Scheduling, Appointment, Bed, Device, Task |
| Bed | Hospital Operations — Bed Management | Encounter, Scheduling, Appointment, Notification, Task |
| Schedule | Scheduling Engine | Appointment, Slot, Practitioner, Location, Device |
| Slot | Scheduling Engine | Appointment |
| Appointment | Appointments & Waitlist | Patient, Practitioner, Location, Slot, Encounter, Notification |
| Order | CPOE (Clinical Modules) | Encounter, Practitioner, Patient, Task, LIS, Pharmacy, Imaging, Billing, Notification |
| OrderItem | CPOE (Clinical Modules) | Order, Terminology, CDM/Billing, Pharmacy, LIS, Imaging |
| Result | LIS / RIS (Clinical Modules) | DiagnosticReport, Encounter, Practitioner, Notification, AuditEvent |
| Prescription | Pharmacy (Clinical Modules) | Order, Patient, Practitioner, Encounter, Dispensed­Item, Billing |
| DispensedItem | Pharmacy (Clinical Modules) | Prescription, Inventory, Billing, MedicationAdministration |
| MedicationAdministration | Nursing (Clinical Modules) | Patient, Encounter, Practitioner, Prescription, DispensedItem, AuditEvent |
| Observation (Vital) | Nursing / Clinical Modules | Encounter, Patient, DiagnosticReport, Notification, CDS |
| DiagnosticReport | LIS / RIS (Clinical Modules) | Encounter, Patient, Practitioner, Result, Document, Notification |
| AllergyIntolerance | Patient/Person Master (MPI) | CPOE (drug-allergy check), Pharmacy, Nursing, Patient Portal |
| Charge | Billing & Charges | Encounter, OrderItem, DispensedItem, Coverage, Claim |
| Claim | Coverage & Insurance Eligibility | Encounter, Patient, Practitioner, Charge, Payment, Coverage |
| Payment | Payments & Patient Financial Services | Claim, Charge, Patient, Encounter, AuditEvent |
| Coverage | Coverage & Insurance Eligibility | Patient, Encounter, Claim, Billing |
| Consent | Consent Management | Patient, Practitioner, Encounter, Document, AuditEvent |
| Document | Document Management (DMS) | Patient, Encounter, Practitioner, Consent, AuditEvent, HIE |
| Task | Tasks & Work Queues | Patient, Encounter, Practitioner, Notification, Order, Document |
| Notification | Notifications & Alerting | Patient, Practitioner, Task, Order, Result, AuditEvent |
| AuditEvent | Audit Log & Access Tracking | All entities (observer, not modifier) |
| Device | Organization & Location Registry | Location, Observation, AuditEvent, Schedule |

---

## Section 6 — Extension Contract Pattern

### 6.1 Overview

Core domains define the canonical, vertical-agnostic schema for each entity. They also declare **named extension slots** — typed attachment points on entities where vertical domains (hospital, dental, veterinary) and localization adapters (Philippine, US, UK) can inject additional fields, sub-schemas, and validation logic without modifying Core.

This pattern is inspired by FHIR Profiles and FHIR Extensions but is simplified for API-first use without requiring full FHIR conformance machinery.

### 6.2 Mechanics

**Slot Declaration (Core):** Core declares an extension slot as a typed field with a permissive base schema. The slot name is stable and versioned.

```yaml
# Core Patient entity — slot declarations
Patient:
  properties:
    id:
      type: string
      format: uuid
    name:
      type: string
    birthDate:
      type: string
      format: date
    # Extension slots — Core declares these as open schemas
    coverage:
      type: array
      description: "Extension slot — populated by coverage/insurance adapter"
      items:
        type: object
        additionalProperties: true
    identifiers:
      type: array
      description: "Extension slot — populated by facility MRN and government ID adapters"
      items:
        type: object
        additionalProperties: true
    relatedPersons:
      type: array
      description: "Extension slot — populated by next-of-kin, guarantor, legal guardian adapters"
      items:
        type: object
        additionalProperties: true
```

**Slot Population (Vertical or Adapter):** The hospital vertical and Philippine adapter replace the permissive `additionalProperties: true` schema with a concrete typed schema.

```yaml
# Hospital vertical + PH adapter — Patient.coverage[] slot population
Patient.coverage[]:
  items:
    type: object
    required: [type, payorName]
    properties:
      type:
        type: string
        enum: [philhealth, hmo, private_insurance, self_pay, government_subsidy]
      payorName:
        type: string
        example: "Philippine Health Insurance Corporation"
      membershipNumber:
        type: string
        description: "PhilHealth ID or HMO member number"
        example: "01-234567890-1"
      relationshipToMember:
        type: string
        enum: [self, dependent_spouse, dependent_child, dependent_parent]
      eligibilityStatus:
        type: string
        enum: [active, inactive, lifetime, suspended, unknown]
      benefitAvailable:
        type: boolean
      effectiveDate:
        type: string
        format: date
      expiryDate:
        type: string
        format: date
        nullable: true
```

**Veterinary vertical — same slot, different population:**

```yaml
# Veterinary vertical — Patient.relatedPersons[] slot (owner, not next-of-kin)
Patient.relatedPersons[]:
  items:
    type: object
    required: [relationship, name, contactPhone]
    properties:
      relationship:
        type: string
        enum: [owner, co_owner, authorized_agent, emergency_contact]
      name:
        type: string
      contactPhone:
        type: string
      ownershipPercentage:
        type: integer
        minimum: 0
        maximum: 100
        nullable: true
      financialResponsibility:
        type: boolean
        description: "True if this person is responsible for payment"
```

### 6.3 Rules for Extension Slots

1. **Core never reads slot contents.** Core business logic (patient search, MPI merge, encounter linking) operates only on Core fields. Slot contents are opaque to Core.
2. **Slots are typed in vertical specs.** When generating a hospital or adapter OpenAPI spec, replace all `additionalProperties: true` extension slots with the typed schema declared by the vertical/adapter.
3. **Slot names are stable and versioned.** Renaming a slot is a breaking change. Deprecation follows semver: mark old slot `deprecated: true`, introduce new slot name, support both for one major version.
4. **Multiple adapters can populate the same slot.** If two adapters both populate `Patient.identifiers[]`, their item schemas are merged (union type). Conflicts are resolved by the adapter registry — the more specific adapter wins.
5. **Core endpoints pass slot data through unchanged.** `createPatient` and `updatePatient` accept the full patient shape including populated slots. Core storage preserves slot data as-is.

### 6.4 Declared Slots by Entity

The following table summarizes all extension slots declared in Category 1 Core domains. Full slot specifications are in the relevant domain sections.

| Entity | Slot Name | Declared In | Example Populations |
|--------|-----------|-------------|---------------------|
| Patient | `coverage[]` | Patient/MPI | PhilHealth, HMO, Medicare |
| Patient | `identifiers[]` | Patient/MPI | PH: PhilHealth ID, PWD ID; US: SSN, Medicare ID |
| Patient | `relatedPersons[]` | Patient/MPI | Hospital: NOK, guarantor; Vet: owner |
| Encounter | `billingModel` | Encounter/Visit | fee-for-service, DRG, capitation, case-rate |
| Encounter | `careLevel` | Encounter/Visit | inpatient, outpatient, observation, ED, ICU, day-surgery |
| Encounter | `admissionSource` | Encounter/Visit | emergency, referral, transfer-in, elective, born-in-facility |
| Encounter | `dischargeDisposition` | Encounter/Visit | home, AMA, transfer-out, expired, LTAC |
| Encounter | `regulatoryFields[]` | Encounter/Visit | PH: DSCA data, PhilHealth case type |
| Schedule | `resourceTypes[]` | Scheduling Engine | dental: operatory; hospital: OR, cath-lab, MRI |
| Schedule | `bookingRules` | Scheduling Engine | lead-time, cancellation policy, overbooking rules |
| Billing | `chargingModel` | Billing & Charges | itemized, case-rate, DRG, capitation, bundled |
| Billing | `regulatoryLineItems[]` | Billing & Charges | PH: CF4 Parts A-G; US: UB-04 revenue codes |
| Coverage | `coverageType` | Coverage & Insurance | commercial, government, self-pay, capitation |
| Coverage | `governmentPrograms[]` | Coverage & Insurance | PH: PhilHealth; US: Medicare, Medicaid |
| Consent | `jurisdictionalRequirements[]` | Consent Management | PH: RA 10173 data sharing; US: HIPAA TPO |

---

## Section 7 — Category 1: Core Shared Health (22 Domains)

Category 1 contains the 22 domains that are shared across all Health API Hub verticals (hospital, clinic, dental, veterinary, telehealth-only). No Philippine-specific logic, PhilHealth fields, or jurisdiction-specific data is included in these domains. That content lives exclusively in Category 4 (Localization Adapters).

---

### 7.1 Patient / Person Master (MPI)

**Purpose.** Maintains the authoritative identity record for every person who receives or may receive care, enforcing cross-facility uniqueness through deterministic and probabilistic matching and controlled merge workflows.

**Key Entities.** Patient, PersonIdentifier, AllergyIntolerance, RelatedPerson, MergeEvent.

**Extension Points.** `Patient.coverage[]` (insurance/payer enrollment populated by Coverage adapter), `Patient.identifiers[]` (facility MRNs and government IDs populated by facility and jurisdiction adapters), `Patient.relatedPersons[]` (NOK, guarantor, legal guardian for hospital; owner for veterinary vertical), `Patient.sdohFlags[]` (social determinant flags populated by care management adapter).

**Key Workflows.**
- Patient registration: collect demographics, assign facility MRN, run MPI matching to detect potential duplicates before creating new record.
- Probabilistic merge review: present candidate duplicate pairs with match score; HIM staff reviews and approves, rejects, or escalates each pair.
- Deterministic merge (confirmed duplicate): one record designated survivor; non-survivor record linked with `replacedBy` pointer; all encounter references migrated to survivor; both records remain queryable (non-survivor returns 301 redirect to survivor).
- Cross-facility lookup: query by identifier (MRN, government ID, name+DOB) returns matches across all facilities in the organization, supporting PIXv2/PDQv2-compatible query patterns.
- Allergy list management: add, update (via amendment only), inactivate allergy records with clinical verification status.

**Key Business Rules.**
- Exactly one active MRN per patient per facility/branch; cross-facility encounters share the same Patient ID but may have different MRNs in each facility's `identifiers[]` slot.
- Hard delete is forbidden; soft-deactivation only (`status: inactive`); physical deletion blocked during data retention period.
- MPI merge requires at minimum one approving HIM-role user; the merge event itself is an immutable audit record.
- AllergyIntolerance records are append-only; corrections create an amendment record linked to the original with a mandatory `correctionReason` field.
- Patient demographic fields use CRDT LWW-Register semantics in offline-first deployments; the API must accept and return a `lastModifiedAt` field on each mutable demographic field for conflict detection.

**State Machine.** `status` values: `draft` → `active` → `inactive`.

`draft`: Record created but identity not yet verified (e.g., unidentified ER patient). `active`: Verified, can receive encounters and orders. `inactive`: Deceased, merged into another record, or administratively deactivated.

**Key Endpoints.** `listPatients`, `getPatient`, `createPatient`, `updatePatient`, `mergePatients`, `searchPatients`, `getPatientAllergyList`, `addPatientAllergy`.

**FHIR Mapping.** Patient, RelatedPerson, AllergyIntolerance, Person (for cross-facility identity).

**Localization Notes.** See `PH:PhilHealth Membership` adapter for Philippine Health ID, PWD ID, and senior citizen ID fields in `identifiers[]`. See `PH:RA9439 Compliance` adapter for promissory note linkage on the patient financial record.

---

### 7.2 Encounter / Visit

**Purpose.** The central spine of all clinical activity — every clinical observation, order, result, medication administration, charge, and document anchors to an Encounter, providing the episodic context for care delivery.

**Key Entities.** Encounter, Diagnosis (encounter-level), Participant (encounter-level practitioner link), HospitalizationDetail.

**Extension Points.** `Encounter.billingModel` (fee-for-service, DRG, capitation, case-rate, bundled payment — populated by billing configuration), `Encounter.careLevel` (inpatient, outpatient, observation, ED, ICU, day-surgery, home-health — populated by facility type adapter), `Encounter.admissionSource` (emergency, referral, transfer-in, elective, born-in-facility — populated by ADT adapter), `Encounter.dischargeDisposition` (home, AMA, transfer-out, expired, LTAC, hospice — populated by ADT adapter), `Encounter.regulatoryFields[]` (jurisdiction-specific fields: PH populates DSCA status, PhilHealth case type, YAKAP enrollment flag).

**Key Workflows.**
- Encounter creation: triggered by ADT admit event, ER triage registration, or outpatient check-in; linked to Patient MPI record and attending Practitioner.
- Encounter progression: status transitions driven by clinical events (admit → active care → discharge ordered → discharge complete); billing, nursing, and pharmacy workflows subscribe to status change events.
- Diagnosis management: add, rank (primary/secondary/admitting), and code (ICD-10) diagnoses throughout the encounter; final diagnosis set locked at discharge.
- Discharge workflow: multi-step coordinated process involving physician (clinical clearance + DSCA), nursing (checklist completion), and billing (charge reconciliation); each step updates encounter sub-status.
- Encounter linking: encounters can be linked to an EpisodeOfCare grouper for chronic or multi-visit condition tracking.

**Key Business Rules.**
- Every clinical record (order, observation, document, charge) must reference a valid, non-inactive Encounter ID; orphan records are rejected.
- An Encounter cannot transition to `finished` until at minimum one ICD-10-coded primary diagnosis is present and a discharging practitioner is linked.
- Concurrent encounters for the same patient at the same facility are allowed only for specific care levels (e.g., outpatient while inpatient is active); the API must enforce a configurable concurrency rule per `careLevel` combination.
- Encounter `status: entered-in-error` is a correction state (not deletion); the record is retained and suppressed from operational views but visible in audit queries.
- AMA discharge must capture a signed refusal document reference; the API enforces this by requiring `amaDocumentRef` on any discharge with `dischargeDisposition: ama`.

**State Machine.** `status` values: `planned` → `arrived` → `in-progress` → `on-leave` → `finished` → `entered-in-error`.

Allowed transitions: `planned` → `arrived` → `in-progress`; `in-progress` → `on-leave` → `in-progress`; `in-progress` → `finished`; any non-finished state → `entered-in-error`.

**Key Endpoints.** `listEncounters`, `getEncounter`, `createEncounter`, `updateEncounter`, `transitionEncounterStatus`, `addEncounterDiagnosis`, `getEncounterTimeline`, `dischargeEncounter`.

**FHIR Mapping.** Encounter, EpisodeOfCare, Condition (for encounter-level diagnoses).

**Localization Notes.** See `PH:ADT Adapter` for Philippine-specific admission type codes, DSCA workflow integration, and THOC (Transfer of Hospital Care) discharge disposition.

---

### 7.3 Practitioner / Provider Directory

**Purpose.** Maintains the authoritative registry of all healthcare practitioners (physicians, nurses, allied health, administrative staff) with their credentials, specialties, licenses, and organizational affiliations.

**Key Entities.** Practitioner, PractitionerRole, Qualification, Specialty.

**Extension Points.** `Practitioner.nationalIdentifiers[]` (jurisdiction-specific license and registration numbers: PH: PRC license, PhilHealth accreditation; US: NPI, DEA number; populated by jurisdiction adapter), `Practitioner.privilegesList[]` (clinical privileges granted at a specific facility, populated by credentialing adapter), `Practitioner.performanceMetrics` (OPPE/FPPE data, populated by quality management adapter).

**Key Workflows.**
- Practitioner onboarding: create Person record, attach qualifications and licenses, assign PractitionerRole(s) per facility/department, set scheduling availability.
- Credential verification: attach scanned credential documents; track expiry dates; generate alerts for expiring licenses.
- Role assignment: one Practitioner can hold multiple PractitionerRoles across locations (e.g., attending at Hospital A, consultant at Hospital B, telehealth provider).
- Directory search: lookup by name, specialty, location, availability, accepting-new-patients flag; used by scheduling and referral workflows.
- Deactivation: when a practitioner leaves, PractitionerRole is ended (period.end set); Practitioner record is never deleted; all historical encounters and orders retain the practitioner reference.

**Key Business Rules.**
- PractitionerRole is the billable unit: a Practitioner without an active PractitionerRole at a given facility cannot write orders or receive charges at that facility.
- Qualification expiry is tracked per license type; the API must surface an `expiryStatus` field (`valid`, `expiring-soon`, `expired`) derived from the qualification end date.
- A Practitioner deactivation must not cascade to historical Encounter or Order records; referential integrity must be preserved with soft-deactivation only.
- Supervisory relationships (attending → resident, attending → ROD coverage) are modeled via PractitionerRole with a `supervisorId` link, not a separate entity.

**State Machine.** `status` values (PractitionerRole): `active` → `suspended` → `inactive`.

**Key Endpoints.** `listPractitioners`, `getPractitioner`, `createPractitioner`, `updatePractitioner`, `listPractitionerRoles`, `assignPractitionerRole`, `searchPractitionerDirectory`, `getPractitionerSchedule`.

**FHIR Mapping.** Practitioner, PractitionerRole, Qualification.

**Localization Notes.** See `PH:Practitioner Credentials` adapter for PRC license number, PTR (Professional Tax Receipt), PhilHealth accreditation number, and DOH-recognized specialty classification fields.

---

### 7.4 Organization & Location Registry

**Purpose.** Maintains the structural hierarchy of health system entities (organizations, facilities, departments, rooms, beds) and the physical/logical locations where care is delivered.

**Key Entities.** Organization, Location, OrganizationAffiliation, Device.

**Extension Points.** `Organization.regulatoryIds[]` (jurisdiction-specific registration and accreditation IDs: PH: PhilSys, DOH license, PhilHealth accreditation; populated by jurisdiction adapter), `Location.capacityAttributes` (specialty-specific capacity metadata: hospital adds bed count, ward type, ICU classification; dental adds chair count, operatory type), `Location.operatingHours[]` (schedule-aware operating hours with holiday and emergency override support).

**Key Workflows.**
- Organization hierarchy setup: create root Organization, attach child Organizations (subsidiaries, affiliated practices), create Locations as physical or virtual care sites nested under Organizations.
- Location lifecycle: rooms, beds, and operatories are created, activated, placed out-of-service (maintenance), and decommissioned; status history is retained.
- Device registration: medical devices (monitors, infusion pumps, imaging equipment) registered under a Location with serial number, model, and PM schedule reference.
- Multi-facility patient routing: search locations by type, capacity, geographic coordinates, and current availability for patient transfer and referral routing.

**Key Business Rules.**
- Every clinical entity (Encounter, Bed, Schedule) must reference a Location that is in `active` status; attempts to assign patients to inactive locations are rejected.
- Organization hierarchy has a maximum depth of 5 levels (Organization → Region → Facility → Department → Room); deeper hierarchies require a configuration override.
- Decommissioned Locations retain their ID and are queryable with `status: inactive`; they are never deleted.
- Device must have a Location reference at all times; unlocated devices are invalid except in `device-storage` Location type.

**State Machine.** `status` values (Location): `active` → `suspended` → `inactive`.

**Key Endpoints.** `listOrganizations`, `getOrganization`, `createOrganization`, `listLocations`, `getLocation`, `createLocation`, `updateLocation`, `getLocationHierarchy`, `listDevices`.

**FHIR Mapping.** Organization, Location, OrganizationAffiliation, Device.

---

### 7.5 Identity, Authentication & Session

**Purpose.** Manages user authentication, session lifecycle, credential security, and multi-device session state in both online and offline-capable deployments.

**Key Entities.** User, Session, Credential, MFAFactor, DeviceRegistration.

**Extension Points.** `User.externalIdentityProviders[]` (OAuth2/OIDC provider links for SSO-enabled deployments, populated by enterprise identity adapter), `Session.offlineCapabilityScope` (defines what operations are allowed offline per deployment type: offline-first hospital vs online-only SaaS), `Credential.jurisdictionalPolicy` (password complexity, rotation, and MFA enforcement rules mandated by jurisdiction: PH: RA 10173; US: HIPAA Security Rule).

**Key Workflows.**
- Initial authentication: username/password → credential verification → session token (JWT) issuance → session registration; optional MFA challenge (TOTP) before token issuance.
- Offline authentication (offline-first deployments): credential hash cached locally at last successful online auth; offline auth verifies against hash; cached credentials expire after configurable TTL (default 7 days without cloud sync).
- Session lifecycle: JWT with configurable expiry (default 8 hours); inactivity auto-lock (default 5 minutes); inactivity auto-logout (default 15 minutes from lock); manual logout; force-logout by administrator.
- Device registration: devices must be registered before offline credential caching is permitted; device registration issues a device-scoped credential used for P2P sync authentication.
- Credential rotation: password change triggers re-derivation of offline credential hash; old cached credentials invalidated on all registered devices at next sync.

**Key Business Rules.**
- Force-logout issued by administrator must propagate to all active sessions and cached device credentials within one sync cycle; the API must expose a `forceLogoutUser` endpoint that writes to a revocation list consumed by all devices.
- Session tokens must contain `userId`, `organizationId`, `branchId`, `roleIds[]`, `deviceId`, and `issuedAt`; these claims are used by Authorization domain for access control without additional DB lookups.
- MFA factors are TOTP-based and must function offline after initial enrollment (TOTP is time-based, no network required).
- Cached offline credentials are stored encrypted (AES-256, key derived from device key + user password component); the API never returns plaintext credentials or hashes.
- Screen lock (re-auth via PIN) does not issue a new session token; it resumes the existing session if still within the expiry window.

**State Machine.** `status` values (Session): `active` → `locked` → `active` (re-auth); `active` → `expired`; `active` → `terminated`.

**Key Endpoints.** `login`, `logout`, `refreshSession`, `lockSession`, `unlockSession`, `forceLogoutUser`, `registerDevice`, `deregisterDevice`, `enrollMFA`, `verifyMFA`.

**FHIR Mapping.** domain-native (no FHIR R4 equivalent; closest approximation is AuditEvent for session events).

---

### 7.6 Authorization & RBAC/ABAC

**Purpose.** Enforces access control across all domains by evaluating a requesting user's roles, attributes, and context against resource-level permission policies.

**Key Entities.** Role, Permission, PolicyRule, RoleAssignment, AccessContext.

**Extension Points.** `Role.verticalPermissions[]` (vertical-specific permission sets appended to base role: hospital adds `order:sign`, `dsca:write`; dental adds `xray:read`; populated by vertical adapter), `PolicyRule.attributeConditions[]` (ABAC conditions evaluated at request time: e.g., `encounter.attendingId == user.id` for physician-patient scope restriction), `Role.supervisorCapabilities[]` (elevated permissions granted by `supervisor: true` flag, populated by facility configuration).

**Key Workflows.**
- Role assignment: user is assigned one or more Roles per Organization/Branch context; roles are contextual (a user can be `physician` at Branch A and `admin` at Branch B).
- Permission evaluation: on each API request, evaluate: (1) Role-based permissions (RBAC), then (2) attribute conditions if PolicyRules exist for the resource type (ABAC); deny by default.
- Supervisor elevation: users with `supervisor: true` flag on a role receive augmented permissions (approve, override, escalate) without requiring a separate supervisor role entity.
- Permission audit: every permission check (grant or deny) is written to the Audit Log domain with resource type, action, decision, and policy rule ID.
- Emergency access override: a designated break-glass mechanism allows a clinician to access a patient outside their normal scope with mandatory reason capture; generates a high-priority audit event.

**Key Business Rules.**
- Deny by default: a resource access request with no matching permission rule results in 403, never in a default-allow fallback.
- ABAC conditions are evaluated in addition to, not instead of, RBAC rules; a user must pass both RBAC and ABAC checks to access a resource.
- Role assignment changes take effect on the user's next session token; the API must support `invalidateSessionsForUser` to force immediate re-authentication when a demotion or revocation occurs.
- The break-glass override is time-limited (configurable, default 1 hour) and auto-expires; extended access requires a new override request.
- Permission rules are version-controlled; a `policyVersion` field on PolicyRule enables rollback if a rule change has unintended consequences.

**Key Endpoints.** `listRoles`, `getRole`, `createRole`, `assignRole`, `revokeRole`, `evaluatePermission`, `listUserPermissions`, `createPolicyRule`, `triggerBreakGlass`.

**FHIR Mapping.** domain-native (no direct FHIR R4 equivalent; closest is AuditEvent for permission decisions).

---

### 7.7 Audit Log & Access Tracking

**Purpose.** Provides an immutable, append-only log of all data access, modification, authentication, authorization, and system events for compliance, forensic investigation, and quality assurance.

**Key Entities.** AuditEvent, DataAccessLog, AmendmentRecord.

**Extension Points.** `AuditEvent.jurisdictionalCategories[]` (regulatory reporting categories required by jurisdiction: PH: RA 10173 audit categories; US: HIPAA access log categories), `AuditEvent.retentionPolicy` (retention period derived from event type and jurisdiction: clinical records 10 years inpatient, 7 years outpatient per PH DOH DC 2021-0226).

**Key Workflows.**
- Automatic event capture: every API request that reads or writes PHI generates an AuditEvent asynchronously; the audit write must not block the primary operation.
- Critical event escalation: events of type `emergency-access`, `break-glass`, `failed-login-threshold`, `permission-denied-repeated` trigger real-time notifications to the security officer role.
- Read access logging: read operations on sensitive resources (patient demographics, clinical notes, financial records) are logged with `action: read`; required by RA 10173 and HIPAA.
- Amendment tracking: every clinical record correction (not deletion) generates an AmendmentRecord linking the correction to the original, the correcting user, timestamp, and reason.
- Audit report generation: query audit logs by patient, user, resource type, date range, and event type for compliance reporting, breach investigation, and access reviews.

**Key Business Rules.**
- AuditEvent records are immutable (G-Set CRDT in offline-first deployments); no update or delete endpoint exists for AuditEvent.
- Every AuditEvent must contain: `eventId`, `timestamp`, `actorId` (user), `actorRole`, `resourceType`, `resourceId`, `action` (create/read/update/delete/login/logout/print/export), `outcome` (success/failure), `deviceId`, `sessionId`, `ipAddress` (where available), `organizationId`, `branchId`.
- Audit logs must be queryable but never modifiable through the primary API; a separate read-only audit query service with its own RBAC controls access.
- Retention enforcement is automated: AuditEvents are archived (not deleted) after the active retention period; the archive is queryable by authorized HIM and IT staff only.

**Key Endpoints.** `queryAuditEvents`, `getAuditEvent`, `exportAuditReport`, `getResourceAuditTrail`, `getPatientAccessLog`.

**FHIR Mapping.** AuditEvent, Provenance.

**Localization Notes.** See `PH:RA10173 Compliance` adapter for the Data Privacy Act audit trail requirements including data subject access request (DSAR) workflow.

---

### 7.8 Consent Management

**Purpose.** Captures, stores, and enforces patient consent for treatment, data sharing, research enrollment, advance directives, and jurisdiction-mandated consent forms.

**Key Entities.** Consent, ConsentCategory, ConsentProvision, AdvanceDirective.

**Extension Points.** `Consent.jurisdictionalRequirements[]` (consent categories mandated by jurisdiction: PH: RA 10173 data sharing consent, PhilHealth benefit assignment; US: HIPAA TPO notice, 42 CFR Part 2 substance abuse; populated by jurisdiction adapter), `Consent.signatoryCapture` (signature mechanism metadata: digital signature hash, witness attestation, biometric reference — populated by deployment-specific capture adapter), `Consent.researchProtocols[]` (IRB-approved research study enrollment consents, populated by research module adapter).

**Key Workflows.**
- Consent capture: present consent category to patient or authorized representative; record acceptance, refusal, or partial acceptance with signature capture; link to Patient and optionally to Encounter.
- Consent verification: at the point of data access or sharing, evaluate active consents for the relevant category and patient; deny or restrict access where consent is absent or revoked.
- Advance directive management: capture POLST/MOLST and DNR orders with physician attestation; these are surfaced as safety flags in clinical interfaces.
- Consent withdrawal: patient may withdraw consent at any time; withdrawal is recorded as a new Consent record with `status: inactive`; does not retroactively invalidate past data access under prior consent.
- Minor and incapacitated patient consents: consent given by legally authorized representative (LAR) with relationship and authorization basis documented.

**Key Business Rules.**
- A Consent record is never deleted; revocation creates a new linked record; both records are retained with full audit trail.
- Treatment consent and data privacy consent are distinct consent categories with separate Consent records; systems must not conflate them.
- Consent status must be evaluated at query time, not cached; a consent revoked 1 minute ago must block a data export request in the same session.
- Advance directives (DNR, POLST) must be surfaced as read-only flags in any clinical interface displaying patient safety information; this is a display contract, not an enforcement contract (enforcement is clinical, not system).
- Consent for a minor patient automatically expires when the minor reaches the age of legal majority (configurable per jurisdiction); the system generates a notification for re-consent.

**State Machine.** `status` values: `proposed` → `active` → `inactive` (withdrawn or expired).

**Key Endpoints.** `listConsents`, `getConsent`, `createConsent`, `updateConsentStatus`, `getActiveConsentsForPatient`, `listAdvanceDirectives`, `createAdvanceDirective`.

**FHIR Mapping.** Consent.

**Localization Notes.** See `PH:RA10173 Compliance` adapter for data privacy consent categories and the DOH-mandated informed consent form requirements.

---

### 7.9 Scheduling Engine

**Purpose.** Provides the generic resource-and-time-slot engine that powers all appointment booking across verticals — abstracting away whether the resource is a clinician, a room, a piece of equipment, or a procedure slot.

**Key Entities.** Schedule, Slot, ScheduleRule, BlockedPeriod, ResourceType.

**Extension Points.** `Schedule.resourceTypes[]` (the set of resource categories this vertical supports: dental adds `operatory`, `dental-chair`; hospital adds `or-suite`, `cath-lab`, `mri-suite`, `dialysis-chair`; populated by vertical adapter), `Schedule.bookingRules` (lead-time requirements, cancellation policies, overbooking buffer, and patient eligibility rules — populated by facility configuration), `ScheduleRule.recurrencePattern` (complex recurrence including rotating shifts, academic calendar blocks, and on-call overrides — populated by workforce management adapter).

**Key Workflows.**
- Schedule creation: define a Schedule for a resource (practitioner, room, or equipment) over a time horizon with operating hours, slot duration, and booking rules.
- Slot generation: slots are generated from ScheduleRules either eagerly (pre-generated up to a horizon) or lazily (generated on query); slots carry a `status` of `free`, `busy`, `blocked`, `tentative`.
- Slot reservation: a slot transitions from `free` to `tentative` on hold, then to `busy` on confirmed appointment booking; the engine enforces no double-booking.
- Blocking: periods can be blocked for holidays, maintenance, staff absence, or out-of-office without creating individual slot records.
- Availability query: find free slots for a given resource type, specialty, or specific practitioner within a date range; supports multi-resource availability (e.g., find a slot where surgeon AND OR suite AND anesthesiologist are all available).

**Key Business Rules.**
- A slot cannot be double-booked; concurrent booking attempts must use optimistic locking (version field) or database-level constraints; return 409 Conflict on collision.
- The scheduling engine is resource-agnostic; resource type classification is injected via the `resourceTypes[]` extension slot; Core never hardcodes resource types.
- Blocked periods take priority over generated slots; a block on an already-booked slot generates a conflict notification but does not auto-cancel the existing appointment.
- Schedule rules must support timezone-aware operating hours; all slot times are stored in UTC and converted at display time using the Location's timezone.
- UNKNOWN: maximum slot generation horizon — conservative default is 90 days rolling; facilities can extend via configuration.

**State Machine.** `status` values (Slot): `free` → `busy`; `free` → `blocked`; `busy` → `free` (cancellation); `tentative` → `busy` → `free`.

**Key Endpoints.** `listSchedules`, `getSchedule`, `createSchedule`, `updateSchedule`, `listSlots`, `getSlot`, `blockSlots`, `unblockSlots`, `queryAvailability`.

**FHIR Mapping.** Schedule, Slot.

---

### 7.10 Appointments & Waitlist

**Purpose.** Manages the booking, confirmation, rescheduling, cancellation, and waitlist management of patient appointments against slots from the Scheduling Engine.

**Key Entities.** Appointment, AppointmentParticipant, WaitlistEntry, AppointmentReminder.

**Extension Points.** `Appointment.referralContext` (referral letter reference, referring practitioner, and urgency classification populated by referral management adapter), `Appointment.preAppointmentInstructions[]` (procedure-specific preparation instructions: fasting requirements, bowel prep, medication holds — populated by clinical protocol adapter), `Appointment.telehealth­Link` (virtual visit URL and platform metadata populated by Telehealth adapter when appointment type is virtual).

**Key Workflows.**
- Appointment booking: patient or staff selects an available slot; creates Appointment linking Patient, Practitioner(s), Location, and Slot; triggers confirmation notification.
- Rescheduling: cancel existing appointment (slot returns to `free`), book new slot; patient notified; waitlist checked for released slot.
- Waitlist management: when no slots are available, patient added to WaitlistEntry with priority score; when a slot opens, highest-priority waitlist patient is notified and offered the slot with a response window.
- Appointment check-in: patient arrives; appointment transitions to `arrived`; triggers encounter creation if not pre-created.
- No-show handling: appointment reaches start time without patient check-in; system transitions to `noshow` after configurable grace period; no-show rate tracked per patient and per practitioner.

**Key Business Rules.**
- An Appointment must reference a valid Slot in `free` or `tentative` status; attempting to book a `busy` or `blocked` slot returns 409.
- Cancellation lead-time rules are enforced from `Schedule.bookingRules.cancellationPolicy`; late cancellations may generate a fee charge event.
- Waitlist entries are prioritized by: (1) clinical urgency (configured by practitioner), (2) wait time (FIFO within same urgency level), (3) patient preference for specific practitioners or times.
- Appointment reminders are sent at configurable intervals (default: 72 hours, 24 hours, and 2 hours before appointment) via the Notifications domain; reminder delivery is logged for audit.
- Appointments are never hard-deleted; cancellations set `status: cancelled` with `cancellationReason`; historical appointment data is required for no-show analysis and utilization reporting.

**State Machine.** `status` values: `proposed` → `pending` → `booked` → `arrived` → `fulfilled` → `noshow`; `booked` → `cancelled`; `fulfilled` → `entered-in-error`.

**Key Endpoints.** `listAppointments`, `getAppointment`, `createAppointment`, `updateAppointment`, `cancelAppointment`, `checkInAppointment`, `joinWaitlist`, `listWaitlistEntries`, `offerWaitlistSlot`.

**FHIR Mapping.** Appointment, AppointmentResponse, Schedule (referenced).

---

### 7.11 Billing & Charges

**Purpose.** Captures every billable event generated by clinical activity, maps each charge to the facility's Charge Description Master, and assembles the charge ledger that feeds downstream invoicing and claims workflows.

**Key Entities.** Charge, ChargeItem, ChargeDescriptionMaster (CDM), FeeSchedule, ChargeAdjustment.

**Extension Points.** `Charge.chargingModel` (the reimbursement model under which charges are billed: itemized fee-for-service, case-rate, DRG, capitation, bundled episode — populated by billing configuration and coverage adapter), `Charge.regulatoryLineItems[]` (jurisdiction-specific charge categorization: PH: CF4 Parts A-G mapping for PhilHealth; US: UB-04 revenue codes; populated by jurisdiction adapter), `ChargeItem.professionalFeeRecipients[]` (professional fee split allocations to individual practitioners, populated by hospital billing configuration).

**Key Workflows.**
- Automatic charge capture: clinical events (order signed and resulted, medication dispensed, procedure completed) trigger automatic ChargeItem creation against the patient's Encounter; charge status begins as `pending` pending billing clerk review.
- CDM lookup: each ChargeItem resolves to a CDM entry via service code (CPT, RVS, or local code); the CDM entry provides the standard price, category, and any applicable fee schedule overrides.
- Manual charge entry: billing clerks can add ChargeItems for items not auto-captured (room-and-board, professional fees, supplies, transport); these require CDM code selection.
- Charge verification: billing clerk reviews `pending` charges, validates quantities and codes, marks batch as `verified`; verified charges are locked and cannot be modified without an adjustment record.
- Charge adjustment: price corrections and write-offs create a ChargeAdjustment record linked to the original Charge; the original is never modified (immutability pattern).

**Key Business Rules.**
- A Charge must reference a valid, active Encounter and a CDM entry; charges without an Encounter reference are rejected.
- Charge status `verified` is a lock state; any modification after verification requires a ChargeAdjustment with mandatory reason and approving user.
- Duplicate charge detection: the API checks for existing ChargeItems matching the same (Encounter, CDM code, service date) within a configurable deduplication window (default 24 hours); return a 409 with the candidate duplicate charge ID.
- Room-and-board charges are generated automatically on a per-day basis by a scheduled job; the API must expose a `generateDailyCharges` endpoint for manual trigger and testing.
- Charge capture does not include payor-specific pricing or benefit deductions; that computation is in the Coverage & Insurance domain; Billing only records standard CDM prices.

**State Machine.** `status` values: `pending` → `verified` → `invoiced`; `pending` → `void`; `verified` → `adjusted`.

**Key Endpoints.** `listCharges`, `getCharge`, `createCharge`, `verifyCharges`, `voidCharge`, `createChargeAdjustment`, `lookupCDM`, `generateDailyCharges`, `getEncounterChargesSummary`.

**FHIR Mapping.** ChargeItem, ChargeItemDefinition (for CDM), Invoice (partially).

**Localization Notes.** See `PH:PhilHealth eClaims` adapter for CF4 Part A-G line item categorization and eSOA generation.

---

### 7.12 Payments & Patient Financial Services

**Purpose.** Records all payment transactions, manages patient account balances, issues official receipts, and supports financial assistance workflows including promissory notes and payment plans.

**Key Entities.** Payment, Receipt, PatientAccount, PaymentPlan, PromissoryNote, Refund.

**Extension Points.** `Payment.paymentMethods[]` (accepted tender types per deployment: PH adds GCash, Maya, InstaPay; US adds HSA/FSA, ACH; populated by payment gateway adapter), `PatientAccount.financialAssistancePrograms[]` (charity care, sliding-scale fee, and government subsidy eligibility tracking — populated by financial counseling adapter), `Receipt.fiscalComplianceFields` (tax invoice fields required by jurisdiction: PH: BIR OR number, TIN; populated by tax compliance adapter).

**Key Workflows.**
- Payment collection: billing staff records payment against a patient account balance; payment is linked to specific Charges or Invoices; receipt is generated immediately with a sequential receipt number.
- Partial payment and installment plans: if full balance is not settled, remaining balance tracked; PaymentPlan created with installment schedule; system monitors plan compliance and generates reminders.
- Promissory note workflow: when a patient cannot pay at discharge, a PromissoryNote is generated with outstanding balance, payment terms, and patient acknowledgment signature; discharge proceeds immediately and is never blocked by balance.
- Refund processing: when a patient overpays or a claim adjustment reduces the patient balance below amounts collected, a Refund record is created; the refund must be approved by a billing supervisor before disbursement.
- Receipt numbering (offline-first): receipt numbers use device-prefix + sequential counter (e.g., `A-0001`, `B-0001`) to prevent collision during offline operation; numbers are reconciled and validated unique at sync.

**Key Business Rules.**
- A payment cannot exceed the outstanding balance for an Encounter plus a configurable overpayment tolerance (default 0); overpayments require explicit supervisor approval.
- Receipts are immutable; cancellation creates a linked void receipt record; the original receipt is retained in full.
- Anti-detention regulatory compliance (where mandated by local law) is enforced by the discharge workflow in the Encounter/ADT domain, not by this domain; this domain's role is to record the PromissoryNote, not to gate discharge. See `PH:RA 9439` adapter.
- Receipt numbers must be globally unique within a branch after sync reconciliation; the API must expose a `reconcileReceiptNumbers` endpoint for post-sync validation.
- All payment transactions are server-authoritative; they cannot be created in a fully offline state without a pending-sync queue; the API must support a `pendingPayment` status for queued transactions.

**State Machine.** `status` values (Payment): `pending` → `completed` → `voided`; `pending` → `failed`.

**Key Endpoints.** `listPayments`, `getPayment`, `createPayment`, `voidPayment`, `getPatientAccount`, `createPaymentPlan`, `createPromissoryNote`, `processRefund`, `getReceiptHistory`.

**FHIR Mapping.** PaymentNotice, PaymentReconciliation, Invoice (partially).

**Localization Notes.** See `PH:RA9439 Compliance` adapter for promissory note template, mandatory disclosure text, and zero-detention enforcement flag. See `PH:BIR Fiscal` adapter for BIR-compliant official receipt fields.

---

### 7.13 Coverage & Insurance Eligibility

**Purpose.** Stores patient insurance coverage records, performs real-time eligibility verification, calculates benefit deductions, and provides the payor data required for claims generation.

**Key Entities.** Coverage, CoverageBenefit, EligibilityRequest, EligibilityResponse, PayorDirectory.

**Extension Points.** `Coverage.coverageType` (broad classification of coverage: commercial, government, self-pay, capitation, workers-comp — populated by payor configuration), `Coverage.governmentPrograms[]` (government health program enrollment: PH: PhilHealth with membership type, DSWD Listahanan, PWD/senior discount; US: Medicare, Medicaid, CHIP; populated by jurisdiction adapter), `Coverage.authorizationRules[]` (prior authorization requirements per service type defined by the payor — populated by payor-specific integration adapter).

**Key Workflows.**
- Coverage enrollment: attach one or more Coverage records to a Patient at registration; each coverage has payor, plan, member ID, group, and effective dates.
- Real-time eligibility check: send an EligibilityRequest to the payor (API or EDI 270/271); receive EligibilityResponse with active status, benefit limits, and copay/coinsurance information; store the response against the Coverage record.
- Benefit calculation: given a set of Charges for an Encounter, apply coverage rules (deductibles, copay, coinsurance, out-of-pocket maximums) to produce the patient responsibility amount displayed on the Statement of Account.
- Prior authorization tracking: for services requiring pre-approval, create an authorization request linked to the Coverage and the planned service; track status (requested, approved, denied, expired).
- Coordination of benefits (COB): when a patient has multiple active coverages, apply primary/secondary sequencing rules to determine payor responsibility per charge.

**Key Business Rules.**
- A patient may have at most one primary coverage active per coverage type at any time; attempting to create a second primary commercial coverage returns a conflict requiring explicit coordination-of-benefits designation.
- Eligibility verification results are time-stamped; the API must expose `verificationTimestamp` and `verificationSource` (api, manual-entry, cached) on every Coverage record.
- Benefit calculations are advisory (used for patient financial counseling and SOA display); actual claim adjudication by the payor supersedes the calculated estimate.
- Coverage records are never deleted; expired coverages (past `endDate`) are queryable for historical claim reconstruction.
- The PayorDirectory maintains payor metadata (name, payor ID, EDI endpoints, API credentials reference); credentials are stored encrypted and never returned in API responses.

**State Machine.** `status` values (Coverage): `draft` → `active` → `cancelled`; `active` → `entered-in-error`.

**Key Endpoints.** `listCoverages`, `getCoverage`, `createCoverage`, `updateCoverage`, `checkEligibility`, `getEligibilityHistory`, `calculateBenefitDeduction`, `submitPriorAuth`, `getPriorAuthStatus`.

**FHIR Mapping.** Coverage, CoverageEligibilityRequest, CoverageEligibilityResponse.

**Localization Notes.** See `PH:PhilHealth Membership` adapter for PhilHealth ID format, membership type codes (direct contributor, indirect contributor, sponsored, lifetime), and YAKAP eligibility verification endpoint.

---

### 7.14 Document Management (DMS)

**Purpose.** Provides a structured store for all clinical and administrative documents — signed forms, discharge summaries, referral letters, images, imported records — with version control, access control, and retention management.

**Key Entities.** Document, DocumentVersion, DocumentCategory, RetentionPolicy.

**Extension Points.** `Document.clinicalContextTags[]` (clinical workflow context tags enabling smart retrieval: discharge summary, consent form, lab report, imaging report, advance directive — populated by clinical module adapters), `Document.retentionRules` (jurisdiction-specific retention period and disposition rules: PH: DOH DC 2021-0226 10yr/7yr; US: HIPAA minimum 6 years; populated by jurisdiction adapter), `Document.exchangeProfiles[]` (interoperability metadata for HIE sharing: XDS metadata, CDA document type, CCDA template ID — populated by HIE adapter).

**Key Workflows.**
- Document upload: binary content submitted via multipart upload; system validates file type (PDF, JPEG, PNG, DICOM, CCDA/XML), generates a document record with metadata, stores binary in object storage, returns document ID.
- Document versioning: updating a finalized document creates a new DocumentVersion linked to the original; the original is never overwritten; only the latest version is returned by default (previous versions accessible via version history endpoint).
- Clinical document signing: structured documents (discharge summaries, consent forms) progress through a signing workflow: `draft` → `pending-signature` → `signed`; signed documents are immutable.
- Retention enforcement: documents beyond their retention period are flagged for archival or disposition review; hard deletion is blocked during the retention period; disposition events are logged in the Audit domain.
- Patient records request (ROI): HIM staff responds to patient or third-party records requests by assembling and releasing specific document sets; release events are fully audit-logged.

**Key Business Rules.**
- Signed documents are immutable; any update creates a new version with status `amendment` and links to the original; both are stored and accessible.
- Binary content is stored in object storage with a pre-signed URL mechanism; the DMS API returns URLs with short expiry (default 15 minutes) for display, never raw binary content in API responses.
- Documents must be linked to at minimum one of: Patient, Encounter, or Practitioner; free-floating documents are not permitted.
- File size limits are enforced at upload time; default maximum is 50 MB per document; DICOM files route to the PACS integration layer, not DMS.
- The `DocumentCategory` taxonomy is extensible (new categories added by vertical or adapter configuration) but category IDs are stable once assigned (no reclassification without migration).

**State Machine.** `status` values: `draft` → `pending-signature` → `signed`; `draft` → `withdrawn`; `signed` → `superseded` (when a new version replaces it).

**Key Endpoints.** `listDocuments`, `getDocument`, `uploadDocument`, `getDocumentVersionHistory`, `signDocument`, `requestDocumentRelease`, `listDocumentCategories`, `getDocumentDownloadUrl`.

**FHIR Mapping.** DocumentReference, Binary (for content), Composition (for structured CDA documents).

---

### 7.15 Communication & Messaging

**Purpose.** Provides secure, audited, in-system messaging between clinical staff, care teams, and patients — replacing unsafe consumer messaging apps (Viber, SMS) for patient-related communications.

**Key Entities.** Message, Thread, ThreadParticipant, MessageAttachment.

**Extension Points.** `Thread.clinicalContext` (links a thread to a specific Patient, Encounter, or Order so messages are surfaced in the correct clinical workspace — populated by clinical module adapters), `Thread.externalChannels[]` (integration with external communication platforms for non-PHI notifications: SMS gateway, push notification service — populated by communication gateway adapter), `Message.urgencyClassification` (clinical urgency tier mapping for routing and escalation rules — populated by clinical workflow adapter).

**Key Workflows.**
- Thread creation: a user creates a thread with one or more participants (staff, patient via Patient Portal, or care team); threads can be linked to a clinical context (patient, encounter, order).
- Message send: sender composes message with optional attachment; message delivered to all thread participants; unread count incremented per recipient.
- Critical communication workflow: a message tagged `urgent` or `critical` bypasses standard in-box and triggers an immediate Notification in the Notifications domain; read receipt tracked.
- Patient communication: when a thread participant is a patient (via Patient Portal), PHI-containing messages are encrypted end-to-end; external channel bridging is used for appointment reminders only (no PHI in external channels).
- Message archival: threads and messages are retained per the Audit/DMS retention policies; closed threads are archived but fully searchable by authorized users.

**Key Business Rules.**
- No PHI may be transmitted via external channels (SMS, email, push notification); external channels carry only non-PHI content (appointment time, "you have a new message" placeholder).
- All message delivery events (sent, delivered, read) are logged in the Audit domain with participant IDs and timestamps.
- Thread participants cannot be removed from a thread retroactively; a participant who leaves receives `participant_status: inactive` and stops receiving new messages but retains read access to prior messages.
- Message content is immutable once sent; retraction creates a system message ("Message retracted by [sender]") but the original content is preserved in the audit log.
- UNKNOWN: maximum message size and attachment count per message — conservative defaults are 10,000 characters and 5 attachments of 10 MB each.

**Key Endpoints.** `listThreads`, `getThread`, `createThread`, `sendMessage`, `getMessages`, `markMessagesRead`, `addThreadParticipant`, `archiveThread`.

**FHIR Mapping.** Communication, CommunicationRequest.

---

### 7.16 Notifications & Alerting

**Purpose.** Delivers time-sensitive clinical and operational alerts to the right user at the right time through in-app, audible, and external channels, with escalation for unacknowledged critical events.

**Key Entities.** Notification, NotificationRule, EscalationPolicy, AlertEvent.

**Extension Points.** `Notification.deliveryChannels[]` (platform-specific delivery mechanisms: offline-first desktop uses in-app + audible; SaaS uses push + email; populated by deployment adapter), `NotificationRule.clinicalTriggers[]` (clinical event types that generate notifications: critical lab value, vital sign threshold breach, overdue medication — populated by clinical module adapters), `EscalationPolicy.escalationChain[]` (escalation recipients and timing rules per notification priority — populated by facility configuration).

**Key Workflows.**
- Notification generation: a clinical or operational event triggers a Notification via a published domain event; the Notifications domain receives the event, applies routing rules, and delivers to the correct recipients.
- Priority routing: `critical` notifications bypass queue and deliver immediately with audible alert and persistent acknowledgment requirement; `normal` notifications deliver to in-box; `low` aggregate as digest.
- Acknowledgment tracking: recipients acknowledge critical and high-priority notifications explicitly; acknowledgment is timestamped and logged; time-to-acknowledge is a quality metric.
- Escalation: unacknowledged `critical` notifications re-notify at configurable interval (default 15 minutes); at a second threshold (default 30 minutes), escalate to supervisor or all peers in the same role/ward.
- Notification preferences: users configure per-device audible alert settings (muted for night mode near patient rooms), notification frequency for low-priority types, and delegation during absence.

**Key Business Rules.**
- Notification delivery is asynchronous and must not block the source clinical operation; the source domain publishes an event and the Notifications domain processes it independently.
- In offline-first deployments, notifications generated on the local device are delivered immediately; notifications originating from other devices appear on sync; the system must display `last synced` timestamp when data may be stale.
- Every Notification must contain: `notificationId`, `recipientId`, `type` (alert, order, result, task, system, sync), `priority` (critical, high, normal, low), `sourceModule`, `sourceRecordId`, `title` (max 100 chars), `body` (max 500 chars), `createdAt`, `readAt` (nullable), `acknowledgedAt` (nullable), `deviceId` (originating device).
- A `critical` Notification with no acknowledgment after the full escalation chain is exhausted generates an SSE (Serious Safety Event) candidate record for quality management review.
- Notification content must never include PHI in the `title` field when the notification may be visible on a lock screen or external channel; PHI belongs in `body` only, displayed after authentication.

**Key Endpoints.** `listNotifications`, `getNotification`, `acknowledgeNotification`, `markNotificationRead`, `createNotificationRule`, `getNotificationRules`, `testNotificationDelivery`, `getUserNotificationPreferences`, `updateNotificationPreferences`.

**FHIR Mapping.** domain-native (no direct FHIR R4 equivalent; closest is Communication for the delivery event record).

---

### 7.17 Tasks & Work Queues

**Purpose.** Tracks actionable work items assigned to individual users or role-based queues, ensuring clinical and operational tasks are not lost and their completion is auditable.

**Key Entities.** Task, TaskQueue, TaskComment, TaskTemplate.

**Extension Points.** `Task.clinicalPriority` (clinical urgency classification for task prioritization: STAT, urgent, routine — populated by CPOE and nursing adapters), `Task.workflowContext` (the clinical or operational workflow this task belongs to: specimen collection, medication administration, discharge preparation — populated by domain-specific adapters), `TaskQueue.routingRules[]` (auto-assignment rules mapping task types to roles, wards, or individuals — populated by facility workflow configuration).

**Key Workflows.**
- Task creation: a clinical event (order acknowledged, lab resulted, imaging completed) or a user action generates a Task assigned to a specific user or a role-based queue.
- Task assignment and routing: tasks without a direct assignee route to a queue; queue members claim tasks or a routing rule auto-assigns based on workload, role, and location.
- Task lifecycle: task progresses from `requested` to `in-progress` to `completed`; tasks can be `cancelled` with a reason or `on-hold` (blocked by a dependency); all transitions are logged.
- Task escalation: overdue tasks (past `dueDate`) escalate per the task's escalation policy; supervisor receives notification when a `high` priority task is overdue.
- Shift handover: at shift change, incomplete tasks owned by the outgoing user are transferred to the incoming user or returned to the queue; handover event logged with both user IDs.

**Key Business Rules.**
- Every Task must have a `dueDate` (or `dueIn` duration from creation); tasks without due dates are rejected.
- Tasks linked to clinical orders (specimen collection, medication administration) must inherit the order's priority and link to the order's `Encounter`; orphaned clinical tasks are invalid.
- Task `completed` status requires a completion note if the task type has `requiresCompletionNote: true` in its TaskTemplate; common examples: specimen collection, medication administration, and patient transport.
- STAT tasks must appear at the top of all relevant queues regardless of creation time; the API must support `priority: stat` as a sort override on all task list queries.
- Tasks are never hard-deleted; `cancelled` tasks retain their full history for audit and quality analysis.

**State Machine.** `status` values: `requested` → `accepted` → `in-progress` → `completed`; `requested` → `cancelled`; `in-progress` → `on-hold` → `in-progress`; `in-progress` → `failed`.

**Key Endpoints.** `listTasks`, `getTask`, `createTask`, `updateTask`, `assignTask`, `completeTask`, `cancelTask`, `listTaskQueues`, `claimTaskFromQueue`, `transferTasksOnHandover`.

**FHIR Mapping.** Task.

---

### 7.18 Forms & Questionnaires

**Purpose.** Manages structured data collection forms — nursing assessments, intake questionnaires, screening tools, satisfaction surveys, and regulatory forms — with response capture, scoring, and integration into clinical records.

**Key Entities.** Questionnaire, QuestionnaireItem, QuestionnaireResponse, ScoringRule, FormTemplate.

**Extension Points.** `Questionnaire.clinicalDomain` (the clinical context this form belongs to: nursing assessment, pre-anesthesia, pediatric screening — populated by clinical module adapters), `Questionnaire.scoringOutputs[]` (derived scores computed from responses: Morse Fall Scale score, Braden Scale score, PHQ-9 depression score — populated by scoring rule adapters), `FormTemplate.jurisdictionalVariants[]` (locale-specific form versions: PH-specific admission forms per DOH requirements — populated by jurisdiction adapters).

**Key Workflows.**
- Form administration: a questionnaire is presented to a user (or patient via portal) linked to a Patient and optionally an Encounter; responses are captured per item.
- Response validation: item-level validation rules (required, min/max, conditional visibility) are enforced at capture time; the API rejects incomplete responses where required items are unanswered.
- Score computation: on response submission, scoring rules evaluate applicable items and compute one or more output scores (e.g., total Morse Fall Scale score); scores are stored with the QuestionnaireResponse and surfaced as structured Observations in the clinical domain.
- Conditional logic: form items can be conditionally displayed or required based on prior responses (e.g., "If pain score > 3, show pain location and character items"); conditional logic is encoded in item `enableWhen` rules.
- Form versioning: questionnaires are versioned; a QuestionnaireResponse always references the exact questionnaire version it was completed against; retiring a version does not affect existing responses.

**Key Business Rules.**
- QuestionnaireResponse records are immutable once submitted; corrections create an amendment response linked to the original with `reason` and `correctedBy` fields.
- Scoring rules are part of the Questionnaire definition, not the response; updating a scoring rule creates a new Questionnaire version; historical responses are re-scored only on explicit request with audit trail.
- A `required` item in a form may not be left unanswered unless the user explicitly marks it `unable-to-complete` with a reason; the API enforces this constraint.
- Forms that generate clinical scores (fall risk, skin integrity) must emit their scores as `Observation` records linked to the Patient and Encounter so they are visible in clinical views and available for CDS rules.
- UNKNOWN: maximum number of items per questionnaire — conservative default is 200 items; complex forms (e.g., full admission assessment) may require pagination of response capture.

**Key Endpoints.** `listQuestionnaires`, `getQuestionnaire`, `createQuestionnaire`, `publishQuestionnaire`, `startQuestionnaireResponse`, `submitQuestionnaireResponse`, `getQuestionnaireResponse`, `listQuestionnaireResponses`.

**FHIR Mapping.** Questionnaire, QuestionnaireResponse, Observation (for scored outputs).

---

### 7.19 Terminology & Reference Data

**Purpose.** Provides the authoritative code system registry and concept resolution services that power cross-domain semantic interoperability — enabling every domain to use standard codes for diagnoses, procedures, medications, observations, and units.

**Key Entities.** CodeSystem, Concept, ValueSet, ConceptMap, LocalCodeMapping.

**Extension Points.** `CodeSystem.localOverrides[]` (facility-specific aliases and local codes mapped to standard codes: hospital maps internal lab panel codes to LOINC; populated by facility configuration), `ValueSet.jurisdictionalBindings[]` (jurisdiction-specific value set constraints: PH uses ICD-10-CM PH Edition; populated by jurisdiction adapter), `ConceptMap.verticalMappings[]` (cross-vertical concept translations: dental `tooth-surface` codes mapped to SNOMED body site concepts — populated by vertical adapters).

**Key Workflows.**
- Code lookup: given a code and code system, return the concept with display name, hierarchy, synonyms, and any cross-system mappings; used by all clinical domains for display and validation.
- Value set validation: validate that a submitted code (e.g., an ICD-10 code on a diagnosis) is a member of the required value set for that field; return 422 if invalid.
- Cross-system translation: given a concept in one code system (e.g., SNOMED CT), return equivalent concepts in target systems (ICD-10, LOINC, local) via ConceptMap; used for interoperability and claims coding.
- Local code management: facility administrators can add local code mappings (e.g., local drug formulary code → RxNorm); local codes always resolve to a standard concept before use in clinical or claims operations.
- Code system versioning: each CodeSystem record carries a version; code lookups can be pinned to a version for historical accuracy (e.g., the ICD-10 version in effect when a diagnosis was coded).

**Key Business Rules.**
- Code systems (SNOMED, LOINC, RxNorm, ICD-10, CPT, RVS) are loaded from authoritative sources; the API does not accept user-created standard code system entries (local codes go through `LocalCodeMapping`).
- All clinical fields that accept a coded value must validate against a bound ValueSet at write time; the bound ValueSet is declared in the domain spec for each field; the Terminology service is the validation authority.
- ConceptMaps are directional; a map from SNOMED to ICD-10 does not imply a valid reverse map; bidirectional translation requires two ConceptMaps.
- Local code mappings must always resolve to at least one standard concept; a local code with no standard mapping is rejected.
- Code system updates (new SNOMED release, annual ICD-10 update) are handled by a versioned load process; old concepts are marked `inactive` but not deleted; historical records retain their original codes.

**Key Endpoints.** `lookupConcept`, `searchConcepts`, `validateCode`, `expandValueSet`, `translateConcept`, `listCodeSystems`, `getCodeSystem`, `createLocalCodeMapping`, `listLocalCodeMappings`.

**FHIR Mapping.** CodeSystem, ValueSet, ConceptMap, NamingSystem.

**Localization Notes.** See `PH:ICD-10 PH Edition` adapter for Philippine-specific ICD-10 modifications. See `PH:PNDF` adapter for Philippine National Drug Formulary RxNorm mappings.

---

### 7.20 Reporting & Analytics

**Purpose.** Aggregates de-identified and role-filtered operational, clinical, and financial data into standardized reports, dashboards, and raw query interfaces for hospital administrators, clinical leads, and regulatory bodies.

**Key Entities.** Report, ReportDefinition, ReportRun, Dashboard, MetricDefinition.

**Extension Points.** `ReportDefinition.regulatoryFormats[]` (pre-built report formats required by jurisdiction: PH: DOH OHSRS statistical reports, PhilHealth claims summary; US: CMS quality measures — populated by jurisdiction adapter), `Dashboard.verticalMetrics[]` (vertical-specific KPI definitions: hospital adds bed occupancy rate, ALOS, claim denial rate; dental adds chair utilization rate — populated by vertical adapter), `ReportRun.dataFreshnessPolicy` (acceptable data staleness for offline-first deployments — populated by deployment configuration).

**Key Workflows.**
- On-demand report generation: user selects a ReportDefinition, specifies parameters (date range, ward, payor, practitioner), triggers a ReportRun; the run executes asynchronously and delivers a downloadable result.
- Scheduled report generation: ReportDefinitions can be scheduled (daily, weekly, monthly); scheduled runs execute automatically and deliver results to configured recipients.
- Dashboard refresh: dashboard metrics are computed on a configurable schedule or on-demand; individual MetricDefinitions specify their computation query and refresh interval.
- Regulatory report export: pre-defined regulatory report templates generate compliant output in the required format (CSV, Excel, PDF, XML); the export is logged in the Audit domain.
- Ad hoc query: authorized users (typically HIM, admin, IT) can submit SQL-like queries against a curated analytics schema; PHI is masked or excluded by default; queries are logged.

**Key Business Rules.**
- All report outputs that contain patient-level data are access-controlled by the same RBAC/ABAC rules as the source data; a billing clerk cannot access a clinical quality report.
- Aggregate reports (statistical, regulatory) must not expose individual patient records; the API enforces a minimum cohort size of 5 for any cell in aggregate output (small-number suppression).
- ReportRuns are asynchronous; the API returns a `reportRunId` and `status: running`; the client polls or receives a notification when the run completes; synchronous report generation is not supported for reports over 1,000 records.
- Report definitions and queries are version-controlled; a query definition change increments the version; historical runs retain the version that generated them for auditability.
- Data freshness in offline-first deployments must be surfaced in report output; every report must include a `dataAsOf` timestamp reflecting the latest sync time of the source data.

**Key Endpoints.** `listReportDefinitions`, `getReportDefinition`, `runReport`, `getReportRunStatus`, `downloadReportResult`, `listDashboards`, `getDashboard`, `getDashboardMetrics`, `scheduleReport`.

**FHIR Mapping.** MeasureReport (for clinical quality measures), domain-native for operational reports.

---

### 7.21 Patient Portal

**Purpose.** Provides authenticated patients (or their authorized representatives) with secure access to their own health records, appointments, messages, bills, and educational content.

**Key Entities.** PortalAccount, PortalSession, HealthSummary, PatientAccessRequest.

**Extension Points.** `PortalAccount.accessDelegates[]` (authorized representatives who can access a patient's portal: parents for minors, legal guardians, designated caregivers — populated by legal authorization adapter), `HealthSummary.sharedRecordSections[]` (which sections of the health record are visible to the patient: controlled by facility and jurisdiction policy — populated by consent and policy adapters), `PortalAccount.languagePreferences` (display language and health literacy level for content adaptation — populated by localization adapter).

**Key Workflows.**
- Portal account creation: patient registers or is invited by facility; identity verified against MPI Patient record; account linked to Patient ID; email or phone verified.
- Health record view: patient views appointment history, lab results, imaging reports, discharge summaries, medication history, and allergy list — filtered by what the facility has configured as shareable per consent and policy settings.
- Appointment self-scheduling: patient searches available slots and books appointments; subject to the same scheduling rules as staff booking; confirmation sent via preferred notification channel.
- Secure messaging: patient initiates or responds to a care team message thread; PHI-safe messaging only (no SMS/email for PHI content).
- Bill view and payment: patient views outstanding balance and SOA; may make online payment via supported payment methods; receipt generated and linked to account.

**Key Business Rules.**
- Portal accounts are bound to a specific Patient MPI record; a portal account cannot access records of any other Patient.
- Patient-visible record sections are governed by facility consent policy and active Consent records; the portal never displays records outside the scope of the patient's active consents.
- Minor patients (under age of majority per jurisdiction) cannot self-register for a portal account; their portal access is via a delegate account until they reach majority.
- Portal sessions have shorter expiry than staff sessions (default 4 hours, configurable); inactive portal sessions auto-logout after 10 minutes of inactivity.
- Lab results released to the portal are held for a configurable grace period (default 3 days) after being finalized by the lab, giving clinicians time to review and contact the patient before the patient sees alarming results.

**State Machine.** `status` values (PortalAccount): `invited` → `active` → `suspended` → `deactivated`.

**Key Endpoints.** `createPortalAccount`, `getPortalHealthSummary`, `listPortalAppointments`, `bookPortalAppointment`, `listPortalLabResults`, `listPortalDocuments`, `getPortalBillingSummary`, `makePortalPayment`, `listPortalMessages`, `sendPortalMessage`.

**FHIR Mapping.** Patient (referenced), SMART-on-FHIR (launch mechanism for portal apps).

---

### 7.22 Telehealth / Virtual Care

**Purpose.** Enables synchronous (video/audio) and asynchronous (store-and-forward) remote care encounters between practitioners and patients, with clinical documentation integrated into the patient's longitudinal health record.

**Key Entities.** TelehealthSession, VirtualRoom, SessionParticipant, ClinicalCapture.

**Extension Points.** `TelehealthSession.platformIntegration` (the underlying video infrastructure: self-hosted WebRTC, Zoom, Doxy.me, Jitsi — populated by telehealth platform adapter), `TelehealthSession.regulatoryCompliance` (jurisdiction-specific rules for telehealth prescribing, licensure, and documentation: PH: DOH telemedicine guidelines per AO 2020-0002; populated by jurisdiction adapter), `VirtualRoom.hardwareRequirements[]` (peripheral device requirements for specialized virtual visits: digital stethoscope, dermatoscope camera — populated by specialty-specific adapter).

**Key Workflows.**
- Session scheduling: a telehealth encounter is booked via the Appointments domain with `appointmentType: virtual`; a TelehealthSession record is created with a VirtualRoom; join links distributed to participants.
- Session launch: at scheduled time, participants join via their respective clients (staff from EHR, patient from portal or SMS link); session state transitions to `in-progress`.
- In-session clinical documentation: practitioner documents clinical observations, orders, prescriptions, and follow-up instructions directly within the EHR workspace during the session; these records are linked to the session's Encounter.
- Session recording and consent: if recording is enabled, patient consent for recording is captured before session start; recording is stored in DMS with restricted access.
- Store-and-forward: for asynchronous consultations (e.g., teledermatology), patient or referring provider submits images and history; reviewing specialist accesses the submission asynchronously and documents findings.

**Key Business Rules.**
- Every TelehealthSession must be linked to an Encounter; clinical documentation produced during the session is attached to the encounter exactly as in a physical visit.
- Session join links must be scoped and time-limited (default valid 30 minutes before and after scheduled start time); expired links return an informative error.
- Recording storage and access are governed by the same DMS retention and access control rules as all other clinical documents; recordings are never stored in consumer cloud services.
- Prescriptions issued during a telehealth encounter must comply with the same drug safety checks (allergy, drug-drug interaction) as in-person prescriptions; telehealth does not bypass safety checks.
- UNKNOWN: whether asynchronous (store-and-forward) telehealth requires a separate Encounter per submission or can share a parent Encounter with multiple submissions — conservative default is one Encounter per discrete clinical interaction.

**State Machine.** `status` values (TelehealthSession): `scheduled` → `waiting` → `in-progress` → `completed`; `scheduled` → `cancelled`; `in-progress` → `technical-failure` → `completed` (with gap note).

**Key Endpoints.** `listTelehealthSessions`, `getTelehealthSession`, `createTelehealthSession`, `joinTelehealthSession`, `endTelehealthSession`, `getSessionClinicalSummary`, `submitStoreAndForward`, `getStoreAndForwardSubmission`.

**FHIR Mapping.** Encounter (for the clinical visit), Appointment (for scheduling), VirtualServiceDetail (R5 preview, use as extension in R4).

**Localization Notes.** See `PH:Telemedicine` adapter for DOH AO 2020-0002 compliance requirements, telemedicine prescribing limitations, and PhilHealth reimbursement rules for telehealth encounters.


---

## Category 2 — Hospital-Specific Clinical (35 Domains)

These domains contain logic specific to hospital inpatient and acute-care settings. They profile the Core Shared Health domains rather than replacing them. References to Patient, Encounter, Order, etc. refer to the entities defined in Category 1.

---

### Admission, Discharge, Transfer (ADT) & Inpatient Census

**Purpose.** Manages the full inpatient encounter lifecycle from pre-admission through discharge, including bed assignment and real-time census for all admitted patients.
**Key Entities.** Encounter, Admission, Transfer, BedAssignment, CensusSnapshot.
**Key Workflows.**
- Pre-admit to admitted: registration creates encounter, bed assigned, attending physician linked
- Intra-hospital transfer: source bed released to Cleaning, destination bed marked Occupied, nursing assignment updated, all active orders and documentation carry over
- Discharge process: physician signs DSCA → nursing completes checklist → billing clears → bed released
- Census reconciliation at shift change: nursing dashboard syncs patient list, handover accepted per patient
- Transfer-out to another hospital: THOC form generated, encounter closed with transfer disposition
**Key Business Rules.**
- Encounter must transition to `discharged` when patient departs; open encounters block bed release
- Discharge requires attending physician signature on DSCA before status advances to `BillingClearance`
- Financial encounter (charge context) must be created on admission to enable charge capture from that moment
- Applicable jurisdiction anti-detention laws must not allow billing to block discharge; a promissory note or deferred payment option must be available where required by law. See `PH:RA 9439` adapter for Philippine enforcement rules.
- Bed conflict on concurrent offline assignment: first-synced wins; second assignment rejected with alert requiring manual resolution
**State Machine.** `status` values: `pre-admit` → `admitted` → `transferred` → `discharge-ordered` → `clinical-summary-complete` → `nursing-discharge-complete` → `billing-clearance` → `discharged` | `left-against-medical-advice` | `expired`.
**Key Endpoints.** `admitPatient`, `getEncounter`, `listAdmittedPatients`, `transferPatient`, `initiateDischarge`, `finalizeDischarge`, `getCensusSnapshot`.
**FHIR Mapping.** Encounter, EpisodeOfCare, Encounter.location (for transfer history).

---

### Emergency Department (ED) Tracker

**Purpose.** Provides a real-time tracking board for all ED patients, capturing triage acuity scoring, disposition decisions, and regulatory time metrics such as door-to-doctor time.
**Key Entities.** EDVisit, TriageAssessment, EDBoard, DispositionDecision, TransportRecord.
**Key Workflows.**
- Walk-in registration with minimal fields (name, age, sex, chief complaint) → triage nurse assigns acuity category
- Triage assessment: ESI 1–5 or DOH color coding (Red/Yellow/Green/White/Black) recorded with vitals and mechanism
- Bed assignment on ED board → physician assessment → disposition decision
- Disposition paths: admit to inpatient (encounter transitions), discharge with instructions, transfer to another facility, observation hold
- LWBS (Left Without Being Seen) and AMA tracking for regulatory reporting
**Key Business Rules.**
- ESI 1 (Immediate/Red) must have physician contact within 15 minutes; system tracks and alerts if threshold approaches
- ESI 5 / Green (non-urgent) may be routed to fast-track lane; board must reflect lane assignment
- Door-to-doctor time is a mandatory regulatory metric; timer starts on registration timestamp
- Unidentified patient must be registered as Unknown placeholder; encounter links to verified identity once established
- ED encounters converting to inpatient must carry all documentation, orders, and results forward without duplication
**State Machine.** `status` values: `arrived` → `triaged` → `in-treatment` → `disposition-pending` → `admitted` | `discharged` | `transferred` | `observation` | `lwbs` | `expired`.
**Key Endpoints.** `registerEDVisit`, `recordTriage`, `assignEDBed`, `updateDisposition`, `listEDBoard`, `getEDMetrics`, `convertToInpatient`.
**FHIR Mapping.** Encounter (class = EMER), Observation (triage vitals), Condition (presenting complaint).

---

### Operating Room & Perioperative

**Purpose.** Manages the complete surgical episode across pre-op assessment, OR scheduling, intra-op documentation, and PACU recovery through return to floor.
**Key Entities.** SurgicalCase, ORSchedule, PreOpAssessment, IntraOpRecord, PACURecord.
**Key Workflows.**
- Case scheduling: surgeon requests OR time, scheduling assigns room and block, anesthesia team assigned
- Pre-op checklist completion: consent signed, NPO status verified, site marking confirmed, pre-op labs and imaging reviewed
- Patient enters OR: surgical timeout performed and documented before incision
- Intra-op documentation: procedure steps, implant lot numbers, sponge/instrument counts, estimated blood loss
- PACU recovery: Aldrete or modified Aldrete score tracked until discharge criteria met; hand-off to floor nurse
**Key Business Rules.**
- Surgical timeout (WHO Surgical Safety Checklist) must be documented before incision can be marked; system enforces sequencing
- Informed consent must be on file and linked to the surgical case before pre-op clearance is granted
- All implant device lot numbers, manufacturer, and UDI must be recorded in the intra-op record for traceability
- Sponge, needle, and instrument counts must be documented and reconciled at close; discrepancy triggers mandatory re-check before case can be closed
- Case cannot start without pre-op clearance status from anesthesia
**State Machine.** `status` values: `scheduled` → `pre-op-check` → `pre-op-cleared` → `in-or` → `in-pacu` → `completed` | `cancelled` | `postponed`.
**Key Endpoints.** `scheduleCase`, `getSurgicalCase`, `completeSurgicalTimeout`, `recordIntraOp`, `updatePACUScore`, `listORSchedule`, `cancelCase`.
**FHIR Mapping.** Procedure, ServiceRequest, Encounter (class = IMP with surgical context), DeviceUseStatement (implants).

---

### Anesthesia Information Management (AIMS)

**Purpose.** Captures the complete intra-operative anesthesia record including gas agents, drug dosing, and time-stamped vitals streamed or manually entered from monitoring equipment.
**Key Entities.** AnesthesiaRecord, DrugAdministration, GasAgent, IntraOpVitals, AnesthesiaAssessment.
**Key Workflows.**
- Pre-anesthesia assessment: airway classification (Mallampati), ASA physical status, anesthetic risk documented before day of surgery
- Anesthesia induction: agents, doses, route, and times recorded; airway management technique documented
- Intra-op monitoring: continuous vitals (BP, HR, SpO2, EtCO2, temperature) captured at configurable intervals or via automated device interface
- Agent administration: volatile agents (concentration, MAC), IV agents, neuromuscular blockade, reversal agents all logged with timestamps
- Emergence and handoff: extubation criteria met, PACU handoff note generated with anesthesia summary
**Key Business Rules.**
- Record must be co-signed by supervising attending anesthesiologist when a CRNA or resident performed the case; countersign deadline is 24 hours
- Total IV fluid administered and estimated blood loss must reconcile with nursing I&O record for the same case
- High-alert anesthesia drugs (succinylcholine, ketamine, neuromuscular blockers) require dose confirmation before logging
- MAC-equivalent exposure must be calculated and documented for inhalational agents throughout the case
**State Machine.** `status` values: `pre-op-assessment` → `induction` → `maintenance` → `emergence` → `pacu-handoff` → `completed` | `cancelled`.
**Key Endpoints.** `createAnesthesiaRecord`, `logDrugAdministration`, `recordIntraOpVitals`, `logGasAgent`, `signAnesthesiaRecord`, `cosignAnesthesiaRecord`, `getAnesthesiaRecord`.
**FHIR Mapping.** Procedure (type = anesthesia), MedicationAdministration, Observation (intra-op vitals), DeviceMetric (gas agent readings).

---

### Procedural Sedation

**Purpose.** Documents moderate and deep sedation episodes for procedures performed outside the OR (e.g., endoscopy, cardioversion, painful bedside procedures) with focused monitoring and discharge-readiness scoring.
**Key Entities.** SedationRecord, SedationMedication, SedationVitals, ModifiedAldretScore, ProcedureRecord.
**Key Workflows.**
- Pre-sedation assessment: NPO status, ASA class, airway risk, consent, baseline vitals documented before sedation
- Sedation administration: drug, dose, route, and titration steps recorded with timestamps
- Continuous monitoring: vitals at minimum every 5 minutes during procedure, level of consciousness documented
- Recovery: modified Aldrete or PADS score monitored until discharge criteria met
- Adverse event capture: laryngospasm, desaturation, reversal agent use documented in real time
**Key Business Rules.**
- Credentialed provider must be present solely to monitor the patient during moderate or deep sedation; cannot be the proceduralist
- Reversal agents (flumazenil, naloxone) availability must be confirmed and documented before sedation begins
- Patient must meet numeric discharge-readiness score threshold before leaving sedation monitoring area
- Oxygen delivery source and suction must be documented as confirmed available at procedure start
**State Machine.** `status` values: `pre-assessment` → `consent-obtained` → `sedation-active` → `procedure-complete` → `recovery` → `discharged-from-sedation` | `adverse-event`.
**Key Endpoints.** `createSedationRecord`, `logSedationMedication`, `recordSedationVitals`, `scoreRecovery`, `documentAdverseEvent`, `closeSedationRecord`.
**FHIR Mapping.** Procedure, MedicationAdministration, Observation (sedation vitals and consciousness level).

---

### ICU / Critical Care

**Purpose.** Supports high-acuity inpatient care with continuous flowsheet documentation, vasopressor drip management, bundle compliance tracking, and daily goals recording for critically ill patients.
**Key Entities.** ICUFlowsheet, VasopressorDrip, HemodynamicMeasurement, ICUBundle, DailyGoalsRecord.
**Key Workflows.**
- Admission to ICU: encounter care level set to `icu`, continuous monitoring parameters activated, admission APACHE or SOFA score documented
- Vasopressor and sedation drip management: agent, concentration, rate, and titration events logged with timestamps; dose in mcg/kg/min calculated automatically
- Hourly flowsheet entry: vitals, GCS, pupil response, ventilator parameters, I&O, drip rates
- Bundle compliance: daily ABCDEF bundle, VAP prevention checklist, CLABSI prevention checklist completed and tracked as percent-compliance
- Daily goals: multidisciplinary goals (weaning plan, pain target, mobility target) documented each day
**Key Business Rules.**
- ICU nursing-to-patient ratio constraint must be respected at bed assignment; system warns if ICU nurse assignment exceeds configured ratio
- Vasopressor titration events are server-authoritative writes; conflicting offline titration entries require nurse confirmation on sync to prevent inadvertent double-dosing
- Daily goals record must be completed before 10:00 AM on each ICU day; missing entry generates escalation alert to charge nurse
- profiles `Encounter.careLevel = 'icu'` from the ADT domain
**State Machine.** `status` values: `icu-admitted` → `active` → `step-down-ready` → `transferred-to-floor` | `expired`.
**Key Endpoints.** `recordICUFlowsheet`, `updateDripRate`, `listActiveVasopressors`, `submitBundleCompliance`, `recordDailyGoals`, `getICUCensus`, `getSOFAScore`.
**FHIR Mapping.** Observation, MedicationAdministration, DeviceMetric, CarePlan (daily goals).

---

### Ventilator & Respiratory Therapy

**Purpose.** Documents mechanical ventilator settings and measured parameters, weaning assessments, and respiratory therapy interventions for ventilated and non-ventilated patients.
**Key Entities.** VentilatorSetting, VentilatorMeasurement, WeaningAssessment, RespiratoryTherapyOrder, SBTRecord.
**Key Workflows.**
- Ventilator initiation: mode (AC/VC, PC, SIMV, CPAP, PRVC), FiO2, PEEP, tidal volume, rate, I:E ratio set and documented
- Routine ventilator checks: measured parameters (plateau pressure, compliance, peak pressure, exhaled tidal volume, SpO2, EtCO2) recorded at configured intervals
- Spontaneous Breathing Trial (SBT): trial initiated, duration documented, pass/fail criteria recorded
- Weaning progression: daily readiness screen score (RSBI, NIF), plan updated per respiratory therapist assessment
- Extubation: extubation documented with post-extubation respiratory status and oxygen requirement
**Key Business Rules.**
- Plateau pressure must be documented at least every 4 hours for volume-controlled ventilation; alert fires if interval exceeded
- PEEP changes ≥ 5 cmH2O require physician order before being documented as applied
- SBT pass criteria must be configured by institution; default thresholds: RR < 35, SpO2 > 90%, no distress signs for 30 minutes
- VAP bundle compliance (head-of-bed elevation ≥ 30°, oral care, cuff pressure, sedation interruption) must be documented per ICU bundle
**State Machine.** `status` values: `initiated` → `active` → `sbt-in-progress` → `weaning` → `extubated` | `tracheostomy` | `withdrawn`.
**Key Endpoints.** `setVentilatorParameters`, `recordVentilatorMeasurements`, `initiateSBT`, `recordSBTResult`, `documentExtubation`, `getWeaningHistory`, `listVentilatedPatients`.
**FHIR Mapping.** DeviceMetric, Observation, Procedure (SBT, extubation), ServiceRequest (RT orders).

---

### Telemetry / Continuous Monitoring

**Purpose.** Manages assignment of patients to continuous cardiac or physiologic monitoring, alarm configuration, and integration of automated monitor readings into the clinical flowsheet.
**Key Entities.** MonitorAssignment, AlarmConfiguration, TelemetryEvent, StripInterpretation, AlarmLog.
**Key Workflows.**
- Monitor assignment: patient assigned to telemetry unit with configured alarm thresholds for HR, SpO2, RR, BP
- Alarm event: monitor fires alarm → nurse reviews → acknowledges or escalates; all alarm events logged with response time
- Strip capture: rhythm strip or waveform captured by nurse or telemetry tech, appended to encounter record with interpretation
- Alarm threshold adjustment: physician or nurse adjusts alarm limits with clinical justification documented
- Monitor discontinuation: physician order required; telemetry team notified; equipment released
**Key Business Rules.**
- Alarm fatigue mitigation: alarm configuration changes must be documented with clinical rationale; default thresholds cannot be silenced without a recorded override reason
- Unacknowledged critical alarms (e.g., asystole, VF waveform) must escalate to charge nurse within 2 minutes if primary nurse does not respond
- Strip interpretations must be associated with a licensed provider; rhythm description and clinical action documented
- Telemetry bed capacity is a managed resource; assignment requires available monitor unit; system enforces capacity
**State Machine.** `status` values: `ordered` → `monitoring-active` → `alarm-active` → `monitoring-active` | `discontinued`.
**Key Endpoints.** `assignMonitor`, `configureAlarms`, `acknowledgeAlarm`, `captureStrip`, `interpretStrip`, `discontinueMonitoring`, `getAlarmLog`.
**FHIR Mapping.** DeviceMetric, Observation (alarm events and strip interpretation), Device (monitor unit).

---

### Labor & Delivery / Maternity

**Purpose.** Manages the obstetric encounter from antepartum admission through delivery and immediate postpartum, with specialized flowsheets, fetal heart rate monitoring, and birth event documentation.
**Key Entities.** ObstetricAdmission, LaborFlowsheet, FetalHeartRateStrip, DeliveryRecord, NewbornRecord.
**Key Workflows.**
- Antepartum admission: gestational age, gravida/para status, Group B Strep result, prenatal record linked
- Labor progress: cervical exam findings, contraction frequency and duration, fetal station, membrane status documented at intervals
- Fetal heart rate monitoring: EFM strip interpreted (Category I/II/III), accelerations and decelerations documented
- Delivery event: delivery time, presentation, delivery method (SVD/assisted/C-section), APGAR scores at 1 and 5 minutes, cord blood gases if obtained
- Postpartum: fundal height, lochia, vital signs, pain score documented; newborn linked to maternal encounter
**Key Business Rules.**
- APGAR scores at 1 minute and 5 minutes are mandatory fields on every delivery record; system blocks delivery record finalization without both scores
- Birth registration data (Act 3753) must be captured within the delivery record for civil registry reporting: UNKNOWN: confirm required fields per Philippine PSA birth certificate
- Delivery record requires attending obstetrician or midwife signature; verbal delivery orders require co-sign within 6 hours
- Category III EFM pattern must generate immediate physician alert; system does not allow strip to be archived without interpretation
- Newborn record is a child Patient entity linked to the maternal Encounter via RelatedPerson
**State Machine.** `status` values: `antepartum-admission` → `active-labor` → `delivery-imminent` → `delivered` → `postpartum` | `transferred-to-or` (C-section) | `fetal-demise`.
**Key Endpoints.** `createObstetricAdmission`, `recordLaborProgress`, `interpretFHRStrip`, `recordDelivery`, `scoreAPGAR`, `createNewbornRecord`, `listLaborBoard`.
**FHIR Mapping.** Encounter, Observation (FHR, labor vitals, APGAR), Procedure (delivery), Patient (newborn), RelatedPerson (mother-infant link).

---

### NICU

**Purpose.** Supports neonatal intensive care with weight-based medication dosing, incubator temperature management, feeding documentation, and developmental assessment for premature and critically ill newborns.
**Key Entities.** NeonatalAdmission, NICUFlowsheet, FeedingRecord, IncubatorSetting, NeonatalAssessment.
**Key Workflows.**
- NICU admission: gestational age, birth weight, APGAR scores, resuscitation actions at birth, Ballard score documented
- Thermoregulation: incubator temperature settings and actual skin temperature logged at intervals; open warmer radiant heat settings recorded
- Feeding management: enteral feeding initiation (type, volume, frequency), parenteral nutrition orders, feeding tolerance assessment
- Medication administration: all doses weight-based (mg/kg); system auto-calculates dose range from current weight; alerts if entered dose exceeds safe range
- Developmental milestones and discharge readiness: feeding independently, maintaining temperature, weight gain trajectory documented
**Key Business Rules.**
- All NICU medication dose calculations must display the weight-based range check at order entry and again at administration; nurse must confirm weight used for calculation is current (within 24 hours)
- Incubator humidity and temperature settings are physician orders; nursing cannot adjust outside ordered range without new order
- Kangaroo care events (skin-to-skin) must be documented with duration and infant response for developmental care records
- Discharge criteria checklist must be completed with all items checked before NICU discharge order can be finalized
**State Machine.** `status` values: `nicu-admitted` → `active` → `step-down-ready` → `rooming-in` → `discharged` | `transferred` | `expired`.
**Key Endpoints.** `createNICUAdmission`, `recordNICUFlowsheet`, `logFeedingEvent`, `setIncubatorParameters`, `calculateWeightBasedDose`, `documentKangarooCare`, `getNICUCensus`.
**FHIR Mapping.** Encounter, Observation (neonatal vitals, feeding), NutritionOrder, MedicationAdministration, Patient (neonate).

---

### Oncology / Chemotherapy

**Purpose.** Manages chemotherapy protocol ordering, pre-medication regimens, infusion sequencing, cumulative dose tracking, and toxicity assessment for patients receiving cancer treatment.
**Key Entities.** ChemoProtocol, ChemoCycle, RegimenOrder, CumulativeDoseRecord, ToxicityAssessment.
**Key Workflows.**
- Protocol selection: physician selects named regimen (e.g., FOLFOX, AC-T, BEP); system loads default agents, doses, schedule, and pre-medications
- Cycle ordering: day-of-cycle labs reviewed, BSA and weight verified, doses calculated; pharmacist prepares IV compounding
- Pre-medication administration: antiemetics, steroids, hydration administered per protocol sequence before chemotherapy
- Chemotherapy infusion: agents administered in specified sequence with flush between agents; infusion start/stop times logged
- Toxicity and response: CTCAE grading of adverse effects documented each cycle; treatment response assessments linked to imaging
**Key Business Rules.**
- Chemotherapy orders require independent double-check by a second pharmacist or oncology-trained nurse before preparation begins
- Cumulative lifetime dose must be tracked for agents with cumulative toxicity limits (e.g., doxorubicin ≤ 450 mg/m² lifetime); system alerts when approaching limit
- BSA-based dose must be recalculated at each cycle if weight change exceeds 5% since last calculation
- Protocol deviations (dose reductions, delays) must be documented with CTCAE grade and clinical rationale; system must record deviation against the planned protocol
**State Machine.** `status` values: `protocol-ordered` → `labs-reviewed` → `dose-verified` → `compounding` → `infusing` → `completed` | `held` | `discontinued`.
**Key Endpoints.** `selectChemoProtocol`, `createChemoCycle`, `verifyBSADose`, `recordCumulativeDose`, `documentToxicity`, `logInfusionEvent`, `getChemoCycleHistory`.
**FHIR Mapping.** MedicationRequest, MedicationAdministration, CarePlan (protocol), Observation (toxicity assessment), Procedure (cycle administration).

---

### Dialysis

**Purpose.** Documents hemodialysis and peritoneal dialysis treatment parameters, access management, and fluid balance outcomes for patients with renal failure.
**Key Entities.** DialysisOrder, DialysisTreatment, VascularAccessRecord, DialysisFlowsheet, KtVRecord.
**Key Workflows.**
- Dialysis order: modality (HD/PD/CRRT), frequency, duration, target ultrafiltration volume, dialysate composition, anticoagulation ordered by nephrologist
- Pre-treatment assessment: pre-dialysis weight, BP, access site inspection, patient symptoms documented
- Treatment monitoring: blood flow rate, dialysate flow, transmembrane pressure, ultrafiltration rate, access pressures logged at intervals
- Post-treatment: post-dialysis weight, BP, access site condition, any intradialytic complications documented
- Kt/V adequacy: urea reduction ratio or Kt/V calculated from pre/post BUN; documented and trended
**Key Business Rules.**
- Vascular access (AV fistula, graft, tunneled catheter) must have a valid access record; no treatment can be documented without an active access entry
- Intradialytic hypotension (SBP drop ≥ 20 mmHg or SBP < 90) must trigger an immediate alert and require nursing intervention documentation
- Anticoagulation administered during dialysis must be recorded in the main eMAR as well as the dialysis flowsheet
- Target Kt/V ≥ 1.2 per treatment; treatments falling below threshold must generate a notification to the ordering nephrologist
**State Machine.** `status` values: `ordered` → `pre-assessment` → `treatment-active` → `treatment-complete` → `post-assessment-done` | `aborted`.
**Key Endpoints.** `createDialysisOrder`, `startTreatment`, `recordDialysisFlowsheet`, `documentIntradialyticEvent`, `calculateKtV`, `endTreatment`, `getDialysisHistory`.
**FHIR Mapping.** ServiceRequest, Procedure, Observation (dialysis parameters and Kt/V), Device (dialysis machine access).

---

### Behavioral Health / Psychiatry

**Purpose.** Supports inpatient psychiatric admission workflows including safety risk assessment, restraint documentation, psychiatric progress notes, and legally mandated involuntary hold tracking.
**Key Entities.** PsychiatricAdmission, RiskAssessment, RestraintOrder, PsychiatricNote, InvoluntaryHoldRecord.
**Key Workflows.**
- Psychiatric admission: legal status (voluntary/involuntary), danger-to-self/others assessment, suicide risk stratification (Columbia Protocol), admission milieu orientation
- Safety assessment: Columbia Suicide Severity Rating Scale or equivalent performed on admission and at defined intervals; risk level documented
- Restraint episode: physician order required before restraint; type, reason, application time, continuous monitoring intervals, and release time all documented
- Psychiatric progress note: mental status exam (appearance, behavior, speech, mood, affect, thought process, cognition, insight, judgment), medication response, treatment plan update
- Discharge planning: safety plan, outpatient follow-up, medication reconciliation, community support resources documented
**Key Business Rules.**
- Restraint orders expire after 4 hours for adults (24 hours for non-violent medical restraints); must be renewed with re-assessment; system enforces expiry and alerts before order lapses
- Suicide risk assessment must be re-documented every shift for patients on 1:1 observation status; missing assessment generates charge nurse alert
- Involuntary hold documentation must include legal authority citation, time initiated, patient rights provided, and required notifications made
- Confidentiality exceptions (duty to warn, mandatory reporting) must be documented with justification and actions taken
**State Machine.** `status` values: `psychiatric-hold` → `voluntary-admitted` | `involuntary-admitted` → `active-treatment` → `discharge-planning` → `discharged` | `transferred` | `ama`.
**Key Endpoints.** `createPsychAdmission`, `recordRiskAssessment`, `orderRestraint`, `documentRestraintMonitoring`, `writePsychNote`, `createSafetyPlan`, `releasePsychHold`.
**FHIR Mapping.** Encounter, RiskAssessment, Procedure (restraint), DocumentReference (psychiatric note), Condition (psychiatric diagnoses).

---

### Rehabilitation (PT/OT/ST)

**Purpose.** Manages rehabilitation therapy orders and treatment sessions for physical therapy, occupational therapy, and speech-language pathology, with functional outcome measurement and goal tracking.
**Key Entities.** TherapyOrder, TherapySession, FunctionalAssessment, TherapyGoal, DischargeRecommendation.
**Key Workflows.**
- Therapy referral: physician orders PT, OT, or ST evaluation; clinical question and diagnosis documented
- Initial evaluation: therapist performs discipline-specific functional assessment (FIM, Barthel for PT/OT; NIHSS dysphagia screen for ST), goals set
- Treatment session: interventions performed (exercises, ADL training, swallowing therapy, gait training), patient response and progress documented
- Goal reassessment: functional status compared to baseline at defined intervals; goals updated or discharged from therapy
- Discharge recommendation: therapist documents recommended level of care for post-discharge (home, home health, skilled nursing, inpatient rehab)
**Key Business Rules.**
- Initial evaluation must be completed within 24 hours of referral for STAT orders and within 48 hours for routine orders; system tracks and alerts on overdue evaluations
- Therapy sessions require therapist signature before billing charge can be posted; unsigned sessions are held in pending charge state
- Functional assessment tool must match the domain (PT/OT: FIM or Barthel; ST: standardized dysphagia screening tool) per hospital configuration
- Physician co-signature required within 24 hours for therapy plans created by PTAs or OTAs (assistants rather than licensed therapists)
**State Machine.** `status` values: `ordered` → `evaluation-scheduled` → `evaluation-complete` → `active-treatment` → `goal-met` | `discontinued` | `transferred-to-outpatient`.
**Key Endpoints.** `createTherapyOrder`, `recordFunctionalAssessment`, `logTherapySession`, `updateTherapyGoals`, `generateDischargeRecommendation`, `listActiveTherapyPatients`.
**FHIR Mapping.** ServiceRequest, Procedure (therapy session), Observation (functional assessment scores), CarePlan (therapy goals).

---

### Wound Care

**Purpose.** Documents wound assessment, staging, treatment plan, and healing trajectory for acute and chronic wounds, with photographic evidence support and pressure injury prevention bundle compliance.
**Key Entities.** WoundAssessment, WoundTreatmentPlan, WoundCareOrder, WoundProgressNote, PressureInjuryBundle.
**Key Workflows.**
- Initial wound assessment: location (anatomical diagram reference), type (pressure injury, surgical, traumatic, diabetic), dimensions (length × width × depth), staging (NPUAP Stage I–IV/Unstageable/DTI), wound bed description, periwound condition documented
- Treatment plan: dressing type, frequency, cleansing agent, debridement method ordered by wound care specialist or physician
- Treatment session: pre- and post-dressing change wound status documented; tunneling and undermining measured; odor and exudate documented
- Photographic documentation: wound photo linked to assessment record with date/time stamp; comparison across serial assessments supports healing trajectory review
- Pressure injury prevention: Braden score from nursing assessment linked; bundle elements (turning schedule, moisture barrier, support surface) documented and tracked
**Key Business Rules.**
- New-onset pressure injury must be documented as a potential hospital-acquired condition; date of first identification and Braden score at admission are required for HAC classification determination
- Wound dimensions must be measured in centimeters using standardized orientation (head = 12 o'clock); deviations from standard require documentation
- Stage III, IV, or Unstageable pressure injuries require notification to charge nurse and attending physician within 2 hours of identification
- Wound care orders cannot be modified by nursing without a new physician order; nursing documents care given per order only
**State Machine.** `status` values: `identified` → `assessment-complete` → `treatment-active` → `improving` → `healed` | `referred-to-specialist` | `worsening`.
**Key Endpoints.** `createWoundAssessment`, `updateWoundDimensions`, `recordWoundTreatment`, `attachWoundPhoto`, `trackBradenScore`, `getPressureInjuryBundle`, `listActiveWounds`.
**FHIR Mapping.** Observation (wound measurements and staging), Procedure (dressing change), Condition (wound diagnosis), Media (wound photograph).

---

### IV Therapy / Infusions

**Purpose.** Manages peripheral and central venous access devices, IV fluid orders, infusion rates, and access site assessment to ensure vascular access safety and accurate fluid balance.
**Key Entities.** VascularAccess, IVFluidOrder, InfusionRecord, AccessSiteAssessment, InfusionPumpSetting.
**Key Workflows.**
- Access insertion: IV site location (vein, gauge, type), insertion date/time, number of attempts, and inserting clinician documented
- IV fluid order: fluid type, volume, rate (mL/hr or mL over time), and additives ordered; pharmacist verifies admixtures
- Infusion administration: start time, pump setting (rate, volume-to-be-infused, VTBI), nurse verifying correct fluid and patient documented
- Access site assessment: insertion site inspected each shift for signs of phlebitis, infiltration, or infection; INS phlebitis scale score documented
- Access change and discontinuation: reason for change documented; discontinued access duration calculated for HAI tracking
**Key Business Rules.**
- Peripheral IV access must be assessed at minimum every shift; site older than 72–96 hours (per hospital policy) must generate a change reminder alert
- IV fluid additives (electrolytes, heparin) are high-alert and require pharmacist verification before infusion; STAT orders proceed with pharmacist-review-pending flag
- Infusion pump rate changes require nurse documentation; automated pump data imports (if device integrated) are supplemented not replaced by nurse documentation
- Central line access sites (PICC, CVC, port) require CLABSI prevention bundle documentation (dressing integrity, hub decontamination, line necessity review) per ICU bundle if patient is in ICU
**State Machine.** `status` values: `ordered` → `site-established` → `infusing` → `completed` | `discontinued` | `site-failed`.
**Key Endpoints.** `documentAccessInsertion`, `createIVFluidOrder`, `startInfusion`, `updateInfusionRate`, `recordSiteAssessment`, `discontinueAccess`, `listActiveInfusions`.
**FHIR Mapping.** Device (vascular access), MedicationAdministration (IV medication), Observation (site assessment), ServiceRequest (IV fluid order).

---

### Pharmacy (Inpatient + Outpatient)

**Purpose.** Covers formulary-based medication order verification, inpatient dispensing, IV compounding, controlled substance chain-of-custody, and outpatient prescription dispensing with inventory management.
**Key Entities.** PharmacyOrder, DispensedItem, FormularyEntry, PharmacyInventory, ControlledSubstanceLog, IVPreparation.
**Key Workflows.**
- Order verification: pharmacist reviews drug name, dose, route, frequency against patient allergy list, active medications, and current diagnoses; approve, query, or reject
- Dispensing: pharmacist picks from stock, verifies lot and expiry, deducts inventory, delivers to ward; nurse receives acknowledgment
- IV compounding: admixture prepared in clean or sterile environment; compounder, expiry time, storage conditions, and BUD (beyond-use date) documented
- Controlled substance handling: each unit tracked from receipt through dispensing to administration waste; witness signature required for waste; destruction documented
- Return-to-stock: unused medications returned from ward assessed for condition; usable stock returned with billing credit; non-usable waste documented
**Key Business Rules.**
- Pharmacist must verify all non-STAT orders before MAR entry is created; STAT orders proceed with pharmacist-review-pending flag and must be reviewed within 30 minutes
- Controlled substances require dual-sign dispensing: pharmacist plus witness; waste requires separate dual-sign documentation
- IV compounded products must have beyond-use date and storage temperature documented; products past BUD must not be dispensed
- Non-formulary prescribing is permitted with clinical justification override; override reason is mandatory and is flagged for formulary committee review
**State Machine.** `status` values: `received` → `verification-pending` → `verified` → `compounding` | `ready-to-dispense` → `dispensed` | `returned`.
**Key Endpoints.** `verifyPharmacyOrder`, `dispenseItem`, `createIVPreparation`, `logControlledSubstance`, `processReturn`, `checkFormulary`, `getInventoryLevel`.
**FHIR Mapping.** MedicationRequest, MedicationDispense, Medication, SupplyDelivery (inventory receipt).

---

### Medication Administration Record (eMAR)

**Purpose.** Provides the bedside point-of-care medication administration record with barcode-assisted five-rights verification, administration event logging, and missed/held dose documentation.
**Key Entities.** MAREntry, AdministrationRecord, PRNReason, WastedDose, BarcodeVerificationLog.
**Key Workflows.**
- MAR generation: once pharmacist verifies a medication order, scheduled administration times are calculated and MAREntry records created for each due time
- Five-rights verification: nurse opens due medication, confirms right patient (name/MRN/barcode), right drug, right dose, right route, right time; each right documented
- Administration confirmation: actual dose given, route, time, and nurse ID logged; MAR status updates to Given
- Non-administration documentation: nurse documents Missed, Held, Refused, or Unavailable with mandatory reason and notifies ordering provider as clinically indicated
- PRN administration: nurse selects PRN medication, documents indication (e.g., pain score, symptom), verifies five rights, administers; effectiveness re-assessment documented at configured interval
**Key Business Rules.**
- Barcode patient identification scan is required before administration confirmation; systems without barcode capability must require manual patient name/MRN confirmation with a documented reason for missing scan
- Administration window enforcement: medications documented more than the configured early/late window (typically ±30 minutes for routine, ±60 minutes for daily) are flagged for late/early documentation
- Wasted controlled substance must be co-signed by a witness before the waste record can be saved; unsigned waste records are flagged as incomplete and escalate after 15 minutes
- Allergy cross-reference check fires at administration confirmation as a final safety layer independent of order-entry checks
**State Machine.** `status` values: `scheduled` → `due` → `given` | `held` | `missed` | `refused` | `unavailable` | `not-due-yet`.
**Key Endpoints.** `getMAR`, `confirmAdministration`, `documentNonAdministration`, `recordWaste`, `logPRNIndication`, `recordBarcodeVerification`, `getMARSummary`.
**FHIR Mapping.** MedicationAdministration, MedicationRequest (source order reference).

---

### Medication Reconciliation

**Purpose.** Compares and reconciles a patient's medications across all care transitions — admission, transfer, and discharge — to identify omissions, duplications, and discrepancies that could cause harm.
**Key Entities.** MedRecRecord, Homemedication, ReconciliationDiscrepancy, ReconciliationDecision, ReconciliationSignature.
**Key Workflows.**
- Admission reconciliation: best possible medication history (BPMH) obtained from patient, caregiver, pharmacy dispensing records, and prior medical records; each home medication documented with dose, frequency, last taken date
- Discrepancy identification: BPMH compared to admission orders; discrepancies (omitted, changed dose, added without indication) flagged for physician review
- Physician decision: for each discrepancy physician documents Intentional Change, Continue, Discontinue, or Hold; decision signed
- Transfer reconciliation: sending unit medication list reconciled against receiving unit orders; unresolved items flagged
- Discharge reconciliation: discharge medication list compared to home medications and inpatient changes; patient education documented; follow-up prescriptions generated
**Key Business Rules.**
- Admission medication reconciliation must be completed within 24 hours of admission; overdue reconciliation generates escalation to the admitting physician
- High-risk medications (anticoagulants, insulin, opioids, narrow therapeutic index drugs) must be individually flagged and require explicit physician decision on each reconciliation
- Discharge medication list provided to patient must match the reconciled discharge order set; any discrepancy between the two must be resolved before the discharge summary is finalized
- Reconciliation cannot be marked complete unless all identified discrepancies have a physician decision documented
**State Machine.** `status` values: `initiated` → `history-obtained` → `discrepancies-identified` → `decisions-documented` → `completed` | `voided`.
**Key Endpoints.** `createMedRecRecord`, `addHomeMedication`, `flagDiscrepancy`, `recordPhysicianDecision`, `completeMedRec`, `getDischargeMedList`, `getMedRecHistory`.
**FHIR Mapping.** MedicationStatement (home medications), MedicationRequest, List (reconciled medication list), Provenance (reconciliation signature).

---

### Allergy & Adverse Reaction Management

**Purpose.** Maintains a patient's complete allergy and adverse drug reaction profile, supports clinical decision support cross-referencing at order entry and medication administration, and tracks reaction severity with deduplication.
**Key Entities.** AllergyRecord, AllergyVerification, ADREvent, CrossReactivityGroup, AllergyOverride.
**Key Workflows.**
- Allergy capture: allergen name, allergen type (drug/food/environmental/latex), reaction description, severity (Mild/Moderate/Severe/Life-threatening/Anaphylaxis), and source (patient report, medical record, prior reaction) recorded
- Verification: clinician documents whether allergy is confirmed (prior documented reaction), probable (consistent history), or patient-reported (unverified)
- CDS integration: allergy list cross-referenced against all medication orders at entry and again at administration; drug class cross-reactivity rules applied (e.g., penicillin → cephalosporin cross-reactivity)
- Override documentation: when clinician proceeds despite an allergy alert, override reason and clinical justification are mandatory and stored with the order
- ADR event: new adverse reaction observed during hospitalization documented as a new allergy record with encounter context; pharmacovigilance reporting triggered
**Key Business Rules.**
- Allergy records are additive and never hard-deleted; a resolved allergy is marked Inactive with resolution date, not removed
- Anaphylaxis-history allergies are designated as critical and are included in a priority sync queue; these records must be available even on severely degraded connectivity
- All allergy list changes (add, modify status) must be confirmed with the patient or authorized representative at admission and documented as verified or unable-to-verify
- Override of a Life-threatening or Anaphylaxis allergy requires attending physician-level role; nurse-level override is blocked for these severity tiers
**State Machine.** `status` values: `active` → `resolved` | `inactive` | `entered-in-error`.
**Key Endpoints.** `addAllergy`, `updateAllergyStatus`, `verifyAllergy`, `listActiveAllergies`, `recordADREvent`, `documentAllergyOverride`, `checkAllergyConflict`.
**FHIR Mapping.** AllergyIntolerance, AdverseEvent.

---

### Computerized Provider Order Entry (CPOE)

**Purpose.** Provides a single electronic order entry point for all order types — medications, laboratory, imaging, procedures, diet, activity, nursing tasks, and consults — with integrated clinical decision support at point of entry.
**Key Entities.** Order, OrderItem, OrderSet, ClinicalDecisionSupportAlert, VerbatimOrder.
**Key Workflows.**
- Individual order entry: physician selects order type, enters type-specific fields, system fires CDS checks, physician signs; order routes to target module
- Order set application: physician selects named order set (admission, disease-specific, post-op), customizes individual orders, signs batch with single signature
- Verbal/telephone order entry: nurse documents verbal order with `cosign_required` flag; physician co-signs within 24 hours
- Order modification: because orders are immutable once signed, modification requires void of original and creation of new order; void reason is mandatory
- Order acknowledgment: nurse acknowledges each order; STAT orders require acknowledgment within 15 minutes; unacknowledged STAT orders generate escalating alerts
**Key Business Rules.**
- Order signing is server-authoritative; a draft order cannot be signed while the device is offline — it is saved as Draft and signed on reconnect to prevent conflicting duplicate orders
- Drug-allergy conflict: hard-stop alert for Life-threatening/Anaphylaxis allergies requires attending-level override with mandatory reason; softer warnings for moderate allergies allow proceed-with-acknowledge
- Duplicate order check fires for same drug, same lab test, or same imaging study already active or resulted in the same encounter
- Verbal orders must be co-signed within 24 hours; system generates escalating alerts at 20 hours and auto-escalates to supervisor at 24 hours if unsigned
**State Machine.** `status` values: `draft` → `signed` → `acknowledged` → `in-progress` → `completed` | `voided` | `expired`.
**Key Endpoints.** `createOrder`, `signOrder`, `acknowledgeOrder`, `voidOrder`, `applyOrderSet`, `createVerbatimOrder`, `listActiveOrders`.
**FHIR Mapping.** ServiceRequest, MedicationRequest, NutritionOrder, Task (nursing orders).

---

### Order Sets & Care Pathways

**Purpose.** Provides configurable templates of bundled orders aligned to evidence-based protocols and institutional care pathways to reduce prescribing variation and accelerate order entry for common clinical scenarios.
**Key Entities.** OrderSetTemplate, CarePathway, PathwayStep, OrderSetItem, PathwayVarianceRecord.
**Key Workflows.**
- Order set authoring: pharmacy, medical, and nursing leads create named order sets with default orders, doses, and instructions; sets are versioned and require administrative approval before activation
- Order set application: physician selects set from CPOE, reviews each item (can delete or modify), signs batch; all items carry the physician's signature
- Care pathway enrollment: patient enrolled in a structured pathway (e.g., community-acquired pneumonia, hip replacement); pathway steps drive order sets, assessments, and documentation tasks at defined milestones
- Variance tracking: when a pathway step is not completed or a deviation occurs, variance is documented with reason; variances feed quality reporting
- Order set maintenance: sets reviewed periodically against current evidence; changes are versioned; in-progress orders from old version are not retroactively changed
**Key Business Rules.**
- Order set modifications at time of application are patient-specific; changes do not alter the template for future use
- Care pathway enrollment requires a matching principal diagnosis; system validates that the active diagnosis supports the selected pathway
- Pathway steps that involve medication orders must route through normal pharmacy verification workflow; pathways do not bypass safety checks
- Order set version history must be maintained; the version applied to any given encounter must be retrievable for audit
**State Machine.** `status` values (pathway enrollment): `enrolled` → `active` → `completed` | `discontinued` | `variance-flagged`.
**Key Endpoints.** `listOrderSets`, `applyOrderSet`, `enrollInPathway`, `advancePathwayStep`, `recordPathwayVariance`, `getOrderSetVersion`, `createOrderSet`.
**FHIR Mapping.** PlanDefinition (order set and pathway templates), RequestGroup (applied order set instance), CarePlan (pathway enrollment).

---

### Clinical Decision Support (CDS)

**Purpose.** Provides a rules engine delivering real-time alerts, recommendations, and reminders at clinically relevant workflow intercept points, covering drug safety, diagnostic scoring, sepsis detection, and risk stratification.
**Key Entities.** CDSRule, CDSAlert, CDSRecommendation, OverrideRecord, CDSAuditEvent.
**Key Workflows.**
- Rule evaluation: CDS hooks fire at order entry, medication administration, vital sign documentation, and lab result posting; rule engine evaluates configured rules against current patient data
- Alert presentation: alert displayed with severity (Hard Stop / Soft Warning / Passive Reminder), evidence level, and suggested action; clinician must acknowledge or override
- Override documentation: when clinician dismisses a hard stop or soft warning, override reason is mandatory and stored with the triggering event
- Sepsis screening: SIRS and qSOFA scores calculated automatically from vitals and labs; positive screens generate high-priority alerts with Surviving Sepsis Bundle checklist
- Early warning scoring: NEWS2 or equivalent calculated from each vital signs set; threshold breach generates alert to nurse and escalates to physician at configurable score
**Key Business Rules.**
- Hard-stop alerts may not be bypassed without an attending-level role; alerts for drug-allergy anaphylaxis and duplicate high-alert medications are mandatory hard stops
- Alert fatigue mitigation: override rates per rule are monitored; rules with override rates > 80% are flagged for clinical informatics review and reconfiguration
- Passive reminders (e.g., VTE prophylaxis due) must not interrupt workflow with modal dialogs; they appear as non-blocking notifications
- CDS hooks specification followed for interoperability; rule configuration is branch-level so thresholds can be adjusted by institution without code change
**State Machine.** Omit — CDS is event-driven, not a lifecycle domain.
**Key Endpoints.** `evaluateRules`, `acknowledgeAlert`, `documentOverride`, `getAlertHistory`, `listActiveRules`, `getSepsisScore`, `getEarlyWarningScore`.
**FHIR Mapping.** domain-native (CDS Hooks specification); GuidanceResponse (CDS response), DetectedIssue (drug interaction alert).

---

### Vitals & Flowsheets

**Purpose.** Provides time-series capture and display of vital signs and unit-specific flowsheet data, with configurable normal ranges, automated threshold alerting, and support for device-interface automated entry.
**Key Entities.** VitalsSet, FlowsheetRow, FlowsheetTemplate, ThresholdConfiguration, DeviceCaptureRecord.
**Key Workflows.**
- Manual vital signs entry: nurse records BP, HR, temperature, RR, SpO2, pain score, GCS, and weight via quick-entry form; system applies threshold checks on save
- Automated device capture: bedside monitor, ventilator, or infusion pump pushes readings via device interface; data written to flowsheet with device-source tag for traceability
- Flowsheet template selection: unit-specific templates activated per encounter care setting (ED triage flowsheet, ICU hourly flowsheet, L&D labor flowsheet, general ward shift flowsheet)
- Trend visualization: vital sign trend displayed as sparkline on the patient workspace card and as full trend chart with delta arrows on expansion
- Retroactive documentation: nurse may document vitals taken earlier with a retroactive timestamp; retroactive entries are flagged for audit
**Key Business Rules.**
- Values outside configured normal range generate automated H/L flags and orange highlighting; values at or beyond critical threshold generate red flags and a Critical Alert record that must be acknowledged
- Confirmation dialog required before saving values that exceed critical thresholds to prevent fat-finger errors from generating false critical alerts
- Automated device-sourced values are differentiated from manually entered values in the audit trail; clinician may annotate but not modify automated readings
- Vital signs are CRDT-safe (LWW-Register per entry); offline entry is fully supported and carries no sync dependency
**State Machine.** Omit — each VitalsSet entry is a discrete immutable record; no lifecycle progression.
**Key Endpoints.** `recordVitals`, `getLatestVitals`, `getVitalsTrend`, `configureThresholds`, `getFlowsheetByTemplate`, `recordFlowsheetRow`, `listCriticalAlerts`.
**FHIR Mapping.** Observation (vital signs, flowsheet rows), ObservationDefinition (threshold configuration).

---

### Nursing Assessments & Care Plans

**Purpose.** Captures structured nursing assessments (head-to-toe, fall risk, skin integrity, pain, admission) and links them to a living care plan with nursing diagnoses, goals, and interventions updated each shift.
**Key Entities.** NursingAssessment, FallRiskScore, BradenScore, NursingDiagnosis, CarePlanGoal, NursingIntervention.
**Key Workflows.**
- Admission assessment: comprehensive head-to-toe assessment, pain assessment, fall risk (Morse Fall Scale), skin integrity (Braden Scale), psychosocial screen, and activity/diet/IV access status documented on admission
- Shift assessment: focused reassessment at each shift; body systems review, pain, and risk scores updated; comparison to prior shift surfaced for trending
- Care plan creation: nursing diagnoses linked to assessment findings; goals set with measurable criteria and target dates; nursing interventions ordered per diagnosis
- Care plan update: goals reassessed each shift; met goals marked resolved; new diagnoses added as clinical picture evolves
- Risk escalation: fall risk score ≥ configured threshold activates fall prevention protocol; Braden score ≤ threshold activates pressure injury prevention bundle; both automatically create care plan interventions
**Key Business Rules.**
- Fall risk assessment must be completed within 2 hours of admission and at each subsequent shift; overdue assessment generates nursing charge alert
- Braden score ≤ 18 (or institution-configured threshold) must auto-generate a pressure injury prevention intervention in the care plan without nurse having to manually add it
- Care plan goals must be measurable; free-text goals without target criteria are flagged with a reminder to add measurable outcome
- Safety flags derived from assessments (fall risk, pressure injury risk, aspiration risk) must propagate to the patient workspace topbar (Plane A) within the same session
**State Machine.** `status` values (assessment): `in-progress` → `completed` | `unable-to-assess`. `status` values (care plan goal): `active` → `met` | `not-met` | `revised` | `discontinued`.
**Key Endpoints.** `createNursingAssessment`, `updateCarePlanGoal`, `addNursingIntervention`, `getFallRiskScore`, `getBradenScore`, `listActiveDiagnoses`, `getCarePlan`.
**FHIR Mapping.** Observation (assessment scores), Condition (nursing diagnoses), CarePlan, Goal, Task (nursing interventions).

---

### Clinical Documentation & CDI (Clinical Documentation Integrity)

**Purpose.** Supports complete and accurate clinical documentation by providing query workflows between CDI specialists and physicians to clarify diagnoses, specificity, and procedure documentation that affects coding accuracy and reimbursement.
**Key Entities.** CDIQuery, CDIQueryResponse, DocumentationOpportunity, CodeAssignment, EncounterCodingRecord.
**Key Workflows.**
- Documentation opportunity identification: CDI specialist reviews clinical documentation against current diagnoses; flags cases where documentation lacks specificity (e.g., "anemia" without type; "respiratory failure" without acute/chronic distinction)
- CDI query creation: CDI specialist creates a structured query to the attending physician with the documentation issue, clinical evidence, and query options (multiple-choice or open-ended)
- Physician response: physician reviews query, selects or writes a response, and updates clinical documentation or confirms existing documentation is accurate
- Code assignment: after documentation reconciliation, coder assigns ICD-10 and procedure codes to the encounter for billing and eClaims
- Concurrent vs retrospective CDI: queries may be initiated during the inpatient stay (concurrent) or after discharge (retrospective); concurrent queries appear in the physician's task queue
**Key Business Rules.**
- CDI queries must not suggest a specific diagnosis or lead the physician; query options must be clinically neutral and evidence-based
- Physician responses to CDI queries are treated as clinical documentation addenda and are immutable once submitted; no editing of responses
- Query response deadline is 48 hours for concurrent queries; overdue queries escalate to department chief and trigger billing hold alert
- ICD-10 code assignments made after physician response must be linked to the specific query and response for audit trail; coding without supporting documentation is blocked
**State Machine.** `status` values: `opportunity-identified` → `query-sent` → `query-responded` → `documentation-updated` → `coded` | `query-withdrawn`.
**Key Endpoints.** `createCDIQuery`, `respondToCDIQuery`, `linkDocumentationOpportunity`, `assignEncounterCode`, `listPendingQueries`, `getCodingRecord`, `getQueryHistory`.
**FHIR Mapping.** Communication (CDI query and response), Claim (code assignment), DocumentReference (addendum).

---

### Laboratory Information System (LIS)

**Purpose.** Manages the end-to-end laboratory workflow from order receipt and specimen accession through instrument result processing, critical value alerting, and result release to the clinical record.
**Key Entities.** LabOrder, LabSpecimen, AccessionRecord, InstrumentResult, VerifiedResult.
**Key Workflows.**
- Order receipt and accession: lab order arrives from CPOE; nurse collects and labels specimen with barcode; lab tech receives, scans barcode, matches to order, and accessions
- Specimen processing: specimen assigned to analyzer or manual workflow; processing status updated; STAT orders prioritized in queue
- Result entry and validation: results entered manually or via analyzer interface; reference range flags (H/L/Critical) auto-calculated; tech validates before release
- Critical value alerting: critical result detected at validation; mandatory read-back to ordering provider documented with notification time and recipient name
- Result release: validated results released; immediately visible in patient's Laboratory Card; ordering provider notified
**Key Business Rules.**
- Results must be validated by a licensed medical technologist before release; auto-release of results without tech validation is not permitted
- Critical values must be communicated to the ordering provider or covering clinician within 15 minutes of validation; read-back documentation is mandatory; failure to document read-back within 30 minutes generates supervisory escalation
- Specimen labeling must exactly match the accession record; any discrepancy between label and order requires rejection and recollection
- Amended results (correction after release) must preserve the original result; amendment reason, amending tech, and timestamp are required
**State Machine.** `status` values: `ordered` → `pending-collection` → `collected` → `accessioned` → `processing` → `resulted` → `verified` → `released` | `rejected`.
**Key Endpoints.** `accessionSpecimen`, `rejectSpecimen`, `enterResults`, `validateResults`, `releaseResults`, `documentCriticalValueNotification`, `getLabResultsForEncounter`.
**FHIR Mapping.** ServiceRequest, Specimen, DiagnosticReport, Observation.

---

### Pathology & Specimen Workflow

**Purpose.** Manages anatomic pathology specimen intake, gross and microscopic examination workflow, pathology report generation, and result distribution for surgical, cytology, and autopsy specimens.
**Key Entities.** PathologyCase, PathologySpecimen, GrossExamination, MicroscopicExamination, PathologyReport.
**Key Workflows.**
- Specimen submission: surgical specimen submitted with requisition; site, laterality, clinical history, and frozen-section request documented; specimen labeled and weighed
- Gross examination: pathologist documents specimen dimensions, gross description, tissue sampling plan, and block designations; frozen section results communicated intra-operatively
- Microscopic examination: slides reviewed; histologic description documented; special stains, IHC, or molecular studies ordered as needed
- Pathology report generation: preliminary report issued for complex cases; final report signed by pathologist; report distributed to ordering surgeon
- Correlation with clinical data: pathology findings linked to imaging and clinical diagnosis for concordance review; discordant cases flagged for multidisciplinary review
**Key Business Rules.**
- Intra-operative frozen section result must be communicated verbally to the surgeon before being formally released in the system; verbal communication is documented with time and recipient
- Final pathology report must be signed by an attending pathologist; trainee reports require co-signature
- Pathology report turnaround targets: routine biopsies 2 working days; complex cases 5 working days; amended reports generated when initial findings change after additional studies
- Chain of custody for surgical specimens must be unbroken; any handoff (OR to pathology, external reference) documented with time and accepting party
**State Machine.** `status` values: `submitted` → `grossing` → `processing` → `microscopy` → `preliminary-report` → `final-report` | `amended-report`.
**Key Endpoints.** `submitPathologyCase`, `recordGrossExam`, `orderSpecialStain`, `issueFrozenSectionResult`, `signPathologyReport`, `getPathologyCase`, `listPendingCases`.
**FHIR Mapping.** DiagnosticReport, Specimen, Observation (histologic findings), ServiceRequest (special stain orders).

---

### Blood Bank / Transfusion Services

**Purpose.** Manages blood product requests, type-and-screen, crossmatch, product issue, bedside transfusion monitoring, and transfusion reaction reporting within a closed chain-of-custody workflow.
**Key Entities.** BloodRequest, BloodProduct, TypeAndScreenResult, CrossmatchResult, TransfusionRecord, ReactionReport.
**Key Workflows.**
- Blood request: physician orders blood product type and quantity; clinical indication, patient blood type, and crossmatch status documented
- Type and screen: ABO/Rh type and antibody screen performed; results stored; valid for 72 hours per institution policy
- Crossmatch: specific unit crossmatched to patient; compatibility confirmed; unit assigned and held for patient
- Product issue and bedside verification: unit issued with tag; two-nurse verification at bedside before initiation (unit label matches patient wristband and blood bank tag)
- Transfusion monitoring: vitals at baseline, 15 minutes, and every 30 minutes during transfusion; any adverse signs prompt immediate stop and reaction workup
**Key Business Rules.**
- Two-nurse bedside verification is mandatory before any blood product is administered; both nurse IDs and verification time must be recorded; single-nurse administration is a hard stop in the system
- Emergency O-negative release is permitted without crossmatch for life-threatening hemorrhage; release requires emergency override documentation with ordering provider identity
- Transfusion reaction requires immediate product stop, patient assessment, reaction reporting to the blood bank, and an adverse event report; the product must be returned to blood bank with the transfusion record
- Blood product expiry must be checked at issue and again at bedside; expired products cannot be issued
**State Machine.** `status` values: `requested` → `type-and-screened` → `crossmatched` → `issued` → `transfusing` → `completed` | `reaction-reported` | `unit-returned`.
**Key Endpoints.** `createBloodRequest`, `recordTypeAndScreen`, `completeCrossMatch`, `issueBloodProduct`, `startTransfusion`, `documentReaction`, `getTransfusionHistory`.
**FHIR Mapping.** ServiceRequest, BiologicallyDerivedProduct, Observation (transfusion vitals), AdverseEvent (transfusion reaction).

---

### Radiology / RIS + PACS

**Purpose.** Manages imaging order workflow from request through scheduling, study performance, report authoring, and distribution, with integration to external PACS for image viewing.
**Key Entities.** ImagingOrder, ImagingStudy, RadiologyReport, DicomStudyReference, TransportRecord.
**Key Workflows.**
- Imaging order: physician creates imaging order with study type, body part, clinical indication, and priority; nurse acknowledges and coordinates transport
- Patient transport: nurse updates transport status (requested, in-transit, at-radiology, returned); bed management reflects temporary location change
- Study performance: technologist performs study, updates order status to Completed; DICOM images pushed to PACS or stored with study UID reference
- Report authoring: radiologist (may be remote for Level 1) reads images, dictates or types findings and impression, signs report; preliminary vs final report status tracked
- Report distribution: final report pushed to ordering provider's Laboratory Card equivalent (Imaging Card); critical findings communicated per critical results policy
**Key Business Rules.**
- Radiologist report must be issued within 24 hours for routine studies and within 2 hours for STAT/emergency studies; overdue reports generate escalation to radiology supervisor
- Critical imaging findings (pneumothorax, PE, aortic dissection, intracranial hemorrhage) must be communicated verbally to the ordering provider; communication documented with time and read-back confirmation
- DICOM images are stored externally or in PACS; only the study UID reference is stored in the RIS; the clinical system does not store raw DICOM data
- Contrast administration must be documented with agent name, dose, route, and lot number; contrast reactions are documented as adverse events
**State Machine.** `status` values: `ordered` → `scheduled` → `in-transit` → `in-progress` → `completed` → `preliminary-report` → `final-report` | `cancelled`.
**Key Endpoints.** `createImagingOrder`, `updateTransportStatus`, `confirmStudyComplete`, `draftRadiologyReport`, `signRadiologyReport`, `listImagingWorklist`, `getImagingReport`.
**FHIR Mapping.** ServiceRequest, ImagingStudy, DiagnosticReport, Observation (contrast adverse event).

---

### Code Blue / Rapid Response

**Purpose.** Provides a real-time, offline-capable documentation interface for cardiac arrest and rapid response events, capturing a full timestamped resuscitation record with medications, interventions, personnel, and outcome.
**Key Entities.** CodeEvent, CodeIntervention, CodeMedication, CodeVitals, CodePersonnel, CodeSummary.
**Key Workflows.**
- Code activation: nurse or physician initiates Code Blue or Rapid Response from any patient workspace; timer starts automatically; team members notified
- Real-time documentation: large-button interface captures CPR start/stop cycles, defibrillation (joules, waveform, rhythm before/after), airway interventions, IV access; prompted every 2 minutes for vitals
- Medication logging: crash cart medications (epinephrine, amiodarone, atropine, bicarbonate, adenosine) logged with dose, route, and time; system auto-calculates next epinephrine due time per ACLS protocol
- Outcome documentation: return of spontaneous circulation (ROSC) with time, or time of death called with physician identity; post-code interventions initiated
- Code summary generation: structured event timeline generated from all real-time entries; available for physician review, quality committee, and family communication
**Key Business Rules.**
- Code documentation must function fully offline with no network dependency; this is a life-critical scenario; any server requirement that blocks documentation is a safety failure
- Only one primary code documenter is designated at a time; system displays "Documentation active by [Nurse Name]" to prevent concurrent duplicate entries; supervisor can reassign
- Time of death declaration must include the declaring physician's name, role, and the exact time; declaration is immutable once saved
- Code event for an unregistered patient (e.g., collapse in lobby) is documented under a temporary Unknown Patient record and retrospectively linked to the registered encounter on identification
**State Machine.** `status` values: `activated` → `resuscitation-active` → `rosc` → `post-code-care` | `death-declared`.
**Key Endpoints.** `activateCodeEvent`, `logIntervention`, `logCodeMedication`, `recordCodeVitals`, `declareROSC`, `declareTimeoFDeath`, `generateCodeSummary`.
**FHIR Mapping.** Procedure (resuscitation), MedicationAdministration (code medications), Observation (code vitals), Composition (code summary).

---

### Discharge Summaries & Transitions of Care

**Purpose.** Produces a complete, structured discharge summary (DSCA — Discharge Summary and Clinical Abstract) that satisfies regulatory, accreditation, and care-transition requirements, and populates downstream billing and eClaims workflows.
**Key Entities.** DischargeSummary, PatientInstruction, FollowUpOrder, MedicationAtDischarge, ReferralLetter.
**Key Workflows.**
- DSCA authoring: physician opens DSCA editor from discharge workflow; auto-populated fields include demographics, admission and discharge dates, attending physician, admitting and final diagnoses (ICD-10), procedures (RVS codes), and active medication list
- Clinical narrative: physician writes hospital course summary, significant findings, and discharge condition; addenda can be added before signing
- Medication reconciliation at discharge: discharge medication list reconciled against home medications and inpatient changes; discrepancies resolved before finalization
- Patient instructions: printed discharge instructions generated in plain language with medication names, doses, and follow-up information; physician or nurse reviews with patient or family
- Referral and follow-up: follow-up appointments ordered, specialty referral letters generated with relevant clinical summary, pending results flagged for receiving provider
**Key Business Rules.**
- DSCA must be completed and signed by the attending physician within 24 hours of discharge; overdue DSCAs generate escalation alerts per JCI/DOH requirements
- DSCA must include at minimum: admitting diagnosis, hospital course, final diagnosis (ICD-10), procedures (RVS), medications at discharge, discharge condition, and follow-up instructions; system blocks signing if required fields are empty
- DSCA data flows automatically to eClaims CF2; ICD-10 and RVS codes entered in the DSCA are the source of truth for claim coding; no separate re-entry in billing
- Once signed, the DSCA is immutable; corrections require an amendment linked to the original, preserving both versions in the patient record
**State Machine.** `status` values: `not-started` → `in-progress` → `draft-complete` → `signed` | `amended`.
**Key Endpoints.** `createDischargeSummary`, `updateHospitalCourse`, `addPatientInstruction`, `signDischargeSummary`, `generateReferralLetter`, `getDischargeSummary`, `amendDischargeSummary`.
**FHIR Mapping.** Composition (CCDA-compatible, FHIR document type = discharge-summary), MedicationStatement (discharge medications), CarePlan (follow-up plan), ServiceRequest (follow-up orders).

---

### Palliative & Hospice Care

**Purpose.** Manages the full continuum of palliative and end-of-life care for patients with serious illness, including goals-of-care documentation, advance directive authoring, palliative consult tracking, symptom management, and hospice conversion workflows.
**Key Entities.** PalliativeConsult, AdvanceDirective, ComfortCarePlan, SymptomManagementOrder, HospiceConversion, BereavementReferral
**Key Workflows.**
- Document goals-of-care conversations and create or update advance directives (POLST, living will) with patient and surrogate signatures
- Submit and track palliative consult requests, assigning consulting clinicians and recording consult notes
- Author comfort care plans distinct from curative treatment plans, including expedited palliative medication orders for pain, dyspnea, and anxiety
- Initiate hospice conversion workflow, triggering payer benefit-level change and transitioning care documentation to hospice level of care
- Generate bereavement service referrals for family members following patient death
**Key Business Rules.**
- Advance directives require documented patient or legal surrogate consent before activation; superseded directives must be versioned and retained
- Palliative medication orders for comfort symptom control must follow an expedited pharmacy approval pathway distinct from standard medication order review
- Hospice conversion requires physician attestation of terminal prognosis and triggers payer benefit reclassification; curative orders must be reviewed for discontinuation
- Comfort care plans coexist in the record alongside curative plans but are flagged distinctly so clinicians can view each independently
- Bereavement referrals are available only after a patient death event is recorded in the encounter record
**State Machine.** `requested` → `accepted` → `active` → `completed` | `declined`
**Key Endpoints.** `createPalliativeConsult`, `getPalliativeConsult`, `updatePalliativeConsultStatus`, `createAdvanceDirective`, `getAdvanceDirective`, `createComfortCarePlan`, `initiateHospiceConversion`, `createBereavementReferral`
**FHIR Mapping.** Condition, CarePlan, Goal, ServiceRequest, Consent, RiskAssessment

---

### Home Health Orders & Remote Care

**Purpose.** Manages the hospital-side workflow for ordering post-discharge home health services, durable medical equipment, and remote patient monitoring devices, including order transmission to external agencies and receipt acknowledgment.
**Key Entities.** HomeHealthOrder, DMEOrder, RemoteMonitoringOrder, HomeHealthAuthorization, AgencyTransmission, VisitNoteIngestion
**Key Workflows.**
- Physician authors home health plan specifying nursing visit frequency, therapy disciplines (PT, OT, ST), home infusion, and wound care services
- Create durable medical equipment orders (wheelchair, home oxygen, IV pump) and submit for payer pre-authorization
- Order remote patient monitoring devices (BP cuff, glucometer, pulse oximeter) and link to telehealth follow-up program
- Transmit orders to the receiving home health agency via HL7 referral message or FHIR ServiceRequest and record transmission status
- Ingest visit notes and acknowledgment messages returned from the home health agency to close the order loop
**Key Business Rules.**
- Home health orders require an active payer authorization before transmission status can advance to `transmitted`; orders without authorization are held at `authorized`
- DME orders for oxygen therapy must include a qualifying diagnosis code and, where required by payer, a certificate of medical necessity
- Agency transmission must produce a delivery receipt; orders remaining unacknowledged beyond a configurable threshold trigger an escalation alert
- Visit notes ingested from agencies are stored as read-only documents linked to the originating order and do not create new clinical documentation within the hospital record
- Remote monitoring device orders must specify the monitoring program and data-transmission frequency; orders without a linked monitoring program are invalid
**State Machine.** `draft` → `authorized` → `transmitted` → `acknowledged` → `completed` | `cancelled`
**Key Endpoints.** `createHomeHealthOrder`, `getHomeHealthOrder`, `listHomeHealthOrders`, `submitAuthorizationRequest`, `transmitHomeHealthOrder`, `acknowledgeHomeHealthOrder`, `createDMEOrder`, `createRemoteMonitoringOrder`, `ingestAgencyVisitNote`
**FHIR Mapping.** ServiceRequest, Task, DeviceRequest, CommunicationRequest

---

### Long-Term Acute Care (LTAC) / Step-Down / Swing Bed

**Purpose.** Manages extended post-acute inpatient episodes beyond the standard acute stay window, covering LTAC admission criteria assessment, distinct length-of-stay tracking, recertification cycles, step-down unit transitions, and swing bed dual-classification workflows with payer-specific compliance requirements.
**Key Entities.** LTACEpisode, AdmissionCriteriaAssessment, RecertificationReview, StepDownTransition, SwingBedDesignation, PostAcuteTransferRecord
**Key Workflows.**
- Conduct and document LTAC admission criteria assessment, verifying qualifying clinical conditions (ventilator dependence, complex wound, complex medical condition) before episode creation
- Track LTAC length of stay independently from the originating acute encounter, maintaining separate billing classification codes
- Schedule and complete recertification reviews at defined intervals, capturing continued-stay justification and payer submission
- Process step-down transitions from ICU to intermediate or step-down unit, updating the episode sub-type and adjusting monitoring and staffing designations
- Designate and reclassify swing beds in rural hospital settings between acute and SNF levels of care, updating payer billing classification accordingly
**Key Business Rules.**
- LTAC episode creation is blocked until the admission criteria assessment is recorded as meeting qualifying criteria; partial or unmet assessments prevent admission status
- Recertification reviews must be initiated before the interval deadline; overdue recertifications generate compliance alerts and may suspend billing authorization
- Swing bed reclassification requires a physician order and payer notification; the same physical bed may not carry both acute and SNF designations simultaneously
- Post-acute transfer payment rules apply when a patient is transferred to LTAC within the DRG qualifying window; the system must flag these transfers for billing review
- Step-down transitions are recorded as nested encounters under the parent episode and do not reset the LTAC length-of-stay counter
**State Machine.** `pending-criteria-review` → `admitted` → `recertification-due` → `recertified` | `discharged` | `expired`
**Key Endpoints.** `createLTACEpisode`, `getLTACEpisode`, `listLTACEpisodes`, `submitAdmissionCriteriaAssessment`, `scheduleRecertificationReview`, `completeRecertificationReview`, `createStepDownTransition`, `designateSwingBed`, `recordPostAcuteTransfer`
**FHIR Mapping.** EpisodeOfCare, Encounter, CoverageEligibilityRequest, Coverage

---

## Category 3 — Hospital Practice Operations (43 Domains)

These domains cover non-clinical operations of a hospital. Many entities here are domain-native with no FHIR R4 analogue — write `domain-native` in FHIR Mapping for those.

---

### Bed Management & Capacity

**Purpose.** Tracks real-time status of every bed across all units to support admission, transfer, and discharge workflows. Provides census data for occupancy reporting and regulatory submissions.
**Key Entities.** Bed, BedAssignment, Unit, Ward, OccupancyCensus.
**Key Workflows.**
- Patient admitted → available bed selected → BedAssignment created → bed status set to `assigned`
- Patient discharged or transferred → bed released → cleaning request generated → status set to `dirty`
- EVS clears bed → status transitions to `available`
- Admin marks bed `out-of-service` for maintenance; restored manually
- Census snapshot generated on demand or scheduled for regulatory reporting submissions (see `PH:DOH OHSRS Reporting` adapter for Philippine requirements)
**Key Business Rules.**
- A bed may only have one active BedAssignment at a time
- `out-of-service` beds are excluded from availability counts
- Occupancy rate = occupied / (total − out-of-service); denominator never includes `out-of-service` beds
- Bed type (Ward / Semi-Private / Private) determines room rate charge captured by Billing
- Offline conflict: two simultaneous assignments to the same bed — earlier timestamp wins on sync
**State Machine.** `available` → `assigned` | `reserved` | `out-of-service`; `assigned` → `dirty`; `dirty` → `cleaning` → `available`; `reserved` → `assigned` | `available`; `out-of-service` → `available`.
**Key Endpoints.** `listBeds`, `getBedStatus`, `assignBed`, `releaseBed`, `markBedOutOfService`, `getCensusSummary`, `getBedMap`.
**FHIR Mapping.** Location.

---

### Bed Cleaning / EVS Turnover

**Purpose.** Manages Environmental Services (EVS) cleaning tasks triggered when a patient vacates a bed, ensuring beds are cleaned, inspected, and returned to available status within target turnaround time.
**Key Entities.** CleaningRequest, EVSTask, CleaningProtocol, EVSStaff, InspectionRecord.
**Key Workflows.**
- Patient vacates bed → system auto-generates CleaningRequest with protocol type derived from isolation flag
- EVS supervisor assigns task to EVSStaff → status set to `evs-assigned`
- EVS staff begins cleaning → `in-cleaning`; completes → `inspected`
- Charge nurse or supervisor inspects and approves → `clean`; bed returned to `available` in Bed Management
- Turnaround time (request-to-clean) recorded per bed per event for performance reporting
**Key Business Rules.**
- Isolation or contact-precaution rooms require terminal-clean protocol; standard protocol is insufficient
- Bed cannot be reassigned until status is `clean`
- Target turnaround: standard ≤ 60 min; isolation/terminal ≤ 90 min; breach generates alert
- Inspection step is mandatory — EVS staff cannot self-approve to `clean`
**State Machine.** `dirty` → `evs-assigned` → `in-cleaning` → `inspected` → `clean` | `failed-inspection`; `failed-inspection` → `in-cleaning`.
**Key Endpoints.** `createCleaningRequest`, `assignEVSTask`, `startCleaning`, `submitInspection`, `approveClean`, `getEVSTurnaroundReport`, `listPendingCleaningTasks`.
**FHIR Mapping.** domain-native.

---

### Patient Transport / Porter Services

**Purpose.** Coordinates internal patient transport (bed-to-procedure, ward-to-imaging, ward-to-discharge) with porter assignment, tracking, and turnaround time measurement.
**Key Entities.** TransportRequest, PorterAssignment, TransportRoute, EquipmentReservation.
**Key Workflows.**
- Clinical staff creates TransportRequest specifying origin, destination, transport mode, and urgency
- Transport coordinator assigns porter and, if required, reserves wheelchair or stretcher
- Porter acknowledges → picks up patient → arrives at destination → request closed
- Urgent requests (e.g., code transfer to ICU) bypass queue and auto-page on-duty porter
- Completed transports logged for average response-time and porter workload reporting
**Key Business Rules.**
- Patient transport requires an active encounter; requests cannot be created for discharged patients
- Equipment (wheelchair, stretcher, IV pole) checked out on assignment and checked in on completion
- Urgent priority requests must be acknowledged within 5 minutes; breach triggers escalation alert
- Porter cannot close a request without confirming destination arrival
**State Machine.** `requested` → `assigned` → `en-route` → `delivered` → `closed`; `requested` → `cancelled`.
**Key Endpoints.** `createTransportRequest`, `assignPorter`, `acknowledgeTransport`, `confirmArrival`, `cancelTransportRequest`, `getPorterWorkload`, `listActiveTransports`.
**FHIR Mapping.** domain-native.

---

### Discharge Planning & Case Management

**Purpose.** Coordinates post-acute care planning, social work involvement, and safe discharge for complex patients requiring home health, SNF placement, or community resource linkage.
**Key Entities.** DischargePlan, CaseManagerAssignment, PostAcutePlacement, BarrierToDischarge, CareTransitionNote.
**Key Workflows.**
- Case manager screens admissions for complex discharge needs using standardized criteria (e.g., age, diagnosis, social situation)
- DischargePlan created with projected discharge date, disposition, and identified barriers
- Barriers tracked and resolved iteratively (e.g., patient education, equipment procurement, SNF bed secured)
- Care transition note generated at discharge; transmitted to receiving provider or facility
- Readmission risk score calculated and flagged for high-risk patients
**Key Business Rules.**
- Discharge plan must be initiated within 24 hours of admission for patients meeting complexity criteria
- Projected discharge date is editable by case manager and attending physician only
- Barrier resolution requires documented action and responsible party
- Care transition note is part of the discharge record and follows the patient
**State Machine.** `screening` → `plan-initiated` → `barriers-identified` → `barriers-resolved` → `ready-for-discharge` → `discharged`; any state → `plan-updated`.
**Key Endpoints.** `createDischargePlan`, `updateProjectedDischargeDate`, `addBarrierToDischarge`, `resolveBarrier`, `generateCareTransitionNote`, `getDischargePlanByEncounter`, `listHighRiskDischarges`.
**FHIR Mapping.** CarePlan, EpisodeOfCare.

---

### Utilization Review & Medical Necessity

**Purpose.** Validates that inpatient admissions, continued stays, and procedures meet payer-defined medical necessity criteria to prevent denials and ensure appropriate level of care.
**Key Entities.** UtilizationReview, CriteriaSet, ContinuedStayReview, PeerAdvisorConsult, AuthorizationRecord.
**Key Workflows.**
- Initial review performed at admission; clinical data mapped to InterQual or MCG criteria
- Continued stay reviews triggered at payer-defined intervals (typically every 1-3 days)
- Cases not meeting criteria escalated to physician peer advisor for clinical justification
- Authorization number obtained from payer; linked to encounter for billing
- Denials for medical necessity routed to Revenue Cycle denial management workflow
**Key Business Rules.**
- Every inpatient day without valid authorization or criteria documentation is a financial liability
- Peer advisor escalation must occur within 24 hours of initial non-certification
- Criteria version (InterQual year) used for each review must be recorded; retrospective audits require exact version match
- Authorization numbers must be captured before claim submission
**State Machine.** `pending-review` → `criteria-met` | `criteria-not-met`; `criteria-not-met` → `peer-advisor-review` → `approved-with-justification` | `denied`; `denied` → `appeal-filed`.
**Key Endpoints.** `createUtilizationReview`, `submitCriteriaAssessment`, `escalateToPeerAdvisor`, `captureAuthorizationNumber`, `flagDenialForRevenueCycle`, `getContinuedStayReviewSchedule`, `listPendingReviews`.
**FHIR Mapping.** CoverageEligibilityRequest, ClaimResponse.

---

### Staff / Workforce Scheduling

**Purpose.** Manages nursing and ancillary staff shift schedules, on-call rosters, and daily staffing assignments by unit to ensure safe nurse-to-patient ratios.
**Key Entities.** ShiftTemplate, ScheduledShift, StaffAssignment, CallInEvent, FloatPoolRequest.
**Key Workflows.**
- Charge nurse or staffing coordinator builds unit schedule from shift templates (days/evenings/nights)
- Published schedule distributed to staff; staff acknowledge shifts
- Day-of adjustments handle call-ins: float pool queried, agency staff requested if internally unfillable
- Actual hours worked captured for payroll integration
- Staffing ratio calculated in real time; alert fires if unit drops below minimum safe ratio
**Key Business Rules.**
- Minimum nurse-to-patient ratios are unit-type dependent (ICU 1:2, general ward 1:5) and cannot be overridden without supervisor acknowledgment
- Consecutive hours worked must not exceed regulatory limit (typically 12 hours per shift, 60 hours per week)
- Call-in events must have a documented replacement or supervisor sign-off on short-staffed operation
- Overtime requires manager approval before shift start
**State Machine.** `draft` → `published` → `acknowledged` → `active` → `completed`; `acknowledged` → `called-in` → `replaced` | `unfilled`.
**Key Endpoints.** `createShiftSchedule`, `publishSchedule`, `acknowledgeShift`, `recordCallIn`, `requestFloatPool`, `getStaffingRatioByUnit`, `listOpenShifts`.
**FHIR Mapping.** domain-native.

---

### Credentialing & Privileging

**Purpose.** Manages provider license verification, hospital privilege grants, and mandatory FPPE/OPPE review cycles to ensure only credentialed, privileged providers perform clinical services.
**Key Entities.** ProviderCredential, Privilege, FPPEReview, OPPEReview, ExpiryAlert.
**Key Workflows.**
- New provider submits credentialing application; primary source verification performed for each license and certification
- Medical staff committee reviews and approves initial privileges; FPPE monitoring period begins (typically 10 cases or 90 days)
- FPPE data collected by department chief; reviewed at conclusion; full privileges granted if criteria met
- OPPE data collected continuously; formal review generated every 2 years at reappointment
- Expiry alerts generated 90/60/30 days before license, DEA, or board certification expiration
**Key Business Rules.**
- A provider may not render clinical services for which they lack active, approved privileges
- Initial privileges require completed FPPE; privilege cannot convert to permanent before FPPE closure
- OPPE review is mandatory at every 2-year reappointment; failure to complete suspends reappointment
- Expired license or lapsed malpractice insurance auto-suspends all privileges until remediated
- Credentials are primary-source verified — attestation alone is insufficient
**State Machine.** `application-received` → `verification-in-progress` → `committee-review` → `provisionally-approved` → `fppe-monitoring` → `fully-privileged` → `oppe-active` → `reappointment` | `suspended` | `revoked`.
**Key Endpoints.** `submitCredentialingApplication`, `recordPrimarySourceVerification`, `grantPrivilege`, `openFPPEPeriod`, `closeFPPEReview`, `generateOPPEReport`, `suspendPrivilege`, `listExpiringCredentials`.
**FHIR Mapping.** Practitioner, PractitionerRole.

---

### Employee / Occupational Health

**Purpose.** Manages employee health screening, vaccination records, work-related injury and illness tracking, fit-for-duty determinations, and OSHA-required surveillance programs.
**Key Entities.** EmployeeHealthRecord, OccupationalInjury, VaccinationRecord, FitForDutyAssessment, SurveillanceProgram.
**Key Workflows.**
- Pre-employment screening creates baseline EmployeeHealthRecord (TB test, titers, required vaccinations)
- Annual surveillance tasks generated per program (influenza vaccination campaign, TB screening, blood-borne pathogen follow-up)
- Work-related injury or exposure reported → occupational health evaluation → OSHA recordability determination
- Fit-for-duty assessment requested by manager for return-to-work after extended illness or injury
- Exposure events (needlestick, blood/body fluid) trigger post-exposure prophylaxis workflow
**Key Business Rules.**
- Employees with lapsed mandatory vaccinations (Hep B, TB screen) are flagged to HR; patient-contact roles may be restricted
- OSHA 300 log updated within 7 days of recordable injury/illness determination
- Needlestick post-exposure prophylaxis must be initiated within 2 hours of reported exposure
- Fit-for-duty determination is made by occupational health physician, not by the employee's own department
**State Machine.** `screening-required` → `screening-complete` → `cleared` | `restricted` | `deferred`; `injured` → `under-evaluation` → `osha-determination` → `recordable` | `non-recordable` → `closed`.
**Key Endpoints.** `createEmployeeHealthRecord`, `recordVaccination`, `reportOccupationalInjury`, `initiatePostExposureProphylaxis`, `issueFitForDutyAssessment`, `generateOSHA300Log`, `listOverdueSurveillanceTasks`.
**FHIR Mapping.** domain-native.

---

### Volunteer Management

**Purpose.** Manages hospital volunteer recruitment, onboarding health clearance, scheduling, assignment to departments, and hours tracking.
**Key Entities.** VolunteerRecord, VolunteerClearance, VolunteerAssignment, VolunteerHoursLog, DepartmentRequest.
**Key Workflows.**
- Prospective volunteer applies; application reviewed by volunteer coordinator
- Clearance checklist completed (TB test, background check, orientation modules) before any patient-area assignment
- Volunteer scheduled to department shifts; department confirms request fulfillment
- Hours logged per session; cumulative hours reported for recognition and grant reporting
- Inactive volunteers (no hours in 6 months) flagged for follow-up or deactivation
**Key Business Rules.**
- No volunteer may be assigned to patient-contact areas without completed clearance on file
- Background check must be renewed per policy (typically annually)
- Minors (under 18) require parental consent form before onboarding
- Volunteers do not perform clinical tasks; assignment scope is administrative or comfort/hospitality only
**State Machine.** `applied` → `clearance-in-progress` → `cleared` → `active` → `inactive` → `deactivated`; `cleared` → `suspended` (clearance lapse).
**Key Endpoints.** `createVolunteerApplication`, `updateClearanceChecklist`, `scheduleVolunteer`, `logVolunteerHours`, `deactivateVolunteer`, `getDepartmentVolunteerRequest`, `getHoursSummaryReport`.
**FHIR Mapping.** domain-native.

---

### Supply Chain & Materials Management

**Purpose.** Manages procurement, receiving, inventory, and distribution of medical and non-medical supplies across hospital departments and storerooms.
**Key Entities.** InventoryItem, PurchaseOrder, POLineItem, ReceivingRecord, StockRequisition, Vendor.
**Key Workflows.**
- Department submits StockRequisition to central stores; filled from on-hand inventory or triggers PO generation
- PO generated, approved by materials manager, and transmitted to vendor
- Goods received against PO; discrepancies flagged; inventory updated
- Lot numbers and expiration dates captured for implantable and high-risk items
- Automated reorder triggered when item quantity falls below par level
**Key Business Rules.**
- No PO may be issued without budget center approval up to the defined threshold; above threshold requires CFO approval
- Received quantities must be reconciled to PO within 3 business days; unresolved discrepancies escalate to procurement
- Expired items must be quarantined and removed from available inventory; disposal documented
- Consignment inventory tracked separately; usage reported to vendor for billing
- FIFO rotation enforced for all stocked items with expiration dates
**State Machine.** `draft-po` → `approved` → `transmitted` → `partially-received` | `fully-received` → `closed`; `fully-received` → `invoiced` → `paid`.
**Key Endpoints.** `createPurchaseOrder`, `approvePurchaseOrder`, `receiveGoods`, `submitStockRequisition`, `fulfillRequisition`, `getInventoryLevelByItem`, `listItemsBelowParLevel`, `flagExpiredItems`.
**FHIR Mapping.** domain-native.

---

### Chargemaster (CDM)

**Purpose.** Maintains the master list of every billable item (procedures, supplies, pharmaceuticals, room charges) with associated CDM codes, CPT codes, revenue codes, and department-level pricing.
**Key Entities.** ChargemasterEntry, CPTCode, HCPCSCode, RevenueCode, PriceList, ComplianceReviewRecord.
**Key Workflows.**
- Clinical or finance department requests new CDM entry or price update; compliance review initiated
- Compliance officer reviews for regulatory compliance (CMS price transparency, payer contract alignment)
- Approved entry published to production CDM; effective date tracked
- Annual CDM review performed; obsolete codes inactivated; new CPT year codes added
- Price transparency file generated from CDM for public posting per regulatory requirements
**Key Business Rules.**
- Every billable service rendered must map to at least one active CDM entry; unmapped services cannot be billed
- CDM updates require compliance review and documented approval before publication; no direct edits to production
- Inactivated CDM entries are retained for historical claim reference; never deleted
- Revenue code is required on every entry for UB-04 claim form generation
- Price transparency posting must reflect current gross charges; discrepancy between CDM and posted prices is a compliance violation
**Key Endpoints.** `createCDMEntry`, `updateCDMEntry`, `inactivateCDMEntry`, `approveCDMChange`, `getCDMEntryByCode`, `searchCDM`, `generatePriceTransparencyFile`, `listPendingCDMReviews`.
**FHIR Mapping.** ChargeItemDefinition.

---

### Revenue Cycle & Denials Management

**Purpose.** Manages the end-to-end claim lifecycle from charge capture through remittance posting, with focused denial tracking, appeal workflows, and A/R aging analysis.
**Key Entities.** Claim, DenialRecord, AppealCase, RemittanceAdvice, ARAgingBucket.
**Key Workflows.**
- Verified charges and coding complete → claim dropped and submitted to payer
- Remittance received → payment posted; denied lines extracted to denial worklist
- Denial worked by biller: root cause categorized (CO-97, PR-96, CO-4, etc.); corrective action taken
- Appeal filed within payer timely-filing limit with supporting clinical documentation
- A/R aging report generated daily; accounts > 90 days escalated for collection action
**Key Business Rules.**
- Denials must be worked within payer-specific timely-filing limit for appeals (typically 60-180 days from denial date)
- PR-96 (non-covered charge) denials require clinical documentation substantiating medical necessity before appeal
- A claim may not be resubmitted without root-cause correction documented in the DenialRecord
- Write-off of balances above the threshold requires CFO approval; amounts below threshold require manager approval
- CO-29 (duplicate claim) denials require investigation before any resubmission to prevent fraud exposure
**State Machine.** `draft` → `submitted` → `pending-adjudication` → `paid` | `denied` | `partially-paid`; `denied` → `appeal-filed` → `appeal-upheld` | `appeal-overturned` | `written-off`.
**Key Endpoints.** `submitClaim`, `postRemittance`, `createDenialRecord`, `fileAppeal`, `resolveAppeal`, `writeOffBalance`, `getARAgingReport`, `getDenialCategoryBreakdown`.
**FHIR Mapping.** Claim, ClaimResponse.

---

### Coding (ICD-10, DRG, HCC)

**Purpose.** Assigns diagnosis (ICD-10-CM), procedure (ICD-10-PCS or CPT), DRG, and HCC codes to encounters based on clinical documentation, driving billing accuracy and risk adjustment.
**Key Entities.** CodingAssignment, PrincipalDiagnosis, SecondaryDiagnosis, DRGAssignment, HCCCode, QueryRecord.
**Key Workflows.**
- Coder reviews clinical documentation (DSCA, physician notes, operative reports) and assigns codes
- Coding query generated when documentation is insufficient or ambiguous; physician responds
- DRG calculated from principal diagnosis, procedure, age, sex, and CC/MCC secondary diagnoses
- HCC codes assigned for outpatient and risk-adjustment encounters; submitted to payer for capitation
- QA coding review performed on random sample (minimum 10%) of charts before claim drop
**Key Business Rules.**
- Principal diagnosis is the condition determined after study to be chiefly responsible for admission; it drives MS-DRG assignment and cannot be the same as an admission-rule-out diagnosis
- CC/MCC secondary diagnoses must be clinically supported by documentation; query required if absent from notes
- Coding is a legal attestation; coder credentials (CCS, CPC) must be on file
- Upcoding or unsupported code assignment is a False Claims Act violation; QA flag escalates to compliance
- Physician query responses must be co-signed by the physician, not entered by coding staff
**Key Endpoints.** `assignDiagnosisCode`, `assignProcedureCode`, `calculateDRG`, `assignHCCCode`, `createPhysicianQuery`, `resolvePhysicianQuery`, `submitCodingForQA`, `getCodingSummaryByEncounter`.
**FHIR Mapping.** Claim.

---

### Health Information Management (HIM) / ROI & Chart Completion

**Purpose.** Manages medical record completion workflows, deficiency tracking, and Release of Information (ROI) requests with authorization validation and PHI audit logging.
**Key Entities.** ChartDeficiency, DeficiencyType, ROIRequest, ROIAuthorization, ROIFulfillment.
**Key Workflows.**
- At discharge, chart analyzed for deficiencies (missing signatures, unsigned notes, incomplete DSCA)
- Deficiency assigned to responsible provider with due date; reminder workflow escalates delinquency
- Provider completes deficiency via electronic signature or addendum
- ROI request received (patient, legal, insurance, continuity of care); authorization validated
- Authorized records assembled, PHI minimum-necessary standard applied, and released via secure channel
**Key Business Rules.**
- No record release without valid, signed authorization or legally recognized exception (court order, public health mandate, treatment continuity)
- Delinquent records (deficiency outstanding > state-defined threshold, typically 30 days post-discharge) trigger medical staff privilege suspension notification
- Break-the-glass access to records outside normal scope is logged separately as an AuditEvent and reviewed by HIM within 24 hours
- Copies of records released are logged with recipient, date, scope, and authorization reference; immutable
- Minor patient records released only to guardian unless minor is emancipated or records pertain to specific self-consent-eligible services
**State Machine.** `incomplete` → `deficiency-assigned` → `deficiency-resolved` → `complete` | `delinquent`; ROI: `request-received` → `authorization-validated` → `records-assembled` → `released` | `denied`.
**Key Endpoints.** `analyzeChartAtDischarge`, `assignDeficiency`, `resolveDeficiency`, `createROIRequest`, `validateROIAuthorization`, `fulfillROIRequest`, `denyROIRequest`, `getDelinquentChartReport`, `logBreakTheGlassAccess`.
**FHIR Mapping.** Composition, AuditEvent.

---

### Cost Accounting

**Purpose.** Allocates direct and indirect costs to encounters, procedures, and service lines to enable contribution margin analysis, DRG profitability, and strategic pricing decisions.
**Key Entities.** CostCenter, CostAllocationRule, EncounterCostRecord, ServiceLineProfitability, BudgetPeriod.
**Key Workflows.**
- Direct costs (labor, supplies, pharmacy) mapped to encounters from source modules via RVU or actual-cost methodology
- Indirect costs (overhead, administration, facilities) allocated to cost centers using step-down or RCC methodology
- Encounter-level cost assembled; compared to reimbursement for contribution margin
- Service line profitability report generated by DRG, payer, and physician for leadership review
- Budget vs. actual variance report generated monthly per cost center
**Key Business Rules.**
- Cost allocation methodology (RVU, actual cost, RCC) must be documented and applied consistently within a fiscal year; changes require CFO approval
- Labor costs allocated using productive hours from workforce scheduling system; idle time allocated to overhead
- Pharmacy costs use actual acquisition cost (AAC), not chargemaster price
- Cost data is financial reporting data — access restricted to finance and executive roles; clinical staff do not see cost overlays in clinical views
**Key Endpoints.** `createCostAllocationRule`, `runEncounterCostAllocation`, `getEncounterCostSummary`, `getServiceLineProfitabilityReport`, `getDRGMarginReport`, `getBudgetVarianceReport`, `listCostCenters`.
**FHIR Mapping.** domain-native.

---

### Sterile Processing / CSSD

**Purpose.** Tracks the decontamination, assembly, sterilization, and release of surgical instrument trays and reusable medical devices, with full lot traceability for recall management.
**Key Entities.** InstrumentTray, SterilizationCycle, BIIndicator, RecallRecord, SterilizationLoad.
**Key Workflows.**
- Used instruments returned to CSSD; tray contents verified against inventory checklist
- Decontamination performed; tray assembled and inspected; packaging and load assignment recorded
- Sterilization cycle run; cycle parameters (temperature, pressure, time, steam quality) logged
- Biological indicator incubated; negative result required before load released for clinical use
- Released trays distributed to OR or requesting department; tray-to-patient association recorded at point of use
**Key Business Rules.**
- A sterilization load may not be released for clinical use until the biological indicator result is confirmed negative
- Positive BI result triggers recall of all trays in the same load; affected patients identified via tray-to-patient records and notified per infection control protocol
- Every tray must have a traceable load number linking it to its sterilization cycle parameters
- Implantable devices require quarantine until BI result confirmed; express release with chemical indicator only is prohibited for implants
- Sterilizer maintenance and qualification records must be retained per regulatory requirement (minimum 3 years)
**State Machine.** `soiled` → `decontamination` → `assembly` → `packaged` → `sterilized` → `quarantine` → `released` | `recalled`; `recalled` → `re-decontamination` → `assembly`.
**Key Endpoints.** `createSterilizationCycle`, `assignTrayToLoad`, `recordBIResult`, `releaseLoad`, `initiateRecall`, `getTrayHistory`, `getLoadCycleParameters`, `listPendingBIResults`.
**FHIR Mapping.** domain-native.

---

### Biomedical Equipment Management

**Purpose.** Manages the lifecycle of clinical equipment including preventive maintenance scheduling, work order tracking, regulatory inspections, and equipment recall management.
**Key Entities.** BiomedEquipment, PreventiveMaintenance, WorkOrder, CalibrationRecord, EquipmentRecall.
**Key Workflows.**
- Equipment added to asset register with manufacturer, model, serial number, and risk classification
- Preventive maintenance schedule auto-generated based on manufacturer specification and risk class
- PM due dates trigger work orders assigned to biomedical engineers or service vendors
- Completed work orders record labor, parts, and pass/fail of safety and functional tests
- FDA / manufacturer recall notices entered; affected assets identified and quarantined until inspection complete
**Key Business Rules.**
- Equipment with lapsed PM is flagged as out-of-compliance and may be quarantined pending maintenance at risk manager's discretion
- High-risk equipment (ventilators, infusion pumps, defibrillators) PM intervals may not be extended without biomed director approval
- Calibration certificates for measurement equipment must be traceable to national standards
- Equipment involved in a patient safety incident is quarantined immediately and locked from further use until incident review completes
- Recalled equipment must be removed from clinical use within the manufacturer-specified response time
**State Machine.** `in-service` → `pm-due` → `work-order-open` → `in-maintenance` → `in-service` | `condemned`; `in-service` → `quarantined` → `inspected` → `in-service` | `condemned`.
**Key Endpoints.** `registerEquipment`, `createPMSchedule`, `openWorkOrder`, `completeWorkOrder`, `recordCalibration`, `initiateEquipmentRecall`, `quarantineEquipment`, `getEquipmentComplianceDashboard`.
**FHIR Mapping.** domain-native.

---

### Linens & Laundry Services

**Purpose.** Tracks linen inventory distribution to units, soiled linen collection, laundry processing cycles, and clean linen restocking to ensure adequate supply and infection control compliance.
**Key Entities.** LinenItem, LinenDistributionRecord, SoiledLinenCollection, LaundryBatch, ParLevelConfig.
**Key Workflows.**
- Clean linen distributed to units from central linen room against par level targets
- Soiled linen collected from units on defined schedule; weights and counts recorded per cart
- Laundry batch processed (wash-cycle parameters logged for infection control compliance)
- Processed linen returned to circulation; lost or condemned items reconciled against distribution records
- Par level alerts generated when unit linen counts fall below minimum; emergency distribution dispatched
**Key Business Rules.**
- Isolation room linen collected separately in biohazard bags and processed on a dedicated isolation-linen cycle; standard cycle is insufficient
- Linen from patients with known or suspected prion disease (CJD) must be incinerated, not reprocessed
- Laundry wash-cycle temperature must meet minimum threshold (≥ 71°C for 25 minutes, or equivalent chemical equivalent) per infection control standards
- Condemned linen (stained, torn, beyond service life) removed from circulation and documented before disposal
**Key Endpoints.** `distributeLinenToUnit`, `recordSoiledLinenCollection`, `createLaundryBatch`, `completeLaundryBatch`, `updateLinenInventory`, `getParLevelAlerts`, `getLostLinenReconciliationReport`.
**FHIR Mapping.** domain-native.

---

### Food & Nutrition / Dietary

**Purpose.** Manages patient diet orders, meal tray delivery, nutritional assessments by registered dietitians, and special diet production, coordinating between clinical and food service operations.
**Key Entities.** DietOrder, MealTray, NutritionalAssessment, DietaryRestriction, FoodServiceProduction.
**Key Workflows.**
- Physician or dietitian enters diet order linked to patient encounter; effective immediately
- Diet order transmitted to kitchen for next meal cycle; tray assembly reflects current order
- Dietitian conducts nutritional assessment for at-risk patients (malnutrition screening positive, ICU, surgical)
- Patient dietary preferences and cultural/religious restrictions documented and respected in meal planning
- Tube feeding and enteral nutrition orders entered with rate, formula, and schedule; separate from oral diet orders
**Key Business Rules.**
- Diet order is a physician or authorized dietitian order; kitchen staff cannot modify the diet type without order change
- NPO (nothing by mouth) orders must be communicated to kitchen within 30 minutes of entry to prevent tray delivery; tray delivered to NPO patient is a safety event
- Texture-modified diets (IDDSI levels) require dietitian assessment before downgrading from higher restriction level
- Allergen-restricted trays (peanut, shellfish, gluten-free) are assembled in a designated allergen-free zone; cross-contamination protocol documented
- Diet orders remain active until explicitly discontinued; discharge does not auto-cancel diet orders (separate workflow required)
**State Machine.** `ordered` → `transmitted-to-kitchen` → `in-production` → `tray-assembled` → `delivered` → `completed`; `ordered` → `cancelled`; any active state → `npo-hold`.
**Key Endpoints.** `createDietOrder`, `cancelDietOrder`, `placeNPOHold`, `transmitDietToKitchen`, `confirmTrayDelivery`, `createNutritionalAssessment`, `getDietOrdersByUnit`, `getPatientDietaryProfile`.
**FHIR Mapping.** NutritionOrder, Observation.

---

### Housekeeping / Environmental Services

**Purpose.** Manages scheduled and demand-driven cleaning tasks for all non-patient-bed areas including corridors, offices, restrooms, and common areas, with task assignment and completion verification.
**Key Entities.** CleaningSchedule, HousekeepingTask, CleaningZone, InspectionScore, ChemicalUsageLog.
**Key Workflows.**
- Master cleaning schedule defines frequency (daily, weekly, terminal) and assigned zone per housekeeper
- Work orders generated automatically from schedule; urgent demand tasks created by any staff member
- Housekeeper checks in to zone and marks tasks complete; supervisor conducts random inspection audits
- Inspection scores recorded per zone; low-scoring zones trigger re-clean and corrective action
- Chemical usage logged for safety data sheet compliance and OSHA hazard communication requirements
**Key Business Rules.**
- High-traffic clinical zones (ER, OR corridors, ICU waiting areas) require minimum daily disinfection frequency; reduction below minimum requires infection prevention approval
- Hazardous cleaning chemicals require documented housekeeper training before assignment to tasks using those products
- Terminal cleaning of isolation rooms is a coordinated handoff with EVS Turnover (bed cleaning domain); both must complete before room is returned to available
- Inspection scores below acceptable threshold (facility-defined, typically < 85%) require corrective action plan within 48 hours
**Key Endpoints.** `createCleaningSchedule`, `generateHousekeepingTasks`, `completeHousekeepingTask`, `submitInspectionScore`, `requestUrgentCleaning`, `logChemicalUsage`, `getZoneComplianceReport`.
**FHIR Mapping.** domain-native.

---

### Mortuary / Morgue Management

**Purpose.** Manages deceased patient body receipt, identification, storage, release authorization, and coordination with funeral homes and medical examiners.
**Key Entities.** DeceasedRecord, BodyStorageSlot, ReleaseAuthorization, MedicalExaminerReferral, ChainOfCustodyLog.
**Key Workflows.**
- Patient death recorded in EMR; mortuary notified and body transported to morgue
- Body received, identified, and assigned to storage slot; toe tag and wristband identification verified
- Death certificate initiated; attending physician certifies cause of death
- Medical examiner referral generated for reportable deaths (unexpected, trauma, unattended)
- Body released to authorized next of kin or funeral home after authorization verification; chain of custody documented
**Key Business Rules.**
- Body identification must use two independent identifiers before release; release to wrong party is a critical incident
- Reportable deaths (per jurisdictional law: trauma, suicide, unexpected, unattended, within 24 hours of admission) must be referred to medical examiner before any body release
- Body storage time limits apply; extended storage beyond 72 hours requires documented justification
- Chain of custody log is immutable; every handoff must be documented with recipient identity and time
- Unclaimed remains must follow statutory process (notification of next of kin, waiting period, municipality notification) before disposition
**State Machine.** `received` → `stored` → `pending-release` → `released`; `stored` → `me-referral` → `me-accepted` | `me-released` → `pending-release` → `released`.
**Key Endpoints.** `createDeceasedRecord`, `assignStorageSlot`, `createReleaseAuthorization`, `releaseBody`, `createMedicalExaminerReferral`, `logChainOfCustodyHandoff`, `getStorageCapacityStatus`.
**FHIR Mapping.** domain-native.

---

### Incident Reporting & Patient Safety Events

**Purpose.** Captures near misses, adverse events, and sentinel events to drive root cause analysis, corrective action, and accreditation-required safety reporting.
**Key Entities.** IncidentReport, RCARecord, ActionItem, SentinelEventAlert, CorrectionPlan.
**Key Workflows.**
- Any staff member submits incident report at time of event or near-miss discovery
- Patient safety officer triages severity; sentinel events (unexpected death, serious harm) escalate immediately
- Root cause analysis (RCA) convened for sentinel events and serious events; facilitated by patient safety officer
- Corrective action plan developed with accountable owners and due dates; implementation tracked
- Accreditation body notified within 45 days of sentinel event with completed RCA
**Key Business Rules.**
- Sentinel events must be reported to accreditation body within 45 days; RCA is required, not optional
- Incident reports are protected under peer review privilege and are not discoverable in litigation; they must never be referenced in the medical record
- Incident reports do not constitute disciplinary action; staff must not face retaliation for good-faith reporting
- RCA must identify system-level contributing factors, not solely individual error attribution
- Action items from RCA have assigned owners and due dates; overdue items escalate to CNO/CMO
**State Machine.** `reported` → `triaged` → `under-review` → `rca-in-progress` → `corrective-action` → `closed`; `triaged` → `sentinel-event-flagged` → `rca-in-progress`.
**Key Endpoints.** `submitIncidentReport`, `triageIncident`, `flagAsSentinelEvent`, `openRCARecord`, `createActionItem`, `resolveActionItem`, `closeIncidentReport`, `generateSafetyEventSummary`.
**FHIR Mapping.** AdverseEvent.

---

### Risk Management & Legal Hold

**Purpose.** Manages clinical and operational risk assessments, malpractice claims, litigation holds on medical records, and coordination with legal counsel and insurance carriers.
**Key Entities.** RiskEvent, MalpracticeClaim, LegalHold, LitigationRecord, InsuranceNotification.
**Key Workflows.**
- Risk event identified (from incident report or direct report); risk manager assesses liability exposure
- High-exposure events reported to malpractice carrier within policy-required timeframe (typically 30 days)
- Legal hold placed on all records related to the event; records flagged as non-destructible in HIM
- If claim filed, litigation record opened; legal counsel assigned; discovery coordination with HIM
- Claim resolved (settlement, dismissal, verdict); legal hold released; records returned to normal retention schedule
**Key Business Rules.**
- Legal hold overrides normal record destruction schedule; records under legal hold must be preserved indefinitely until hold is formally released
- Carrier notification deadline is strictly enforced; late notification may void malpractice coverage for the event
- Risk events with potential for sentinel event classification must be simultaneously reported to patient safety officer
- Settlement agreements are confidential; terms must not be documented in the medical record or incident report
- All communications between risk management and legal counsel are attorney-client privileged; stored in restricted access only
**State Machine.** `risk-identified` → `assessed` → `carrier-notified` → `claim-filed` → `litigation-active` → `resolved`; `assessed` → `closed-no-claim`; `litigation-active` → `legal-hold-active`.
**Key Endpoints.** `createRiskEvent`, `assessLiabilityExposure`, `notifyInsuranceCarrier`, `placeLegalHold`, `openLitigationRecord`, `releaseLegalHold`, `closeClaim`, `getLegalHoldsByRecord`.
**FHIR Mapping.** domain-native.

---

### Infection Prevention & HAI Surveillance

**Purpose.** Conducts ongoing surveillance for healthcare-associated infections (HAI) using NHSN definitions, manages isolation orders, tracks PPE compliance, and reports device-associated infection rates.
**Key Entities.** SurveillanceCase, HAIEvent, IsolationOrder, PPERequirement, NHSNSubmissionRecord.
**Key Workflows.**
- Automated surveillance rules screen microbiology results and clinical data for HAI criteria (CLABSI, CAUTI, SSI, VAP, CDiff)
- Positive screen reviewed by infection preventionist; HAI event confirmed or rejected with documentation
- Isolation order placed by physician (contact, droplet, airborne); PPE requirements generated for the room
- Outbreak investigation triggered when two or more linked cases identified on same unit within defined time window
- NHSN data compiled and submitted monthly; submission record retained for accreditation
**Key Business Rules.**
- HAI surveillance definitions follow current NHSN protocol verbatim; facility-defined modifications are prohibited for reportable metrics
- Isolation orders are physician orders, not nursing tasks; nursing staff may initiate precautions pending order but cannot replace the physician order
- Contact precaution patients must have a PPE requirement displayed at room entry; failure is a compliance finding
- CLABSI, CAUTI, SSI, VAP, and CDiff rates are publicly reportable; data corrections require infection preventionist and medical director sign-off
- Outbreak defined as two or more epidemiologically linked cases; investigation must begin within 24 hours of identification
**State Machine.** `screening-triggered` → `under-review` → `confirmed-hai` | `rejected`; `confirmed-hai` → `reported-to-nhsn` → `closed`; `isolation-order` → `active` → `discontinued`.
**Key Endpoints.** `runHAISurveillanceScreen`, `createHAIEvent`, `confirmOrRejectHAI`, `createIsolationOrder`, `discontinueIsolationOrder`, `generateNHSNSubmission`, `getHAIRateByType`, `triggerOutbreakInvestigation`.
**FHIR Mapping.** Condition, Flag, Observation.

---

### Antimicrobial Stewardship

**Purpose.** Promotes appropriate antibiotic use through prospective audit and feedback, restriction policies, de-escalation prompts, and stewardship intervention documentation.
**Key Entities.** AntibioticOrder, RestrictionPolicy, StewardshipIntervention, MICResult, CultureSensitivityResult.
**Key Workflows.**
- Antibiotic order placed in CPOE; restricted antibiotics trigger prior authorization request to ID pharmacy or physician
- Stewardship pharmacist or ID physician reviews restricted antibiotic requests; approved or denied within 48 hours
- Culture and sensitivity results trigger de-escalation prompt to prescribing physician at 48-72 hours
- Stewardship intervention (recommendation to change, narrow, or discontinue) documented with prescriber response
- Days of therapy (DOT) and defined daily dose (DDD) calculated by encounter for reporting
**Key Business Rules.**
- Restricted antibiotics (carbapenems, vancomycin IV, daptomycin, etc.) require ID physician approval within 48 hours; empiric use for 48 hours permitted pending culture
- Automatic stop orders apply to select agents (e.g., surgical prophylaxis automatically stops at 24 hours post-incision)
- De-escalation prompts are advisory; prescriber may decline with documented clinical reason
- Stewardship intervention acceptance rates are tracked and reported to medical staff committee quarterly
- Culture results driving de-escalation must be reviewed by physician and response (accept/decline) documented within 24 hours of prompt
**Key Endpoints.** `submitAntibioticOrder`, `requestRestrictedAntibioticApproval`, `approveOrDenyRestriction`, `triggerDeEscalationPrompt`, `documentStewardshipIntervention`, `recordPrescriberResponse`, `getDOTReportByEncounter`, `getAntibioticUsageSummary`.
**FHIR Mapping.** MedicationRequest, Observation.

---

### Quality Measures & Clinical Registries

**Purpose.** Calculates electronic clinical quality measures (eCQMs) using CQL-based logic, manages registry submissions (GWTG, STS, NSQIP, etc.), and tracks facility performance against national benchmarks.
**Key Entities.** QualityMeasure, MeasureResult, RegistrySubmission, CQLLibrary, BenchmarkComparison.
**Key Workflows.**
- eCQM definitions loaded as CQL libraries; measure logic applied against clinical data on defined calculation frequency
- MeasureResults generated per patient per measure; aggregated to facility-level performance score
- Registry-eligible encounters identified by diagnosis, procedure, or service line criteria
- Registry data elements extracted and formatted per registry specification; submitted within reporting calendar year
- Benchmark comparison report generated: facility rate vs. national median and top-decile performance
**Key Business Rules.**
- eCQM calculations must use the CQL specification version corresponding to the reporting year; version mismatch invalidates the measure
- Registry data submitted is a legal attestation of accuracy; submission requires quality director sign-off
- Measure denominator exclusions must be documented in the clinical record to be applied; assumed exclusions are not permitted
- Performance data feeds public reporting requirements (CMS Hospital Compare, state health department); data corrections must be processed before submission deadlines
**Key Endpoints.** `loadCQLLibrary`, `calculateMeasureForEncounter`, `aggregateFacilityMeasureScore`, `identifyRegistryEligibleEncounters`, `generateRegistrySubmission`, `getBenchmarkComparison`, `getMeasurePerformanceTrend`.
**FHIR Mapping.** Measure, MeasureReport.

---

### Peer Review / M&M

**Purpose.** Manages confidential case review of physician clinical performance through structured peer review and Morbidity & Mortality (M&M) conference, with outcomes tracked for credentialing and quality improvement.
**Key Entities.** PeerReviewCase, ReviewOutcome, DisciplinaryAction, MMCasePresentation, ReviewerAssignment.
**Key Workflows.**
- Case referred to peer review committee (from incident report, mortality, readmission, or sentinel event)
- Reviewer assigned by department chief; reviewer must be same specialty, may not be the case physician
- Reviewer evaluates case against standard of care using structured criteria; outcome categorized
- M&M cases prepared for conference presentation; learning points and system issues extracted
- Serious findings escalate to medical staff committee; possible corrective action (education, proctoring, privilege restriction)
**Key Business Rules.**
- Peer review proceedings are legally protected quality assurance activity; records are not discoverable in litigation and must never be shared outside the committee
- Reviewing physician cannot be the same physician whose case is under review; assignment must enforce this constraint
- Outcome categories (no issue, opportunity for improvement, below standard of care) drive escalation thresholds
- DisciplinaryAction requires medical staff committee vote per bylaws; department chief alone cannot impose
- M&M presentations are educational, not punitive; case presentations reference clinical learning, not individual blame
**Key Endpoints.** `createPeerReviewCase`, `assignReviewer`, `submitReviewOutcome`, `escalateToPeerReviewCommittee`, `createMMCasePresentation`, `recordDisciplinaryAction`, `getPeerReviewSummaryReport`.
**FHIR Mapping.** domain-native.

---

### Emergency Preparedness / Disaster (HICS)

**Purpose.** Activates and coordinates the Hospital Incident Command System (HICS) during internal and external emergencies, manages surge capacity, MCI triage, and resource tracking.
**Key Entities.** EmergencyActivation, HICSRole, SurgePlan, MCITriageTag, ResourceDeploymentRecord.
**Key Workflows.**
- Emergency activation initiated by Incident Commander; HICS role assignments distributed to designated staff
- Surge plan activated: elective procedures cancelled, discharge acceleration, holding area opened
- MCI triage tags (START protocol: black/red/yellow/green) assigned to mass casualty patients at point of entry
- MCI triage tag assignment overrides normal ADT workflow; abbreviated registration used for rapid throughput
- Incident log maintained throughout event; demobilization checklist completed at deactivation; after-action review scheduled
**Key Business Rules.**
- MCI triage tag colors follow START triage protocol: black (expectant/deceased), red (immediate), yellow (delayed), green (minor); no facility deviation permitted
- MCI triage tags take precedence over normal ADT encounter creation; triage tag number is the temporary identifier until full registration is possible
- HICS activation must be documented with activation time, activating authority, and incident type
- Drill activations must be clearly labeled as drills in all records to prevent confusion with real events
- After-action review report is required within 14 days of deactivation for accreditation compliance
**State Machine.** `standby` → `activated` → `escalated` | `de-escalating` → `deactivated` → `after-action-review` → `closed`.
**Key Endpoints.** `activateHICS`, `assignHICSRole`, `activateSurgePlan`, `createMCITriageTag`, `updateMCITriageTag`, `logIncidentEvent`, `deactivateHICS`, `generateAfterActionReport`.
**FHIR Mapping.** domain-native.

---

### Research, IRB & Clinical Trials

**Purpose.** Manages Institutional Review Board submissions, protocol tracking, patient consent for research participation, and regulatory compliance for clinical trials and investigator-initiated studies.
**Key Entities.** IRBSubmission, ResearchProtocol, SubjectEnrollment, ResearchConsent, AdverseEventReport.
**Key Workflows.**
- Investigator submits IRB application with protocol, consent forms, and supporting documents
- IRB reviews for ethics, risk-benefit, and consent adequacy; approved with conditions or full approval granted
- Patient identified as eligible; study coordinator obtains informed consent; patient enrolled in protocol
- Protocol amendments and continuing reviews submitted to IRB at defined intervals (typically annually)
- Unanticipated problems and serious adverse events reported to IRB within regulatory timeframes
**Key Business Rules.**
- No human subject research may begin before written IRB approval is in hand; verbal approval is insufficient
- Informed consent must be obtained before any research-specific procedure or data collection; clinical care may not be conditioned on research participation
- FDA-regulated trials (IND/IDE) require additional sponsor reporting; IRB approval alone does not satisfy FDA requirements
- Continuing review must be submitted before approval expiration; lapsed approval requires cessation of enrollment until renewal
- Research records must be retained for minimum 3 years after study completion (FDA trials: 2 years after marketing application approval)
**State Machine.** `draft` → `submitted` → `under-irb-review` → `approved` | `approved-with-conditions` | `disapproved`; `approved` → `enrolling` → `analysis` → `closed`; any state → `suspended`.
**Key Endpoints.** `submitIRBApplication`, `recordIRBDecision`, `enrollResearchSubject`, `captureResearchConsent`, `submitProtocolAmendment`, `reportUnanticipatedProblem`, `submitContinuingReview`, `getEnrollmentStatusByProtocol`.
**FHIR Mapping.** ResearchStudy, ResearchSubject, Consent.

---

### Referral Management & Network

**Purpose.** Manages inbound and outbound referrals, tracks referral status and appointment completion, and monitors network leakage to preferred provider organizations.
**Key Entities.** ReferralOrder, ReferralStatus, PreferredProviderNetwork, LeakageEvent, ReferralOutcome.
**Key Workflows.**
- Physician creates outbound referral order specifying specialty, urgency, and clinical summary
- Referral transmitted to receiving provider (fax, Direct secure messaging, or portal); tracking number assigned
- Receiving provider confirms receipt; appointment scheduled; completion status reported back
- Inbound referrals received and triaged; patient scheduled with appropriate specialist
- Leakage report identifies referrals sent to out-of-network providers; reviewed by network management
**Key Business Rules.**
- Urgent referrals (24-hour) must be acknowledged by receiving provider within 4 hours; failure triggers escalation
- Clinical summary attached to referral must be the minimum-necessary PHI for the referral purpose
- Referral loop closure: ordering provider must receive outcome note within 30 days; missing outcomes flagged
- Preferred network compliance tracked per ordering physician for value-based contract performance
- Self-referral restrictions (Stark Law) must be enforced; system flags referring provider with financial interest in receiving entity
**State Machine.** `ordered` → `transmitted` → `acknowledged` → `appointment-scheduled` → `appointment-completed` → `outcome-received` → `closed`; any state → `cancelled`.
**Key Endpoints.** `createReferralOrder`, `transmitReferral`, `acknowledgeReferral`, `scheduleReferralAppointment`, `recordReferralOutcome`, `closeReferral`, `getLeakageReport`, `getReferralCompletionRate`.
**FHIR Mapping.** ServiceRequest, Task.

---

### Population Health & SDOH

**Purpose.** Identifies high-risk patient cohorts, screens for social determinants of health (SDOH), assigns risk scores, tracks care gaps, and coordinates community health navigation and outreach.
**Key Entities.** PopulationCohort, RiskScore, SDOHAssessment, CareGap, OutreachCampaign, NavigationReferral.
**Key Workflows.**
- Population data aggregated from clinical, claims, and ADT sources; cohorts defined by condition, utilization, or risk tier
- Risk score calculated using composite algorithm (clinical, utilization, social factors); assigned to each attributed patient
- SDOH screening (PRAPARE or AHC-HRSN tool) administered at defined touchpoints; results recorded as structured observations
- Positive SDOH screen (food insecurity, housing instability, transportation) generates NavigationReferral to community health worker or social services
- Care gaps identified from measure logic (overdue screenings, missed follow-ups); outreach campaign assigned to close gaps
**Key Business Rules.**
- SDOH screening tools (PRAPARE, AHC-HRSN) must be administered verbatim; ad-hoc modifications invalidate standardized scoring
- Positive SDOH screen mandates NavigationReferral creation within 24 hours; referral may not be auto-closed without documented contact attempt
- Risk scores are point-in-time; recalculation frequency must be defined per cohort (minimum quarterly for chronic condition cohorts)
- Population health data may be used for care management; it may not be used for underwriting or coverage decisions (ACA §2705)
- Care gap closure requires documented clinical evidence; administrative closure without evidence is a quality measure violation
**Key Endpoints.** `defineCohort`, `calculateRiskScore`, `conductSDOHAssessment`, `createNavigationReferral`, `identifyCareGaps`, `closeCareGap`, `createOutreachCampaign`, `getPopulationRiskSummary`.
**FHIR Mapping.** Patient, Observation, ServiceRequest.

---

### Value-Based Care / ACO / Bundled Payments

**Purpose.** Manages attributed patient populations, tracks bundle episode performance, calculates shared savings and losses, and supports payer reporting for ACO, BPCI, and other alternative payment models.
**Key Entities.** ACOMember, BundleEpisode, PerformanceReport, SharedSavingsCalc, AttributionRecord.
**Key Workflows.**
- Attribution run performed on payer-supplied data; patients assigned to ACO by plurality-of-care rules
- Bundle triggered by anchor claim (e.g., hip replacement DRG); episode window defined by contract (typically 90 days post-discharge)
- All claims within the episode window attributed to the bundle; total episode spend calculated
- Performance benchmarks compared to target price; variance analyzed by care category (acute, post-acute, readmission)
- Shared savings or shared loss calculated at reconciliation period; distributed to participating providers per contract terms
**Key Business Rules.**
- Attribution methodology is payer-defined; the system implements, not overrides, payer attribution rules
- Bundle anchor claim triggers episode; retroactive anchor attribution is not permitted after the episode window closes
- Readmissions within the episode window are attributed to the originating bundle regardless of readmitting facility
- Shared savings distribution to physicians requires compliance review for Stark Law exception qualification
- Performance report data submitted to CMS or commercial payer must match internal calculation; reconciliation discrepancies escalated to finance and legal
**Key Endpoints.** `runAttributionCycle`, `createBundleEpisode`, `addClaimToEpisode`, `calculateEpisodeSpend`, `compareToTargetPrice`, `calculateSharedSavings`, `generatePerformanceReport`, `getACOMemberList`.
**FHIR Mapping.** Coverage, ClaimResponse.

---

### Patient Experience & Grievance Management

**Purpose.** Manages patient satisfaction measurement through standardized survey instruments and formal complaint/grievance resolution workflows from intake through closure. Ensures regulatory compliance with acknowledgement and resolution timeframes.
**Key Entities.** SatisfactionSurvey, SurveyResponse, Grievance, GrievanceInvestigation, ResolutionLetter, ExperienceRound.
**Key Workflows.**
- Post-discharge survey triggered automatically by discharge event; responses captured and scored by unit and service line
- Real-time experience rounding data collected by nurses and leaders during inpatient stays using structured frameworks
- Formal grievance intake: patient or family submits complaint; grievance officer assigned and acknowledgement letter issued within regulatory timeframe
- Grievance investigation conducted; resolution letter issued with findings and corrective actions taken
- Unresolved or high-severity grievances escalated to Patient Relations Director and, if required, to the relevant accreditation body
**Key Business Rules.**
- Grievance acknowledgement letter must be issued within 7 days of receipt per CMS Conditions of Participation and equivalent international standards
- Resolution letter must be issued within 30 days of grievance receipt; extensions require documented justification and patient notification
- Survey response data must be attributable to unit, service line, and attending for dashboard reporting
- A grievance must be distinguished from a complaint: complaints resolved at the point of care during the visit do not require the formal grievance workflow
- Grievance records must be retained per regulatory retention schedules and available for accreditation survey
**State Machine.** `submitted` → `acknowledged` → `under-investigation` → `resolved` | `escalated` | `withdrawn`
**Key Endpoints.** `createGrievance`, `acknowledgeGrievance`, `assignGrievanceOfficer`, `updateInvestigationStatus`, `resolveGrievance`, `escalateGrievance`, `listGrievancesByStatus`, `getSatisfactionDashboard`.
**FHIR Mapping.** Observation (survey responses), Communication, Task; grievance and rounding entities are domain-native.

---

### Interpreter & Language Access Services

**Purpose.** Manages the provision of qualified language interpretation services to patients and families with limited proficiency in the facility's primary language, across in-person, telephone, and video modalities. Ensures auditable compliance with applicable language access mandates.
**Key Entities.** InterpreterRequest, Interpreter, InterpretationSession, LanguagePreference, VendorRouting, CostCenterCharge.
**Key Workflows.**
- Language preference recorded at registration and linked to the patient demographic record
- Clinician or nurse creates an interpreter request specifying target language, preferred modality, and urgency level
- On-site interpreter assigned if available; request routed to phone or video interpretation vendor if not
- Session logged with start time, end time, interpreter identifier, modality used, and associated encounter reference
- Completed session cost charged to the responsible hospital cost center; not billed to patient
**Key Business Rules.**
- Interpreter services must be provided at no cost to patients with limited language proficiency per applicable federal, national, and accreditation requirements
- Every interpreter session must be linked to an encounter to support compliance audits
- Untrained bilingual staff may not substitute for qualified interpreters for clinical discussions except in documented emergencies
- Video remote interpreting vendors must meet minimum response-time SLAs defined in the vendor contract
- Session records must be retained for the full regulatory retention period applicable to the associated encounter
**State Machine.** `requested` → `assigned` → `in-progress` → `completed` | `cancelled`
**Key Endpoints.** `createInterpreterRequest`, `assignInterpreter`, `startSession`, `endSession`, `cancelInterpreterRequest`, `listSessionsByEncounter`, `getInterpreterAvailability`, `logVendorRouting`.
**FHIR Mapping.** Communication, Appointment (scheduled in-person sessions), Task; session and cost-center entities are domain-native.

---

### Pastoral, Chaplaincy & Social Work Services

**Purpose.** Manages operational scheduling and documentation of non-clinical support services including spiritual care chaplaincy visits and medical social work casework covering discharge planning, social determinants of health screening, and community referrals.
**Key Entities.** ChaplaincyReferral, ChaplaincyVisit, Chaplain, SocialWorkReferral, SocialWorkCase, SdohScreening, CommunityReferral.
**Key Workflows.**
- Chaplaincy referral created by clinician, staff, patient, or family; chaplain assigned based on faith tradition or availability; visit documented on completion
- Social work referral created for discharge planning, financial counseling, domestic violence screening, substance use referral, or housing instability; social worker assigned
- Social work case manages multi-visit casework with action items, tracked referrals to community services, and SDOH screening instruments
- Bereavement follow-up workflow initiated for family outreach after a patient death
- Case closure or transfer documented when social work goals are met or patient is transferred to another facility
**Key Business Rules.**
- Chaplaincy visit notes are confidential pastoral records; access controls must reflect jurisdictional rules on spiritual care documentation and separation from the clinical chart
- SDOH screening results are structured Observations linkable to the patient record and reportable for population health programs
- Social work referrals must not duplicate palliative care coordination workflows; this domain handles operational triage and scheduling only
- Community referral outcome tracking is required for program quality reporting
- A ChaplaincyVisit requires a linked referral; ad-hoc visits are documented as walk-in referrals before the visit record is created
**State Machine.** ChaplaincyVisit: `requested` → `assigned` → `completed` | `declined`. SocialWorkCase: `opened` → `active` → `closed` | `transferred`.
**Key Endpoints.** `createChaplaincyReferral`, `assignChaplain`, `completeChaplaincyVisit`, `createSocialWorkReferral`, `openSocialWorkCase`, `recordSdohScreening`, `createCommunityReferral`, `closeSocialWorkCase`.
**FHIR Mapping.** ServiceRequest, Communication, Observation (SDOH screening); chaplaincy visit note is domain-native.

---

### Engineering Work Orders & Preventive Maintenance

**Purpose.** Manages facility maintenance work orders for buildings and infrastructure and scheduled preventive maintenance tasks generated from the facility asset registry, ensuring regulatory compliance for fire life safety and critical systems. Distinct from the Biomedical Equipment domain which governs clinical devices.
**Key Entities.** WorkOrder, FacilityAsset, MaintenanceTechnician, PreventiveMaintenanceSchedule, InspectionCertificate, MaterialUsage.
**Key Workflows.**
- Staff submits a facility issue work order specifying location, nature of problem, and priority; work order triaged and classified by trade
- Maintenance technician assigned based on trade skill and availability; work order progressed through in-progress to completion
- Technician records labor time and materials used on closure; requestor confirms resolution
- Preventive maintenance schedule generates recurring PM tasks from the asset registry for critical systems including fire suppression, medical gas outlets, emergency generators, and HVAC chillers
- Inspection certificates issued on completion of regulatory inspections tracked against asset and stored for accreditation survey readiness
**Key Business Rules.**
- Emergency priority work orders affecting patient care areas or life-safety systems must be assigned within the same shift
- Urgent priority work orders must be assigned within 24 hours; routine work orders scheduled within defined SLA windows
- PM tasks must not be overdue for any life-safety or Joint Commission / accreditation body-classified critical equipment
- Inspection certificates must be linked to the relevant asset and retained per regulatory retention schedules
- Work orders for medical gas systems require qualified technician credentials and dual sign-off on completion
**State Machine.** `submitted` → `triaged` → `assigned` → `in-progress` → `completed` | `cancelled`
**Key Endpoints.** `createWorkOrder`, `triageWorkOrder`, `assignTechnician`, `updateWorkOrderProgress`, `closeWorkOrder`, `listOverduePmTasks`, `recordInspectionCertificate`, `getAssetMaintenanceHistory`.
**FHIR Mapping.** domain-native.

---

### Biomedical & Hazardous Waste Management

**Purpose.** Manages the classification, containment, internal transport, and licensed contractor disposal of regulated medical and hazardous waste streams from point of generation through final disposal, with chain-of-custody documentation required for regulatory compliance.
**Key Entities.** WasteContainer, WasteCategory, TransportRequest, DisposalManifest, DisposalContractor, WasteWeight.
**Key Workflows.**
- Waste container opened in a generating unit; waste category assigned at creation (sharps, infectious, pathological, chemical, pharmaceutical, radioactive, cytotoxic)
- Container marked full by unit staff; internal transport request created to move container to central storage
- Licensed disposal contractor pickup scheduled; disposal manifest generated with container identifiers, weights, waste categories, and facility details
- Facility representative and contractor co-sign manifest at pickup; signed copy retained per regulatory requirements
- Weight and volume data recorded per container and per pickup for periodic regulatory reports
**Key Business Rules.**
- Waste containers must not exceed maximum fill line; overfill events must be logged as safety incidents
- Each waste category must be routed to a contractor licensed for that specific waste stream
- Disposal manifests are legal documents; electronic or wet signatures from both parties are required before container leaves the facility
- Radioactive waste transport and disposal must be coordinated with the Radiology or Nuclear Medicine domain and handled only by licensed radiation waste contractors
- Manifest records must be retained for the full period required by applicable environmental and health regulations
**State Machine.** `open` → `full` → `awaiting-pickup` → `picked-up` | `destroyed`
**Key Endpoints.** `openWasteContainer`, `markContainerFull`, `createTransportRequest`, `scheduleContractorPickup`, `generateDisposalManifest`, `signManifest`, `recordContainerWeight`, `listContainersByUnit`.
**FHIR Mapping.** domain-native.

---

### Committee & Board Management

**Purpose.** Manages the operational lifecycle of hospital governance and clinical committees including meeting scheduling, agenda and minutes management, action item tracking, conflict-of-interest disclosures, and vote recording for bodies such as the Medical Executive Committee, Pharmacy & Therapeutics Committee, Infection Control Committee, and Governing Board.
**Key Entities.** Committee, CommitteeMember, CommitteeMeeting, AgendaItem, MeetingMinutes, ActionItem, ConflictOfInterestDisclosure, MotionRecord.
**Key Workflows.**
- Agenda items submitted by members or staff; chair approves and publishes final agenda before meeting date
- Meeting convened; quorum verified; minutes recorded in real time or immediately post-meeting
- Motions introduced, discussed, and voted on; votes recorded with member-level breakdown and abstentions logged
- Minutes drafted, reviewed by secretary and chair, approved at subsequent meeting, and signed
- Action items assigned to responsible owners with due dates; status tracked to closure and reported at next meeting
**Key Business Rules.**
- Quorum must be verified and recorded before any vote is held; votes taken without quorum are invalid
- Conflict-of-interest disclosures must be on file for all voting members and updated annually; members with an active COI on a specific agenda item must recuse from that vote
- P&T formulary decisions (drug additions, deletions, restriction changes) must be recorded as structured decisions with an evidence summary and effective date
- Minutes must be reviewed and formally approved by committee vote; unapproved draft minutes are not official records
- All committee records must be retained per applicable medical staff bylaws and accreditation requirements
**State Machine.** `scheduled` → `in-progress` → `adjourned` → `minutes-draft` → `minutes-approved`
**Key Endpoints.** `createCommitteeMeeting`, `submitAgendaItem`, `publishAgenda`, `recordMotion`, `recordVote`, `draftMinutes`, `approveMinutes`, `createActionItem`, `closeActionItem`, `submitCoiDisclosure`.
**FHIR Mapping.** domain-native.

---

### Payer & Vendor Contract Management

**Purpose.** Manages the full lifecycle of payer contracts governing insurance reimbursement rates and coverage rules, and vendor or supplier contracts for equipment, services, and pharmaceuticals, including rate schedules, amendment tracking, and expiry alerting.
**Key Entities.** Contract, ContractParty, RateSchedule, ContractAmendment, ExpiryAlert, SlaTracking, ContractDocument.
**Key Workflows.**
- Contract document uploaded with metadata captured: parties, effective dates, term length, auto-renewal rules, and rate schedules
- Rate schedules and fee carve-outs linked to the parent payer contract and versioned on amendment
- Expiry alert engine generates notifications at 90, 60, and 30 days before contract expiration; renewal workflow triggered at configured threshold
- Amendments negotiated and uploaded; each amendment linked to parent contract with version history preserved
- Contract SLA performance monitored: vendor delivery timelines and payer claim payment timelines tracked against contract commitments
**Key Business Rules.**
- Every active payer contract must have at least one rate schedule; encounters cannot be adjudicated against an expired or unexecuted contract
- Amendments do not replace the parent contract; they are additive and must reference specific clauses modified
- Auto-renewal contracts must be flagged for review before the opt-out deadline; system alerts must precede the deadline by the configured lead time
- Contract documents must include executed signatures before status transitions to `active`
- Terminated contracts must be retained with full amendment history for audit and dispute resolution purposes
**State Machine.** `draft` → `under-review` → `executed` → `active` → `expired` | `terminated` | `renewed`
**Key Endpoints.** `createContract`, `uploadContractDocument`, `linkRateSchedule`, `createAmendment`, `executeContract`, `renewContract`, `terminateContract`, `listExpiringContracts`, `getSlaComplianceSummary`.
**FHIR Mapping.** domain-native.

---

### Learning Management System & Mandatory Training

**Purpose.** Manages employee mandatory training curricula, compliance certification tracking, and clinical skill checkoff verification to ensure all staff maintain required competencies for their role and meet regulatory and accreditation education requirements.
**Key Entities.** Course, CourseAssignment, CourseCompletion, Certification, CertificationRenewal, SkillCheckoff, TrainingCurriculum.
**Key Workflows.**
- Role-based training curricula defined; new hire onboarding curricula assigned automatically on hire; annual renewal assignments generated on expiry schedule
- Employee completes online or in-person course; completion recorded with quiz score and certificate generated if passing threshold met
- Certification records maintained for BLS, ACLS, PALS, fire safety, data privacy, infection control, and department-specific requirements; renewal dates tracked and alerts issued
- Hands-on skill checkoffs conducted by qualified assessors; pass or fail recorded with assessor signature and date
- Compliance dashboard reports completion rates by department, by role, and lists staff with expiring or lapsed certifications
**Key Business Rules.**
- Mandatory courses must be completed by the defined deadline for the employee's role; non-completion is escalated to the department manager
- Certifications with hard regulatory or accreditation requirements (BLS, fire safety) must not be allowed to lapse; automated alerts issued 60 and 30 days before expiry
- Skill checkoff failure requires documented remediation plan and re-assessment before the employee may perform the skill independently
- Course waivers require documented justification and manager approval; waived assignments must still appear in compliance reporting
- Training records must be retained for the full duration of employment plus any applicable post-termination retention period
**State Machine.** `assigned` → `in-progress` → `completed` | `expired` | `waived`
**Key Endpoints.** `assignCourse`, `recordCourseCompletion`, `issueCertificate`, `renewCertification`, `scheduleSkillCheckoff`, `recordSkillCheckoffResult`, `getStaffComplianceSummary`, `listExpiringCertifications`.
**FHIR Mapping.** domain-native.

---

### GME & CME Tracking

**Purpose.** Manages graduate medical education duty-hour logging and compliance monitoring for residents and fellows, rotation scheduling across clinical services, bidirectional training evaluations, and continuing medical education credit tracking for licensed practitioners against licensure renewal requirements.
**Key Entities.** Trainee, DutyHourEntry, DutyHourPeriod, RotationAssignment, TrainingEvaluation, CmeActivity, CmeCredit, CaseLog.
**Key Workflows.**
- Residents and fellows log duty-hour entries; weekly totals calculated and checked against applicable regulatory limits including maximum weekly hours and maximum single-shift duration
- Rotation assignments published per block period across participating clinical services; schedule changes tracked with approval workflow
- Attendings complete structured evaluations of trainees at end of rotation; trainees complete evaluations of attendings and training programs on a defined schedule
- Physicians log completed accredited CME activities; credits accrued against specialty board and medical license renewal requirements with expiry tracking
- Program directors verify cumulative case logs and completed rotations against specialty-specific board eligibility requirements
**Key Business Rules.**
- Duty-hour violations must be flagged immediately and reported to the program director; aggregate violation trends are reported to the GME committee
- Evaluations are bidirectional and mandatory; incomplete evaluations at the end of a rotation block trigger escalation to program coordinator
- CME credits must be from accredited providers; credit type (AMA PRA Category 1 or equivalent) must be recorded and matched to license renewal requirements
- Rotation schedules must be published at least one block period in advance to allow adequate planning
- All training records must be retained for the period required by the applicable accreditation body and medical licensing authority
**State Machine.** `open` → `closed` | `violation-flagged`
**Key Endpoints.** `logDutyHours`, `closeDutyHourPeriod`, `createRotationAssignment`, `publishRotationSchedule`, `submitTraineeEvaluation`, `submitProgramEvaluation`, `logCmeActivity`, `getCmeTranscript`, `getDutyHourComplianceReport`.
**FHIR Mapping.** Practitioner, PractitionerRole; duty-hour, rotation, evaluation, and CME entities are domain-native.

---

### Medical Arts Building & Affiliated Clinic Tenancy

**Purpose.** Manages the relationship between a hospital and tenant physician practices that lease clinic space in an affiliated building, sharing the hospital's Master Patient Index and ancillary services while maintaining separate billing entities and scoped access controls.
**Key Entities.** TenantOrganization, TenantLease, TenantEncounter, AncillaryOrderRouting, RevenuShareReport, TenantAccessPolicy, LeaseChargeSchedule.
**Key Workflows.**
- Tenant clinic registered with lease terms, shared service agreements, and ancillary service entitlements defined
- Patients registered under the shared hospital MPI; tenant encounters created under the tenant organization with a `tenant-encounter` flag to disambiguate billing entity
- Tenant physician orders lab or imaging through hospital ancillaries; results returned to both hospital EMR and tenant clinic system; charge routed per the tenant contract (direct billing or revenue-share)
- Lease charges calculated from rent schedule, utility cost-sharing, and common area fee allocations; periodic statements generated for each tenant
- Revenue-share reports attribute shared ancillary revenue to tenants per contract terms for reconciliation and payment
**Key Business Rules.**
- Patient Master Patient Index is shared: a single patientId is used across hospital and tenant encounters; the Encounter serviceProvider field identifies the billing entity
- Tenant staff access must be scoped to their own patients only; cross-tenant patient data access is prohibited without explicit consent or emergency override
- Ancillary orders placed by tenant physicians must carry the tenant organization identifier for correct charge routing
- Lease and revenue-share records must be retained for the full period required by financial audit and contract dispute standards
- Tenant encounter records remain visible to hospital staff for care continuity per documented data-sharing agreement and patient consent
**State Machine.** `draft` → `active` → `expired` | `terminated`
**Key Endpoints.** `registerTenantOrganization`, `createTenantLease`, `createTenantEncounter`, `routeAncillaryOrder`, `returnAncillaryResult`, `generateLeaseStatement`, `generateRevenueShareReport`, `listTenantsByStatus`.
**FHIR Mapping.** Organization (tenant clinic), Encounter (with serviceProvider referencing tenant organization), Patient (shared MPI), ServiceRequest (shared ancillary orders).

---

### Vendor Representative & Implant Rep Access

**Purpose.** Manages credentialing, case coverage scheduling, and operating room access for medical device vendor representatives, with particular focus on implant representatives, ensuring auditable access control, intraoperative implant documentation, and conflict-of-interest compliance.
**Key Entities.** VendorRep, VendorRepCredential, CaseCoverageRequest, OrAccessBadge, ImplantRecord, CoiDisclosure, GiftReportEntry.
**Key Workflows.**
- Vendor rep submits credentialing application with required documentation: background check clearance, manufacturer authorization letter, training certificates, vaccination records, and certificate of insurance
- Surgical team creates a case coverage request linking the rep to a specific OR case date, room, and implant system; rep confirmed and notified
- Credentialed rep receives a time-limited access badge scoped to the specific case; badge access expires automatically after case completion
- Rep documents implants placed intraoperatively: lot number, REF number, and UDI recorded and transmitted to the implant traceability log and patient record
- Conflict-of-interest disclosures reviewed at credentialing and annually; gift and meal reports logged per Sunshine Act or equivalent institutional policy
**Key Business Rules.**
- A vendor rep must hold an active approved credential before a case coverage request can be confirmed or OR access granted
- OR access badges must be time-scoped to the specific case; unlimited or standing OR access credentials are not permitted
- Implant UDI documentation is mandatory for all implantable devices; missing UDI data must be flagged and resolved before the operative note is finalized
- Vendor reps may not be present in a clinical decision-making role; their access is limited to technical support for their specific device
- Gift and meal reporting thresholds and retention periods must comply with the applicable regulatory framework in the operating jurisdiction
**State Machine.** VendorRepCredential: `submitted` → `under-review` → `approved` → `active` → `suspended` | `expired`
**Key Endpoints.** `submitRepCredentialApplication`, `approveRepCredential`, `createCaseCoverageRequest`, `issueOrAccessBadge`, `revokeOrAccessBadge`, `recordImplantUsage`, `submitCoiDisclosure`, `logGiftReport`, `listActiveCredentialsByVendor`.
**FHIR Mapping.** Practitioner (vendor rep record), Device (implant UDI), Procedure (implant use reference); credentialing, badge, and COI entities are domain-native.

---

## Category 4 — Integration & Interoperability (28 Domains)

These domains describe integration adapters and standards interfaces. Generic domains are universal. Localization adapters (prefixed `PH:`) contain all Philippine-specific regulatory logic. NO Philippine logic should appear in Core or Clinical domains — it lives exclusively here.

---

### HL7 v2 Interface Engine

**Purpose.** Receives and transmits HL7 v2 messages over MLLP channels, routing ADT, ORM, ORU, SIU, and DFT events between internal modules and external systems. Acts as a bridge adapter between HL7 v2 external partners and the internal FHIR-aligned data model.
**Key Entities.** InterfaceChannel, Message, Acknowledgement, ErrorQueue, RetryPolicy.
**Key Workflows.**
- Inbound message receipt over MLLP; parse, validate, route to target module.
- Outbound trigger events (ADT^A01 on admission, ORU^R01 on result, DFT^P03 on charge).
- Failed message capture into ErrorQueue with configurable retry policy.
- Dead-letter escalation to ops alert queue after max retries exceeded.
- Channel health monitoring with sequence-gap detection.
**Key Business Rules.**
- All HL7 v2 channels use MLLP transport by default; TLS-wrapped for external endpoints.
- Message sequence numbers (MSH-13) must be monotonically increasing per channel; out-of-order triggers alert.
- Failed messages enter ErrorQueue and are retried per channel RetryPolicy (default: 3x, exponential backoff); ops notified on dead-letter.
- Acknowledgement mode AA (application accept) required before message is considered delivered.
- Channel configurations are version-pinned; upgrades require explicit re-validation.
**State Machine.**
`received → parsing → validated → routed → acknowledged | error-queue → retrying → dead-letter`
**Key Endpoints.** `createChannel`, `sendMessage`, `receiveMessage`, `acknowledgeMessage`, `requeueMessage`, `listErrorQueue`, `getChannelStatus`.
**FHIR Mapping.** domain-native (bridge adapter).

---

### FHIR R4 API Gateway

**Purpose.** Exposes a standards-compliant FHIR R4 REST API surface with SMART-on-FHIR app launch, OAuth2 authorization, and Bulk Data `$export` for authorized consumers and third-party applications.
**Key Entities.** FHIREndpoint, SMARTApp, BulkDataJob, CapabilityStatement, OAuthToken.
**Key Workflows.**
- SMART-on-FHIR EHR launch and standalone launch sequences with scope negotiation.
- OAuth2 bearer token issuance, refresh, and revocation.
- FHIR CRUD operations over authorized resource scopes.
- Bulk Data `$export` job creation, status polling, and ndjson file retrieval.
- CapabilityStatement `/metadata` generation reflecting enabled resources and operations.
**Key Business Rules.**
- All read operations require at minimum patient-level scope (`patient/*.read`); system-level scope requires explicit admin approval.
- Third-party apps must be pre-registered with an allowed scope list; requests outside registered scopes are rejected with 403.
- `$export` jobs are scoped to the authorized organization; cross-organization export requires explicit TEFCA/Carequality agreement.
- Access tokens expire after 1 hour; refresh tokens expire after 90 days.
- Every API call is logged in the Audit Log domain with actor, resource, action, and timestamp.
**State Machine.** `app-registered → launch-requested → token-issued → token-active → token-revoked | token-expired`
**Key Endpoints.** `launchSMARTApp`, `issueToken`, `refreshToken`, `revokeToken`, `readResource`, `searchResource`, `createBulkExportJob`, `getBulkExportStatus`.
**FHIR Mapping.** All R4 resources (gateway).

---

### CCDA / C-CDA Document Exchange

**Purpose.** Generates and parses Consolidated Clinical Document Architecture (C-CDA) documents for referral, transitions of care, and patient record portability in environments requiring document-level interoperability.
**Key Entities.** CCDADocument, DocumentTemplate, RecipientEndpoint, DocumentTransmission, ParseResult.
**Key Workflows.**
- Generate C-CDA Continuity of Care Document (CCD) from patient encounter data on demand or at discharge.
- Generate Referral Note and Discharge Summary templates from structured EMR data.
- Transmit documents via Direct Messaging or XDS to recipient endpoints.
- Ingest and parse inbound C-CDA documents; map to internal FHIR resources.
- Reconcile inbound medications, allergies, and problem lists against active patient record.
**Key Business Rules.**
- Generated documents must conform to HL7 C-CDA R2.1 and pass Schematron validation before transmission.
- Inbound documents that fail parsing are quarantined with a ParseResult error record; clinical staff notified before any data import.
- Human reconciliation is required before inbound data merges into the live patient record.
- Documents are immutable once transmitted; corrections require a new document with relationship reference to original.
- Document access is logged per RA 10173 / HIPAA audit requirements.
**State Machine.** `draft → validated → transmitted → delivered | failed`
**Key Endpoints.** `generateCCDA`, `validateCCDA`, `transmitDocument`, `receiveDocument`, `parseCCDA`, `reconcileImportedData`, `getDocumentStatus`.
**FHIR Mapping.** DocumentReference, Composition, Bundle.

---

### DICOM & Imaging Interop

**Purpose.** Integrates with radiology modalities and PACS via DICOM protocols, delivering Modality Worklist push on order creation and browser-based image retrieval via DICOMweb.
**Key Entities.** MWLEntry, DICOMStudy, DICOMSeries, DICOMInstance, PACSNode.
**Key Workflows.**
- Push Modality Worklist (MWL) entry to configured modality on imaging order creation.
- Receive completed studies via C-STORE from modality or PACS.
- Query studies and retrieve images via DICOMweb (QIDO-RS / WADO-RS / STOW-RS).
- Associate received studies with originating order and encounter.
- Notify ordering physician when study images are available for review.
**Key Business Rules.**
- MWL entry must be created before patient arrives at modality; late orders trigger alert to radiology.
- Incoming C-STORE objects are validated against expected Study Instance UID; mismatches quarantined.
- DICOMweb endpoints require bearer token matching the patient's authorized encounter; unauthorized requests return 403.
- Study deletion requires dual authorization (radiologist + admin) and is audit-logged as irreversible.
- Modality AE titles are registered in PACSNode configuration; unregistered callers are rejected.
**State Machine.** `ordered → worklist-sent → images-received → report-pending → reported`
**Key Endpoints.** `createMWLEntry`, `updateMWLEntry`, `storeDICOMInstance`, `queryStudies`, `retrieveInstance`, `retrieveSeries`, `associateStudyToOrder`, `getStudyStatus`.
**FHIR Mapping.** ImagingStudy.

---

### IHE Profiles

**Purpose.** Implements IHE integration profiles for cross-institutional document sharing (XDS.b), patient identity cross-referencing (PIX/PDQ), and cross-community query (XCA) to support health information network participation.
**Key Entities.** Document, PatientIdentifier, CrossCommunityQuery, AffectedDocumentSet, SubmissionSet.
**Key Workflows.**
- Register and retrieve documents via XDS.b Document Registry and Repository.
- Cross-reference patient identifiers across domains via PIX Manager; query patient demographics via PDQ Supplier.
- Execute cross-community queries via XCA Responding Gateway for federated record retrieval.
- Maintain document metadata (SubmissionSet, Folder) per IHE ITI specifications.
- Subscribe to patient identity feed updates via PIX Feed transaction.
**Key Business Rules.**
- XDS submissions require conformant metadata including classCode, typeCode, and confidentialityCode; incomplete metadata is rejected at Registry.
- PIX cross-referencing requires patient identity assurance level to be declared; assurance level below threshold triggers manual reconciliation.
- XCA queries are authorized per data sharing agreements; queries without active agreement return empty result set.
- All document registrations are audit-logged per IHE ATNA (Audit Trail and Node Authentication) profile.
- Documents retrieved via XCA are read-only imports; local editing requires explicit reconciliation workflow.
**Key Endpoints.** `registerDocument`, `retrieveDocument`, `queryRegistry`, `submitDocumentSet`, `crossReferencePatient`, `queryPatientDemographics`, `executeCrossCommunityQuery`.
**FHIR Mapping.** DocumentReference, Patient.

---

### Payer EDI

**Purpose.** Handles HIPAA-compliant X12 EDI transaction processing for eligibility inquiry (270/271), medical claims (837I/837P), remittance advice (835), and prior authorization (278) with commercial payers and clearinghouses.
**Key Entities.** EligibilityRequest, EligibilityResponse, Claim837, RemittanceAdvice835, PriorAuthRequest278.
**Key Workflows.**
- Submit 270 eligibility inquiry to payer; parse 271 response and update Coverage record.
- Generate and transmit 837I (inpatient) or 837P (outpatient) claim to clearinghouse.
- Receive and post 835 remittance advice; auto-post payments and adjustments to patient account.
- Submit 278 prior authorization request; track status through approval/denial lifecycle.
- Reconcile 835 payments against outstanding claim balances.
**Key Business Rules.**
- All EDI loops and segments must comply with HIPAA TR3 implementation guides for each transaction set.
- 837I is used exclusively for inpatient hospital claims; 837P for outpatient and professional claims.
- Claims must be submitted within payer-specified timely filing limits (default: 90 days from date of service).
- 835 auto-posting is blocked for adjustments exceeding configurable threshold; requires billing staff review.
- ERA/EFT enrollment must be active for a payer before 835 auto-posting is enabled.
**State Machine.** `draft → validated → transmitted → acknowledged → adjudicated → paid | denied | adjusted`
**Key Endpoints.** `submitEligibilityInquiry`, `generateClaim`, `submitClaim`, `postRemittance`, `submitPriorAuth`, `getPriorAuthStatus`, `reconcilePayment`, `getClaimStatus`.
**FHIR Mapping.** CoverageEligibilityRequest, CoverageEligibilityResponse, Claim, ClaimResponse, PaymentReconciliation.

---

### ePrescribing & EPCS / PDMP

**Purpose.** Transmits electronic prescriptions to pharmacies via NCPDP SCRIPT standard and integrates with Prescription Drug Monitoring Programs (PDMP) for controlled substance dispensing history checks.
**Key Entities.** ElectronicPrescription, PharmacyDirectory, PDMPQuery, PDMPResponse, EPCSCredential.
**Key Workflows.**
- Route new prescription to patient's preferred pharmacy via NCPDP SCRIPT NewRx transaction.
- Receive pharmacy RxFill notification and update prescription status.
- Query PDMP before prescribing Schedule II–V controlled substances; surface patient dispensing history.
- EPCS two-factor identity proofing and logical access control for signing controlled substance prescriptions.
- Cancel or change prescription via CancelRx / ChangeRx transactions.
**Key Business Rules.**
- PDMP query is mandatory before prescribing any Schedule II controlled substance; prescriber must acknowledge results.
- EPCS requires identity proofing to DEA audit standards; EPCS credential must be active and not expired.
- Prescriptions for controlled substances require two-factor authentication at signing; biometric or hardware token satisfies requirement.
- Pharmacy must be registered in PharmacyDirectory with valid NCPDP provider ID before routing is allowed.
- Prescription cancellation must be transmitted to pharmacy if not yet dispensed; cancelled prescriptions are audit-logged.
**State Machine.** `drafted → signed → transmitted → received-by-pharmacy → dispensed | cancelled | changed`
**Key Endpoints.** `sendNewRx`, `cancelRx`, `changeRx`, `queryPDMP`, `acknowledgePDMPResults`, `validateEPCSCredential`, `getPharmacyDirectory`, `getRxStatus`.
**FHIR Mapping.** MedicationRequest, MedicationDispense.

---

### Public Health Reporting

**Purpose.** Automates submission of reportable conditions, immunization records, syndromic surveillance data, and cancer registry notifications to public health authorities per jurisdiction-mandated schedules and triggers.
**Key Entities.** ReportableCondition, IISRecord, ELRMessage, SyndromicSurveillanceCase, CancerRegistryReport.
**Key Workflows.**
- Detect reportable condition trigger on diagnosis or lab result; generate and route case report to jurisdiction.
- Transmit immunization records to Immunization Information System (IIS) via HL7 v2 VXU.
- Send Electronic Lab Reporting (ELR) messages to public health lab on positive notifiable results.
- Submit syndromic surveillance encounter data (chief complaint, discharge diagnosis, disposition) per PHIN VADS specifications.
- Generate and transmit cancer registry abstracts for required malignancy diagnoses.
**Key Business Rules.**
- Reportable condition rules are configurable per jurisdiction; new condition codes are activated without code deployment.
- IIS immunization records must include valid CVX and MVX codes; invalid codes are rejected before transmission.
- ELR messages must be transmitted within jurisdiction-mandated timeframe (default: 24 hours for urgent notifiable diseases).
- Syndromic data submissions must be de-identified per jurisdiction's data use agreement before transmission.
- Failed public health submissions are logged and surfaced to infection control / compliance staff; they are never silently dropped.
**Key Endpoints.** `detectReportableTrigger`, `submitCaseReport`, `sendImmunizationRecord`, `sendELRMessage`, `submitSyndromicData`, `submitCancerRegistryAbstract`, `getSubmissionStatus`.
**FHIR Mapping.** MeasureReport, Immunization, DiagnosticReport, Observation, Condition.

---

### Medical Device & IoT Integration

**Purpose.** Ingests vital sign and waveform data from bedside monitors, infusion pumps, ventilators, and other connected medical devices; maps readings to FHIR Observations and surfaces alerts on clinical threshold violations.
**Key Entities.** DeviceRegistration, DeviceReading, VitalObservation, DeviceAlert, DeviceCalibrationRecord.
**Key Workflows.**
- Register and associate medical device with patient bed/encounter via unique device identifier.
- Receive continuous or interval device data streams; transform to FHIR Observation resources.
- Evaluate incoming readings against configurable clinical alert thresholds; trigger nurse notification on breach.
- Archive waveform data with encounter linkage for retrospective review.
- Track device calibration and maintenance schedule; alert biomedical engineering on overdue calibration.
**Key Business Rules.**
- Device must be associated with an active encounter before readings are accepted; orphaned readings are quarantined.
- Alert thresholds are configured per device type and care setting (ICU vs general ward); changes require authorized clinician approval.
- Device readings are immutable once written; corrections require a new Observation with derivedFrom reference to original.
- Calibration lapse blocks device from generating new clinical observations; biomedical alert triggered.
- Device identifiers must match an entry in the DeviceRegistration registry; unregistered device data is rejected with audit log entry.
**State Machine.** `device-registered → associated-to-encounter → streaming → alert-triggered | streaming-ended → encounter-closed`
**Key Endpoints.** `registerDevice`, `associateDeviceToEncounter`, `ingestDeviceReading`, `evaluateAlertThresholds`, `acknowledgeDeviceAlert`, `getDeviceReadings`, `logCalibration`.
**FHIR Mapping.** Device, Observation, DeviceMetric.

---

### Health Information Exchange (HIE) / Carequality / TEFCA

**Purpose.** Connects the system to national and regional health information exchange networks (Carequality, TEFCA, CommonWell) to enable authorized query and retrieve of external patient records at the point of care.
**Key Entities.** HIEParticipant, PatientMatch, ExternalRecord, QueryAudit, DataSharingAgreement.
**Key Workflows.**
- Query national network for patient records using demographic matching at admission or care transitions.
- Retrieve external clinical documents (C-CDA, FHIR resources) from responding organizations.
- Import and reconcile external records into the active encounter with clinician review.
- Respond to inbound queries from other network participants per TEFCA QHIN obligations.
- Manage DataSharingAgreements per network framework requirements.
**Key Business Rules.**
- Patient query requires explicit treatment-purpose justification; queries are audit-logged with purpose of use code.
- Patient matching confidence below threshold (configurable, default 90%) requires manual identity confirmation before record retrieval.
- Imported external records are marked as external-source and read-only until clinician explicitly reconciles data.
- Responding to inbound queries requires patient to have an active consent record permitting HIE sharing.
- All network transactions are logged per IHE ATNA and are retained for the jurisdiction-mandated audit period.
**Key Endpoints.** `queryPatientRecords`, `retrieveExternalDocument`, `importExternalRecord`, `respondToInboundQuery`, `getPatientMatchResults`, `updateDataSharingAgreement`, `getQueryAuditLog`.
**FHIR Mapping.** Patient, DocumentReference, Bundle, Consent.

---

### Identity Federation & Provider Directory Sync

**Purpose.** Federates user authentication across identity providers (SAML 2.0, OIDC) and synchronizes practitioner records with national and regional provider directories (NPI registry, state licensure databases).
**Key Entities.** FederatedIdentity, ProviderDirectoryRecord, LicenseRecord, CredentialSyncJob, NPIRecord.
**Key Workflows.**
- Federate login via SAML 2.0 or OIDC against enterprise identity provider; map external identity to internal user.
- Synchronize practitioner NPI records from CMS NPI registry on scheduled cadence.
- Validate active license status from state licensure database before allowing clinical documentation sign.
- Alert credentialing staff when provider license expiry is within configurable warning window.
- Push practitioner directory updates to connected HIE participant directories.
**Key Business Rules.**
- NPI sync failures do not block clinical operations but surface to credentialing staff dashboard.
- License expiry check is performed at every clinical document signing event; expired license blocks sign action.
- Federated identity mapping is one-to-one; duplicate mappings to the same internal user require IT resolution.
- Provider directory records sourced from authoritative registries take precedence over manually entered data.
- SAML/OIDC assertions must include role claim; missing role claim defaults to read-only access pending manual assignment.
**State Machine.** `identity-asserted → mapped → role-assigned → active | suspended | deprovisioned`
**Key Endpoints.** `federateLogin`, `mapExternalIdentity`, `syncNPIRecord`, `validateLicenseStatus`, `pushDirectoryUpdate`, `getCredentialSyncStatus`, `alertLicenseExpiry`.
**FHIR Mapping.** Practitioner, PractitionerRole, Organization.

---

### Event Streaming & Webhooks

**Purpose.** Provides FHIR Subscriptions-based event streaming and webhook delivery so that external systems and internal microservices receive real-time notifications on resource state changes; also exposes CDS Hooks integration points for clinical decision support.
**Key Entities.** Subscription, SubscriptionTopic, WebhookEndpoint, EventPayload, CDSHooksService.
**Key Workflows.**
- Register FHIR Subscription on a SubscriptionTopic (e.g., all Encounter admissions for a ward).
- Deliver event notifications via REST-hook, websocket, or messaging channel on matching resource change.
- Register CDS Hooks services; invoke hooks at configured EHR workflow points (order-select, patient-view).
- Retry failed webhook deliveries with exponential backoff; escalate to ops alert after max retries.
- Manage subscription lifecycle: pause, resume, expire, delete.
**Key Business Rules.**
- Webhook deliveries are retried 3 times with exponential backoff (1s, 4s, 16s); after third failure, WebhookEndpoint is flagged and ops queue is alerted.
- Subscription topics are versioned; breaking changes to topic shape require new topic version with migration period.
- CDS Hooks services must respond within 5 seconds; timeout results in hook response being skipped, not blocking clinical workflow.
- Every event delivery is logged with delivery status, HTTP response code, and latency.
- Subscriptions are scoped to authorized organization; cross-organization subscriptions require explicit data sharing agreement.
**State Machine.** `subscription-registered → active → triggered → delivered | failed → retrying → dead-letter | paused | expired`
**Key Endpoints.** `createSubscription`, `updateSubscription`, `deleteSubscription`, `listSubscriptionTopics`, `registerCDSHooksService`, `getDeliveryLog`, `retriggerDelivery`.
**FHIR Mapping.** Subscription, SubscriptionTopic (R4B/R5 backport).

---

### PH: PhilHealth Membership

**Purpose.** Verifies and records PhilHealth membership status and dependent relationships for patients at registration; gates insurance-covered services on confirmed eligibility.
**Key Entities.** PhilHealthMember, PINRecord, MemberEligibility, DependentRecord, MembershipType.
**Key Workflows.**
- Query PhilHealth eClaims API with patient PIN to verify membership type and active contribution status.
- Record eligibility result against encounter; flag ineligible patients for self-pay or alternative coverage.
- Maintain dependent relationship records linking principal member to qualified dependents.
- Re-verify eligibility on admission if initial check was performed more than 24 hours prior.
- Surface PhilHealth contribution gaps to billing staff for patient counseling before discharge.
**Key Business Rules.**
- Eligibility must be verified before any PhilHealth benefit is applied to the patient's account.
- Membership types are Direct/Indirect/Sponsored/Lifetime/OFW; each type governs benefit package eligibility.
- Dependent eligibility is derived from the principal member's active status; no contribution required from dependent.
- Eligibility check results are cached for 24 hours per patient-PIN pair; re-query forces a fresh API call.
- If PhilHealth API is unreachable, system allows manual eligibility entry with mandatory override reason and staff ID.
**State Machine.** `unverified → querying → eligible | ineligible | api-unavailable → manually-overridden`
**Key Endpoints.** `verifyMembership`, `recordEligibilityResult`, `getDependentList`, `recheckEligibility`, `overrideEligibilityManual`, `getMembershipDetails`.
**FHIR Mapping.** Coverage, Patient.
**Extends.** `Patient.identifiers[]` (adds PhilHealth PIN field), `Coverage.governmentPrograms[]`.

---

### PH: PhilHealth eClaims 3.0

**Purpose.** Assembles, validates, and submits CF1–CF4 claim forms to PhilHealth via the eClaims 3.0 REST API; manages the full claim lifecycle from draft through approval or denial, including denial management and eSOA generation.
**Key Entities.** PHIClaim, CF1Form, CF2Form, CF3Form, CF4Form, eSOA, ClaimSubmission, ClaimStatus, DenialRecord.
**Key Workflows.**
- Auto-populate CF1 from Registration (patient demographics, PIN, membership type, employer).
- Auto-populate CF2 from DSCA (ICD-10 principal and secondary diagnoses, RVS procedure codes, attending physician, admission/discharge dates).
- Auto-populate CF4 Parts A–G from Billing itemized charges (room, labs, pharmacy, procedures, supplies, professional fees, others).
- Generate eSOA per PhilHealth Circular 2023-0026 from finalized Invoice; attach to claim package.
- Submit assembled and validated claim XML to PhilHealth eClaims 3.0 API; poll status every 24 hours.
- Manage denials: display denial reason code, route correction task to responsible staff, resubmit corrected claim.
**Key Business Rules.**
- Claim must be submitted within 60 days of patient discharge; system warns at 45 days and blocks submission after 60 days with override requiring compliance officer approval.
- CF2 requires at least one ICD-10 principal diagnosis sourced from a signed DSCA; claim cannot be submitted if DSCA is unsigned.
- CF4 itemized charges must reconcile to the final Invoice total before submission; variance blocks submission.
- Denied claims must have a Claim Review Form completed and attached before resubmission.
- Claim status is polled every 24 hours until terminal state (approved or denied); polling stops on terminal state.
- YAKAP API v1.1 is used as submission channel for YAKAP-enrolled facilities; eClaims 3.0 REST API for standard hospital claims.
**State Machine.** `draft → assembled → validated → submitted → received → processing → approved | denied | returned-for-correction → corrected → resubmitted`
**Key Endpoints.** `assembleClaimForms`, `validateClaim`, `submitClaim`, `getClaimStatus`, `generateESOA`, `recordDenial`, `submitClaimReview`, `resubmitCorrectedClaim`, `getClaimDashboard`.
**FHIR Mapping.** Claim, ClaimResponse, Invoice.
**Extends.** `Claim` entity from Core Billing.

---

### PH: PhilHealth DSCA

**Purpose.** Generates, edits, signs, and stores the Discharge Summary and Clinical Abstract — the Philippine-mandated inpatient document required as CF2 attachment for every PhilHealth claim and as a permanent part of the medical record.
**Key Entities.** DSCADocument, DSCADiagnosis, DSCAProcedure, AttendingSignature, DSCAAmendment.
**Key Workflows.**
- Auto-create DSCA draft on discharge initiation; auto-populate patient demographics, PhilHealth PIN, encounter dates, ICD-10 diagnoses, RVS procedures, attending physician, discharge medications, and diet/activity orders.
- Physician completes narrative sections (History of Present Illness, Course in Hospital, Significant Findings) and selects discharge condition.
- Physician electronically signs DSCA; document becomes immutable (Pattern 5); trigger data push to eClaims CF2 and Billing.
- Generate printable PDF copy for patient and hospital file.
- Amendments added post-signing: original preserved; amendment linked with amends_id reference.
**Key Business Rules.**
- At least one ICD-10 principal diagnosis is required before the DSCA can be signed.
- History of Present Illness and Course in Hospital narrative fields require minimum 50 characters each before signing is permitted.
- Attending physician must have a valid PRC license number on file; signing is blocked if license is expired or missing.
- DSCA is immutable once signed; corrections must follow Amendment pattern — original and amendment always displayed together.
- Without a signed DSCA, eClaims CF2 cannot be populated and claim submission is blocked.
- Discharge cannot be finalized in the ADT module until DSCA status is `Signed` (DSCA gate on Encounter status transition to `ClinicalSummaryComplete`).
**State Machine.** `draft → in-progress → ready-for-sign → signed → (immutable); signed → amendment-in-progress → amendment-signed`
**Key Endpoints.** `createDSCADraft`, `updateDSCANarrative`, `validateDSCACompleteness`, `signDSCA`, `generateDSCAPDF`, `addDSCAAmendment`, `getDSCAByEncounter`.
**FHIR Mapping.** DocumentReference, Composition (with Philippine-specific section codes).
**Extends.** Clinical Documentation & CDI.

---

### PH: DOH OHSRS Reporting

**Purpose.** Aggregates hospital statistical data and generates monthly reports for submission to the DOH Online Hospital Statistical Reporting System (OHSRS) per DOH AO 2012-0012 requirements.
**Key Entities.** OHSRSReport, HospitalStatistic, BirthRecord, DeathRecord, NotifiableDisease, OHSRSSubmission.
**Key Workflows.**
- Aggregate discharge records, bed occupancy, birth events, death events, and notifiable disease cases for the reporting period.
- Generate OHSRS-formatted export (CSV or structured XML per DOH OHSRS portal specification).
- Administrator reviews generated report before submission; corrections trigger re-aggregation.
- Submit report to DOH OHSRS portal; record submission timestamp and confirmation number.
- Track submission status; alert compliance staff if submission deadline (10th of following month) is at risk.
**Key Business Rules.**
- Reporting period is calendar month; data must reconcile with actual discharge and bed census records for the period.
- Submission deadline is the 10th of the month following the reporting period; system issues 3-day warning alert.
- Required fields per DOH AO 2012-0012 must all be non-null; system blocks export with field-level validation errors.
- Death records in OHSRS must match death discharge types recorded in the ADT module; discrepancy triggers reconciliation task.
- Report data is read-only after submission; corrections require a superseding submission with amendment note.
**Key Endpoints.** `aggregateOHSRSData`, `generateOHSRSReport`, `validateOHSRSReport`, `exportOHSRSReport`, `submitOHSRSReport`, `getSubmissionStatus`, `getSubmissionHistory`.
**FHIR Mapping.** MeasureReport + domain-native.
**Extends.** Reporting & Analytics, ADT.

---

### PH: RA 9439 Anti-Hospital Detention Compliance

**Purpose.** Enforces the Anti-Hospital Detention Act of 2007 (RA 9439) by ensuring that no patient is detained for non-payment of hospital bills and that all required disclosures, promissory notes, and itemized SOAs are generated and audit-logged at discharge.
**Key Entities.** DetentionRiskFlag, DischargeAuthorization, SOADocument, PromissoryNoteRecord, RA9439AuditEvent.
**Key Workflows.**
- Detect outstanding balance at time of discharge order; auto-generate RA 9439 Notice for patient.
- Present billing clerk with options: collect payment, accept promissory note, or acknowledge AMA-financial discharge.
- Generate Promissory Note with patient signature capture; attach to encounter record.
- Generate itemized SOA on patient request; system must fulfill within 24 hours.
- Log every RA 9439-related event (notice shown, promissory note signed, discharge issued despite balance) in immutable audit trail.
**Key Business Rules.**
- Discharge order must proceed regardless of payment status; any attempt to block discharge on financial grounds triggers a compliance alert to administrator.
- System must never set a `DETAINED` flag for financial reasons; any such flag triggers immediate regulatory violation alert to compliance officer.
- Itemized SOA must be provided to patient on request within 24 hours; system tracks request timestamp and fulfillment timestamp.
- Hospital may accept a promissory note in lieu of payment; promissory note must include patient signature and agreed payment schedule.
- All RA 9439 compliance events are retained in immutable audit log; zero-detention compliance metric is surfaced in administrator dashboard.
**State Machine.** `balance-detected → notice-generated → payment-collected | promissory-note-signed | ama-financial-acknowledged → discharge-authorized`
**Key Endpoints.** `detectOutstandingBalance`, `generateRA9439Notice`, `generatePromissoryNote`, `capturePatientSignature`, `generateItemizedSOA`, `authorizeDischarge`, `getRA9439AuditLog`.
**FHIR Mapping.** domain-native.
**Extends.** Billing & Charges, ADT.

---

### PH: RA 10173 Data Privacy

**Purpose.** Implements the Philippine Data Privacy Act of 2012 (RA 10173) requirements: consent tracking, data subject rights fulfillment, breach incident management with NPC notification, and DPO-accessible compliance reporting.
**Key Entities.** DPORecord, PrivacyNotice, BreachIncident, NPC_Notification, DataSharingAgreement, DataSubjectRequest.
**Key Workflows.**
- Present and record patient consent for data collection, treatment, PhilHealth data sharing, and research use at registration.
- Manage data subject rights requests (access, correction, erasure, portability) with fulfillment tracking.
- Detect and log potential data breach incidents; initiate NPC notification workflow if breach is confirmed.
- Generate RA 10173 compliance report for DPO: access pattern audit, break-the-glass events, consent coverage.
- Manage DataSharingAgreements with third parties (PhilHealth, DOH, HMOs); gate data sharing on active agreement.
**Key Business Rules.**
- NPC must be notified within 72 hours of breach discovery; system generates NPC Notification payload and tracks submission deadline with escalating alerts.
- Consent must be obtained before any personal data is shared with third parties; data sharing without active consent record is blocked.
- Data subject access requests must be fulfilled within 15 calendar days per NPC guidelines.
- Break-the-glass access events (emergency access overriding normal role controls) are logged and surfaced to DPO dashboard within 24 hours.
- Data retention follows DC 2021-0226 (inpatient records: 10 years); records past retention period are flagged for DPO-authorized disposal.
- UNKNOWN: Exact NPC Circular number governing the current breach notification payload format has not been confirmed; validate before implementing NPC_Notification payload fields.
**State Machine.** `breach-suspected → breach-confirmed → npc-notification-drafted → npc-notification-submitted → npc-acknowledged`
**Key Endpoints.** `recordConsent`, `withdrawConsent`, `submitDataSubjectRequest`, `fulfillDataSubjectRequest`, `reportBreachIncident`, `generateNPCNotification`, `generateDPOComplianceReport`, `getDataSharingAgreements`.
**FHIR Mapping.** Consent, AuditEvent + domain-native.
**Extends.** Audit Log, Consent Management.

---

### PH: PWD/Senior Discount Engine

**Purpose.** Automatically calculates and applies the mandatory 20% discount and VAT exemption for Persons with Disability (PWD, RA 10754) and Senior Citizens (RA 9994) on applicable hospital charges and medicines at the billing stage.
**Key Entities.** DiscountEligibility, DiscountApplication, PWD_ID, SeniorID, DiscountAudit, VATExemptionRecord.
**Key Workflows.**
- Detect PWD or Senior Citizen flag on patient record at billing; auto-apply 20% discount to applicable line items.
- Validate PWD ID (NCDA-issued) or Senior Citizen ID (OSCA-issued) before discount is finalized.
- Compute discount in correct order: apply 20% discount to gross charges first, then apply PhilHealth benefit deduction to the discounted amount.
- Generate VAT exemption certificate for qualifying purchases of medicine and medical supplies.
- Audit every discount application with ID number, approving staff, and computation breakdown.
**Key Business Rules.**
- Discount is mandatory by law and cannot be waived by the hospital; any attempt to remove a valid discount triggers a compliance alert.
- Computation order is fixed by RA 9994 / RA 10754: discounted amount = gross charges × 0.80; PhilHealth benefit is then applied to the discounted amount; patient pays discounted amount minus PhilHealth benefit.
- Discount applies to medicine, medical supplies, and hospital services; professional fees for non-salaried physicians are excluded per DOH guidelines.
- Valid PWD ID (NCDA) or OSCA-issued Senior Citizen ID must be presented and recorded; discount cannot be applied without valid ID on file.
- If patient registration flag is missing, billing clerk may manually apply discount with override; override is audit-logged with approver ID.
**Key Endpoints.** `detectDiscountEligibility`, `applyDiscountToCharges`, `validateDiscountID`, `computeDiscountAndVAT`, `generateVATExemptionRecord`, `overrideDiscountManual`, `getDiscountAuditLog`.
**FHIR Mapping.** Invoice, Coverage.
**Extends.** Billing & Charges.

---

### PH: PNDF Formulary + YAKAP Maternity API

**Purpose.** Manages the hospital drug formulary aligned with the Philippine National Drug Formulary (PNDF) for PhilHealth drug benefit coverage, and integrates with the PhilHealth YAKAP API v1.1 for maternity care package enrollment and First Patient Encounter (FPE) submission.
**Key Entities.** PNDFEntry, YAKAPEnrollment, MaternityPackage, PhilHealthBenefit, FPERecord, HospitalFormularyEntry.
**Key Workflows.**
- Maintain hospital formulary synchronized with current PNDF edition; import PNDF updates as they are published.
- Flag PNDF-listed vs non-PNDF medications in CPOE drug search and pharmacy dispensing workflow.
- Enroll eligible pregnant patients in YAKAP maternity package via YAKAP API v1.1 before delivery.
- Submit FPE (First Patient Encounter) record to YAKAP API on qualifying prenatal or delivery visit.
- Validate YAKAP benefit eligibility and track benefit consumption (prenatal visits, delivery package) against package limits.
**Key Business Rules.**
- Only PNDF-listed medications are covered under the PhilHealth drug benefit; non-PNDF medications are flagged as patient-pay in billing.
- YAKAP benefit covers prenatal consultations and delivery package; enrollment must be completed before delivery to claim delivery benefit.
- YAKAP enrollment requires confirmed PhilHealth membership (active eligibility check); unverified membership blocks enrollment.
- PNDF updates are importable by pharmacist role; updates take effect immediately in CPOE drug search and formulary display.
- FPE submission to YAKAP API must occur within 15 days of the qualifying visit per YAKAP program rules.
- YAKAP certification must be obtained from PhilHealth before YAKAP API calls are enabled in production; uncertified systems must use a sandbox environment.
**Key Endpoints.** `getPNDFFormulary`, `importPNDFUpdate`, `checkDrugPNDFStatus`, `enrollYAKAPPatient`, `submitFPERecord`, `getYAKAPBenefitStatus`, `validateYAKAPEligibility`, `getMaternityPackageDetails`.
**FHIR Mapping.** Medication, MedicationKnowledge, EpisodeOfCare, Claim.
**Extends.** Pharmacy, Labor & Delivery.

---

### Teleradiology Service Integration

**Purpose.** Generic integration adapter for outsourcing imaging reads to external teleradiology reading groups, covering study transmission, report ingestion, SLA tracking, and billing passthrough.
**Key Entities.** TeleradOrder, TeleradProvider, ImagingStudyTransmission, PreliminaryReport, FinalReport, TeleradBillingPassthrough
**Key Workflows.**
- Hospital acquires imaging study (DICOM); system transmits study to contracted teleradiology provider via DICOM C-STORE or DICOMweb
- SLA tier assigned at order creation: STAT (≤30 min), Urgent (≤2 hours), Routine (≤24 hours); countdown tracked against transmission timestamp
- Preliminary report received from provider and ingested into RIS; result surfaced in patient chart with `preliminary` flag
- Final or overread report received; supersedes preliminary report; downstream notifications triggered to ordering clinician
- Teleradiology fee incorporated into hospital radiology charge or submitted as separate line item depending on contract model; billing passthrough recorded
**Key Business Rules.**
- If no on-site radiologist is available, orders matching configured modality/site criteria are automatically routed to the designated teleradiology provider on order creation
- Preliminary reports must be clearly flagged in patient chart and cannot satisfy final-result requirements for discharge or procedure clearance
- SLA breach at 80% of allowed window generates an alert to the radiology operations coordinator
- Final report supersedes and archives the preliminary report; both versions retained for audit
- Billing passthrough amounts must reconcile against the provider's invoice line items before month-end close
**State Machine.** `sent` → `preliminary-received` → `final-received` | `failed`
**Key Endpoints.** `createTeleradOrder`, `transmitImagingStudy`, `ingestPreliminaryReport`, `ingestFinalReport`, `getTeleradOrderStatus`, `listTeleradProviders`, `reconcileTeleradBilling`
**FHIR Mapping.** DiagnosticReport, ImagingStudy, ServiceRequest
**Extends.** Radiology / RIS + PACS, Billing & Charges

---

### Reference & Send-Out Laboratory Integration

**Purpose.** Generic adapter for routing laboratory specimens to external reference laboratories, tracking shipment and turnaround, and ingesting results back into the LIS.
**Key Entities.** SendOutOrder, ReferenceLabProvider, SpecimenShipment, ReferenceLabRequisition, ReferenceLabResult, SendOutBillingPassthrough
**Key Workflows.**
- Send-out order triggered when a test is not performed in-house (esoteric, genetics, specialty cultures); reference lab and transport instructions resolved from test catalog
- Specimen collection and packaging instructions presented to phlebotomy/lab staff based on reference lab requirements (cold chain, transport media, container type)
- Electronic requisition transmitted to reference lab via HL7 ORM or FHIR ServiceRequest; acknowledgment received and stored
- Result received electronically (HL7 ORU or FHIR DiagnosticReport), ingested into LIS, and linked to the originating order; ordering clinician notified
- Reference lab charge invoice received and passed through to patient account; markup or direct-bill treatment applied per contract configuration
**Key Business Rules.**
- Expected turnaround time (TAT) is set per test/reference-lab combination at order creation; overdue results trigger escalation alerts to the ordering clinician
- Specimens with broken cold-chain or compromised containers must be rejected and a recollection order created before transmission
- Results ingested from the reference lab require LIS pathologist review and electronic sign-off before being released to the patient chart
- Billing passthrough amounts must be reconciled against the reference lab invoice before the patient account is finalized
- Cancellation of a send-out order after specimen shipment requires confirmation from the reference lab and cannot be processed unilaterally
**State Machine.** `ordered` → `sent-to-lab` → `result-pending` → `resulted` | `cancelled`
**Key Endpoints.** `createSendOutOrder`, `transmitRequisition`, `recordSpecimenShipment`, `ingestReferenceLabResult`, `getSendOutOrderStatus`, `reconcileSendOutBilling`, `cancelSendOutOrder`
**FHIR Mapping.** ServiceRequest, Specimen, DiagnosticReport, Task
**Extends.** Laboratory Information System (LIS), Billing & Charges

---

### PH: PhilHealth Member Programs

**Purpose.** Unified adapter for PhilHealth benefit programs that share the same membership, eligibility, and claims infrastructure: Konsulta (primary care capitation), Z-Benefit (catastrophic illness packages), and KonSulTa MD (outpatient specialist benefit). A `program` discriminator enum distinguishes workflow branches.
**Key Entities.** PhilHealthMemberProgramEnrollment, KonsultaCapitationRecord, ZBenefitEligibility, KonSultaMDEncounter, PhilHealthMemberProgramClaim, BenefitLimitTracker
**Key Workflows.**
- Konsulta: facility enrolls as Konsulta provider via PhilHealth portal/API; primary care beneficiaries enrolled to facility; capitation payment computed per enrolled member per month; Konsulta encounters submitted as separate eClaims transactions distinct from standard inpatient/outpatient claims
- Z-Benefit: eligibility check performed against DOH-defined catastrophic condition list before treatment commences; Z-package code assigned; claim submitted with fixed package rate regardless of actual cost incurred
- KonSulTa MD: patient presents PhilHealth ID at specialist outpatient visit; real-time eligibility verified; specialist visit claim submitted post-encounter
- Common to all programs: PhilHealth membership verification (active contributor status), benefit limit tracking per benefit year, and claim submission via the eClaims 3.0 channel
- Denied or return-to-facility claims trigger a correction workflow with structured reason codes from PhilHealth
**Key Business Rules.**
- The `program` discriminator (`KONSULTA | Z-BENEFIT | KONSULTA_MD`) must be set at claim draft creation and is immutable thereafter
- A patient must have active PhilHealth contributor status at the time of service; expired or lapsed membership blocks benefit utilization and generates a self-pay fallback alert
- Z-Benefit coverage is limited to DOH-gazetted catastrophic conditions; system must validate the ICD-10 diagnosis code against the current Z-Benefit condition table before enabling the Z-package code
- Konsulta capitation enrollment is exclusive: a beneficiary may be enrolled to only one Konsulta facility at a time; duplicate enrollment attempts are rejected
- Benefit limits (e.g., maximum Z-Benefit utilization per year) must be checked before claim submission; exceeding limits requires supervisor override with documented justification
**State Machine.** `draft` → `submitted` → `acknowledged` → `approved` | `denied` | `return-to-facility`
**Key Endpoints.** `verifyPhilHealthMembership`, `checkMemberProgramEligibility`, `enrollKonsultaBeneficiary`, `createMemberProgramClaim`, `submitMemberProgramClaim`, `getMemberProgramClaimStatus`, `trackBenefitLimit`
**FHIR Mapping.** Coverage, Claim, CoverageEligibilityRequest; PhilHealth-program-specific entities domain-native
**Extends.** Coverage & Insurance Eligibility, Billing & Charges, PH: PhilHealth eClaims 3.0

---

### PH: PhilHealth Provider Accreditation

**Purpose.** Unified adapter for PhilHealth facility and practitioner accreditation processes: ACR 2.0 (Accreditation Category Rating for facilities) and IHCP (Individual Health Care Provider accreditation for physicians and allied health professionals). An `accreditationType` discriminator distinguishes the two tracks.
**Key Entities.** AccreditationApplication, ACRFacilityProfile, IHCPPractitionerProfile, AccreditationDocument, InspectionSchedule, AccreditationStatus
**Key Workflows.**
- ACR 2.0: hospital submits facility accreditation application via PhilHealth ACR portal/API; required documents uploaded (DOH license, Certificate of Compliance, equipment inventory, staffing list); on-site inspection scheduled by PhilHealth; rating category assigned (Primary, Secondary, Tertiary, Special)
- IHCP: individual provider submits credentials and links to facility accreditation record; accreditation status determines whether the provider is eligible to sign PhilHealth claims
- Renewal workflow triggered automatically 90 days before expiry for both ACR and IHCP accreditations; renewal documents queued for upload
- Accreditation status changes propagated in real time to Credentialing & Privileging and eClaims submission domains; unaccredited provider blocks claim submission
- Conditional approvals tracked with outstanding requirements and target resolution dates
**Key Business Rules.**
- The `accreditationType` discriminator (`ACR | IHCP`) must be set at application creation and is immutable
- ACR 2.0 rating category determines the PhilHealth case rates and benefit packages the facility may bill; billing must not exceed the approved category ceiling
- IHCP-accredited status is required for any practitioner whose name appears as the attending physician on a PhilHealth claim; system must enforce this at claim validation
- Document uploads must meet PhilHealth-specified format and recency requirements (e.g., DOH license issued within the current licensing period)
- Expired accreditation status must immediately suspend claim submission capability and alert the compliance officer; grace-period rules applied per PhilHealth circular in effect
**State Machine.** `draft` → `submitted` → `under-review` → `inspection-scheduled` → `approved` | `rejected` | `conditional`
**Key Endpoints.** `createAccreditationApplication`, `uploadAccreditationDocument`, `scheduleInspection`, `getAccreditationStatus`, `renewAccreditation`, `listAccreditedProviders`, `syncAccreditationToCredentialing`
**FHIR Mapping.** Organization (facility), Practitioner (individual); accreditation-specific entities domain-native
**Extends.** Credentialing & Privileging, PH: PhilHealth eClaims 3.0

---

### PH: DOH National Health Facility Registry (NHFR)

**Purpose.** Adapter for integrating with the DOH National Health Facility Registry, the authoritative source for licensed health facility profiles and official NHFR facility IDs used across Philippine health information systems.
**Key Entities.** NHFRFacilityProfile, NHFRApplication, NHFRDocument, FacilityServiceInventory, NHFRFacilityIdentifier, LicenseRenewalRecord
**Key Workflows.**
- Facility registration: hospital registers or updates its facility profile in NHFR with facility type, bed capacity, services offered, geographic coordinates, and licensing details; NHFR assigns authoritative facility ID on approval
- Annual license renewal: renewal submission to DOH via NHFR portal; required documents uploaded (Certificate of Occupancy, sanitation permit, License to Operate); acknowledgment and renewed license received
- Data sync: changes to facility capacity, service offerings, or ownership structure propagated to NHFR within the DOH-mandated timeframe; sync events logged for audit
- NHFR facility ID used as the canonical facility identifier in PhilHealth eClaims, DOH OHSRS reports, and inter-facility referral networks
- Lookup: query NHFR to retrieve facility details or verify license status for referral partners
**Key Business Rules.**
- The NHFR-assigned facility ID is the authoritative identifier; all downstream integrations (PhilHealth, OHSRS, referral networks) must use this ID and not a locally generated substitute
- Any change in bed capacity, service category, or ownership requires a formal NHFR amendment application before the change is considered official
- License to Operate expiry date must be tracked; facilities operating with an expired license are flagged and claim submission blocked pending renewal confirmation
- Document uploads must meet DOH NHFR format requirements; unsupported formats or expired documents result in automatic application rejection
- Facility profile data returned from NHFR supersedes locally maintained records for fields within NHFR's scope (facility type, license status, bed capacity)
**State Machine.** `draft` → `submitted` → `under-review` → `approved` | `rejected` | `conditional-approval`
**Key Endpoints.** `registerNHFRFacility`, `updateFacilityProfile`, `submitLicenseRenewal`, `uploadNHFRDocument`, `getNHFRApplicationStatus`, `lookupFacilityByNHFRId`, `syncFacilityProfileFromNHFR`
**FHIR Mapping.** Organization (facility profile); NHFR-specific entities domain-native
**Extends.** Organization & Location Registry

---

### PH: DOH FDA Controlled Substances eReporting

**Purpose.** Adapter for recording, reconciling, and electronically reporting controlled substance and dangerous drug transactions to the Philippine Food and Drug Administration (FDA) and Dangerous Drugs Board (DDB) in compliance with Republic Act 9165.
**Key Entities.** ControlledSubstanceInventoryRecord, ControlledSubstanceDispensing, WastageRecord, MonthlyReconciliationReport, PrescriptionMonitoringEntry, AuthorizedSignatory
**Key Workflows.**
- Drug registration: hospital pharmacy registers controlled substance inventory with the FDA/DDB portal; authorized pharmacist and physician signatories registered per facility
- Issuance recording: every dispensing of a Schedule I–IV dangerous drug recorded with patient identity, prescriber, dispenser, quantity dispensed, and lot number
- Wastage recording: controlled substance wastage documented with dispenser and independent witness signatures; wastage amounts reconciled against total dispensed quantity per lot
- Monthly inventory reconciliation report compiled from dispensing and wastage records and submitted to FDA/DDB via the electronic reporting portal before the mandated cutoff
- Prescription monitoring: controlled substance prescriptions cross-checked against the Prescription Monitoring Program (PMP); duplicate or overlapping prescriptions flagged for pharmacist review before dispensing
**Key Business Rules.**
- Every dispensing event must be recorded in real time; retrospective entry requires supervisor authorization and generates an audit exception
- Wastage records require two-party sign-off (dispenser + witness); unsigned wastage records block monthly report submission
- Monthly reconciliation report must balance opening stock + received − dispensed − wasted = closing stock; imbalances block submission and require investigation
- Duplicate prescription detection covers a rolling 30-day window across all registered dispensing facilities in the PMP network
- Controlled substance records must be retained for a minimum of 5 years per RA 9165 implementing rules
**State Machine.** `draft` → `submitted` → `acknowledged` | `query-raised`
**Key Endpoints.** `registerControlledSubstanceInventory`, `recordDispensing`, `recordWastage`, `generateMonthlyReconciliationReport`, `submitMonthlyReport`, `checkPrescriptionMonitoringProgram`, `getReportSubmissionStatus`
**FHIR Mapping.** MedicationDispense, MedicationRequest, Medication; report entities domain-native
**Extends.** Pharmacy (Inpatient + Outpatient), Medication Administration Record (eMAR)

---

### PH: DOH SPEED/ESR Epidemic Surveillance Reporting

**Purpose.** Adapter for submitting notifiable disease case reports and aggregate weekly tallies to the DOH Surveillance in Post Extreme Emergencies and Disasters (SPEED) and Epidemiology and Surveillance Report (ESR) systems under the Philippine Integrated Disease Surveillance and Response (PIDSR) framework.
**Key Entities.** NotifiableConditionList, DiseaseReport, CaseInvestigationForm, ImmediateNotification, WeeklyAggregateTally, OutbreakThresholdAlert
**Key Workflows.**
- Notifiable disease list maintained and versioned from DOH PIDSR circulars; conditions categorized as immediately notifiable (within 24 hours) or weekly notifiable
- Case detection: clinician records a diagnosis matching a notifiable condition; system automatically triggers a reporting workflow and notifies infection control
- Case report creation: PIDSR case investigation form fields auto-populated from patient demographics, encounter data, and clinical findings; clinician completes required epidemiological fields
- Immediate notification submitted within 24 hours to the city/municipal health office and DOH for immediately notifiable conditions (e.g., measles, cholera, COVID-19 cluster events)
- Weekly aggregate disease tally compiled and submitted to DOH PIDSR/ESR system each Monday covering the prior epidemiological week
- Outbreak threshold monitoring: system tracks case counts per condition per time window; alert generated to infection control team when DOH-defined outbreak threshold is exceeded
**Key Business Rules.**
- Immediately notifiable conditions must generate a preliminary report submission within 24 hours of diagnosis; failure to submit within this window creates a compliance exception logged to the infection control officer
- PIDSR case investigation form fields designated as mandatory by DOH may not be left blank; incomplete forms cannot be submitted
- Patient identifiers in reports submitted to DOH must comply with DOH data privacy guidelines; direct identifiers are pseudonymized in the aggregate weekly tally
- Outbreak threshold parameters are governed by current DOH PIDSR guidelines and must be updatable without a code deployment
- Submitted reports must be retained and accessible for DOH verification for a minimum of 5 years
**State Machine.** `detected` → `case-form-drafted` → `submitted` → `acknowledged` | `under-investigation`
**Key Endpoints.** `syncNotifiableConditionList`, `createDiseaseReport`, `submitImmediateNotification`, `submitWeeklyAggregateTally`, `getDiseaseReportStatus`, `getOutbreakAlerts`, `listPendingNotifications`
**FHIR Mapping.** Condition, Patient, Observation, Communication; report submission entity domain-native
**Extends.** Infection Prevention & HAI Surveillance, Public Health Reporting

---

### PH: PSA PhilSys National ID

**Purpose.** Adapter for Philippine Statistics Authority (PSA) PhilSys National ID verification: validates a patient's PhilSys Number (PSN) against the PSA API and retrieves PSA-verified demographic data to support accurate patient identity matching and registration.
**Key Entities.** PhilSysVerification, PhilSysNumber, VerifiedDemographic, PatientIdentifierLink, PhilSysConsent, BiometricOrOTPChallenge
**Key Workflows.**
- PSN capture: PhilSys physical card or ePhilID QR code scanned at the registration counter or entered manually; PSN parsed and stored pending verification
- Identity verification: PSN combined with biometric (fingerprint/face) or OTP challenge submitted to the PSA PhilSys API; verification result returned (match, no-match, or inconclusive)
- Demographic retrieval: on successful verification, PSA returns canonical name, date of birth, sex, and address; data used to auto-populate or reconcile patient registration record, reducing manual entry errors
- MPI linkage: verified PSN stored on the Patient record as a national identifier in the Patient.identifier[] FHIR extension slot; linkage flagged as PSA-verified
- Consent capture: patient consent for PSA PhilSys data retrieval obtained, recorded, and linked to the verification transaction before the API call is made, in compliance with RA 11055 §14
**Key Business Rules.**
- PSA PhilSys API must not be called without a recorded patient consent event linked to the session; missing consent blocks the verification request
- A no-match result must not be used to deny patient care; it triggers a manual identity review workflow while registration proceeds with unverified data
- Verified PSN is stored as an immutable national identifier; corrections require a formal identity review process with supervisor authorization and PSA re-verification
- Demographic data returned by PSA supersedes manually entered data for the canonical identity fields (name, date of birth, sex, address) and is marked with a PSA-verified provenance flag
- Inconclusive results (e.g., biometric quality too low) may be retried up to two times per session; subsequent failures escalate to manual identity adjudication
**State Machine.** `pending` → `verified` | `failed` | `inconclusive`
**Key Endpoints.** `capturePhilSysNumber`, `recordPhilSysConsent`, `initiatePhilSysVerification`, `getVerificationResult`, `retrieveVerifiedDemographics`, `linkPSNToPatient`, `retryVerification`
**FHIR Mapping.** Patient (identifier extension), Consent
**Extends.** Patient / Person Master (MPI), Identity, Authentication & Session

---

## Appendix A — Open Questions & UNKNOWN Markers

| # | UNKNOWN | Domain | Implication |
|---|---------|--------|-------------|
| 1 | Sensitive data segmentation (substance use, behavioral health, HIV, genetic data under 42 CFR Part 2 and equivalent PH standards) — standalone domain or cross-cutting policy applied within existing domains? | Behavioral Health | Affects whether a SegmentedDataPolicy domain is required; if standalone, adds a new domain to Category 2; if cross-cutting, affects every clinical domain's access control model |
| 2 | FHIR version target: R4, R4B, or R5? R4B introduced SubscriptionTopic and Ingredient; R5 has breaking changes to several resources used in clinical domains. | All | Affects resource shapes, profile conformance, and Subscription implementation pattern across every domain |
| 3 | Organ/tissue donation notification (UNOS equivalent in PH: NKTI / National Kidney and Transplant Institute) — sub-domain of ADT/Consent or standalone domain? | ADT, Consent Management | Affects scope boundary between integration and clinical categories; NKTI API shape is unknown |
| 4 | Exact NPC Circular number governing the current data breach notification payload format (post-NPC Circular 16-03 amendments, if any). | PH: RA 10173 Data Privacy | Affects payload field names and required data elements in NPC_Notification entity |
| 5 | Philippine ICD-10 edition in use: WHO ICD-10 standard, ICD-10-CM (US clinical modification), or a locally maintained PH code list? PhilHealth eClaims validation rules differ depending on the code set. | PH: PhilHealth eClaims 3.0, PH: PhilHealth DSCA, EMR Coding | Affects terminology server configuration, code validation logic, and CF2 acceptance by PhilHealth API |
| 6 | YAKAP API v1.1 sandbox availability and certification timeline: when can Ospitalis begin integration testing against PhilHealth's test environment, and what is the certification audit process? | PH: PNDF Formulary + YAKAP Maternity API, PH: PhilHealth eClaims 3.0 | Blocks production use of both YAKAP and eClaims 3.0 submission channels until certification is obtained; affects Tier 4 delivery timeline |
| 7 | eSOA versioned template management: PhilHealth may update eSOA format (referenced in Circular 2023-0026); what is the update cadence and API version negotiation mechanism? | PH: PhilHealth eClaims 3.0 | Requires versioned eSOA templates and a maintenance process for format changes; affects eSOA entity schema |
| 8 | HL7 v2 channel requirements for existing hospital partner systems in the Philippine market: which message types and trigger events do common Philippine LIS/RIS/PACS vendors actually support? | HL7 v2 Interface Engine | Affects default channel configuration and the set of outbound trigger events that need to be pre-built |
| 9 | IHE profile adoption level in Philippine HIE context: is there an active XDS registry/repository operated by DOH or a regional HIE that Ospitalis should connect to? | IHE Profiles, HIE/Carequality/TEFCA | Determines whether IHE domain is used in production or remains dormant as a future capability |
| 10 | Electronic signature legal validity under RA 8792 (E-Commerce Act) for clinical documents including DSCA: has DOH or PhilHealth issued a formal ruling on which electronic signature technologies are accepted for eClaims-attached documents? | PH: PhilHealth DSCA, all signing flows | Affects EPCS-equivalent requirements for physician signing; may require hardware token or PKI |

---

## Appendix B — Known Gaps

| # | Gap | Source | Resolution |
|---|-----|--------|------------|
| 1 | Birth registration workflow (RA 3753 — Civil Registry Law): system does not yet specify how live birth certificates are generated and submitted to the Local Civil Registrar from maternity encounters. | ospitalis-prd.md §8, Gap #1 | Resolve in Tier 2 when maternity encounters are tested; add birth registration sub-workflow to Labor & Delivery domain |
| 2 | Death certification workflow: system does not specify how the Death Certificate (DOH-mandated form) is generated, physician-signed, and transmitted to the Local Civil Registrar at discharge type `Death`. | ospitalis-prd.md §8, Gap #2 | Resolve in Tier 2 as edge case of discharge workflow; requires dedicated screen and DOH form template |
| 3 | No Balance Billing enforcement logic beyond RA 9439: the PH: RA 9439 domain covers detention prohibition but does not implement affirmative No Balance Billing (NBB) rules for PhilHealth case rates. NBB enforcement (hospital cannot charge patient beyond the PhilHealth case rate for Case Rate packages) requires separate business rule layer. | ospitalis-prd.md §8, Gap #3 | Resolve in Tier 4 during billing implementation; may require a dedicated NBB Rules Engine sub-domain |
| 4 | End-to-end ER-to-eClaims flow documentation: the integration path from ER encounter through clinical documentation, billing, and eClaims submission has not been fully validated as a cross-module sequence. | ospitalis-prd.md §8, Gap #4 | Resolve in Tier 4 when all modules are connected; requires integration test specification |
| 5 | Medication lifecycle charge timing: whether charges are captured at the point of pharmacy dispensing or at the point of nurse administration is unresolved; the two options produce different charge timestamps on CF4. | ospitalis-prd.md §8, Gap #5 | Resolve in Tier 3–4 when pharmacy and billing modules connect; decision affects CF4 Part B itemization |
| 6 | Consultant professional fee auto-capture: fees for specialist consultants called in during an inpatient encounter are not automatically captured from the CPOE consult order; manual entry is the current fallback. | ospitalis-prd.md §8, Gap #6 | Resolve in Tier 4; requires physician fee schedule integration and consult-order-to-charge mapping |
| 7 | THOC (Transfer of Hospital Care) form specification: the data fields, required signatures, and inter-hospital transmission method for the DOH-mandated THOC form are not yet specified. | ospitalis-prd.md §8, Gap #7 | Resolve in Tier 1 if inter-hospital transfer use case arises in pilot; add to ADT domain |
| 8 | ICD-10 local code list: the authoritative PH ICD-10 edition and terminology server source have not been confirmed; PhilHealth eClaims validation may differ from the WHO reference edition. | ospitalis-prd.md §8, Gap #8 | Resolve in Tier 2 during EMR implementation; confirm with PhilHealth eClaims technical documentation |
| 9 | Electronic signature legal validity (RA 8792): no formal ruling from DOH or PhilHealth has been confirmed regarding which electronic signature technologies satisfy legal requirements for DSCA and other clinical documents. | ospitalis-prd.md §8, Gap #9 | Resolve in Tier 2 when signing is implemented; legal opinion required before production go-live |
| 10 | Infection control tracking: HAI (Healthcare-Associated Infection) surveillance, contact precaution flags, and outbreak detection are not covered in any domain; relevant to EMR and Public Health Reporting. | ospitalis-prd.md §8, Gap #10 | Phase 2 (post-MVP); may require a dedicated Infection Control domain |
| 11 | Data breach notification workflow (NPC 72-hour requirement): the step-by-step workflow for breach detection, internal escalation, and NPC notification payload submission is not fully specified; NPC Circular number is unconfirmed. | ospitalis-prd.md §8, Gap #11; Appendix A #4 | Phase 2; resolve alongside PH: RA 10173 domain implementation; requires NPC Circular confirmation |
| 12 | DPO designation and duties: the Data Protection Officer role, system permissions, and audit dashboard capabilities are not yet defined in the RBAC model. | ospitalis-prd.md §8, Gap #12 | Phase 2; add DPO persona and role permissions to Identity & Access Management domain |
| 13 | Radiologist persona and journeys: the radiologist's workflow (reading worklist, dictation, report sign-off, results communication to ordering physician) is only partially covered by the Imaging domain; no dedicated persona journeys exist. | ospitalis-prd.md §8, Gap #13 | Resolve in Tier 3 during imaging implementation; add radiologist persona journeys |
| 14 | Ward clerk / admissions clerk persona: the registration and ADT tasks performed by ward clerks vs billing clerks vs nurses are not clearly delineated; role confusion may cause RBAC gaps. | ospitalis-prd.md §8, Gap #14 | Resolve in Tier 1 during pilot; clarify persona boundaries and update RBAC matrix |
| 15 | Billing daily cash reconciliation: the end-of-day cash drawer reconciliation workflow for the billing clerk (matching collected payments to the daily transaction ledger) is not specified. | ospitalis-prd.md §8, Gap #15 | Resolve in Tier 4 during billing implementation |
| 16 | Early Warning Score (EWS/NEWS2) as dedicated CDS domain vs embedded CDS rule: no decision has been made on whether Early Warning Scores constitute a standalone domain or are implemented as a CDS Hooks rule within the existing Nursing/EMR domains. | Newly identified | Decide during Tier 2 clinical design; if dedicated scoring domain is required, add to Category 3 (Clinical) |
| 17 | Acuity-based staffing as standalone domain: nurse-to-patient ratio enforcement and acuity-based bed assignment recommendations are not assigned to any existing domain. | Newly identified | Evaluate in Phase 2; may require a Staffing & Scheduling domain or integration with Bed Management |
| 18 | Organ/tissue donation workflow: no domain covers patient consent for organ/tissue donation, NKTI notification, or cross-matching coordination. | Newly identified; Appendix A #3 | Phase 2 or standalone domain; requires NKTI API investigation |
| 19 | Genetic/genomic data handling: storage, access controls, and retention rules for genetic test results are not addressed; relevant to RA 10173 sensitive data categories and potential future precision medicine use cases. | Newly identified | Phase 2; requires legal review and potential sensitive data segmentation policy |
| 20 | GME / resident duty-hour tracking: graduate medical education duty-hour compliance tracking for teaching hospitals is not covered in any persona or domain. | Newly identified | Out of scope for MVP; add to backlog for hospital-type-specific feature roadmap |
| 21 | Patient identification wristband printing and reprint audit: the workflow for generating, printing, and auditing reprints of patient identification wristbands is not specified in the ADT domain. | Newly identified | Resolve in Tier 1 during ADT implementation; add wristband print job entity and reprint audit log |
| 22 | Staff shift scheduling (nursing duty roster): assignment of nurses to shifts, ward coverage rules, and overtime tracking are not covered; currently expected to be managed outside the system. | ospitalis-prd.md §8, Gap #16 | Phase 2; evaluate as standalone Scheduling domain or integration with external HR system |
| 23 | Negative inventory alert after multi-device offline dispensing: concurrent offline dispensing on multiple devices may result in negative inventory on sync; conflict resolution strategy is not fully specified. | ospitalis-prd.md §8, Gap #19 | Resolve in Tier 3 during pharmacy implementation; requires CRDT conflict resolution design for inventory |

---

## Appendix C — Localization Adapter Registry

| Adapter Domain | Country | Category | Extends Core Domain(s) | Status |
|----------------|---------|----------|------------------------|--------|
| PH: PhilHealth Membership | Philippines | Government Insurance | Patient Registration & ADT, Coverage / Insurance | Defined |
| PH: PhilHealth eClaims 3.0 | Philippines | Government Insurance Claims | Billing & Charges, Clinical Documentation | Defined |
| PH: PhilHealth DSCA | Philippines | Clinical Regulatory Document | Clinical Documentation & CDI, ADT | Defined |
| PH: DOH OHSRS Reporting | Philippines | Public Health Reporting | Reporting & Analytics, ADT, Bed Management | Defined |
| PH: RA 9439 Anti-Hospital Detention | Philippines | Regulatory Compliance | Billing & Charges, ADT | Defined |
| PH: RA 10173 Data Privacy | Philippines | Data Privacy Regulatory | Audit Log, Consent Management, Identity & Access | Defined |
| PH: PWD/Senior Discount Engine | Philippines | Pricing Regulatory | Billing & Charges | Defined |
| PH: PNDF Formulary + YAKAP Maternity API | Philippines | Formulary + Government Maternity Benefit | Pharmacy, Labor & Delivery, PhilHealth eClaims 3.0 | Defined |
| PH: PhilHealth Member Programs | Philippines | Government Insurance — Member Programs | Coverage & Insurance Eligibility, Billing & Charges, PH: PhilHealth eClaims 3.0 | Defined |
| PH: PhilHealth Provider Accreditation | Philippines | Provider Accreditation (Facility & Individual) | Credentialing & Privileging, PH: PhilHealth eClaims 3.0 | Defined |
| PH: DOH National Health Facility Registry (NHFR) | Philippines | Facility Licensing & Registry | Organization & Location Registry | Defined |
| PH: DOH FDA Controlled Substances eReporting | Philippines | Controlled Substances Regulatory | Pharmacy, Medication Administration Record | Defined |
| PH: DOH SPEED/ESR Epidemic Surveillance | Philippines | Public Health Surveillance | Infection Prevention & HAI Surveillance, Public Health Reporting | Defined |
| PH: PSA PhilSys National ID | Philippines | Patient Identity Verification | Patient / Person Master (MPI), Identity & Authentication | Defined |
| US: X12 Payer EDI | United States | Payer Claims & Eligibility | Billing & Charges, Coverage / Insurance | Planned |
| US: Medicare/Medicaid | United States | Government Insurance Claims | Billing & Charges, Coverage / Insurance, Coding | Planned |
| EU: eHDSI / MyHealth@EU | European Union | Cross-Border Health Data Exchange | Clinical Documentation, Patient Registration, Pharmacy | Planned |
