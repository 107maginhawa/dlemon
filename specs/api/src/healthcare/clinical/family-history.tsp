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

namespace Healthcare.Clinical.FamilyHistory;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * A code that identifies the status of the family history record.
 */
enum FamilyHistoryStatus {
  /** Some health information is known and captured, but not complete. */
  partial,
  /** All available related health information is captured as of the date (and possibly time) when the family member history was taken. */
  completed,
  /** This instance should not have been part of this patient's medical record. */
  enteredInError,
  /** Health information for this individual is unavailable/unknown. */
  healthUnknown,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * A condition that the related person had.
 */
model FamilyMemberCondition {
  /** The actual condition specified. */
  code: CodeableConcept;

  /**
   * Indicates what happened following the condition.
   * If the condition resulted in death, deceased date is captured on the relation.
   */
  outcome?: CodeableConcept;

  /** Either the age of onset, as a period prior to the subject's birth, or an approximate date. */
  onsetAge?: Quantity;

  /** Free-text onset description. */
  onsetString?: string;

  /** An area where general notes can be placed about this specific condition. */
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * Significant health conditions for a person related to the patient relevant in the
 * context of care for the patient.
 * Mapped to FHIR R4 FamilyMemberHistory.
 */
model FamilyMemberHistory extends HealthcareBaseEntity {
  /** A code specifying the status of the record of the family history of a specific family member. */
  status: FamilyHistoryStatus;

  /** Patient who this history is about. */
  patient: Reference;

  /** The date (and possibly time) when the family member history was recorded or last updated. */
  date?: utcDateTime;

  /**
   * This will either be a name or a description; e.g. "Aunt Susan", "my aunt",
   * "unknown grandmother" — used to identify the family member.
   */
  name?: string;

  /** The type of relationship this person has to the patient. */
  relationship: CodeableConcept;

  /** The birth sex of the family member. */
  sex?: CodeableConcept;

  /** The actual or approximate date of birth of the relative. */
  bornDate?: plainDate;

  /** The age of the relative at the time the family member history is recorded. */
  ageAge?: Quantity;

  /** The age of the relative at the time the family member history is recorded, as free text. */
  ageString?: string;

  /** Deceased flag or deceased date for the family member. */
  deceasedBoolean?: boolean;

  /** Deceased date for the family member. */
  deceasedDate?: plainDate;

  /** The age of the relative at the time of death. */
  deceasedAge?: Quantity;

  /** Describes why the family member history occurred in coded or textual form. */
  reasonCode?: CodeableConcept[];

  /** Pertinent notes/comments about the family member history. */
  note?: Annotation[];

  /** The significant conditions (or condition) that the family member had. */
  condition?: FamilyMemberCondition[];
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/**
 * Query parameters for searching FamilyMemberHistory resources.
 */
model FamilyHistorySearchParams {
  /** Filter by patient reference id. */
  patient?: string;

  /** Filter by relationship code value. */
  relationship?: string;

  /** Filter by condition code value. */
  condition?: string;

  /** Page number (1-based). */
  page?: int32;

  /** Number of results per page. */
  pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for FamilyMemberHistory resources.
 */
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface FamilyMemberHistoryService {
  /**
   * Create a new FamilyMemberHistory record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createFamilyMemberHistory")
  create(
    @body body: FamilyMemberHistory,
  ): {
    @statusCode statusCode: 201;
    @body familyHistory: FamilyMemberHistory;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a single FamilyMemberHistory by id.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @get
  @operationId("getFamilyMemberHistory")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body familyHistory: FamilyMemberHistory;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing FamilyMemberHistory.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateFamilyMemberHistory")
  @route("/{id}")
  update(
    @path id: string,
    @body body: FamilyMemberHistory,
  ): {
    @statusCode statusCode: 200;
    @body familyHistory: FamilyMemberHistory;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update a FamilyMemberHistory.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchFamilyMemberHistory")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body familyHistory: FamilyMemberHistory;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a FamilyMemberHistory record.
   */
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteFamilyMemberHistory")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search for FamilyMemberHistory resources using filter parameters.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchFamilyMemberHistories")
  @route("/search")
  search(
    ...FamilyHistorySearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<FamilyMemberHistory>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
