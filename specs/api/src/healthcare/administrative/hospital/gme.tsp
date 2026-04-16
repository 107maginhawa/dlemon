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
 * Graduate Medical Education (GME) module.
 *
 * Manages the full lifecycle of residency and fellowship training programs,
 * including program administration, resident tracking, rotation scheduling,
 * competency-based evaluations, and procedure logging. Supports ACGME
 * milestone reporting and duty hour compliance documentation.
 */
namespace Healthcare.Administrative.Hospital.GME;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Accreditation status of a residency or fellowship program granted by the accrediting body.")
enum AccreditationStatus {
  @doc("The program meets all accreditation requirements and holds full accreditation")
  fullAccreditation,

  @doc("The program is newly established and holds provisional accreditation pending a review cycle")
  provisionalAccreditation,

  @doc("The program has been issued a warning for non-compliance and must address deficiencies")
  warning,

  @doc("The program is on probation due to significant non-compliance — at risk of withdrawal")
  probation,

  @doc("Accreditation has been formally withdrawn — the program may not recruit new residents")
  withdrawn,
}

@doc("Current training status of a resident within a program.")
enum ResidentStatus {
  @doc("The resident is in good standing and actively training in the program")
  active,

  @doc("The resident is on an approved leave of absence (medical, parental, or personal)")
  leave,

  @doc("The resident is on probation due to performance or professionalism concerns")
  probation,

  @doc("The resident has successfully completed all program requirements")
  graduated,

  @doc("The resident has been involuntarily terminated from the program")
  dismissed,

  @doc("The resident has transferred to another program at the same or different institution")
  transferred,
}

@doc("Status of a rotation assignment within a residency program.")
enum RotationStatus {
  @doc("The rotation is scheduled but has not yet started")
  scheduled,

  @doc("The rotation is currently in progress")
  active,

  @doc("The rotation has been completed")
  completed,

  @doc("The rotation was cancelled before or during the assignment")
  cancelled,
}

@doc("Status of a resident evaluation form.")
enum EvaluationStatus {
  @doc("The evaluation has been started but not yet submitted")
  draft,

  @doc("The evaluation has been submitted by the evaluator")
  submitted,

  @doc("The evaluation has been reviewed by the program director or coordinator")
  reviewed,

  @doc("The resident has acknowledged receipt of the evaluation")
  acknowledged,
}

@doc("ACGME core competency domains assessed in resident evaluations.")
enum GMECompetency {
  @doc("Provision of compassionate, appropriate, and effective care for the treatment of health problems")
  patientCare,

  @doc("Understanding of biomedical, clinical, and social sciences and their application")
  medicalKnowledge,

  @doc("Use of evidence, quality improvement, and technology in patient care")
  practiceLearning,

  @doc("Effective communication and relationship skills with patients, families, and the health care team")
  interpersonalSkills,

  @doc("Adherence to ethical principles and sensitivity to diverse patient populations")
  professionalism,

  @doc("Awareness of and responsiveness to the larger context and system of health care")
  systemsPractice,
}

@doc("The resident's role in a logged procedure.")
enum ProcedureRole {
  @doc("The resident was the primary operator performing the procedure")
  primary,

  @doc("The resident assisted an attending or senior trainee performing the procedure")
  assistant,

  @doc("The resident observed the procedure for learning purposes without active participation")
  observer,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A scored assessment of a resident's performance in a single ACGME core competency domain.")
model CompetencyScore {
  @doc("ACGME core competency domain being assessed")
  competency: GMECompetency;

  @doc("Numeric score for this competency (scale defined by the program — typically 1-9 for milestones)")
  score: int32;

  @doc("Narrative comment supporting the score assigned to this competency")
  comment?: string;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A residency or fellowship training program registered at the institution, accredited by the relevant governing body.")
model ResidencyProgram extends HealthcareBaseEntity {
  @doc("Official name of the program (e.g., 'Internal Medicine Residency', 'Cardiology Fellowship')")
  name: string;

  @doc("Medical specialty of the program — coded using ACGME or specialty board terminology")
  specialty: CodeableConcept;

  @doc("Name of the accrediting body (e.g., 'ACGME', 'AOA', 'RCPSC')")
  accreditationBody?: string;

  @doc("Current accreditation status of this program")
  accreditationStatus: AccreditationStatus;

  @doc("Reference to the Practitioner serving as Program Director")
  programDirector: Reference;

  @doc("Reference to the Organization (hospital or health system) sponsoring this program")
  institution: Reference;

  @doc("Total duration of the program in years (e.g., 3 for internal medicine, 5 for general surgery)")
  duration: int32;

  @doc("Maximum number of residents allowed to be enrolled concurrently per accreditation approval")
  maxResidents: int32;

  @doc("Whether this program is currently active and accepting residents")
  active: boolean;
}

@doc("A resident or fellow enrolled in a training program, tracking their training level, dates, and current status.")
model Resident extends HealthcareBaseEntity {
  @doc("Reference to the Practitioner record for this resident")
  practitioner: Reference;

  @doc("Reference to the ResidencyProgram in which this resident is enrolled")
  program: Reference;

  @doc("Post-Graduate Year level (PGY-1 through PGY-8 for extended programs)")
  @minValue(1)
  @maxValue(8)
  pgyLevel: int32;

  @doc("Date the resident began training in this program")
  startDate: plainDate;

  @doc("Anticipated graduation or completion date")
  expectedEndDate: plainDate;

  @doc("Current training status of this resident")
  status: ResidentStatus;

  @doc("Reference to the supervising attending physician primarily responsible for this resident")
  supervisor?: Reference;
}

@doc("A rotation assignment scheduling a resident to a specific department for a defined training period.")
model RotationAssignment extends HealthcareBaseEntity {
  @doc("Reference to the Resident being assigned to this rotation")
  resident: Reference;

  @doc("Reference to the Department providing the rotation experience")
  department: Reference;

  @doc("Date the rotation begins")
  startDate: plainDate;

  @doc("Date the rotation ends")
  endDate: plainDate;

  @doc("Reference to the supervising attending physician for this rotation")
  supervisor: Reference;

  @doc("Date by which the rotation evaluation must be completed")
  evaluationDue?: plainDate;

  @doc("Current status of this rotation assignment")
  status: RotationStatus;
}

@doc("A competency-based evaluation of a resident's performance covering a rotation or training period.")
model ResidentEvaluation extends HealthcareBaseEntity {
  @doc("Reference to the Resident being evaluated")
  resident: Reference;

  @doc("Reference to the Practitioner or faculty member completing this evaluation")
  evaluator: Reference;

  @doc("Reference to the RotationAssignment this evaluation covers, if rotation-specific")
  rotation?: Reference;

  @doc("Training period covered by this evaluation")
  period: Period;

  @doc("Scored assessment for each ACGME competency domain")
  competencyScores: CompetencyScore[];

  @doc("Overall performance rating for the period (e.g., 1-5 scale defined by program policy)")
  overallRating?: int32;

  @doc("Narrative description of the resident's strengths during this period")
  strengths?: string;

  @doc("Narrative description of areas requiring improvement or development")
  areasForImprovement?: string;

  @doc("ACGME milestone level achieved at the time of this evaluation (1-5)")
  milestoneLevel?: int32;

  @doc("Current workflow status of this evaluation form")
  status: EvaluationStatus;
}

@doc("A procedure log entry documenting a specific clinical procedure performed or observed by a resident.")
model ProcedureLog extends HealthcareBaseEntity {
  @doc("Reference to the Resident who performed or observed this procedure")
  resident: Reference;

  @doc("Coded procedure type (CPT or institutional procedure code)")
  procedureCode: CodeableConcept;

  @doc("Date and time the procedure was performed")
  date: utcDateTime;

  @doc("Reference to the patient on whom the procedure was performed — may be omitted for simulation-based logging")
  patient?: Reference;

  @doc("Reference to the supervising attending physician present during the procedure")
  supervisingAttending: Reference;

  @doc("The resident's role in this procedure")
  role: ProcedureRole;

  @doc("Narrative description of case complexity or unusual features")
  complexity?: string;

  @doc("Narrative description of any complications encountered during the procedure")
  complications?: string;

  @doc("Whether this log entry has been verified by the supervising attending")
  verified: boolean;

  @doc("Reference to the Practitioner who verified this procedure log entry")
  verifiedBy?: Reference;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for residency programs.")
model ResidencyProgramSearchParams {
  @doc("Filter by accreditation status") @query accreditationStatus?: AccreditationStatus;
  @doc("Filter by program director reference ID") @query programDirector?: string;
  @doc("Filter by institution reference ID") @query institution?: string;
  @doc("Filter by active status") @query active?: boolean;
  @doc("Free-text search on program name") @query name?: string;
  ...OffsetPaginationParams;
}

@doc("Search parameters for residents.")
model ResidentSearchParams {
  @doc("Filter by program reference ID") @query program?: string;
  @doc("Filter by PGY level") @query pgyLevel?: int32;
  @doc("Filter by resident status") @query status?: ResidentStatus;
  @doc("Filter by supervisor reference ID") @query supervisor?: string;
  @doc("Filter by practitioner reference ID") @query practitioner?: string;
  ...OffsetPaginationParams;
}

@doc("Search parameters for rotation assignments.")
model RotationAssignmentSearchParams {
  @doc("Filter by resident reference ID") @query resident?: string;
  @doc("Filter by department reference ID") @query department?: string;
  @doc("Filter by supervisor reference ID") @query supervisor?: string;
  @doc("Filter by rotation status") @query status?: RotationStatus;
  @doc("Filter rotations starting on or after this date") @query startFrom?: plainDate;
  @doc("Filter rotations ending on or before this date") @query endTo?: plainDate;
  ...OffsetPaginationParams;
}

@doc("Search parameters for resident evaluations.")
model ResidentEvaluationSearchParams {
  @doc("Filter by resident reference ID") @query resident?: string;
  @doc("Filter by evaluator reference ID") @query evaluator?: string;
  @doc("Filter by rotation reference ID") @query rotation?: string;
  @doc("Filter by evaluation status") @query status?: EvaluationStatus;
  @doc("Filter by milestone level") @query milestoneLevel?: int32;
  ...OffsetPaginationParams;
}

@doc("Search parameters for procedure logs.")
model ProcedureLogSearchParams {
  @doc("Filter by resident reference ID") @query resident?: string;
  @doc("Filter by supervising attending reference ID") @query supervisingAttending?: string;
  @doc("Filter by procedure role") @query role?: ProcedureRole;
  @doc("Filter by verified status") @query verified?: boolean;
  @doc("Filter procedures performed on or after this date") @query dateFrom?: utcDateTime;
  @doc("Filter procedures performed on or before this date") @query dateTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Residency program management — administer ACGME-accredited programs including director assignment, capacity limits, and accreditation status.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
@route("/gme/programs")
interface ResidencyProgramManagement {
  @doc("Create a new residency or fellowship program.")
  @operationId("createResidencyProgram")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createResidencyProgram(
    @body body: ResidencyProgram,
  ): {
    @statusCode statusCode: 201;
    @body result: ResidencyProgram;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a residency program by its logical ID.")
  @operationId("getResidencyProgram")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getResidencyProgram(
    @path @doc("ResidencyProgram logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ResidencyProgram;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a residency program — director, accreditation status, capacity, or active flag.")
  @operationId("updateResidencyProgram")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateResidencyProgram(
    @path @doc("ResidencyProgram logical ID") id: UUID,
    @body body: ResidencyProgram,
  ): {
    @statusCode statusCode: 200;
    @body result: ResidencyProgram;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a residency program record.")
  @operationId("deleteResidencyProgram")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteResidencyProgram(
    @path @doc("ResidencyProgram logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search residency programs by accreditation status, institution, director, or active status.")
  @operationId("searchResidencyPrograms")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchResidencyPrograms(
    ...ResidencyProgramSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ResidencyProgram>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Resident management — enroll, track, and manage individual residents across programs and PGY levels.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
@route("/gme/residents")
interface ResidentManagement {
  @doc("Enroll a new resident in a program.")
  @operationId("createResident")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createResident(
    @body body: Resident,
  ): {
    @statusCode statusCode: 201;
    @body result: Resident;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a resident record by its logical ID.")
  @operationId("getResident")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getResident(
    @path @doc("Resident logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: Resident;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a resident record — PGY level, status, supervisor, or expected end date.")
  @operationId("updateResident")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateResident(
    @path @doc("Resident logical ID") id: UUID,
    @body body: Resident,
  ): {
    @statusCode statusCode: 200;
    @body result: Resident;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a resident enrollment record.")
  @operationId("deleteResident")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteResident(
    @path @doc("Resident logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search residents by program, PGY level, status, or supervisor.")
  @operationId("searchResidents")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchResidents(
    ...ResidentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Resident>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Rotation assignment management — schedule and track resident rotation assignments across departments.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
@route("/gme/rotations")
interface RotationAssignmentManagement {
  @doc("Create a new rotation assignment.")
  @operationId("createRotationAssignment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createRotationAssignment(
    @body body: RotationAssignment,
  ): {
    @statusCode statusCode: 201;
    @body result: RotationAssignment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a rotation assignment by its logical ID.")
  @operationId("getRotationAssignment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getRotationAssignment(
    @path @doc("RotationAssignment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: RotationAssignment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a rotation assignment — dates, supervisor, evaluation due date, or status.")
  @operationId("updateRotationAssignment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateRotationAssignment(
    @path @doc("RotationAssignment logical ID") id: UUID,
    @body body: RotationAssignment,
  ): {
    @statusCode statusCode: 200;
    @body result: RotationAssignment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a rotation assignment.")
  @operationId("deleteRotationAssignment")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteRotationAssignment(
    @path @doc("RotationAssignment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search rotation assignments by resident, department, supervisor, status, or date range.")
  @operationId("searchRotationAssignments")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchRotationAssignments(
    ...RotationAssignmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<RotationAssignment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Resident evaluation management — competency-based evaluations aligned to ACGME milestones, with submission and acknowledgment workflows.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
@route("/gme/evaluations")
interface ResidentEvaluationManagement {
  @doc("Create a new resident evaluation.")
  @operationId("createResidentEvaluation")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createResidentEvaluation(
    @body body: ResidentEvaluation,
  ): {
    @statusCode statusCode: 201;
    @body result: ResidentEvaluation;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a resident evaluation by its logical ID.")
  @operationId("getResidentEvaluation")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getResidentEvaluation(
    @path @doc("ResidentEvaluation logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ResidentEvaluation;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a resident evaluation — scores, narrative, or milestone level.")
  @operationId("updateResidentEvaluation")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateResidentEvaluation(
    @path @doc("ResidentEvaluation logical ID") id: UUID,
    @body body: ResidentEvaluation,
  ): {
    @statusCode statusCode: 200;
    @body result: ResidentEvaluation;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a resident evaluation.")
  @operationId("deleteResidentEvaluation")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteResidentEvaluation(
    @path @doc("ResidentEvaluation logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search resident evaluations by resident, evaluator, rotation, status, or milestone level.")
  @operationId("searchResidentEvaluations")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchResidentEvaluations(
    ...ResidentEvaluationSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ResidentEvaluation>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Submit a resident evaluation — transitions status from draft to submitted and notifies the resident.")
  @operationId("submitResidentEvaluation")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/submit")
  submitResidentEvaluation(
    @path @doc("ResidentEvaluation logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ResidentEvaluation;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Procedure log management — track resident procedure volume and competency with attending verification.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
@route("/gme/procedure-logs")
interface ProcedureLogManagement {
  @doc("Create a new procedure log entry.")
  @operationId("createProcedureLog")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createProcedureLog(
    @body body: ProcedureLog,
  ): {
    @statusCode statusCode: 201;
    @body result: ProcedureLog;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a procedure log entry by its logical ID.")
  @operationId("getProcedureLog")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getProcedureLog(
    @path @doc("ProcedureLog logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ProcedureLog;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a procedure log entry — complexity, complications, or verification.")
  @operationId("updateProcedureLog")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateProcedureLog(
    @path @doc("ProcedureLog logical ID") id: UUID,
    @body body: ProcedureLog,
  ): {
    @statusCode statusCode: 200;
    @body result: ProcedureLog;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a procedure log entry.")
  @operationId("deleteProcedureLog")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteProcedureLog(
    @path @doc("ProcedureLog logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search procedure logs by resident, attending, role, verification status, or date range.")
  @operationId("searchProcedureLogs")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchProcedureLogs(
    ...ProcedureLogSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ProcedureLog>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Verify a procedure log entry — attending confirms the resident's participation and role.")
  @operationId("verifyProcedureLog")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/verify")
  verifyProcedureLog(
    @path @doc("ProcedureLog logical ID") id: UUID,
    @doc("Reference ID of the verifying attending practitioner") @query verifiedBy: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ProcedureLog;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
