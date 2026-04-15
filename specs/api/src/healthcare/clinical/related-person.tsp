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

namespace Healthcare.Clinical.RelatedPersons;

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * A language that a related person can use to communicate with a patient or
 * care team, and whether it is preferred.
 */
model RelatedPersonCommunication {
  /** Language code (e.g. en, es, fr — BCP-47 / FHIR language codes). */
  language: CodeableConcept;

  /** Whether this is the person's preferred language for communication. */
  preferred?: boolean;
}

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * Information about a person that is involved in the care for a patient,
 * but who is not the target of healthcare, nor has a formal responsibility
 * in the care process.  Aligns with FHIR R4 RelatedPerson.
 */
model RelatedPerson extends HealthcareBaseEntity {
  /** Whether this related person's record is in active use. */
  active: boolean;

  /** Reference to the patient this person is related to. */
  patient: Reference;

  /**
   * The nature of the relationship between the patient and the related person
   * (e.g. spouse, parent, guardian).
   */
  relationship: CodeableConcept[];

  /** Name(s) associated with the related person. */
  name?: HumanName[];

  /** Contact details for the related person (phone, email, etc.). */
  telecom?: ContactPoint[];

  /** Administrative gender of the related person. */
  gender?: AdministrativeGender;

  /** Date of birth of the related person. */
  birthDate?: plainDate;

  /** Address(es) of the related person. */
  address?: Address[];

  /** Image(s) of the related person. */
  photo?: Attachment[];

  /** Period during which this related person's relationship to the patient is or was active. */
  period?: Period;

  /** Languages the related person is able to use to communicate with the patient. */
  communication?: RelatedPersonCommunication[];
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

/**
 * Payload for creating a new RelatedPerson record.
 */
model RelatedPersonCreateRequest {
  ...OmitProperties<RelatedPerson, "id" | "meta" | "createdAt" | "updatedAt">;
}

/**
 * Query parameters for searching RelatedPerson resources.
 */
model RelatedPersonSearchParams {
  /** Filter by the patient reference identifier. */
  patientId?: string;

  /** Filter by relationship code (e.g. FHIR v3 RoleCode value). */
  relationship?: string;

  /** Filter by name — family or given name partial match. */
  name?: string;

  /** Filter by active status. */
  active?: boolean;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for RelatedPerson resources.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Clinical")
interface RelatedPersonManagement {
  /**
   * Create a new related person record.
   * @param body Related person creation payload.
   * @returns The newly created related person record.
   */
  @post
  @operationId("createRelatedPerson")
  create(@body body: RelatedPersonCreateRequest): {
    @statusCode statusCode: 201;
    @body relatedPerson: RelatedPerson;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a related person by its unique identifier.
   * @param id The related person identifier.
   * @returns The requested related person record.
   */
  @get
  @operationId("getRelatedPerson")
  @route("/{id}")
  read(@path id: string): {
    @statusCode statusCode: 200;
    @body relatedPerson: RelatedPerson;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing related person record.
   * @param id The related person identifier.
   * @param body Updated related person payload.
   * @returns The updated related person record.
   */
  @put
  @operationId("updateRelatedPerson")
  @route("/{id}")
  update(@path id: string, @body body: RelatedPersonCreateRequest): {
    @statusCode statusCode: 200;
    @body relatedPerson: RelatedPerson;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update a related person record.
   * @param id The related person identifier.
   * @param body Fields to update.
   * @returns The updated related person record.
   */
  @patch
  @operationId("patchRelatedPerson")
  @route("/{id}")
  patch(@path id: string, @body body: Record<unknown>): {
    @statusCode statusCode: 200;
    @body relatedPerson: RelatedPerson;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a related person record.
   * @param id The related person identifier.
   */
  @delete
  @operationId("deleteRelatedPerson")
  @route("/{id}")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search related persons by patient, relationship type, or name.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching related person records.
   */
  @get
  @operationId("searchRelatedPersons")
  @route("/search")
  search(...RelatedPersonSearchParams): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<RelatedPerson>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
