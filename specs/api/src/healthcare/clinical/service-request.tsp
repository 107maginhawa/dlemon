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

namespace Healthcare.Clinical.ServiceRequests;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a service request (order).
 */
enum ServiceRequestStatus {
  draft,
  active,
  onHold,
  revoked,
  completed,
  enteredInError,
  `unknown`: "unknown",
}

/**
 * Indicates the level of authority / intentionality associated with the service request.
 */
enum ServiceRequestIntent {
  proposal,
  plan,
  directive,
  order,
  originalOrder,
  reflexOrder,
  fillerOrder,
  instanceOrder,
  option,
}

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * A record of a request for service such as diagnostic investigations,
 * treatments, or operations to be performed.  Covers laboratory orders,
 * imaging orders, referrals, and procedure orders.
 * Mapped to FHIR R4 ServiceRequest.
 */
model ServiceRequest extends HealthcareBaseEntity {
  /** The status of the order. */
  status: ServiceRequestStatus;

  /** Whether the request is a proposal, plan, an original order, or a reflex order. */
  intent: ServiceRequestIntent;

  /**
   * Classification of the requested service.
   * Common values: laboratory, imaging, referral, procedure.
   */
  category: CodeableConcept[];

  /** Indicates how quickly the ServiceRequest should be addressed. */
  priority?: RequestPriority;

  /**
   * Set this to true if the record is saying that the service/procedure should NOT be performed.
   */
  doNotPerform?: boolean;

  /**
   * Code identifying the requested service.
   * LOINC for laboratory / imaging; SNOMED CT for procedure / referral.
   */
  code: CodeableConcept;

  /** Additional details and instructions about the how the services are to be delivered. */
  orderDetail?: CodeableConcept[];

  /** Quantity, if the service request permits a quantity. */
  quantityQuantity?: Quantity;

  /** On whom (or what) the service is to be performed. */
  subject: Reference;

  /** Encounter in which the request was created. */
  encounter?: Reference;

  /** The date/time at which the requested service should occur. */
  occurrenceDateTime?: utcDateTime;

  /** The time period over which the requested service should occur. */
  occurrencePeriod?: Period;

  /** If true, indicates that the service is needed as soon as possible. */
  asNeeded?: boolean;

  /** When the request transitioned to being actionable. */
  authoredOn: utcDateTime;

  /** Who initiated the request. */
  requester: Reference;

  /** Desired type of performer for doing the requested service. */
  performerType?: CodeableConcept;

  /** Specific desired performer(s) for the requested service. */
  performer?: Reference[];

  /** Code for the location where the service is to occur. */
  locationCode?: CodeableConcept[];

  /** Reference to a location where the service is to occur. */
  locationReference?: Reference[];

  /** Coded reason for the service request. */
  reasonCode?: CodeableConcept[];

  /** References to Condition or Observation supporting the order. */
  reasonReference?: Reference[];

  /** Insurance plans, coverage extensions, pre-authorisations and/or pre-determinations. */
  insurance?: Reference[];

  /** Additional clinical information about the patient that may influence the services or their interpretations. */
  supportingInfo?: Reference[];

  /** Specimen(s) to be used for the requested service. */
  specimen?: Reference[];

  /** Anatomical location where the procedure should be performed. */
  bodySite?: CodeableConcept[];

  /** Comments about the request. */
  note?: Annotation[];

  /** Instructions for the patient about the service. */
  patientInstruction?: string;
}

/**
 * Body for requesting a service request status transition.
 */
model ServiceRequestStatusTransition {
  /** Target status. */
  status: ServiceRequestStatus;

  /** Coded reason for the transition (e.g. revocation reason). */
  reason?: CodeableConcept;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/**
 * Query parameters for searching ServiceRequest resources.
 */
model ServiceRequestSearchParams {
  /** Filter by patient (subject) reference id. */
  patient?: string;

  /** Filter by category code. */
  category?: string;

  /** Filter by service code value. */
  code?: string;

  /** Filter by request status. */
  status?: ServiceRequestStatus;

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
 * CRUD, status transition, and search operations for ServiceRequest resources.
 */
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface ServiceRequestService {
  /**
   * Create a new ServiceRequest (order).
   */
  @post
  @operationId("createServiceRequest")
  create(
    @body body: ServiceRequest,
  ): {
    @statusCode statusCode: 201;
    @body serviceRequest: ServiceRequest;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a single ServiceRequest by id.
   */
  @get
  @operationId("getServiceRequest")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body serviceRequest: ServiceRequest;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing ServiceRequest.
   */
  @put
  @operationId("updateServiceRequest")
  @route("/{id}")
  update(
    @path id: string,
    @body body: ServiceRequest,
  ): {
    @statusCode statusCode: 200;
    @body serviceRequest: ServiceRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update a ServiceRequest.
   */
  @patch
  @operationId("patchServiceRequest")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body serviceRequest: ServiceRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a ServiceRequest.
   */
  @delete
  @operationId("deleteServiceRequest")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Transition a ServiceRequest to a new lifecycle status.
   */
  @post
  @operationId("transitionServiceRequestStatus")
  @route("/{id}/status")
  transitionStatus(
    @path id: string,
    @body body: ServiceRequestStatusTransition,
  ): {
    @statusCode statusCode: 200;
    @body serviceRequest: ServiceRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search for ServiceRequest resources using filter parameters.
   */
  @get
  @operationId("searchServiceRequests")
  @route("/search")
  search(
    ...ServiceRequestSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ServiceRequest>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
