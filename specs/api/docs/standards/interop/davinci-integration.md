# HL7 Da Vinci Integration Guide

**Program:** HL7 Da Vinci Project — Accelerating Value-Based Care
**Purpose:** Payer-provider data exchange for value-based care and prior authorization
**FHIR Version:** R4
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Da Vinci Overview](#da-vinci-overview)
2. [HRex — Health Record Exchange](#hrex--health-record-exchange)
3. [PDex — Payer Data Exchange](#pdex--payer-data-exchange)
4. [CRD — Coverage Requirements Discovery](#crd--coverage-requirements-discovery)
5. [CDex — Clinical Data Exchange](#cdex--clinical-data-exchange)
6. [DTR — Documentation Templates and Rules](#dtr--documentation-templates-and-rules)
7. [PAS — Prior Authorization Support](#pas--prior-authorization-support)
8. [DEQM — Data Exchange for Quality Measures](#deqm--data-exchange-for-quality-measures)
9. [Our Resource Mapping to Da Vinci Profiles](#our-resource-mapping-to-da-vinci-profiles)

---

## Da Vinci Overview

The Da Vinci Project is an HL7 FHIR accelerator focused on improving healthcare value by enabling seamless data exchange between payers and providers. Da Vinci Implementation Guides (IGs) define specific profiles and operations for key workflows.

### Key Da Vinci IGs

| IG | Short Name | Focus | Version |
|----|-----------|-------|---------|
| Da Vinci HRex | HRex | Base profiles and patterns for all Da Vinci IGs | 1.0 |
| Da Vinci PDex | PDex | Patient data access from payer (claims, encounters) | 2.0 |
| Da Vinci CRD | CRD | Real-time coverage requirements discovery | 2.0 |
| Da Vinci CDex | CDex | Clinical data submission from provider to payer | 2.0 |
| Da Vinci DTR | DTR | SMART app for documentation templates and prior auth | 2.0 |
| Da Vinci PAS | PAS | Prior authorization submission via FHIR | 2.0 |
| Da Vinci DEQM | DEQM | Quality measure reporting and data exchange | 3.0 |
| Da Vinci PCDE | PCDE | Payer coverage decision exchange | 1.0 |
| Da Vinci Drug Formulary | Formulary | Payer drug formulary as FHIR | 2.0 |

---

## HRex — Health Record Exchange

**IG:** HL7 FHIR Da Vinci Health Record Exchange (HRex) Implementation Guide
**URL:** `http://hl7.org/fhir/us/davinci-hrex/`
**Purpose:** Base set of profiles and conventions that all Da Vinci IGs build upon

### HRex Base Profiles

| HRex Profile | Base Resource | Purpose |
|-------------|--------------|---------|
| HRex Patient Demographics | Patient | Common patient demographics for payer-provider exchange |
| HRex Organization | Organization | Organizations participating in Da Vinci exchanges |
| HRex Practitioner | Practitioner | Practitioner identity across payer-provider |
| HRex PractitionerRole | PractitionerRole | Role in context of an organization |
| HRex Coverage | Coverage | Insurance coverage with standard extensions |
| HRex Provenance | Provenance | Provenance for payer-provider data |
| HRex Task | Task | Task-based data exchange pattern |

### Task-Based Data Request Pattern

HRex defines a task-based pattern for requesting clinical data:

```http
POST /fhir/Task
Content-Type: application/fhir+json

{
  "resourceType": "Task",
  "status": "requested",
  "intent": "order",
  "code": {
    "coding": [{ "system": "http://hl7.org/fhir/us/davinci-hrex/CodeSystem/hrex-temp", "code": "data-request" }]
  },
  "for": { "reference": "Patient/patient-123" },
  "authoredOn": "2026-04-14T12:00:00Z",
  "owner": { "reference": "Organization/provider-org" },
  "requester": { "reference": "Organization/payer-org" },
  "reasonCode": { "coding": [{ "system": "http://hl7.org/fhir/us/davinci-hrex/CodeSystem/hrex-temp", "code": "support-claim" }] },
  "input": [
    {
      "type": { "coding": [{ "code": "data-query" }] },
      "valueString": "Condition?patient=patient-123&clinical-status=active"
    }
  ]
}
```

### Consent for Payer-Provider Exchange

HRex defines consent requirements for payer access to provider clinical data:

| Consent Type | When Required | Coverage.relationship |
|-------------|--------------|----------------------|
| Member consent for payer access | When accessing beyond claims | Active Coverage resource with member consent |
| HIPAA TPO | Treatment, payment, operations | No additional consent required |
| Research/Marketing | Non-TPO purposes | Explicit written authorization |

---

## PDex — Payer Data Exchange

**IG:** HL7 Da Vinci Payer Data Exchange (PDex) Implementation Guide
**URL:** `http://hl7.org/fhir/us/davinci-pdex/`
**Purpose:** Enable members to access their payer-held data (claims, encounters, coverage) via FHIR

### PDex Data Sources and FHIR Mappings

| Payer Data | PDex FHIR Resource | US Core Alignment |
|-----------|-------------------|-------------------|
| Claims | ExplanationOfBenefit | US Core EOB (from CARIN BB) |
| Encounters | Encounter | US Core Encounter |
| Clinical data | Various (Condition, Observation, etc.) | US Core |
| Coverage/Benefits | Coverage | HRex Coverage |
| Provider directory | Practitioner, Organization, Location | PDEX PlanNet |
| Drug formulary | MedicationKnowledge, List | Da Vinci Drug Formulary |

### PDex Patient Access API

Members access their data via:

```http
GET /fhir/Patient/{member-id}/$everything
Authorization: Bearer {member_token}
Accept: application/fhir+json
```

Required data elements in PDex Patient $everything:
- ExplanationOfBenefit (all claims)
- Coverage (member's coverage details)
- Practitioner (providers involved in care)
- Organization (facilities/payer)
- MedicationDispense (pharmacy claims)

### PDex Payer-to-Payer Exchange

When a member switches payers, the new payer can request data from the old payer:

```
Old Payer → New Payer
  POST /fhir/$member-match (identify member)
  GET /fhir/Patient/{id}/$everything (with member consent)
```

**$member-match Operation:**
```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "MemberPatient",
      "resource": {
        "resourceType": "Patient",
        "name": [{ "family": "Doe", "given": ["John"] }],
        "birthDate": "1980-01-15"
      }
    },
    {
      "name": "CoverageToMatch",
      "resource": {
        "resourceType": "Coverage",
        "identifier": [{ "value": "MEMBER-123456" }],
        "payor": [{ "identifier": { "value": "OLD-PAYER-NPI" } }]
      }
    }
  ]
}
```

### PDex ExplanationOfBenefit Profiles

PDex uses CARIN Blue Button (CARIN BB) profiles for EOB:

| Claim Type | CARIN BB Profile | Our Claim.type |
|-----------|----------------|----------------|
| Professional | CARIN BB EOB Professional | professional |
| Institutional | CARIN BB EOB Inpatient | institutional (inpatient) |
| Outpatient | CARIN BB EOB Outpatient | institutional (outpatient) |
| Pharmacy | CARIN BB EOB Pharmacy | pharmacy |

---

## CRD — Coverage Requirements Discovery

**IG:** Da Vinci Coverage Requirements Discovery (CRD) Implementation Guide
**URL:** `http://hl7.org/fhir/us/davinci-crd/`
**Purpose:** Real-time payer input at the point of care to reduce administrative burden

### CRD Workflow

CRD uses CDS Hooks to provide payer coverage information to providers in real time:

```
Provider EHR → CDS Hooks → CRD Service (Payer)
                            ↓ (queries payer coverage rules)
Provider EHR ← CDS Cards ← Coverage determination
```

### Supported CDS Hooks for CRD

| Hook | When Fired | CRD Use Case |
|------|-----------|-------------|
| `order-select` | When clinician selects an order | Alert if prior auth required; show formulary status |
| `order-sign` | When clinician signs orders | Final coverage requirements check |
| `appointment-book` | When booking appointment | Check if referral required; network status |
| `encounter-start` | When encounter starts | Alert about coverage status; deductible remaining |

### CRD Card Types

| Card Type | Indicator | Example |
|-----------|---------|---------|
| Prior authorization required | `warning` | "This drug requires prior authorization. Request PA before prescribing." |
| Prior authorization recommended | `info` | "PA recommended for quicker processing. Request optional PA." |
| Prior authorization not required | `info` | "This service does not require prior authorization." |
| Documentation required | `warning` | "Clinical documentation required. Attach relevant notes." |
| Not covered | `critical` | "This service is not covered under the patient's current plan." |
| Network status | `info` | "This provider is out-of-network. Patient may have higher cost sharing." |
| Additional information needed | `info` | "Please provide additional diagnosis information for accurate coverage determination." |
| Coverage information | `info` | "Patient has $250 remaining deductible. Coinsurance is 20% after deductible." |

### CRD Prefetch Requirements

CRD services can request prefetch data to avoid additional queries:

```json
{
  "prefetch": {
    "patient": "Patient/{{context.patientId}}",
    "coverage": "Coverage?patient={{context.patientId}}&status=active",
    "conditions": "Condition?patient={{context.patientId}}&clinical-status=active",
    "requestedOrder": "{{context.selections.0}}"
  }
}
```

---

## CDex — Clinical Data Exchange

**IG:** Da Vinci Clinical Data Exchange (CDex) Implementation Guide
**URL:** `http://hl7.org/fhir/us/davinci-cdex/`
**Purpose:** Standardize how payers request and receive clinical data from providers

### CDex Use Cases

| Use Case | Description |
|----------|-------------|
| Claims attachment | Provider submits supporting documentation for a claim |
| Prior authorization support | Provider sends clinical evidence to support PA request |
| Audit | Payer requests records for utilization review |
| Risk adjustment | Payer requests data to support risk adjustment |
| Quality measures | Payer requests data for quality reporting |

### CDex Request Patterns

**Pattern 1: Task-Based Exchange (Provider Initiates)**

```http
POST /fhir/Task
{
  "resourceType": "Task",
  "status": "completed",
  "intent": "order",
  "code": { "coding": [{ "code": "attachment-request-code" }] },
  "for": { "reference": "Patient/patient-123" },
  "input": [
    { "type": { "coding": [{ "code": "claim" }] }, "valueReference": { "reference": "Claim/claim-456" } },
    { "type": { "coding": [{ "code": "attachment-line-item" }] }, "valuePositiveInt": 1 }
  ],
  "output": [
    {
      "type": { "coding": [{ "code": "ClaimResponse" }] },
      "valueReference": { "reference": "DocumentReference/attach-doc-789" }
    }
  ]
}
```

**Pattern 2: $submit-attachment Operation**

```http
POST /fhir/Claim/$submit-attachment
Content-Type: application/fhir+json

{
  "resourceType": "Parameters",
  "parameter": [
    { "name": "TrackingId", "valueIdentifier": { "value": "CLAIM-789" } },
    { "name": "AttachTo", "valueCode": "prior-auth" },
    { "name": "Request", "valueIdentifier": { "value": "PA-REF-123" } },
    { "name": "LineItem", "valuePositiveInt": 1 },
    { "name": "Content", "resource": { "resourceType": "Bundle", "type": "collection", "entry": [] } }
  ]
}
```

### CDex Supported Document Types

| Document Type | LOINC Code | When Requested |
|--------------|-----------|---------------|
| Discharge summary | 18842-5 | Inpatient post-acute PA |
| Operative note | 11504-8 | Surgical claims |
| Consultation note | 11488-4 | Specialist referral |
| History and physical | 34117-2 | Inpatient admission |
| Lab results | 26436-6 | Diagnostic claims |
| Imaging report | 18748-4 | Radiology claims |
| Progress notes | 11506-3 | Ongoing treatment |

---

## DTR — Documentation Templates and Rules

**IG:** Da Vinci Documentation Templates and Rules (DTR) Implementation Guide
**URL:** `http://hl7.org/fhir/us/davinci-dtr/`
**Purpose:** A SMART on FHIR app that helps complete payer-required documentation using CQL

### DTR Workflow

```
1. CRD identifies PA required (via CDS Hooks card with smart-app link)
2. Provider clicks "Launch Documentation" from CDS card
3. DTR SMART app launches within EHR
4. DTR retrieves payer questionnaire (FHIR Questionnaire resource via CQL)
5. DTR auto-populates from EHR FHIR data using CQL
6. Clinician reviews and completes remaining items
7. DTR generates completed QuestionnaireResponse
8. QuestionnaireResponse submitted as CDex attachment or PAS request
```

### Questionnaire Resource for DTR

```json
{
  "resourceType": "Questionnaire",
  "id": "lumbar-fusion-pa-questionnaire",
  "url": "https://payer.example.com/Questionnaire/lumbar-fusion-pa",
  "version": "1.0",
  "status": "active",
  "title": "Lumbar Fusion Prior Authorization",
  "extension": [
    {
      "url": "http://hl7.org/fhir/us/davinci-dtr/StructureDefinition/questionnaire-launchContext",
      "extension": [
        { "url": "name", "valueCode": "patient" },
        { "url": "type", "valueCode": "Patient" },
        { "url": "description", "valueString": "Current patient" }
      ]
    }
  ],
  "item": [
    {
      "linkId": "1",
      "text": "Patient has failed at least 6 weeks of conservative treatment",
      "type": "boolean",
      "extension": [{
        "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression",
        "valueExpression": {
          "language": "text/cql-identifier",
          "expression": "HasFailedConservativeTreatment"
        }
      }]
    }
  ]
}
```

---

## PAS — Prior Authorization Support

**IG:** Da Vinci Prior Authorization Support (PAS) Implementation Guide
**URL:** `http://hl7.org/fhir/us/davinci-pas/`
**Purpose:** Real-time prior authorization via FHIR using X12 278 translation layer

### PAS Request Flow

```http
POST /fhir/$submit
Content-Type: application/fhir+json

{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Claim",
        "meta": { "profile": ["http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim"] },
        "status": "active",
        "use": "preauthorization",
        "type": { "coding": [{ "code": "professional" }] }
      }
    }
  ]
}
```

### PAS Response

```json
{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "ClaimResponse",
        "status": "active",
        "use": "preauthorization",
        "outcome": "complete",
        "preAuthRef": ["PA-2026-00123"],
        "item": [
          {
            "itemSequence": 1,
            "adjudication": [
              {
                "category": { "coding": [{ "code": "submitted" }] },
                "reason": { "coding": [{ "system": "https://codesystem.x12.org/005010/306", "code": "A1", "display": "Certified in total" }] }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### PA Disposition Codes

| X12 Code | Description | FHIR Outcome |
|---------|-------------|-------------|
| A1 | Certified in total | complete (approved) |
| A3 | Not certified | error (denied) |
| A4 | Pended | queued |
| A6 | Modified | complete (modified) |

---

## DEQM — Data Exchange for Quality Measures

**IG:** Da Vinci Data Exchange for Quality Measures (DEQM) Implementation Guide
**URL:** `http://hl7.org/fhir/us/davinci-deqm/`
**Purpose:** Reporting quality measure data between providers and payers/registries

### DEQM Submission Patterns

| Pattern | Description | FHIR Operation |
|---------|-------------|---------------|
| Individual Report | Single patient measure report | POST MeasureReport |
| Summary Report | Aggregate population report | POST MeasureReport (summary) |
| Data Exchange | Submit clinical data for gap closure | POST Bundle |
| Collect Data | Payer requests data for a measure | POST Measure/$collect-data |
| Care Gaps | Identify and close quality gaps | GET Measure/$care-gaps |

### MeasureReport Structure

```json
{
  "resourceType": "MeasureReport",
  "status": "complete",
  "type": "individual",
  "measure": "http://hl7.org/fhir/us/davinci-deqm/Measure/EXM130",
  "subject": { "reference": "Patient/patient-123" },
  "period": { "start": "2025-01-01", "end": "2025-12-31" },
  "improvementNotation": {
    "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/measure-improvement-notation", "code": "increase" }]
  },
  "group": [
    {
      "code": { "coding": [{ "code": "group-1" }] },
      "population": [
        {
          "code": { "coding": [{ "code": "initial-population" }] },
          "count": 1
        },
        {
          "code": { "coding": [{ "code": "denominator" }] },
          "count": 1
        },
        {
          "code": { "coding": [{ "code": "numerator" }] },
          "count": 1
        }
      ],
      "measureScore": { "value": 1, "unit": "%" }
    }
  ]
}
```

---

## Our Resource Mapping to Da Vinci Profiles

### Profile Conformance Table

| FHIR Resource | Da Vinci Profile | Conformance Level | Notes |
|--------------|-----------------|------------------|-------|
| Patient | HRex Patient | SHALL | All payer-provider exchanges |
| Coverage | HRex Coverage, PDex Coverage | SHALL | Insurance/coverage data |
| Organization | HRex Organization, PDex PlanNet Organization | SHALL | Provider and payer orgs |
| Practitioner | HRex Practitioner, PDex PlanNet Practitioner | SHALL | |
| PractitionerRole | HRex PractitionerRole, PDex PlanNet PractitionerRole | SHOULD | |
| Claim | PAS Claim Profile | SHALL (for PA) | Prior auth submissions |
| ClaimResponse | PAS ClaimResponse Profile | SHALL (for PA) | PA responses |
| ExplanationOfBenefit | CARIN BB EOB | SHALL (for PDex) | Claims data for members |
| Task | HRex Task | SHALL (for CDex) | Data request tasks |
| Bundle | PAS Bundle | SHALL (for PA) | PA submission bundles |
| Questionnaire | DTR Questionnaire | SHALL (for DTR) | PA questionnaires |
| QuestionnaireResponse | DTR QuestionnaireResponse | SHALL (for DTR) | Completed PA forms |
| MeasureReport | DEQM MeasureReport | SHALL (for quality) | Quality measure results |

### Da Vinci Extension Registry

| Extension | URI | Used On |
|-----------|-----|---------|
| PA attestation | `http://hl7.org/fhir/us/davinci-pas/StructureDefinition/extension-paLineNumber` | Claim.item |
| Coverage assertion | `http://hl7.org/fhir/us/davinci-crd/StructureDefinition/ext-coverage-assertion` | Coverage |
| DTR questionnaire reference | `http://hl7.org/fhir/us/davinci-dtr/StructureDefinition/qr-context` | QuestionnaireResponse |
| PDex source payer | `http://hl7.org/fhir/us/davinci-pdex/StructureDefinition/pdex-sourcePayerFormat` | ExplanationOfBenefit |
| Prior auth date | `http://hl7.org/fhir/us/davinci-pas/StructureDefinition/extension-requestedService` | Claim.item |
