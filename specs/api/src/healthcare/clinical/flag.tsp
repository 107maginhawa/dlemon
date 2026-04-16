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

namespace Healthcare.Clinical.Flags;

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * Prospective warnings about a patient, other subject, or location
 * that should be considered in the context of care.  Aligns with FHIR R4 Flag.
 */
model Flag extends HealthcareBaseEntity {
  /** Current lifecycle status of the flag. */
  status: FlagStatus;

  /**
   * Category of the flag — allows flags to be filtered and grouped
   * (e.g. clinical, behavioral, administrative, drug).
   */
  category?: CodeableConcept[];

  /** Coded representation of the flag (SNOMED-CT or local code). */
  code: CodeableConcept;

  /** Reference to the patient (or other subject) the flag is about. */
  subject: Reference;

  /** Period during which the flag is active. */
  period?: Period;

  /** Clinical encounter during which the flag was active. */
  encounter?: Reference;

  /** Practitioner, device, or organization that created the flag. */
  author?: Reference;

  /** Urgency or importance of the flag. */
  priority?: FlagPriority;

  /** Free-text description providing more context about the flag. */
  description?: string;

  /** Recommended action or mitigation strategy for this flag. */
  mitigation?: string;
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

/**
 * Payload for creating a new Flag record.
 */
model FlagCreateRequest {
  ...OmitProperties<Flag, "id" | "meta" | "createdAt" | "updatedAt">;
}

/**
 * Query parameters for searching Flag resources.
 */
model FlagSearchParams {
  /** Filter by patient (subject) reference identifier. */
  patientId?: string;

  /** Filter by lifecycle status. */
  status?: FlagStatus;

  /** Filter by category code. */
  category?: string;

  /** Filter by priority level. */
  priority?: FlagPriority;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for Flag resources.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Clinical")
interface FlagManagement {
  /**
   * Create a new flag record.
   * @param body Flag creation payload.
   * @returns The newly created flag record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createFlag")
  create(@body body: FlagCreateRequest): {
    @statusCode statusCode: 201;
    @body flag: Flag;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a flag by its unique identifier.
   * @param id The flag identifier.
   * @returns The requested flag record.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @get
  @operationId("getFlag")
  @route("/{id}")
  read(@path id: string): {
    @statusCode statusCode: 200;
    @body flag: Flag;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing flag record.
   * @param id The flag identifier.
   * @param body Updated flag payload.
   * @returns The updated flag record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateFlag")
  @route("/{id}")
  update(@path id: string, @body body: FlagCreateRequest): {
    @statusCode statusCode: 200;
    @body flag: Flag;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update a flag record.
   * @param id The flag identifier.
   * @param body Fields to update.
   * @returns The updated flag record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchFlag")
  @route("/{id}")
  patch(@path id: string, @body body: Record<unknown>): {
    @statusCode statusCode: 200;
    @body flag: Flag;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a flag record.
   * @param id The flag identifier.
   */
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteFlag")
  @route("/{id}")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search flags by patient, status, category, or priority.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching flag records.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchFlags")
  @route("/search")
  search(...FlagSearchParams): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Flag>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
