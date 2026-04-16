# Monobase Healthcare API Standards Foundation — Standards Crosswalk

**Version:** 1.0.0
**Status:** Ratified
**Last Revised:** 2026-04-14
**Owner:** API / Interop Lead

---

## Overview

This document maps every significant canonical entity in the Monobase Healthcare API Standards Foundation to its equivalents or analogues in four external standards:

- **FHIR R4** — HL7 FHIR Release 4 (the primary reference standard)
- **openEHR** — openEHR archetypes and templates (conceptual influence)
- **OMOP CDM** — Observational Medical Outcomes Partnership Common Data Model v5.4 (analytics target)
- **DICOM** — Digital Imaging and Communications in Medicine (imaging integration)

The purpose of this crosswalk is to guide interoperability implementation, support migration from external systems, and ensure our canonical model does not inadvertently diverge from established clinical information standards without documented justification.

---

## Section 1: FHIR R4 Crosswalk

### 1.1 Alignment Method

Our model is FHIR R4-informed, not FHIR R4-compliant. Where we use the same entity name and field names as FHIR, it is intentional. Where we diverge, it is documented. See the Standards Charter, Section 7 for the full alignment strategy.

### 1.2 Entity Mapping Table

| Monobase Entity | FHIR R4 Resource | Alignment Level | Divergences |
|---|---|---|---|
| Person | `Person` | Close | FHIR Person.link targets Patient/Practitioner/RelatedPerson; we model this explicitly as separate link arrays |
| Patient | `Patient` | Close | We omit FHIR's `contained` and `text` (narrative). `Patient.link` preserved for merge tracking. |
| Practitioner | `Practitioner` | Close | No contained resources; qualification model is simplified |
| PractitionerRole | `PractitionerRole` | Close | `notAvailable` / `availableTime` blocks not included; managed via Schedule instead |
| RelatedPerson | `RelatedPerson` | Close | No divergences of note |
| Organization | `Organization` | Close | Hierarchy via `partOf` preserved; `contact` simplified |
| Location | `Location` | Close | `physicalType` vocabulary is our own extended set |
| Department | `Organization` with `type` | Partial | FHIR does not have a distinct Department resource; we surface this as a first-class entity |
| Encounter | `Encounter` | Close | `hospitalization` sub-object is a top-level extension in our model for clarity |
| EpisodeOfCare | `EpisodeOfCare` | Close | No significant divergences |
| Condition | `Condition` | Close | Severity and stage modeled as top-level fields, not nested objects |
| AllergyIntolerance | `AllergyIntolerance` | Close | `reaction.substance` uses our extended coding model |
| Observation | `Observation` | Close | `component[]` preserved; `value[x]` polymorphism expressed as typed union in TypeSpec |
| Procedure | `Procedure` | Close | `focalDevice` not modeled; covered by `DeviceAssignment` |
| Immunization | `Immunization` | Close | `protocolApplied` simplified; series tracking via custom extension |
| ServiceRequest | `ServiceRequest` | Close | `orderDetail` simplified |
| MedicationRequest | `MedicationRequest` | Close | `dispenseRequest.performer` resolved to `Organization` reference |
| DocumentReference | `DocumentReference` | Close | `content.attachment` always required; URL-based content references only |
| FamilyMemberHistory | `FamilyMemberHistory` | Close | No significant divergences |
| Flag | `Flag` | Close | No significant divergences |
| Composition | `Composition` | Full alignment | `confidentiality` uses HL7 enum instead of FHIR code |
| Schedule | `Schedule` | Close | `actor` references restricted to `PractitionerRole` and `Location` |
| Slot | `Slot` | Close | No significant divergences |
| Appointment | `Appointment` | Close | `participant` array typed strictly; `requestedPeriod` removed |
| Bed | `Location` (type: bd) | Partial | FHIR uses Location for beds; we promote Bed to a first-class entity with bed-specific fields |
| Coverage | `Coverage` | Close | `class[]` structure simplified; co-pay details in extension |
| Claim | `Claim` | Close | `item[].detail` limited to one level of nesting |
| ClaimResponse | `ClaimResponse` | Close | `processNote` included |
| PriorAuthorization | `CoverageEligibilityRequest/Response` | Partial | We model as a single entity with direction implied by status, rather than two separate FHIR resources |
| Specimen | `Specimen` | Close | `container[]` simplified to single container |
| DiagnosticReport | `DiagnosticReport` | Close | `presentedForm` always a reference to `DocumentReference`; not inline base64 |
| Medication | `Medication` | Close | `ingredient[]` preserved |
| FormularyItem | `FormularyItem` (FHIR Da Vinci PDex) | Partial | Subset of Da Vinci PDex formulary; not full PDex conformance |
| MedicationDispense | `MedicationDispense` | Close | `substitution` included |
| MedicationAdministration | `MedicationAdministration` | Close | No significant divergences |
| MedicationReconciliation | `List` (medications) | Partial | FHIR uses List for reconciliation; we use a named entity for clarity |
| ImagingStudy | `ImagingStudy` | Close | UIDs (StudyInstanceUID, SeriesInstanceUID) preserved as strings |
| RadiologyReport | `DiagnosticReport` (radiology) | Partial | Radiology-specific fields (technique, indication, impression) surfaced at top level |
| Odontogram | `Observation` (dental) | Partial | No standard FHIR dental model; we define a structured representation |
| DentalTreatmentPlan | `CarePlan` (dental) | Partial | Dental-specific treatment plan fields added via extension |
| CarePlan | `CarePlan` | Close | `activity[].detail` simplified |
| CareTeam | `CareTeam` | Close | `telecom` on participants not included |
| Goal | `Goal` | Close | `target[]` preserved with measure/detail/due |
| Consent | `Consent` | Close | `provision` tree simplified to two levels maximum |
| ProvenanceRecord | `Provenance` | Close | Renamed to avoid collision with JS `Provenance` naming in TypeScript |
| ElectronicSignature | `Signature` type | Partial | Modeled as a first-class entity rather than an embedded type |
| Questionnaire | `Questionnaire` | Close | `item.enableWhen` logic preserved |
| QuestionnaireResponse | `QuestionnaireResponse` | Close | No significant divergences |
| Task | `Task` | Close | `input` and `output` parameter bags simplified to `payload` with typed sub-fields |
| SDOHScreening | `Observation` (SDOH) | Partial | Gravity Project SDOH concepts adopted; surfaced as first-class entity |
| SDOHReferral | `ServiceRequest` (SDOH) | Partial | Gravity Project referral pattern; surfaced as first-class entity |
| CDSHookRequest | CDS Hooks spec | Indirect | CDS Hooks is not a FHIR resource; mapped to canonical shape for storage and logging |
| CDSHookResponse | CDS Hooks spec | Indirect | As above |
| InventoryItem | `InventoryItem` (FHIR R5) | Partial | Backported from R5; simplified for R4 environment |
| Device | `Device` | Close | `udiCarrier` preserved; `property[]` simplified |
| DeviceAssignment | `DeviceUsage` | Close | Renamed for clarity |
| DeviceMetric | `DeviceMetric` | Close | No significant divergences |

### 1.3 Named Field-Level Divergences

The following field-level differences are documented because they affect interoperability translation.

| Entity.Field | FHIR R4 Behavior | Our Behavior |
|---|---|---|
| `*.reference` (all resource references) | String: `"Patient/123"` or absolute URL | Typed object: `{ resourceType: "Patient", id: "123" }` |
| `*.text` (narrative) | `Narrative` object with `status` + `div` HTML | Not present |
| `*.extension[]` | FHIR extension mechanism with URL key | Named TypeSpec extension namespaces |
| `*.contained[]` | Inline resource embedding | Not supported |
| `*.meta.profile[]` | StructureDefinition URLs | Not used |
| `Patient.birthDate` | Partial dates allowed (`YYYY`, `YYYY-MM`) | Full ISO 8601 date required (`YYYY-MM-DD`) |
| `Observation.value[x]` | FHIR polymorphic field naming (`valueQuantity`, `valueString`, etc.) | Typed union: `value: Quantity \| string \| CodeableConcept \| ...` |

---

## Section 2: openEHR Crosswalk

### 2.1 Our Relationship to openEHR

We do not implement openEHR. We do not use openEHR's Reference Model, Archetype Query Language (AQL), or Template infrastructure. However, openEHR's conceptual contributions inform our modeling discipline:

| openEHR Concept | How We Apply It |
|---|---|
| **Two-level modeling** | We separate canonical model (reference model) from local extensions (templates/profiles) — the same discipline openEHR uses to separate the RM from archetypes |
| **Archetype discipline** | Like archetypes, our canonical entities define the semantically valid range of a concept; local extensions cannot change the meaning of core fields |
| **Entry types** (OBSERVATION, EVALUATION, ACTION, INSTRUCTION) | We informally align: Observation maps to OBSERVATION; Condition/AllergyIntolerance to EVALUATION; Procedure to ACTION; ServiceRequest/MedicationRequest to INSTRUCTION |
| **Cluster/Element structure** | Our nested structured types (e.g., `Observation.component[]`) are analogous to openEHR CLUSTER composition |
| **Context** | openEHR's EVENT_CONTEXT concept aligns with our Encounter reference — the care context in which a clinical entry is recorded |

### 2.2 Archetype Analogues

| Monobase Entity | Closest openEHR Archetype | Notes |
|---|---|---|
| Observation (vital signs) | `openEHR-EHR-OBSERVATION.blood_pressure.v2`, `openEHR-EHR-OBSERVATION.pulse.v2` | LOINC codes used; not archetype IDs |
| Condition | `openEHR-EHR-EVALUATION.problem_diagnosis.v1` | Equivalent concept; SNOMED/ICD coding aligned |
| MedicationRequest | `openEHR-EHR-INSTRUCTION.medication_order.v3` | Dosage instruction structure informed by this archetype |
| Procedure | `openEHR-EHR-ACTION.procedure.v1` | ACTION entry type alignment |
| AllergyIntolerance | `openEHR-EHR-EVALUATION.adverse_reaction_risk.v2` | Substance, manifestation, criticality alignment |
| CarePlan | `openEHR-EHR-SECTION.care_plan.v1` | Structural analogy only |
| Questionnaire/Response | `openEHR-EHR-OBSERVATION.story.v1`, specific assessment archetypes | We use FHIR Questionnaire model, not openEHR PRO model |

---

## Section 3: OMOP CDM Crosswalk

### 3.1 Our Relationship to OMOP

OMOP CDM is the analytics target. When patient data is extracted for research, quality measurement, or population analytics, it is transformed into OMOP CDM v5.4 format. The extraction pipeline is responsible for this transformation using mappings defined in this section.

OMOP is a **destination format**, not a source. We do not model our canonical entities after OMOP tables.

### 3.2 Clinical Entity to OMOP Table Mapping

| Monobase Entity | OMOP Table | Mapping Notes |
|---|---|---|
| Patient | `PERSON` | `person_id` (integer) mapped from our UUID via a stable hash or lookup table; `gender_concept_id`, `race_concept_id`, `ethnicity_concept_id` mapped from our coded fields using OMOP vocabulary |
| Encounter | `VISIT_OCCURRENCE` | `visit_concept_id` from `Encounter.class` (inpatient, outpatient, emergency); `visit_type_concept_id` = EHR; start/end from `Encounter.period` |
| EpisodeOfCare | `EPISODE` | `episode_concept_id` from `EpisodeOfCare.type`; OMOP Episode introduced in v5.4 |
| Condition | `CONDITION_OCCURRENCE` | `condition_concept_id` from SNOMED CT → OMOP standard concept mapping; `condition_status_concept_id` from Condition.verificationStatus; `visit_occurrence_id` from Encounter reference |
| Observation (general) | `OBSERVATION` | Non-numeric, non-lab observations; `observation_concept_id` from LOINC → OMOP standard concept |
| Observation (vital signs, numeric) | `MEASUREMENT` | Numeric observations with LOINC code and unit; `measurement_concept_id`, `value_as_number`, `unit_concept_id` |
| Observation (lab result) | `MEASUREMENT` | Lab results via DiagnosticReport → Observation chain; `measurement_concept_id` from LOINC |
| Procedure | `PROCEDURE_OCCURRENCE` | `procedure_concept_id` from CPT/SNOMED → OMOP standard concept; `visit_occurrence_id` from Encounter |
| MedicationRequest | `DRUG_EXPOSURE` | `drug_concept_id` from RxNorm → OMOP; `drug_type_concept_id` = prescription written; `days_supply`, `quantity`, `sig` |
| MedicationDispense | `DRUG_EXPOSURE` | `drug_type_concept_id` = pharmacy dispensing; supplements MedicationRequest if both exist |
| MedicationAdministration | `DRUG_EXPOSURE` | `drug_type_concept_id` = inpatient administration |
| Immunization | `DRUG_EXPOSURE` | `drug_concept_id` from CVX → RxNorm → OMOP; `drug_type_concept_id` = vaccination |
| AllergyIntolerance | `OBSERVATION` | Allergy records map to OMOP OBSERVATION with `observation_concept_id` from allergy concepts |
| DiagnosticReport | `MEASUREMENT` (via Observations) | Report itself not directly mapped; member Observations each mapped individually |
| Specimen | `SPECIMEN` | OMOP v5.4 SPECIMEN table; `specimen_concept_id` from SNOMED |
| Coverage | `PAYER_PLAN_PERIOD` | Insurance coverage periods; `payer_concept_id` from payer lookup |
| Claim | `COST` | Claim amounts mapped to OMOP COST table; `cost_type_concept_id` = claim |
| Device | `DEVICE_EXPOSURE` | `device_concept_id` from SNOMED/GMDN → OMOP; `device_type_concept_id` |
| CarePlan | `EPISODE` | Care plan periods as OMOP Episodes where applicable |

### 3.3 OMOP Vocabulary Alignment

| Our Code System | OMOP Vocabulary | Mapping Method |
|---|---|---|
| SNOMED CT | SNOMED | Direct concept mapping via OMOP vocabulary tables |
| LOINC | LOINC | Direct concept mapping |
| RxNorm | RxNorm | Direct concept mapping |
| CPT-4 | CPT4 | Direct concept mapping |
| ICD-10-CM | ICD10CM | Direct concept mapping |
| CVX | CVX | Direct concept mapping; bridge to RxNorm for standard concept |
| NDC | NDC | Maps to RxNorm ingredient via drug_strength table |
| CDT (dental) | No OMOP standard | Local extension; mapped to SNOMED equivalents where available |

---

## Section 4: DICOM Crosswalk

### 4.1 Our Relationship to DICOM

We do not store or transmit DICOM objects. We store references to DICOM studies via the `ImagingStudy` entity, which captures the DICOM study hierarchy (Study / Series / Instance) as structured metadata. A DICOM-capable PACS system stores the actual objects; we reference them.

### 4.2 DICOM Study Hierarchy Mapping

| DICOM Level | DICOM Attribute | Monobase Field | Notes |
|---|---|---|---|
| Study | StudyInstanceUID (0020,000D) | `ImagingStudy.studyInstanceUid` | Globally unique; used to retrieve from PACS via WADO-RS |
| Study | AccessionNumber (0008,0050) | `ImagingStudy.accessionNumber` | Also stored as a business identifier |
| Study | StudyDate (0008,0020) | `ImagingStudy.started` | Combined with StudyTime; stored as ISO 8601 datetime |
| Study | ReferringPhysicianName (0008,0090) | `ImagingStudy.referrer` | Reference to Practitioner |
| Series | SeriesInstanceUID (0020,000E) | `ImagingStudy.series[].uid` | Per-series UID |
| Series | Modality (0008,0060) | `ImagingStudy.series[].modality` | CT, MR, CR, DX, US, etc.; DICOM CID 33 |
| Series | BodyPartExamined (0018,0015) | `ImagingStudy.series[].bodySite` | SNOMED CT coded in our model |
| Instance | SOPInstanceUID (0008,0018) | `ImagingStudy.series[].instances[].uid` | Individual image/object UID |
| Instance | SOPClassUID (0008,0016) | `ImagingStudy.series[].instances[].sopClass` | DICOM SOP class (CT Image Storage, etc.) |
| Instance | InstanceNumber (0020,0013) | `ImagingStudy.series[].instances[].number` | Ordering within series |

### 4.3 WADO-RS Integration Pattern

`ImagingStudy` records include a `retrieveUrl` field that provides the base WADO-RS URL for retrieving DICOM objects from the PACS. Consumers use this URL combined with Study/Series/Instance UIDs to retrieve images via:

```
GET {retrieveUrl}/studies/{studyInstanceUid}
GET {retrieveUrl}/studies/{studyInstanceUid}/series/{seriesUid}
GET {retrieveUrl}/studies/{studyInstanceUid}/series/{seriesUid}/instances/{instanceUid}
```

This pattern is defined by the DICOMweb standard (DICOM PS3.18).

### 4.4 Modality Code Mapping

| DICOM Modality Code | Clinical Meaning | Notes |
|---|---|---|
| CT | Computed Tomography | |
| MR | Magnetic Resonance | |
| US | Ultrasound | |
| DX | Digital Radiography | Includes plain X-ray |
| CR | Computed Radiography | Legacy plain film digitization |
| NM | Nuclear Medicine | PET/SPECT |
| PT | Positron Emission Tomography | |
| MG | Mammography | |
| XA | X-Ray Angiography | |
| RF | Radio Fluoroscopy | |
| OP | Ophthalmic Photography | |
| OT | Other | Catch-all |

---

## Appendix: Master Crosswalk Matrix

The following condensed matrix covers the most commonly referenced entities.

| Monobase Entity | FHIR R4 | openEHR Archetype | OMOP Table | DICOM |
|---|---|---|---|---|
| Patient | `Patient` | — | `PERSON` | PatientID (0010,0020) |
| Encounter | `Encounter` | — | `VISIT_OCCURRENCE` | StudyDate context |
| Condition | `Condition` | `EVALUATION.problem_diagnosis` | `CONDITION_OCCURRENCE` | — |
| Observation | `Observation` | `OBSERVATION.*` | `MEASUREMENT` or `OBSERVATION` | — |
| Procedure | `Procedure` | `ACTION.procedure` | `PROCEDURE_OCCURRENCE` | — |
| MedicationRequest | `MedicationRequest` | `INSTRUCTION.medication_order` | `DRUG_EXPOSURE` | — |
| MedicationDispense | `MedicationDispense` | — | `DRUG_EXPOSURE` | — |
| MedicationAdministration | `MedicationAdministration` | — | `DRUG_EXPOSURE` | — |
| Immunization | `Immunization` | — | `DRUG_EXPOSURE` | — |
| AllergyIntolerance | `AllergyIntolerance` | `EVALUATION.adverse_reaction_risk` | `OBSERVATION` | — |
| Claim | `Claim` | — | `COST` | — |
| Coverage | `Coverage` | — | `PAYER_PLAN_PERIOD` | — |
| Specimen | `Specimen` | — | `SPECIMEN` | — |
| DiagnosticReport | `DiagnosticReport` | — | via `MEASUREMENT` | — |
| ImagingStudy | `ImagingStudy` | — | — | Study / Series / Instance |
| Device | `Device` | — | `DEVICE_EXPOSURE` | — |
