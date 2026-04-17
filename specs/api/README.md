# Monobase Open Health Specs

A global-grade, FHIR R4-informed healthcare API specification covering the full spectrum of health information systems — from primary care clinics to tertiary hospitals, dental practices, post-acute facilities, and public health agencies.

**937 API paths | 1,183 schemas | 128 TypeSpec source files | 38 standards docs | 6 localization packs**

> Built with [TypeSpec](https://typespec.io/) (Microsoft). Generates OpenAPI 3.0 + TypeScript types.

---

## What This Is

This is a **specification-only** project — no runtime implementation. It defines the complete API contract (endpoints, schemas, operations, validation rules, security roles, business rules) for healthcare applications. The spec generates:

- **OpenAPI 3.0 JSON** — machine-readable API contract for any language/framework
- **TypeScript type definitions** — type-safe API contracts for TS/JS applications
- **Interactive API documentation** — via Scalar UI

Any team can take this spec and implement it in their stack of choice (Node.js, Rust, Go, Java, .NET, etc.).

---

## Quick Start

```bash
bun install
bun run build          # Generates OpenAPI + TypeScript types
bun run docs           # Starts interactive API docs server
```

---

## Architecture

```
specs/api/src/
  common/                  # Shared models, errors, pagination, security
  modules/                 # Platform infrastructure (Person, Audit, Comms, etc.)
  healthcare/
    core/                  # FHIR-aligned primitives (CodeableConcept, Reference, etc.)
    foundation/            # Organization, Location, Department
    clinical/              # Encounters, conditions, meds, observations, procedures
      hospital/            # ED, ICU, nursing, CPOE, wound care, code blue
        specialty/         # Cardiology, respiratory, rehab, palliative, NICU, post-acute
    administrative/        # Scheduling, billing, claims, workforce, credentialing
      hospital/            # HIM/ROI, cost accounting, GME
    ancillary/             # Lab, pharmacy, radiology, dental (9 specialty modules)
    operational/           # Inventory, devices, recall, portal, connectors
      hospital/            # EVS, transport, dietary, sterile processing, mortuary
    support/               # Care plans, consent, CDS, SDOH, provenance, telehealth
      public-health/       # eCR, immunization registry, vital records, cancer, surveillance
    conformance/           # FHIR CapabilityStatement, $operations, terminology, IPS
    compliance/            # Policy management, BAA, CAPA, privacy workflows
    analytics/             # De-identification, cohorts, AI metadata, reporting
  localization/            # Country-specific code systems, identifiers, value sets
    ph/ us/ uk/ au/ ca/ in/
  docs/standards/          # 38 governance and compliance documents
```

---

## Module Catalog

### Platform Infrastructure

| Module | Description |
|--------|-------------|
| Person | Central PII management, identity, consent preferences |
| Audit | Immutable audit trail, compliance logging |
| Notifications | Multi-channel delivery (email, push, in-app) |
| Communications | Video calls (WebRTC), secure messaging |
| Storage | File management (S3/MinIO), presigned URLs |
| Email | Transactional email with template management |
| Reviews | NPS feedback collection |

### Healthcare Core

| Module | Key Entities | FHIR R4 Alignment |
|--------|-------------|-------------------|
| **Patient** | Patient demographics, MRN, communication prefs, merge/unmerge | Patient |
| **Provider** | Practitioner, PractitionerRole, credentials (NPI, DEA) | Practitioner, PractitionerRole |
| **Organization** | Facilities, hospitals, clinics, labs, pharmacies | Organization |
| **Location** | Rooms, beds, wings, departments, virtual locations | Location |

### Clinical

| Module | Key Entities |
|--------|-------------|
| **Encounter** | Outpatient, inpatient, emergency, virtual visits |
| **Condition** | Problem list, diagnoses (ICD-10, SNOMED CT) |
| **Observation** | Vitals, lab results, assessments (LOINC) |
| **Medication Request** | Prescriptions (RxNorm, NDC) |
| **Procedure** | Surgical and clinical procedures (CPT, SNOMED) |
| **Allergy/Intolerance** | Allergy and adverse reaction registry |
| **Immunization** | Vaccination records (CVX) |
| **Service Request** | Lab, imaging, referral orders |
| **Composition** | Discharge summaries, clinical documents (LOINC sections) |
| **Document Reference** | Clinical notes (SOAP, progress, discharge, operative) |
| **Family History** | Genetic and family health history |
| **Episode of Care** | Care episode grouping across encounters |
| **Flag** | Clinical alerts, safety flags, risk indicators |
| **Related Person** | Guardian, caregiver, emergency contact |
| **ADT Events** | Admission, discharge, transfer event log (HL7 v2 parity) |
| **Clinical Communication** | SBAR handoffs, secure clinical messaging |
| **Surgical Management** | OR cases, anesthesia records, preference cards |

### Hospital Specialties

| Module | Coverage |
|--------|----------|
| **Emergency Department** | ED visits, triage (ESI), ED board, metrics |
| **ICU / Critical Care** | Ventilator management, flowsheets, APACHE/SOFA/NEWS2 |
| **Nursing Assessment** | Fall risk (Morse), pressure injury (Braden), pain, wound |
| **Order Management** | CPOE, order sets, order verification, co-sign |
| **Labor & Delivery** | Pregnancy, labor, newborn, postpartum |
| **Oncology** | Cancer diagnosis, chemo protocols/cycles, radiation therapy |
| **Dialysis** | Hemodialysis/PD orders, sessions, vascular access |
| **Behavioral Health** | Psychiatric assessment, involuntary holds, substance use |
| **Wound Care** | Wound assessment, treatment, dressing orders |
| **Code Blue** | Emergency response events, teams, debriefs |
| **Cardiology** | Cath lab, echocardiography, EP studies, cardiac rehab |
| **Respiratory Therapy** | RT orders, treatments, ABG results, PFTs |
| **Rehab Therapy** | PT/OT/SLP referrals, evaluations, sessions, FIM/Barthel |
| **Palliative / Hospice** | Goals of care, symptom management, hospice eligibility, IDT |
| **Post-Acute Care** | SNF (MDS 3.0), home health (OASIS), ADL assessment |
| **Neonatal** | NICU admissions, neonatal vitals, feeding, newborn screening |

### Administrative

| Module | Coverage |
|--------|----------|
| **Scheduling** | FHIR Schedule/Slot/Appointment with waitlist |
| **Bed Management** | Bed tracking, assignment, occupancy |
| **Insurance** | Coverage, eligibility verification |
| **Claims** | Claim submission, adjudication, ClaimResponse |
| **Prior Authorization** | Pre-auth workflow (CMS-mandated) |
| **Charge Capture** | ChargeItem, ChargeDefinition, CDM |
| **Patient Financial** | Payments, receipts, payment plans, promissory notes |
| **Fee Schedule** | Fee schedules, contract rates, discounts |
| **Staff Credentialing** | Credentialing records, clinical privileges |
| **Workforce Scheduling** | Shifts, time-off, on-call schedules |
| **HIM / ROI** | Release of information, medical record requests, coding/CDI |
| **Cost Accounting** | Cost centers, allocations, case costing, GL export |
| **GME** | Residency programs, residents, rotations, evaluations |

### Ancillary Services

| Module | Coverage |
|--------|----------|
| **Laboratory** | Specimens, diagnostic reports, panels, verification |
| **Pharmacy** | Dispensing, drug interactions, reconciliation, adherence |
| **Medication Catalog** | Drug master, formulary management |
| **Medication Administration** | eMAR, administration records |
| **Radiology** | Imaging studies (DICOM), radiology reports, findings |
| **Blood Bank** | Blood products, crossmatch, transfusion records |
| **Dental (General)** | Odontogram, treatment plans, CDT codes |
| **Periodontal** | Perio exams, pocket depth, furcation, mobility |
| **Orthodontic** | Ortho cases, aligners, stages, progress |
| **Endodontic** | Root canal records, canal mapping, obturation |
| **Prosthodontic** | Crowns/bridges, shade selection, impressions, lab cases |
| **Dental Lab** | Lab cases, providers, communication, returns |
| **Pediatric Dental** | Eruption/exfoliation, behavior, fluoride, sealants, space maintainers |
| **Cosmetic Dental** | Cosmetic cases, smile design, whitening, veneers |
| **Oral Surgery** | Extractions, pathology specimens, post-op, healing follow-up |

### Operational

| Module | Coverage |
|--------|----------|
| **Inventory** | Items, batches, storage locations, supply consumption |
| **Device Management** | Medical devices, assignments, metrics, calibration |
| **Recall & Follow-Up** | Recall rules, schedules, campaigns |
| **Implant Registry** | Implant fixtures, osseointegration, lot-based recalls |
| **Operatory** | Dental chair management, assignments, utilization |
| **Patient Portal** | Portal accounts, online booking, messages, payments, intake |
| **External Connectors** | Connector management, credentials, sync logs |
| **Environmental Services** | Cleaning tasks, schedules, EVS metrics |
| **Patient Transport** | Transport requests, teams, dispatch |
| **Dietary Services** | Diet orders, meal service, nutrition screening |
| **Sterile Processing** | Instrument sets, autoclave cycles, biological indicators |
| **Mortuary** | Deceased records, body release, storage |
| **Peer Review** | Peer review cases, panels, actions (privileged access) |
| **Emergency Preparedness** | HICS plans, activations, surge capacity, drills |

### Support Services

| Module | Coverage |
|--------|----------|
| **Care Plan** | Care plans, care teams, goals |
| **Consent** | FHIR Consent with provisions and policies |
| **CDS Hooks** | Clinical decision support (patient-view, order-sign, etc.) |
| **SDOH** | Social determinants screening, referrals (Gravity Project) |
| **Provenance** | Who did what, when, why (HIPAA compliance) |
| **Electronic Signature** | Signature/attestation with verification |
| **Questionnaire** | Forms, surveys, conditional logic, responses |
| **Task** | Workflow tasks, status transitions |
| **Telehealth** | Video sessions, async consultations, remote monitoring |
| **Clinical Outcomes** | Outcome records, benchmarks, reports |
| **Incident Reporting** | Adverse events, near misses, quality measures |
| **Infection Control** | Surveillance, antibiograms |
| **Data Import** | Import jobs, mappings, validation, error reporting |
| **Workflow Automation** | Rules, triggers, actions, task queues |
| **Proxy Access** | Guardian delegation with sensitive category exclusions |
| **Break-Glass** | Emergency access override with audit + review |
| **Mandatory Reporting** | CPS, elder abuse, communicable disease, etc. (19 types) |

### Public Health

| Module | Coverage |
|--------|----------|
| **Electronic Case Reporting** | eCR triggers, submission, reportability response |
| **Immunization Registry** | IIS submission, query, forecast recommendations |
| **Vital Records** | Birth certificates, death certificates, fetal death reports |
| **Cancer Registry** | Case abstraction, TNM staging, SEER/NPCR |
| **Surveillance** | Syndromic surveillance, ELR, trauma registry |

### Compliance & Governance

| Module | Coverage |
|--------|----------|
| **Compliance Program** | Policies, attestations, BAA lifecycle, CAPA, data retention, legal holds |
| **Privacy Workflow** | Amendment requests, accounting of disclosures, breach assessment/notification, privacy complaints |

### FHIR Conformance

| Module | Coverage |
|--------|----------|
| **CapabilityStatement** | Machine-readable API capability declaration |
| **FHIR Operations** | $match, $everything, $validate, $document |
| **Terminology Service** | $lookup, $expand, $validate-code, $translate |
| **Bulk Data** | $export (system/patient/group), $import |
| **Subscriptions** | Topic-based pub/sub (R5-style) |
| **IPS** | International Patient Summary (ISO 27269) |

### Analytics & Research

| Module | Coverage |
|--------|----------|
| **De-Identification** | Profiles, pseudonymization, masking rules |
| **Cohort** | Cohort definitions, research extracts, data lineage |
| **AI Metadata** | AI output confidence, evidence sources, review workflow |
| **Reporting** | Report definitions, scheduled runs, dashboards |

---

## Standards Alignment

### Terminology & Coding Systems

| System | URI | Scope |
|--------|-----|-------|
| WHO ICD-10 | `http://hl7.org/fhir/sid/icd-10` | Diagnoses (global) |
| ICD-10-CM | `http://hl7.org/fhir/sid/icd-10-cm` | Diagnoses (US) |
| WHO ICD-11 | `http://id.who.int/icd/release/11/mms` | Diagnoses (next-gen) |
| SNOMED CT | `http://snomed.info/sct` | Clinical terminology |
| LOINC | `http://loinc.org` | Observations, lab tests |
| RxNorm | `http://www.nlm.nih.gov/research/umls/rxnorm` | Medications |
| CPT | `http://www.ama-assn.org/go/cpt` | Procedures (US) |
| CDT | `http://www.ada.org/cdt` | Dental procedures |
| CVX | `http://hl7.org/fhir/sid/cvx` | Vaccines |
| UCUM | `http://unitsofmeasure.org` | Units of measure |
| NDC | `http://hl7.org/fhir/sid/ndc` | Drug products (US) |
| WHO ATC | `http://www.whocc.no/atc` | Drug classification (global) |

### Interoperability Standards

| Standard | Alignment Level |
|----------|----------------|
| HL7 FHIR R4 | **Conform** — all resources FHIR R4-aligned |
| SMART on FHIR v2 | **Conform** — OAuth 2.0 + PKCE scopes documented |
| CDS Hooks v2 | **Conform** — 5 hook types implemented |
| FHIR Bulk Data | **Conform** — $export and $import |
| FHIR Subscriptions (R5) | **Conform** — topic-based pub/sub |
| IPS (ISO 27269) | **Conform** — International Patient Summary |
| HL7 v2 | **Support** — ADT event model, integration guide |
| C-CDA v4.0 | **Support** — generation guide documented |
| DICOM / DICOMweb | **Support** — integration guide documented |
| X12 EDI (837/835/270) | **Support** — claims mapping documented |
| NCPDP SCRIPT | **Support** — ePrescribing guide documented |
| OMOP CDM | **Support** — export mapping documented |
| Da Vinci IGs | **Reference** — payer integration guide |
| TEFCA v2.1 | **Reference** — alignment documented |
| openEHR | **Reference** — archetype concepts |

### Compliance Frameworks

| Framework | Coverage |
|-----------|----------|
| HIPAA (US) | Privacy Rule, Security Rule, Breach Notification, 42 CFR Part 2 |
| GDPR (EU) | Data subject rights, DPIA, cross-border transfers |
| EHDS (EU 2025/327) | European Health Data Space alignment |
| 21st Century Cures Act | Information blocking, ONC certification |
| ISO 27001 / 27799 | Information security management |
| 30+ jurisdictions | Global privacy law matrix (US, EU, UK, CA, AU, PH, SG, JP, KR, IN, BR, etc.) |

---

## Localization Packs

Country-specific code systems, identifiers, and value sets following the "global core, local extensions" principle.

| Country | Code Systems | Key Identifiers |
|---------|-------------|-----------------|
| **Philippines** | PNDF, RVS, PhilHealth | PhilHealth PIN, PRC License, HRN |
| **United States** | ICD-10-CM, CPT, NDC, HCPCS | NPI, DEA, SSN, MBI |
| **United Kingdom** | SNOMED UK, dm+d, OPCS-4 | NHS Number, GMC, GPhC |
| **Australia** | ICD-10-AM, ACHI, PBS, MBS | IHI, HPI-I, Medicare, AHPRA |
| **Canada** | ICD-10-CA, CCI, DIN, CCDD | Provincial health cards, CPSO |
| **India** | ABDM, NLEM, AYUSH | ABHA, Aadhaar (restricted), NMC |

---

## Industries & Systems Supported

This specification is designed to support the API layer for:

### Healthcare Delivery Systems

| System Type | Coverage Level |
|-------------|---------------|
| **Hospital Information System (HIS)** | Comprehensive — all clinical, administrative, and operational modules |
| **Electronic Medical Records (EMR/EHR)** | Comprehensive — FHIR R4-aligned clinical core |
| **Practice Management System** | Full — scheduling, billing, claims, patient portal |
| **Dental Management System** | Full — 9 dental specialty modules + dental lab + operatory |
| **Clinical Management System** | Full — encounters, orders, results, documentation |
| **Laboratory Information System (LIS)** | Full — specimens, reports, verification, panels |
| **Radiology Information System (RIS)** | Full — imaging studies, DICOM, reports, findings |
| **Pharmacy Management System** | Full — dispensing, interactions, reconciliation, formulary |
| **Telemedicine Platform** | Full — video sessions, async consultations, remote monitoring |
| **Patient Portal** | Full — accounts, booking, messaging, payments, intake |
| **Revenue Cycle Management** | Full — charge capture, claims, payments, fee schedules |

### Specialty-Specific Systems

| Specialty | Modules Available |
|-----------|------------------|
| Emergency Medicine | ED visits, triage, ED board, code blue |
| Critical Care / ICU | Ventilator, flowsheets, severity scores |
| Oncology | Cancer diagnosis, chemo protocols, radiation |
| Cardiology | Cath lab, echo, EP studies, cardiac rehab |
| OB/GYN | Pregnancy, labor, delivery, postpartum |
| Neonatal / NICU | NICU admissions, neonatal vitals, feeding, screening |
| Behavioral Health | Psychiatric assessment, involuntary holds, SUD |
| Rehabilitation | PT/OT/SLP evaluations, sessions, functional outcomes |
| Palliative Care / Hospice | Goals of care, symptom management, IDT |
| Dialysis | HD/PD orders, sessions, access management |
| Post-Acute / LTC / Home Health | SNF MDS, OASIS, ADL assessments |
| Surgical Services | OR management, anesthesia, preference cards |
| Wound Care | Assessment, treatment, dressing orders |
| Respiratory Therapy | RT orders, ABG results, PFTs |

### Operational Systems

| System Type | Coverage |
|-------------|----------|
| Supply Chain / Inventory | Items, batches, consumption, purchase tracking |
| Medical Device Management | Devices, assignments, metrics, calibration |
| Workforce Scheduling | Shifts, time-off, on-call, staffing |
| Quality Management | Incidents, quality measures, peer review |
| Infection Prevention | Surveillance, antibiograms, sterilization |
| Compliance Management | Policies, BAA, CAPA, retention, legal holds |
| Emergency Preparedness | HICS plans, surge capacity, drills |
| Graduate Medical Education | Residency programs, rotations, evaluations |

### Public Health & Research

| System Type | Coverage |
|-------------|----------|
| Public Health Reporting | eCR, ELR, syndromic surveillance |
| Immunization Registry | IIS submission/query, forecast |
| Cancer Registry | Case abstraction, TNM staging |
| Vital Records | Birth/death certificates |
| Trauma Registry | Injury tracking, outcomes |
| Research Data Platform | Cohorts, de-identification, data lineage |
| AI/ML Integration | Model output metadata, evidence tracking |
| Clinical Analytics | Dashboards, reports, KPIs |

---

## Governance Documentation

38 standards documents covering:

| Category | Documents |
|----------|-----------|
| **Governance** | Standards Charter, Entity Catalog, Domain Glossary, Standards Index |
| **Terminology** | Terminology Bindings, Standards Crosswalk |
| **Data Quality** | Data Quality Policy, Identifier Policy, Conformance Guide |
| **Security** | Security & Privacy, Consent Enforcement, Business Rules |
| **AI Readability** | API Side Effects, Use Case Mapping, Event Catalog |
| **Compliance** | HIPAA, GDPR, EHDS, Cures Act, Medical Devices, ISO Standards, Global Privacy Matrix |
| **Interoperability** | FHIR Export, HL7 v2, C-CDA, X12 Claims, NCPDP, DICOM, OMOP, SMART on FHIR, CDS, W3C PROV, Da Vinci, TEFCA, Public Health Reporting |
| **FHIR Artifacts** | FHIR Profiles, FHIR Implementation Guide, Localization Framework |

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Spec Language | [TypeSpec](https://typespec.io/) (Microsoft) v1.5+ |
| Output Format | OpenAPI 3.0 JSON |
| Type Generation | `openapi-typescript` |
| Runtime | Bun |
| Auth Pattern | OAuth 2.0 + SMART on FHIR scopes |
| Package Manager | Bun workspaces |

---

## Build

```bash
bun install                    # Install dependencies
bun run build                  # Generate OpenAPI + TypeScript types
bun run build:openapi          # OpenAPI only
bun run build:types            # TypeScript types only
bun run lint                   # Validate TypeSpec syntax
bun run format                 # Format TypeSpec files
bun run docs                   # Interactive API documentation
```

**Generated outputs:**
- `dist/openapi/openapi.json` — OpenAPI 3.0 specification
- `dist/typescript-types/api.d.ts` — TypeScript type definitions

---

## License

MIT
