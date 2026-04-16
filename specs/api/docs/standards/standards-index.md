# Standards Documentation Index

**Project:** Monobase Healthcare API — Standards Foundation
**Last Updated:** 2026-04-14

This is the master index of all standards documentation for the Monobase Healthcare API. Use this document to navigate to any specification, compliance guide, or interoperability standard.

---

## Quick Navigation

| Category | Documents | Primary Audience |
|----------|-----------|-----------------|
| [Governance](#governance) | 2 docs | All developers |
| [Compliance](#compliance) | 7 docs | Compliance, Legal, Engineering |
| [Interoperability](#interoperability) | 13 docs | Integration engineers |
| [FHIR Artifacts](#fhir-artifacts) | 2 docs | FHIR developers |

---

## Governance

Core documents defining the structure and conformance of the API.

| Document | Path | Description |
|----------|------|-------------|
| **FHIR Profiles** | `docs/standards/fhir-profiles.md` | Per-resource FHIR R4 profile definitions: base resources, extensions added, constrained fields, must-support flags for all ~50 resources |
| **FHIR Implementation Guide** | `docs/standards/fhir-implementation-guide.md` | Human-readable IG narrative: conformance language, actors, capability expectations, must-support definition, security, operations index, terminology |
| **Consent Enforcement** | `docs/standards/consent-enforcement.md` | Runtime consent evaluation algorithm, opt-in/opt-out defaults by jurisdiction, cascade rules, field-level consent, break-glass override, 42 CFR Part 2 |
| **Standards Index** | `docs/standards/standards-index.md` | This document |

---

## Compliance

Regulatory and legal compliance documentation organized by jurisdiction and standard.

### United States

| Document | Path | Key Topics |
|----------|------|-----------|
| **HIPAA Compliance Guide** | `docs/standards/compliance/hipaa.md` | Privacy Rule (minimum necessary, de-identification, 18 Safe Harbor identifiers, BAA), Security Rule (administrative/physical/technical safeguards), Breach Notification Rule (60-day timeline, HHS reporting), 42 CFR Part 2 (SUD records — consent required for every disclosure), mapping to audit module, consent model, encryption, access control, provenance |
| **21st Century Cures Act Guide** | `docs/standards/compliance/cures-act.md` | Information blocking definition and all 8 exceptions, ONC certification requirements (§170.315(g)(10)), USCDI v3/v4 data classes, Patient Access API requirements, Promoting Interoperability program, penalties, how our spec prevents information blocking |

### European / Global

| Document | Path | Key Topics |
|----------|------|-----------|
| **GDPR Compliance Guide** | `docs/standards/compliance/gdpr.md` | 6 lawful bases, Article 9 special category (health), all 7 data subject rights with deadlines, DPIA requirements, DPO requirements, cross-border transfer mechanisms (SCCs, BCRs, EU-US DPF), 72-hour breach notification, children's data (Art. 8), mapping to Patient/$everything (Art. 15), $export (Art. 20), Consent resource (legal basis), Provenance (accountability) |
| **EHDS Guide** | `docs/standards/compliance/ehds.md` | EU Regulation 2025/327 (effective March 2025), primary use (citizen rights, MyHealth@EU, cross-border), secondary use (HDABs, secure processing environments, data permits), EHR system requirements (EHERF), implementation timeline 2025–2029, IPS mandatory requirement, alignment with Composition/IPS, Consent, bulk export |

### Global Privacy Matrix

| Document | Path | Key Topics |
|----------|------|-----------|
| **Global Privacy Law Matrix** | `docs/standards/compliance/global-privacy-matrix.md` | 30+ jurisdictions in tabular format: US federal (HIPAA), US states (CA, NY, TX, WA, CO), Canada (PIPEDA, PHIPA, HIA), Australia, EU (GDPR), UK, Philippines, Singapore, Japan, South Korea, India (DPDP 2023), Thailand, Malaysia, Indonesia, UAE, Saudi Arabia, South Africa (POPIA), Kenya, Nigeria, Brazil (LGPD), Mexico, Argentina, Colombia. Columns: law, consent model, right to delete, breach timeline, data residency, DPO required, penalties, healthcare notes |

### Standards and Regulatory

| Document | Path | Key Topics |
|----------|------|-----------|
| **Medical Device Regulation Guide** | `docs/standards/compliance/medical-devices.md` | When software is/is not a medical device, FDA SaMD classification (Class I/II/III), IMDRF framework, 510(k) pathway, IEC 62304 software lifecycle classes (A/B/C) and SOUP, EU MDR 2017/745 and IVDR 2017/746 (Rule 11 for software), CE marking process, UDI (FDA GUDID + EU EUDAMED), GMDN coding, UK clinical safety (DCB0129/DCB0160), our Device model alignment |
| **ISO Standards Alignment** | `docs/standards/compliance/iso-standards.md` | ISO 27001 (ISMS — Annex A controls, HIPAA mapping), ISO 27799 (health informatics security), ISO 22600 (RBAC/ABAC privilege management), ISO 13131 (telehealth), ISO 13606 (EHR communication and FHIR mapping), ISO IDMP series 11615/11616/11238 (medicinal product identification, SPOR/FHIR mapping), ISO 18308 (EHR architecture requirements) |

---

## Interoperability

Technical integration guides for specific standards and systems.

### FHIR-Based

| Document | Path | Key Topics |
|----------|------|-----------|
| **FHIR R4 Export Layer Spec** | `docs/standards/interop/fhir-export.md` | Per-resource field mapping (our model → FHIR R4 JSON) for all 13 key resources: Patient, Encounter, Condition, Observation, MedicationRequest, Procedure, AllergyIntolerance, Immunization, ServiceRequest, DiagnosticReport, Claim, Coverage, Composition. Extension URIs, content negotiation, Bundle generation |
| **SMART on FHIR v2** | `docs/standards/interop/smart-on-fhir.md` | OAuth 2.0 + PKCE authorization flow, well-known configuration endpoint, standalone and EHR launch, launch contexts (patient/encounter), SMART scopes (patient/user/system), token lifecycle, introspection (RFC 7662), backend services (client_credentials + JWT), scope→resource→operation mapping table |
| **CDS Hooks + CQL** | `docs/standards/interop/cds-implementation.md` | Supported hooks (patient-view, order-sign, order-select, encounter-start, encounter-discharge, medication-prescribe), CDS service discovery, hook request/response structure, CDS card format, override/accept workflow with audit, CQL library management (Library resource), PlanDefinition for order sets, CQL engine requirements, our 12 CDS services |

### HL7 and Legacy Standards

| Document | Path | Key Topics |
|----------|------|-----------|
| **HL7 v2 Integration Guide** | `docs/standards/interop/hl7v2-integration.md` | Message type mappings: ADT^A01→Encounter, ADT^A03→discharge, ADT^A08→Patient update, ORM^O01→ServiceRequest, ORU^R01→Observation+DiagnosticReport, RGV^O15→MedicationAdministration, DFT^P03→Claim, SCH^S12→Appointment. Segment mappings: PID→Patient, PV1→Encounter, OBR→ServiceRequest, OBX→Observation, RXA→Immunization. Error handling, inbound/outbound patterns |
| **C-CDA Document Generation** | `docs/standards/interop/ccda-generation.md` | C-CDA R4.0 generation from Composition + referenced resources. Document type template OIDs: CCD (2.16.840.1.113883.10.20.22.1.2), Discharge Summary, Consultation Note, Progress Note, Referral Note. Section-to-template mapping, required/optional sections per document type, XML structure overview with examples, FHIR→CDA terminology mapping |

### Claims and Financial

| Document | Path | Key Topics |
|----------|------|-----------|
| **X12 EDI Healthcare Claims** | `docs/standards/interop/x12-claims.md` | 837P (professional) loop structure and Claim→segment mapping; 837I (institutional) — revenue codes, type of bill, key differences; 837D (dental) — SV3 dental service line; 270/271 eligibility (CoverageEligibilityRequest/Response); 278 prior authorization; 835 remittance (ClaimResponse, CARC codes). Common segment reference (NM1, REF) |
| **NCPDP SCRIPT ePrescribing** | `docs/standards/interop/ncpdp-eprescribing.md` | MedicationRequest→NewRx SCRIPT v2023011 mapping (patient, prescriber, pharmacy, medication elements). Workflow messages: RxRenewal, RxChange, CancelRx, RxFill. EPCS requirements (two-factor auth, DEA schedule enforcement, digital signature). RTPB real-time pharmacy benefit query. Surescripts integration notes and certification |

### Imaging and Research

| Document | Path | Key Topics |
|----------|------|-----------|
| **DICOM/DICOMweb Integration** | `docs/standards/interop/dicom-integration.md` | ImagingStudy → DICOM Study/Series/Instance hierarchy. DICOMweb: QIDO-RS (query by patient/study/modality/date), WADO-RS (retrieve study/series/instance/rendered/thumbnail), STOW-RS (store instances). WADO-URI legacy. PACS integration patterns (archive, broker, hybrid). Presigned URL pattern. Modality code mapping |
| **OMOP CDM Export Guide** | `docs/standards/interop/omop-export.md` | Full OMOP v5.4 mapping: Patient→PERSON, Encounter→VISIT_OCCURRENCE, Condition→CONDITION_OCCURRENCE, MedicationRequest→DRUG_EXPOSURE, Observation→MEASUREMENT+OBSERVATION, Procedure→PROCEDURE_OCCURRENCE, Provider→PROVIDER, Organization→CARE_SITE, Specimen→SPECIMEN. Vocabulary mappings: SNOMED→OMOP, LOINC→OMOP, RxNorm→OMOP, ICD-10→OMOP. ETL considerations, pseudonymization, observation period derivation |

### Provenance and Exchange Frameworks

| Document | Path | Key Topics |
|----------|------|-----------|
| **W3C PROV Ontology Alignment** | `docs/standards/interop/w3c-prov-alignment.md` | W3C PROV-DM core types (Entity, Activity, Agent) and all 11 relations. ProvenanceRecord→prov:Activity, ProvenanceAgent→prov:Agent, ProvenanceEntity→prov:Entity mapping. FHIR Provenance resource alignment. Serialization: PROV-N, PROV-JSON, PROV-O (Turtle/JSON-LD). Healthcare provenance patterns (documentation chain, lab results, amendments, consent-driven disclosure) |
| **HL7 Da Vinci Integration** | `docs/standards/interop/davinci-integration.md` | HRex (base profiles, task-based exchange, consent for payer-provider), PDex (payer data exchange, member access API, payer-to-payer, $member-match, EOB profiles), CRD (CDS Hooks for coverage requirements, card types), CDex (clinical data submission, $submit-attachment), DTR (SMART app for documentation templates, Questionnaire/CQL), PAS (FHIR prior authorization), DEQM (quality measure reporting) |
| **TEFCA v2.1 Alignment** | `docs/standards/interop/tefca-alignment.md` | TEFCA framework (TEF, Common Agreement, QHIN/Participant hierarchy), Trusted Exchange Framework principles, QHIN technical requirements (mTLS, PKI, directory), exchange purposes (Treatment, Payment, Operations, Individual Access, Public Health, Government Benefits), minimum required data per purpose, privacy and security obligations, our FHIR/US Core alignment |
| **Public Health Reporting** | `docs/standards/interop/public-health-reporting.md` | eCR: eICR generation from Encounter+Conditions, trigger code detection (RCTC), reportability response handling, status codes. NHSN dQM: HAI reporting via FHIR MeasureReport (CLABSI example). Syndromic surveillance: ED visit reporting triggers. IIS: Immunization FHIR push/pull + HL7 v2 VXU gateway. Cancer registries: pathology DiagnosticReport. Reporting capability matrix |

---

## FHIR Artifacts

Machine-readable artifacts published alongside this documentation.

| Artifact Type | Location | Description |
|--------------|----------|-------------|
| CapabilityStatement | `/fhir/metadata` | Declares all supported resources, interactions, search parameters, and operations |
| StructureDefinition (profiles) | `/fhir/StructureDefinition?publisher=Monobase` | All custom FHIR profiles |
| StructureDefinition (extensions) | `/fhir/StructureDefinition?kind=complex-type&publisher=Monobase` | All custom extensions |
| ValueSet | `/fhir/ValueSet?publisher=Monobase` | Custom value sets |
| CodeSystem | `/fhir/CodeSystem?publisher=Monobase` | Custom code systems |
| ConceptMap | `/fhir/ConceptMap?publisher=Monobase` | Concept mappings (FHIR↔OMOP, etc.) |
| ImplementationGuide | `/fhir/ImplementationGuide/monobase-health-api` | Machine-readable IG resource |
| NPM Package | `https://packages.monobase.health/monobase.health.api-1.0.0.tgz` | Complete IG as NPM package |

---

## Document Status

| Status | Meaning |
|--------|---------|
| Active | Current, authoritative, in production use |
| Draft | Under development; subject to change |
| Deprecated | Superseded; maintained for reference only |
| Retired | No longer applicable |

| Document | Status | Version | Last Review |
|----------|--------|---------|------------|
| HIPAA Compliance Guide | Active | 1.0 | 2026-04-14 |
| GDPR Compliance Guide | Active | 1.0 | 2026-04-14 |
| EHDS Guide | Active | 1.0 | 2026-04-14 |
| Global Privacy Matrix | Active | 1.0 | 2026-04-14 |
| 21st Century Cures Act Guide | Active | 1.0 | 2026-04-14 |
| Medical Device Regulation Guide | Active | 1.0 | 2026-04-14 |
| ISO Standards Alignment | Active | 1.0 | 2026-04-14 |
| FHIR R4 Export Layer Spec | Active | 1.0 | 2026-04-14 |
| HL7 v2 Integration Guide | Active | 1.0 | 2026-04-14 |
| C-CDA Generation Guide | Active | 1.0 | 2026-04-14 |
| X12 EDI Claims Guide | Active | 1.0 | 2026-04-14 |
| NCPDP SCRIPT ePrescribing | Active | 1.0 | 2026-04-14 |
| DICOM/DICOMweb Integration | Active | 1.0 | 2026-04-14 |
| OMOP CDM Export Guide | Active | 1.0 | 2026-04-14 |
| SMART on FHIR v2 | Active | 1.0 | 2026-04-14 |
| CDS Hooks + CQL | Active | 1.0 | 2026-04-14 |
| W3C PROV Alignment | Active | 1.0 | 2026-04-14 |
| Da Vinci Integration | Active | 1.0 | 2026-04-14 |
| TEFCA v2.1 Alignment | Active | 1.0 | 2026-04-14 |
| Public Health Reporting | Active | 1.0 | 2026-04-14 |
| FHIR Profiles | Active | 1.0 | 2026-04-14 |
| FHIR Implementation Guide | Active | 1.0 | 2026-04-14 |
| Consent Enforcement | Active | 1.0 | 2026-04-14 |
| Standards Index | Active | 1.0 | 2026-04-14 |

---

## Finding the Right Document

### "I need to understand our HIPAA obligations"
→ `compliance/hipaa.md`

### "I need to know if a patient can delete their data in Germany"
→ `compliance/gdpr.md` (Article 17 — Right to Erasure)

### "I'm building a FHIR app and need to know what scopes to request"
→ `interop/smart-on-fhir.md` (SMART Scopes section)

### "I need to integrate with a hospital's HL7 v2 ADT feed"
→ `interop/hl7v2-integration.md`

### "I'm setting up DICOM image access"
→ `interop/dicom-integration.md`

### "I need to submit electronic claims to Medicare"
→ `interop/x12-claims.md` (837I section)

### "I need to generate an International Patient Summary"
→ `compliance/ehds.md` (IPS section) + `interop/fhir-export.md` (Composition section)

### "How do I connect to Surescripts for ePrescribing?"
→ `interop/ncpdp-eprescribing.md`

### "What coding system should I use for medications?"
→ `interop/fhir-export.md` (MedicationRequest section) + `interop/omop-export.md` (Vocabulary section)

### "What are the consent rules for substance abuse records?"
→ `compliance/hipaa.md` (42 CFR Part 2 section) + `consent-enforcement.md` (42 CFR Part 2 Special Handling)

### "We're deploying in Saudi Arabia — what data residency rules apply?"
→ `compliance/global-privacy-matrix.md` (Saudi Arabia row)

### "How do I report a notifiable disease electronically?"
→ `interop/public-health-reporting.md` (eCR section)

### "How does the consent evaluation algorithm work?"
→ `consent-enforcement.md` (Consent Evaluation Algorithm section)

### "How do I export data to an OMOP research network?"
→ `interop/omop-export.md`

### "What CDS Hooks do we support for prior authorization?"
→ `interop/cds-implementation.md` + `interop/davinci-integration.md` (CRD section)
