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

namespace Healthcare.Clinical.Immunizations;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Indicates the current status of the immunization event.
 */
enum ImmunizationStatus {
  completed,
  enteredInError,
  notDone,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * An actor who performed (or participated in) the immunization event.
 */
model ImmunizationPerformer {
  /** Describes the type of performance (e.g. ordering provider, administering provider). */
  `function`?: CodeableConcept;

  /** Reference to the practitioner or organisation that performed the action. */
  actor: Reference;
}

/**
 * Information about the protocol under which the vaccine was administered.
 */
model ImmunizationProtocol {
  /** Name of the series. */
  series?: string;

  /** Indicates the authority who published the protocol. */
  authority?: Reference;

  /** The vaccine preventable disease the dose is being administered against. */
  targetDisease?: CodeableConcept[];

  /** Nominal position in a series (1-based). */
  doseNumber: int32;

  /** Recommended number of doses for immunity. */
  seriesDoses?: int32;
}

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * Describes the event of a patient being administered a vaccine or a record of an
 * immunization as reported by a patient, a clinician, or another party.
 * Mapped to FHIR R4 Immunization.
 */
model Immunization extends HealthcareBaseEntity {
  /** Indicates the current status of the immunization event. */
  status: ImmunizationStatus;

  /** Reason why a vaccine was not administered. */
  statusReason?: CodeableConcept;

  /** Vaccine product administered (CVX code). */
  vaccineCode: CodeableConcept;

  /** Reference to the patient who received the vaccine. */
  patient: Reference;

  /** Encounter during which the vaccine was administered. */
  encounter?: Reference;

  /** Date and time when the vaccine was administered. */
  occurrenceDateTime: utcDateTime;

  /** Date the occurrence of the immunization was first captured in the subject's record. */
  recorded?: utcDateTime;

  /**
   * Indicates whether the data contained in the resource was captured by
   * the individual/organisation which was responsible for the administration
   * of the vaccine.
   */
  primarySource: boolean;

  /** The source of the data when the report of the immunization event is not based on information from the person who administered the vaccine. */
  reportOrigin?: CodeableConcept;

  /** Location where vaccine was administered. */
  location?: Reference;

  /** Reference to the manufacturer of the vaccine. */
  manufacturer?: Reference;

  /** Lot number of the vaccine product. */
  lotNumber?: string;

  /** Date vaccine batch expires. */
  expirationDate?: plainDate;

  /** Body site where vaccine was administered. */
  site?: CodeableConcept;

  /** Path by which the vaccine product is taken into the body. */
  route?: CodeableConcept;

  /** Amount of vaccine administered. */
  doseQuantity?: Quantity;

  /** Indicates who performed the immunization event. */
  performer?: ImmunizationPerformer[];

  /** Extra information about the immunization that is not conveyed by the other attributes. */
  note?: Annotation[];

  /** Coded reason why the vaccine was administered. */
  reasonCode?: CodeableConcept[];

  /** Indication if a dose is considered to be subpotent. */
  isSubpotent?: boolean;

  /** The protocol applied for the immunization event. */
  protocolApplied?: ImmunizationProtocol[];
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/**
 * Query parameters for searching Immunization resources.
 */
model ImmunizationSearchParams {
  /** Filter by patient reference id. */
  patient?: string;

  /** Filter by vaccine code (CVX code value). */
  vaccineCode?: string;

  /** Filter immunizations with occurrence at or after this date-time. */
  dateFrom?: utcDateTime;

  /** Filter immunizations with occurrence at or before this date-time. */
  dateTo?: utcDateTime;

  /** Filter by immunization status. */
  status?: ImmunizationStatus;

  /** Page number (1-based). */
  page?: int32;

  /** Number of results per page. */
  pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for Immunization resources.
 */
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface ImmunizationService {
  /**
   * Create a new Immunization record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createImmunization")
  create(
    @body body: Immunization,
  ): {
    @statusCode statusCode: 201;
    @body immunization: Immunization;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a single Immunization by id.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @get
  @operationId("getImmunization")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body immunization: Immunization;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing Immunization.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateImmunization")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Immunization,
  ): {
    @statusCode statusCode: 200;
    @body immunization: Immunization;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update an Immunization.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchImmunization")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body immunization: Immunization;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an Immunization record.
   */
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteImmunization")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search for Immunization resources using filter parameters.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchImmunizations")
  @route("/search")
  search(
    ...ImmunizationSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Immunization>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
