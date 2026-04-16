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
 * Healthcare Clinical Emergency Department — ED visit registration, triage assessment,
 * real-time tracking board, and operational metrics for emergency care workflows.
 */
namespace Healthcare.Clinical.Hospital.EmergencyDepartment;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The mode by which the patient arrived in the emergency department.")
enum ArrivalMode {
  @doc("Arrived by ambulance or emergency medical services")
  ambulance,

  @doc("Walked in without prior notice")
  walkIn,

  @doc("Transferred from another facility")
  transferIn,

  @doc("Escorted by law enforcement")
  policeEscort,

  @doc("An arrival mode not covered by other values")
  other,
}

@doc("Emergency severity index acuity level (ESI 1–5).")
enum AcuityLevel {
  @doc("Level 1 — Resuscitation: immediate life-threatening condition")
  resuscitation,

  @doc("Level 2 — Emergent: high-risk situation requiring rapid intervention")
  emergent,

  @doc("Level 3 — Urgent: stable but requires multiple resources")
  urgent,

  @doc("Level 4 — Less Urgent: requires one resource")
  lessUrgent,

  @doc("Level 5 — Non-Urgent: requires no immediate resources")
  nonUrgent,
}

@doc("The disposition assigned to a patient at the end of an ED visit.")
enum EDDisposition {
  @doc("The patient was admitted to an inpatient unit")
  admitted,

  @doc("The patient was discharged home")
  discharged,

  @doc("The patient was transferred to another facility")
  transferred,

  @doc("The patient left without being seen by a provider")
  lwbs,

  @doc("The patient left against medical advice")
  lama,

  @doc("The patient died in the emergency department")
  expired,

  @doc("The patient was placed in observation status")
  observation,
}

@doc("The current status of an ED visit.")
enum EDVisitStatus {
  @doc("The patient has been registered in the system")
  registered,

  @doc("The patient has been triaged by a nurse")
  triaged,

  @doc("The patient is actively being treated")
  inTreatment,

  @doc("Treatment is complete and a disposition is being determined")
  pendingDisposition,

  @doc("The patient has been discharged from the ED")
  discharged,

  @doc("The patient has been admitted to an inpatient unit")
  admitted,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A snapshot of an ED visit for display on the department tracking board.")
model EDBoard {
  @doc("Reference to the full EDVisit resource")
  edVisit: Reference;

  @doc("Reference to the patient")
  patient: Reference;

  @doc("The bed identifier assigned to the patient, if any")
  bed?: string;

  @doc("The current acuity level of the patient")
  acuity: AcuityLevel;

  @doc("The current ED visit status")
  status: EDVisitStatus;

  @doc("Calculated waiting time in minutes from arrival to provider assignment")
  waitTimeMinutes?: int32;

  @doc("The provider currently assigned to this patient")
  provider?: Reference;

  @doc("The patient's chief complaint")
  chiefComplaint: string;
}

@doc("Aggregate operational metrics for the emergency department over a given period.")
model EDMetrics {
  @doc("Average door-to-triage time in minutes")
  doorToTriageMinutes?: float64;

  @doc("Average door-to-provider time in minutes")
  doorToProviderMinutes?: float64;

  @doc("Average total length of stay in minutes")
  totalLengthOfStayMinutes?: float64;

  @doc("Rate of patients who left without being seen (proportion 0.0–1.0)")
  leftWithoutBeingSeenRate?: float64;

  @doc("Rate of ED patients subsequently admitted to inpatient (proportion 0.0–1.0)")
  admissionRate?: float64;

  @doc("The period over which these metrics were calculated")
  period: Period;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("An emergency department visit record tracking patient flow from arrival to disposition.")
model EDVisit extends HealthcareBaseEntity {
  @doc("The patient who presented to the ED")
  patient: Reference;

  @doc("The encounter associated with this ED visit")
  encounter: Reference;

  @doc("How the patient arrived in the ED")
  arrivalMode: ArrivalMode;

  @doc("The date and time the patient arrived in the ED")
  arrivalTime: utcDateTime;

  @doc("The date and time triage was completed")
  triageTime?: utcDateTime;

  @doc("The date and time a provider was first assigned to the patient")
  providerAssignedTime?: utcDateTime;

  @doc("The date and time a disposition decision was made")
  dispositionTime?: utcDateTime;

  @doc("The date and time the patient physically departed the ED")
  departureTime?: utcDateTime;

  @doc("The triage acuity level assigned to the patient")
  acuityLevel: AcuityLevel;

  @doc("The patient's primary reason for presenting to the ED")
  @maxLength(500)
  chiefComplaint: string;

  @doc("The nurse who performed the initial triage assessment")
  triageNurse?: Reference;

  @doc("The attending physician assigned to this patient")
  attendingProvider?: Reference;

  @doc("The disposition assigned at the conclusion of the visit")
  disposition?: EDDisposition;

  @doc("The bed location assigned to this patient in the ED")
  bed?: Reference;

  @doc("The current operational status of this visit")
  status: EDVisitStatus;
}

@doc("A structured nursing triage assessment performed on ED arrival.")
model TriageAssessment extends HealthcareBaseEntity {
  @doc("The ED visit this assessment belongs to")
  edVisit: Reference;

  @doc("The patient being assessed")
  patient: Reference;

  @doc("The clinician who performed the triage assessment")
  performer: Reference;

  @doc("The date and time the triage assessment was performed")
  performedAt: utcDateTime;

  @doc("The acuity level assigned based on this assessment")
  acuityLevel: AcuityLevel;

  @doc("The patient's chief complaint as recorded during triage")
  @maxLength(500)
  chiefComplaint: string;

  @doc("Patient-reported pain score (0–10)")
  @minValue(0)
  @maxValue(10)
  painScore?: int32;

  @doc("Reference to the vital signs observation collected during triage")
  vitalSigns?: Reference;

  @doc("Whether the patient's allergy history was reviewed during triage")
  allergiesReviewed: boolean;

  @doc("Whether the patient's current medications were reviewed during triage")
  medicationsReviewed: boolean;

  @doc("Whether isolation precautions are required for this patient")
  isolationRequired?: boolean;

  @doc("Whether the patient has been identified as a fall risk")
  fallRisk?: boolean;

  @doc("Additional free-text clinical notes from triage")
  @maxLength(2000)
  notes?: string;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for EDVisit resources.")
model EDVisitSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by encounter reference id")
  @query encounter?: string;

  @doc("Filter by visit status")
  @query status?: EDVisitStatus;

  @doc("Filter by acuity level")
  @query acuityLevel?: AcuityLevel;

  @doc("Filter by disposition")
  @query disposition?: EDDisposition;

  @doc("Filter by attending provider reference id")
  @query attendingProvider?: string;

  @doc("Filter visits with arrival on or after this date-time")
  @query arrivalFrom?: utcDateTime;

  @doc("Filter visits with arrival on or before this date-time")
  @query arrivalTo?: utcDateTime;

  ...PaginationQuery;
}

@doc("Search parameters for TriageAssessment resources.")
model TriageAssessmentSearchParams {
  @doc("Filter by ED visit reference id")
  @query edVisit?: string;

  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by performer reference id")
  @query performer?: string;

  @doc("Filter by acuity level")
  @query acuityLevel?: AcuityLevel;

  ...PaginationQuery;
}

@doc("Query parameters for retrieving ED metrics.")
model EDMetricsParams {
  @doc("Start of the period for metric calculation (ISO 8601)")
  @query periodStart: utcDateTime;

  @doc("End of the period for metric calculation (ISO 8601)")
  @query periodEnd: utcDateTime;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD, search, and status-transition operations for EDVisit resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface EDVisitManagement {
  @doc("Register a new ED visit.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createEDVisit")
  create(
    @body body: EDVisit,
  ): {
    @statusCode statusCode: 201;
    @body edVisit: EDVisit;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single EDVisit by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getEDVisit")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body edVisit: EDVisit;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing EDVisit record.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateEDVisit")
  @route("/{id}")
  update(
    @path id: string,
    @body body: EDVisit,
  ): {
    @statusCode statusCode: 200;
    @body edVisit: EDVisit;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update an EDVisit record (e.g., status transition, disposition assignment).")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchEDVisit")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body edVisit: EDVisit;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an EDVisit record by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteEDVisit")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for EDVisit resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchEDVisits")
  @route("/search")
  search(
    ...EDVisitSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<EDVisit>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for TriageAssessment resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface TriageManagement {
  @doc("Record a new triage assessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createTriageAssessment")
  create(
    @body body: TriageAssessment,
  ): {
    @statusCode statusCode: 201;
    @body triageAssessment: TriageAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single TriageAssessment by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getTriageAssessment")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body triageAssessment: TriageAssessment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing TriageAssessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateTriageAssessment")
  @route("/{id}")
  update(
    @path id: string,
    @body body: TriageAssessment,
  ): {
    @statusCode statusCode: 200;
    @body triageAssessment: TriageAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a TriageAssessment by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteTriageAssessment")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for TriageAssessment resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchTriageAssessments")
  @route("/search")
  search(
    ...TriageAssessmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<TriageAssessment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Real-time ED tracking board service.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface EDBoardService {
  @doc("Retrieve the current real-time ED tracking board showing all active patients.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getEDBoard")
  getBoard(): {
    @statusCode statusCode: 200;
    @body board: EDBoard[];
  } | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("ED operational metrics service.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface EDMetricsService {
  @doc("Retrieve aggregated ED operational metrics for the specified period.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getEDMetrics")
  getMetrics(
    ...EDMetricsParams,
  ): {
    @statusCode statusCode: 200;
    @body metrics: EDMetrics;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
