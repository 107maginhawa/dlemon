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

namespace Healthcare.Clinical.Allergies;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Identification of the underlying physiological mechanism for a reaction risk.
 */
enum AllergyType {
  /** A propensity for hypersensitive reaction(s) to a substance. */
  allergy,
  /** A propensity for adverse reaction(s) that is not allergy or unknown. */
  intolerance,
}

/**
 * Category of the identified substance associated with allergies or intolerances.
 */
enum AllergyCategory {
  food,
  medication,
  environment,
  biologic,
}

/**
 * Estimate of the potential clinical harm, or seriousness, of a reaction.
 */
enum AllergyCriticality {
  low,
  high,
  unableToAssess,
}

/**
 * Clinical assessment of the severity of a reaction event as a whole.
 */
enum ReactionSeverity {
  mild,
  moderate,
  severe,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * Details about an adverse reaction event linked to exposure to a substance.
 */
model AllergyReaction {
  /** Specific substance (or pharmaceutical product) considered to be responsible. */
  substance?: CodeableConcept;

  /**
   * Clinical symptoms/signs associated with the event.
   * Must be coded (SNOMED CT).
   */
  manifestation: CodeableConcept[];

  /** Text description of the reaction as a whole. */
  description?: string;

  /** Record of the date and/or time of the onset of the reaction. */
  onset?: utcDateTime;

  /** Clinical assessment of the severity of the reaction. */
  severity?: ReactionSeverity;

  /** Identification of the route by which the subject was exposed to the substance. */
  exposureRoute?: CodeableConcept;

  /** Additional text about the adverse reaction event not captured elsewhere. */
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * Risk of harmful or undesirable physiological response which is unique to an
 * individual and associated with exposure to a substance.
 * Mapped to FHIR R4 AllergyIntolerance.
 */
model AllergyIntolerance extends HealthcareBaseEntity {
  /**
   * The clinical status of the allergy or intolerance.
   * Values: active, inactive, resolved.
   */
  clinicalStatus: CodeableConcept;

  /**
   * Assertion about certainty associated with the propensity.
   * Values: unconfirmed, confirmed, refuted, entered-in-error.
   */
  verificationStatus: CodeableConcept;

  /** Identification of the underlying physiological mechanism. */
  type?: AllergyType;

  /** Category of the identified substance. */
  category?: AllergyCategory[];

  /** Estimate of the potential clinical harm of a reaction. */
  criticality?: AllergyCriticality;

  /** Code for an allergy or intolerance statement (SNOMED, RxNorm). */
  code: CodeableConcept;

  /** Reference to the patient who has the allergy or intolerance. */
  patient: Reference;

  /** Encounter when the allergy or intolerance was asserted. */
  encounter?: Reference;

  /** Estimated or actual date the allergy or intolerance was identified. */
  onsetDateTime?: utcDateTime;

  /** Date when the allergy or intolerance was recorded in the patient record. */
  recordedDate?: utcDateTime;

  /** Individual who recorded the record and takes responsibility for its content. */
  recorder?: Reference;

  /** Source of the information about the allergy. */
  asserter?: Reference;

  /** Represents the date and/or time of the last known occurrence of a reaction event. */
  lastOccurrence?: utcDateTime;

  /** Additional narrative about the propensity not captured elsewhere. */
  note?: Annotation[];

  /** Details about each adverse reaction event linked to exposure to the identified substance. */
  reaction?: AllergyReaction[];
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/**
 * Query parameters for searching AllergyIntolerance resources.
 */
model AllergySearchParams {
  /** Filter by patient reference id. */
  patient?: string;

  /** Filter by allergy/substance code value. */
  code?: string;

  /** Filter by allergy type (allergy | intolerance). */
  type?: AllergyType;

  /** Filter by category. */
  category?: AllergyCategory;

  /** Filter by criticality. */
  criticality?: AllergyCriticality;

  /** Page number (1-based). */
  page?: int32;

  /** Number of results per page. */
  pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for AllergyIntolerance resources.
 */
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface AllergyIntoleranceService {
  /**
   * Create a new AllergyIntolerance record.
   */
  @post
  @operationId("createAllergyIntolerance")
  create(
    @body body: AllergyIntolerance,
  ): {
    @statusCode statusCode: 201;
    @body allergy: AllergyIntolerance;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a single AllergyIntolerance by id.
   */
  @get
  @operationId("getAllergyIntolerance")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body allergy: AllergyIntolerance;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing AllergyIntolerance.
   */
  @put
  @operationId("updateAllergyIntolerance")
  @route("/{id}")
  update(
    @path id: string,
    @body body: AllergyIntolerance,
  ): {
    @statusCode statusCode: 200;
    @body allergy: AllergyIntolerance;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update an AllergyIntolerance.
   */
  @patch
  @operationId("patchAllergyIntolerance")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body allergy: AllergyIntolerance;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an AllergyIntolerance record.
   */
  @delete
  @operationId("deleteAllergyIntolerance")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search for AllergyIntolerance records using filter parameters.
   */
  @get
  @operationId("searchAllergyIntolerances")
  @route("/search")
  search(
    ...AllergySearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<AllergyIntolerance>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
