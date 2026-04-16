# Healthcare Domain Glossary

Machine-readable reference for Monobase Healthcare API domain terminology. Each entry follows a consistent structure for AI and developer consumption.

---

## Encounter and Visit Concepts

### Encounter
**Definition:** A clinical interaction between a patient and one or more healthcare providers. Represents the basic unit of healthcare delivery — any time a patient receives care.
**FHIR R4 Resource:** `Encounter`
**Also known as:** Visit, Clinical encounter, Care event, Episode (informal)
**Not to be confused with:** Episode of Care (which groups multiple encounters), Appointment (which is the scheduled intent, not the actual interaction)

### Visit
**Definition:** Informal synonym for Encounter in many healthcare systems. Often used in EHR systems to mean the same thing as an Encounter.
**FHIR R4 Resource:** `Encounter` (Visit maps to Encounter in FHIR)
**Also known as:** Encounter, Care visit, Patient visit
**Not to be confused with:** Episode of Care, Appointment

### Episode of Care
**Definition:** A set of clinically related Encounters grouped together under one condition or care program over a period of time. Represents ongoing management of a problem or condition.
**FHIR R4 Resource:** `EpisodeOfCare`
**Also known as:** Episode, Care episode, Care program episode
**Not to be confused with:** Encounter (a single interaction), CarePlan (a forward-looking plan)

### Admission
**Definition:** The formal process of accepting a patient into an inpatient setting (hospital). In FHIR, represented by an Encounter with class=inpatient and a hospitalization component.
**FHIR R4 Resource:** `Encounter` (with `hospitalization` component and `class=IMP`)
**Also known as:** Hospital admission, Inpatient admission, Inpatient registration
**Not to be confused with:** Encounter (broader concept), ED visit (which may or may not lead to admission)

### Discharge
**Definition:** The formal release of a patient from an inpatient or observation care setting. Recorded in Encounter.hospitalization.dischargeDisposition.
**FHIR R4 Resource:** `Encounter` (discharge details in `hospitalization.dischargeDisposition`)
**Also known as:** Patient discharge, Hospital discharge
**Not to be confused with:** Transfer (patient moves to another facility/unit rather than being released)

### Transfer
**Definition:** Movement of a patient from one care location, unit, or facility to another without discharge. In FHIR, represented by a location history entry or a new Encounter with a partOf reference.
**FHIR R4 Resource:** `Encounter` (location history or new Encounter with `partOf`)
**Also known as:** Patient transfer, Inter-facility transfer, Unit transfer
**Not to be confused with:** Discharge (patient leaves care entirely), Referral (which is a request, not actual movement)

---

## Participant Concepts

### Patient
**Definition:** An individual receiving or registered to receive healthcare services. The primary subject of most clinical resources.
**FHIR R4 Resource:** `Patient`
**Also known as:** Beneficiary (insurance context), Member (health plan context), Subject (research context), Resident (long-term care)
**Not to be confused with:** Person (demographic record without care context), RelatedPerson (someone related to the patient)

### Person
**Definition:** A generic demographic record representing a human being, independent of any healthcare role. Can be linked to Patient, Practitioner, or RelatedPerson records.
**FHIR R4 Resource:** `Person`
**Also known as:** Individual, Human demographic record
**Not to be confused with:** Patient (a Person in the context of receiving care), Practitioner (a Person in the context of providing care)

### RelatedPerson
**Definition:** A person with a relationship to the patient who may be involved in their care — such as a parent, spouse, or emergency contact — but is not themselves a patient in this context.
**FHIR R4 Resource:** `RelatedPerson`
**Also known as:** Next of kin, Guarantor, Emergency contact, Guardian, Caregiver
**Not to be confused with:** Patient (the care recipient), Practitioner (a professional providing care)

### Practitioner
**Definition:** A healthcare professional who provides services — physicians, nurses, pharmacists, therapists, etc. Holds credentials and may have multiple roles.
**FHIR R4 Resource:** `Practitioner`
**Also known as:** Provider, Clinician, Healthcare professional, HCP
**Not to be confused with:** PractitionerRole (the specific role a practitioner holds at a given organization/location)

### PractitionerRole
**Definition:** A specific role or position that a Practitioner holds within an organization, including their specialty, location, and availability. One Practitioner can have many PractitionerRoles.
**FHIR R4 Resource:** `PractitionerRole`
**Also known as:** Provider role, Clinical role, Staff role
**Not to be confused with:** Practitioner (the person), Organization (the institution)

### CareTeam
**Definition:** A group of practitioners and other participants involved in coordinating and delivering care to a patient, often for a specific condition or care plan.
**FHIR R4 Resource:** `CareTeam`
**Also known as:** Multidisciplinary team, MDT, Care coordination team
**Not to be confused with:** Practitioner (individual), Organization (institution-level entity)

---

## Clinical Problem Concepts

### Condition
**Definition:** A clinical state, problem, diagnosis, or health concern about a patient. Covers both active problems and historical diagnoses.
**FHIR R4 Resource:** `Condition`
**Also known as:** Problem, Health issue, Clinical finding
**Not to be confused with:** Observation (a measurement or finding, not a lasting problem), Diagnosis (a specific use of Condition in an encounter context)

### Diagnosis
**Definition:** A Condition as it is recorded in the context of an Encounter — the clinical determination of a disease or problem driving a specific visit.
**FHIR R4 Resource:** `Condition` (referenced from `Encounter.diagnosis`)
**Also known as:** Encounter diagnosis, Working diagnosis, Final diagnosis
**Not to be confused with:** Problem (longer-term, problem-list focused), Condition (the broader FHIR resource)

### Problem
**Definition:** A Condition that is maintained on a patient's ongoing problem list, representing a persistent health issue being actively managed over time.
**FHIR R4 Resource:** `Condition` (with `category=problem-list-item`)
**Also known as:** Active problem, Problem list item, Chronic condition
**Not to be confused with:** Diagnosis (encounter-specific), Observation (a measured finding)

### Comorbidity
**Definition:** A condition that co-exists with a primary condition and may affect its management or outcomes. Recorded as additional Conditions associated with an Encounter.
**FHIR R4 Resource:** `Condition` (referenced from `Encounter.diagnosis` with role=comorbidity)
**Also known as:** Secondary diagnosis, Coexisting condition, Associated condition
**Not to be confused with:** Primary diagnosis, Complication (which arises as a result of care)

---

## Observation Concepts

### Observation
**Definition:** A measurement, finding, or assertion about a patient. The broadest clinical data concept in FHIR — covers vitals, labs, assessments, and more.
**FHIR R4 Resource:** `Observation`
**Also known as:** Clinical finding, Measurement, Test result
**Not to be confused with:** Condition (a lasting problem), DiagnosticReport (a collection of observations)

### Vital Sign
**Definition:** A core physiological measurement — heart rate, blood pressure, temperature, respiratory rate, oxygen saturation, height, weight, BMI. A specialized Observation with category=vital-signs.
**FHIR R4 Resource:** `Observation` (with `category=vital-signs`)
**Also known as:** Vitals, Physiological measurements, Hemodynamics (partial)
**Not to be confused with:** Lab result (measured from a specimen), Assessment (a scored evaluation tool)

### Lab Result
**Definition:** A measurement obtained from analysis of a patient specimen (blood, urine, tissue). Typically reported as an Observation within a DiagnosticReport.
**FHIR R4 Resource:** `Observation` (with `category=laboratory`), `DiagnosticReport`
**Also known as:** Laboratory result, Test result, Pathology result
**Not to be confused with:** Vital sign (measured directly from patient, no specimen)

### Assessment
**Definition:** A scored or structured clinical evaluation — such as a pain scale, mental health questionnaire, or fall risk tool. Recorded as Observations using standardized tools.
**FHIR R4 Resource:** `Observation` (with `category=survey`) or `QuestionnaireResponse`
**Also known as:** Clinical assessment, Screening tool, Evaluation score
**Not to be confused with:** Vital sign (physiological measurement), Screening (population-level tool for early detection)

### Screening
**Definition:** A structured evaluation to detect a condition or risk in a patient who may not yet show symptoms. Often population-based.
**FHIR R4 Resource:** `Observation` (with category=survey) or `Procedure`
**Also known as:** Preventive screening, Health screening
**Not to be confused with:** Assessment (clinical evaluation of a known concern), Diagnostic test (ordered because disease is suspected)

---

## Procedure Concepts

### Procedure
**Definition:** An action performed on or for a patient — surgical, diagnostic, therapeutic, or administrative. Represents both completed and intended procedures.
**FHIR R4 Resource:** `Procedure`
**Also known as:** Clinical procedure, Medical procedure, Intervention
**Not to be confused with:** ServiceRequest (the order requesting a procedure), Observation (a measurement, not an action)

### Intervention
**Definition:** A deliberate clinical action taken to prevent, treat, or manage a health condition. Broadly synonymous with Procedure in most contexts.
**FHIR R4 Resource:** `Procedure`
**Also known as:** Procedure, Treatment action, Therapeutic action
**Not to be confused with:** Observation, Medication administration

### Surgery
**Definition:** An invasive procedure involving incision, manipulation, or repair of body structures. A subtype of Procedure.
**FHIR R4 Resource:** `Procedure` (with surgery-related SNOMED code)
**Also known as:** Surgical procedure, Operation, OR procedure
**Not to be confused with:** Minor procedure (no anesthesia or incision), Intervention (broader)

---

## Medication Concepts

### MedicationRequest
**Definition:** An order or request for a medication to be dispensed and/or administered. Covers prescriptions, inpatient orders, and OTC recommendations.
**FHIR R4 Resource:** `MedicationRequest`
**Also known as:** Prescription, Medication order, Drug order
**Not to be confused with:** MedicationDispense (the physical dispensing event), MedicationAdministration (the actual giving of the medication)

### Prescription
**Definition:** A MedicationRequest intended for dispensing by a pharmacy, typically for outpatient use. A subset of MedicationRequest.
**FHIR R4 Resource:** `MedicationRequest` (with `intent=order` and pharmacy routing)
**Also known as:** Rx, Script, Drug prescription
**Not to be confused with:** Medication order (inpatient), MedicationDispense (pharmacy fulfillment)

### Order
**Definition:** A broad term for any clinical instruction to perform an action — may refer to MedicationRequest, ServiceRequest, or other request resources depending on context.
**FHIR R4 Resource:** `MedicationRequest`, `ServiceRequest`, or `Task`
**Also known as:** Clinical order, Standing order, Physician order
**Not to be confused with:** Result (the outcome of an order), Plan (a broader set of intended actions)

### Dispense
**Definition:** The physical preparation and provision of a medication to a patient or their agent by a pharmacist.
**FHIR R4 Resource:** `MedicationDispense`
**Also known as:** Medication dispensing, Pharmacy fill, Medication supply
**Not to be confused with:** MedicationRequest (the order), MedicationAdministration (giving it to the patient)

### Administration
**Definition:** The actual act of giving a medication dose to a patient — whether orally, by injection, IV, etc.
**FHIR R4 Resource:** `MedicationAdministration`
**Also known as:** Medication administration, Dose given, MAR entry
**Not to be confused with:** MedicationDispense (pharmacy preparation), MedicationRequest (the order)

### Reconciliation
**Definition:** The process of comparing a patient's current medications with those ordered during a care transition (admission, discharge, transfer) to prevent errors.
**FHIR R4 Resource:** `MedicationStatement` (for reported medications), `List` (for reconciled list)
**Also known as:** Medication reconciliation, Med rec, BPMH (Best Possible Medication History)
**Not to be confused with:** MedicationAdministration (individual dose event)

---

## Allergy and Adverse Reaction Concepts

### Allergy
**Definition:** An immunologically mediated adverse reaction to a substance. Recorded in AllergyIntolerance with type=allergy.
**FHIR R4 Resource:** `AllergyIntolerance` (with `type=allergy`)
**Also known as:** Drug allergy, Food allergy, Environmental allergy
**Not to be confused with:** Intolerance (non-immunological adverse reaction), Adverse reaction (broader term including both)

### Intolerance
**Definition:** An adverse reaction to a substance that is not immunologically mediated — such as lactose intolerance or GI sensitivity to a drug.
**FHIR R4 Resource:** `AllergyIntolerance` (with `type=intolerance`)
**Also known as:** Drug intolerance, Food intolerance, Sensitivity
**Not to be confused with:** Allergy (immune-mediated), Side effect (expected pharmacological effect)

### Adverse Reaction
**Definition:** Any harmful or undesired response to a substance, including both allergies and intolerances. The parent concept.
**FHIR R4 Resource:** `AllergyIntolerance`
**Also known as:** ADR (Adverse Drug Reaction), Adverse event (in pharmacovigilance context)
**Not to be confused with:** Side effect (expected but unwanted effect), Contraindication (a reason not to use a substance)

---

## Immunization Concepts

### Immunization
**Definition:** The administration of a vaccine to produce immunity to a specific disease. Records both administered vaccines and patient-reported immunization history.
**FHIR R4 Resource:** `Immunization`
**Also known as:** Vaccination, Inoculation, Shot, Jab
**Not to be confused with:** MedicationAdministration (for non-vaccine drugs), Procedure (broader)

### Vaccination
**Definition:** Synonym for Immunization — the act of administering a vaccine.
**FHIR R4 Resource:** `Immunization`
**Also known as:** Immunization, Vaccine administration
**Not to be confused with:** Immunity (the biological state), Antibody titer (a lab result measuring immunity)

---

## Request and Order Concepts

### ServiceRequest
**Definition:** An order or proposal to perform a clinical service — lab tests, imaging, procedures, or referrals — on a patient.
**FHIR R4 Resource:** `ServiceRequest`
**Also known as:** Clinical order, Lab order, Imaging order, Procedure order, Referral (when intent=referral)
**Not to be confused with:** Task (an administrative work item), MedicationRequest (specifically for medications)

### Referral
**Definition:** A ServiceRequest with intent=referral — a request to transfer a patient's care to another practitioner or specialty for consultation or ongoing management.
**FHIR R4 Resource:** `ServiceRequest` (with `intent=referral`)
**Also known as:** Specialist referral, Consultation request, Outpatient referral
**Not to be confused with:** Transfer (physical patient movement), Order (broader clinical action request)

---

## Financial Concepts

### Claim
**Definition:** A request for reimbursement from a payer (insurer) for healthcare services rendered to a covered patient.
**FHIR R4 Resource:** `Claim`
**Also known as:** Insurance claim, Billing claim, Healthcare claim
**Not to be confused with:** Invoice (billed to the patient, not the insurer), Charge (an individual billable item before claim creation)

### Invoice
**Definition:** A financial document sent to a patient or other non-payer requesting payment for services. Distinct from a Claim sent to an insurer.
**FHIR R4 Resource:** `Invoice`
**Also known as:** Patient bill, Statement, Bill
**Not to be confused with:** Claim (sent to insurer), Charge (a pre-invoice line item)

### Charge
**Definition:** An individual billable item or service charge recorded before being assembled into a Claim or Invoice.
**FHIR R4 Resource:** `ChargeItem`
**Also known as:** Charge item, Billing line, Service charge
**Not to be confused with:** Claim (the assembled insurance request), Invoice (the patient-facing bill)

### Payment
**Definition:** A record of money received from a payer or patient in response to a Claim or Invoice.
**FHIR R4 Resource:** `PaymentReconciliation`, `PaymentNotice`
**Also known as:** Remittance, Payment reconciliation, ERA (Electronic Remittance Advice)
**Not to be confused with:** Adjudication (the payer's determination), Claim (the request for payment)

### Adjudication
**Definition:** The payer's process of reviewing a Claim and determining what will be paid, denied, or adjusted. Results in a ClaimResponse.
**FHIR R4 Resource:** `ClaimResponse`
**Also known as:** Claim adjudication, Payer determination, Claim processing
**Not to be confused with:** Payment (the actual transfer of money), Prior authorization (pre-service approval)

### EOB (Explanation of Benefits)
**Definition:** A document sent by the insurer to the patient explaining what was billed, what was covered, and what the patient owes. Represented as ExplanationOfBenefit in FHIR.
**FHIR R4 Resource:** `ExplanationOfBenefit`
**Also known as:** Explanation of Benefits, EOB, Remittance advice (from payer perspective)
**Not to be confused with:** Invoice (patient bill), Claim (what was submitted to the insurer)

---

## Coverage and Insurance Concepts

### Coverage
**Definition:** A patient's health insurance or benefit plan information — the policy that covers their healthcare costs.
**FHIR R4 Resource:** `Coverage`
**Also known as:** Insurance, Health plan, Benefit plan, Policy, Payer
**Not to be confused with:** Eligibility (verification that coverage is active), Prior authorization (approval for a specific service)

### Insurance
**Definition:** Informal term for Coverage in healthcare billing contexts.
**FHIR R4 Resource:** `Coverage`
**Also known as:** Health insurance, Coverage, Plan
**Not to be confused with:** Coverage (FHIR resource), Eligibility

### Benefit Plan
**Definition:** The specific set of benefits, limits, cost-shares, and network rules defined by an insurer's policy.
**FHIR R4 Resource:** `InsurancePlan`
**Also known as:** Health benefit plan, Insurance plan, Plan details
**Not to be confused with:** Coverage (an individual's enrollment in a plan), CarePlan (a clinical care plan)

### Eligibility
**Definition:** The verification that a patient has active insurance coverage for a service at a specific date.
**FHIR R4 Resource:** `CoverageEligibilityRequest`, `CoverageEligibilityResponse`
**Also known as:** Insurance eligibility, Benefits verification, Eligibility check
**Not to be confused with:** Prior authorization (approval for a specific service), Coverage (the insurance record itself)

### Prior Authorization
**Definition:** Pre-approval from an insurer required before certain services can be performed, ensuring coverage will be provided.
**FHIR R4 Resource:** `Claim` (with use=preauthorization), `ClaimResponse`
**Also known as:** Pre-auth, Pre-authorization, PA, Prior approval
**Not to be confused with:** Eligibility (coverage verification, not service approval), Referral (clinical request, not payer approval)

---

## Lab and Specimen Concepts

### Specimen
**Definition:** A biological sample collected from a patient for laboratory analysis — blood, urine, tissue, swab, etc.
**FHIR R4 Resource:** `Specimen`
**Also known as:** Sample, Biological specimen, Lab sample
**Not to be confused with:** Observation (the result from analyzing the specimen), ServiceRequest (the order to collect the specimen)

### Accession
**Definition:** A unique identifier assigned to a specimen or order by the laboratory when received, used for tracking through analysis.
**FHIR R4 Resource:** `Specimen.accessionIdentifier`, `DiagnosticReport.identifier`
**Also known as:** Accession number, Lab accession, Order accession
**Not to be confused with:** Specimen (the sample itself), MRN (patient identifier)

### Panel
**Definition:** A predefined group of lab tests ordered together as a unit — such as a Complete Blood Count (CBC) or Basic Metabolic Panel (BMP).
**FHIR R4 Resource:** `ServiceRequest` (ordered panel) + multiple `Observation` resources in a `DiagnosticReport`
**Also known as:** Lab panel, Test panel, Profile, Battery
**Not to be confused with:** Individual test (single Observation), DiagnosticReport (the result document)

---

## Imaging Concepts

### ImagingStudy
**Definition:** A collection of images and associated data produced by an imaging modality (X-ray, CT, MRI, etc.) from one or more series.
**FHIR R4 Resource:** `ImagingStudy`
**Also known as:** Radiology study, Imaging exam, Scan
**Not to be confused with:** DiagnosticReport (the radiology report interpreting the study), ServiceRequest (the imaging order)

### DICOM
**Definition:** Digital Imaging and Communications in Medicine — the international standard for medical image storage, transmission, and display.
**FHIR R4 Resource:** Referenced in `ImagingStudy` (UIDs)
**Also known as:** DICOM standard, Medical imaging format
**Not to be confused with:** PACS (the system storing DICOM), HL7 (a different healthcare interoperability standard)

### PACS
**Definition:** Picture Archiving and Communication System — the system used to store, retrieve, and display medical imaging studies.
**FHIR R4 Resource:** External system; referenced via endpoint in `ImagingStudy`
**Also known as:** Radiology PACS, Image archive, VNA (Vendor Neutral Archive)
**Not to be confused with:** DICOM (the image format standard), RIS (Radiology Information System, handles orders and scheduling)

### Modality
**Definition:** The type of imaging technology used to produce a study — such as CT, MRI, X-ray (DX), ultrasound (US), or PET.
**FHIR R4 Resource:** `ImagingStudy.series.modality` (coded with DICOM modality codes)
**Also known as:** Imaging modality, Equipment type, Scanner type
**Not to be confused with:** ImagingStudy (the resulting dataset), Procedure (the clinical act of performing the imaging)

---

## Document Concepts

### DocumentReference
**Definition:** A pointer to a clinical document stored externally or inline — used to reference any type of clinical note, report, or document without embedding the full content in a structured way.
**FHIR R4 Resource:** `DocumentReference`
**Also known as:** Document pointer, Clinical document reference, Note reference
**Not to be confused with:** Composition (a structured, authored FHIR document), DiagnosticReport (a specific structured result document)

### Composition
**Definition:** A structured FHIR document with sections, authors, and attestation — used for clinical notes, discharge summaries, and care documents. Forms the basis of a FHIR Document Bundle.
**FHIR R4 Resource:** `Composition`
**Also known as:** Clinical document, Structured note, FHIR document
**Not to be confused with:** DocumentReference (a pointer to any document), ClinicalImpression (a practitioner's assessment)

### Clinical Note
**Definition:** A practitioner-authored narrative about a patient encounter, assessment, or plan. In FHIR, stored as Composition or DocumentReference depending on structure.
**FHIR R4 Resource:** `Composition` or `DocumentReference`
**Also known as:** Progress note, SOAP note, Clinical documentation
**Not to be confused with:** Observation (a structured measurement, not narrative)

### Discharge Summary
**Definition:** A clinical document created at the end of an inpatient stay summarizing the admission, treatments, diagnoses, and discharge instructions.
**FHIR R4 Resource:** `Composition` (with type=discharge-summary) wrapped in a `Bundle`
**Also known as:** Discharge note, Discharge document, Hospital summary
**Not to be confused with:** Encounter (the administrative record), Discharge (the event itself)

---

## Consent and Provenance Concepts

### Consent
**Definition:** A patient's agreement (or refusal) for specific uses or disclosures of their health information, or for specific treatments.
**FHIR R4 Resource:** `Consent`
**Also known as:** Patient consent, Authorization, HIPAA authorization
**Not to be confused with:** Coverage (insurance), Provenance (audit trail of data origin)

### Provenance
**Definition:** A record of the origin, custody, and transformations of a FHIR resource — who created it, when, and on whose behalf.
**FHIR R4 Resource:** `Provenance`
**Also known as:** Audit trail, Data lineage, Provenance record
**Not to be confused with:** AuditEvent (records user actions on resources), Consent (patient agreement)

### Signature
**Definition:** A digital or wet signature attesting to the authenticity of a document or record. In FHIR, embedded in Provenance or Composition.
**FHIR R4 Resource:** `Signature` (datatype used in `Provenance`, `Bundle`, `Composition`)
**Also known as:** Digital signature, Electronic signature, e-signature
**Not to be confused with:** Attestation (the act of affirming, broader than signing)

### Attestation
**Definition:** The act of a practitioner confirming the accuracy and completeness of a clinical document. Recorded in Composition.attester.
**FHIR R4 Resource:** `Composition.attester`
**Also known as:** Document attestation, Clinical attestation, Co-signature
**Not to be confused with:** Signature (the mechanism), Provenance (data lineage)

---

## Care Planning Concepts

### CarePlan
**Definition:** A forward-looking plan for a patient's care — goals, activities, interventions, and the team involved. Covers a period of care for one or more conditions.
**FHIR R4 Resource:** `CarePlan`
**Also known as:** Treatment plan, Care plan, Management plan
**Not to be confused with:** EpisodeOfCare (a grouping of past encounters), Composition (a past-facing document)

### Goal
**Definition:** A desired health outcome for a patient — what the care team and patient are working toward achieving.
**FHIR R4 Resource:** `Goal`
**Also known as:** Health goal, Clinical goal, Treatment goal, Outcome target
**Not to be confused with:** Condition (the problem), CarePlan (the broader plan containing goals)

### Activity
**Definition:** A specific planned action within a CarePlan — a scheduled appointment, medication to take, exercise to perform, etc.
**FHIR R4 Resource:** `CarePlan.activity` (references ServiceRequest, MedicationRequest, Task, etc.)
**Also known as:** Care activity, Planned activity, CarePlan action
**Not to be confused with:** Procedure (a completed action), Task (an assigned work item)

---

## Alert and Risk Concepts

### Flag
**Definition:** An alert attached to a patient record to draw attention to important information — allergies, fall risk, infection precautions, VIP status.
**FHIR R4 Resource:** `Flag`
**Also known as:** Patient alert, Clinical alert, Warning flag
**Not to be confused with:** Risk (a calculated probability), Observation (a measured finding)

### Alert
**Definition:** Informal synonym for Flag — a notification of important patient information requiring attention.
**FHIR R4 Resource:** `Flag` or `Communication`
**Also known as:** Flag, Clinical warning, Patient alert
**Not to be confused with:** Notification (a system-generated message), Flag (the FHIR resource)

### Risk
**Definition:** A calculated or assessed probability of a patient experiencing a negative health outcome — fall risk, sepsis risk, readmission risk.
**FHIR R4 Resource:** `RiskAssessment`
**Also known as:** Risk score, Clinical risk, Predictive risk
**Not to be confused with:** Flag (an alert based on risk), Condition (an existing problem)

---

## Workflow Concepts

### Task
**Definition:** A unit of work assigned to a person or system, tracking progress toward completion of a clinical or administrative activity.
**FHIR R4 Resource:** `Task`
**Also known as:** Work item, To-do, Clinical task, Workflow task
**Not to be confused with:** ServiceRequest (a clinical order), CarePlan.activity (a planned care action)

### WorkQueue
**Definition:** A list of Tasks organized for a team or individual to work through — not a FHIR resource itself, but represented via Task queries.
**FHIR R4 Resource:** Queried via `Task` (filtered by owner, status, priority)
**Also known as:** Task queue, Work list, In-basket
**Not to be confused with:** Task (individual item), MessageHeader (a routed message)

---

## Encounter Class Concepts

### Encounter Class: ambulatory
**Definition:** An Encounter where the patient comes to a facility for care but is not admitted overnight. Includes clinic visits, outpatient procedures, and same-day surgery.
**FHIR R4 Resource:** `Encounter.class` = `AMB` (v3 ActCode)
**Also known as:** Outpatient, Clinic visit, Outpatient encounter
**Not to be confused with:** inpatient (admitted overnight), emergency (unscheduled urgent care)

### Encounter Class: inpatient
**Definition:** An Encounter where the patient is admitted to a facility and stays overnight or longer.
**FHIR R4 Resource:** `Encounter.class` = `IMP` (v3 ActCode)
**Also known as:** Inpatient stay, Hospital admission, Admitted patient
**Not to be confused with:** ambulatory (outpatient), observation (short stay that may or may not become inpatient)

### Encounter Class: emergency
**Definition:** An Encounter in an emergency department for urgent, unscheduled care.
**FHIR R4 Resource:** `Encounter.class` = `EMER` (v3 ActCode)
**Also known as:** ED visit, ER visit, Emergency encounter
**Not to be confused with:** ambulatory (scheduled outpatient), inpatient (admitted)

### Encounter Class: virtual
**Definition:** An Encounter conducted remotely via telehealth, video, or phone.
**FHIR R4 Resource:** `Encounter.class` = `VR` (v3 ActCode)
**Also known as:** Telehealth visit, Telemedicine, Virtual care, Remote visit
**Not to be confused with:** ambulatory (in-person outpatient), home health (in-person at patient's home)

---

## Terminology Concepts

### Coding
**Definition:** A structured representation of a concept using a code, system URI, and display name from a recognized terminology system.
**FHIR R4 Resource:** `Coding` (datatype)
**Also known as:** Code, Terminology code, Concept code
**Not to be confused with:** CodeableConcept (which may contain multiple Codings), ValueSet (a defined set of allowed codes)

### CodeableConcept
**Definition:** A FHIR datatype that combines one or more Codings (from formal systems) with a human-readable text field. Used throughout FHIR for coded clinical concepts.
**FHIR R4 Resource:** `CodeableConcept` (datatype)
**Also known as:** Coded concept, Clinical concept code
**Not to be confused with:** Coding (a single code from one system), ValueSet (the set of valid codes)

### ValueSet
**Definition:** A defined set of codes from one or more terminology systems that are valid for a specific field or context.
**FHIR R4 Resource:** `ValueSet`
**Also known as:** Code set, Allowed values, Terminology binding
**Not to be confused with:** CodeSystem (defines the codes themselves), Coding (a specific code instance)

### Binding Strength
**Definition:** The degree to which a ValueSet constrains what codes may be used in a field: required (must use), extensible (prefer these), preferred (recommended), or example (illustrative).
**FHIR R4 Resource:** Defined in FHIR StructureDefinition profiles
**Also known as:** Terminology binding, Binding, Vocabulary binding
**Not to be confused with:** ValueSet (the set itself), ConceptMap (mapping between systems)

---

## Standards and Regulations

### FHIR
**Definition:** Fast Healthcare Interoperability Resources — the HL7 standard for representing and exchanging healthcare information as RESTful resources. Current version: R4 (4.0.1).
**FHIR R4 Resource:** The standard itself; all resources are FHIR resources
**Also known as:** HL7 FHIR, FHIR R4, Fast Healthcare Interoperability Resources
**Not to be confused with:** HL7 v2 (legacy message-based standard), CDA (document-based standard)

### HL7
**Definition:** Health Level Seven International — the standards development organization that produces FHIR, HL7 v2, CDA, and other healthcare interoperability standards.
**FHIR R4 Resource:** N/A (organization, not a resource)
**Also known as:** HL7 International, Health Level 7
**Not to be confused with:** FHIR (a specific HL7 standard), ONC (U.S. Office of the National Coordinator)

### SNOMED CT
**Definition:** Systematized Nomenclature of Medicine — Clinical Terms. A comprehensive clinical terminology used to encode clinical concepts (diagnoses, procedures, findings).
**FHIR R4 Resource:** System URI: `http://snomed.info/sct`
**Also known as:** SNOMED, SNOMED Clinical Terms
**Not to be confused with:** ICD-10 (classification for billing), LOINC (lab and observation codes)

### ICD-10
**Definition:** International Classification of Diseases, 10th Revision. Used for diagnosis coding in billing and epidemiology. In the U.S., ICD-10-CM for diagnoses, ICD-10-PCS for procedures.
**FHIR R4 Resource:** System URI: `http://hl7.org/fhir/sid/icd-10-cm`
**Also known as:** ICD-10-CM, ICD-10-PCS, Diagnosis code
**Not to be confused with:** SNOMED CT (clinical terminology), CPT (procedure billing codes)

### LOINC
**Definition:** Logical Observation Identifiers Names and Codes. The universal standard for identifying medical lab tests, clinical observations, and document types.
**FHIR R4 Resource:** System URI: `http://loinc.org`
**Also known as:** LOINC codes, Lab codes, Observation codes
**Not to be confused with:** SNOMED CT (broader clinical terminology), ICD-10 (diagnosis/billing codes)

### CPT
**Definition:** Current Procedural Terminology — the AMA's coding system for medical procedures and services, used primarily for billing in the U.S.
**FHIR R4 Resource:** System URI: `http://www.ama-assn.org/go/cpt`
**Also known as:** CPT codes, Procedure codes, AMA CPT
**Not to be confused with:** ICD-10-PCS (inpatient procedure codes), HCPCS (broader billing codes including DME)

### RxNorm
**Definition:** A standardized clinical drug nomenclature for medications in the U.S., providing normalized names and identifiers for drugs.
**FHIR R4 Resource:** System URI: `http://www.nlm.nih.gov/research/umls/rxnorm`
**Also known as:** RxNorm codes, Drug codes, NLM RxNorm
**Not to be confused with:** NDC (National Drug Code, package-level), SNOMED CT (broader terminology including some drug concepts)

### UCUM
**Definition:** Unified Code for Units of Measure — the standard for coding units of measurement used in clinical observations (mg/dL, mmHg, kg, etc.).
**FHIR R4 Resource:** System URI: `http://unitsofmeasure.org`
**Also known as:** Units of measure, Measurement units
**Not to be confused with:** LOINC (codes the observable, not its unit), SNOMED CT

---

## Privacy and Compliance

### PHI
**Definition:** Protected Health Information — any individually identifiable health information held by a covered entity under HIPAA, including names, dates, identifiers, and clinical data.
**FHIR R4 Resource:** N/A (regulatory concept); affects all patient-linked resources
**Also known as:** Protected Health Information, ePHI (electronic), PII in health context
**Not to be confused with:** De-identified data (PHI with identifiers removed), Pseudonymized data

### HIPAA
**Definition:** Health Insurance Portability and Accountability Act — U.S. federal law governing the privacy and security of health information.
**FHIR R4 Resource:** N/A (regulatory framework)
**Also known as:** HIPAA Privacy Rule, HIPAA Security Rule
**Not to be confused with:** HITECH (extends HIPAA to electronic records), 42 CFR Part 2 (additional rules for substance use records)

### De-identification
**Definition:** The process of removing or transforming PHI identifiers so that the data can no longer reasonably be linked to a specific individual.
**FHIR R4 Resource:** N/A (process); uses `Meta.security` tag `REDACTED` or `SUBSETTED`
**Also known as:** Anonymization, Data de-identification, Safe Harbor de-identification
**Not to be confused with:** Pseudonymization (identifiers replaced, not removed), Aggregation

### Pseudonymization
**Definition:** Replacing direct patient identifiers with pseudonyms (tokens) so that re-identification is possible only with a separate key.
**FHIR R4 Resource:** N/A (process); common in research data exports
**Also known as:** Tokenization, Patient de-identification with re-link key
**Not to be confused with:** De-identification (irreversible removal), Anonymization

---

## Organizational Concepts

### Tenant
**Definition:** An isolated organizational unit within a multi-tenant healthcare platform — typically a health system, hospital group, or large practice. Data is partitioned by tenant.
**FHIR R4 Resource:** Represented via `Organization` at top level; enforced via API key and headers
**Also known as:** Customer tenant, Health system tenant, Organization tenant
**Not to be confused with:** Organization (FHIR resource, may be sub-tenant), Department (sub-unit within a facility)

### Organization
**Definition:** A formally or informally recognized grouping of people or organizations — hospitals, clinics, practices, departments, insurance companies.
**FHIR R4 Resource:** `Organization`
**Also known as:** Healthcare organization, Facility, Provider organization
**Not to be confused with:** Location (a physical place), Tenant (the top-level platform partition)

### Location
**Definition:** A physical place where healthcare services are provided — a building, ward, room, or bed.
**FHIR R4 Resource:** `Location`
**Also known as:** Facility location, Care location, Physical location
**Not to be confused with:** Organization (the entity that operates at a location), Department (an organizational unit, which may correspond to a Location)

### Department
**Definition:** An administrative or clinical subdivision of an Organization — cardiology, emergency, pharmacy, billing.
**FHIR R4 Resource:** `Organization` (with partOf) or `Location`
**Also known as:** Service department, Clinical department, Division
**Not to be confused with:** Location (physical space), Organization (the broader entity)

### Facility
**Definition:** A physical healthcare site — hospital, clinic, lab, or imaging center — where care is delivered.
**FHIR R4 Resource:** `Location` or `Organization`
**Also known as:** Care site, Healthcare facility, Practice location
**Not to be confused with:** Department (a subdivision of a facility), Organization (may be a legal entity spanning multiple facilities)

---

## Common Confusions

This section clarifies the most frequently confused concepts in the healthcare domain.

### Encounter vs. Visit vs. Episode of Care

| Concept | FHIR Resource | Scope | Duration |
|---|---|---|---|
| Encounter | `Encounter` | Single clinical interaction | Minutes to days |
| Visit | `Encounter` | Informal synonym for Encounter | Same as Encounter |
| Episode of Care | `EpisodeOfCare` | A series of Encounters for one condition | Weeks to years |

**Rule:** An Episode of Care contains many Encounters. A Visit is always just one Encounter. If you are recording what happened at a specific appointment or ED visit, use Encounter. If you are grouping a patient's ongoing diabetes management across many visits, use EpisodeOfCare.

### Condition vs. Diagnosis vs. Problem

| Concept | FHIR Representation | Context | Persistence |
|---|---|---|---|
| Condition | `Condition` resource | Any clinical state | Can be historical or active |
| Diagnosis | `Condition` + `Encounter.diagnosis` reference | Specific to an Encounter | Encounter-scoped |
| Problem | `Condition` with `category=problem-list-item` | Problem list | Ongoing, actively managed |

**Rule:** All three use the `Condition` resource. Diagnosis adds a link from the Encounter. Problem adds a category code and lives on the problem list.

### MedicationRequest vs. Prescription vs. Order

| Concept | FHIR Resource | Setting | Fulfillment |
|---|---|---|---|
| MedicationRequest | `MedicationRequest` | Any | Any |
| Prescription | `MedicationRequest` (intent=order) | Outpatient | Pharmacy |
| Order | `MedicationRequest` (intent=order) | Inpatient | Nursing administration |

**Rule:** These are all `MedicationRequest`. The distinction is contextual. Use `intent` and `category` codes to specify whether it is an outpatient prescription or inpatient order.

### Claim vs. Invoice vs. Charge

| Concept | FHIR Resource | Recipient | Purpose |
|---|---|---|---|
| Charge | `ChargeItem` | Internal | Record billable service |
| Claim | `Claim` | Insurer/Payer | Request reimbursement |
| Invoice | `Invoice` | Patient | Request patient payment |

**Rule:** Charges are captured first. They are assembled into Claims for insurers or Invoices for patients. Never confuse what goes to the payer versus what goes to the patient.

### DocumentReference vs. Composition

| Concept | FHIR Resource | Structure | Use Case |
|---|---|---|---|
| DocumentReference | `DocumentReference` | Pointer/wrapper | Reference any document (PDF, CDA, image) |
| Composition | `Composition` | Structured FHIR | Create new structured clinical documents |

**Rule:** Use `DocumentReference` to point to an existing document. Use `Composition` to author a new structured FHIR document. A `Composition` can be wrapped in a Bundle and referenced by a `DocumentReference`.

### Observation vs. Assessment vs. Screening

| Concept | FHIR Resource | Type | Trigger |
|---|---|---|---|
| Observation | `Observation` | Any measurement or finding | Any clinical context |
| Assessment | `Observation` (category=survey) or `QuestionnaireResponse` | Structured scored tool | Clinical evaluation of known concern |
| Screening | `Observation` or `Procedure` | Population-level evaluation | Prevention, early detection |

**Rule:** All three may use `Observation`. Assessment and Screening are specific categories of Observation. Use the `category` code and the LOINC code on the Observation to distinguish them.
