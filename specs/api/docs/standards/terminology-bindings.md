# Monobase Healthcare API Standards Foundation — Terminology Bindings

**Version:** 1.0.0
**Status:** Ratified
**Last Revised:** 2026-04-14
**Owner:** Terminology Lead

---

## Overview

This document defines the terminology binding strategy for the Monobase Healthcare API Standards Foundation. It specifies which code systems bind to which entity fields, the binding strength for each, and the governance process for managing value sets and code system changes.

Terminology bindings are **first-class governance artifacts**. An API response that is structurally valid but uses the wrong code system for a bound field, or uses a local code when a standard code is required, is non-compliant.

---

## Section 1: Binding Strength Definitions

Binding strength defines how tightly a field is constrained to use codes from a specified code system or value set.

### 1.1 Required

**Definition:** The field MUST contain a code from the specified value set. No other codes are permitted. Implementations that cannot supply a valid code from the value set must either omit the field (if optional) or reject the record.

**When to use:** For fields where semantic precision is critical for patient safety, interoperability, or regulatory compliance; where deviation from the value set would render the data clinically meaningless to receiving systems; and where the value set is stable and complete enough to cover all real-world cases.

**Examples:** Immunization vaccine code (CVX is the US standard with no acceptable alternatives), Claim type (CMS-defined types), Appointment status.

**Compliance rule:** Receiving systems MAY reject records with out-of-value-set codes for Required bindings.

### 1.2 Extensible

**Definition:** The field SHOULD use a code from the specified value set. If no suitable code exists in the value set, a code from another code system MAY be used, provided it is coded (not free text). If a code from the value set adequately covers the concept, it MUST be used — extensible does not mean optional.

**When to use:** For fields where a standard code system covers the vast majority of real-world cases but where local practices, newer terminology, or specialty contexts legitimately produce concepts not yet in the standard value set. Clinical codes (diagnoses, observations, procedures) are almost always extensible because no code system is complete.

**Examples:** Condition code (SNOMED + ICD-10-CM cover most but not all conditions), Observation code (LOINC covers most lab and vital sign types), Procedure code (CPT + SNOMED cover most surgical and clinical procedures).

**Compliance rule:** If a code from the standard value set adequately covers the concept, using a local code instead is a compliance violation. Extensible does not give license to use local codes when standard codes exist.

### 1.3 Preferred

**Definition:** The field SHOULD preferably use a code from the specified value set, but is not required to. Alternative code systems are acceptable without specific justification. The value set is provided as a recommendation, not a constraint.

**When to use:** For fields where there is a clearly better choice of code system but where requiring it would create unreasonable implementation burden, or where multiple legitimate alternatives exist with no clear winner. Also used during transitional periods when a binding is being strengthened from Example to Extensible.

**Examples:** Language codes (BCP-47 is preferred; ISO 639 also acceptable), administrative gender (FHIR administrative gender preferred; local codes accepted).

**Compliance rule:** Receiving systems MUST accept codes from other systems. Preferred is a guidance, not a constraint.

### 1.4 Example

**Definition:** The field MAY use the codes in the provided value set as examples of the type of content expected, but is free to use any coding system or even free text. The value set illustrates the concept without constraining it.

**When to use:** For fields in early development where the right code system is not yet determined; for fields where no standard coding applies in most real-world uses; for extension fields where local value sets are expected to dominate.

**Examples:** Organization specialty type, custom questionnaire item codes, local workflow status extensions.

**Compliance rule:** No enforcement. Purely informative.

---

## Section 2: Reference Code Systems

The following code systems are recognized in this foundation. All value set URIs use these system identifiers.

| Code System | System URI | Coverage |
|---|---|---|
| SNOMED CT | `http://snomed.info/sct` | Clinical findings, procedures, body structures, substances, organisms |
| LOINC | `http://loinc.org` | Laboratory observations, clinical observations, surveys, vital signs |
| RxNorm | `http://www.nlm.nih.gov/research/umls/rxnorm` | Clinical drugs, ingredients, dose forms, drug interactions |
| NDC | `http://hl7.org/fhir/sid/ndc` | National Drug Code (US packaged drugs) |
| CPT-4 | `http://www.ama-assn.org/go/cpt` | Physician and outpatient procedures (US) |
| ICD-10-CM | `http://hl7.org/fhir/sid/icd-10-cm` | Diagnoses (US clinical modification) |
| ICD-10-PCS | `http://www.cms.gov/Medicare/Coding/ICD10` | Inpatient procedures (US) |
| CVX | `http://hl7.org/fhir/sid/cvx` | Vaccine administered codes (US CDC) |
| CDT | `http://www.ada.org/cdt` | Dental procedure terminology (ADA) |
| UCUM | `http://unitsofmeasure.org` | Unified Code for Units of Measure |
| HL7 v3 ActCode | `http://terminology.hl7.org/CodeSystem/v3-ActCode` | Act codes used in coverage, consent |
| HL7 v2 Table | `http://terminology.hl7.org/CodeSystem/v2-*` | Administrative code tables |
| NPI | `http://hl7.org/fhir/sid/us-npi` | National Provider Identifier system URI |
| BCP-47 | `urn:ietf:bcp:47` | Language codes |
| ISO 3166-1 | `urn:iso:std:iso:3166` | Country codes |
| Monobase Internal | `https://monobase.health/CodeSystem/*` | Foundation-defined local code systems |

---

## Section 3: Terminology Bindings by Domain

### 3.1 Foundation Domain

| Entity.Field | Code System | System URI | Binding Strength | Value Set / Notes |
|---|---|---|---|---|
| `Patient.gender` | HL7 AdministrativeGender | `http://hl7.org/fhir/administrative-gender` | Required | `male`, `female`, `other`, `unknown` |
| `Patient.maritalStatus` | HL7 v3 MaritalStatus | `http://terminology.hl7.org/CodeSystem/v3-MaritalStatus` | Extensible | |
| `Patient.communication.language` | BCP-47 | `urn:ietf:bcp:47` | Preferred | ISO 639-1 also accepted |
| `Patient.address.country` | ISO 3166-1 | `urn:iso:std:iso:3166` | Preferred | 2-character alpha codes |
| `Practitioner.qualification.code` | SNOMED CT | `http://snomed.info/sct` | Preferred | Specialty / qualification concepts |
| `Organization.type` | HL7 OrganizationType | `http://terminology.hl7.org/CodeSystem/organization-type` | Extensible | prov, dept, team, govt, ins, edu, cg, bus, other |
| `Location.physicalType` | HL7 LocationType | `http://terminology.hl7.org/CodeSystem/location-physical-type` | Extensible | si, bu, wi, wa, lvl, co, ro, bd, ve, ho, ca, rd, area, jdn |
| `Location.type` | HL7 v3 ServiceDeliveryLocationRoleType | `http://terminology.hl7.org/CodeSystem/v3-RoleCode` | Extensible | |
| `PractitionerRole.specialty` | SNOMED CT | `http://snomed.info/sct` | Preferred | Clinical specialty hierarchy |

### 3.2 Clinical Domain

| Entity.Field | Code System | System URI | Binding Strength | Value Set / Notes |
|---|---|---|---|---|
| `Encounter.class` | HL7 v3 ActCode | `http://terminology.hl7.org/CodeSystem/v3-ActCode` | Required | `AMB`, `IMP`, `EMER`, `SS`, `OBSENC` |
| `Encounter.type` | SNOMED CT | `http://snomed.info/sct` | Preferred | Encounter type hierarchy |
| `Encounter.serviceType` | SNOMED CT | `http://snomed.info/sct` | Preferred | |
| `Encounter.priority` | HL7 v3 ActPriority | `http://terminology.hl7.org/CodeSystem/v3-ActPriority` | Preferred | |
| `Encounter.reasonCode` | SNOMED CT | `http://snomed.info/sct` | Preferred | |
| `Encounter.hospitalization.dischargeDisposition` | HL7 DischargeDisposition | `http://terminology.hl7.org/CodeSystem/discharge-disposition` | Extensible | |
| `Condition.code` | SNOMED CT + ICD-10-CM | See both URIs | Extensible | SNOMED preferred for clinical use; ICD-10-CM for billing/reporting |
| `Condition.clinicalStatus` | HL7 ConditionClinicalStatus | `http://terminology.hl7.org/CodeSystem/condition-clinical` | Required | `active`, `recurrence`, `relapse`, `inactive`, `remission`, `resolved` |
| `Condition.verificationStatus` | HL7 ConditionVerificationStatus | `http://terminology.hl7.org/CodeSystem/condition-ver-status` | Required | `unconfirmed`, `provisional`, `differential`, `confirmed`, `refuted`, `entered-in-error` |
| `Condition.severity` | SNOMED CT | `http://snomed.info/sct` | Preferred | 24484000 (Severe), 6736007 (Moderate), 255604002 (Mild) |
| `Condition.category` | HL7 ConditionCategory | `http://terminology.hl7.org/CodeSystem/condition-category` | Extensible | `problem-list-item`, `encounter-diagnosis` |
| `Observation.code` | LOINC | `http://loinc.org` | Extensible | LOINC mandatory for lab and vital signs; SNOMED permitted for clinical observations without LOINC code |
| `Observation.interpretation` | HL7 ObservationInterpretation | `http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation` | Extensible | `H`, `L`, `A`, `N`, `AA`, `LL`, `HH` |
| `Observation.bodySite` | SNOMED CT | `http://snomed.info/sct` | Preferred | Body structure hierarchy |
| `Observation.method` | SNOMED CT | `http://snomed.info/sct` | Example | |
| `Observation.value[Quantity].unit` | UCUM | `http://unitsofmeasure.org` | Required | UCUM codes for all numeric Observation values |
| `Procedure.code` | CPT-4 + SNOMED CT | See both URIs | Extensible | CPT-4 for US billing; SNOMED CT for clinical coding and international use |
| `Procedure.category` | SNOMED CT | `http://snomed.info/sct` | Preferred | |
| `Procedure.bodySite` | SNOMED CT | `http://snomed.info/sct` | Preferred | |
| `AllergyIntolerance.code` | SNOMED CT + RxNorm | See both URIs | Extensible | SNOMED for substances/organisms; RxNorm for drug allergens |
| `AllergyIntolerance.reaction.substance` | SNOMED CT + RxNorm | See both URIs | Extensible | |
| `AllergyIntolerance.reaction.manifestation` | SNOMED CT | `http://snomed.info/sct` | Extensible | Clinical finding hierarchy |
| `AllergyIntolerance.category` | HL7 AllergyIntoleranceCategory | `http://hl7.org/fhir/allergy-intolerance-category` | Required | `food`, `medication`, `environment`, `biologic` |
| `AllergyIntolerance.criticality` | HL7 AllergyIntoleranceCriticality | `http://hl7.org/fhir/allergy-intolerance-criticality` | Required | `low`, `high`, `unable-to-assess` |
| `Immunization.vaccineCode` | CVX | `http://hl7.org/fhir/sid/cvx` | Required | CVX is the US standard; MVX for manufacturer; CPT for billing |
| `Immunization.route` | SNOMED CT | `http://snomed.info/sct` | Preferred | Route of administration hierarchy |
| `Immunization.site` | SNOMED CT | `http://snomed.info/sct` | Preferred | Body site hierarchy |
| `ServiceRequest.code` | LOINC + CPT-4 + SNOMED CT | See all URIs | Extensible | LOINC for lab orders; CPT for procedures; SNOMED for clinical concepts |
| `ServiceRequest.category` | SNOMED CT | `http://snomed.info/sct` | Preferred | |
| `ServiceRequest.priority` | HL7 RequestPriority | `http://hl7.org/fhir/request-priority` | Required | `routine`, `urgent`, `asap`, `stat` |
| `FamilyMemberHistory.relationship` | HL7 v3 FamilyMember | `http://terminology.hl7.org/CodeSystem/v3-RoleCode` | Required | FamilyMember roleCode hierarchy |
| `FamilyMemberHistory.condition.code` | SNOMED CT + ICD-10-CM | See both URIs | Extensible | Same as Condition.code |

### 3.3 Medications

| Entity.Field | Code System | System URI | Binding Strength | Value Set / Notes |
|---|---|---|---|---|
| `MedicationRequest.medicationCode` | RxNorm | `http://www.nlm.nih.gov/research/umls/rxnorm` | Extensible | RxNorm Clinical Drug concept preferred; NDC acceptable for dispensing context |
| `MedicationRequest.category` | HL7 MedicationRequestCategory | `http://terminology.hl7.org/CodeSystem/medicationrequest-category` | Extensible | `inpatient`, `outpatient`, `community`, `discharge` |
| `MedicationRequest.priority` | HL7 RequestPriority | `http://hl7.org/fhir/request-priority` | Required | `routine`, `urgent`, `asap`, `stat` |
| `MedicationRequest.dosageInstruction.route` | SNOMED CT | `http://snomed.info/sct` | Preferred | Route of administration hierarchy |
| `MedicationRequest.dosageInstruction.site` | SNOMED CT | `http://snomed.info/sct` | Preferred | |
| `MedicationRequest.dosageInstruction.method` | SNOMED CT | `http://snomed.info/sct` | Preferred | |
| `MedicationRequest.dosageInstruction.doseQuantity.unit` | UCUM | `http://unitsofmeasure.org` | Required | |
| `Medication.code` | RxNorm + NDC | See both URIs | Extensible | RxNorm for clinical identity; NDC for US packaged product identity |
| `Medication.form` | SNOMED CT | `http://snomed.info/sct` | Preferred | Dose form hierarchy |
| `Medication.ingredient.itemCode` | RxNorm + SNOMED CT | See both URIs | Extensible | |
| `MedicationDispense.medicationCode` | RxNorm + NDC | See both URIs | Extensible | NDC commonly used at dispensing time |
| `MedicationDispense.dosageInstruction.route` | SNOMED CT | `http://snomed.info/sct` | Preferred | |
| `MedicationAdministration.medicationCode` | RxNorm | `http://www.nlm.nih.gov/research/umls/rxnorm` | Extensible | |
| `MedicationAdministration.dosage.route` | SNOMED CT | `http://snomed.info/sct` | Preferred | |

### 3.4 Laboratory and Specimens

| Entity.Field | Code System | System URI | Binding Strength | Value Set / Notes |
|---|---|---|---|---|
| `Specimen.type` | SNOMED CT | `http://snomed.info/sct` | Extensible | Specimen type hierarchy (e.g., 119297000 Blood specimen) |
| `Specimen.collection.method` | SNOMED CT | `http://snomed.info/sct` | Extensible | Collection method hierarchy |
| `Specimen.collection.bodySite` | SNOMED CT | `http://snomed.info/sct` | Preferred | |
| `Specimen.container.type` | HL7 SpecimenContainer | `http://terminology.hl7.org/CodeSystem/v2-0487` | Extensible | Specimen container codes |
| `DiagnosticReport.code` | LOINC | `http://loinc.org` | Extensible | LOINC panel codes (e.g., 58410-2 for CBC) |
| `DiagnosticReport.category` | HL7 DiagnosticServiceSection | `http://terminology.hl7.org/CodeSystem/v2-0074` | Preferred | LAB, RAD, PAT, etc. |

### 3.5 Imaging and Radiology

| Entity.Field | Code System | System URI | Binding Strength | Value Set / Notes |
|---|---|---|---|---|
| `ImagingStudy.modality` | DICOM CID 33 (Modality) | `http://dicom.nema.org/resources/ontology/DCM` | Required | CT, MR, US, DX, CR, NM, PT, MG, XA, RF, OP |
| `ImagingStudy.reasonCode` | SNOMED CT | `http://snomed.info/sct` | Preferred | |
| `ImagingStudy.series.bodySite` | SNOMED CT | `http://snomed.info/sct` | Preferred | Body structure hierarchy |
| `RadiologyReport.code` | LOINC | `http://loinc.org` | Extensible | Radiology report LOINC codes (e.g., 18748-4 Diagnostic imaging study) |
| `RadiologyReport.category` | HL7 DiagnosticServiceSection | `http://terminology.hl7.org/CodeSystem/v2-0074` | Required | `RAD` |

### 3.6 Dental

| Entity.Field | Code System | System URI | Binding Strength | Value Set / Notes |
|---|---|---|---|---|
| `DentalTreatmentPlan.procedure[].code` | CDT | `http://www.ada.org/cdt` | Required | ADA Current Dental Terminology; all dental procedures must use CDT codes |
| `Odontogram.finding[].code` | SNOMED CT + CDT | See both URIs | Extensible | SNOMED for clinical findings; CDT for procedure-type findings |
| `Odontogram.tooth.system` | ADA Universal Numbering or FDI | `https://monobase.health/CodeSystem/tooth-numbering` | Required | `universal` (1-32 + A-T) or `fdi` (11-48); system declared per record |
| `Odontogram.surface.code` | ADA Surface Codes | `https://monobase.health/CodeSystem/tooth-surface` | Required | B/F (Buccal/Facial), L (Lingual), M (Mesial), D (Distal), O (Occlusal), I (Incisal) |

### 3.7 Administrative and Billing

| Entity.Field | Code System | System URI | Binding Strength | Value Set / Notes |
|---|---|---|---|---|
| `Claim.type` | HL7 ClaimType | `http://terminology.hl7.org/CodeSystem/claim-type` | Required | `institutional`, `oral`, `pharmacy`, `professional`, `vision` |
| `Claim.subType` | HL7 ClaimSubType | `http://terminology.hl7.org/CodeSystem/ex-claimsubtype` | Extensible | |
| `Claim.use` | HL7 Use | `http://hl7.org/fhir/claim-use` | Required | `claim`, `preauthorization`, `predetermination` |
| `Claim.priority` | HL7 ProcessPriority | `http://terminology.hl7.org/CodeSystem/processpriority` | Required | `stat`, `normal`, `deferred` |
| `Claim.item.revenue` | NUBC Revenue Codes | `http://terminology.hl7.org/CodeSystem/ex-revenue-center` | Extensible | UB-04 revenue center codes |
| `Claim.item.category` | HL7 BenefitCategory | `http://terminology.hl7.org/CodeSystem/ex-benefitcategory` | Extensible | |
| `Claim.item.productOrService` | CPT-4 + HCPCS + CDT + RxNorm | See URIs | Extensible | CPT/HCPCS for professional/outpatient; CDT for dental; RxNorm for pharmacy |
| `Coverage.type` | HL7 v3 ActCode (insurance types) | `http://terminology.hl7.org/CodeSystem/v3-ActCode` | Extensible | EHCPOL, PUBLICPOL, etc. |
| `Coverage.subscriberId` | Insurance member ID | Payer-specific URI | Extensible | |
| `Appointment.serviceType` | SNOMED CT | `http://snomed.info/sct` | Preferred | |
| `Appointment.specialty` | SNOMED CT | `http://snomed.info/sct` | Preferred | |
| `Appointment.appointmentType` | HL7 v2 Table 0276 | `http://terminology.hl7.org/CodeSystem/v2-0276` | Preferred | ROUTINE, WALKIN, CHECKUP, FOLLOWUP, EMERGENCY |

### 3.8 Social Determinants of Health

| Entity.Field | Code System | System URI | Binding Strength | Value Set / Notes |
|---|---|---|---|---|
| `SDOHScreening.code` | LOINC | `http://loinc.org` | Required | Gravity Project-aligned LOINC codes for SDOH screening instruments |
| `SDOHScreening.category` | Gravity Project | `http://hl7.org/fhir/us/sdoh-clinicalcare/CodeSystem/SDOHCC-CodeSystemTemporaryCodes` | Required | `food-insecurity`, `housing-instability`, `transportation-insecurity`, etc. |
| `SDOHReferral.code` | SNOMED CT | `http://snomed.info/sct` | Extensible | Gravity-aligned SNOMED concepts for SDOH interventions |
| `SDOHReferral.category` | Gravity Project | Same as SDOHScreening | Required | |

---

## Section 4: Fallback Rules

### 4.1 When No Standard Code Exists

Follow this decision tree when no standard code system covers a concept:

```
1. SEARCH FIRST
   Before concluding no standard code exists, search:
   - SNOMED CT browser (browser.ihtsdotools.org)
   - LOINC search (loinc.org/search)
   - RxNorm API (rxnav.nlm.nih.gov)
   Absence of a code requires documented search evidence.

2. USE TEXT (last resort for optional fields)
   If the field accepts a CodeableConcept and no code exists,
   populate the `text` field only. Do NOT populate `code` or `system`
   with invented values. A text-only CodeableConcept is valid.

3. USE A LOCAL CODE (for required fields)
   If the field is Required or Extensible and no standard code covers
   the concept, a local code MAY be used under these conditions:
   a. The `system` URI identifies the local code system uniquely
      (e.g., `https://monobase.health/CodeSystem/local-{orgId}`)
   b. The `display` field contains a human-readable description
   c. A mapping request is filed within 30 days (see Section 5)
   d. The record is flagged with a local code marker for audit

4. DO NOT INVENT STANDARD SYSTEM CODES
   It is never acceptable to use a standard system URI
   (e.g., http://snomed.info/sct) with a code that does not exist
   in that system. This is a data integrity violation.
```

### 4.2 Multi-System Coding

For fields with Extensible bindings that accept multiple code systems (e.g., Condition.code accepts SNOMED CT and ICD-10-CM), the following rules apply:

- Provide the most clinically precise code available; do not default to ICD-10-CM when SNOMED CT has an equivalent
- Multiple codings for the same concept are permitted — include both systems when both are known
- If systems diverge in meaning (SNOMED and ICD-10-CM express different levels of granularity), document the more specific code first in the `coding[]` array
- The `text` field should always be populated with the human-readable concept name regardless of how many codes are supplied

---

## Section 5: Value Set Governance

### 5.1 Value Set Types

| Type | Definition | Management |
|---|---|---|
| **External value set** | Published by an external authority (SNOMED, LOINC, HL7, ADA) | We reference, not maintain; updates tracked by Terminology Lead |
| **Foundation value set** | Defined and published by this foundation | Full governance process applies |
| **Extension value set** | Defined for a specific jurisdiction, specialty, or product | Local governance; must not conflict with Foundation value sets |

### 5.2 Proposing a New Value Set or Code System Binding

All new value set proposals require a Value Set Proposal (VSP) document submitted to the governance tracker. The VSP must include:

- **Clinical justification**: Why existing value sets are insufficient
- **Code system selection**: Which code system and why (with alternatives considered)
- **Proposed value set members**: List of codes, displays, and definitions
- **Affected entities and fields**: Which canonical fields will reference this value set
- **Binding strength recommendation**: Required, Extensible, Preferred, or Example
- **Maintenance plan**: How the value set will be kept current as the source code system updates

### 5.3 Approval and Publication

| Change Type | Reviewer | Timeline |
|---|---|---|
| New external binding (no value set change) | Terminology Lead | 5 business days |
| New Foundation value set | Terminology Lead + Domain Modeling Lead | 10 business days |
| Binding strength change (any direction) | Full committee | 15 business days |
| Removal of a code system binding | Full committee | 30 business days |

### 5.4 Value Set Versioning

- Foundation value sets are versioned using date-stamped URIs: `https://monobase.health/ValueSet/{name}|{YYYY-MM-DD}`
- When an external code system updates, the Terminology Lead reviews within 30 days to assess whether new codes affect bound value sets
- Deprecated codes in external systems must be flagged in our binding tables within 60 days of the deprecation notice
- Implementations consuming Required binding value sets should pin to a specific version URI, not the latest, to prevent unexpected breaking changes from code system updates

---

## Appendix A: Code System URIs Quick Reference

| Common Name | System URI |
|---|---|
| SNOMED CT | `http://snomed.info/sct` |
| LOINC | `http://loinc.org` |
| RxNorm | `http://www.nlm.nih.gov/research/umls/rxnorm` |
| NDC | `http://hl7.org/fhir/sid/ndc` |
| CPT-4 | `http://www.ama-assn.org/go/cpt` |
| ICD-10-CM | `http://hl7.org/fhir/sid/icd-10-cm` |
| CVX | `http://hl7.org/fhir/sid/cvx` |
| CDT | `http://www.ada.org/cdt` |
| UCUM | `http://unitsofmeasure.org` |
| DICOM | `http://dicom.nema.org/resources/ontology/DCM` |
| BCP-47 | `urn:ietf:bcp:47` |
| ISO 3166-1 | `urn:iso:std:iso:3166` |
