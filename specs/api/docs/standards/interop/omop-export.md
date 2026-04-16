# OMOP CDM Export Guide

**Standard:** OMOP Common Data Model v5.4
**Governing Body:** Observational Health Data Sciences and Informatics (OHDSI)
**Use Cases:** Real-world evidence, pharmacovigilance, clinical research networks, OHDSI network studies
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Overview](#overview)
2. [Export API](#export-api)
3. [Core Domain Mappings](#core-domain-mappings)
4. [Vocabulary Mappings](#vocabulary-mappings)
5. [OMOP Table Reference](#omop-table-reference)
6. [ETL Considerations](#etl-considerations)

---

## Overview

### Why OMOP CDM

The OMOP CDM standardizes clinical data from disparate sources into a common structure and terminology, enabling:
- Multi-site federated research across healthcare networks (OHDSI, PCORnet, TriNetX)
- Pharmacovigilance studies across millions of patients
- Clinical quality improvement via standardized analytics
- FDA Sentinel system participation
- Regulatory-grade real-world evidence

### OMOP v5.4 Domain Model

| Domain | Tables | Description |
|--------|--------|-------------|
| **Persons** | PERSON, OBSERVATION_PERIOD | Patient demographics and observation windows |
| **Visits** | VISIT_OCCURRENCE, VISIT_DETAIL | Healthcare encounters |
| **Clinical** | CONDITION_OCCURRENCE, DRUG_EXPOSURE, PROCEDURE_OCCURRENCE, MEASUREMENT, OBSERVATION, NOTE, SPECIMEN | Clinical events |
| **Health Economics** | PAYER_PLAN_PERIOD, COST | Insurance and costs |
| **Derived** | DRUG_ERA, DOSE_ERA, CONDITION_ERA | Derived longitudinal records |
| **Metadata** | CDM_SOURCE, METADATA | Dataset information |
| **Vocabulary** | CONCEPT, CONCEPT_RELATIONSHIP, VOCABULARY, DOMAIN, etc. | Reference vocabulary |

### Export Scope

Our OMOP export covers:
- All standard clinical domains (conditions, medications, procedures, measurements, observations)
- Patient demographics
- Visit data with detail
- Specimen data
- Notes (clinical documents)
- Insurance coverage (payer plan periods)

---

## Export API

### Initiate OMOP Export

```http
POST /fhir/$export-omop
Content-Type: application/fhir+json

{
  "resourceType": "Parameters",
  "parameter": [
    { "name": "outputFormat", "valueCode": "csv" },
    { "name": "cdmVersion", "valueString": "5.4" },
    { "name": "since", "valueInstant": "2025-01-01T00:00:00Z" },
    { "name": "patient", "valueReference": { "reference": "Group/research-cohort-1" } },
    { "name": "pseudonymize", "valueBoolean": true },
    { "name": "vocabulary", "valueBoolean": true }
  ]
}
```

**Response:**
```http
202 Accepted
Content-Location: /fhir/$export-omop/job-uuid
```

### Output Formats

| Format | Description |
|--------|-------------|
| `csv` | Comma-separated values, one file per OMOP table |
| `parquet` | Apache Parquet (columnar; preferred for large datasets) |
| `json` | JSON Lines format |
| `sql` | SQL INSERT statements |

### Check Export Status

```http
GET /fhir/$export-omop/job-uuid
Accept: application/fhir+json
```

---

## Core Domain Mappings

### Patient → PERSON

| FHIR Field | OMOP PERSON Column | Type | Notes |
|------------|-------------------|------|-------|
| `Patient.id` | `person_source_value` | VARCHAR(50) | Original FHIR ID |
| (generated) | `person_id` | INTEGER | Sequential OMOP person ID |
| `Patient.birthDate` (year) | `year_of_birth` | INTEGER | YYYY |
| `Patient.birthDate` (month) | `month_of_birth` | INTEGER | MM |
| `Patient.birthDate` (day) | `day_of_birth` | INTEGER | DD |
| `Patient.extension[birthSex]` | `gender_concept_id` | INTEGER | OMOP concept: 8507=Male, 8532=Female, 0=Unknown |
| `Patient.extension[race].ombCategory` | `race_concept_id` | INTEGER | OMOP race concept |
| `Patient.extension[ethnicity].ombCategory` | `ethnicity_concept_id` | INTEGER | 38003563=Hispanic, 38003564=Non-Hispanic |
| `Patient.address[0].state` (US) | `location_id` | INTEGER | FK to LOCATION table |
| `Patient.generalPractitioner[0]` | `provider_id` | INTEGER | FK to PROVIDER |
| `Patient.managingOrganization` | `care_site_id` | INTEGER | FK to CARE_SITE |
| `Patient.extension[birthSex].code` | `gender_source_value` | VARCHAR(50) | Original value |

### OBSERVATION_PERIOD (derived from encounters)

| OMOP Column | Derivation |
|-------------|-----------|
| `person_id` | From PERSON |
| `observation_period_start_date` | Earliest encounter start date for patient |
| `observation_period_end_date` | Latest encounter end date (or today if active) |
| `period_type_concept_id` | 44814724 = Period while enrolled |

### Encounter → VISIT_OCCURRENCE

| FHIR Field | OMOP Column | Notes |
|------------|------------|-------|
| `Encounter.id` | `visit_source_value` | |
| (generated) | `visit_occurrence_id` | Sequential |
| `Encounter.subject` → Patient | `person_id` | |
| `Encounter.class.code` | `visit_concept_id` | IMP→9201 (Inpatient), AMB→9202 (Outpatient), EMER→9203 (ER), HH→9201 |
| `Encounter.period.start` | `visit_start_date` | DATE |
| `Encounter.period.start` | `visit_start_datetime` | DATETIME |
| `Encounter.period.end` | `visit_end_date` | DATE |
| `Encounter.period.end` | `visit_end_datetime` | DATETIME |
| 44818518 | `visit_type_concept_id` | EHR encounter |
| `Encounter.participant[ATND].individual` | `provider_id` | Attending provider |
| `Encounter.serviceProvider` | `care_site_id` | |
| `Encounter.class.code` | `visit_source_value` | IMP/AMB/EMER/HH |

### VISIT_DETAIL (from sub-encounters and locations)

| FHIR Field | OMOP Column | Notes |
|------------|------------|-------|
| `Encounter.location[].location` | `visit_detail_concept_id` | Location-specific detail |
| `Encounter.location[].period.start` | `visit_detail_start_date` | |
| `Encounter.location[].period.end` | `visit_detail_end_date` | |
| `Encounter.partOf` | `visit_occurrence_id` | Parent encounter |

### Condition → CONDITION_OCCURRENCE

| FHIR Field | OMOP Column | Notes |
|------------|------------|-------|
| `Condition.id` | `condition_source_value` | |
| (generated) | `condition_occurrence_id` | |
| `Condition.subject` | `person_id` | |
| `Condition.code` (SNOMED→OMOP) | `condition_concept_id` | Mapped via concept |
| `Condition.onset[x]` | `condition_start_date` | |
| `Condition.abatement[x]` | `condition_end_date` | |
| `Condition.category.code` | `condition_type_concept_id` | 32020=EHR problem list, 32817=EHR encounter diagnosis |
| `Condition.verificationStatus.code` | `condition_status_concept_id` | 4230359=Confirmed, 4033240=Suspected |
| `Condition.encounter` | `visit_occurrence_id` | |
| `Condition.recorder` | `provider_id` | |
| `Condition.code.coding[].code` | `condition_source_value` | ICD-10-CM or SNOMED source |
| `Condition.code.coding[].system` | `condition_source_concept_id` | Source system concept |

### MedicationRequest → DRUG_EXPOSURE

| FHIR Field | OMOP Column | Notes |
|------------|------------|-------|
| `MedicationRequest.id` | `drug_source_value` | |
| (generated) | `drug_exposure_id` | |
| `MedicationRequest.subject` | `person_id` | |
| `MedicationRequest.medication[x]` (RxNorm→OMOP) | `drug_concept_id` | |
| `MedicationRequest.authoredOn` | `drug_exposure_start_date` | |
| (calculated from authoredOn + supply duration) | `drug_exposure_end_date` | |
| 38000177 | `drug_type_concept_id` | Prescription written |
| `MedicationRequest.dispenseRequest.numberOfRepeatsAllowed` | `refills` | |
| `MedicationRequest.dispenseRequest.quantity.value` | `quantity` | |
| `MedicationRequest.dispenseRequest.expectedSupplyDuration.value` | `days_supply` | |
| `MedicationRequest.dosageInstruction[0].doseQuantity.value` | `dose_value_as_number` | |
| `MedicationRequest.dosageInstruction[0].route.coding[0].code` | `route_source_value` | |
| `MedicationRequest.dosageInstruction[0].route` (SNOMED→OMOP) | `route_concept_id` | |
| `MedicationRequest.encounter` | `visit_occurrence_id` | |
| `MedicationRequest.requester` | `provider_id` | |

### Observation → MEASUREMENT + OBSERVATION

FHIR Observation maps to either OMOP MEASUREMENT or OMOP OBSERVATION based on the concept domain.

**Rule:** If the OMOP concept's domain_id is "Measurement" → MEASUREMENT table. Otherwise → OBSERVATION table.

#### FHIR Observation → OMOP MEASUREMENT

| FHIR Field | OMOP Column | Notes |
|------------|------------|-------|
| `Observation.id` | `measurement_source_value` | |
| (generated) | `measurement_id` | |
| `Observation.subject` | `person_id` | |
| `Observation.code` (LOINC→OMOP) | `measurement_concept_id` | |
| `Observation.effectiveDateTime` | `measurement_date` | |
| `Observation.valueQuantity.value` | `value_as_number` | |
| `Observation.valueQuantity` (unit→OMOP) | `unit_concept_id` | |
| `Observation.interpretation.coding[0].code` | `operator_concept_id` | H/L → 4172704/4171756 |
| `Observation.referenceRange[0].low.value` | `range_low` | |
| `Observation.referenceRange[0].high.value` | `range_high` | |
| 32817 | `measurement_type_concept_id` | EHR |
| `Observation.performer[0]` | `provider_id` | |
| `Observation.encounter` | `visit_occurrence_id` | |
| `Observation.valueCodeableConcept` (SNOMED→OMOP) | `value_as_concept_id` | For coded results |
| `Observation.code.coding[0].code` | `measurement_source_value` | LOINC code |

#### FHIR Observation → OMOP OBSERVATION

| FHIR Field | OMOP Column | Notes |
|------------|------------|-------|
| `Observation.code` (LOINC→OMOP) | `observation_concept_id` | |
| `Observation.valueQuantity.value` | `value_as_number` | |
| `Observation.valueString` | `value_as_string` | |
| `Observation.valueCodeableConcept` (→OMOP) | `value_as_concept_id` | |
| 32817 | `observation_type_concept_id` | EHR |

### Procedure → PROCEDURE_OCCURRENCE

| FHIR Field | OMOP Column | Notes |
|------------|------------|-------|
| `Procedure.id` | `procedure_source_value` | |
| (generated) | `procedure_occurrence_id` | |
| `Procedure.subject` | `person_id` | |
| `Procedure.code` (CPT/SNOMED→OMOP) | `procedure_concept_id` | |
| `Procedure.performed[x]` | `procedure_date` | |
| 32817 | `procedure_type_concept_id` | EHR |
| `Procedure.performer[0].actor` | `provider_id` | |
| `Procedure.encounter` | `visit_occurrence_id` | |
| `Procedure.code.coding[0].code` | `procedure_source_value` | CPT or SNOMED code |
| `Procedure.bodySite` (SNOMED→OMOP) | `modifier_concept_id` | Body site as modifier |

### Provider → PROVIDER

| FHIR Field | OMOP Column | Notes |
|------------|------------|-------|
| `Practitioner.id` | `provider_source_value` | |
| (generated) | `provider_id` | |
| `Practitioner.name[0].text` | `provider_name` | |
| `Practitioner.identifier[NPI]` | `npi` | |
| `Practitioner.identifier[DEA]` | `dea` | |
| `PractitionerRole.specialty[0]` (→OMOP) | `specialty_concept_id` | |
| `PractitionerRole.organization` | `care_site_id` | |
| `Practitioner.gender` | `gender_concept_id` | |
| `Practitioner.birthDate` | `year_of_birth` | |

### Organization → CARE_SITE

| FHIR Field | OMOP Column | Notes |
|------------|------------|-------|
| `Organization.id` | `care_site_source_value` | |
| (generated) | `care_site_id` | |
| `Organization.name` | `care_site_name` | |
| `Organization.type[0]` (→OMOP) | `place_of_service_concept_id` | |
| `Organization.address[0]` | `location_id` | FK to LOCATION |

### Specimen → SPECIMEN

| FHIR Field | OMOP Column | Notes |
|------------|------------|-------|
| `Specimen.id` | `specimen_source_value` | |
| (generated) | `specimen_id` | |
| `Specimen.subject` | `person_id` | |
| `Specimen.type` (SNOMED→OMOP) | `specimen_concept_id` | |
| `Specimen.collection.collectedDateTime` | `specimen_date` | |
| `Specimen.collection.quantity.value` | `quantity` | |
| `Specimen.collection.quantity` (UCUM→OMOP) | `unit_concept_id` | |
| `Specimen.collection.bodySite` (SNOMED→OMOP) | `anatomic_site_concept_id` | |
| 32833 | `specimen_type_concept_id` | EHR derived |

---

## Vocabulary Mappings

### SNOMED CT → OMOP Concept ID

OMOP uses SNOMED CT concepts directly but via the `concept` table. The `concept_id` is an OMOP-internal integer.

```sql
SELECT c.concept_id
FROM concept c
WHERE c.vocabulary_id = 'SNOMED'
  AND c.concept_code = '{snomed_code}'
  AND c.standard_concept = 'S'
  AND c.invalid_reason IS NULL;
```

### LOINC → OMOP Concept ID

```sql
SELECT c.concept_id
FROM concept c
WHERE c.vocabulary_id = 'LOINC'
  AND c.concept_code = '{loinc_code}'
  AND c.standard_concept = 'S'
  AND c.invalid_reason IS NULL;
```

### RxNorm → OMOP Concept ID

RxNorm maps to the RxNorm vocabulary in OMOP. Drug concepts may need hierarchical resolution:

```sql
-- First try exact RxNorm match
SELECT c.concept_id, c.concept_name
FROM concept c
WHERE c.vocabulary_id = 'RxNorm'
  AND c.concept_code = '{rxnorm_cui}'
  AND c.standard_concept = 'S';

-- If not standard, use concept_relationship to find standard mapping
SELECT cr.concept_id_2 AS standard_concept_id
FROM concept c
JOIN concept_relationship cr ON c.concept_id = cr.concept_id_1
WHERE c.vocabulary_id = 'RxNorm'
  AND c.concept_code = '{rxnorm_cui}'
  AND cr.relationship_id = 'Maps to'
  AND cr.invalid_reason IS NULL;
```

### ICD-10-CM → OMOP Concept ID

ICD-10-CM is a non-standard vocabulary in OMOP; it maps to SNOMED CT standard concepts:

```sql
-- Find OMOP concept via ICD-10-CM to standard mapping
SELECT cr.concept_id_2 AS standard_concept_id
FROM concept c
JOIN concept_relationship cr ON c.concept_id = cr.concept_id_1
WHERE c.vocabulary_id = 'ICD10CM'
  AND c.concept_code = '{icd10cm_code}'
  AND cr.relationship_id = 'Maps to'
  AND cr.invalid_reason IS NULL;
```

### Key Vocabulary IDs in OMOP

| Vocabulary ID | Source Vocabulary | Domain Examples |
|--------------|------------------|----------------|
| SNOMED | SNOMED CT | Condition, Observation, Procedure, Body site |
| LOINC | LOINC | Measurement, Observation |
| RxNorm | RxNorm | Drug |
| RxNorm Extension | RxNorm Extension | Drug (international) |
| ICD10CM | ICD-10-CM | Condition (non-standard) |
| ICD10PCS | ICD-10-PCS | Procedure (non-standard) |
| CPT4 | CPT-4 | Procedure (non-standard) |
| HCPCS | HCPCS | Procedure/Drug (non-standard) |
| CVX | CVX vaccines | Drug (vaccines) |
| NDC | National Drug Code | Drug (non-standard) |
| UCUM | UCUM units | Unit |
| Gender | OMOP gender | Person |
| Race | Race (US Census) | Person |
| Ethnicity | Ethnicity | Person |

---

## OMOP Table Reference

### Complete Domain-to-Table Mapping

| FHIR Resource | Primary OMOP Table | Secondary Tables | Domain |
|--------------|-------------------|-----------------|--------|
| Patient | PERSON | OBSERVATION_PERIOD, LOCATION | Person |
| Encounter | VISIT_OCCURRENCE | VISIT_DETAIL | Visit |
| Condition | CONDITION_OCCURRENCE | — | Condition |
| MedicationRequest | DRUG_EXPOSURE | — | Drug |
| MedicationAdministration | DRUG_EXPOSURE | — | Drug |
| MedicationDispense | DRUG_EXPOSURE | — | Drug |
| MedicationStatement | DRUG_EXPOSURE | — | Drug |
| Observation (vitals, labs) | MEASUREMENT | OBSERVATION | Measurement |
| Observation (social, survey) | OBSERVATION | — | Observation |
| Procedure | PROCEDURE_OCCURRENCE | — | Procedure |
| Practitioner | PROVIDER | — | Provider |
| Organization | CARE_SITE | — | Care site |
| Location | LOCATION | — | Location |
| Specimen | SPECIMEN | — | Specimen |
| Immunization | DRUG_EXPOSURE | OBSERVATION | Drug/Observation |
| AllergyIntolerance | OBSERVATION | — | Observation |
| DiagnosticReport | NOTE | MEASUREMENT | Note/Measurement |
| DocumentReference | NOTE | — | Note |
| Coverage | PAYER_PLAN_PERIOD | — | Payer |
| Claim | COST | — | Cost |

---

## ETL Considerations

### Pseudonymization

When exporting for research, patient identifiers are pseudonymized:

| FHIR Field | Pseudonymization Treatment |
|------------|--------------------------|
| `Patient.id` | Replaced with sequential OMOP `person_id` |
| `Patient.name` | Not exported to OMOP |
| `Patient.birthDate` | Year of birth only (month/day suppressed for age > 89) |
| `Patient.address` | State-level only; ZIP suppressed for population < 20,000 |
| `Patient.identifier[SSN]` | Not exported |
| `Practitioner.identifier[NPI]` | De-identified to `provider_id` (sequential) |

### Date Shifting (Optional)

For additional privacy, all dates can be shifted by a patient-specific random offset (preserving temporal relationships):

```
actual_date + patient_specific_offset_days → shifted_date
```

This is configurable via the export parameters: `dateShift=true`.

### Observation Period Generation

OMOP requires continuous observation periods. Our ETL derives observation periods from:
1. Enrollment dates (if available from Coverage resource)
2. Span of all encounter dates for the patient
3. Gaps > 183 days create separate observation periods

### Concept Mapping Failures

When a source code cannot be mapped to a standard OMOP concept:
- `concept_id` is set to `0` (unmapped)
- Source value retained in `*_source_value` column
- Source concept retained in `*_source_concept_id` column (if non-standard concept exists)
- Mapping failures logged to `ETL_LOG` table for review

### OMOP CDM Source Documentation

Required `CDM_SOURCE` table entry:

| Column | Value |
|--------|-------|
| `cdm_source_name` | Organization name |
| `cdm_source_abbreviation` | Org abbreviation |
| `cdm_holder` | Data holder organization |
| `source_description` | Dataset description |
| `source_documentation_reference` | This document URL |
| `cdm_etl_reference` | ETL code repository |
| `source_release_date` | Data cutoff date |
| `cdm_release_date` | Export date |
| `cdm_version` | 5.4 |
| `vocabulary_version` | Vocabulary release date |
