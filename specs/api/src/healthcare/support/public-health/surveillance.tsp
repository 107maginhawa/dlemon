import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../../common/models.tsp";
import "../../../common/errors.tsp";
import "../../../common/pagination.tsp";
import "../../../common/security.tsp";
import "../../core/primitives.tsp";
import "../../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Public Health Surveillance module.
 *
 * Provides models and operations for syndromic surveillance (ED-based), Electronic
 * Laboratory Reporting (ELR), and trauma registry data collection. Aligned with
 * CDC BioSense Platform / NSSP technical guidance for syndromic surveillance,
 * HL7 2.5.1 ELR messaging specifications, and ACS COT / state trauma registry
 * data dictionaries. Supports automated generation, submission, and
 * acknowledgement tracking for all three surveillance streams.
 */
namespace Healthcare.Support.PublicHealth.Surveillance;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("CDC BioSense / NSSP syndrome category for syndromic surveillance classification of chief complaints and diagnosis codes.")
enum SyndromeCategory {
  @doc("Influenza-like illness (ILI) — fever with cough or sore throat, consistent with influenza-like presentation")
  influenzaLikeIllness,

  @doc("Gastrointestinal — nausea, vomiting, diarrhoea, or abdominal pain syndromes")
  gi,

  @doc("Rash — dermatological syndrome including rash, vesicles, or skin eruption")
  rash,

  @doc("Respiratory — shortness of breath, respiratory distress, or lower respiratory syndromes excluding ILI")
  respiratory,

  @doc("Neurological — altered mental status, severe headache, meningismus, or neurological deficit")
  neurological,

  @doc("Haemorrhagic — unexplained bleeding or haemorrhagic presentation")
  hemorrhagic,

  @doc("Botulism-like — descending paralysis, diplopia, or dysphagia consistent with botulism")
  botulismLike,

  @doc("Other — syndrome not classifiable into the above NSSP categories")
  other,
}

@doc("Lifecycle status of a syndromic surveillance, ELR, or trauma registry submission.")
enum SurveillanceStatus {
  @doc("The record has been generated but not yet submitted to the public health agency")
  generated,

  @doc("The record has been submitted to the receiving public health system")
  submitted,

  @doc("The receiving system has acknowledged receipt of the record")
  acknowledged,
}

@doc("Intent of the injury for trauma registry classification per ACS COT / NTDB data elements.")
enum InjuryIntent {
  @doc("Unintentional — accidental injury with no intent to harm self or others")
  unintentional,

  @doc("Assault — injury inflicted intentionally by another person")
  assault,

  @doc("Self-harm — intentional injury inflicted by the patient upon themselves")
  selfHarm,

  @doc("Undetermined — insufficient information to determine intent")
  undetermined,

  @doc("Legal intervention — injury inflicted by law enforcement in the course of their duties")
  legalIntervention,
}

@doc("Patient outcome at hospital discharge for the trauma registry case.")
enum TraumaOutcome {
  @doc("The patient survived to hospital discharge")
  survived,

  @doc("The patient expired prior to hospital discharge")
  expired,
}

@doc("Lifecycle status of a trauma registry case.")
enum TraumaCaseStatus {
  @doc("The case has been identified and is open for data collection and abstraction")
  open,

  @doc("The case has been fully abstracted from the medical record")
  abstracted,

  @doc("The case data has been submitted to the state or national trauma registry")
  submitted,

  @doc("The case is undergoing quality review for data completeness and accuracy")
  qualityReview,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("Triage data from the emergency department visit that is included in the syndromic surveillance message.")
model TriageData {
  @doc("Triage acuity level assigned at ED triage (e.g., 1 = resuscitation, 2 = emergent, 3 = urgent, 4 = less urgent, 5 = non-urgent per CTAS/ESI scales)")
  acuityLevel: int32;

  @doc("Triage temperature recorded in degrees Celsius (included in NSSP ILI and fever syndrome detection)")
  temperature?: float64;

  @doc("Chief complaint coded at triage (SNOMED CT or local ICD-10-CM coded concept)")
  chiefComplaintCode?: CodeableConcept;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A syndromic surveillance report derived from an emergency department visit, submitted to a public health agency or BioSense Platform via the NSSP for real-time population health monitoring.")
model SyndromicSurveillanceReport extends HealthcareBaseEntity {
  @doc("Reference to the Organisation (facility) generating and submitting this syndromic surveillance message")
  facility: Reference;

  @doc("Date and time this surveillance report was generated from the ED visit data")
  reportDate: utcDateTime;

  @doc("Reference to the Encounter (ED visit) that is the source of this surveillance message")
  edVisit: Reference;

  @doc("Chief complaint text as recorded in the ED triage documentation")
  chiefComplaint: string;

  @doc("CDC BioSense / NSSP syndrome category assigned to this visit")
  syndromeCategory: SyndromeCategory;

  @doc("Triage data included in the syndromic surveillance message")
  triage?: TriageData;

  @doc("Patient disposition at the conclusion of the ED visit (e.g., 'Admitted', 'Discharged', 'Transferred', 'Expired')")
  disposition?: string;

  @doc("Current status of the surveillance report in the submission workflow")
  status: SurveillanceStatus;
}

@doc("An Electronic Laboratory Report (ELR) submitted from the performing laboratory to the public health agency for a reportable laboratory finding, per HL7 2.5.1 ELR messaging specifications.")
model ElectronicLabReport extends HealthcareBaseEntity {
  @doc("Reference to the Patient for whom the laboratory test was performed")
  patient: Reference;

  @doc("Reference to the Organisation (performing laboratory) that generated this report")
  performingLab: Reference;

  @doc("The reportable condition or disease identified by this laboratory result (SNOMED CT coded)")
  reportedCondition: CodeableConcept;

  @doc("Date and time the specimen was collected from the patient")
  specimenCollectedDate: utcDateTime;

  @doc("Date and time the final result was reported by the laboratory")
  resultDate: utcDateTime;

  @doc("Laboratory test code (LOINC coded — e.g., '33696-5 — Influenza virus A Ag [Presence] in Specimen')")
  testCode: CodeableConcept;

  @doc("The result value as reported (e.g., 'Positive', 'DETECTED', 'Salmonella typhi')")
  result: string;

  @doc("The interpretation of the result value for reportability purposes")
  resultInterpretation: ELRResultInterpretation;

  @doc("Organism identified (SNOMED CT or NCBI Taxonomy coded — used when result is positive for a specific pathogen)")
  organism?: CodeableConcept;

  @doc("Name of the public health jurisdiction to which this ELR is being reported (e.g., 'California Department of Public Health')")
  reportableToJurisdiction: string;

  @doc("Current status of the ELR in the submission workflow")
  status: SurveillanceStatus;
}

@doc("Result interpretation for ELR messages — whether the result is positive, negative, or indeterminate.")
enum ELRResultInterpretation {
  @doc("Positive — the test detected the target organism, antigen, or nucleic acid")
  positive,

  @doc("Negative — the test did not detect the target at or above the detection threshold")
  negative,

  @doc("Indeterminate — the result is equivocal or cannot be clearly classified as positive or negative")
  indeterminate,
}

@doc("A trauma registry case capturing injury mechanism, severity, and outcome data for submission to a state or national trauma registry per ACS COT NTDB data elements.")
model TraumaRegistryCase extends HealthcareBaseEntity {
  @doc("Reference to the Patient who sustained the traumatic injury")
  patient: Reference;

  @doc("Reference to the Encounter representing the hospital admission for this traumatic injury")
  encounter: Reference;

  @doc("Date and time the injury occurred")
  injuryDate: utcDateTime;

  @doc("External cause of the injury — injury mechanism (ICD-10-CM external cause codes or SNOMED CT coded)")
  injuryMechanism: CodeableConcept;

  @doc("Intent classification for the injury")
  injuryIntent: InjuryIntent;

  @doc("Injury Severity Score (ISS) — anatomically-based scoring of overall injury severity (range 0–75)")
  injurySeverityScore?: int32;

  @doc("Glasgow Coma Scale (GCS) total score at ED presentation (range 3–15; lower scores indicate more severe neurological impairment)")
  glasgowComaScore?: int32;

  @doc("Revised Trauma Score (RTS) — physiological scoring of injury severity based on GCS, respiratory rate, and systolic BP")
  revisedTraumaScore?: float64;

  @doc("Patient disposition at the time of ED departure (e.g., 'Admitted', 'OR', 'ICU', 'Transferred', 'Expired in ED')")
  edDisposition?: string;

  @doc("Whether the patient was admitted to the intensive care unit at any time during this hospitalisation")
  icuAdmission?: boolean;

  @doc("Total number of days the patient required mechanical ventilator support during this hospitalisation")
  ventilatorDays?: int32;

  @doc("Total hospital length of stay in days from admission to discharge or death")
  hospitalLOS?: int32;

  @doc("Patient outcome at the time of discharge or death during this hospitalisation")
  outcome: TraumaOutcome;

  @doc("Current status of the trauma case in the abstraction and registry submission workflow")
  status: TraumaCaseStatus;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for syndromic surveillance report queries.")
model SyndromicSurveillanceSearchParams {
  @doc("Filter by facility reference ID") @query facility?: string;
  @doc("Filter by ED visit reference ID") @query edVisit?: string;
  @doc("Filter by syndrome category") @query syndromeCategory?: SyndromeCategory;
  @doc("Filter by report status") @query status?: SurveillanceStatus;
  @doc("Filter reports generated on or after this date") @query reportedFrom?: utcDateTime;
  @doc("Filter reports generated on or before this date") @query reportedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for Electronic Laboratory Report queries.")
model ELRSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by performing laboratory reference ID") @query performingLab?: string;
  @doc("Filter by result interpretation") @query resultInterpretation?: ELRResultInterpretation;
  @doc("Filter by reportable jurisdiction") @query reportableToJurisdiction?: string;
  @doc("Filter by ELR status") @query status?: SurveillanceStatus;
  @doc("Filter results dated on or after this date") @query resultFrom?: utcDateTime;
  @doc("Filter results dated on or before this date") @query resultTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for trauma registry case queries.")
model TraumaRegistryCaseSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by injury intent") @query injuryIntent?: InjuryIntent;
  @doc("Filter by patient outcome") @query outcome?: TraumaOutcome;
  @doc("Filter by case status") @query status?: TraumaCaseStatus;
  @doc("Filter by ICU admission") @query icuAdmission?: boolean;
  @doc("Filter injuries occurring on or after this date") @query injuryFrom?: utcDateTime;
  @doc("Filter injuries occurring on or before this date") @query injuryTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Syndromic surveillance management — generate, submit, and track ED-based syndromic surveillance messages to the CDC BioSense Platform / NSSP for real-time population health monitoring.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/public-health/surveillance/syndromic")
interface SyndromicSurveillanceManagement {
  @doc("Create a new syndromic surveillance report from an ED visit.")
  @operationId("createSyndromicSurveillanceReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createSyndromicSurveillanceReport(
    @body body: SyndromicSurveillanceReport,
  ): {
    @statusCode statusCode: 201;
    @body result: SyndromicSurveillanceReport;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a syndromic surveillance report by its logical ID.")
  @operationId("getSyndromicSurveillanceReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getSyndromicSurveillanceReport(
    @path @doc("SyndromicSurveillanceReport logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: SyndromicSurveillanceReport;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search syndromic surveillance reports by facility, syndrome category, status, or date range.")
  @operationId("searchSyndromicSurveillanceReports")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchSyndromicSurveillanceReports(
    ...SyndromicSurveillanceSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<SyndromicSurveillanceReport>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Submit a generated syndromic surveillance report to the NSSP BioSense Platform or state health department.")
  @operationId("submitSyndromicSurveillanceReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/submit")
  submitSyndromicSurveillanceReport(
    @path @doc("SyndromicSurveillanceReport logical ID") id: UUID,
    @body body: { note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: SyndromicSurveillanceReport;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Electronic Laboratory Reporting (ELR) management — create, submit, and track electronic laboratory reports of reportable conditions to public health jurisdictions per HL7 2.5.1 ELR specifications.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/public-health/surveillance/elr")
interface ELRManagement {
  @doc("Create a new Electronic Laboratory Report record.")
  @operationId("createElectronicLabReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createElectronicLabReport(
    @body body: ElectronicLabReport,
  ): {
    @statusCode statusCode: 201;
    @body result: ElectronicLabReport;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an Electronic Laboratory Report by its logical ID.")
  @operationId("getElectronicLabReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getElectronicLabReport(
    @path @doc("ElectronicLabReport logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ElectronicLabReport;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search ELR records by patient, lab, result interpretation, jurisdiction, status, or result date range.")
  @operationId("searchElectronicLabReports")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchElectronicLabReports(
    ...ELRSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ElectronicLabReport>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Submit an ELR to the target public health jurisdiction via the state ELR gateway.")
  @operationId("submitElectronicLabReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/submit")
  submitElectronicLabReport(
    @path @doc("ElectronicLabReport logical ID") id: UUID,
    @body body: { note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: ElectronicLabReport;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Trauma registry management — abstract, quality-review, and submit trauma registry cases to state and national registries (NTDB) per ACS COT data standards.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/public-health/surveillance/trauma-registry")
interface TraumaRegistryManagement {
  @doc("Create a new trauma registry case record.")
  @operationId("createTraumaRegistryCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createTraumaRegistryCase(
    @body body: TraumaRegistryCase,
  ): {
    @statusCode statusCode: 201;
    @body result: TraumaRegistryCase;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a trauma registry case by its logical ID.")
  @operationId("getTraumaRegistryCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getTraumaRegistryCase(
    @path @doc("TraumaRegistryCase logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: TraumaRegistryCase;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a trauma registry case record.")
  @operationId("updateTraumaRegistryCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateTraumaRegistryCase(
    @path @doc("TraumaRegistryCase logical ID") id: UUID,
    @body body: TraumaRegistryCase,
  ): {
    @statusCode statusCode: 200;
    @body result: TraumaRegistryCase;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a trauma registry case record.")
  @operationId("deleteTraumaRegistryCase")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteTraumaRegistryCase(
    @path @doc("TraumaRegistryCase logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search trauma registry cases by patient, injury intent, outcome, status, ICU admission, or injury date range.")
  @operationId("searchTraumaRegistryCases")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchTraumaRegistryCases(
    ...TraumaRegistryCaseSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<TraumaRegistryCase>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Submit an abstracted trauma case to the state or national (NTDB) trauma registry.")
  @operationId("submitTraumaRegistryCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/submit")
  submitTraumaRegistryCase(
    @path @doc("TraumaRegistryCase logical ID") id: UUID,
    @body body: { note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: TraumaRegistryCase;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
