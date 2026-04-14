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

namespace Healthcare.Clinical.Conditions;

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * A formal staging or grading of a condition.
 */
model ConditionStage {
  /** A simple summary of the stage (e.g. "Stage 2"). */
  summary?: CodeableConcept;

  /** References to formal evidence (ClinicalImpression, DiagnosticReport, etc.). */
  assessment?: Reference[];

  /** Kind of staging (e.g. pathological, clinical). */
  type?: CodeableConcept;
}

/**
 * Supporting evidence for the condition.
 */
model ConditionEvidence {
  /** Manifestation or symptom coded. */
  code?: CodeableConcept[];

  /** References to supporting information (Observation, etc.). */
  detail?: Reference[];
}

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * A clinical condition, problem, diagnosis, or other event that is of clinical
 * concern to a patient.  Mapped to FHIR R4 Condition.
 */
model Condition extends HealthcareBaseEntity {
  /**
   * Clinical status of the condition (active, recurrence, relapse, inactive,
   * remission, resolved).
   */
  clinicalStatus: CodeableConcept;

  /**
   * Verification status (unconfirmed, provisional, differential, confirmed,
   * refuted, entered-in-error).
   */
  verificationStatus: CodeableConcept;

  /**
   * Category of the condition.
   * Common values: problem-list-item, encounter-diagnosis, health-concern.
   */
  category: CodeableConcept[];

  /** Subjective severity of the condition (mild, moderate, severe). */
  severity?: CodeableConcept;

  /** Identification of the condition (ICD-10, SNOMED). */
  code: CodeableConcept;

  /** Anatomical location affected. */
  bodySite?: CodeableConcept[];

  /** Reference to the Patient who has this condition. */
  subject: Reference;

  /** Encounter during which the condition was first asserted. */
  encounter?: Reference;

  /** Estimated or actual date/time of onset. */
  onsetDateTime?: utcDateTime;

  /** Age of the patient at onset. */
  onsetAge?: Quantity;

  /** Free-text description of onset. */
  onsetString?: string;

  /** Date/time the condition abated. */
  abatementDateTime?: utcDateTime;

  /** Free-text description of abatement. */
  abatementString?: string;

  /** Date the condition was first recorded. */
  recordedDate?: utcDateTime;

  /** Who recorded the condition. */
  recorder?: Reference;

  /** Person who asserts this condition. */
  asserter?: Reference;

  /** Stage / grade of the condition. */
  stage?: ConditionStage[];

  /** Supporting evidence for the condition. */
  evidence?: ConditionEvidence[];

  /** Additional information about the condition. */
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/**
 * Query parameters for searching Condition resources.
 */
model ConditionSearchParams {
  /** Filter by patient (subject) reference id. */
  patient?: string;

  /** Filter by condition code (ICD-10 or SNOMED code value). */
  code?: string;

  /** Filter by clinical status code. */
  clinicalStatus?: string;

  /** Filter by category code (e.g. problem-list-item). */
  category?: string;

  /** Page number (1-based). */
  page?: int32;

  /** Number of results per page. */
  pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for Condition resources.
 */
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface ConditionService {
  /**
   * Create a new Condition.
   */
  @post
  @operationId("createCondition")
  create(
    @body body: Condition,
  ): {
    @statusCode statusCode: 201;
    @body condition: Condition;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a single Condition by id.
   */
  @get
  @operationId("getCondition")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body condition: Condition;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing Condition.
   */
  @put
  @operationId("updateCondition")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Condition,
  ): {
    @statusCode statusCode: 200;
    @body condition: Condition;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update a Condition.
   */
  @patch
  @operationId("patchCondition")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body condition: Condition;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a Condition by id.
   */
  @delete
  @operationId("deleteCondition")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search for Conditions using filter parameters.
   */
  @get
  @operationId("searchConditions")
  @route("/search")
  search(
    ...ConditionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Condition>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
