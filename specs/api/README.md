# Monobase Open Health Specs

A global-grade, FHIR R4-informed healthcare API specification covering the full spectrum of health information systems — from primary care clinics to tertiary hospitals, dental practices, post-acute facilities, and public health agencies.

| Stat | Value |
|------|-------|
| API paths | **937** |
| OpenAPI schemas | **1,183** |
| Total operations | **1,542** |
| TypeSpec source files | **152** |
| Standards documents | **38** |
| Localization packs | **6** (PH, US, UK, AU, CA, IN) |

> Built with [TypeSpec](https://typespec.io/) (Microsoft) v1.3+. Generates OpenAPI 3.0 JSON and TypeScript type definitions. Package: `@monobase/api-spec`.

---

## What This Is

This is a **specification-only project** — no runtime implementation. It defines the complete API contract (endpoints, schemas, operations, validation rules, security roles, and business rules) for healthcare applications.

The spec generates:

- **OpenAPI 3.0 JSON** — `dist/openapi/openapi.json` — machine-readable contract consumable by any language or framework
- **TypeScript type definitions** — `dist/typescript-types/api.d.ts` — type-safe contracts for TypeScript and JavaScript applications
- **Interactive API documentation** — via Scalar UI, served locally

Any team can take this spec and implement it in their stack of choice: Node.js, Bun, Go, Rust, Java, .NET, Python, or any other runtime. The specification is the source of truth; implementations derive from it.

### Design Mission

> Define, maintain, and evolve a globally coherent healthcare API standard that makes it trivially correct to build interoperable health software, and structurally difficult to build siloed, non-interoperable systems.

The foundation follows a **canonical before local** principle: every entity is defined once at the global level. Country-specific extensions are layered through localization packs without forking the core model.

---

## Quick Start

```bash
bun install                    # Install dependencies
bun run build                  # Generate OpenAPI + TypeScript types
bun run docs                   # Start interactive API documentation server
```

**Generated outputs:**

| File | Description |
|------|-------------|
| `dist/openapi/openapi.json` | OpenAPI 3.0 specification |
| `dist/openapi/openapi.yaml` | OpenAPI 3.0 specification (YAML format) |
| `dist/typescript-types/api.d.ts` | TypeScript type definitions |

---

## Build Commands

```bash
bun install                    # Install dependencies
bun run build                  # Generate OpenAPI + TypeScript types (full build)
bun run build:openapi          # Generate OpenAPI JSON only
bun run build:types            # Generate TypeScript types from OpenAPI
bun run lint                   # Validate TypeSpec syntax (no emit)
bun run format                 # Format TypeSpec source files
bun run docs                   # Serve interactive API documentation
bun run clean                  # Remove dist/ and tsp-output/
```

---

## Directory Structure

```
specs/api/
  src/
    main.tsp                   # Root — imports all modules, wires all interfaces
    common/
      models.tsp               # Shared base models, response envelopes
      errors.tsp               # Error schemas and problem detail types
      pagination.tsp           # Cursor/offset pagination primitives
      security.tsp             # OAuth 2.0 / SMART on FHIR security definitions
    modules/                   # Platform infrastructure (9 modules)
      person.tsp
      patient.tsp
      provider.tsp
      audit.tsp
      notifs.tsp
      comms.tsp
      storage.tsp
      email.tsp
      reviews.tsp
    healthcare/
      core/
        primitives.tsp         # FHIR-aligned data types (CodeableConcept, Reference, etc.)
        terminology.tsp        # Coding system URIs, administrative value sets
      foundation/
        organization.tsp       # Healthcare organizations, facilities
        location.tsp           # Rooms, beds, departments, virtual locations
      clinical/                # 17 core clinical modules + 10 hospital specialties + 6 wave-3 specialties
      administrative/          # 10 administrative modules + 3 hospital-specific modules
      ancillary/               # 15 ancillary modules (lab, pharmacy, radiology, dental)
      support/                 # 17 support modules + 5 public health modules
      operational/             # 7 operational modules + 7 hospital operations modules
      conformance/             # 6 FHIR conformance modules
      compliance/              # 2 compliance and governance modules
      analytics/               # 4 analytics and research modules
    localization/
      ph/                      # Philippines
      us/                      # United States
      uk/                      # United Kingdom
      au/                      # Australia
      ca/                      # Canada
      in/                      # India
  docs/
    standards/                 # 38 governance and standards documents
  dist/                        # Generated outputs (gitignored)
    openapi/openapi.json
    typescript-types/api.d.ts
```

---

## Operations by Domain

| Domain | Operations | Description |
|--------|-----------|-------------|
| Healthcare:Clinical | **423** | Encounters, conditions, orders, results, hospital specialties |
| Healthcare:Ancillary | **242** | Lab, pharmacy, radiology, dental, blood bank |
| Healthcare:Operational | **234** | Inventory, devices, portal, hospital operations |
| Healthcare:Administrative | **207** | Scheduling, billing, claims, credentialing, workforce |
| Healthcare:Support | **172** | Care plans, consent, CDS, telehealth, public health |
| Healthcare:Compliance | **58** | Policies, BAA, CAPA, privacy workflows |
| Healthcare:PublicHealth | **56** | eCR, IIS, vital records, cancer registry, surveillance |
| Healthcare:Analytics | **42** | De-identification, cohorts, AI metadata, reporting |
| Healthcare:Conformance | **38** | FHIR operations, terminology, bulk data, subscriptions |
| Healthcare:Foundation | **15** | Organizations, locations, departments |
| Platform (Person, Provider, Patient, Comms, etc.) | **55** | Infrastructure modules |

---

## Module Catalog

### Platform Infrastructure

| Module | File | Key Capabilities |
|--------|------|-----------------|
| Person | `modules/person.tsp` | Central PII management, identity, consent preferences |
| Patient | `modules/patient.tsp` | Patient demographics, MRN, communication prefs, merge/unmerge |
| Provider | `modules/provider.tsp` | Practitioner, PractitionerRole, NPI, DEA, state licenses, specialties |
| Audit | `modules/audit.tsp` | Immutable audit trail, HIPAA-compliant retention, SIEM integration |
| Notifications | `modules/notifs.tsp` | Multi-channel delivery (email, push, in-app) with tracking |
| Communications | `modules/comms.tsp` | WebRTC video calls, secure messaging |
| Storage | `modules/storage.tsp` | S3/MinIO file management, presigned URLs, virus scanning |
| Email | `modules/email.tsp` | Transactional email, template management, multi-provider |
| Reviews | `modules/reviews.tsp` | NPS feedback collection across appointments and services |

### Healthcare Foundation

| Module | File | FHIR Resource | Key Capabilities |
|--------|------|--------------|-----------------|
| Organization | `healthcare/foundation/organization.tsp` | Organization | Hospitals, clinics, labs, pharmacies, departments |
| Location | `healthcare/foundation/location.tsp` | Location | Rooms, beds, wings, departments, virtual locations |

### Clinical Domain

| Module | File | FHIR Resource | Terminology |
|--------|------|--------------|-------------|
| Encounter | `healthcare/clinical/encounter.tsp` | Encounter | v3 ActEncounterCode |
| Condition | `healthcare/clinical/condition.tsp` | Condition | ICD-10, SNOMED CT |
| Observation | `healthcare/clinical/observation.tsp` | Observation | LOINC |
| Medication Request | `healthcare/clinical/medication-request.tsp` | MedicationRequest | RxNorm, NDC |
| Procedure | `healthcare/clinical/procedure.tsp` | Procedure | CPT, SNOMED CT |
| Allergy/Intolerance | `healthcare/clinical/allergy.tsp` | AllergyIntolerance | SNOMED CT |
| Immunization | `healthcare/clinical/immunization.tsp` | Immunization | CVX |
| Service Request | `healthcare/clinical/service-request.tsp` | ServiceRequest | LOINC, CPT |
| Document Reference | `healthcare/clinical/document-reference.tsp` | DocumentReference | LOINC |
| Composition | `healthcare/clinical/composition.tsp` | Composition | LOINC sections |
| Family History | `healthcare/clinical/family-history.tsp` | FamilyMemberHistory | SNOMED CT |
| Related Person | `healthcare/clinical/related-person.tsp` | RelatedPerson | — |
| Episode of Care | `healthcare/clinical/episode-of-care.tsp` | EpisodeOfCare | — |
| Flag | `healthcare/clinical/flag.tsp` | Flag | SNOMED CT |
| Surgical Management | `healthcare/clinical/surgical-management.tsp` | — | CPT, SNOMED CT |
| Clinical Communication | `healthcare/clinical/clinical-communication.tsp` | — | — |
| ADT Events | `healthcare/clinical/adt-events.tsp` | — | HL7 v2 parity |

### Hospital Clinical Specialties

| Module | File | Key Entities |
|--------|------|-------------|
| Emergency Department | `clinical/hospital/emergency-department.tsp` | ED visits, triage (ESI), ED board, metrics |
| Nursing Assessment | `clinical/hospital/nursing-assessment.tsp` | Fall risk (Morse), pressure injury (Braden), pain, wound |
| Order Management | `clinical/hospital/order-management.tsp` | CPOE, order sets, order verification, co-sign |
| ICU / Critical Care | `clinical/hospital/icu-critical-care.tsp` | Ventilator management, flowsheets, APACHE/SOFA/NEWS2 |
| Labor and Delivery | `clinical/hospital/labor-delivery.tsp` | Pregnancy, labor, newborn, postpartum |
| Oncology | `clinical/hospital/oncology.tsp` | Cancer diagnosis, chemo protocols/cycles, radiation therapy |
| Dialysis | `clinical/hospital/dialysis.tsp` | HD/PD orders, sessions, vascular access |
| Behavioral Health | `clinical/hospital/behavioral-health.tsp` | Psychiatric assessment, involuntary holds, substance use |
| Wound Care | `clinical/hospital/wound-care.tsp` | Wound assessment, treatment, dressing orders |
| Code Blue | `clinical/hospital/code-blue.tsp` | Emergency response events, teams, debriefs |
| Cardiology | `clinical/hospital/specialty/cardiology.tsp` | Cath lab, echocardiography, EP studies, cardiac rehab |
| Respiratory Therapy | `clinical/hospital/specialty/respiratory-therapy.tsp` | RT orders, treatments, ABG results, PFTs |
| Rehab Therapy | `clinical/hospital/specialty/rehab-therapy.tsp` | PT/OT/SLP referrals, evaluations, sessions, FIM/Barthel |
| Palliative / Hospice | `clinical/hospital/specialty/palliative-hospice.tsp` | Goals of care, symptom management, hospice eligibility, IDT |
| Post-Acute Care | `clinical/hospital/specialty/post-acute-care.tsp` | SNF (MDS 3.0), home health (OASIS), ADL assessments |
| Neonatal | `clinical/hospital/specialty/neonatal.tsp` | NICU admissions, neonatal vitals, feeding, newborn screening |

### Administrative Domain

| Module | File | Key Capabilities |
|--------|------|-----------------|
| Scheduling | `administrative/scheduling.tsp` | FHIR Schedule/Slot/Appointment with waitlist |
| Bed Management | `administrative/bed-management.tsp` | Bed tracking, assignment, occupancy |
| Insurance | `administrative/insurance.tsp` | Coverage, eligibility verification |
| Claims | `administrative/claims.tsp` | Claim submission, adjudication, ClaimResponse |
| Prior Authorization | `administrative/prior-authorization.tsp` | Pre-auth workflow (CMS-mandated) |
| Staff Credentialing | `administrative/staff-credentialing.tsp` | Credentialing records, clinical privileges |
| Charge Capture | `administrative/charge-capture.tsp` | ChargeItem, ChargeDefinition, CDM |
| Patient Financial | `administrative/patient-financial.tsp` | Payments, receipts, payment plans, promissory notes |
| Fee Schedule | `administrative/fee-schedule.tsp` | Fee schedules, contract rates, discounts |
| Workforce Scheduling | `administrative/workforce-scheduling.tsp` | Shifts, time-off, on-call schedules |
| HIM / ROI | `administrative/hospital/him-roi.tsp` | Release of information, medical record requests, CDI |
| Cost Accounting | `administrative/hospital/cost-accounting.tsp` | Cost centers, allocations, case costing, GL export |
| GME | `administrative/hospital/gme.tsp` | Residency programs, residents, rotations, evaluations |

### Ancillary Services

| Module | File | Key Capabilities |
|--------|------|-----------------|
| Laboratory | `ancillary/laboratory.tsp` | Specimens, diagnostic reports, panels, verification |
| Pharmacy | `ancillary/pharmacy.tsp` | Dispensing, drug interactions, reconciliation, adherence |
| Medication Catalog | `ancillary/medication.tsp` | Drug master, formulary management |
| Medication Administration | `ancillary/medication-administration.tsp` | eMAR, administration records |
| Radiology | `ancillary/radiology.tsp` | Imaging studies (DICOM), radiology reports, findings |
| Blood Bank | `ancillary/blood-bank.tsp` | Blood products, crossmatch, transfusion records |
| Dental (General) | `ancillary/dental.tsp` | Odontogram, treatment plans, CDT codes |
| Periodontal | `ancillary/periodontal.tsp` | Perio exams, pocket depth, furcation, mobility |
| Orthodontic | `ancillary/orthodontic.tsp` | Ortho cases, aligners, stages, progress |
| Endodontic | `ancillary/endodontic.tsp` | Root canal records, canal mapping, obturation |
| Prosthodontic | `ancillary/prosthodontic.tsp` | Crowns/bridges, shade selection, impressions, lab cases |
| Dental Lab | `ancillary/dental-lab.tsp` | Lab cases, providers, communication, returns |
| Pediatric Dental | `ancillary/pediatric-dental.tsp` | Eruption/exfoliation, behavior, fluoride, sealants, space maintainers |
| Cosmetic Dental | `ancillary/cosmetic-dental.tsp` | Cosmetic cases, smile design, whitening, veneers |
| Oral Surgery | `ancillary/oral-surgery-dental.tsp` | Extractions, pathology specimens, post-op, healing follow-up |

### Support Services

| Module | File | Key Capabilities |
|--------|------|-----------------|
| Care Plan | `support/care-plan.tsp` | Care plans, care teams, goals |
| Consent | `support/consent.tsp` | FHIR Consent with provisions and policies |
| CDS Hooks | `support/cds.tsp` | Clinical decision support (patient-view, order-sign, etc.) |
| SDOH | `support/sdoh.tsp` | Social determinants screening, referrals (Gravity Project) |
| Provenance | `support/provenance.tsp` | Who did what, when, why (HIPAA compliance, W3C PROV) |
| Signature | `support/signature.tsp` | Electronic signature and attestation with verification |
| Questionnaire | `support/questionnaire.tsp` | Forms, surveys, conditional logic, responses |
| Task | `support/task.tsp` | Workflow tasks, status transitions |
| Telehealth | `support/telehealth.tsp` | Video sessions, async consultations, remote monitoring |
| Clinical Outcomes | `support/clinical-outcomes.tsp` | Outcome records, benchmarks, reports |
| Incident Reporting | `support/incident-reporting.tsp` | Adverse events, near misses, quality measures |
| Infection Control | `support/infection-control.tsp` | Surveillance, antibiograms |
| Data Import | `support/data-import.tsp` | Import jobs, mappings, validation, error reporting |
| Workflow Automation | `support/workflow-automation.tsp` | Rules, triggers, actions, task queues |
| Proxy Access | `support/proxy-access.tsp` | Guardian delegation with sensitive category exclusions |
| Break-Glass | `support/break-glass.tsp` | Emergency access override with audit and review |
| Mandatory Reporting | `support/mandatory-reporting.tsp` | CPS, elder abuse, communicable disease (19 report types) |

### Public Health

| Module | File | Key Capabilities |
|--------|------|-----------------|
| Electronic Case Reporting | `support/public-health/electronic-case-reporting.tsp` | eCR triggers, submission, reportability response |
| Immunization Registry | `support/public-health/immunization-registry.tsp` | IIS submission, query, forecast recommendations |
| Vital Records | `support/public-health/vital-records.tsp` | Birth certificates, death certificates, fetal death reports |
| Cancer Registry | `support/public-health/cancer-registry.tsp` | Case abstraction, TNM staging, SEER/NPCR |
| Surveillance | `support/public-health/surveillance.tsp` | Syndromic surveillance, ELR, trauma registry |

### Operational

| Module | File | Key Capabilities |
|--------|------|-----------------|
| Inventory | `operational/inventory.tsp` | Items, batches, storage locations, supply consumption |
| Device Management | `operational/device.tsp` | Medical devices, assignments, metrics, calibration |
| Recall and Follow-Up | `operational/recall.tsp` | Recall rules, schedules, campaigns |
| Implant Registry | `operational/implant-registry.tsp` | Implant fixtures, osseointegration, lot-based recalls |
| Operatory | `operational/operatory.tsp` | Dental chair management, assignments, utilization |
| Patient Portal | `operational/patient-portal.tsp` | Portal accounts, online booking, messages, payments, intake |
| External Connectors | `operational/external-connectors.tsp` | Connector management, credentials, sync logs |
| Environmental Services | `operational/hospital/environmental-services.tsp` | Cleaning tasks, schedules, EVS metrics |
| Patient Transport | `operational/hospital/patient-transport.tsp` | Transport requests, teams, dispatch |
| Dietary Services | `operational/hospital/dietary-services.tsp` | Diet orders, meal service, nutrition screening |
| Sterile Processing | `operational/hospital/sterile-processing.tsp` | Instrument sets, autoclave cycles, biological indicators |
| Mortuary | `operational/hospital/mortuary.tsp` | Deceased records, body release, storage |
| Peer Review | `operational/hospital/peer-review.tsp` | Peer review cases, panels, actions (privileged access) |
| Emergency Preparedness | `operational/hospital/emergency-preparedness.tsp` | HICS plans, activations, surge capacity, drills |

### Compliance and Governance

| Module | File | Key Capabilities |
|--------|------|-----------------|
| Compliance Program | `compliance/compliance-program.tsp` | Policies, attestations, BAA lifecycle, CAPA, data retention, legal holds |
| Privacy Workflow | `compliance/privacy-workflow.tsp` | Amendment requests, accounting of disclosures, breach assessment/notification, privacy complaints |

### FHIR Conformance

| Module | File | Key Capabilities |
|--------|------|-----------------|
| Capability Statement | `conformance/capability-statement.tsp` | Machine-readable API capability declaration |
| FHIR Operations | `conformance/fhir-operations.tsp` | $match, $everything, $validate, $document |
| Terminology Service | `conformance/terminology-service.tsp` | $lookup, $expand, $validate-code, $translate |
| Bulk Export / Import | `conformance/bulk-export.tsp` | $export (system/patient/group), $import |
| Subscriptions | `conformance/subscriptions.tsp` | Topic-based pub/sub (FHIR R5-style) |
| IPS | `conformance/ips.tsp` | International Patient Summary (ISO 27269) generation |

### Analytics and Research

| Module | File | Key Capabilities |
|--------|------|-----------------|
| De-Identification | `analytics/de-identification.tsp` | Profiles, pseudonymization, masking rules |
| Cohort | `analytics/cohort.tsp` | Cohort definitions, research extracts, data lineage |
| AI Metadata | `analytics/ai-metadata.tsp` | AI output confidence scores, evidence sources, review workflow |
| Reporting | `analytics/reporting.tsp` | Report definitions, scheduled runs, dashboards |

---

## Standards Alignment

### Coding Systems

All terminology bindings are defined in `src/healthcare/core/terminology.tsp` as authoritative FHIR system URIs.

| System | URI | Scope |
|--------|-----|-------|
| WHO ICD-10 | `http://hl7.org/fhir/sid/icd-10` | Diagnoses (global base) |
| WHO ICD-11 | `http://id.who.int/icd/release/11/mms` | Diagnoses (next-generation) |
| ICD-10-CM | `http://hl7.org/fhir/sid/icd-10-cm` | Diagnoses (US clinical modification) |
| ICD-10-PCS | `http://www.cms.gov/Medicare/Coding/ICD10` | Inpatient procedures (US) |
| ICD-9-CM | `http://hl7.org/fhir/sid/icd-9-cm` | Legacy (migration support) |
| SNOMED CT | `http://snomed.info/sct` | Clinical terminology (global) |
| LOINC | `http://loinc.org` | Observations, lab tests, documents |
| RxNorm | `http://www.nlm.nih.gov/research/umls/rxnorm` | Medications |
| CPT | `http://www.ama-assn.org/go/cpt` | Procedures (US outpatient/physician) |
| HCPCS | `https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets` | Supplies and services (US) |
| CDT | `http://www.ada.org/cdt` | Dental procedures |
| CVX | `http://hl7.org/fhir/sid/cvx` | Vaccines |
| UCUM | `http://unitsofmeasure.org` | Units of measure |
| NDC | `http://hl7.org/fhir/sid/ndc` | Drug products (US) |
| WHO ATC | `http://www.whocc.no/atc` | Drug classification (global) |
| WHO ICF | `http://hl7.org/fhir/sid/icf` | Functioning, disability, rehabilitation |
| NPI | `http://hl7.org/fhir/sid/us-npi` | US healthcare provider identifier |
| NUBC | `https://www.nubc.org/CodeSystem/PatDischargeStatus` | Discharge dispositions |
| CMS POS | `https://www.cms.gov/Medicare/Coding/place-of-service-codes` | Place of service |
| HL7 ActCode | `http://terminology.hl7.org/CodeSystem/v3-ActCode` | HL7 v3 act classification |
| HL7 v2 Tables | `http://terminology.hl7.org/CodeSystem/v2-0203` | HL7 v2 identifier types |

### Interoperability Standards

| Standard | Alignment Level | Coverage |
|----------|----------------|---------|
| HL7 FHIR R4 | **Conform** | All resources FHIR R4-aligned |
| SMART on FHIR v2 | **Conform** | OAuth 2.0 + PKCE scopes documented |
| CDS Hooks v2 | **Conform** | 5 hook types (patient-view, order-sign, etc.) |
| FHIR Bulk Data | **Conform** | $export (system/patient/group) and $import |
| FHIR Subscriptions (R5-style) | **Conform** | Topic-based pub/sub |
| IPS (ISO 27269) | **Conform** | International Patient Summary generation |
| HL7 v2 | **Support** | ADT event model, integration guide |
| C-CDA v4.0 | **Support** | Generation guide documented |
| DICOM / DICOMweb | **Support** | Integration guide documented |
| X12 EDI (837/835/270) | **Support** | Claims mapping documented |
| NCPDP SCRIPT | **Support** | ePrescribing guide documented |
| OMOP CDM | **Support** | Export mapping documented |
| W3C PROV | **Support** | Provenance alignment documented |
| Da Vinci IGs | **Reference** | Payer integration guide |
| TEFCA v2.1 | **Reference** | Alignment documented |
| openEHR | **Reference** | Archetype concepts referenced |

### Compliance Frameworks

| Framework | Coverage |
|-----------|---------|
| HIPAA (US) | Privacy Rule, Security Rule, Breach Notification, 42 CFR Part 2 |
| GDPR (EU) | Data subject rights, DPIA, cross-border transfers |
| EHDS (EU 2025/327) | European Health Data Space alignment |
| 21st Century Cures Act | Information blocking prohibition, ONC certification |
| ISO 27001 / 27799 | Information security management |
| Global privacy matrix | 30+ jurisdictions (US, EU, UK, CA, AU, PH, SG, JP, KR, IN, BR, and others) |

---

## Localization Packs

Country-specific code systems, identifiers, and value sets following the **global core, local extensions** principle. Each pack is standalone and does not modify core entity definitions. Packs are layered on top of the core model by local implementations.

Each pack contains: `code-systems.tsp`, `identifiers.tsp`, `value-sets.tsp`, `terminology-map.tsp`, and a detailed `README.md`.

| Pack | Directory | Code Systems | Key Patient Identifiers | Key Provider Identifiers |
|------|-----------|-------------|------------------------|-------------------------|
| **Philippines** | `localization/ph/` | PNDF, RVS, PhilHealth case types, NHFR | PhilHealth PIN | PRC License (7-digit) |
| **United States** | `localization/us/` | ICD-10-CM, ICD-10-PCS, CPT, HCPCS, NDC, CVX, NUBC | MBI, Medicaid ID, SSN (restricted) | NPI, DEA, state license |
| **United Kingdom** | `localization/uk/` | SNOMED UK edition, dm+d, OPCS-4 | NHS Number | GMC, GPhC |
| **Australia** | `localization/au/` | ICD-10-AM, ACHI, PBS, MBS | IHI, Medicare card, DVA | HPI-I, AHPRA |
| **Canada** | `localization/ca/` | ICD-10-CA, CCI, DIN, CCDD | Provincial health card numbers | CPSO and provincial boards |
| **India** | `localization/in/` | ABDM, NLEM, AYUSH | ABHA (Ayushman Bharat Health Account) | NMC registration |

The US pack additionally includes: HIPAA sensitivity flags (42 CFR Part 2, HIV, mental health, reproductive, genetic, psychotherapy notes), DEA controlled substance schedules I–V, OMB race and ethnicity categories, and minimum necessary access level designations.

---

## Industries and Systems This Spec Powers

### Healthcare Delivery

| System Type | Coverage Level |
|-------------|---------------|
| Hospital Information System (HIS) | Comprehensive — clinical, administrative, ancillary, and operational modules |
| Electronic Medical Record (EMR/EHR) | Comprehensive — FHIR R4-aligned clinical core |
| Practice Management System | Full — scheduling, billing, claims, patient portal |
| Dental Management System | Full — 9 dental specialty modules + dental lab + operatory |
| Clinical Management System | Full — encounters, orders, results, documentation |
| Laboratory Information System (LIS) | Full — specimens, reports, verification, panels |
| Radiology Information System (RIS) | Full — imaging studies, DICOM, reports, findings |
| Pharmacy Management System | Full — dispensing, interactions, reconciliation, formulary |
| Telemedicine Platform | Full — video sessions, async consultations, remote monitoring |
| Patient Portal | Full — accounts, booking, messaging, payments, intake |
| Revenue Cycle Management | Full — charge capture, claims, adjudication, fee schedules |

### Clinical Specialties

| Specialty | Modules Available |
|-----------|-----------------|
| Emergency Medicine | ED visits, triage (ESI), ED board, code blue |
| Critical Care / ICU | Ventilator management, flowsheets, severity scoring (APACHE, SOFA, NEWS2) |
| Oncology | Cancer diagnosis, chemotherapy protocols and cycles, radiation therapy |
| Cardiology | Cath lab, echocardiography, EP studies, cardiac rehab |
| OB/GYN and Labor and Delivery | Pregnancy, labor, delivery, postpartum |
| Neonatal / NICU | Admissions, neonatal vitals, feeding records, newborn screening |
| Behavioral Health | Psychiatric assessment, involuntary holds, substance use disorder |
| Rehabilitation | PT/OT/SLP evaluations, sessions, functional outcomes (FIM, Barthel) |
| Palliative Care / Hospice | Goals of care, symptom management, IDT planning |
| Dialysis | Hemodialysis and peritoneal dialysis orders, sessions, vascular access |
| Post-Acute / LTC / Home Health | SNF MDS 3.0, OASIS assessments, ADL tracking |
| Surgical Services | OR management, anesthesia records, preference cards |
| Wound Care | Wound assessment, treatment protocols, dressing orders |
| Respiratory Therapy | RT orders, ABG results, PFTs, treatment records |

### Operational and Public Health

| System Type | Coverage |
|-------------|---------|
| Supply Chain and Inventory | Items, batches, consumption, device tracking |
| Workforce Scheduling | Shifts, time-off, on-call, staffing coverage |
| Quality Management | Incidents, quality measures, peer review, CAPA |
| Infection Prevention | Surveillance, antibiograms, sterilization verification |
| Compliance Management | Policies, BAA lifecycle, data retention, legal holds |
| Graduate Medical Education | Residency programs, rotations, evaluations, procedure logs |
| Public Health Reporting | eCR, ELR, syndromic surveillance, trauma registry |
| Immunization Registry | IIS submission and query, forecast recommendations |
| Cancer Registry | Case abstraction, TNM staging, SEER/NPCR submission |
| Research and Analytics | Cohorts, de-identification, data lineage, AI metadata |

---

## Governance Documentation

38 standards documents covering design decisions, compliance requirements, interoperability guides, and operational policies.

### Core Governance

| Document | Path |
|----------|------|
| Standards Charter | `docs/standards/standards-charter.md` |
| Standards Index | `docs/standards/standards-index.md` |
| Entity Catalog | `docs/standards/entity-catalog.md` |
| Domain Glossary | `docs/standards/domain-glossary.md` |
| Terminology Bindings | `docs/standards/terminology-bindings.md` |
| Standards Crosswalk | `docs/standards/standards-crosswalk.md` |
| Identifier Policy | `docs/standards/identifier-policy.md` |
| Data Quality Policy | `docs/standards/data-quality-policy.md` |
| Conformance Guide | `docs/standards/conformance-guide.md` |
| Security and Privacy | `docs/standards/security-privacy-healthcare.md` |
| Consent Enforcement | `docs/standards/consent-enforcement.md` |
| Business Rules | `docs/standards/business-rules.md` |
| API Side Effects | `docs/standards/api-side-effects.md` |
| Use Case Mapping | `docs/standards/use-case-mapping.md` |
| Event Catalog | `docs/standards/event-catalog.md` |
| FHIR Profiles | `docs/standards/fhir-profiles.md` |
| FHIR Implementation Guide | `docs/standards/fhir-implementation-guide.md` |
| Localization Framework | `docs/standards/localization-framework.md` |

### Compliance

| Document | Path |
|----------|------|
| HIPAA | `docs/standards/compliance/hipaa.md` |
| GDPR | `docs/standards/compliance/gdpr.md` |
| EHDS | `docs/standards/compliance/ehds.md` |
| 21st Century Cures Act | `docs/standards/compliance/cures-act.md` |
| ISO Standards | `docs/standards/compliance/iso-standards.md` |
| Medical Devices | `docs/standards/compliance/medical-devices.md` |
| Global Privacy Matrix | `docs/standards/compliance/global-privacy-matrix.md` |

### Interoperability Guides

| Document | Path |
|----------|------|
| FHIR Export | `docs/standards/interop/fhir-export.md` |
| SMART on FHIR | `docs/standards/interop/smart-on-fhir.md` |
| CDS Implementation | `docs/standards/interop/cds-implementation.md` |
| HL7 v2 Integration | `docs/standards/interop/hl7v2-integration.md` |
| C-CDA Generation | `docs/standards/interop/ccda-generation.md` |
| X12 Claims | `docs/standards/interop/x12-claims.md` |
| NCPDP ePrescribing | `docs/standards/interop/ncpdp-eprescribing.md` |
| DICOM Integration | `docs/standards/interop/dicom-integration.md` |
| OMOP Export | `docs/standards/interop/omop-export.md` |
| W3C PROV Alignment | `docs/standards/interop/w3c-prov-alignment.md` |
| Da Vinci Integration | `docs/standards/interop/davinci-integration.md` |
| TEFCA Alignment | `docs/standards/interop/tefca-alignment.md` |
| Public Health Reporting | `docs/standards/interop/public-health-reporting.md` |

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Spec language | [TypeSpec](https://typespec.io/) (Microsoft) | ^1.3.0 |
| HTTP/REST library | `@typespec/http`, `@typespec/rest` | ^1.3.0 |
| OpenAPI emitter | `@typespec/openapi3` | ^1.3.0 |
| API versioning | `@typespec/versioning` | ^0.73.0 |
| Output format | OpenAPI 3.0 JSON and YAML | — |
| Type generation | `openapi-typescript` | ^7.4.2 |
| Runtime | Bun | — |
| API docs UI | Scalar (`@scalar/api-reference`) | ^1.34.6 |
| Auth pattern | OAuth 2.0 + SMART on FHIR scopes | — |
| Package manager | Bun workspaces | — |

### Package Exports

The `@monobase/api-spec` package exposes:

```
@monobase/api-spec/openapi.json   →  dist/openapi/openapi.json
@monobase/api-spec/openapi.yaml   →  dist/openapi/openapi.yaml
@monobase/api-spec/types          →  dist/typescript-types/api.d.ts
```

---

## Versioning

The API is versioned via `@typespec/versioning`. The current version is `1.0` (`v1`). All interfaces in `main.tsp` are wired under the `MonobaseHealthcareAPI` namespace with the `@versioned(Versions)` decorator.

```
enum Versions {
  v1: "1.0",  // Initial healthcare API version
}
```

---

## License

MIT
