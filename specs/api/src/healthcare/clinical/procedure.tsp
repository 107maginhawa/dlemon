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
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

namespace Healthcare.Clinical.Procedures;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * The lifecycle status of a procedure.
 */
enum ProcedureStatus {
  preparation,
  inProgress,
  notDone,
  onHold,
  stopped,
  completed,
  enteredInError,
  `unknown`: "unknown",
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * An actor who performed (or participated in) the procedure.
 */
model ProcedurePerformer {
  /** Distinguishes the type of involvement of the performer in the procedure. */
  `function`?: CodeableConcept;

  /** Reference to the practitioner, device, or other actor. */
  actor: Reference;

  /** Organisation the performer was acting on behalf of. */
  onBehalfOf?: Reference;
}

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * An action that is or was performed on or for a patient.
 * Mapped to FHIR R4 Procedure.
 */
model Procedure extends HealthcareBaseEntity {
  /** Current lifecycle status of the procedure. */
  status: ProcedureStatus;

  /**
   * Captures the reason for the current state of the procedure.
   * Required when status is notDone or stopped.
   */
  statusReason?: CodeableConcept;

  /** Classification of the procedure (survey, education, surgical, etc.). */
  category?: CodeableConcept;

  /** The specific procedure that is performed (CPT, SNOMED). */
  code: CodeableConcept;

  /** Patient on whom the procedure was performed. */
  subject: Reference;

  /** Encounter this procedure was part of. */
  encounter?: Reference;

  /** Date and time the procedure was performed. */
  performedDateTime?: utcDateTime;

  /** Time period over which the procedure was performed. */
  performedPeriod?: Period;

  /** Individual who recorded the record and takes responsibility for its content. */
  recorder?: Reference;

  /** Individual who is making the claim that the procedure was performed. */
  asserter?: Reference;

  /** Limited to real performers involved in the procedure. */
  performer?: ProcedurePerformer[];

  /** Location where the procedure happened. */
  location?: Reference;

  /** Coded reason the procedure was performed. */
  reasonCode?: CodeableConcept[];

  /** Reference(s) to Condition or Observation explaining the procedure. */
  reasonReference?: Reference[];

  /** Detailed and structured anatomical location information. */
  bodySite?: CodeableConcept[];

  /** The outcome of the procedure — did it resolve the reasons for the procedure? */
  outcome?: CodeableConcept;

  /** References to any formal record of the procedure (DiagnosticReport, etc.). */
  report?: Reference[];

  /** Any complications that occurred during the procedure or in the immediate post-performance period. */
  complication?: CodeableConcept[];

  /** If the procedure required specific follow-up. */
  followUp?: CodeableConcept[];

  /** Any other notes and comments about the procedure. */
  note?: Annotation[];

  /** Identifies coded items that were used as part of the procedure. */
  usedCode?: CodeableConcept[];
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/**
 * Query parameters for searching Procedure resources.
 */
model ProcedureSearchParams {
  /** Filter by patient (subject) reference id. */
  patient?: string;

  /** Filter by procedure code value (CPT or SNOMED). */
  code?: string;

  /** Filter procedures performed at or after this date-time. */
  dateFrom?: utcDateTime;

  /** Filter procedures performed at or before this date-time. */
  dateTo?: utcDateTime;

  /** Filter by procedure status. */
  status?: ProcedureStatus;

  /** Page number (1-based). */
  page?: int32;

  /** Number of results per page. */
  pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for Procedure resources.
 */
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface ProcedureService {
  /**
   * Create a new Procedure record.
   */
  @post
  @operationId("createProcedure")
  create(
    @body body: Procedure,
  ): {
    @statusCode statusCode: 201;
    @body procedure: Procedure;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a single Procedure by id.
   */
  @get
  @operationId("getProcedure")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body procedure: Procedure;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing Procedure.
   */
  @put
  @operationId("updateProcedure")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Procedure,
  ): {
    @statusCode statusCode: 200;
    @body procedure: Procedure;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update a Procedure.
   */
  @patch
  @operationId("patchProcedure")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body procedure: Procedure;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a Procedure record.
   */
  @delete
  @operationId("deleteProcedure")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search for Procedure resources using filter parameters.
   */
  @get
  @operationId("searchProcedures")
  @route("/search")
  search(
    ...ProcedureSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Procedure>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
