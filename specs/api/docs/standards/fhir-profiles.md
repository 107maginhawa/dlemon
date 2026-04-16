# FHIR R4 Profile Definitions

**Extension Namespace:** `https://monobase.health/fhir/StructureDefinition/`
**Base Standard:** HL7 FHIR R4 (4.0.1)
**US Core Base:** US Core 6.1.0 (USCDI v3)
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [How to Read This Document](#how-to-read-this-document)
2. [Clinical Resources](#clinical-resources)
3. [Medications](#medications)
4. [Administrative/Workflow Resources](#administrativeworkflow-resources)
5. [Financial Resources](#financial-resources)
6. [Diagnostic Resources](#diagnostic-resources)
7. [Infrastructure Resources](#infrastructure-resources)
8. [Extension Definitions](#extension-definitions)

---

## How to Read This Document

Each resource table uses the following columns:

| Column | Description |
|--------|-------------|
| Base Resource | HL7 FHIR R4 resource name |
| US Core Profile | Base US Core profile (if applicable) |
| Our Profile URL | Full canonical URL of our profile |
| Extensions Added | Custom extensions we add (local name only; prefix with namespace) |
| Constrained Fields | Fields with tighter cardinality or fixed values |
| Omitted Fields | FHIR fields not used in our profile |
| Must-Support | Fields we mark as must-support (MS) |

**Must-Support (MS):** Implementations claiming conformance to our profiles SHALL be capable of populating and consuming MS elements.

---

## Clinical Resources

### Patient

| Property | Value |
|----------|-------|
| Base Resource | Patient |
| US Core Profile | `http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient` |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-patient` |

| Field | Cardinality | MS | Notes |
|-------|-------------|-----|-------|
| `id` | 1..1 | Yes | UUID assigned at creation |
| `meta.profile` | 1..* | Yes | Must include our profile URL |
| `identifier` | 1..* | Yes | At least one identifier required |
| `identifier[mrn]` | 0..1 | Yes | Medical record number |
| `name` | 1..* | Yes | At least one HumanName |
| `name[official]` | 1..1 | Yes | Legal name required |
| `telecom` | 0..* | Yes | Phone or email preferred |
| `gender` | 0..1 | Yes | administrative gender |
| `birthDate` | 0..1 | Yes | |
| `address` | 0..* | Yes | |
| `communication` | 0..* | Yes | |
| `generalPractitioner` | 0..* | Yes | |
| `managingOrganization` | 0..1 | Yes | |
| `extension[birthSex]` | 0..1 | Yes | US Core extension |
| `extension[genderIdentity]` | 0..1 | Yes | US Core extension |
| `extension[race]` | 0..3 | Yes | US Core extension |
| `extension[ethnicity]` | 0..1 | Yes | US Core extension |
| `extension[patient-indigenous-status]` | 0..1 | No | Custom |
| `extension[patient-disability-status]` | 0..1 | No | Custom |
| `extension[patient-veteran-status]` | 0..1 | No | Custom |
| `link` | 0..* | No | For patient merges |
| `photo` | 0..0 | — | Omitted |
| `contact[].organization` | 0..* | No | Emergency contacts |

### Condition

| Property | Value |
|----------|-------|
| Base Resource | Condition |
| US Core Profile | `http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns` |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-condition` |

| Field | Cardinality | MS | Notes |
|-------|-------------|-----|-------|
| `clinicalStatus` | 1..1 | Yes | Required (no unknown status) |
| `verificationStatus` | 1..1 | Yes | Required |
| `category` | 1..* | Yes | Must include problem-list-item or encounter-diagnosis |
| `code` | 1..1 | Yes | SNOMED CT or ICD-10-CM |
| `subject` | 1..1 | Yes | Reference(Patient) |
| `encounter` | 0..1 | Yes | |
| `onset[x]` | 0..1 | Yes | |
| `abatement[x]` | 0..1 | Yes | |
| `recordedDate` | 0..1 | Yes | |
| `recorder` | 0..1 | Yes | |
| `asserter` | 0..1 | No | |
| `severity` | 0..1 | No | |
| `bodySite` | 0..* | No | |
| `stage` | 0..* | No | For oncology staging |
| `note` | 0..* | No | |
| `evidence` | 0..0 | — | Omitted — use DiagnosticReport instead |

### Observation

| Property | Value |
|----------|-------|
| Base Resource | Observation |
| US Core Profiles | Multiple (vital-signs, laboratory, social-history, etc.) |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-observation` |

| Field | Cardinality | MS | Notes |
|-------|-------------|-----|-------|
| `status` | 1..1 | Yes | Final or amended preferred for reporting |
| `category` | 1..* | Yes | Required; guides terminology binding |
| `code` | 1..1 | Yes | LOINC preferred; SNOMED acceptable |
| `subject` | 1..1 | Yes | Reference(Patient) |
| `effective[x]` | 0..1 | Yes | |
| `issued` | 0..1 | Yes | For lab results |
| `performer` | 0..* | Yes | |
| `value[x]` | 0..1 | Yes | Quantity, CodeableConcept, or string |
| `dataAbsentReason` | 0..1 | Yes | Required when value absent |
| `interpretation` | 0..* | Yes | |
| `note` | 0..* | No | |
| `bodySite` | 0..1 | No | |
| `method` | 0..1 | No | |
| `specimen` | 0..1 | No | |
| `device` | 0..1 | No | |
| `referenceRange` | 0..* | Yes | |
| `component` | 0..* | Yes | For blood pressure, etc. |
| `hasMember` | 0..* | No | For observation panels |

### AllergyIntolerance

| Property | Value |
|----------|-------|
| Base Resource | AllergyIntolerance |
| US Core Profile | `http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance` |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-allergy-intolerance` |

| Field | Cardinality | MS | Notes |
|-------|-------------|-----|-------|
| `clinicalStatus` | 1..1 | Yes | Must be present |
| `verificationStatus` | 1..1 | Yes | Must be present |
| `type` | 0..1 | Yes | allergy or intolerance |
| `category` | 0..* | Yes | food/medication/environment |
| `criticality` | 0..1 | Yes | |
| `code` | 1..1 | Yes | RxNorm for medications; SNOMED for other |
| `patient` | 1..1 | Yes | |
| `reaction` | 0..* | Yes | |
| `reaction[].manifestation` | 1..* | Yes | Required within reaction |
| `reaction[].severity` | 0..1 | Yes | |
| `recorder` | 0..1 | No | |
| `asserter` | 0..1 | No | |

### Immunization

| Property | Value |
|----------|-------|
| Base Resource | Immunization |
| US Core Profile | `http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization` |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-immunization` |

| Field | Cardinality | MS | Notes |
|-------|-------------|-----|-------|
| `status` | 1..1 | Yes | completed or not-done |
| `statusReason` | 0..1 | Yes | Required when status = not-done |
| `vaccineCode` | 1..1 | Yes | CVX code required |
| `patient` | 1..1 | Yes | |
| `occurrenceDateTime` | 1..1 | Yes | Date of administration |
| `primarySource` | 0..1 | Yes | |
| `lotNumber` | 0..1 | Yes | |
| `expirationDate` | 0..1 | No | |
| `site` | 0..1 | Yes | |
| `route` | 0..1 | Yes | |
| `doseQuantity` | 0..1 | Yes | |
| `performer` | 0..* | Yes | |
| `protocolApplied` | 0..* | Yes | Series name and dose number |
| `reaction` | 0..0 | — | Omitted — use AdverseEvent instead |

---

## Medications

### MedicationRequest

| Property | Value |
|----------|-------|
| Base Resource | MedicationRequest |
| US Core Profile | `http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest` |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-medication-request` |

| Field | Cardinality | MS | Notes |
|-------|-------------|-----|-------|
| `status` | 1..1 | Yes | |
| `intent` | 1..1 | Yes | Usually order |
| `category` | 1..* | Yes | community/discharge/inpatient/outpatient |
| `medication[x]` | 1..1 | Yes | CodeableConcept (RxNorm) preferred |
| `subject` | 1..1 | Yes | |
| `encounter` | 0..1 | Yes | |
| `authoredOn` | 1..1 | Yes | Required |
| `requester` | 1..1 | Yes | Prescribing practitioner |
| `dosageInstruction` | 0..* | Yes | |
| `dosageInstruction[].text` | 0..1 | Yes | Human-readable sig |
| `dispenseRequest` | 0..1 | Yes | |
| `substitution` | 0..1 | Yes | |
| `extension[dea-schedule]` | 0..1 | Yes | For controlled substances |
| `extension[pharmacy-npi]` | 0..1 | No | Target pharmacy |
| `priorPrescription` | 0..1 | No | |
| `reasonCode` | 0..* | No | |
| `note` | 0..* | No | |

### MedicationAdministration

| Property | Value |
|----------|-------|
| Base Resource | MedicationAdministration |
| US Core Profile | None (US Core does not profile MedicationAdministration) |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-medication-administration` |

| Field | Cardinality | MS | Notes |
|-------|-------------|-----|-------|
| `status` | 1..1 | Yes | |
| `medication[x]` | 1..1 | Yes | |
| `subject` | 1..1 | Yes | |
| `context` | 0..1 | Yes | Reference to Encounter |
| `effective[x]` | 1..1 | Yes | |
| `performer` | 1..* | Yes | Nurse/administering provider |
| `dosage` | 0..1 | Yes | |
| `dosage.text` | 0..1 | Yes | |
| `dosage.route` | 0..1 | Yes | |
| `dosage.dose` | 0..1 | Yes | |
| `request` | 0..1 | Yes | Reference(MedicationRequest) |

---

## Administrative/Workflow Resources

### Encounter

| Property | Value |
|----------|-------|
| Base Resource | Encounter |
| US Core Profile | `http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter` |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-encounter` |

| Field | Cardinality | MS | Notes |
|-------|-------------|-----|-------|
| `status` | 1..1 | Yes | |
| `class` | 1..1 | Yes | IMP/AMB/EMER/VR/HH required |
| `type` | 0..* | Yes | |
| `subject` | 1..1 | Yes | |
| `participant` | 0..* | Yes | |
| `period` | 0..1 | Yes | |
| `reasonCode` | 0..* | Yes | |
| `diagnosis` | 0..* | Yes | |
| `hospitalization` | 0..1 | Yes | |
| `location` | 0..* | Yes | |
| `serviceProvider` | 0..1 | Yes | |
| `extension[encounter-telemedicine-type]` | 0..1 | No | For virtual encounters |

### Practitioner / PractitionerRole

| Property | Value |
|----------|-------|
| Base Resources | Practitioner, PractitionerRole |
| US Core Profiles | us-core-practitioner, us-core-practitionerrole |
| Our Profile URLs | `...monobase-practitioner`, `...monobase-practitioner-role` |

**Practitioner Must-Support:** `identifier[NPI]`, `name`, `telecom`, `address`, `qualification`

**PractitionerRole Must-Support:** `practitioner`, `organization`, `code` (role), `specialty`, `location`, `endpoint`

### Organization

| Property | Value |
|----------|-------|
| Base Resource | Organization |
| US Core Profile | `http://hl7.org/fhir/us/core/StructureDefinition/us-core-organization` |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-organization` |

**Must-Support:** `identifier[NPI]`, `identifier[TIN]`, `active`, `type`, `name`, `telecom`, `address`, `endpoint`

**Custom Extensions:** `organization-ehds-registration`, `organization-default-consent-model`, `organization-data-residency`

---

## Financial Resources

### Coverage

| Property | Value |
|----------|-------|
| Base Resource | Coverage |
| US Core Profile | (HRex Coverage) |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-coverage` |

| Field | Cardinality | MS | Notes |
|-------|-------------|-----|-------|
| `status` | 1..1 | Yes | |
| `beneficiary` | 1..1 | Yes | |
| `payor` | 1..* | Yes | |
| `subscriberId` | 0..1 | Yes | Member ID |
| `relationship` | 0..1 | Yes | |
| `period` | 0..1 | Yes | |
| `class[group]` | 0..1 | Yes | |
| `class[plan]` | 0..1 | Yes | |
| `network` | 0..1 | Yes | |
| `order` | 0..1 | Yes | COB order |
| `extension[rx-bin]` | 0..1 | No | Pharmacy BIN |
| `extension[rx-pcn]` | 0..1 | No | Pharmacy PCN |

### Claim

| Property | Value |
|----------|-------|
| Base Resource | Claim |
| US Core Profile | None |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-claim` |

**Must-Support:** `status`, `type`, `use`, `patient`, `created`, `provider`, `priority`, `insurance`, `diagnosis`, `item`

---

## Diagnostic Resources

### DiagnosticReport

| Property | Value |
|----------|-------|
| Base Resource | DiagnosticReport |
| US Core Profiles | us-core-diagnosticreport-lab, us-core-diagnosticreport-note |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-diagnostic-report` |

**Must-Support:** `status`, `category`, `code`, `subject`, `effective[x]`, `issued`, `performer`, `result`, `conclusion`, `conclusionCode`

### ServiceRequest

| Property | Value |
|----------|-------|
| Base Resource | ServiceRequest |
| US Core Profile | `http://hl7.org/fhir/us/core/StructureDefinition/us-core-servicerequest` |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-service-request` |

**Must-Support:** `status`, `intent`, `code`, `subject`, `encounter`, `authoredOn`, `requester`, `performer`

### ImagingStudy

| Property | Value |
|----------|-------|
| Base Resource | ImagingStudy |
| US Core Profile | None |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-imaging-study` |

**Must-Support:** `identifier[studyInstanceUid]`, `identifier[accession]`, `status`, `modality`, `subject`, `started`, `numberOfSeries`, `numberOfInstances`, `series`

---

## Infrastructure Resources

### Composition

| Property | Value |
|----------|-------|
| Base Resource | Composition |
| US Core Profile | None |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-composition` |

**Must-Support:** `status`, `type`, `subject`, `date`, `author`, `title`, `attester`, `custodian`, `relatesTo`, `section`

### Provenance

| Property | Value |
|----------|-------|
| Base Resource | Provenance |
| US Core Profile | `http://hl7.org/fhir/us/core/StructureDefinition/us-core-provenance` |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-provenance` |

**Must-Support:** `target`, `recorded`, `activity`, `agent`, `agent[].type`, `agent[].who`, `agent[].onBehalfOf`, `entity`

### AuditEvent

| Property | Value |
|----------|-------|
| Base Resource | AuditEvent |
| US Core Profile | None |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-audit-event` |

**Must-Support:** `type`, `subtype`, `action`, `period`, `recorded`, `outcome`, `purposeOfEvent`, `agent`, `source`, `entity`

**Constrained:** `recorded` — must be within 60 seconds of the audited event; `outcome` — cannot be omitted

### Consent

| Property | Value |
|----------|-------|
| Base Resource | Consent |
| US Core Profile | None |
| Our Profile URL | `https://monobase.health/fhir/StructureDefinition/monobase-consent` |

**Must-Support:** `status`, `scope`, `category`, `patient`, `dateTime`, `performer`, `policyRule`, `provision`, `provision.type`, `provision.period`, `provision.actor`, `provision.purpose`

---

## Extension Definitions

### Complete Extension Registry

| Extension Name | Type | Cardinality | Context | ValueType |
|---------------|------|-------------|---------|-----------|
| `patient-indigenous-status` | Simple | 0..1 | Patient | CodeableConcept |
| `patient-disability-status` | Simple | 0..1 | Patient | boolean |
| `patient-veteran-status` | Simple | 0..1 | Patient | boolean |
| `patient-social-determinants` | Simple | 0..1 | Patient | Reference(QuestionnaireResponse) |
| `encounter-telemedicine-type` | Simple | 0..1 | Encounter | CodeableConcept |
| `medication-dea-schedule` | Simple | 0..1 | MedicationRequest | code |
| `medication-prescriber-order-number` | Simple | 0..1 | MedicationRequest | string |
| `medication-pharmacy-npi` | Simple | 0..1 | MedicationRequest | string |
| `medication-clinical-indication-free-text` | Simple | 0..1 | MedicationRequest | string |
| `coverage-rx-bin` | Simple | 0..1 | Coverage | string |
| `coverage-rx-pcn` | Simple | 0..1 | Coverage | string |
| `claim-prior-auth-number` | Simple | 0..1 | Claim | string |
| `device-fda-class` | Simple | 0..1 | Device | code |
| `device-mdr-class` | Simple | 0..1 | Device | code |
| `device-gmdn-code` | Simple | 0..1 | Device | string |
| `device-ce-marking` | Simple | 0..1 | Device | code |
| `device-iec62304-class` | Simple | 0..1 | Device | code |
| `device-510k-number` | Simple | 0..1 | Device | string |
| `device-eudamed-srn` | Simple | 0..1 | Device | string |
| `organization-ehds-registration` | Simple | 0..1 | Organization | string |
| `organization-default-consent-model` | Simple | 0..1 | Organization | code |
| `organization-data-residency` | Simple | 0..1 | Organization | CodeableConcept |
| `epcs-identity-verified` | Simple | 0..1 | Practitioner | boolean |
| `part2-program` | Simple | 0..1 | Organization | boolean |
| `consent-directive-type` | Simple | 0..1 | Consent | CodeableConcept |
