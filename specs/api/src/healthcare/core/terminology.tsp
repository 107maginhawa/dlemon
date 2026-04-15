import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;

/**
 * Healthcare terminology definitions including official FHIR coding system URIs
 * and standardized value set enumerations used across the healthcare API.
 *
 * All coding system URIs are authoritative identifiers sourced from the
 * HL7 FHIR R4 specification and CMS/NLM publications.
 */
namespace Healthcare.Core.Terminology;

// ---------------------------------------------------------------------------
// Coding Systems
// ---------------------------------------------------------------------------

@doc("Official FHIR system URIs for standard healthcare coding systems. Use these values in Coding.system fields to ensure interoperability.")
enum CodingSystem {
  @doc("ICD-10-CM: International Classification of Diseases, 10th Revision, Clinical Modification — used for diagnosis coding in the United States")
  icd10cm: "http://hl7.org/fhir/sid/icd-10-cm",

  @doc("ICD-10-PCS: International Classification of Diseases, 10th Revision, Procedure Coding System — used for inpatient procedure coding (CMS)")
  icd10pcs: "http://www.cms.gov/Medicare/Coding/ICD10",

  @doc("ICD-9-CM: International Classification of Diseases, 9th Revision, Clinical Modification — legacy diagnosis and procedure coding")
  icd9cm: "http://hl7.org/fhir/sid/icd-9-cm",

  @doc("SNOMED CT: Systematized Nomenclature of Medicine — Clinical Terms; comprehensive clinical terminology for clinical findings, diseases, and procedures")
  snomedCt: "http://snomed.info/sct",

  @doc("CPT: Current Procedural Terminology — AMA codes for physician services and outpatient procedures")
  cpt: "http://www.ama-assn.org/go/cpt",

  @doc("HCPCS Level II: Healthcare Common Procedure Coding System — CMS codes for services, supplies, and equipment not covered by CPT")
  hcpcs: "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets",

  @doc("CDT: Code on Dental Procedures and Nomenclature — ADA codes for dental procedures")
  cdt: "http://www.ada.org/cdt",

  @doc("RxNorm: NLM normalized names for clinical drugs and drug deliveries; used for medication coding and drug interaction checking")
  rxNorm: "http://www.nlm.nih.gov/research/umls/rxnorm",

  @doc("NDC: National Drug Code — FDA identifier for human drugs, biologics, and medical devices")
  ndc: "http://hl7.org/fhir/sid/ndc",

  @doc("LOINC: Logical Observation Identifiers Names and Codes — universal codes for laboratory and clinical observations, documents, and panels")
  loinc: "http://loinc.org",

  @doc("UCUM: Unified Code for Units of Measure — codes for all units of measures used in science, engineering, and business")
  ucum: "http://unitsofmeasure.org",

  @doc("CVX: Vaccine Administered codes — CDC codes identifying vaccines administered or intended for use in the United States")
  cvx: "http://hl7.org/fhir/sid/cvx",

  @doc("NPI: National Provider Identifier — unique 10-digit identification number issued to health care providers in the United States")
  npi: "http://hl7.org/fhir/sid/us-npi",

  @doc("HL7 ActCode: HL7 vocabulary for the code of a V3 Act including clinical acts, financial transactions, and administrative acts")
  hl7ActCode: "http://terminology.hl7.org/CodeSystem/v3-ActCode",

  @doc("HL7 V2 Table 0203: HL7 Version 2 Table 0203 — Identifier Type codes used in CX and PL data types")
  hl7V2Tables: "http://terminology.hl7.org/CodeSystem/v2-0203",

  @doc("NUBC Patient Discharge Status: National Uniform Billing Committee codes indicating where a patient was discharged to after an inpatient stay")
  nubc: "https://www.nubc.org/CodeSystem/PatDischargeStatus",

  @doc("Place of Service (POS) Codes: CMS codes indicating the setting in which a service was provided (e.g., office, inpatient hospital, telehealth)")
  pos: "https://www.cms.gov/Medicare/Coding/place-of-service-codes",
}

// ---------------------------------------------------------------------------
// Administrative Value Sets
// ---------------------------------------------------------------------------

@doc("The gender of a person used for administrative purposes. Aligns with FHIR AdministrativeGender.")
enum AdministrativeGender {
  @doc("Male gender")
  male,

  @doc("Female gender")
  female,

  @doc("Other gender identity not captured by male or female")
  other,

  @doc("A proper value is applicable, but not known")
  `unknown`: "unknown",
}

// ---------------------------------------------------------------------------
// Encounter Value Sets
// ---------------------------------------------------------------------------

@doc("Current state of the encounter. Aligns with FHIR EncounterStatus.")
enum EncounterStatus {
  @doc("The Encounter has not yet started")
  planned,

  @doc("The Patient is present for the encounter, however is not currently meeting with a practitioner")
  arrived,

  @doc("The patient has been assessed for the priority of their treatment based on the severity of their condition")
  triaged,

  @doc("The Encounter has begun and the patient is present or is being seen")
  inProgress,

  @doc("The Encounter has begun, but the patient is temporarily on leave")
  onLeave,

  @doc("The Encounter has ended")
  finished,

  @doc("The Encounter has ended before it has begun")
  cancelled,

  @doc("This instance should not have been part of this patient's medical record")
  enteredInError,

  @doc("The encounter status is unknown; note that unknown is used where other status values are not appropriate")
  `unknown`: "unknown",
}

@doc("Classification of the encounter. Aligns with FHIR v3 ActEncounterCode.")
enum EncounterClass {
  @doc("A comprehensive term for health care provided in a healthcare facility on a nonresident basis (outpatient)")
  ambulatory,

  @doc("Healthcare encounter that takes place in a dedicated healthcare service facility where the patient is admitted overnight")
  inpatient,

  @doc("A patient encounter that takes place at a dedicated healthcare service facility when the patient's condition is acute")
  emergency,

  @doc("A patient encounter where patient is scheduled or admitted for a short stay for observation and assessment")
  observation,

  @doc("Healthcare encounter that takes place in the residence of the patient or a designee")
  home,

  @doc("A patient encounter conducted by telecommunication")
  virtual,

  @doc("Healthcare encounter that takes place in the field, outside a dedicated healthcare facility")
  fieldVisit,
}

// ---------------------------------------------------------------------------
// Condition Value Sets
// ---------------------------------------------------------------------------

@doc("The clinical status of a condition or diagnosis. Aligns with FHIR condition-clinical ValueSet.")
enum ConditionClinicalStatus {
  @doc("The subject is currently experiencing the symptoms of the condition or there is evidence of the condition")
  active,

  @doc("The subject is experiencing a re-occurrence or repeating of a previously resolved condition")
  recurrence,

  @doc("The subject is experiencing a return of a condition, or signs and symptoms after a period of improvement")
  relapse,

  @doc("The subject is no longer experiencing the symptoms of the condition or there is no longer evidence of the condition")
  inactive,

  @doc("The subject is no longer experiencing the symptoms of the condition, but there is a risk of the symptoms returning")
  remission,

  @doc("The subject is no longer experiencing the symptoms of the condition and there is a negligible perceived risk of the symptoms returning")
  resolved,
}

@doc("The verification status to support or decline the clinical status of a condition. Aligns with FHIR condition-ver-status ValueSet.")
enum ConditionVerificationStatus {
  @doc("There is not sufficient diagnostic and/or clinical evidence to treat this as a confirmed condition")
  unconfirmed,

  @doc("This is a tentative diagnosis — still a candidate that is under consideration")
  provisional,

  @doc("One of a set of potential (and typically mutually exclusive) conditions has been identified")
  differential,

  @doc("There is sufficient diagnostic and/or clinical evidence to treat this as a confirmed condition")
  confirmed,

  @doc("This condition has been ruled out by diagnostic and clinical evidence")
  refuted,

  @doc("The statement was entered in error and is not valid")
  enteredInError,
}

// ---------------------------------------------------------------------------
// Observation Value Sets
// ---------------------------------------------------------------------------

@doc("Codes providing the status of an observation. Aligns with FHIR ObservationStatus.")
enum ObservationStatus {
  @doc("The existence of the observation is registered, but there is no result yet available")
  registered,

  @doc("This is an initial or interim observation; the results may be incomplete or unverified")
  preliminary,

  @doc("The observation is complete and verified by an authorized person")
  final,

  @doc("Subsequent to being Final, the observation has been modified; incremental changes are now captured")
  amended,

  @doc("Subsequent to being Final, the observation has been modified to correct an error in the test result")
  corrected,

  @doc("The observation is unavailable because the measurement was not started or not completed")
  cancelled,

  @doc("The observation has been withdrawn following previous final release")
  enteredInError,

  @doc("The authoring/source system does not know which of the status values currently applies for this observation")
  `unknown`: "unknown",
}

// ---------------------------------------------------------------------------
// Medication Request Value Sets
// ---------------------------------------------------------------------------

@doc("A coded concept specifying the state of the prescribing event. Aligns with FHIR MedicationRequest status.")
enum MedicationRequestStatus {
  @doc("The prescription is 'actionable', but not all actions that are implied by it have occurred yet")
  active,

  @doc("Actions implied by the prescription are to be temporarily halted")
  onHold,

  @doc("The prescription has been withdrawn before any administrations have occurred")
  cancelled,

  @doc("All actions that are implied by the prescription have occurred")
  completed,

  @doc("Some of the actions that are implied by the medication request may have occurred; the medication request has been held")
  enteredInError,

  @doc("Actions implied by the prescription are to be permanently halted before all of the administrations specified have occurred")
  stopped,

  @doc("The prescription is not yet 'actionable'; the medication has been suggested but is not yet authorized")
  draft,

  @doc("The authoring/source system does not know which of the status values currently applies for this MedicationRequest")
  `unknown`: "unknown",
}

@doc("The intent of the medication request. Aligns with FHIR MedicationRequest intent.")
enum MedicationRequestIntent {
  @doc("The request is a suggestion made by someone/something that doesn't have an intention to ensure it occurs and without providing an authorization to act")
  proposal,

  @doc("The request represents an intention to ensure something occurs without providing an authorization for others to act")
  plan,

  @doc("The request represents a request/demand and authorization for action")
  order,

  @doc("The request represents the original authorization for the medication request")
  originalOrder,

  @doc("The request represents an automatically generated supplemental authorization for action based on a parent authorization")
  reflexOrder,

  @doc("The request represents the view of an authorization instantiated by a fulfilling system representing the details of the fulfiller's intention to act upon a submitted order")
  fillerOrder,

  @doc("The request represents an instance for the particular order, for example a medication administration record")
  instanceOrder,

  @doc("The request represents a component or option for a RequestGroup that establishes timing, conditionality and/or other constraints among a set of requests")
  option,
}

// ---------------------------------------------------------------------------
// Service Request Value Sets
// ---------------------------------------------------------------------------

@doc("The status of the service request. Aligns with FHIR ServiceRequest status.")
enum ServiceRequestStatus {
  @doc("The request has been created but is not yet complete or ready for action")
  draft,

  @doc("The request is in force and ready to be acted upon")
  active,

  @doc("The request (and any implicit authorization to act) has been temporarily withdrawn but is expected to resume in the future")
  onHold,

  @doc("The request (and any implicit authorization to act) has been terminated prior to the known full completion of the intended actions")
  revoked,

  @doc("The activity described by the request has been fully performed; no further activity will occur")
  completed,

  @doc("This request should never have existed and should be considered 'void'")
  enteredInError,

  @doc("The authoring/source system does not know which of the status values currently applies for this request")
  `unknown`: "unknown",
}

@doc("Whether the request is a proposal, plan, an original order or a reflex order. Aligns with FHIR ServiceRequest intent.")
enum ServiceRequestIntent {
  @doc("The request is a suggestion made by someone/something that doesn't have an intention to ensure it occurs")
  proposal,

  @doc("The request represents an intention to ensure something occurs without providing an authorization for others to act")
  plan,

  @doc("The request represents a legally binding instruction authored by a Patient or RelatedPerson")
  directive,

  @doc("The request represents a request/demand and authorization for action")
  order,

  @doc("The request represents the original authorization for the service request")
  originalOrder,

  @doc("The request represents an automatically generated supplemental authorization for action based on a parent authorization")
  reflexOrder,

  @doc("The request represents the view of an authorization instantiated by a fulfilling system")
  fillerOrder,

  @doc("The request represents an instance for the particular order")
  instanceOrder,

  @doc("The request represents a component or option for a RequestGroup")
  option,
}

// ---------------------------------------------------------------------------
// Request Priority
// ---------------------------------------------------------------------------

@doc("Identifies the level of importance to be assigned to actioning the request. Aligns with FHIR RequestPriority.")
enum RequestPriority {
  @doc("The request has normal priority")
  routine,

  @doc("The request should be actioned promptly — higher priority than routine")
  urgent,

  @doc("The request should be actioned as soon as possible — higher priority than urgent")
  asap,

  @doc("The request should be actioned immediately — highest possible priority; used for life-threatening situations")
  stat,
}

// ---------------------------------------------------------------------------
// Appointment Value Sets
// ---------------------------------------------------------------------------

@doc("The free/busy status of an appointment. Aligns with FHIR AppointmentStatus.")
enum AppointmentStatus {
  @doc("None of the participant(s) have finalized their acceptance of the appointment request, and the start/end time might not be set yet")
  proposed,

  @doc("Some or all of the participant(s) have not finalized their acceptance of the appointment request")
  pending,

  @doc("All participant(s) have been considered and the appointment is confirmed to go ahead at the date/times specified")
  booked,

  @doc("The patient/patients has/have arrived and is/are waiting to be seen")
  arrived,

  @doc("The planning stages of the appointment are now complete, the encounter resource will exist and will track further status changes")
  fulfilled,

  @doc("The appointment has been cancelled")
  cancelled,

  @doc("Some or all of the participant(s) have not/did not appear for the appointment (no-show)")
  noShow,

  @doc("This instance should not have been part of this patient's schedule")
  enteredInError,

  @doc("The appointment has been placed on a waitlist, to be scheduled/confirmed in the future when a slot/service is available")
  waitlist,

  @doc("The patient/participant has been seen and the appointment is now complete")
  checkedIn,
}

// ---------------------------------------------------------------------------
// Document Reference Value Sets
// ---------------------------------------------------------------------------

@doc("The status of the document reference. Aligns with FHIR DocumentReference status.")
enum DocumentReferenceStatus {
  @doc("This is the current reference for this document")
  current,

  @doc("This reference has been superseded by another reference")
  superseded,

  @doc("This reference was created in error")
  enteredInError,
}

// ---------------------------------------------------------------------------
// Allergy Value Sets
// ---------------------------------------------------------------------------

@doc("Identification of the underlying physiological mechanism for an Adverse Reaction Risk. Aligns with FHIR AllergyIntolerance type.")
enum AllergyType {
  @doc("A propensity for hypersensitivity reaction(s) to a substance, which can be characterized by a toxic reaction, immune mediated or unknown reaction")
  allergy,

  @doc("A propensity for adverse reactions to a substance that is not immune mediated. This includes most treatment disagreements, instrumentation errors, or allergies that cannot be diagnosed by standard allergy testing procedures.")
  intolerance,
}

@doc("Category of the identified substance associated with allergies or intolerances. Aligns with FHIR AllergyIntolerance category.")
enum AllergyCategory {
  @doc("Any substance consumed to provide nutritional support for the body")
  food,

  @doc("Substances administered to achieve a physiological effect")
  medication,

  @doc("Any substances that are encountered in the environment, including pets, flowers, dust and mold")
  environment,

  @doc("A preparation that is synthesized from living organisms or their products, especially a human or animal protein, such as a hormone or antitoxin")
  biologic,
}

@doc("Estimate of the potential clinical harm, or seriousness, of the reaction to the identified substance. Aligns with FHIR AllergyIntolerance criticality.")
enum AllergyCriticality {
  @doc("Worst case result is not life-threatening or does not have high potential for organ system failure")
  low,

  @doc("Worst case result is life-threatening or has high potential for organ system failure")
  high,

  @doc("Unable to assess the potential clinical impact with the information available")
  unableToAssess,
}

@doc("Clinical assessment of the severity of a reaction event as a whole. Aligns with FHIR AllergyIntolerance reaction severity.")
enum ReactionSeverity {
  @doc("Causes mild physiological effects")
  mild,

  @doc("Causes moderate physiological effects")
  moderate,

  @doc("Causes severe physiological effects")
  severe,
}

// ---------------------------------------------------------------------------
// Diagnostic Report Value Sets
// ---------------------------------------------------------------------------

@doc("The status of the diagnostic report as a whole. Aligns with FHIR DiagnosticReport status.")
enum DiagnosticReportStatus {
  @doc("The existence of the report is registered, but there is nothing yet available")
  registered,

  @doc("This is a partial (e.g., initial, interim, or preliminary) report; data in the report may be incomplete or unverified")
  partial,

  @doc("Verified early results are available, but not all results are final")
  preliminary,

  @doc("The report is complete and verified by an authorized person")
  final,

  @doc("Subsequent to being Final, the report has been modified; incremental changes are now captured")
  amended,

  @doc("Subsequent to being Final, the report has been modified to correct an error in the report or referenced results")
  corrected,

  @doc("Subsequent to being Final, the report has had additional information added")
  appended,

  @doc("The report is unavailable because the measurement was not started or not completed (also sometimes called 'aborted')")
  cancelled,

  @doc("The report has been withdrawn following a previous final release")
  enteredInError,

  @doc("The authoring/source system does not know which of the status values currently applies for this observation")
  `unknown`: "unknown",
}

// ---------------------------------------------------------------------------
// Care Plan Value Sets
// ---------------------------------------------------------------------------

@doc("Indicates whether the plan is currently being acted upon, represents future intentions or is now a historical record. Aligns with FHIR CarePlan status.")
enum CarePlanStatus {
  @doc("The plan is prepared but not yet made available for action")
  draft,

  @doc("The plan is intended to be followed and used as part of patient care")
  active,

  @doc("The plan has been temporarily stopped but is expected to resume in the future")
  onHold,

  @doc("The plan has been terminated prior to reaching its natural end-point")
  revoked,

  @doc("The plan has been fully completed and all activity is complete")
  completed,

  @doc("This care plan record was created in error and should not be used")
  enteredInError,

  @doc("The authoring/source system does not know which of the status values currently applies for this care plan")
  `unknown`: "unknown",
}

// ---------------------------------------------------------------------------
// Claim Value Sets
// ---------------------------------------------------------------------------

@doc("The status of the claim resource. Aligns with FHIR Claim status.")
enum ClaimStatus {
  @doc("The instance is currently in-force")
  active,

  @doc("The instance is withdrawn, rescinded or reversed")
  cancelled,

  @doc("A new instance the contents of which is not complete")
  draft,

  @doc("An instance that should not have existed")
  enteredInError,
}

@doc("The purpose of the claim — to obtain authorization or to provide adjudication. Aligns with FHIR Claim use.")
enum ClaimUse {
  @doc("The treatment is complete and this represents a Claim for the services rendered including any pre-authorization")
  claim,

  @doc("The treatment is proposed and this represents a Pre-authorization for the services")
  preauthorization,

  @doc("The treatment is proposed and this represents a Pre-determination for the services")
  predetermination,
}

// ---------------------------------------------------------------------------
// Consent Value Sets
// ---------------------------------------------------------------------------

@doc("Indicates the current state of this consent resource. Aligns with FHIR Consent status.")
enum ConsentStatus {
  @doc("The consent is in development or awaiting use but is not yet intended to be acted upon")
  draft,

  @doc("The consent has been proposed but not yet agreed to by all parties")
  proposed,

  @doc("The consent is to be followed and enforced")
  active,

  @doc("The consent has been rejected by one or more of the parties")
  rejected,

  @doc("The consent is terminated or replaced")
  inactive,

  @doc("The consent was created wrongly (e.g., wrong patient) and should be ignored")
  enteredInError,
}

// ---------------------------------------------------------------------------
// Slot Value Sets
// ---------------------------------------------------------------------------

@doc("The free/busy status of the slot. Aligns with FHIR SlotStatus.")
enum SlotStatus {
  @doc("Indicates that the time interval is busy because one or more events have been scheduled for that interval")
  busy,

  @doc("Indicates that the time interval is free for scheduling")
  free,

  @doc("Indicates that the time interval is busy and that the interval cannot be scheduled")
  busyUnavailable,

  @doc("Indicates that the time interval is busy because one or more events have been tentatively scheduled for that interval")
  busyTentative,

  @doc("This instance should not have been part of this patient's schedule")
  enteredInError,
}

// ---------------------------------------------------------------------------
// Binding Strength and Terminology Governance
// ---------------------------------------------------------------------------

@doc("Indicates the degree of conformance expectations associated with a terminology binding. Aligns with FHIR BindingStrength.")
enum BindingStrength {
  @doc("To be conformant, the concept SHALL be from the specified value set")
  required: "required",
  @doc("To be conformant, the concept SHALL be from the specified value set if any codes within apply; otherwise other codes may be used")
  extensible: "extensible",
  @doc("Instances are encouraged to draw from the specified codes for interoperability, but are not required to")
  preferred: "preferred",
  @doc("Instances are not expected to draw from the specified value set")
  example: "example",
}

@doc("Describes a terminology binding for a coded element, specifying which code system and value set should be used and how strictly.")
model TerminologyBinding {
  @doc("How strictly the binding should be applied")
  strength: BindingStrength;

  @doc("URI identifying the value set (e.g., 'http://hl7.org/fhir/ValueSet/condition-code')")
  valueSet: string;

  @doc("Human-readable description of the binding context")
  description?: string;

  @doc("The code system URI this binding draws from (e.g., CodingSystem.snomedCt)")
  codeSystem?: string;
}

// ---------------------------------------------------------------------------
// Additional Status Enums for New Resources
// ---------------------------------------------------------------------------

@doc("Status of an episode of care. Aligns with FHIR EpisodeOfCareStatus.")
enum EpisodeOfCareStatus {
  @doc("This episode is planned but not yet started")
  planned,
  @doc("This episode is in a waitlist state")
  waitlist,
  @doc("This episode is currently active")
  active,
  @doc("This episode is temporarily on hold")
  onhold,
  @doc("This episode has been completed")
  finished,
  @doc("This episode has been cancelled")
  cancelled,
  @doc("This episode was entered in error")
  enteredInError,
}

@doc("Status of a clinical flag or alert.")
enum FlagStatus {
  @doc("A current flag that should be displayed to a user")
  active,
  @doc("The flag is no longer active but has not been resolved")
  inactive,
  @doc("The flag was entered in error and should be ignored")
  enteredInError,
}

@doc("Priority category for clinical flags.")
enum FlagPriority {
  @doc("High-priority alert requiring immediate attention")
  high,
  @doc("Medium-priority alert")
  medium,
  @doc("Low-priority informational flag")
  low,
}

@doc("Status of a task in a workflow. Aligns with FHIR TaskStatus.")
enum TaskStatus {
  @doc("Task has been created but is not yet ready to be acted upon")
  draft,
  @doc("Task is ready to be performed")
  requested,
  @doc("Task has been received by the owner but not yet started")
  received,
  @doc("Task has been accepted by the owner")
  accepted,
  @doc("Task has been rejected by the owner")
  rejected,
  @doc("Task is ready to be performed but waiting for some precondition")
  ready,
  @doc("Task has been cancelled before completion")
  cancelled,
  @doc("Task is currently being performed")
  inProgress,
  @doc("Task is on hold")
  onHold,
  @doc("Task attempt failed and may be retried")
  failed,
  @doc("Task has been successfully completed")
  completed,
  @doc("Task was entered in error")
  enteredInError,
}

@doc("Priority of a task.")
enum TaskPriority {
  @doc("Routine priority")
  routine,
  @doc("Urgent priority")
  urgent,
  @doc("As soon as possible")
  asap,
  @doc("Immediate/STAT priority")
  stat,
}

@doc("Intent of a task.")
enum TaskIntent {
  @doc("Actionable proposal")
  proposal,
  @doc("Non-actionable plan")
  plan,
  @doc("Actionable order/request")
  order,
  @doc("Original order from prescriber")
  originalOrder,
  @doc("Reflex order generated by system")
  reflexOrder,
  @doc("Filler-generated order")
  fillerOrder,
  @doc("Specific instantiated order")
  instanceOrder,
  @doc("Non-mandated option")
  option,
}

@doc("Status of a medication administration event.")
enum MedicationAdministrationStatus {
  @doc("Administration is being prepared but not yet started")
  inProgress,
  @doc("Administration was not completed")
  notDone,
  @doc("Administration is temporarily paused")
  onHold,
  @doc("Administration has been completed")
  completed,
  @doc("Administration was entered in error")
  enteredInError,
  @doc("Administration was stopped before completion")
  stopped,
  @doc("Status is not known")
  `unknown`: "unknown",
}

@doc("Status of an inventory item.")
enum InventoryItemStatus {
  @doc("Item is currently available for use")
  active,
  @doc("Item is temporarily unavailable")
  inactive,
  @doc("Item was entered in error")
  enteredInError,
}

@doc("Status of a device.")
enum DeviceStatus {
  @doc("Device is available for use")
  active,
  @doc("Device is not available for use (turned off, not plugged in, etc.)")
  inactive,
  @doc("Device was entered in error")
  enteredInError,
  @doc("Device status is unknown")
  `unknown`: "unknown",
}
