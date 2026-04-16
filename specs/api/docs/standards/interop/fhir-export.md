# FHIR R4 Export Layer Specification

**Standard:** HL7 FHIR R4 (4.0.1)
**Profiles:** US Core 6.1.0 (USCDI v3), Monobase FHIR Profiles
**Extension Namespace:** `https://monobase.health/fhir/StructureDefinition/`
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Content Negotiation](#content-negotiation)
2. [Patient](#patient)
3. [Encounter](#encounter)
4. [Condition](#condition)
5. [Observation](#observation)
6. [MedicationRequest](#medicationrequest)
7. [Procedure](#procedure)
8. [AllergyIntolerance](#allergyintolerance)
9. [Immunization](#immunization)
10. [ServiceRequest](#servicerequest)
11. [DiagnosticReport](#diagnosticreport)
12. [Claim](#claim)
13. [Coverage](#coverage)
14. [Composition](#composition)
15. [Bundle Generation for Composition/$document](#bundle-generation)
16. [Extension URI Reference](#extension-uri-reference)

---

## Content Negotiation

All FHIR endpoints support content negotiation via the `Accept` header.

| Accept Header | Format | Notes |
|--------------|--------|-------|
| `application/fhir+json` | FHIR JSON (preferred) | Default if no Accept header |
| `application/fhir+xml` | FHIR XML | Supported on all endpoints |
| `application/json` | FHIR JSON | Accepted as fallback |
| `application/xml` | FHIR XML | Accepted as fallback |

```http
GET /fhir/Patient/123
Accept: application/fhir+json
```

**`_format` query parameter** overrides Accept header:
```http
GET /fhir/Patient/123?_format=json
GET /fhir/Patient/123?_format=xml
```

---

## Patient

**Base FHIR Resource:** Patient
**US Core Profile:** `http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient`

### Field Mapping

| Our Field | FHIR Path | Cardinality | Notes |
|-----------|-----------|-------------|-------|
| `id` | `Patient.id` | 1..1 | UUID |
| `mrn` | `Patient.identifier[mrn]` | 0..1 | system = facility NamingSystem |
| `firstName` | `Patient.name[official].given[0]` | 1..* | HumanName.use = "official" |
| `lastName` | `Patient.name[official].family` | 1..1 | |
| `preferredName` | `Patient.name[nickname].given[0]` | 0..1 | HumanName.use = "nickname" |
| `dateOfBirth` | `Patient.birthDate` | 0..1 | YYYY-MM-DD |
| `sex` | `Patient.extension[birthSex]` | 0..1 | US Core Birth Sex extension |
| `genderIdentity` | `Patient.extension[genderIdentity]` | 0..1 | US Core Gender Identity extension |
| `race` | `Patient.extension[race]` | 0..* | US Core Race extension |
| `ethnicity` | `Patient.extension[ethnicity]` | 0..1 | US Core Ethnicity extension |
| `address` | `Patient.address[]` | 0..* | Address datatype |
| `phone` | `Patient.telecom[phone]` | 0..* | system = "phone" |
| `email` | `Patient.telecom[email]` | 0..* | system = "email" |
| `language` | `Patient.communication[].language` | 0..* | BCP-47 language code |
| `preferredLanguage` | `Patient.communication[preferred=true]` | 0..1 | preferred = true |
| `maritalStatus` | `Patient.maritalStatus` | 0..1 | v3-MaritalStatus codes |
| `deceased` | `Patient.deceased[x]` | 0..1 | Boolean or dateTime |
| `active` | `Patient.active` | 0..1 | |
| `generalPractitioner` | `Patient.generalPractitioner` | 0..* | Reference(Practitioner) |
| `managingOrganization` | `Patient.managingOrganization` | 0..1 | Reference(Organization) |
| `nhsNumber` | `Patient.identifier[nhs]` | 0..1 | system = "https://fhir.nhs.uk/Id/nhs-number" |

### Custom Extensions on Patient

| Extension URI | Purpose | Value Type |
|--------------|---------|-----------|
| `...patient-indigenous-status` | Indigenous/aboriginal status | CodeableConcept |
| `...patient-disability-status` | Disability flag | Boolean |
| `...patient-veteran-status` | Veteran status | Boolean |
| `...patient-social-determinants` | SDOH screening flag | Reference(QuestionnaireResponse) |

---

## Encounter

**Base FHIR Resource:** Encounter
**US Core Profile:** `http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter`

### Field Mapping

| Our Field | FHIR Path | Cardinality | Notes |
|-----------|-----------|-------------|-------|
| `id` | `Encounter.id` | 1..1 | |
| `status` | `Encounter.status` | 1..1 | planned/arrived/triaged/in-progress/on-leave/finished/cancelled |
| `class` | `Encounter.class` | 1..1 | v3 ActCode: IMP, AMB, VR, EMER, HH |
| `type` | `Encounter.type[]` | 0..* | SNOMED CT encounter type |
| `serviceType` | `Encounter.serviceType` | 0..1 | SNOMED CT service type |
| `priority` | `Encounter.priority` | 0..1 | v3 ActPriority |
| `subject` | `Encounter.subject` | 1..1 | Reference(Patient) |
| `participant` | `Encounter.participant[]` | 0..* | type, period, individual |
| `period` | `Encounter.period` | 0..1 | start, end |
| `length` | `Encounter.length` | 0..1 | Duration in minutes |
| `reasonCode` | `Encounter.reasonCode[]` | 0..* | SNOMED CT reason |
| `reasonReference` | `Encounter.reasonReference[]` | 0..* | Reference(Condition) |
| `location` | `Encounter.location[]` | 0..* | location, status, physicalType, period |
| `serviceProvider` | `Encounter.serviceProvider` | 0..1 | Reference(Organization) |
| `diagnosis` | `Encounter.diagnosis[]` | 0..* | condition, use, rank |
| `hospitalization` | `Encounter.hospitalization` | 0..1 | preAdmissionIdentifier, origin, admitSource, dischargeDisposition |
| `partOf` | `Encounter.partOf` | 0..1 | Reference(Encounter) for sub-encounters |

---

## Condition

**Base FHIR Resource:** Condition
**US Core Profile:** `http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns`

### Field Mapping

| Our Field | FHIR Path | Cardinality | Notes |
|-----------|-----------|-------------|-------|
| `id` | `Condition.id` | 1..1 | |
| `code` | `Condition.code` | 1..1 | SNOMED CT or ICD-10-CM |
| `clinicalStatus` | `Condition.clinicalStatus` | 0..1 | active/recurrence/relapse/inactive/remission/resolved |
| `verificationStatus` | `Condition.verificationStatus` | 0..1 | unconfirmed/provisional/differential/confirmed/refuted/entered-in-error |
| `category` | `Condition.category[]` | 0..* | problem-list-item / encounter-diagnosis / health-concern |
| `severity` | `Condition.severity` | 0..1 | SNOMED CT: mild/moderate/severe |
| `subject` | `Condition.subject` | 1..1 | Reference(Patient) |
| `encounter` | `Condition.encounter` | 0..1 | Reference(Encounter) |
| `onset[x]` | `Condition.onset[x]` | 0..1 | DateTime/Age/Period/Range/String |
| `abatement[x]` | `Condition.abatement[x]` | 0..1 | DateTime/Age/Period/Range/String |
| `recordedDate` | `Condition.recordedDate` | 0..1 | |
| `recorder` | `Condition.recorder` | 0..1 | Reference(Practitioner) |
| `asserter` | `Condition.asserter` | 0..1 | Reference(Practitioner) |
| `bodySite` | `Condition.bodySite[]` | 0..* | SNOMED CT body site |
| `note` | `Condition.note[]` | 0..* | Annotation |

---

## Observation

**Base FHIR Resource:** Observation
**US Core Profiles:** vital-signs, laboratory, social-history, smokingstatus, pediatric profiles

### Field Mapping

| Our Field | FHIR Path | Cardinality | Notes |
|-----------|-----------|-------------|-------|
| `id` | `Observation.id` | 1..1 | |
| `status` | `Observation.status` | 1..1 | registered/preliminary/final/amended/corrected/cancelled |
| `category` | `Observation.category[]` | 1..* | vital-signs/laboratory/social-history/exam/survey/imaging |
| `code` | `Observation.code` | 1..1 | LOINC preferred |
| `subject` | `Observation.subject` | 1..1 | Reference(Patient) |
| `encounter` | `Observation.encounter` | 0..1 | Reference(Encounter) |
| `effectiveDateTime` | `Observation.effective[x]` | 0..1 | DateTime/Period/Timing/Instant |
| `issued` | `Observation.issued` | 0..1 | Instant when result available |
| `performer` | `Observation.performer[]` | 0..* | Reference(Practitioner) |
| `valueQuantity` | `Observation.value[x]` | 0..1 | UCUM units |
| `valueCodeableConcept` | `Observation.value[x]` | 0..1 | SNOMED CT or LOINC answer |
| `valueString` | `Observation.value[x]` | 0..1 | Free text |
| `dataAbsentReason` | `Observation.dataAbsentReason` | 0..1 | When value absent |
| `interpretation` | `Observation.interpretation[]` | 0..* | H/L/N/A/AA etc. |
| `note` | `Observation.note[]` | 0..* | Annotation |
| `bodySite` | `Observation.bodySite` | 0..1 | SNOMED CT |
| `method` | `Observation.method` | 0..1 | SNOMED CT measurement method |
| `specimen` | `Observation.specimen` | 0..1 | Reference(Specimen) |
| `referenceRange` | `Observation.referenceRange[]` | 0..* | low, high, type, appliesTo, age |
| `component` | `Observation.component[]` | 0..* | For multi-component (e.g., blood pressure) |

---

## MedicationRequest

**Base FHIR Resource:** MedicationRequest
**US Core Profile:** `http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest`

### Field Mapping

| Our Field | FHIR Path | Cardinality | Notes |
|-----------|-----------|-------------|-------|
| `id` | `MedicationRequest.id` | 1..1 | |
| `status` | `MedicationRequest.status` | 1..1 | active/on-hold/cancelled/completed/stopped/draft |
| `intent` | `MedicationRequest.intent` | 1..1 | order/plan/proposal/original-order |
| `medicationCodeableConcept` | `MedicationRequest.medication[x]` | 1..1 | RxNorm preferred; NDC as additional |
| `subject` | `MedicationRequest.subject` | 1..1 | Reference(Patient) |
| `encounter` | `MedicationRequest.encounter` | 0..1 | Reference(Encounter) |
| `authoredOn` | `MedicationRequest.authoredOn` | 0..1 | |
| `requester` | `MedicationRequest.requester` | 1..1 | Reference(Practitioner) |
| `reasonCode` | `MedicationRequest.reasonCode[]` | 0..* | SNOMED CT indication |
| `dosageInstruction` | `MedicationRequest.dosageInstruction[]` | 0..* | text, timing, route, dose |
| `dispenseRequest` | `MedicationRequest.dispenseRequest` | 0..1 | quantity, numberOfRepeatsAllowed, expectedSupplyDuration |
| `substitution` | `MedicationRequest.substitution` | 0..1 | allowed, reason |
| `priorPrescription` | `MedicationRequest.priorPrescription` | 0..1 | Reference(MedicationRequest) |
| `note` | `MedicationRequest.note[]` | 0..* | |
| `category` | `MedicationRequest.category[]` | 0..* | community/discharge/inpatient/outpatient |

### Custom Extensions on MedicationRequest

| Extension URI | Purpose |
|--------------|---------|
| `...medication-dea-schedule` | DEA controlled substance schedule (I–V) |
| `...medication-prescriber-order-number` | Prescriber's order ID |
| `...medication-pharmacy-npi` | Target pharmacy NPI |
| `...medication-clinical-indication-free-text` | Free-text indication |

---

## Procedure

**Base FHIR Resource:** Procedure
**US Core Profile:** `http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure`

### Field Mapping

| Our Field | FHIR Path | Cardinality | Notes |
|-----------|-----------|-------------|-------|
| `id` | `Procedure.id` | 1..1 | |
| `status` | `Procedure.status` | 1..1 | preparation/in-progress/not-done/on-hold/stopped/completed |
| `code` | `Procedure.code` | 1..1 | CPT-4/SNOMED CT/ICD-10-PCS |
| `subject` | `Procedure.subject` | 1..1 | Reference(Patient) |
| `encounter` | `Procedure.encounter` | 0..1 | Reference(Encounter) |
| `performed[x]` | `Procedure.performed[x]` | 0..1 | DateTime or Period |
| `performer` | `Procedure.performer[]` | 0..* | actor, function, onBehalfOf |
| `location` | `Procedure.location` | 0..1 | Reference(Location) |
| `reasonCode` | `Procedure.reasonCode[]` | 0..* | SNOMED CT |
| `reasonReference` | `Procedure.reasonReference[]` | 0..* | Reference(Condition) |
| `bodySite` | `Procedure.bodySite[]` | 0..* | SNOMED CT |
| `outcome` | `Procedure.outcome` | 0..1 | SNOMED CT |
| `report` | `Procedure.report[]` | 0..* | Reference(DiagnosticReport) |
| `complication` | `Procedure.complication[]` | 0..* | SNOMED CT |
| `note` | `Procedure.note[]` | 0..* | |
| `focalDevice` | `Procedure.focalDevice[]` | 0..* | action, manipulated (Device reference) |
| `usedCode` | `Procedure.usedCode[]` | 0..* | SNOMED CT devices/supplies used |

---

## AllergyIntolerance

**Base FHIR Resource:** AllergyIntolerance
**US Core Profile:** `http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance`

### Field Mapping

| Our Field | FHIR Path | Cardinality | Notes |
|-----------|-----------|-------------|-------|
| `id` | `AllergyIntolerance.id` | 1..1 | |
| `clinicalStatus` | `AllergyIntolerance.clinicalStatus` | 0..1 | active/inactive/resolved |
| `verificationStatus` | `AllergyIntolerance.verificationStatus` | 0..1 | unconfirmed/confirmed/refuted/entered-in-error |
| `type` | `AllergyIntolerance.type` | 0..1 | allergy/intolerance |
| `category` | `AllergyIntolerance.category[]` | 0..* | food/medication/environment/biologic |
| `criticality` | `AllergyIntolerance.criticality` | 0..1 | low/high/unable-to-assess |
| `code` | `AllergyIntolerance.code` | 1..1 | RxNorm/SNOMED CT/NDF-RT |
| `patient` | `AllergyIntolerance.patient` | 1..1 | Reference(Patient) |
| `encounter` | `AllergyIntolerance.encounter` | 0..1 | Reference(Encounter) |
| `onset[x]` | `AllergyIntolerance.onset[x]` | 0..1 | DateTime/Age/Period/Range/String |
| `recordedDate` | `AllergyIntolerance.recordedDate` | 0..1 | |
| `recorder` | `AllergyIntolerance.recorder` | 0..1 | Reference(Practitioner) |
| `asserter` | `AllergyIntolerance.asserter` | 0..1 | Reference(Patient or Practitioner) |
| `reaction` | `AllergyIntolerance.reaction[]` | 0..* | substance, manifestation, severity, exposureRoute |

---

## Immunization

**Base FHIR Resource:** Immunization
**US Core Profile:** `http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization`

### Field Mapping

| Our Field | FHIR Path | Cardinality | Notes |
|-----------|-----------|-------------|-------|
| `id` | `Immunization.id` | 1..1 | |
| `status` | `Immunization.status` | 1..1 | completed/entered-in-error/not-done |
| `statusReason` | `Immunization.statusReason` | 0..1 | If not-done: SNOMED CT reason |
| `vaccineCode` | `Immunization.vaccineCode` | 1..1 | CVX code (CDC) |
| `patient` | `Immunization.patient` | 1..1 | Reference(Patient) |
| `encounter` | `Immunization.encounter` | 0..1 | Reference(Encounter) |
| `occurrenceDateTime` | `Immunization.occurrence[x]` | 1..1 | DateTime or String |
| `recorded` | `Immunization.recorded` | 0..1 | Date recorded in EHR |
| `primarySource` | `Immunization.primarySource` | 0..1 | True if from administering facility |
| `manufacturer` | `Immunization.manufacturer` | 0..1 | Reference(Organization) |
| `lotNumber` | `Immunization.lotNumber` | 0..1 | Vaccine lot number |
| `expirationDate` | `Immunization.expirationDate` | 0..1 | |
| `site` | `Immunization.site` | 0..1 | SNOMED CT body site |
| `route` | `Immunization.route` | 0..1 | SNOMED CT route |
| `doseQuantity` | `Immunization.doseQuantity` | 0..1 | UCUM units |
| `performer` | `Immunization.performer[]` | 0..* | actor, function |
| `note` | `Immunization.note[]` | 0..* | |
| `protocolApplied` | `Immunization.protocolApplied[]` | 0..* | series, doseNumber |

---

## ServiceRequest

**Base FHIR Resource:** ServiceRequest
**US Core Profile:** `http://hl7.org/fhir/us/core/StructureDefinition/us-core-servicerequest`

### Field Mapping

| Our Field | FHIR Path | Cardinality | Notes |
|-----------|-----------|-------------|-------|
| `id` | `ServiceRequest.id` | 1..1 | |
| `status` | `ServiceRequest.status` | 1..1 | draft/active/on-hold/revoked/completed/entered-in-error/unknown |
| `intent` | `ServiceRequest.intent` | 1..1 | proposal/plan/directive/order/original-order/reflex-order/filler-order/instance-order/option |
| `category` | `ServiceRequest.category[]` | 0..* | SNOMED CT service category |
| `code` | `ServiceRequest.code` | 0..1 | SNOMED CT/LOINC/CPT |
| `subject` | `ServiceRequest.subject` | 1..1 | Reference(Patient) |
| `encounter` | `ServiceRequest.encounter` | 0..1 | Reference(Encounter) |
| `occurrence[x]` | `ServiceRequest.occurrence[x]` | 0..1 | DateTime/Period/Timing |
| `authoredOn` | `ServiceRequest.authoredOn` | 0..1 | |
| `requester` | `ServiceRequest.requester` | 0..1 | Reference(Practitioner) |
| `performer` | `ServiceRequest.performer[]` | 0..* | Reference(Practitioner/Organization) |
| `reasonCode` | `ServiceRequest.reasonCode[]` | 0..* | SNOMED CT |
| `reasonReference` | `ServiceRequest.reasonReference[]` | 0..* | Reference(Condition/Observation) |
| `specimen` | `ServiceRequest.specimen[]` | 0..* | Reference(Specimen) |
| `bodySite` | `ServiceRequest.bodySite[]` | 0..* | SNOMED CT |
| `note` | `ServiceRequest.note[]` | 0..* | |
| `patientInstruction` | `ServiceRequest.patientInstruction` | 0..1 | Plain-language instructions |

---

## DiagnosticReport

**Base FHIR Resource:** DiagnosticReport
**US Core Profiles:** laboratory, note

### Field Mapping

| Our Field | FHIR Path | Cardinality | Notes |
|-----------|-----------|-------------|-------|
| `id` | `DiagnosticReport.id` | 1..1 | |
| `status` | `DiagnosticReport.status` | 1..1 | registered/partial/preliminary/final/amended/corrected/appended/cancelled |
| `category` | `DiagnosticReport.category[]` | 0..* | LOINC category |
| `code` | `DiagnosticReport.code` | 1..1 | LOINC order code |
| `subject` | `DiagnosticReport.subject` | 1..1 | Reference(Patient) |
| `encounter` | `DiagnosticReport.encounter` | 0..1 | Reference(Encounter) |
| `effective[x]` | `DiagnosticReport.effective[x]` | 0..1 | DateTime or Period |
| `issued` | `DiagnosticReport.issued` | 0..1 | When report was released |
| `performer` | `DiagnosticReport.performer[]` | 0..* | Reference(Practitioner/Organization) |
| `resultsInterpreter` | `DiagnosticReport.resultsInterpreter[]` | 0..* | Reference(Practitioner) |
| `result` | `DiagnosticReport.result[]` | 0..* | Reference(Observation) |
| `imagingStudy` | `DiagnosticReport.imagingStudy[]` | 0..* | Reference(ImagingStudy) |
| `conclusion` | `DiagnosticReport.conclusion` | 0..1 | Clinical conclusion text |
| `conclusionCode` | `DiagnosticReport.conclusionCode[]` | 0..* | SNOMED CT |
| `presentedForm` | `DiagnosticReport.presentedForm[]` | 0..* | Attachment (PDF report) |

---

## Claim

**Base FHIR Resource:** Claim

### Field Mapping

| Our Field | FHIR Path | Cardinality | Notes |
|-----------|-----------|-------------|-------|
| `id` | `Claim.id` | 1..1 | |
| `status` | `Claim.status` | 1..1 | active/cancelled/draft/entered-in-error |
| `type` | `Claim.type` | 1..1 | professional/institutional/oral |
| `use` | `Claim.use` | 1..1 | claim/preauthorization/predetermination |
| `patient` | `Claim.patient` | 1..1 | Reference(Patient) |
| `billablePeriod` | `Claim.billablePeriod` | 0..1 | Service period |
| `created` | `Claim.created` | 1..1 | Claim creation date |
| `provider` | `Claim.provider` | 1..1 | Reference(Organization) |
| `priority` | `Claim.priority` | 1..1 | normal/stat/deferred |
| `insurance` | `Claim.insurance[]` | 1..* | sequence, focal, coverage |
| `diagnosis` | `Claim.diagnosis[]` | 0..* | sequence, diagnosis, type |
| `procedure` | `Claim.procedure[]` | 0..* | sequence, procedure, date |
| `item` | `Claim.item[]` | 0..* | service line items |
| `item.productOrService` | `Claim.item[].productOrService` | 1..1 | CPT/HCPCS |
| `item.quantity` | `Claim.item[].quantity` | 0..1 | Units |
| `item.unitPrice` | `Claim.item[].unitPrice` | 0..1 | Fee schedule amount |
| `total` | `Claim.total` | 0..1 | Total claim value |

---

## Coverage

**Base FHIR Resource:** Coverage

### Field Mapping

| Our Field | FHIR Path | Cardinality | Notes |
|-----------|-----------|-------------|-------|
| `id` | `Coverage.id` | 1..1 | |
| `status` | `Coverage.status` | 1..1 | active/cancelled/draft/entered-in-error |
| `type` | `Coverage.type` | 0..1 | SNOMED CT coverage type (e.g., Medicare Part A) |
| `subscriber` | `Coverage.subscriber` | 0..1 | Reference(Patient) — policyholder |
| `subscriberId` | `Coverage.subscriberId` | 0..1 | Member ID |
| `beneficiary` | `Coverage.beneficiary` | 1..1 | Reference(Patient) |
| `relationship` | `Coverage.relationship` | 0..1 | self/spouse/child/other |
| `period` | `Coverage.period` | 0..1 | start, end |
| `payor` | `Coverage.payor[]` | 1..* | Reference(Organization) |
| `class` | `Coverage.class[]` | 0..* | group/plan/subGroup/subPlan |
| `order` | `Coverage.order` | 0..1 | Coordination of benefits order |
| `network` | `Coverage.network` | 0..1 | Network name |
| `costToBeneficiary` | `Coverage.costToBeneficiary[]` | 0..* | copay, deductible, coinsurance |

---

## Composition

**Base FHIR Resource:** Composition

### Field Mapping

| Our Field | FHIR Path | Cardinality | Notes |
|-----------|-----------|-------------|-------|
| `id` | `Composition.id` | 1..1 | |
| `status` | `Composition.status` | 1..1 | preliminary/final/amended/entered-in-error |
| `type` | `Composition.type` | 1..1 | LOINC document type code |
| `category` | `Composition.category[]` | 0..* | LOINC document category |
| `subject` | `Composition.subject` | 0..1 | Reference(Patient) |
| `encounter` | `Composition.encounter` | 0..1 | Reference(Encounter) |
| `date` | `Composition.date` | 1..1 | Document date |
| `author` | `Composition.author[]` | 1..* | Reference(Practitioner/Organization) |
| `title` | `Composition.title` | 1..1 | Document title |
| `custodian` | `Composition.custodian` | 0..1 | Reference(Organization) |
| `relatesTo` | `Composition.relatesTo[]` | 0..* | replaces, transforms, signs, appends |
| `attester` | `Composition.attester[]` | 0..* | mode, time, party |
| `section` | `Composition.section[]` | 0..* | Structured document sections |

---

## Bundle Generation

### Composition/$document Operation

Generates a fully resolved FHIR Document Bundle from a Composition and all its referenced resources.

```http
POST /fhir/Composition/{id}/$document
Accept: application/fhir+json
```

Or with persistence:
```http
GET /fhir/Composition/{id}/$document?persist=true
```

### Bundle Structure

```json
{
  "resourceType": "Bundle",
  "id": "bundle-uuid",
  "meta": {
    "profile": ["http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips"]
  },
  "identifier": {
    "system": "https://monobase.health/fhir/bundle-ids",
    "value": "bundle-uuid"
  },
  "type": "document",
  "timestamp": "2026-04-14T12:00:00Z",
  "entry": [
    {
      "fullUrl": "urn:uuid:composition-id",
      "resource": { "resourceType": "Composition", "..." }
    },
    {
      "fullUrl": "urn:uuid:patient-id",
      "resource": { "resourceType": "Patient", "..." }
    }
  ]
}
```

**Bundle entry order:** Composition is always first. Patient is always second. All other resources follow in the order they are referenced from the Composition.

---

## Extension URI Reference

All custom extensions use the namespace `https://monobase.health/fhir/StructureDefinition/`.

| Extension Local Name | Full URI | Resource(s) | Value Type |
|---------------------|----------|-------------|-----------|
| `patient-indigenous-status` | `https://monobase.health/fhir/StructureDefinition/patient-indigenous-status` | Patient | CodeableConcept |
| `patient-disability-status` | `https://monobase.health/fhir/StructureDefinition/patient-disability-status` | Patient | boolean |
| `patient-veteran-status` | `https://monobase.health/fhir/StructureDefinition/patient-veteran-status` | Patient | boolean |
| `encounter-telemedicine-type` | `https://monobase.health/fhir/StructureDefinition/encounter-telemedicine-type` | Encounter | CodeableConcept |
| `medication-dea-schedule` | `https://monobase.health/fhir/StructureDefinition/medication-dea-schedule` | MedicationRequest | code |
| `medication-prescriber-order-number` | `https://monobase.health/fhir/StructureDefinition/medication-prescriber-order-number` | MedicationRequest | string |
| `medication-pharmacy-npi` | `https://monobase.health/fhir/StructureDefinition/medication-pharmacy-npi` | MedicationRequest | string |
| `device-fda-class` | `https://monobase.health/fhir/StructureDefinition/device-fda-class` | Device | code |
| `device-mdr-class` | `https://monobase.health/fhir/StructureDefinition/device-mdr-class` | Device | code |
| `device-gmdn-code` | `https://monobase.health/fhir/StructureDefinition/device-gmdn-code` | Device | string |
| `claim-prior-auth-number` | `https://monobase.health/fhir/StructureDefinition/claim-prior-auth-number` | Claim | string |
| `coverage-rx-bin` | `https://monobase.health/fhir/StructureDefinition/coverage-rx-bin` | Coverage | string |
| `coverage-rx-pcn` | `https://monobase.health/fhir/StructureDefinition/coverage-rx-pcn` | Coverage | string |
