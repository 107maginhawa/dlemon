# FHIR Implementation Guide Narrative

**Title:** Monobase Healthcare API FHIR Implementation Guide
**Version:** 1.0.0
**FHIR Version:** R4 (4.0.1)
**IG Publication Date:** 2026-04-14
**Status:** Active

---

## Table of Contents

1. [Introduction and Scope](#introduction-and-scope)
2. [Conformance Language](#conformance-language)
3. [Actors](#actors)
4. [Capability Expectations](#capability-expectations)
5. [Must-Support Definition](#must-support-definition)
6. [Security Considerations](#security-considerations)
7. [Operations Index](#operations-index)
8. [Terminology Requirements](#terminology-requirements)
9. [Downloads Reference](#downloads-reference)

---

## Introduction and Scope

### Purpose

This Implementation Guide (IG) describes how to use the Monobase Healthcare API to exchange clinical, administrative, and financial health information using HL7 FHIR R4. It serves as the authoritative technical narrative for:

- Application developers building integrations with the Monobase platform
- Healthcare organizations deploying Monobase in their environments
- Standards bodies and certification authorities evaluating Monobase's conformance claims
- Payers, providers, and public health agencies exchanging data with Monobase-powered systems

### Scope

This IG covers:
- FHIR profiles and extensions for all resources exposed by the Monobase API
- SMART on FHIR authorization patterns
- Bulk data export operations
- Document generation (C-CDA, IPS, FHIR Document)
- Clinical decision support (CDS Hooks) integration
- Consent and access control behavior
- Audit and provenance tracking

This IG **does not** cover:
- User interface design or implementation
- Infrastructure deployment (cloud, on-premise, hybrid)
- Non-FHIR integrations (HL7 v2, X12) — those are documented separately in the interoperability guides

### Relationship to Other IGs

| IG | Relationship |
|----|-------------|
| US Core 6.1.0 | We derive from US Core profiles; all US Core conformance requirements apply |
| SMART App Launch v2 | We implement SMART for all app authorization |
| HL7 Bulk Data 1.0 | We implement Bulk Data for $export |
| Da Vinci HRex | We align with HRex for payer-provider exchange patterns |
| Da Vinci PDex | We implement PDex for payer member access APIs |
| Da Vinci CRD | We support CRD via CDS Hooks |
| Da Vinci CDex | We support CDex for clinical data submission |
| Da Vinci PAS | We support PAS for prior authorization |
| eCR FHIR IG | We implement eCR for electronic case reporting |
| IPS IG | We generate IPS-conformant documents |
| CARIN Blue Button | We align EOB profiles for payer use cases |

---

## Conformance Language

The key words used in this IG follow RFC 2119:

| Term | Meaning |
|------|---------|
| **SHALL** | An absolute requirement. Failure to implement this element means the implementation is non-conformant. |
| **SHALL NOT** | An absolute prohibition. Implementations are non-conformant if this element is used. |
| **SHOULD** | A recommended practice. Implementations SHOULD follow this unless there are valid reasons not to, and the implications of not following are understood. |
| **SHOULD NOT** | A practice that should be avoided. Implementations may deviate with valid reason. |
| **MAY** | An optional feature. Implementations are free to implement or not implement. |

### Conformance Verbs in Context

| Context | Verb | Meaning |
|---------|------|---------|
| Profile constraints | SHALL | Server must produce; client must consume |
| Operations | SHALL | Must be implemented; must be invocable |
| Search parameters | SHALL | Must be supported |
| Must-Support | SHALL | Must be able to populate and process |
| Recommended patterns | SHOULD | Strongly recommended but not required |
| Optional features | MAY | Implementer's choice |

---

## Actors

This IG defines the following actors and their responsibilities:

### Patient App

A SMART on FHIR application used by patients or their caregivers to access personal health information.

| Capability | Requirement |
|------------|-------------|
| SMART App Launch (standalone) | SHALL support standalone launch |
| Patient scopes | SHALL use `patient/` scopes only |
| OpenID Connect | SHOULD request `openid`, `fhirUser` |
| Offline access | MAY request `offline_access` |
| Read own records | SHALL support reading all USCDI data classes |
| Write own records | MAY support patient-reported data entry |
| Consent management | SHOULD surface active consents to patients |

### Provider App

A SMART on FHIR application used by clinicians, nurses, or other healthcare professionals.

| Capability | Requirement |
|------------|-------------|
| SMART App Launch (EHR + standalone) | SHALL support both launch types |
| User scopes | SHALL use `user/` scopes |
| Patient context | SHALL request `launch/patient` or `launch` |
| Encounter context | SHOULD request `launch/encounter` where applicable |
| CDS Hooks consumer | SHOULD support CDS Hooks card display |
| Read clinical data | SHALL support all USCDI data classes |
| Write clinical data | SHOULD support creation and update of resources |
| Order management | SHOULD support ServiceRequest lifecycle |

### Payer System

A system operated by a health insurance plan or payer organization.

| Capability | Requirement |
|------------|-------------|
| Backend services auth | SHALL use SMART Backend Services for system access |
| System scopes | SHALL use `system/` scopes |
| PDex patient access | SHALL implement PDex Patient Access API |
| Da Vinci CRD | SHOULD implement CRD service |
| Da Vinci CDex | SHOULD support CDex data requests |
| Prior authorization | SHOULD implement PAS |
| Bulk export | SHOULD support $export for population data |

### Public Health Agency

A state or federal public health authority receiving mandatory reports.

| Capability | Requirement |
|------------|-------------|
| eCR reception | SHALL accept eICR documents |
| Reportability response | SHALL return RR within configured SLA |
| NHSN FHIR | SHOULD accept NHSN dQM MeasureReport |
| IIS FHIR | SHOULD accept Immunization resources |
| Syndromic surveillance | MAY accept syndromic ED reports |

### Server (Monobase Platform)

The Monobase API server implementing this IG.

| Capability | Requirement |
|------------|-------------|
| FHIR R4 REST | SHALL implement FHIR R4 RESTful API |
| US Core profiles | SHALL conform to US Core 6.1.0 |
| SMART authorization | SHALL implement SMART App Launch v2 |
| Bulk data | SHALL implement $export |
| Audit logging | SHALL create AuditEvent for all access |
| Provenance | SHALL create Provenance for all writes |
| Consent enforcement | SHALL evaluate Consent resources before data access |
| Break-glass | SHALL support emergency access override |

---

## Capability Expectations

### CapabilityStatement

The server publishes a CapabilityStatement at:

```http
GET /fhir/metadata
Accept: application/fhir+json
```

The CapabilityStatement declares:
- Supported resource types
- Supported interactions (read, search, create, update, delete)
- Supported search parameters
- Supported operations
- Security scheme (SMART on FHIR)

### Supported Interactions by Resource

| Resource | Read | Search | Create | Update | Delete | Operations |
|----------|------|--------|--------|--------|--------|-----------|
| Patient | R | S | C | U | — | $everything, $match, $merge, $export |
| Encounter | R | S | C | U | — | — |
| Condition | R | S | C | U | D* | — |
| Observation | R | S | C | U | D* | — |
| MedicationRequest | R | S | C | U | D* | — |
| Procedure | R | S | C | U | D* | — |
| AllergyIntolerance | R | S | C | U | D* | — |
| Immunization | R | S | C | U | D* | — |
| DiagnosticReport | R | S | C | U | — | — |
| ServiceRequest | R | S | C | U | D* | — |
| Composition | R | S | C | U | — | $document, $cda, $ecr-eicr |
| DocumentReference | R | S | C | U | — | — |
| Claim | R | S | C | U | D* | $x12-837p, $x12-837i |
| Coverage | R | S | C | U | — | — |
| CoverageEligibilityRequest | R | S | C | — | — | $x12-270, $x12-278 |
| CoverageEligibilityResponse | R | S | — | — | — | — |
| ClaimResponse | R | S | — | — | — | — |
| Consent | R | S | C | U | — | — |
| Provenance | R | S | — | — | — | — |
| AuditEvent | R | S | — | — | — | — |
| ImagingStudy | R | S | C | U | — | $presigned-url |
| Device | R | S | C | U | — | — |
| Practitioner | R | S | C | U | — | — |
| PractitionerRole | R | S | C | U | — | — |
| Organization | R | S | C | U | — | — |
| Location | R | S | C | U | — | — |
| MeasureReport | R | S | C | — | — | — |
| Questionnaire | R | S | — | — | — | $populate |
| QuestionnaireResponse | R | S | C | U | — | — |
| Task | R | S | C | U | — | — |
| Appointment | R | S | C | U | D* | — |
| CarePlan | R | S | C | U | — | — |
| Goal | R | S | C | U | — | — |
| CareTeam | R | S | C | U | — | — |

*Logical delete — sets status to entered-in-error; data not physically removed

### System-Level Operations

| Operation | Scope | Description |
|-----------|-------|-------------|
| `$export` | System | Bulk data export (NDJSON) |
| `$export-omop` | System | OMOP CDM export |
| `$validate` | System | Resource validation |
| `$convert` | System | Format conversion (FHIR ↔ C-CDA) |
| `$member-match` | System | PDex member matching |

---

## Must-Support Definition

### What Must-Support Means in This IG

**For Server Systems (Monobase):**
- SHALL be capable of populating Must-Support elements when the data exists in the underlying system
- SHALL NOT suppress or omit Must-Support elements if the data is available
- SHALL return Must-Support elements in search results and read responses

**For Client Applications:**
- SHALL be capable of receiving and processing Must-Support elements without error
- SHOULD display or use Must-Support data appropriately for the use case
- SHALL NOT reject resources because Must-Support elements are present

### Missing Data

When a Must-Support element has no value:

| Situation | Handling |
|-----------|---------|
| Data not known | Use `dataAbsentReason` where applicable; otherwise omit the element |
| Data known to be absent | Use appropriate SNOMED CT "absence" concept or `dataAbsentReason` |
| Data not applicable | Omit the element |
| Privacy restriction | Return resource without the element; add OperationOutcome warning if sensitive |

### Must-Support vs Required (min cardinality)

| Element Type | Must-Support | Min Cardinality | Behavior |
|-------------|-------------|----------------|---------|
| Required + MS | Yes | 1..* | Must be present AND must be supported |
| MS but optional | Yes | 0..* | Must be supported when present; may be absent |
| Required, not MS | No | 1..* | Must be present; client need not process |
| Optional, not MS | No | 0..* | May be present; client need not process |

---

## Security Considerations

### Transport Security

- **TLS 1.3** is required for all connections (TLS 1.2 accepted for legacy compatibility until 2027)
- **HSTS** headers required on all FHIR endpoints
- **Certificate pinning** recommended for mobile applications
- **No HTTP** — all endpoints redirect HTTP to HTTPS with 301

### Authentication

- **SMART on FHIR v2** for all app-based access (patients and providers)
- **Backend Services** for system-to-system access
- **mTLS** for QHIN/TEFCA network connections
- **Identity Assurance Level (IAL):** IAL2 minimum for patient access; IAL2+ for provider access

### Authorization

- **SMART scopes** enforced at API gateway level
- **Patient-context scope** (`patient/`) — access strictly limited to the context patient
- **User-context scope** (`user/`) — access limited to patients the user is authorized for
- **Consent enforcement** — active Consent resources evaluated before data access
- **Break-glass** — emergency access logged and audited; must be reviewed within 24 hours

### Audit Requirements

Every API interaction generates an AuditEvent. Minimum required fields:
- `type` — interaction type (read, create, update, etc.)
- `recorded` — timestamp
- `outcome` — success or failure code
- `agent[requestor]` — the requesting app or user
- `agent[user]` — the authenticated user (may differ from app)
- `entity[patient]` — the patient whose data was accessed (when applicable)
- `purposeOfEvent` — the purpose of use (treatment, payment, operations, etc.)

### Sensitive Data Handling

| Data Type | Special Handling |
|-----------|----------------|
| 42 CFR Part 2 (SUD records) | Consent required for each disclosure; separate `_security = R (restricted)` tag |
| HIV status | State law restrictions apply; `_security = R` or omit without specific consent |
| Mental health notes | May be filtered based on jurisdiction; `_security = R` |
| Genetic information | GINA protections; extra caution for payer access |
| Reproductive health | State law variations; implement per jurisdiction |

---

## Operations Index

### Patient Operations

| Operation | HTTP | Description |
|-----------|------|-------------|
| `Patient/$everything` | GET/POST | Return all resources for a patient |
| `Patient/$match` | POST | Find matching patients |
| `Patient/$merge` | POST | Merge duplicate patient records |
| `Patient/$export` | GET | Bulk export for patient |

### Clinical Operations

| Operation | HTTP | Description |
|-----------|------|-------------|
| `Composition/$document` | GET/POST | Generate FHIR Document Bundle |
| `Composition/$cda` | POST | Generate C-CDA XML document |
| `Encounter/$ecr-eicr` | POST | Generate eCR eICR document |
| `ImagingStudy/$presigned-url` | POST | Generate presigned URL for image access |

### Financial Operations

| Operation | HTTP | Description |
|-----------|------|-------------|
| `Claim/$x12-837p` | POST | Generate X12 837P professional claim |
| `Claim/$x12-837i` | POST | Generate X12 837I institutional claim |
| `CoverageEligibilityRequest/$x12-270` | POST | Generate X12 270 eligibility inquiry |
| `CoverageEligibilityRequest/$x12-278` | POST | Generate X12 278 prior auth request |

### System Operations

| Operation | HTTP | Description |
|-----------|------|-------------|
| `$export` | GET | System-level bulk export |
| `$export-omop` | POST | OMOP CDM bulk export |
| `$validate` | POST | Validate a FHIR resource |
| `$convert` | POST | Convert between formats |
| `$member-match` | POST | PDex member matching |
| `$rtpb` | POST | Real-time pharmacy benefit query |

### CDS Hooks Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/cds-services` | GET | CDS service discovery |
| `/cds-services/{id}` | POST | Call a CDS service |
| `/cds-services/{id}/feedback` | POST | Submit CDS feedback |

---

## Terminology Requirements

### Required Code Systems

Implementers SHALL use the following code systems where applicable:

| Code System | OID / URL | Purpose |
|------------|-----------|---------|
| SNOMED CT (US Edition) | `http://snomed.info/sct` | Clinical concepts, body sites, findings |
| LOINC | `http://loinc.org` | Laboratory tests, observations, document types |
| RxNorm | `http://www.nlm.nih.gov/research/umls/rxnorm` | Medications |
| ICD-10-CM | `http://hl7.org/fhir/sid/icd-10-cm` | Diagnoses |
| ICD-10-PCS | `http://www.cms.gov/Medicare/Coding/ICD10` | Inpatient procedures |
| CPT-4 | `http://www.ama-assn.org/go/cpt` | Outpatient procedures and E&M codes |
| HCPCS | `https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets` | Additional procedures |
| CVX | `http://hl7.org/fhir/sid/cvx` | Vaccine codes |
| NDC | `http://hl7.org/fhir/sid/ndc` | Drug packaging codes |
| NPI | `http://hl7.org/fhir/sid/us-npi` | Provider identification |
| UCUM | `http://unitsofmeasure.org` | Units of measure |

### Terminology Binding Strengths

| Strength | Meaning |
|----------|---------|
| Required | SHALL use codes from the specified value set |
| Extensible | SHOULD use codes from the value set; MAY use others if needed |
| Preferred | SHOULD use codes from the value set |
| Example | Example codes provided; any code system may be used |

### Terminology Server

Our FHIR terminology server provides:
- `GET /fhir/ValueSet/{id}/$expand` — expand a value set
- `POST /fhir/ValueSet/$expand` — expand with filter
- `POST /fhir/CodeSystem/$lookup` — look up a code
- `POST /fhir/ConceptMap/$translate` — translate between code systems

---

## Downloads Reference

### Machine-Readable Artifacts

| Artifact | Format | Location |
|----------|--------|---------|
| CapabilityStatement | JSON | `/fhir/metadata` |
| StructureDefinition (all profiles) | JSON/XML | `/fhir/StructureDefinition?publisher=Monobase` |
| ValueSet (all) | JSON/XML | `/fhir/ValueSet?publisher=Monobase` |
| CodeSystem (custom) | JSON/XML | `/fhir/CodeSystem?publisher=Monobase` |
| ConceptMap | JSON/XML | `/fhir/ConceptMap?publisher=Monobase` |
| NamingSystem | JSON/XML | `/fhir/NamingSystem?publisher=Monobase` |
| IG Package | NPM (tgz) | `https://packages.monobase.health/monobase.health.api-1.0.0.tgz` |

### Human-Readable Documentation

| Document | Description | Location |
|----------|-------------|---------|
| Standards Index | Master index of all standards docs | `docs/standards/standards-index.md` |
| FHIR Profiles | Per-resource profile definitions | `docs/standards/fhir-profiles.md` |
| FHIR Implementation Guide | This document | `docs/standards/fhir-implementation-guide.md` |
| Consent Enforcement | Runtime consent algorithm | `docs/standards/consent-enforcement.md` |
| SMART on FHIR | Authorization guide | `docs/standards/interop/smart-on-fhir.md` |
| HIPAA Compliance | HIPAA implementation | `docs/standards/compliance/hipaa.md` |
| GDPR Compliance | GDPR implementation | `docs/standards/compliance/gdpr.md` |

### Validation Tools

| Tool | Description |
|------|-------------|
| `POST /fhir/$validate` | Server-side validation against our profiles |
| HL7 FHIR Validator | Official HL7 Java-based validator |
| Inferno | ONC certification test framework |
| TouchStone | Aegis conformance testing |
