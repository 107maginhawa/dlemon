# European Health Data Space (EHDS) Guide

**Regulation:** EU Regulation 2025/327 on the European Health Data Space
**Official Journal:** L 2025/327, 5 March 2025
**Entry into Force:** March 2025
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Overview](#overview)
2. [Primary Use of Health Data](#primary-use-of-health-data)
3. [Secondary Use of Health Data](#secondary-use-of-health-data)
4. [EHR System Requirements](#ehr-system-requirements)
5. [Implementation Timeline](#implementation-timeline)
6. [International Patient Summary Requirement](#international-patient-summary-requirement)
7. [Alignment with Our API Spec](#alignment-with-our-api-spec)

---

## Overview

The European Health Data Space (EHDS) is the first EU-level domain-specific common data space. It has two main pillars:

| Pillar | Purpose | Governance |
|--------|---------|-----------|
| **Primary Use** | Citizens controlling and accessing their own health data; cross-border care | MyHealth@EU infrastructure |
| **Secondary Use** | Researchers, policy-makers, and innovators accessing health data for public benefit | Health Data Access Bodies (HDABs) in each member state |

### Relationship to GDPR

EHDS **complements** GDPR — it does not replace it. Health data remains a special category under Art. 9 GDPR. EHDS provides:
- Specific legal basis for secondary use (Art. 9(2)(j) GDPR)
- Sector-specific rules for primary use
- Common technical standards and interoperability requirements

### Key Actors

| Actor | Role |
|-------|------|
| Citizens/Natural Persons | Right to access, share, and control their health data |
| Healthcare Providers | Obligation to share data in digital format; duty to grant citizen access |
| EHR System Manufacturers | Compliance with European EHR exchange format (EHERF) |
| Health Data Access Bodies (HDABs) | Grant access to secondary use data; enforce data minimization |
| HealthData@EU | Central infrastructure for cross-border secondary use |
| MyHealth@EU | Infrastructure for cross-border primary use (treatment) |
| TEHDAS (eHDSI) | Technical infrastructure evolution |

---

## Primary Use of Health Data

### Citizen Rights

| Right | Description | Timeline |
|-------|-------------|----------|
| Right to access | Citizens can access their health data in digital format at no cost | 2027 |
| Right to electronic copy | Receive a machine-readable copy in the European EHR exchange format | 2027 |
| Right to authorize | Grant access to other healthcare providers (cross-border) | 2027 |
| Right to restrict | Request restriction of access by specific providers | 2027 |
| Right to correct | Request corrections to health data | 2027 |
| Right to know | Be informed when health data is accessed | 2027 |
| Opt-out from secondary use | Opt out from secondary use processing (where permitted by member state) | 2028 |

### Priority Data Categories for Primary Use

The following categories must be available in digital format first:

| # | Category | Minimum Dataset | Deadline |
|---|----------|----------------|----------|
| 1 | Patient summaries | IPS-aligned summary | 2027 |
| 2 | ePrescriptions | Medication details, prescriber, dispensing info | 2027 |
| 3 | Laboratory results | Structured test results with LOINC/SNOMED codes | 2028 |
| 4 | Medical images & reports | DICOM images + structured reports | 2028 |
| 5 | Hospital discharge reports | Structured discharge summary | 2028 |
| 6 | Medical devices data | Implantable device data, wearables | 2029 |

### MyHealth@EU Infrastructure

MyHealth@EU enables cross-border exchange of health data between member states. It:
- Builds on existing eHealth Digital Service Infrastructure (eHDSI)
- Uses IHE profiles and HL7 FHIR for data exchange
- Supports patient identification via national eID schemes
- Operates under mutual recognition of access controls

**Current operational services via eHDSI:**
- Patient Summary (PS)
- ePrescription/eDispensation (EP)
- Laboratory Results (Lab) — being rolled out

**EHDS extensions:**
- Hospital discharge reports
- Medical images
- Additional data categories per implementation timeline

---

## Secondary Use of Health Data

### Permitted Purposes

| Purpose Category | Examples | Conditions |
|-----------------|---------|-----------|
| Scientific research | Clinical trials, epidemiological studies | Ethical approval + HDAB permit |
| Education and training | Medical education, AI model training | Non-identifiable preferred |
| Policy development | Health system planning, resource allocation | Public interest requirement |
| Innovation | Medical device development, pharmaceutical R&D | Proportionality test |
| Patient safety | Pharmacovigilance, device safety surveillance | Regulatory obligation basis |
| Regulatory purposes | EMA, national regulatory bodies | Legal obligation basis |
| Reimbursement decisions | HTA, insurance actuarial analysis | Public interest + safeguards |
| Official statistics | Eurostat, national statistics institutes | Statistics law compliance |

### Health Data Access Bodies (HDABs)

Each member state must designate at least one HDAB responsible for:

| Function | Description |
|----------|-------------|
| Permit granting | Evaluate applications for secondary use access |
| Data minimization | Ensure minimum data necessary is shared |
| Technical controls | Provide secure processing environments |
| Monitoring compliance | Audit data users for compliance with permit conditions |
| Coordination | Participate in HealthData@EU coordination body |
| Sanctions | Withdraw permits; refer violations to data protection authorities |

### Data Access Mechanism

Secondary use data is accessed through **secure processing environments (SPEs)** — not via direct data exports. Data users:
1. Apply to HDAB with data access application
2. Receive permit with conditions (purpose, duration, dataset)
3. Access data only within SPE — no download allowed
4. Results subject to output checking before release

### EHDS Data Permit Requirements

| Element | Requirement |
|---------|-------------|
| Applicant identity | Verified legal entity |
| Purpose | Specific, described purpose within permitted categories |
| Data categories | Justification for each category requested |
| Time period | Start and end date |
| Technical measures | Security safeguards in place |
| Legal basis | Applicable GDPR basis |
| Privacy-enhancing technologies | Pseudonymization, aggregation plan |

---

## EHR System Requirements

### Conformance Obligations for EHR Systems

Under EHDS, EHR systems placed on the EU market must:

| Requirement | Description | Deadline |
|-------------|-------------|----------|
| European EHR Exchange Format (EHERF) | Export/import data in FHIR R4-based EHERF | 2028 |
| CE-class labeling for EHR systems | Demonstrate compliance via conformity assessment | 2028 |
| Patient access portal | Citizens can access data via secure online portal | 2027 |
| Audit logging | Log all access to health data | 2027 |
| Access control | Role-based access reflecting professional status | 2027 |
| Data minimization | Technical controls to enforce purpose limitation | 2028 |
| API openness | Open APIs for authorized access by third parties | 2028 |

### European EHR Exchange Format (EHERF)

EHERF is based on HL7 FHIR R4 and aligns with:
- International Patient Summary (IEN EN ISO 27269)
- EU FHIR profiles maintained by the EU FHIR community
- IHE profiles for specific clinical domains

**Core FHIR profiles in EHERF:**
- Patient (aligned with EU Base Patient profile)
- Composition (for documents)
- MedicationRequest / MedicationDispense
- Observation (for lab results)
- DiagnosticReport
- ImagingStudy
- Immunization
- AllergyIntolerance
- Condition
- Procedure

---

## Implementation Timeline

```
2025  ─── Regulation enters into force (March 2025)
          • EHDS governance structures established
          • HDAB designation process begins
          • EHERF technical specification development

2026  ─── EHERF v1.0 published
          • MyHealth@EU expansion to additional member states
          • HDAB operational in all member states

2027  ─── Citizen rights operational
          • Patient summaries accessible digitally
          • ePrescriptions/eDispensations mandatory
          • Patient access portals live
          • Cross-border patient summary exchange via MyHealth@EU

2028  ─── Extended data categories
          • Laboratory results in structured format
          • Hospital discharge reports
          • Medical images and reports
          • EHR system CE-class labeling required
          • Secondary use HDABs processing applications
          • HealthData@EU cross-border secondary use operational

2029  ─── Full implementation
          • Medical device data integration
          • All priority data categories available
          • Full secondary use ecosystem operational
```

---

## International Patient Summary Requirement

The **International Patient Summary (IPS)** is mandatory for cross-border care under EHDS via MyHealth@EU.

### IPS Standard

| Standard | Reference |
|----------|-----------|
| HL7 FHIR IPS IG | HL7 International Patient Summary Implementation Guide v2.0 |
| ISO/EN standard | IEN EN ISO 27269:2021 (Health informatics — The International Patient Summary) |
| CEN standard | EN 17269 |

### IPS Sections (Mandatory vs Optional)

| Section | Requirement | FHIR Resource |
|---------|-------------|---------------|
| Allergies and Intolerances | **Mandatory** | AllergyIntolerance |
| Medication Summary | **Mandatory** | MedicationStatement / MedicationRequest |
| Problem List | **Mandatory** | Condition |
| Immunizations | Recommended | Immunization |
| History of Procedures | Recommended | Procedure |
| Medical Devices | Recommended | DeviceUseStatement |
| Diagnostic Results | Recommended | DiagnosticReport + Observation |
| Vital Signs | Optional | Observation (vital-signs category) |
| Past History of Illnesses | Optional | Condition (historical) |
| Pregnancy History | Optional | Observation |
| Social History | Optional | Observation |
| Functional Status | Optional | ClinicalImpression / Observation |
| Plan of Care | Optional | CarePlan |
| Advance Directives | Optional | Consent |

### IPS Generation Requirements

| Requirement | Description |
|-------------|-------------|
| Coded entries | All entries must use SNOMED CT, LOINC, or EDQM where applicable |
| Unknown/absent | Must explicitly state "no known allergies" not just omit the section |
| Multilingual | IPS must support display in patient's language |
| Translation service | Coded entries enable translation across languages |
| Narrative | Each section must include human-readable narrative (xhtml) |

---

## Alignment with Our API Spec

### Composition Resource — IPS Generation

| EHDS Requirement | Our Implementation |
|------------------|-------------------|
| IPS document generation | `POST /compositions/{id}/$document` generates FHIR Document Bundle |
| IPS profile conformance | Composition declares `meta.profile = "http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips"` |
| Mandatory sections | Validated at composition creation; `OperationOutcome` if required sections missing |
| Coded entries | Terminology binding enforcement on Condition, Medication, AllergyIntolerance |
| Narrative generation | Auto-generated narrative from structured data |

### Consent Resource — Patient Data Control

| EHDS Requirement | Our Implementation |
|------------------|-------------------|
| Opt-out from secondary use | `Consent.scope = "research"` with `status = "rejected"` |
| Cross-border access authorization | `Consent.provision.actor` specifies authorized cross-border entities |
| Access restriction to specific providers | `Consent.provision.type = "deny"` with `actor` = restricted provider |
| Audit of access | Every access logged via `AuditEvent` linked to Consent |

### Bulk Export — Secondary Use Readiness

| EHDS Requirement | Our Implementation |
|------------------|-------------------|
| Structured data export for HDABs | `GET /fhir/$export` with patient-level NDJSON output |
| Pseudonymization | Export parameter `pseudonymize=true` replaces direct identifiers |
| Data minimization | `_type` parameter limits exported resource types to permitted categories |
| Audit trail for export | Export job linked to `AuditEvent` with requester identity and purpose |

### Patient Access APIs — Citizen Rights

| EHDS Requirement | Our Implementation |
|------------------|-------------------|
| Citizen access to own data | `GET /patients/{id}/$everything` with patient-context SMART token |
| Machine-readable export | FHIR R4 Bundle in JSON format |
| No-cost access | Patient-context endpoints have no rate-limit charges |
| Portal integration | SMART App Launch for patient-facing apps |

### EHR System Conformance

| EHDS Requirement | Our Implementation |
|------------------|-------------------|
| EHERF export capability | FHIR R4 output aligned with EU FHIR community profiles |
| Open APIs | FHIR REST API with documented capability statement |
| Audit logging | `AuditEvent` for every read/write operation |
| Role-based access | `PractitionerRole` + SMART scopes enforce professional status |
| Patient consent integration | All disclosures validated against active Consent resources |
