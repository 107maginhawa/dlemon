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

namespace Healthcare.Clinical.MedicationRequests;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a medication request (prescription).
 */
enum MedicationRequestStatus {
  active,
  onHold,
  cancelled,
  completed,
  enteredInError,
  stopped,
  draft,
  `unknown`: "unknown",
}

/**
 * Describes the nature of the medication order.
 */
enum MedicationRequestIntent {
  proposal,
  plan,
  order,
  originalOrder,
  reflexOrder,
  fillerOrder,
  instanceOrder,
  option,
}

/**
 * Request priority shared across clinical order resources.
 */
enum RequestPriority {
  routine,
  urgent,
  asap,
  stat,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * Medication supply authorisation details.
 */
model MedicationDispenseRequest {
  /** This indicates the validity period of a prescription. */
  validityPeriod?: Period;

  /** Number of times the medication can be dispensed. */
  numberOfRepeatsAllowed?: int32;

  /** Amount of medication to supply per dispense. */
  quantity?: Quantity;

  /** Number of days' supply per dispense. */
  expectedSupplyDuration?: Quantity;

  /** Intended pharmacy for the dispense. */
  performer?: Reference;
}

/**
 * Indicates whether or how the medication can be substituted.
 */
model MedicationSubstitution {
  /** Indicates whether substitution can or should be performed. */
  allowed: boolean;

  /** Why substitution must or must not be performed. */
  reason?: CodeableConcept;
}

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * An order or request for both supply of the medication and the instructions
 * for administration of the medication to a patient.
 * Mapped to FHIR R4 MedicationRequest.
 */
model MedicationRequest extends HealthcareBaseEntity {
  /** Current lifecycle status of the medication request. */
  status: MedicationRequestStatus;

  /** Reason for the current status. */
  statusReason?: CodeableConcept;

  /** Whether the request is a proposal, plan, or original order. */
  intent: MedicationRequestIntent;

  /** Indicates the type of medication request (inpatient, outpatient, community, etc.). */
  category?: CodeableConcept[];

  /** Indicates how quickly the medication request should be addressed. */
  priority?: RequestPriority;

  /** True if the prescriber explicitly states the medication should not be administered. */
  doNotPerform?: boolean;

  /**
   * Identifies the medication being requested using a code (RxNorm, NDC).
   * Either medicationCode or medicationReference must be present.
   */
  medicationCode?: CodeableConcept;

  /**
   * Identifies the medication being requested via a reference to a Medication resource.
   * Either medicationCode or medicationReference must be present.
   */
  medicationReference?: Reference;

  /** Patient for whom the medication is being ordered. */
  subject: Reference;

  /** Encounter associated with the medication request. */
  encounter?: Reference;

  /** Date (and possibly time) when the prescription was initially written. */
  authoredOn: utcDateTime;

  /** Individual who initiated the request and has responsibility for its activation. */
  requester: Reference;

  /** Indicates the intended performer of the administration. */
  performer?: Reference;

  /** Person who entered the order on behalf of another individual. */
  recorder?: Reference;

  /** Coded reason or indication for ordering the medication. */
  reasonCode?: CodeableConcept[];

  /** Reference(s) to Condition or Observation explaining the reason. */
  reasonReference?: Reference[];

  /** Insurance plans, coverage extensions, pre-authorisations and/or pre-determinations. */
  insurance?: Reference[];

  /** Extra information about the prescription not in structured fields. */
  note?: Annotation[];

  /** Specific instructions for how the medication should be administered. */
  dosageInstruction: Dosage[];

  /** Medication supply authorisation. */
  dispenseRequest?: MedicationDispenseRequest;

  /** Indicates whether the medication can be substituted. */
  substitution?: MedicationSubstitution;

  /** An order/prescription that is being replaced by this request. */
  priorPrescription?: Reference;

  /** Intended pharmacy for fulfilment. */
  pharmacyReference?: Reference;
}

/**
 * Body for requesting a medication request status transition.
 */
model MedicationRequestStatusTransition {
  /** Target status. */
  status: MedicationRequestStatus;

  /** Coded reason for the transition (e.g. cancellation reason). */
  reason?: CodeableConcept;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/**
 * Query parameters for searching MedicationRequest resources.
 */
model MedicationRequestSearchParams {
  /** Filter by patient (subject) reference id. */
  patient?: string;

  /** Filter by request status. */
  status?: MedicationRequestStatus;

  /** Filter by medication code value (RxNorm or NDC). */
  medication?: string;

  /** Filter by requester reference id. */
  requester?: string;

  /** Page number (1-based). */
  page?: int32;

  /** Number of results per page. */
  pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD, status transition, and search operations for MedicationRequest resources.
 */
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface MedicationRequestService {
  /**
   * Create a new MedicationRequest (prescription).
   */
  @post
  @operationId("createMedicationRequest")
  create(
    @body body: MedicationRequest,
  ): {
    @statusCode statusCode: 201;
    @body medicationRequest: MedicationRequest;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a single MedicationRequest by id.
   */
  @get
  @operationId("getMedicationRequest")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body medicationRequest: MedicationRequest;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing MedicationRequest.
   */
  @put
  @operationId("updateMedicationRequest")
  @route("/{id}")
  update(
    @path id: string,
    @body body: MedicationRequest,
  ): {
    @statusCode statusCode: 200;
    @body medicationRequest: MedicationRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update a MedicationRequest.
   */
  @patch
  @operationId("patchMedicationRequest")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body medicationRequest: MedicationRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a MedicationRequest.
   */
  @delete
  @operationId("deleteMedicationRequest")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Transition a MedicationRequest to a new lifecycle status.
   */
  @post
  @operationId("transitionMedicationRequestStatus")
  @route("/{id}/status")
  transitionStatus(
    @path id: string,
    @body body: MedicationRequestStatusTransition,
  ): {
    @statusCode statusCode: 200;
    @body medicationRequest: MedicationRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search for MedicationRequest resources using filter parameters.
   */
  @get
  @operationId("searchMedicationRequests")
  @route("/search")
  search(
    ...MedicationRequestSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<MedicationRequest>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
