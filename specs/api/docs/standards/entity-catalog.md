# Monobase Healthcare API Standards Foundation — Master Entity Catalog

**Version:** 1.0.0
**Status:** Ratified
**Last Revised:** 2026-04-14
**Owner:** Domain Modeling Lead

---

## Overview

This catalog is the authoritative record of every canonical entity in the Monobase Healthcare API Standards Foundation. It is the source of truth for entity definitions, FHIR R4 alignments, lifecycle states, and inter-entity relationships.

### Scope Classifications

| Scope | Definition |
|---|---|
| **Core** | Required across all implementations; present in the base canonical model |
| **Specialty** | Required for specific clinical domains (e.g., dental, radiology); optional for others |
| **Local** | Available as a defined extension point; implementations decide whether to include |

### Lifecycle State Notation

States are recorded as `state1 -> state2 -> state3` representing valid forward transitions. Bidirectional transitions are noted with `<->`.

---

## Domain 1: Foundation

Entities that represent the fundamental participants, organizations, and places that all other entities reference.

| Entity | Domain | Definition | FHIR R4 Mapping | Scope | Lifecycle States | Key Relationships |
|---|---|---|---|---|---|---|
| **Person** | Foundation | A human individual independent of any health system role. The root identity record from which Patient and Practitioner roles are derived. | `Person` | Core | `active`, `inactive`, `merged` | Has zero or more `Patient` links; has zero or more `Practitioner` links |
| **Patient** | Foundation | A Person in the role of a recipient of healthcare services within a specific organizational context. A Person may have Patient records across multiple organizations. | `Patient` | Core | `active`, `inactive`, `deceased`, `merged` | Belongs to one or more `Organization`; has `Coverage`; has `Encounter`; linked to `Person` |
| **Practitioner** | Foundation | A Person who is licensed or credentialed to provide healthcare services. Identity is system-wide; roles and contexts are expressed via `PractitionerRole`. | `Practitioner` | Core | `active`, `inactive`, `suspended` | Has one or more `PractitionerRole`; belongs to `Organization`; performs `Procedure`, `ServiceRequest` |
| **PractitionerRole** | Foundation | A specific role, specialty, and organizational context in which a Practitioner operates. A single Practitioner may hold multiple active roles (e.g., attending physician at Hospital A and consultant at Clinic B). | `PractitionerRole` | Core | `active`, `inactive`, `on-leave` | References `Practitioner`; references `Organization`; references `Location`; linked to `Schedule` |
| **RelatedPerson** | Foundation | A non-practitioner person who has a defined relationship to a Patient and may be involved in their care (e.g., guardian, emergency contact, caregiver). | `RelatedPerson` | Core | `active`, `inactive` | References `Patient`; may have `Consent` delegated from Patient |
| **Organization** | Foundation | A formally or informally recognized grouping of people or organizations for the purposes of achieving some form of collective action in healthcare. Covers health systems, hospitals, clinics, payers, pharmacies, laboratories. | `Organization` | Core | `active`, `inactive`, `merged` | Has `Location`; has `Department`; employs `Practitioner` via `PractitionerRole`; has child `Organization` (hierarchy) |
| **Location** | Foundation | A physical place where healthcare services are provided, staff are housed, or resources and participants may be stored, found, contained, or accommodated. Distinct from `Organization` (legal entity) and `Department` (organizational unit). | `Location` | Core | `active`, `suspended`, `inactive` | Belongs to `Organization`; contains `Department`; has `Bed` records; referenced by `Encounter`, `Schedule` |
| **Department** | Foundation | An organizational subdivision of a health system or hospital — a named unit responsible for a category of services (e.g., Emergency Department, Pharmacy, Radiology). | Extension of `Organization` with `type` | Core | `active`, `inactive` | Belongs to `Organization`; located at `Location`; has `PractitionerRole` assignments |

---

## Domain 2: Clinical

Entities that represent the direct clinical activity delivered to patients.

| Entity | Domain | Definition | FHIR R4 Mapping | Scope | Lifecycle States | Key Relationships |
|---|---|---|---|---|---|---|
| **Encounter** | Clinical | A single interaction between a patient and a healthcare provider for the purpose of providing healthcare service or assessing the health status of a patient. The foundational clinical event that most clinical entities reference. | `Encounter` | Core | `planned`, `arrived`, `triaged`, `in-progress`, `on-leave`, `finished`, `cancelled`, `entered-in-error` | References `Patient`, `Practitioner`, `Location`; groups under `EpisodeOfCare`; generates `Condition`, `Observation`, `Procedure` |
| **EpisodeOfCare** | Clinical | A grouping of related `Encounter` records representing an association between a patient and a healthcare provider(s) for a period of time for the purposes of management of a condition or concern. | `EpisodeOfCare` | Core | `planned`, `waitlist`, `active`, `on-hold`, `finished`, `cancelled`, `entered-in-error` | References `Patient`; contains `Encounter`; associated with `Condition`; managed by `CareTeam` |
| **Condition** | Clinical | A clinical condition, problem, diagnosis, or other event, situation, issue, or clinical concept that has risen to a level of concern. Covers both confirmed diagnoses and problems on problem lists. | `Condition` | Core | `active`, `recurrence`, `relapse`, `inactive`, `remission`, `resolved` | References `Patient`, `Encounter`; supports `CarePlan`; triggers `ServiceRequest`; informs `Flag` |
| **AllergyIntolerance** | Clinical | A record of a clinical assessment of an allergy or intolerance — a propensity or a potential risk to the patient for an adverse reaction upon future exposure to the specified substance. | `AllergyIntolerance` | Core | `active`, `inactive`, `resolved` | References `Patient`, `Practitioner`; may trigger `Flag`; informs `MedicationRequest` safety checks |
| **Observation** | Clinical | Measurements or assertions made about a patient, device, or other subject. Covers vital signs, laboratory results, imaging results, clinical findings, device readings, and assessment tool scores. | `Observation` | Core | `registered`, `preliminary`, `final`, `amended`, `corrected`, `cancelled`, `entered-in-error` | References `Patient`, `Encounter`; part of `DiagnosticReport`; sourced from `Device`; may inform `Condition` |
| **Procedure** | Clinical | An action that is or was performed on or for a patient, family member, or group. Includes surgical procedures, diagnostic procedures, endoscopic procedures, biopsies, and therapeutic interventions. | `Procedure` | Core | `preparation`, `in-progress`, `not-done`, `on-hold`, `stopped`, `completed`, `entered-in-error` | References `Patient`, `Practitioner`, `Encounter`; fulfills `ServiceRequest`; generates `Specimen` |
| **Immunization** | Clinical | The event of vaccine administration or a record of past administration. | `Immunization` | Core | `completed`, `entered-in-error`, `not-done` | References `Patient`, `Practitioner`, `Location`; uses `vaccineCode` (CVX binding) |
| **ServiceRequest** | Clinical | A record of a request for a procedure, diagnostic investigation, referral, or other service to be planned, proposed, drafted, requested, performed, or denied. | `ServiceRequest` | Core | `draft`, `active`, `on-hold`, `revoked`, `completed`, `entered-in-error` | References `Patient`, `Practitioner`, `Encounter`; fulfilled by `Procedure`, `DiagnosticReport`; may require `PriorAuthorization` |
| **MedicationRequest** | Clinical | An order or request for the supply of a medication and the instructions for administration to a patient. | `MedicationRequest` | Core | `active`, `on-hold`, `cancelled`, `completed`, `entered-in-error`, `stopped`, `draft`, `unknown` | References `Patient`, `Practitioner`, `Encounter`, `Medication`; fulfilled by `MedicationDispense`; may require `PriorAuthorization` |
| **DocumentReference** | Clinical | A reference to a document — clinical notes, discharge summaries, pathology reports, scanned documents — stored in a content system. The entity is the reference and metadata; the document itself lives in a content store. | `DocumentReference` | Core | `current`, `superseded`, `entered-in-error` | References `Patient`, `Encounter`, `Practitioner`; may reference `DiagnosticReport` or `ImagingStudy` |
| **FamilyMemberHistory** | Clinical | Significant health conditions of a patient's family members. | `FamilyMemberHistory` | Core | `partial`, `completed`, `entered-in-error`, `health-unknown` | References `Patient`; informs `Condition`, `RiskAssessment` |
| **Flag** | Clinical | A prospective warning of potential issues when providing care to a patient. Flags are active alerts attached to patient records that warrant attention before proceeding. | `Flag` | Core | `active`, `inactive`, `entered-in-error` | References `Patient`; may reference `Condition`, `AllergyIntolerance`; raised by `Practitioner` |
| **Composition** | Clinical | Structured clinical document that composes other resources into cohesive documents such as discharge summaries, progress notes, and clinical abstracts. Contains typed sections referencing clinical resources. | FHIR R4 Composition | Core | preliminary, final, amended, enteredInError | subject→Patient, encounter→Encounter, author→Practitioner, section.entry→[any resource] |

---

## Domain 3: Administrative

Entities that support scheduling, bed management, billing, and coverage.

| Entity | Domain | Definition | FHIR R4 Mapping | Scope | Lifecycle States | Key Relationships |
|---|---|---|---|---|---|---|
| **Schedule** | Administrative | A container for time slots defining when a practitioner, location, or resource is available for appointments. | `Schedule` | Core | `active`, `inactive` | References `PractitionerRole`, `Location`; contains `Slot` |
| **Slot** | Administrative | A single period of time within a `Schedule` during which one appointment may be booked. | `Slot` | Core | `busy`, `free`, `busy-unavailable`, `busy-tentative`, `entered-in-error` | Belongs to `Schedule`; filled by `Appointment` |
| **Appointment** | Administrative | A booking of a healthcare event between patient(s) and practitioner(s) in a specific time slot at a specific location. | `Appointment` | Core | `proposed`, `pending`, `booked`, `arrived`, `fulfilled`, `cancelled`, `noshow`, `entered-in-error`, `checked-in`, `waitlist` | References `Patient`, `PractitionerRole`, `Slot`, `Location`; fulfilled by `Encounter` |
| **Bed** | Administrative | A physical or logical bed unit within a hospital or facility — an assignable occupancy resource for inpatient care. | Extension of `Location` with `type: bed` | Core | `available`, `occupied`, `housekeeping`, `contaminated`, `closed`, `other` | Belongs to `Location`; assigned to `Patient` during inpatient `Encounter` |
| **Coverage** | Administrative | Insurance coverage or benefit plan — describes the insurance under which healthcare services are covered. | `Coverage` | Core | `active`, `cancelled`, `draft`, `entered-in-error` | References `Patient`, `Organization` (payer); used in `Claim`; may require `PriorAuthorization` |
| **Claim** | Administrative | A request to a payer for adjudication of services rendered — the billing record submitted to an insurance organization or government payer. | `Claim` | Core | `active`, `cancelled`, `draft`, `entered-in-error` | References `Patient`, `Organization`, `Coverage`, `Encounter`; produces `ClaimResponse` |
| **ClaimResponse** | Administrative | The adjudication response from a payer to a `Claim` submission. Contains adjudication decisions, payment amounts, and denial reasons. | `ClaimResponse` | Core | `active`, `cancelled`, `draft`, `entered-in-error` | References `Claim`; informs `Coverage` utilization |
| **PriorAuthorization** | Administrative | A request to a payer for advance approval of a proposed service, medication, or device before the service is rendered. | `CoverageEligibilityRequest` / `CoverageEligibilityResponse` | Core | `draft`, `active`, `on-hold`, `revoked`, `completed`, `entered-in-error` | References `Patient`, `Coverage`, `ServiceRequest` or `MedicationRequest`; required before certain `Procedure` |

---

## Domain 4: Ancillary

Entities for laboratory, pharmacy, imaging, and dental services.

| Entity | Domain | Definition | FHIR R4 Mapping | Scope | Lifecycle States | Key Relationships |
|---|---|---|---|---|---|---|
| **Specimen** | Ancillary | A physical sample of biological material collected from a patient for diagnostic purposes. | `Specimen` | Core | `available`, `unavailable`, `unsatisfactory`, `entered-in-error` | References `Patient`, `ServiceRequest`; consumed by `DiagnosticReport` |
| **DiagnosticReport** | Ancillary | The findings and interpretation of diagnostic tests performed on patients, including laboratory tests, imaging, and pathology. | `DiagnosticReport` | Core | `registered`, `partial`, `preliminary`, `final`, `amended`, `corrected`, `appended`, `cancelled`, `entered-in-error` | References `Patient`, `Specimen`, `Observation`; fulfills `ServiceRequest`; attached to `DocumentReference` |
| **Medication** | Ancillary | A definition of a medication — its identity, composition, and properties. Distinct from a request or dispensing event. | `Medication` | Core | `active`, `inactive`, `entered-in-error` | Referenced by `MedicationRequest`, `MedicationDispense`, `MedicationAdministration`; included in `FormularyItem` |
| **FormularyItem** | Ancillary | A record of a `Medication` being included in a payer's or health system's formulary, including coverage tier, restrictions, and prior authorization requirements. | `FormularyItem` (FHIR Da Vinci PDex) | Core | `active`, `inactive` | References `Medication`; associated with `Coverage` |
| **MedicationDispense** | Ancillary | The supply of a medication to a patient, or the dispensing of a medication by a pharmacist in response to a prescription. | `MedicationDispense` | Core | `preparation`, `in-progress`, `cancelled`, `on-hold`, `completed`, `entered-in-error`, `stopped`, `declined`, `unknown` | References `Patient`, `MedicationRequest`, `Medication`; precedes `MedicationAdministration` |
| **MedicationAdministration** | Ancillary | The provision of a dose of medication to a patient during an encounter or inpatient stay — the act of giving the medication, not just dispensing it. | `MedicationAdministration` | Core | `in-progress`, `not-done`, `on-hold`, `completed`, `entered-in-error`, `stopped` | References `Patient`, `Encounter`, `MedicationDispense`, `Practitioner` |
| **MedicationReconciliation** | Ancillary | The formal process of comparing a patient's medication orders with all of the medications the patient has been taking — typically performed at care transitions. | Extension of `List` with clinical context | Core | `draft`, `active`, `retired`, `entered-in-error` | References `Patient`, `Encounter`, `Practitioner`; reviews `MedicationRequest` history |
| **ImagingStudy** | Ancillary | A set of images and associated metadata produced by a diagnostic imaging session. References DICOM study/series/instance hierarchy without embedding DICOM data. | `ImagingStudy` | Specialty | `registered`, `available`, `cancelled`, `entered-in-error` | References `Patient`, `ServiceRequest`, `Practitioner`; contained in `DiagnosticReport`; maps to DICOM Study UID |
| **RadiologyReport** | Ancillary | A structured report of the findings and impressions from a radiologist's interpretation of an imaging study. A specialized form of `DiagnosticReport` with radiology-specific fields. | `DiagnosticReport` (radiology) | Specialty | `preliminary`, `final`, `amended`, `corrected`, `cancelled` | References `ImagingStudy`, `Patient`, `Practitioner`; may reference `DocumentReference` for PDF |
| **Odontogram** | Ancillary | A graphical and structured representation of a patient's dental status — tooth-level clinical findings, restorations, and missing teeth recorded per tooth using Universal Numbering System or FDI notation. | No direct FHIR R4 mapping; modeled as structured `Observation` | Specialty | `draft`, `active`, `archived` | References `Patient`, `Encounter`; informs `DentalTreatmentPlan` |
| **DentalTreatmentPlan** | Ancillary | A formal plan of dental procedures proposed for a patient, typically presented for patient consent and insurance pre-authorization. | Extension of `CarePlan` | Specialty | `draft`, `active`, `completed`, `revoked`, `entered-in-error` | References `Patient`, `Practitioner`, `Odontogram`; generates `ServiceRequest`; submitted for `PriorAuthorization` |

---

## Domain 5: Support

Entities for care coordination, consent management, SDOH, and decision support.

| Entity | Domain | Definition | FHIR R4 Mapping | Scope | Lifecycle States | Key Relationships |
|---|---|---|---|---|---|---|
| **CarePlan** | Support | A healthcare plan for a patient — describes the intention of how one or more practitioners intend to deliver care for a particular condition, along with goals and activities. | `CarePlan` | Core | `draft`, `active`, `on-hold`, `revoked`, `completed`, `entered-in-error` | References `Patient`, `CareTeam`, `Condition`; contains `Goal`; authorizes `ServiceRequest` |
| **CareTeam** | Support | The group of practitioners, organizations, and related persons involved in the delivery of care for a patient under a `CarePlan`. | `CareTeam` | Core | `proposed`, `active`, `suspended`, `inactive`, `entered-in-error` | References `Patient`, `Practitioner`, `RelatedPerson`; manages `CarePlan` |
| **Goal** | Support | A desired state or outcome for a patient — a target that the patient and care team are working toward, measurable where possible. | `Goal` | Core | `proposed`, `planned`, `accepted`, `active`, `on-hold`, `completed`, `cancelled`, `entered-in-error`, `rejected` | References `Patient`, `CarePlan`; measured by `Observation`; supported by `ServiceRequest` |
| **Consent** | Support | A patient's expression of agreement or disagreement with a proposed course of action, or authorization for data use, research participation, or treatment. | `Consent` | Core | `draft`, `proposed`, `active`, `rejected`, `inactive`, `entered-in-error` | References `Patient`, `Practitioner`, `Organization`; governs data sharing for `DocumentReference`, `DiagnosticReport` |
| **ProvenanceRecord** | Support | A record of the origin, custody, and transformation history of a resource — who created it, when, from what source, and what transforms were applied. | `Provenance` | Core | Immutable once created | References any canonical entity; created by `Practitioner` or system actor |
| **ElectronicSignature** | Support | A cryptographic or legal attestation that a practitioner has reviewed, approved, or signed a clinical document or order. | Extension of `Signature` type | Core | `pending`, `signed`, `revoked` | References `Practitioner`, `DocumentReference` or any signable entity |
| **Questionnaire** | Support | A structured set of questions used for data collection — patient intake, clinical assessments, SDOH screening tools, patient-reported outcomes. | `Questionnaire` | Core | `draft`, `active`, `retired`, `unknown` | Published by `Organization`; completed as `QuestionnaireResponse` |
| **QuestionnaireResponse** | Support | A patient's or clinician's completed answers to a `Questionnaire`. | `QuestionnaireResponse` | Core | `in-progress`, `completed`, `amended`, `entered-in-error`, `stopped` | References `Patient`, `Questionnaire`, `Encounter`; may generate `Observation` |
| **Task** | Support | A description of an activity to be performed, typically as part of a clinical workflow — reminders, follow-up actions, care coordination tasks. | `Task` | Core | `draft`, `requested`, `received`, `accepted`, `rejected`, `ready`, `cancelled`, `in-progress`, `on-hold`, `failed`, `completed`, `entered-in-error` | References `Patient`; assigned to `Practitioner`; may fulfill `ServiceRequest` or `CarePlan` activity |
| **SDOHScreening** | Support | The result of a structured social determinants of health assessment — screening for food insecurity, housing instability, transportation barriers, etc. | `Observation` (SDOH profile) | Core | `preliminary`, `final`, `amended` | References `Patient`, `Encounter`, `QuestionnaireResponse`; may trigger `SDOHReferral` |
| **SDOHReferral** | Support | A referral to a community-based organization or social service to address an identified SDOH need. | `ServiceRequest` (SDOH profile) | Core | `draft`, `active`, `on-hold`, `revoked`, `completed`, `entered-in-error` | References `Patient`, `SDOHScreening`, `Organization` (community-based org) |
| **CDSHookRequest** | Support | A request payload sent to a clinical decision support service at a defined workflow hook point (e.g., patient-view, order-sign). | CDS Hooks specification | Core | Stateless (no lifecycle) | References `Patient`, `Encounter`; includes prefetch resources from other canonical entities |
| **CDSHookResponse** | Support | The response from a clinical decision support service — cards with suggestions, warnings, and app links for the clinician to act on. | CDS Hooks specification | Core | Stateless (no lifecycle) | References `CDSHookRequest`; may suggest `ServiceRequest`, `MedicationRequest` |

---

## Domain 6: Operational

Entities for supply chain, devices, and facility management.

| Entity | Domain | Definition | FHIR R4 Mapping | Scope | Lifecycle States | Key Relationships |
|---|---|---|---|---|---|---|
| **InventoryItem** | Operational | A product or material managed within a health system's supply chain — medications, consumables, medical supplies, and implantables tracked by catalog. | `InventoryItem` (R5 backport) | Core | `active`, `inactive`, `entered-in-error` | Has `InventoryBatch`; stored at `StorageLocation`; consumed as `SupplyConsumption` |
| **InventoryBatch** | Operational | A specific lot or batch of an `InventoryItem` with a defined lot number, expiry date, and quantity tracking. | Extension of `InventoryItem` | Core | `active`, `recalled`, `expired`, `depleted` | References `InventoryItem`, `StorageLocation` |
| **StorageLocation** | Operational | A specific physical storage area — a room, cabinet, refrigerator, crash cart, or automated dispensing unit — where inventory is held. Distinct from clinical `Location`. | Extension of `Location` with `type: storage` | Core | `active`, `inactive`, `maintenance` | References `Location`; contains `InventoryBatch` |
| **SupplyConsumption** | Operational | A record of inventory being consumed during patient care — a supply used during a procedure, dispensed from a Pyxis, or administered to a patient. | `SupplyDelivery` | Core | `completed`, `abandoned`, `entered-in-error` | References `InventoryItem`, `Patient`, `Encounter`, `Practitioner` |
| **Device** | Operational | A medical device — implanted, attached, or used in patient care — including infusion pumps, ventilators, implantable devices, wearables, and diagnostic equipment. | `Device` | Core | `active`, `inactive`, `entered-in-error` | References `Organization`, `Location`; assigned to `Patient` via `DeviceAssignment`; produces `DeviceMetric` |
| **DeviceAssignment** | Operational | A record of a `Device` being assigned to or used with a specific patient or location during a care event. | `DeviceUsage` | Core | `active`, `completed`, `not-done`, `entered-in-error` | References `Device`, `Patient`, `Encounter` |
| **DeviceMetric** | Operational | A measurement or setting reported by a medical device — real-time or point-in-time readings from monitoring equipment. | `DeviceMetric` | Core | `on`, `off`, `standby`, `entered-in-error` | References `Device`; generates `Observation` |

---

## Domain 7: Analytics

Entities for research, de-identification, and AI governance.

| Entity | Domain | Definition | FHIR R4 Mapping | Scope | Lifecycle States | Key Relationships |
|---|---|---|---|---|---|---|
| **DeIdentificationProfile** | Analytics | A named configuration that defines the de-identification rules applied to a data extract — which fields are suppressed, generalized, pseudonymized, or shifted. | No direct FHIR mapping | Core | `draft`, `active`, `retired` | Referenced by `ResearchExtract`; governs `DataLineageRecord` |
| **CohortDefinition** | Analytics | A formal specification of inclusion and exclusion criteria defining a population of patients for research, quality measurement, or operational analytics. | `Group` (research) | Core | `draft`, `active`, `retired` | References canonical clinical entities as criteria; used by `ResearchExtract` |
| **ResearchExtract** | Analytics | A point-in-time snapshot of data for a defined `CohortDefinition`, produced using a specific `DeIdentificationProfile`. Includes metadata about the extract. | No direct FHIR mapping | Core | `requested`, `in-progress`, `completed`, `failed` | References `CohortDefinition`, `DeIdentificationProfile`; produces `DataLineageRecord` |
| **DataLineageRecord** | Analytics | An immutable record of data transformation and movement — what data was extracted from where, when, by whom, what transforms were applied, and where it was sent. | Extension of `Provenance` | Core | Immutable once created | References `ResearchExtract`; records provenance for auditing and GDPR compliance |
| **AIOutputMetadata** | Analytics | Metadata describing the output of an AI or ML model applied to patient data — the model identity, version, input data, output type, confidence score, and review status. | No direct FHIR mapping | Core | `pending-review`, `reviewed`, `accepted`, `rejected`, `archived` | References `Patient` (or de-identified cohort); references source clinical entities; reviewed by `Practitioner` |

---

## Appendix A: Relationship Summary

The following table summarizes the most critical inter-domain relationships.

| Entity A | Relationship | Entity B |
|---|---|---|
| Patient | is-a-role-of | Person |
| Practitioner | is-a-role-of | Person |
| PractitionerRole | contextualizes | Practitioner in Organization |
| Encounter | is-part-of | EpisodeOfCare |
| Condition | documented-in | Encounter |
| Observation | documented-in | Encounter |
| Procedure | performed-in | Encounter |
| DiagnosticReport | groups | Observation (lab/imaging) |
| ImagingStudy | interpreted-by | RadiologyReport |
| MedicationRequest | fulfilled-by | MedicationDispense |
| MedicationDispense | administered-as | MedicationAdministration |
| ServiceRequest | fulfilled-by | Procedure or DiagnosticReport |
| CarePlan | coordinated-by | CareTeam |
| Goal | measured-by | Observation |
| Claim | adjudicated-as | ClaimResponse |
| Coverage | required-for | Claim |
| Appointment | becomes | Encounter |
| SDOHScreening | triggers | SDOHReferral |

---

## Appendix B: Entity Count by Domain

| Domain | Entity Count | Core | Specialty | Local |
|---|---|---|---|---|
| Foundation | 8 | 8 | 0 | 0 |
| Clinical | 12 | 12 | 0 | 0 |
| Administrative | 8 | 8 | 0 | 0 |
| Ancillary | 11 | 8 | 3 | 0 |
| Support | 13 | 13 | 0 | 0 |
| Operational | 7 | 7 | 0 | 0 |
| Analytics | 5 | 5 | 0 | 0 |
| **Total** | **64** | **61** | **3** | **0** |
