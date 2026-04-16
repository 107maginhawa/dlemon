import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../../common/models.tsp";
import "../../../common/errors.tsp";
import "../../../common/pagination.tsp";
import "../../../common/security.tsp";
import "../../core/primitives.tsp";
import "../../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Healthcare Clinical Order Management — clinical order entry, order set management,
 * co-signature workflow, and pharmacist/nurse verification for all order types
 * across inpatient and outpatient encounters.
 */
namespace Healthcare.Clinical.Hospital.OrderManagement;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The clinical discipline category of an order.")
enum ClinicalOrderType {
  @doc("A medication prescription or administration order")
  medication,

  @doc("A laboratory or pathology test order")
  laboratory,

  @doc("A diagnostic imaging order (X-ray, CT, MRI, etc.)")
  imaging,

  @doc("A dietary or nutritional order")
  diet,

  @doc("An activity or mobility restriction order")
  activity,

  @doc("A nursing care order")
  nursing,

  @doc("A respiratory therapy order")
  respiratory,

  @doc("A specialty consultation request")
  consultation,

  @doc("A clinical procedure order")
  procedure,

  @doc("A medical supply or equipment order")
  supply,
}

@doc("The lifecycle status of a clinical order.")
enum ClinicalOrderStatus {
  @doc("The order is in draft and has not been submitted")
  draft,

  @doc("The order has been submitted and is awaiting verification")
  pending,

  @doc("The order is active and being fulfilled")
  active,

  @doc("The order has been temporarily suspended")
  onHold,

  @doc("The order has been fulfilled")
  completed,

  @doc("The order was cancelled before fulfilment")
  cancelled,

  @doc("The order was discontinued while active")
  discontinued,

  @doc("The order was entered in error and should be ignored")
  enteredInError,
}

@doc("The decision outcome of an order verification.")
enum VerificationDecision {
  @doc("The order was verified and approved without changes")
  verified,

  @doc("The order was verified with modifications")
  modified,

  @doc("The order was rejected")
  rejected,

  @doc("The order was placed on hold pending further information")
  held,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A single item in an order set defining a templated clinical order.")
model OrderSetItem {
  @doc("The sequence number of this item within the order set")
  sequence: int32;

  @doc("The type of clinical order this item represents")
  orderType: ClinicalOrderType;

  @doc("The clinical code identifying the specific order (drug, test, procedure, etc.)")
  code: CodeableConcept;

  @doc("The default priority to apply when instantiating this order")
  defaultPriority?: RequestPriority;

  @doc("Default free-text instructions for this order")
  @maxLength(1000)
  defaultInstructions?: string;

  @doc("Whether this item is mandatory when applying the order set")
  required: boolean;

  @doc("Optional logical grouping name for display in clinical UIs")
  @maxLength(100)
  groupName?: string;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A clinical order placed by an authorised provider for patient care.")
model ClinicalOrder extends HealthcareBaseEntity {
  @doc("The patient for whom the order was placed")
  patient: Reference;

  @doc("The encounter during which the order was placed")
  encounter: Reference;

  @doc("The provider who authored the order")
  orderedBy: Reference;

  @doc("The category of clinical order")
  orderType: ClinicalOrderType;

  @doc("The specific service, medication, or item ordered")
  code: CodeableConcept;

  @doc("The urgency or priority of the order")
  priority: RequestPriority;

  @doc("The current lifecycle status of the order")
  status: ClinicalOrderStatus;

  @doc("The date and time the order was authored")
  authoredOn: utcDateTime;

  @doc("The date and time the order should begin")
  start?: utcDateTime;

  @doc("The date and time the order should end")
  end?: utcDateTime;

  @doc("The frequency or schedule for recurring orders (e.g., q4h, daily, BID)")
  @maxLength(100)
  frequency?: string;

  @doc("Free-text instructions for the order")
  @maxLength(2000)
  instructions?: string;

  @doc("The clinical reason(s) for placing the order")
  reason?: CodeableConcept[];

  @doc("Additional free-text or coded annotations")
  note?: Annotation[];

  @doc("Whether a co-signature from another provider is required")
  coSignRequired?: boolean;

  @doc("The provider who co-signed the order")
  coSignedBy?: Reference;

  @doc("The date and time the co-signature was provided")
  coSignedAt?: utcDateTime;
}

@doc("A templated collection of related clinical orders applied together as a protocol.")
model OrderSet extends HealthcareBaseEntity {
  @doc("A human-readable name for the order set")
  @maxLength(200)
  name: string;

  @doc("A code identifying this order set")
  code?: CodeableConcept;

  @doc("The publication status of this order set")
  status: PublicationStatus;

  @doc("A description of the purpose and contents of the order set")
  @maxLength(1000)
  description?: string;

  @doc("The intended clinical purpose of this order set")
  @maxLength(500)
  purpose?: string;

  @doc("The practitioner or organisation that authored this order set")
  author?: Reference;

  @doc("Clinical conditions for which this order set is applicable")
  applicableCondition?: CodeableConcept[];

  @doc("The templated orders included in this order set")
  items: OrderSetItem[];
}

@doc("A verification record capturing a pharmacist or nurse review of a clinical order.")
model OrderVerification extends HealthcareBaseEntity {
  @doc("The clinical order that was verified")
  order: Reference;

  @doc("The clinician who performed the verification")
  verifiedBy: Reference;

  @doc("The date and time the verification was performed")
  verifiedAt: utcDateTime;

  @doc("The outcome decision of the verification")
  status: VerificationDecision;

  @doc("The reason for rejection, modification, or hold")
  @maxLength(500)
  reason?: string;

  @doc("Description of modifications made to the order during verification")
  @maxLength(1000)
  modifications?: string;
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

@doc("Request body for applying an order set to a patient encounter.")
model ApplyOrderSetRequest {
  @doc("The id of the order set to apply")
  orderSetId: string;

  @doc("The patient for whom the order set should be applied")
  patient: Reference;

  @doc("The encounter to which the orders should be associated")
  encounter: Reference;

  @doc("Ids of optional order set items to include (by sequence number)")
  includeOptionalItems?: int32[];
}

@doc("Request body for co-signing a clinical order.")
model CoSignRequest {
  @doc("The id of the provider providing the co-signature")
  coSignedBy: string;

  @doc("Optional note accompanying the co-signature")
  @maxLength(500)
  note?: string;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for ClinicalOrder resources.")
model ClinicalOrderSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by encounter reference id")
  @query encounter?: string;

  @doc("Filter by order type")
  @query orderType?: ClinicalOrderType;

  @doc("Filter by order status")
  @query status?: ClinicalOrderStatus;

  @doc("Filter by ordering provider reference id")
  @query orderedBy?: string;

  @doc("Filter by order priority")
  @query priority?: RequestPriority;

  @doc("Filter orders authored on or after this date-time")
  @query authoredFrom?: utcDateTime;

  @doc("Filter orders authored on or before this date-time")
  @query authoredTo?: utcDateTime;

  @doc("Filter by whether a co-signature is required")
  @query coSignRequired?: boolean;

  ...PaginationQuery;
}

@doc("Search parameters for OrderSet resources.")
model OrderSetSearchParams {
  @doc("Filter by publication status")
  @query status?: PublicationStatus;

  @doc("Filter by name keyword")
  @query name?: string;

  @doc("Filter by applicable condition code")
  @query applicableCondition?: string;

  ...PaginationQuery;
}

@doc("Search parameters for OrderVerification resources.")
model OrderVerificationSearchParams {
  @doc("Filter by clinical order reference id")
  @query order?: string;

  @doc("Filter by verifier reference id")
  @query verifiedBy?: string;

  @doc("Filter by verification decision")
  @query status?: VerificationDecision;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD, search, status-transition, and co-sign operations for ClinicalOrder resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface ClinicalOrderManagement {
  @doc("Create a new clinical order.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createClinicalOrder")
  create(
    @body body: ClinicalOrder,
  ): {
    @statusCode statusCode: 201;
    @body clinicalOrder: ClinicalOrder;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single ClinicalOrder by id.")
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @get
  @operationId("getClinicalOrder")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body clinicalOrder: ClinicalOrder;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing ClinicalOrder.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateClinicalOrder")
  @route("/{id}")
  update(
    @path id: string,
    @body body: ClinicalOrder,
  ): {
    @statusCode statusCode: 200;
    @body clinicalOrder: ClinicalOrder;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a ClinicalOrder (e.g., status transition).")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchClinicalOrder")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body clinicalOrder: ClinicalOrder;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a ClinicalOrder by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteClinicalOrder")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for ClinicalOrder resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @get
  @operationId("searchClinicalOrders")
  @route("/search")
  search(
    ...ClinicalOrderSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ClinicalOrder>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Provide a co-signature for a clinical order that requires one.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("coSignClinicalOrder")
  @route("/{id}/co-sign")
  coSign(
    @path id: string,
    @body body: CoSignRequest,
  ): {
    @statusCode statusCode: 200;
    @body clinicalOrder: ClinicalOrder;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD, search, and apply operations for OrderSet resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface OrderSetManagement {
  @doc("Create a new OrderSet.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createOrderSet")
  create(
    @body body: OrderSet,
  ): {
    @statusCode statusCode: 201;
    @body orderSet: OrderSet;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single OrderSet by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getOrderSet")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body orderSet: OrderSet;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing OrderSet.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateOrderSet")
  @route("/{id}")
  update(
    @path id: string,
    @body body: OrderSet,
  ): {
    @statusCode statusCode: 200;
    @body orderSet: OrderSet;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an OrderSet by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteOrderSet")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for OrderSet resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchOrderSets")
  @route("/search")
  search(
    ...OrderSetSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<OrderSet>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Instantiate all applicable orders from an order set for a specific patient encounter.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("applyOrderSet")
  @route("/apply")
  applyOrderSet(
    @body body: ApplyOrderSetRequest,
  ): {
    @statusCode statusCode: 201;
    @body orders: ClinicalOrder[];
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Create and search operations for OrderVerification records.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface OrderVerificationService {
  @doc("Record a new order verification decision.")
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @post
  @operationId("createOrderVerification")
  create(
    @body body: OrderVerification,
  ): {
    @statusCode statusCode: 201;
    @body orderVerification: OrderVerification;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for OrderVerification records using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @get
  @operationId("searchOrderVerifications")
  @route("/search")
  search(
    ...OrderVerificationSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<OrderVerification>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
