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
 * Healthcare Administrative Fee Schedule — fee schedule management, per-item pricing,
 * insurance contract rates, and patient discount management for revenue cycle operations.
 */
namespace Healthcare.Administrative.FeeSchedule;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The type of discount applied to a patient account or charge.")
enum DiscountType {
  @doc("A proportional reduction expressed as a percentage of the charge")
  percentage,

  @doc("A fixed monetary reduction applied to the charge")
  fixedAmount,

  @doc("A senior citizen discount as defined by facility policy")
  seniorCitizen,

  @doc("A person with disability discount as defined by facility policy")
  pwd,

  @doc("An employee benefit discount for facility staff or dependents")
  employee,

  @doc("A charitable or indigency discount for qualifying patients")
  charity,
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A fee schedule defining the standard charges applicable for a given period and organisation.")
model FeeSchedule extends HealthcareBaseEntity {
  @doc("A human-readable name for this fee schedule")
  @maxLength(200)
  name: string;

  @doc("The publication status of this fee schedule")
  status: PublicationStatus;

  @doc("The period during which this fee schedule is effective")
  effectivePeriod: Period;

  @doc("The organisation to which this fee schedule applies, if not facility-wide")
  organization?: Reference;

  @doc("A description of the scope and applicability of this fee schedule")
  @maxLength(500)
  description?: string;
}

@doc("A single line item within a fee schedule associating a procedure code with a unit price.")
model FeeScheduleItem extends HealthcareBaseEntity {
  @doc("The fee schedule this item belongs to")
  feeSchedule: Reference;

  @doc("The procedure or service code (CPT, HCPCS, or facility-specific)")
  code: CodeableConcept;

  @doc("A human-readable description of the service")
  @maxLength(500)
  description: string;

  @doc("The standard unit price for this service")
  unitPrice: Money;

  @doc("Modifiers that adjust the price for this service line")
  modifier?: CodeableConcept[];

  @doc("Whether this price applies in a facility setting (versus a non-facility/office setting)")
  facility?: boolean;

  @doc("The period during which this price is effective, if different from the parent fee schedule")
  effectivePeriod?: Period;
}

@doc("A contracted allowed amount negotiated with a payer for a specific procedure code.")
model InsuranceContractRate extends HealthcareBaseEntity {
  @doc("The fee schedule this contracted rate is associated with")
  feeSchedule: Reference;

  @doc("The insurance payer who negotiated this rate")
  payer: Reference;

  @doc("The procedure or service code this rate applies to")
  code: CodeableConcept;

  @doc("The contracted allowed amount for this procedure")
  allowedAmount: Money;

  @doc("The fixed copayment amount owed by the patient for this service")
  copay?: Money;

  @doc("The patient coinsurance percentage applied after deductible (0.0–100.0)")
  coinsurancePercent?: float64;

  @doc("The period during which this contracted rate is in effect")
  effectivePeriod: Period;
}

@doc("A discount definition that can be applied to patient accounts or specific charges.")
model Discount extends HealthcareBaseEntity {
  @doc("A human-readable name for this discount")
  @maxLength(200)
  name: string;

  @doc("The type of discount")
  type: DiscountType;

  @doc("The discount value — a percentage (0.0–100.0) or fixed monetary amount depending on type")
  value: float64;

  @doc("Eligibility conditions or qualifying criteria for this discount")
  @maxLength(500)
  conditions?: string;

  @doc("The publication status of this discount definition")
  status: PublicationStatus;
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

@doc("Request body for bulk-importing fee schedule items from an external source.")
model FeeScheduleItemBulkImportRequest {
  @doc("The fee schedule to import items into")
  feeScheduleId: string;

  @doc("The items to import")
  items: FeeScheduleItem[];

  @doc("Whether to replace all existing items in the fee schedule")
  replaceExisting?: boolean;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for FeeSchedule resources.")
model FeeScheduleSearchParams {
  @doc("Filter by publication status")
  @query status?: PublicationStatus;

  @doc("Filter by name keyword")
  @query name?: string;

  @doc("Filter by organisation reference id")
  @query organization?: string;

  @doc("Filter fee schedules effective on this date")
  @query effectiveDate?: plainDate;

  ...PaginationQuery;
}

@doc("Search parameters for FeeScheduleItem resources.")
model FeeScheduleItemSearchParams {
  @doc("Filter by fee schedule reference id")
  @query feeSchedule?: string;

  @doc("Filter by procedure code")
  @query code?: string;

  @doc("Filter by description keyword")
  @query description?: string;

  @doc("Filter by facility flag")
  @query facility?: boolean;

  ...PaginationQuery;
}

@doc("Search parameters for InsuranceContractRate resources.")
model InsuranceContractRateSearchParams {
  @doc("Filter by fee schedule reference id")
  @query feeSchedule?: string;

  @doc("Filter by payer reference id")
  @query payer?: string;

  @doc("Filter by procedure code")
  @query code?: string;

  @doc("Filter rates effective on this date")
  @query effectiveDate?: plainDate;

  ...PaginationQuery;
}

@doc("Search parameters for Discount resources.")
model DiscountSearchParams {
  @doc("Filter by discount type")
  @query type?: DiscountType;

  @doc("Filter by publication status")
  @query status?: PublicationStatus;

  @doc("Filter by name keyword")
  @query name?: string;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD and search operations for FeeSchedule resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface FeeScheduleManagement {
  @doc("Create a new FeeSchedule.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @operationId("createFeeSchedule")
  create(
    @body body: FeeSchedule,
  ): {
    @statusCode statusCode: 201;
    @body feeSchedule: FeeSchedule;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single FeeSchedule by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("getFeeSchedule")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body feeSchedule: FeeSchedule;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing FeeSchedule.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @put
  @operationId("updateFeeSchedule")
  @route("/{id}")
  update(
    @path id: string,
    @body body: FeeSchedule,
  ): {
    @statusCode statusCode: 200;
    @body feeSchedule: FeeSchedule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a FeeSchedule.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @patch
  @operationId("patchFeeSchedule")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body feeSchedule: FeeSchedule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a FeeSchedule by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @delete
  @operationId("deleteFeeSchedule")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for FeeSchedule resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("searchFeeSchedules")
  @route("/search")
  search(
    ...FeeScheduleSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<FeeSchedule>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD, search, and bulk-import operations for FeeScheduleItem resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface FeeScheduleItemManagement {
  @doc("Create a new FeeScheduleItem.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @operationId("createFeeScheduleItem")
  create(
    @body body: FeeScheduleItem,
  ): {
    @statusCode statusCode: 201;
    @body feeScheduleItem: FeeScheduleItem;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single FeeScheduleItem by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("getFeeScheduleItem")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body feeScheduleItem: FeeScheduleItem;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing FeeScheduleItem.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @put
  @operationId("updateFeeScheduleItem")
  @route("/{id}")
  update(
    @path id: string,
    @body body: FeeScheduleItem,
  ): {
    @statusCode statusCode: 200;
    @body feeScheduleItem: FeeScheduleItem;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a FeeScheduleItem.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @patch
  @operationId("patchFeeScheduleItem")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body feeScheduleItem: FeeScheduleItem;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a FeeScheduleItem by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @delete
  @operationId("deleteFeeScheduleItem")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for FeeScheduleItem resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("searchFeeScheduleItems")
  @route("/search")
  search(
    ...FeeScheduleItemSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<FeeScheduleItem>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Bulk-import fee schedule items, optionally replacing all existing items.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @operationId("bulkImportFeeScheduleItems")
  @route("/bulk-import")
  bulkImport(
    @body body: FeeScheduleItemBulkImportRequest,
  ): {
    @statusCode statusCode: 201;
    @body feeScheduleItems: FeeScheduleItem[];
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for InsuranceContractRate resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface InsuranceContractRateManagement {
  @doc("Create a new InsuranceContractRate.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @operationId("createInsuranceContractRate")
  create(
    @body body: InsuranceContractRate,
  ): {
    @statusCode statusCode: 201;
    @body insuranceContractRate: InsuranceContractRate;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single InsuranceContractRate by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("getInsuranceContractRate")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body insuranceContractRate: InsuranceContractRate;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing InsuranceContractRate.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @put
  @operationId("updateInsuranceContractRate")
  @route("/{id}")
  update(
    @path id: string,
    @body body: InsuranceContractRate,
  ): {
    @statusCode statusCode: 200;
    @body insuranceContractRate: InsuranceContractRate;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an InsuranceContractRate by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @delete
  @operationId("deleteInsuranceContractRate")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for InsuranceContractRate resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("searchInsuranceContractRates")
  @route("/search")
  search(
    ...InsuranceContractRateSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<InsuranceContractRate>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for Discount resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface DiscountManagement {
  @doc("Create a new Discount definition.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @operationId("createDiscount")
  create(
    @body body: Discount,
  ): {
    @statusCode statusCode: 201;
    @body discount: Discount;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single Discount by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("getDiscount")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body discount: Discount;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing Discount definition.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @put
  @operationId("updateDiscount")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Discount,
  ): {
    @statusCode statusCode: 200;
    @body discount: Discount;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a Discount definition.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @patch
  @operationId("patchDiscount")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body discount: Discount;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a Discount definition by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @delete
  @operationId("deleteDiscount")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for Discount resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("searchDiscounts")
  @route("/search")
  search(
    ...DiscountSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Discount>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
