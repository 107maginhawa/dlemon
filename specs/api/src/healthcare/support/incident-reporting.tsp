import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";
import "../core/primitives.tsp";
import "../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Healthcare Quality and Safety — incident reporting and quality measure tracking
 * to support patient safety programmes, root cause analysis, and continuous
 * improvement initiatives.
 *
 * Designed to align with AHRQ Common Formats for Patient Safety Event Reporting
 * and CMS Quality Measure specifications.
 */
namespace Healthcare.Support.IncidentReporting;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Classification of the patient safety or quality incident type.")
enum IncidentType {
  @doc("An adverse event — a patient safety event that resulted in harm to a patient")
  adverseEvent,

  @doc("A near miss — a patient safety event that did not reach the patient (also called a 'close call')")
  nearMiss,

  @doc("A medication error — any preventable event that may cause or lead to inappropriate medication use or patient harm")
  medicationError,

  @doc("A patient fall — any unplanned descent to the floor or lower surface, with or without injury")
  fall,

  @doc("An infection control event — healthcare-associated infection or breach of infection prevention protocols")
  infectionControl,

  @doc("An equipment failure — device malfunction that caused or could have caused patient harm")
  equipmentFailure,

  @doc("A security breach — unauthorised access to patient areas, data, or information")
  securityBreach,

  @doc("A patient complaint — formal grievance or concern raised by a patient or family member")
  patientComplaint,

  @doc("Other incident type not captured by the above categories")
  other,
}

@doc("Clinical and operational severity of an incident, used to prioritise investigation and escalation.")
enum IncidentSeverity {
  @doc("Minor — no patient harm or minimal, temporary discomfort; no change in condition or level of care")
  minor,

  @doc("Moderate — temporary patient harm requiring intervention; increased length of stay or level of care")
  moderate,

  @doc("Major — permanent patient harm or significant harm requiring major intervention")
  major,

  @doc("Sentinel event — unexpected patient death or serious physical or psychological harm, or risk thereof, as defined by The Joint Commission")
  sentinel,
}

@doc("Workflow status of an incident report through the investigation and resolution lifecycle.")
enum IncidentStatus {
  @doc("The incident has been reported but not yet reviewed")
  reported,

  @doc("The report is under initial review to assess severity and assign ownership")
  underReview,

  @doc("A formal investigation is in progress (root cause analysis, involved party interviews)")
  investigating,

  @doc("An action plan has been developed and is being executed")
  actionPlan,

  @doc("All corrective actions have been completed and verified")
  resolved,

  @doc("The incident report has been closed and filed")
  closed,
}

@doc("Conceptual framework category for a quality measure, based on the Donabedian model.")
enum QualityMeasureType {
  @doc("Process measure — assesses whether evidence-based care processes were carried out (e.g., VTE prophylaxis rate)")
  process,

  @doc("Outcome measure — assesses the result of care for patients (e.g., 30-day readmission rate, mortality rate)")
  outcome,

  @doc("Structure measure — assesses the capacity of the healthcare setting (e.g., nurse-to-patient ratio, EHR adoption)")
  structure,

  @doc("Patient-reported outcome measure (PROM) — assesses patient experience and functional health status")
  patientReported,
}

@doc("Publication and operational status of a quality measure definition.")
enum QualityMeasureStatus {
  @doc("The measure is actively being reported and used for performance evaluation")
  active,

  @doc("The measure is not currently being reported (retired or paused)")
  inactive,

  @doc("The measure is in development and has not yet been validated for use")
  draft,
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("A patient safety incident report capturing the event details, investigation findings, and corrective actions taken. Supports the full incident management lifecycle from initial reporting through root cause analysis to verified resolution.")
model IncidentReport extends HealthcareBaseEntity {
  @doc("Classification of the incident type")
  type: IncidentType;

  @doc("Clinical and operational severity assessment of the incident")
  severity: IncidentSeverity;

  @doc("Current workflow status of the incident investigation and resolution")
  status: IncidentStatus;

  @doc("Reference to the Patient involved in the incident. May be absent for near-misses where no patient was at risk or for staff incidents.")
  patient?: Reference;

  @doc("Reference to the Encounter during which the incident occurred")
  encounter?: Reference;

  @doc("Reference to the Practitioner or staff member who submitted this report")
  reportedBy: Reference;

  @doc("Date and time the incident was reported to the safety system")
  reportedAt: utcDateTime;

  @doc("Detailed narrative description of what happened, including the sequence of events, what was observed, and who was involved")
  description: string;

  @doc("Reference to the Location where the incident occurred (e.g., patient room, medication room, car park)")
  location?: Reference;

  @doc("References to Practitioners or staff who witnessed the incident")
  witnesses?: Reference[];

  @doc("Factors that contributed to the incident (e.g., 'fatigue', 'communication breakdown', 'understaffing', 'lighting')")
  contributingFactors?: string[];

  @doc("Immediate actions taken at the time of the incident to protect the patient or prevent further harm")
  immediateActions?: string;

  @doc("Root cause analysis narrative identifying the fundamental systemic cause(s) of the incident")
  rootCauseAnalysis?: string;

  @doc("Corrective actions implemented or planned to address the root causes and prevent recurrence")
  correctiveActions?: string[];

  @doc("Preventive actions implemented across the broader organisation to reduce risk of similar incidents")
  preventiveActions?: string[];

  @doc("Date by which follow-up on the corrective actions is required")
  followUpDate?: utcDateTime;

  @doc("Notes from follow-up activities confirming that corrective actions have been completed and are effective")
  followUpNotes?: string;

  @doc("Whether this incident meets the criteria for mandatory external reporting (e.g., to the state health department, CMS, or accreditation body)")
  isReportableToAuthority?: boolean;

  @doc("Whether this incident has been formally reported to the relevant regulatory authority")
  reportedToAuthority?: boolean;

  @doc("Additional notes from the investigation team, risk management, or quality officer")
  note?: Annotation[];
}

@doc("A quality measure definition specifying what is measured, how it is calculated, and current performance data. Aligned with CMS eCQM specifications and FHIR Quality Measure (QM) IG.")
model QualityMeasure extends HealthcareBaseEntity {
  @doc("Human-readable name for the quality measure (e.g., 'Venous Thromboembolism Prophylaxis')")
  name: string;

  @doc("Formal coded identifier for this measure (e.g., CMS measure number, NQF number)")
  code?: CodeableConcept;

  @doc("Conceptual category of this quality measure")
  type: QualityMeasureType;

  @doc("Operational status — whether the measure is actively being reported")
  status: QualityMeasureStatus;

  @doc("Narrative description of what this measure evaluates and why it is important for patient care")
  description: string;

  @doc("Clinical or operational rationale for why this measure was selected and what improvement it drives")
  rationale?: string;

  @doc("Description of the numerator — the subset of patients who received the specified care process or achieved the outcome")
  numeratorDescription?: string;

  @doc("Description of the denominator — the eligible patient population against which performance is assessed")
  denominatorDescription?: string;

  @doc("The time period over which this measure is evaluated (e.g., calendar quarter, fiscal year)")
  measurePeriod?: Period;

  @doc("Current performance score for this measure (0.0–1.0 or absolute count depending on measure type)")
  score?: float64;

  @doc("The performance target or benchmark for this measure (e.g., 0.95 for 95% compliance)")
  target?: float64;

  @doc("Whether a higher score indicates improvement ('increase') or a lower score indicates improvement ('decrease')")
  improvementNotation?: string;

  @doc("Reference to the Practitioner or Organization responsible for this measure")
  author?: Reference;

  @doc("Notes from the quality improvement team (e.g., data quality caveats, contextual factors)")
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Search Parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for incident report queries.")
model IncidentSearchParams {
  @doc("Filter by patient reference ID")
  @query
  patient?: string;

  @doc("Filter by encounter reference ID")
  @query
  encounter?: string;

  @doc("Filter by incident type")
  @query
  type?: IncidentType;

  @doc("Filter by incident severity")
  @query
  severity?: IncidentSeverity;

  @doc("Filter by workflow status")
  @query
  status?: IncidentStatus;

  @doc("Filter by reporting practitioner reference ID")
  @query
  reportedBy?: string;

  @doc("Filter incidents reported at or after this date-time")
  @query
  reportedFrom?: utcDateTime;

  @doc("Filter incidents reported at or before this date-time")
  @query
  reportedTo?: utcDateTime;

  @doc("Filter to only externally reportable incidents")
  @query
  reportableOnly?: boolean;

  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Patient safety incident report management — submit, investigate, and resolve incidents using a structured workflow aligned with AHRQ Common Formats.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/quality/incidents")
interface IncidentReportManagement {
  @doc("Submit a new patient safety incident report. Automatically notifies the responsible quality officer and, if the severity is 'sentinel', triggers immediate escalation to risk management.")
  @operationId("createIncidentReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createIncidentReport(
    @body body: IncidentReport,
  ): {
    @statusCode statusCode: 201;
    @body result: IncidentReport;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single incident report by its logical ID.")
  @operationId("getIncidentReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getIncidentReport(
    @path @doc("IncidentReport logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: IncidentReport;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an incident report with investigation findings, root cause analysis, or corrective action details.")
  @operationId("updateIncidentReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateIncidentReport(
    @path @doc("IncidentReport logical ID") id: UUID,
    @body body: IncidentReport,
  ): {
    @statusCode statusCode: 200;
    @body result: IncidentReport;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an incident report. Permitted only for reports in 'reported' status that were submitted in error.")
  @operationId("deleteIncidentReport")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteIncidentReport(
    @path @doc("IncidentReport logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Transition an incident report to a new workflow status (e.g., reported → underReview → investigating → actionPlan → resolved → closed).")
  @operationId("transitionIncidentStatus")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/status")
  transitionIncidentStatus(
    @path @doc("IncidentReport logical ID") id: UUID,
    @body body: { status: IncidentStatus; note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: IncidentReport;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search incident reports using filter criteria. Supports filtering by patient, type, severity, status, date range, and reportability.")
  @operationId("searchIncidentReports")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchIncidentReports(
    ...IncidentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<IncidentReport>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Quality measure management — define, configure, and track clinical and operational performance measures aligned with CMS eCQM specifications.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/quality/measures")
interface QualityMeasureManagement {
  @doc("Create a new quality measure definition.")
  @operationId("createQualityMeasure")
  @extension("x-security-required-roles", #["admin"])
  @post
  createQualityMeasure(
    @body body: QualityMeasure,
  ): {
    @statusCode statusCode: 201;
    @body result: QualityMeasure;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a quality measure by its logical ID.")
  @operationId("getQualityMeasure")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getQualityMeasure(
    @path @doc("QualityMeasure logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: QualityMeasure;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a quality measure definition or its current performance score.")
  @operationId("updateQualityMeasure")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateQualityMeasure(
    @path @doc("QualityMeasure logical ID") id: UUID,
    @body body: QualityMeasure,
  ): {
    @statusCode statusCode: 200;
    @body result: QualityMeasure;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a quality measure definition. Permitted only for measures in 'draft' status.")
  @operationId("deleteQualityMeasure")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteQualityMeasure(
    @path @doc("QualityMeasure logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search quality measures by type, status, or measurement period.")
  @operationId("searchQualityMeasures")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchQualityMeasures(
    ...PaginationQuery,
    @doc("Filter by measure type") @query type?: QualityMeasureType,
    @doc("Filter by measure status") @query status?: QualityMeasureStatus,
    @doc("Filter by author reference ID") @query author?: string,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<QualityMeasure>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
