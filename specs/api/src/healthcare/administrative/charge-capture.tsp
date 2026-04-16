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

/**
 * Healthcare Administrative Charge Capture — charge item recording and charge
 * definition management for CPT/HCPCS-coded billable services across inpatient
 * and outpatient encounters.
 */
namespace Healthcare.Administrative.ChargeCapture;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The lifecycle status of a charge item.")
enum ChargeItemStatus {
  @doc("The charge item has been identified but not yet confirmed as billable")
  planned,

  @doc("The charge item is ready for billing")
  billable,

  @doc("The charge item has been determined to be not billable")
  notBillable,

  @doc("The charge item has been aborted before billing")
  aborted,

  @doc("The charge item has been billed")
  billed,

  @doc("The charge item was entered in error and should be ignored")
  enteredInError,
}

@doc("The publication status of a charge definition.")
enum ChargeDefinitionStatus {
  @doc("The charge definition is active and in use")
  active,

  @doc("The charge definition has been retired and should no longer be used")
  retired,

  @doc("The charge definition is a draft and not yet in active use")
  draft,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A component that contributes to the total charge for a service.")
model ChargeComponent {
  @doc("The type of component (base, surcharge, tax, discount, informational)")
  type: string;

  @doc("A code identifying this charge component")
  code: CodeableConcept;

  @doc("A factor applied to the base price to derive the component amount")
  factor?: float64;

  @doc("The monetary amount of this component")
  amount?: Money;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A charge item representing a billable service or product rendered to a patient. Aligns with FHIR R4 ChargeItem.")
model ChargeItem extends HealthcareBaseEntity {
  @doc("The current lifecycle status of the charge item")
  status: ChargeItemStatus;

  @doc("A code identifying the service rendered (CPT or HCPCS)")
  code: CodeableConcept;

  @doc("The patient for whom the service was rendered")
  subject: Reference;

  @doc("The encounter during which the service was rendered")
  encounter?: Reference;

  @doc("The date and time at which the service occurred")
  occurrenceDateTime?: utcDateTime;

  @doc("Practitioners who performed the service")
  performer?: Reference[];

  @doc("The organisation responsible for providing the service")
  performingOrganization?: Reference;

  @doc("The quantity of the service rendered")
  quantity?: Quantity;

  @doc("The unit price for one unit of the service")
  unitPrice?: Money;

  @doc("A factor applied to the unit price (e.g., for discounts or adjustments)")
  factorOverride?: float64;

  @doc("The total price of the charge item (quantity × unitPrice × factorOverride)")
  totalPrice?: Money;

  @doc("The body site(s) on which the service was performed")
  bodysite?: CodeableConcept[];

  @doc("The account(s) to which the charge should be posted")
  account?: Reference;

  @doc("The clinical reason(s) for the service")
  reason?: CodeableConcept[];

  @doc("Clinical resources (ServiceRequest, Procedure, etc.) that substantiate the charge")
  service?: Reference[];

  @doc("Additional free-text or coded annotations")
  note?: Annotation[];
}

@doc("A definition of a charge applicable to a product or service. Aligns with FHIR R4 ChargeItemDefinition.")
model ChargeDefinition extends HealthcareBaseEntity {
  @doc("A human-readable description of this charge definition")
  description: string;

  @doc("A code identifying the charged product or service")
  code: CodeableConcept;

  @doc("The publication status of this charge definition")
  status: ChargeDefinitionStatus;

  @doc("The period during which this charge definition is effective")
  effectivePeriod?: Period;

  @doc("The default unit price for the service or product")
  unitPrice: Money;

  @doc("Individual components that make up the total charge")
  component?: ChargeComponent[];
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

@doc("Request body for bulk-creating charge items from an encounter or order set.")
model ChargeBulkCreateRequest {
  @doc("Charge items to create in a single atomic operation")
  items: ChargeItem[];
}

@doc("Request body for verifying charge completeness across encounters.")
model ChargeVerificationRequest {
  @doc("Encounter ids to include in the verification scan")
  encounterIds?: string[];

  @doc("Date range to restrict the verification scan")
  dateRange?: Period;

  @doc("Filter by charge item status")
  status?: string;
}

@doc("Search parameters for ChargeItem resources.")
model ChargeItemSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by encounter reference id")
  @query encounter?: string;

  @doc("Filter by charge item status")
  @query status?: ChargeItemStatus;

  @doc("Filter by CPT/HCPCS code")
  @query code?: string;

  @doc("Filter by performing organisation reference id")
  @query performingOrganization?: string;

  @doc("Filter items with occurrence on or after this date-time")
  @query occurrenceFrom?: utcDateTime;

  @doc("Filter items with occurrence on or before this date-time")
  @query occurrenceTo?: utcDateTime;

  ...PaginationQuery;
}

@doc("Search parameters for ChargeDefinition resources.")
model ChargeDefinitionSearchParams {
  @doc("Filter by charge definition status")
  @query status?: ChargeDefinitionStatus;

  @doc("Filter by service code")
  @query code?: string;

  @doc("Filter by description keyword")
  @query description?: string;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD, search, bulk-create, and verification operations for ChargeItem resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface ChargeItemManagement {
  @doc("Create a new ChargeItem.")
  @extension("x-security-required-roles", #["admin", "biller", "clinician"])
  @post
  @operationId("createChargeItem")
  create(
    @body body: ChargeItem,
  ): {
    @statusCode statusCode: 201;
    @body chargeItem: ChargeItem;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single ChargeItem by id.")
  @extension("x-security-required-roles", #["admin", "biller", "clinician"])
  @get
  @operationId("getChargeItem")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body chargeItem: ChargeItem;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing ChargeItem.")
  @extension("x-security-required-roles", #["admin", "biller", "clinician"])
  @put
  @operationId("updateChargeItem")
  @route("/{id}")
  update(
    @path id: string,
    @body body: ChargeItem,
  ): {
    @statusCode statusCode: 200;
    @body chargeItem: ChargeItem;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a ChargeItem.")
  @extension("x-security-required-roles", #["admin", "biller", "clinician"])
  @patch
  @operationId("patchChargeItem")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body chargeItem: ChargeItem;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a ChargeItem by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @delete
  @operationId("deleteChargeItem")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for ChargeItem resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "biller", "clinician"])
  @get
  @operationId("searchChargeItems")
  @route("/search")
  search(
    ...ChargeItemSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ChargeItem>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Bulk-create multiple ChargeItems in a single atomic operation.")
  @extension("x-security-required-roles", #["admin", "biller", "clinician"])
  @post
  @operationId("bulkCreateChargeItems")
  @route("/bulk")
  bulkCreate(
    @body body: ChargeBulkCreateRequest,
  ): {
    @statusCode statusCode: 201;
    @body chargeItems: ChargeItem[];
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Verify charge completeness for a set of encounters or a date range.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @operationId("verifyCharges")
  @route("/verify")
  verify(
    @body body: ChargeVerificationRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ChargeItem>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for ChargeDefinition resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface ChargeDefinitionManagement {
  @doc("Create a new ChargeDefinition.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @operationId("createChargeDefinition")
  create(
    @body body: ChargeDefinition,
  ): {
    @statusCode statusCode: 201;
    @body chargeDefinition: ChargeDefinition;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single ChargeDefinition by id.")
  @extension("x-security-required-roles", #["admin", "biller", "clinician"])
  @get
  @operationId("getChargeDefinition")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body chargeDefinition: ChargeDefinition;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing ChargeDefinition.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @put
  @operationId("updateChargeDefinition")
  @route("/{id}")
  update(
    @path id: string,
    @body body: ChargeDefinition,
  ): {
    @statusCode statusCode: 200;
    @body chargeDefinition: ChargeDefinition;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a ChargeDefinition.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @patch
  @operationId("patchChargeDefinition")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body chargeDefinition: ChargeDefinition;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a ChargeDefinition by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @delete
  @operationId("deleteChargeDefinition")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for ChargeDefinition resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "biller", "clinician"])
  @get
  @operationId("searchChargeDefinitions")
  @route("/search")
  search(
    ...ChargeDefinitionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ChargeDefinition>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
