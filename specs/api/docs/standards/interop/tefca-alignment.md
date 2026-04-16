# TEFCA v2.1 Alignment Guide

**Framework:** Trusted Exchange Framework and Common Agreement (TEFCA) Version 2.1
**Authority:** ONC (Office of the National Coordinator for Health Information Technology)
**Governing Entity:** Recognized Coordinating Entity (RCE) — The Sequoia Project
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [TEFCA Framework Overview](#tefca-framework-overview)
2. [Trusted Exchange Framework (TEF)](#trusted-exchange-framework)
3. [Common Agreement (CA)](#common-agreement)
4. [QHIN Connectivity Requirements](#qhin-connectivity-requirements)
5. [Exchange Purposes](#exchange-purposes)
6. [Minimum Required Information](#minimum-required-information)
7. [Privacy and Security Obligations](#privacy-and-security-obligations)
8. [Our Spec Alignment](#our-spec-alignment)

---

## TEFCA Framework Overview

TEFCA establishes a universal governance and technical floor for nationwide health information exchange. It creates a network of networks enabling interoperability without requiring point-to-point connections.

### TEFCA Structure

```
                    ONC
                     |
               Trusted Exchange
                 Framework (TEF)
                     |
              Recognized Coordinating
                Entity (RCE)
               [The Sequoia Project]
                     |
           Common Agreement (CA)
                     |
          ┌──────────┼──────────┐
          |          |          |
        QHIN1      QHIN2      QHIN3   (Qualified Health Information Networks)
          |          |          |
    ┌─────┴──┐  ┌───┴──┐  ┌───┴────┐
    Part/Org  Part/Org  Part/Org  ...  (Participants and Subparticipants)
```

### Key Actors

| Actor | Description | Examples |
|-------|-------------|---------|
| ONC | Federal authority; established TEF | Department of HHS |
| RCE | Recognized Coordinating Entity; administers Common Agreement | The Sequoia Project |
| QHIN | Qualified Health Information Network; signs CA with RCE | CommonWell, eHealth Exchange, Carequality, KLAS |
| Participant | Signs CA with a QHIN; connects to the network | Health systems, payers, labs |
| Subparticipant | Signs agreement with Participant; accesses network through Participant | Smaller providers, ambulatory practices |

---

## Trusted Exchange Framework

The TEF establishes principles that all participants in TEFCA must follow:

### Foundational Principles

| Principle | Description |
|-----------|-------------|
| Standardization | Use of nationally adopted standards (FHIR R4, US Core) |
| Transparency | Open and honest disclosure of data practices |
| Cooperation | Active participation in the network |
| Security | HIPAA Security Rule plus TEFCA security requirements |
| Access | Individual access to their health data |
| Non-discrimination | No preferential treatment of exchange partners |
| Privacy | HIPAA Privacy Rule plus TEFCA privacy requirements |
| Patient Safety | Data exchange must support patient safety |

### Exchange Governance Requirements

| Requirement | Description |
|-------------|-------------|
| Common Agreement execution | Must execute the CA with the RCE (QHINs) or a QHIN (Participants) |
| Policy compliance | Must maintain and enforce privacy and security policies |
| Dispute resolution | Must participate in RCE dispute resolution process |
| Reporting | Must report metrics and incidents to RCE/QHIN |
| No blocking | Must comply with information blocking regulations |
| Auditing | Must maintain audit logs and make them available for compliance review |

---

## Common Agreement

The Common Agreement (CA) establishes legally binding obligations for QHINs and their Participants.

### CA Key Provisions

| Provision | Requirement |
|-----------|-------------|
| Technical requirements | Comply with Technical Framework (TF) specifications |
| Privacy | Comply with HIPAA and applicable laws; purpose-limited exchange |
| Security | TEFCA Security Requirements (aligned with NIST CSF and HIPAA Security Rule) |
| Accountability | Each party accountable for its own activities and subparticipants |
| Individual rights | Support individual access, correction, and accounting of disclosures |
| Non-discrimination | Cannot discriminate against authorized exchange partners |
| Exchange purposes | Can only exchange for permitted purposes (see Exchange Purposes) |
| Breach notification | Must notify RCE and relevant QHINs of applicable breaches |
| Audit | Must maintain and provide access to audit logs |

### QHIN Technical Framework (QTF)

The QTF specifies mandatory technical requirements:

| Requirement | Specification | TEFCA v2.1 |
|-------------|-------------|------------|
| FHIR Version | FHIR R4 | Required |
| US Core Version | US Core 3.1.1+ | Required |
| SMART on FHIR | v1.0 or v2 | Required |
| Bulk Data | HL7 FHIR Bulk Data 1.0 | Required for some purposes |
| IHE Profiles | IHE PDQ, MHD, QEDm | As applicable |
| Terminology | SNOMED CT, LOINC, RxNorm, ICD-10 | Required |
| Security | TLS 1.2+, mTLS for QHIN connections | Required |
| Audit | ATNA (IHE Audit Trail and Node Authentication) | Required |

---

## QHIN Connectivity Requirements

### QHIN Technical Requirements

| Requirement | Description |
|-------------|-------------|
| Mutual TLS (mTLS) | All QHIN-to-QHIN connections use mTLS |
| PKI certificates | Use of RCE-issued or RCE-approved PKI certificates |
| Endpoint registry | Maintain and expose a FHIR endpoint registry |
| High availability | 99.9% availability SLA |
| Capacity | Handle peak load for network-wide queries |
| Latency | Respond to queries within 5 seconds (or fail gracefully) |

### Directory Services

QHINs maintain participant directories to enable routing:

```http
GET /fhir/Organization?identifier=1234567890&_include=Organization:endpoint
Accept: application/fhir+json
```

**Organization Directory Response:**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "entry": [
    {
      "resource": {
        "resourceType": "Organization",
        "identifier": [{ "system": "http://hl7.org/fhir/sid/us-npi", "value": "1234567890" }],
        "name": "General Hospital",
        "endpoint": [{ "reference": "Endpoint/gen-hosp-fhir" }]
      }
    },
    {
      "resource": {
        "resourceType": "Endpoint",
        "id": "gen-hosp-fhir",
        "status": "active",
        "connectionType": { "system": "http://terminology.hl7.org/CodeSystem/endpoint-connection-type", "code": "hl7-fhir-rest" },
        "address": "https://fhir.generalhospital.org/fhir"
      }
    }
  ]
}
```

---

## Exchange Purposes

TEFCA defines specific exchange purposes. Data may only be exchanged for permitted purposes.

### Purpose Matrix

| Exchange Purpose | Code | Description | Who May Exchange | Required Consent |
|----------------|------|-------------|-----------------|-----------------|
| Treatment | TreatmentPurpose | Care and treatment of individual | Any TEFCA participant | Not required (HIPAA TPO) |
| Payment | PaymentPurpose | Payment for treatment | Healthcare providers, payers | Not required (HIPAA TPO) |
| Healthcare Operations | OperationsPurpose | Quality improvement, training, etc. | Healthcare organizations | Not required (HIPAA TPO) |
| Individual Access | IndividualAccessPurpose | Individual accessing their own data | Individual or individual's authorized representative | Patient authentication required |
| Public Health | PublicHealthPurpose | Reporting to public health authorities | Public health agencies | Varies by law |
| Government Benefits | BenefitDeterminationPurpose | Eligibility for government programs | Government agencies | Varies |
| Clinical Decision Support | CDSPurpose | Real-time clinical decision support | CDS service providers | Not required |
| Electronic Prescribing | ElectronicPrescribingPurpose | ePrescribing and pharmacy fill | Prescribers, pharmacies | Not required |

### Purpose-Specific Requirements

| Purpose | Data Minimization | Authentication | Audit Level |
|---------|-----------------|---------------|------------|
| Treatment | Minimum necessary | Provider authentication (NPI/DEA) | Standard ATNA |
| Individual Access | All data about individual | Identity proofing (IAL2) | Enhanced (user-level) |
| Public Health | As required by law | Agency credentials | Standard |
| Operations | Minimum necessary | Organization credentials | Standard |

---

## Minimum Required Information

TEFCA defines minimum data sets that must be exchanged for each purpose.

### Treatment — Minimum Required Data

When a provider requests data for treatment, the responding party must provide (if available):

| Data Category | FHIR Resource | Notes |
|--------------|--------------|-------|
| Patient demographics | Patient | Name, DOB, gender, address, MRN |
| Allergies and intolerances | AllergyIntolerance | Active allergies |
| Medications | MedicationRequest | Active medications |
| Conditions/Problems | Condition | Active problem list |
| Lab results | Observation, DiagnosticReport | Recent results (12 months) |
| Procedures | Procedure | Recent procedures (12 months) |
| Immunizations | Immunization | Immunization history |
| Clinical notes | DocumentReference | Discharge summaries, consultation notes |
| Vital signs | Observation (vital-signs) | Recent vitals |
| Care team | CareTeam | Current care team members |
| Goals | Goal | Active goals |

### Individual Access — Required Data

When an individual requests their data:

| Data Category | FHIR Resource | TEFCA Requirement |
|--------------|--------------|-----------------|
| Complete record | Patient/$everything | All available data about the individual |
| Claims/EOB | ExplanationOfBenefit | If payer |
| Coverage | Coverage | Current and past coverage |

### Query Operations for TEFCA

| Query Type | FHIR Operation | Use Case |
|-----------|---------------|---------|
| Patient match | POST /Patient/$match | Find patient across networks |
| Patient record | GET /Patient/{id}/$everything | Retrieve all records |
| Document query | GET /DocumentReference | Find specific document types |
| Clinical data | Standard FHIR search | Specific resource types |
| Bulk data | POST /$export | Population-level exchange |

### Patient Matching

TEFCA requires robust patient matching to prevent misidentification. The $match operation uses:

```http
POST /fhir/Patient/$match
Content-Type: application/fhir+json

{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "resource",
      "resource": {
        "resourceType": "Patient",
        "name": [{ "family": "Doe", "given": ["John", "A"] }],
        "birthDate": "1980-01-15",
        "gender": "male",
        "address": [{ "postalCode": "02101" }],
        "identifier": [{ "system": "http://hl7.org/fhir/sid/us-ssn", "value": "555-12-3456" }]
      }
    },
    { "name": "onlyCertainMatches", "valueBoolean": false },
    { "name": "count", "valueInteger": 5 }
  ]
}
```

---

## Privacy and Security Obligations

### Privacy Requirements

| Obligation | Description | Our Implementation |
|-----------|-------------|-------------------|
| Purpose limitation | Only exchange for declared permitted purpose | `AuditEvent.purposeOfEvent` required on all exchanges |
| Minimum necessary | Exchange only what is needed for the purpose | Query-specific scope limiting |
| Individual rights | Support access, correction, accounting | Patient/$everything, amendment workflow, AuditEvent query |
| Sensitive data | 42 CFR Part 2 and state law restrictions | Consent-based filtering of SUD records |
| Consent | Honor patient consent restrictions | Consent resource enforcement at API gateway |
| Breach notification | Notify QHIN of applicable breaches | Incident management process |

### Security Requirements

| Requirement | Standard | Our Implementation |
|-------------|---------|-------------------|
| Authentication | SMART on FHIR v2 | Authorization server with PKCE |
| Authorization | OAuth 2.0 + SMART scopes | Role-based scope enforcement |
| Encryption in transit | TLS 1.2+ | TLS 1.3 preferred; 1.2 minimum |
| Encryption at rest | AES-256 | Database and storage layer |
| Audit logging | IHE ATNA / FHIR AuditEvent | AuditEvent on all exchanges |
| Access control | RBAC + ABAC | PractitionerRole + Consent |
| Vulnerability management | NIST CSF | Regular scanning; patch management |
| Incident response | NIST SP 800-61 | Documented IR procedures |

---

## Our Spec Alignment

### FHIR R4 and US Core Compliance

| TEFCA Requirement | Our Implementation | Status |
|------------------|-------------------|--------|
| FHIR R4 | All endpoints return FHIR R4 resources | Compliant |
| US Core 6.1.0 | All resources conform to US Core profiles | Compliant |
| SMART on FHIR v2 | Authorization server supports SMART App Launch v2 | Compliant |
| USCDI v3 data classes | All USCDI v3 data classes supported | Compliant |
| Bulk Data 1.0 | $export operation with NDJSON output | Compliant |

### Data Format Alignment

| TEFCA Technical Format | Our Support | Notes |
|-----------------------|------------|-------|
| FHIR JSON | Full | Primary format; all endpoints |
| FHIR XML | Full | Supported via Accept header |
| NDJSON (bulk) | Full | $export operation |
| C-CDA (document exchange) | Full | /Composition/$cda operation |
| HL7 v2 (legacy) | Full | Via MLLP gateway |

### Exchange Purpose Implementation

| Exchange Purpose | Our Implementation |
|-----------------|-------------------|
| Treatment | Standard FHIR search with provider SMART scope |
| Individual Access | Patient-context SMART token; Patient/$everything |
| Public Health | $export with public health scope; eCR integration |
| Payment | Claims API; Coverage eligibility |
| Operations | System-level SMART scope; DEQM reporting |

### Patient Matching

| TEFCA Requirement | Our Implementation |
|------------------|-------------------|
| $match operation | `POST /fhir/Patient/$match` with match scoring |
| Deterministic matching | Full name + DOB + gender + SSN (last 4) |
| Probabilistic matching | Configurable threshold (default 0.85 match score) |
| MPI integration | Optional enterprise MPI integration for cross-facility |
| Referential integrity | Cross-reference patient across all resources |

### Audit Logging for TEFCA

Every TEFCA exchange generates an `AuditEvent`:

| AuditEvent Field | TEFCA Requirement | Value |
|-----------------|-----------------|-------|
| `purposeOfEvent` | Exchange purpose required | Treatment/IndividualAccess/PublicHealth/etc. |
| `agent[requestor]` | Who initiated the exchange | QHIN/Participant/User identity |
| `entity[patient]` | Patient subject | Patient reference |
| `agent[network]` | Network-level routing info | Source IP or QHIN identifier |
| `outcome` | Success or failure | 0=success, 4/8/12=error |
| `recorded` | Timestamp | ISO 8601 |
| `source.site` | Our system identifier | System NPI or OID |
