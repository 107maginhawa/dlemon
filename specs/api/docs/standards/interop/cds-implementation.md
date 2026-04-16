# CDS Hooks + CQL Implementation Guide

**Standards:** CDS Hooks 2.0 (HL7), Clinical Quality Language (CQL) 1.5 (HL7)
**Related:** FHIR R4, US Core, SMART on FHIR
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [CDS Hooks Overview](#cds-hooks-overview)
2. [Supported Hooks](#supported-hooks)
3. [CDS Service Discovery](#cds-service-discovery)
4. [Hook Request/Response Structure](#hook-requestresponse-structure)
5. [CDS Card Format](#cds-card-format)
6. [Override and Accept Workflow](#override-and-accept-workflow)
7. [CQL Library Management](#cql-library-management)
8. [PlanDefinition for Order Sets](#plandefinition-for-order-sets)
9. [CQL Evaluation Engine Requirements](#cql-evaluation-engine-requirements)
10. [Our CDS Hooks Endpoints](#our-cds-hooks-endpoints)

---

## CDS Hooks Overview

CDS Hooks is a standard for invoking clinical decision support (CDS) services from within an EHR workflow. The EHR calls a CDS service at key workflow moments (hooks), and the service returns cards with actionable advice.

### Architecture

```
EHR System                           CDS Service
     |                                    |
     |  POST /cds-services/{service-id}   |
     |  {hook context data prefetch}  --> |
     |                                    | (evaluate CQL / rules)
     |  <-- {cards, systemActions}        |
     |                                    |
User sees cards; accepts, overrides,      |
or ignores each card                      |
     |                                    |
     |  POST feedback (optional)      --> |
```

---

## Supported Hooks

| Hook | Workflow Moment | Context Provided | Our Services |
|------|----------------|-----------------|--------------|
| `patient-view` | When a patient chart is opened | patient, user, encounter | Patient risk summary, care gap alerts |
| `order-sign` | When a clinician signs an order set | userId, patientId, encounterId, draftOrders | Drug interaction check, duplicate order check, formulary alerts |
| `order-select` | When a clinician selects an order (before signing) | userId, patientId, encounterId, selectedOrders | Prior auth requirements, RTPB cost, evidence-based alternatives |
| `encounter-start` | When an encounter is opened/started | userId, patientId, encounterId | Care gap reminders, preventive care due, open referrals |
| `encounter-discharge` | When a discharge is being planned | userId, patientId, encounterId | Discharge checklist, medication reconciliation reminder, follow-up scheduling |
| `medication-prescribe` | When prescribing a medication (before order-sign) | userId, patientId, encounterId, draftMedications | Drug-allergy check, drug-drug interaction, EPCS eligibility |
| `appointment-book` | When booking an appointment | userId, patientId, appointmentId, appointments | Care preparation instructions, pre-visit requirements |

### Hook Context Fields

#### patient-view

```json
{
  "hook": "patient-view",
  "hookInstance": "uuid",
  "context": {
    "userId": "Practitioner/dr-123",
    "patientId": "patient-456",
    "encounterId": "encounter-789"
  }
}
```

#### order-sign

```json
{
  "hook": "order-sign",
  "hookInstance": "uuid",
  "context": {
    "userId": "Practitioner/dr-123",
    "patientId": "patient-456",
    "encounterId": "encounter-789",
    "draftOrders": {
      "resourceType": "Bundle",
      "type": "collection",
      "entry": [
        {
          "resource": {
            "resourceType": "MedicationRequest",
            "status": "draft",
            "intent": "order",
            "medicationCodeableConcept": {
              "coding": [{ "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "1049502" }]
            },
            "subject": { "reference": "Patient/patient-456" }
          }
        }
      ]
    }
  }
}
```

---

## CDS Service Discovery

### Discovery Endpoint

```http
GET /cds-services
Accept: application/json
```

### Discovery Response

```json
{
  "services": [
    {
      "hook": "patient-view",
      "title": "Patient Risk Summary",
      "description": "Displays chronic disease risk scores and care gaps for the current patient",
      "id": "patient-risk-summary",
      "prefetch": {
        "patient": "Patient/{{context.patientId}}",
        "conditions": "Condition?patient={{context.patientId}}&clinical-status=active",
        "medications": "MedicationRequest?patient={{context.patientId}}&status=active",
        "observations": "Observation?patient={{context.patientId}}&category=vital-signs&_sort=-date&_count=5"
      }
    },
    {
      "hook": "order-sign",
      "title": "Drug Interaction Checker",
      "description": "Checks for drug-drug and drug-allergy interactions in draft orders",
      "id": "drug-interaction-check",
      "prefetch": {
        "patient": "Patient/{{context.patientId}}",
        "allergies": "AllergyIntolerance?patient={{context.patientId}}&clinical-status=active",
        "activeMedications": "MedicationRequest?patient={{context.patientId}}&status=active&intent=order"
      }
    },
    {
      "hook": "encounter-start",
      "title": "Care Gap Alerts",
      "description": "Identifies overdue preventive care and quality measure gaps",
      "id": "care-gap-alerts",
      "prefetch": {
        "patient": "Patient/{{context.patientId}}",
        "immunizations": "Immunization?patient={{context.patientId}}&status=completed",
        "screeningResults": "Observation?patient={{context.patientId}}&category=survey&_sort=-date"
      }
    },
    {
      "hook": "medication-prescribe",
      "title": "EPCS Eligibility Check",
      "description": "Verifies prescriber eligibility for electronic prescribing of controlled substances",
      "id": "epcs-check",
      "prefetch": {
        "prescriber": "Practitioner/{{context.userId}}"
      }
    }
  ]
}
```

---

## Hook Request/Response Structure

### Full Request Structure

```json
{
  "hookInstance": "uuid-v4",
  "hook": "order-sign",
  "fhirServer": "https://api.monobase.health/fhir",
  "fhirAuthorization": {
    "access_token": "eyJ...",
    "token_type": "Bearer",
    "expires_in": 300,
    "scope": "user/Patient.read user/MedicationRequest.read",
    "subject": "cds-service-id"
  },
  "context": {
    "userId": "Practitioner/dr-123",
    "patientId": "patient-456",
    "encounterId": "encounter-789",
    "draftOrders": { "resourceType": "Bundle", "type": "collection", "entry": [] }
  },
  "prefetch": {
    "patient": {
      "resourceType": "Patient",
      "id": "patient-456"
    },
    "allergies": {
      "resourceType": "Bundle",
      "type": "searchset",
      "entry": []
    }
  }
}
```

### Full Response Structure

```json
{
  "cards": [
    {
      "uuid": "card-uuid",
      "summary": "Potential drug-allergy interaction detected",
      "detail": "The ordered medication **Amoxicillin** may interact with the patient's documented **Penicillin allergy**. The patient has a documented reaction of hives (moderate severity).",
      "indicator": "critical",
      "source": {
        "label": "Drug Interaction Service",
        "url": "https://cds.monobase.health/docs/drug-interactions",
        "icon": "https://cds.monobase.health/icons/drug-check.png"
      },
      "suggestions": [
        {
          "label": "Replace with Azithromycin 500mg",
          "uuid": "suggestion-uuid",
          "isRecommended": true,
          "actions": [
            {
              "type": "update",
              "description": "Replace Amoxicillin with Azithromycin",
              "resource": {
                "resourceType": "MedicationRequest",
                "medicationCodeableConcept": {
                  "coding": [{ "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "308460" }]
                }
              }
            }
          ]
        },
        {
          "label": "Remove this order",
          "uuid": "suggestion-remove-uuid",
          "actions": [
            {
              "type": "delete",
              "description": "Remove Amoxicillin order",
              "resourceId": "draft-order-uuid"
            }
          ]
        }
      ],
      "selectionBehavior": "at-most-one",
      "overrideReasons": [
        {
          "code": {
            "coding": [{ "system": "https://cds.monobase.health/override-reasons", "code": "allergy-documented-incorrect" }],
            "text": "Allergy documentation is incorrect"
          }
        },
        {
          "code": {
            "coding": [{ "system": "https://cds.monobase.health/override-reasons", "code": "risk-benefit-accepted" }],
            "text": "Risk-benefit assessed; proceeding with original order"
          }
        }
      ],
      "links": [
        {
          "label": "View allergy record",
          "url": "https://app.monobase.health/patients/patient-456/allergies",
          "type": "absolute"
        },
        {
          "label": "Drug interaction reference",
          "url": "https://www.drugs.com/drug_interactions.html",
          "type": "absolute"
        }
      ]
    }
  ],
  "systemActions": [
    {
      "type": "update",
      "description": "Flag order for pharmacist review",
      "resource": {
        "resourceType": "Task",
        "status": "requested",
        "intent": "order",
        "code": { "text": "Pharmacist review required — drug-allergy alert" },
        "for": { "reference": "Patient/patient-456" }
      }
    }
  ]
}
```

---

## CDS Card Format

### Card Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `uuid` | string | No | Unique card identifier |
| `summary` | string | **Yes** | One-sentence summary (max 140 chars) |
| `detail` | string | No | Additional detail (Markdown supported) |
| `indicator` | enum | **Yes** | `info`, `warning`, `critical` |
| `source` | object | **Yes** | Source of the card |
| `suggestions` | array | No | Actionable suggestions |
| `selectionBehavior` | enum | No | `at-most-one` or `any` |
| `overrideReasons` | array | No | Reasons a clinician might override |
| `links` | array | No | External links for more information |

### Indicator Levels

| Indicator | Color (Typical) | Use When |
|-----------|----------------|---------|
| `info` | Blue | Informational; no urgency |
| `warning` | Yellow/Orange | Potential issue that should be reviewed |
| `critical` | Red | Serious safety concern; strong recommendation to act |

### Suggestion Action Types

| Action Type | FHIR Effect | Use Case |
|-------------|-------------|---------|
| `create` | POST new resource | Add a resource (e.g., add a lab order) |
| `update` | PUT/PATCH existing resource | Modify draft order |
| `delete` | DELETE resource | Remove a draft order |

---

## Override and Accept Workflow

### Feedback Endpoint

After the user interacts with a card, the EHR may send feedback:

```http
POST /cds-services/{service-id}/feedback
Content-Type: application/json

{
  "feedback": [
    {
      "card": "card-uuid",
      "outcome": "overridden",
      "outcomeTimestamp": "2026-04-14T12:05:00Z",
      "overrideReason": {
        "reason": {
          "coding": [
            {
              "system": "https://cds.monobase.health/override-reasons",
              "code": "allergy-documented-incorrect",
              "display": "Allergy documentation is incorrect"
            }
          ]
        },
        "userComment": "Patient is tolerant — allergy was for a different drug family"
      },
      "acceptedSuggestions": []
    }
  ]
}
```

### Override Logging

Every override is logged to `AuditEvent`:

| AuditEvent Field | Value |
|-----------------|-------|
| `type.code` | `110107` (Import — CDS feedback) |
| `subtype.code` | `cds-override` |
| `agent[].who` | Practitioner who overrode |
| `agent[].network` | Client IP |
| `entity[].what` | Reference to the order that was overridden |
| `entity[].detail` | Override reason code and free text |
| `outcome` | `0` (success — override recorded) |
| `recorded` | Timestamp |

### Accepted Suggestion Tracking

When a suggestion is accepted, the EHR applies the suggestion's actions and reports back:

```json
{
  "feedback": [{
    "card": "card-uuid",
    "outcome": "accepted",
    "outcomeTimestamp": "2026-04-14T12:03:00Z",
    "acceptedSuggestions": [
      { "id": "suggestion-uuid" }
    ]
  }]
}
```

---

## CQL Library Management

CDS services use CQL libraries to express clinical logic. Libraries are stored as FHIR Library resources.

### Library Resource Structure

```json
{
  "resourceType": "Library",
  "id": "drug-allergy-check-logic",
  "url": "https://cds.monobase.health/Library/drug-allergy-check-logic",
  "version": "1.2.0",
  "name": "DrugAllergyCheckLogic",
  "status": "active",
  "type": {
    "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/library-type", "code": "logic-library" }]
  },
  "relatedArtifact": [
    {
      "type": "depends-on",
      "resource": "http://fhir.org/guides/cqf/common/Library/FHIRHelpers|4.0.1"
    }
  ],
  "parameter": [
    { "name": "Patient", "use": "in", "type": "Patient" },
    { "name": "Allergies", "use": "in", "type": "AllergyIntolerance" },
    { "name": "DraftOrders", "use": "in", "type": "Bundle" },
    { "name": "HasAllergyConflict", "use": "out", "type": "boolean" },
    { "name": "ConflictingDrugs", "use": "out", "type": "List<string>" }
  ],
  "content": [
    {
      "contentType": "text/cql",
      "data": "base64-encoded-cql-content"
    }
  ]
}
```

### Example CQL

```cql
library DrugAllergyCheckLogic version '1.2.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'

context Patient

define "Active Allergies":
  [AllergyIntolerance] A
    where A.clinicalStatus ~ "active"
      and A.verificationStatus ~ "confirmed"

define "Draft Medication Codes":
  // Extracted from draftOrders Bundle parameter
  // Implementation-specific extraction

define "Allergy Substance Codes":
  "Active Allergies" A return A.code

define "HasAllergyConflict":
  exists (
    "Draft Medication Codes" D
      where D in "Allergy Substance Codes"
        or exists "ConceptRelatedTo"(D, "Allergy Substance Codes")
  )
```

### Library Versioning

| Version Type | When to Bump | Impact |
|-------------|-------------|--------|
| Patch (x.y.Z) | Bug fixes; no logic change | Safe to deploy without testing review |
| Minor (x.Y.z) | New rules added; existing rules unchanged | Regression test required |
| Major (X.y.z) | Breaking logic changes; rules removed or fundamentally changed | Full validation cycle required |

---

## PlanDefinition for Order Sets

`PlanDefinition` resources define order sets that CDS can suggest:

```json
{
  "resourceType": "PlanDefinition",
  "id": "community-acquired-pneumonia-order-set",
  "url": "https://cds.monobase.health/PlanDefinition/cap-order-set",
  "version": "2.0",
  "name": "CAPOrderSet",
  "title": "Community-Acquired Pneumonia Order Set",
  "type": { "coding": [{ "code": "order-set" }] },
  "status": "active",
  "action": [
    {
      "id": "action-1",
      "title": "CBC with Differential",
      "definitionCanonical": "https://cds.monobase.health/ActivityDefinition/cbc-with-diff",
      "selectionBehavior": "at-most-one"
    },
    {
      "id": "action-2",
      "title": "Chest X-Ray (PA and Lateral)",
      "definitionCanonical": "https://cds.monobase.health/ActivityDefinition/cxr-pa-lateral",
      "selectionBehavior": "at-most-one"
    },
    {
      "id": "action-3",
      "title": "Antibiotic Selection",
      "selectionBehavior": "exactly-one",
      "action": [
        {
          "id": "action-3a",
          "title": "Azithromycin 500mg PO Daily x5 days",
          "definitionCanonical": "https://cds.monobase.health/ActivityDefinition/azithromycin-cap"
        },
        {
          "id": "action-3b",
          "title": "Doxycycline 100mg PO BID x7 days",
          "definitionCanonical": "https://cds.monobase.health/ActivityDefinition/doxycycline-cap"
        }
      ]
    }
  ]
}
```

---

## CQL Evaluation Engine Requirements

### Supported CQL Features

| Feature | Support |
|---------|---------|
| CQL 1.5 syntax | Full |
| FHIR R4 model info | Full |
| Date/time arithmetic | Full |
| List operations | Full |
| Code system comparisons (SNOMED, LOINC, RxNorm) | Full |
| Value set expansion | Full (via $expand) |
| Terminology subsumption | Full (SNOMED hierarchy) |
| Patient context | Full |
| Multi-patient evaluation | Via $apply operation |

### Value Set Binding

CQL libraries bind to value sets maintained as FHIR ValueSet resources:

```cql
valueset "Penicillin Antibiotics": 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.196.11.1001'
valueset "Active Medications": 'https://cds.monobase.health/ValueSet/active-medication-codes'
```

Value sets are expanded and cached at library load time. Cache is invalidated when the ValueSet resource version changes.

---

## Our CDS Hooks Endpoints

### Endpoint Registry

| Service ID | Hook | Description | Severity Outputs |
|-----------|------|-------------|-----------------|
| `patient-risk-summary` | `patient-view` | Chronic disease risk scores; care gap flags | info, warning |
| `drug-allergy-check` | `order-sign`, `medication-prescribe` | Drug-allergy cross-reference | critical |
| `drug-drug-interaction` | `order-sign`, `medication-prescribe` | Drug-drug interaction detection | warning, critical |
| `duplicate-order-check` | `order-sign` | Detect duplicate/redundant orders | warning |
| `formulary-check` | `order-select`, `medication-prescribe` | Insurance formulary status and cost | info, warning |
| `prior-auth-check` | `order-select`, `order-sign` | Prior authorization requirements | warning |
| `care-gap-alerts` | `encounter-start`, `patient-view` | Preventive care due; quality measure gaps | info |
| `discharge-checklist` | `encounter-discharge` | Discharge medication reconciliation; follow-up | warning |
| `epcs-check` | `medication-prescribe` | EPCS eligibility for controlled substances | critical |
| `sepsis-alert` | `encounter-start`, `patient-view` | Early warning sepsis scoring | warning, critical |
| `cap-order-set` | `order-sign` | Community-acquired pneumonia order set | info |
| `sdoh-screening` | `patient-view`, `encounter-start` | SDOH screening due reminder | info |

### Authentication for CDS Services

CDS services requesting additional data from the FHIR server use the token provided in `fhirAuthorization`:

```http
GET /fhir/Patient/patient-456
Authorization: Bearer {fhirAuthorization.access_token}
```

This token:
- Has limited scope (specified in `fhirAuthorization.scope`)
- Expires quickly (typically `fhirAuthorization.expires_in` = 300 seconds)
- Is patient-context scoped
