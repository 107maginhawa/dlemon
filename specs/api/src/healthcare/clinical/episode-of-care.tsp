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

namespace Healthcare.Clinical.EpisodesOfCare;

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * A record of the history of statuses that an episode of care has passed through.
 */
model EpisodeOfCareStatusHistory {
  /** The status value for this status history entry. */
  status: EpisodeOfCareStatus;

  /** The period during which the episode was in this status. */
  period: Period;
}

/**
 * A condition that is linked to the episode of care and the role it plays.
 */
model EpisodeOfCareDiagnosis {
  /** Reference to a Condition that is relevant to the episode of care. */
  condition: Reference;

  /**
   * Role that this diagnosis has within the episode of care
   * (e.g. CC: chief-complaint, billing diagnosis, AD: admission diagnosis).
   */
  role?: CodeableConcept;

  /** Ranking of the diagnosis (for each role type). */
  rank?: int32;
}

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * An association between a patient and an organization/healthcare provider(s)
 * during which time encounters may occur.  Aligns with FHIR R4 EpisodeOfCare.
 */
model EpisodeOfCare extends HealthcareBaseEntity {
  /** Current lifecycle status of the episode of care. */
  status: EpisodeOfCareStatus;

  /** History of statuses that the episode has been through, in order. */
  statusHistory?: EpisodeOfCareStatusHistory[];

  /** Classification of the episode (e.g. haematology, HIV, mental-health). */
  type?: CodeableConcept[];

  /** Diagnoses relevant to this episode of care. */
  diagnosis?: EpisodeOfCareDiagnosis[];

  /** Reference to the patient who is the focus of this episode of care. */
  patient: Reference;

  /** Organization that has assumed the specific responsibilities for care during this episode. */
  managingOrganization?: Reference;

  /** Period that covers the start and end of the episode of care. */
  period?: Period;

  /** Referral request(s) that are fulfilled by this episode of care. */
  referralRequest?: Reference[];

  /** Care manager/practitioner responsible for this episode of care. */
  careManager?: Reference;

  /** Other practitioners/teams facilitating this episode of care. */
  team?: Reference[];

  /** Billing account(s) associated with this episode of care. */
  account?: Reference[];
}

// ---------------------------------------------------------------------------
// Status transition payload
// ---------------------------------------------------------------------------

/**
 * Payload for transitioning the status of an episode of care.
 */
model EpisodeOfCareStatusTransition {
  /** Target status for the episode of care. */
  status: EpisodeOfCareStatus;

  /** Reason for the status transition. */
  reason?: string;

  /** Date/time of the transition; defaults to the current server time when omitted. */
  transitionedAt?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

/**
 * Payload for creating a new EpisodeOfCare record.
 */
model EpisodeOfCareCreateRequest {
  ...OmitProperties<EpisodeOfCare, "id" | "meta" | "createdAt" | "updatedAt">;
}

/**
 * Query parameters for searching EpisodeOfCare resources.
 */
model EpisodeOfCareSearchParams {
  /** Filter by patient reference identifier. */
  patientId?: string;

  /** Filter by lifecycle status. */
  status?: EpisodeOfCareStatus;

  /** Filter by episode type code. */
  type?: string;

  /** Earliest date of the episode period start. */
  dateFrom?: plainDate;

  /** Latest date of the episode period end. */
  dateTo?: plainDate;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD, status-transition, and search operations for EpisodeOfCare resources.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Clinical")
interface EpisodeOfCareManagement {
  /**
   * Create a new episode of care record.
   * @param body Episode of care creation payload.
   * @returns The newly created episode of care record.
   */
  @post
  @operationId("createEpisodeOfCare")
  create(@body body: EpisodeOfCareCreateRequest): {
    @statusCode statusCode: 201;
    @body episodeOfCare: EpisodeOfCare;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an episode of care by its unique identifier.
   * @param id The episode of care identifier.
   * @returns The requested episode of care record.
   */
  @get
  @operationId("getEpisodeOfCare")
  @route("/{id}")
  read(@path id: string): {
    @statusCode statusCode: 200;
    @body episodeOfCare: EpisodeOfCare;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing episode of care record.
   * @param id The episode of care identifier.
   * @param body Updated episode of care payload.
   * @returns The updated episode of care record.
   */
  @put
  @operationId("updateEpisodeOfCare")
  @route("/{id}")
  update(@path id: string, @body body: EpisodeOfCareCreateRequest): {
    @statusCode statusCode: 200;
    @body episodeOfCare: EpisodeOfCare;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update an episode of care record.
   * @param id The episode of care identifier.
   * @param body Fields to update.
   * @returns The updated episode of care record.
   */
  @patch
  @operationId("patchEpisodeOfCare")
  @route("/{id}")
  patch(@path id: string, @body body: Record<unknown>): {
    @statusCode statusCode: 200;
    @body episodeOfCare: EpisodeOfCare;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an episode of care record.
   * @param id The episode of care identifier.
   */
  @delete
  @operationId("deleteEpisodeOfCare")
  @route("/{id}")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Transition the lifecycle status of an episode of care.
   * @param id The episode of care identifier.
   * @param body Status transition payload.
   * @returns The updated episode of care record reflecting the new status.
   */
  @post
  @operationId("transitionEpisodeOfCareStatus")
  @route("/{id}/status")
  transitionStatus(@path id: string, @body body: EpisodeOfCareStatusTransition): {
    @statusCode statusCode: 200;
    @body episodeOfCare: EpisodeOfCare;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search episodes of care by patient, status, type, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching episode of care records.
   */
  @get
  @operationId("searchEpisodesOfCare")
  @route("/search")
  search(...EpisodeOfCareSearchParams): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<EpisodeOfCare>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
