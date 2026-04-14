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
 * Healthcare Administrative Insurance — FHIR R4-aligned Coverage management and
 * real-time eligibility verification (270/271 transaction equivalent) for patients,
 * payers, and coverage relationships.
 */
namespace Healthcare.Administrative.Insurance;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

@doc("The status of a Coverage resource. Aligns with FHIR Financial Resource status codes.")
enum CoverageStatus {
  @doc("The instance is currently in-force")
  active,

  @doc("The instance is withdrawn, rescinded, or reversed")
  cancelled,

  @doc("A new instance not yet made available for action")
  draft,

  @doc("An instance that should not have existed")
  enteredInError,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A class grouping (e.g., group, plan, subgroup, subplan) within a coverage policy.")
model CoverageClass {
  @doc("The type of classification (group, plan, subplan, class, subclass, sequence, rxbin, rxpcn, rxid, rxgroup)")
  type: CodeableConcept;

  @doc("The alphanumeric identifier of the class as defined by the insurer")
  @minLength(1)
  @maxLength(100)
  value: string;

  @doc("A short description for the class")
  @maxLength(255)
  name?: string;
}

@doc("An exception to patient cost-sharing for a specific benefit category or period.")
model CostException {
  @doc("The code for the specific exception")
  type: CodeableConcept;

  @doc("The timeframe during which the exception is in force")
  period?: Period;
}

@doc("Patient cost-sharing detail for a specific benefit type.")
model CoverageCostToBeneficiary {
  @doc("The category of patient centric costs associated with treatment (e.g., deductible, copay, coinsurance)")
  type?: CodeableConcept;

  @doc("The amount due from the patient for the cost category as a simple Quantity (e.g., $15)")
  valueQuantity?: Quantity;

  @doc("The amount due from the patient for the cost category expressed as a monetary amount")
  valueMoney?: Money;

  @doc("A suite of exceptions for the cost")
  exception?: CostException[];
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("Financial instrument that provides coverage for health care. Aligns with FHIR R4 Coverage.")
model Coverage extends HealthcareBaseEntity {
  @doc("The status of the resource instance")
  status: CoverageStatus;

  @doc("Coverage category such as medical or accident")
  type?: CodeableConcept;

  @doc("Owner of the policy (individual or organization who pays premiums)")
  policyHolder?: Reference;

  @doc("Subscriber to the policy")
  subscriber?: Reference;

  @doc("ID assigned to the subscriber; often the member ID from the insurance card")
  @maxLength(100)
  subscriberId?: string;

  @doc("Plan beneficiary — the Patient covered by the policy")
  beneficiary: Reference;

  @doc("Dependent number when the beneficiary is a dependent under the subscriber's policy")
  @maxLength(25)
  dependent?: string;

  @doc("Beneficiary relationship to the subscriber")
  relationship?: CodeableConcept;

  @doc("Coverage start and end dates")
  period?: Period;

  @doc("Issuer of the policy — one or more Organizations (payers/insurers)")
  payor: Reference[];

  @doc("Coverage grouping classes (group, plan, subplan, class, etc.)")
  coverageClass?: CoverageClass[];

  @doc("Relative order of the coverage — lower order means higher priority")
  @minValue(1)
  order?: int32;

  @doc("Insurer network name the beneficiary belongs to")
  @maxLength(100)
  network?: string;

  @doc("Patient cost-sharing details per benefit category")
  costToBeneficiary?: CoverageCostToBeneficiary[];
}

// ---------------------------------------------------------------------------
// Eligibility models
// ---------------------------------------------------------------------------

@doc("Request payload for a real-time eligibility verification inquiry (equivalent to HIPAA 270).")
model EligibilityRequest {
  @doc("Reference to the Patient whose eligibility is being verified")
  patient: Reference;

  @doc("Reference to the Coverage to verify")
  coverage: Reference;

  @doc("Reference to the Provider (Practitioner or Organization) submitting the inquiry")
  provider: Reference;

  @doc("Date of service for which eligibility is being verified")
  serviceDate?: utcDateTime;

  @doc("Type of service being verified (CPT, SNOMED, or HCPCS code)")
  serviceType?: CodeableConcept;
}

@doc("Response payload from a real-time eligibility verification response (equivalent to HIPAA 271).")
model EligibilityResponse {
  @doc("Processing status of the eligibility transaction (e.g., 'active', 'inactive', 'error')")
  status: string;

  @doc("Whether the patient is eligible for the requested service on the service date")
  eligible: boolean;

  @doc("Reference to the Coverage verified")
  coverage: Reference;

  @doc("Whether the provider is in-network for the verified coverage")
  inNetwork: boolean;

  @doc("Applicable copayment amount for the service")
  copay?: Money;

  @doc("Total deductible amount per policy period")
  deductible?: Money;

  @doc("Remaining deductible amount for the current period")
  deductibleRemaining?: Money;

  @doc("Out-of-pocket maximum for the policy period")
  outOfPocketMax?: Money;

  @doc("Remaining out-of-pocket amount for the current period")
  outOfPocketRemaining?: Money;

  @doc("Additional benefit notes or remarks from the payer")
  @maxLength(2000)
  notes?: string;
}

// ---------------------------------------------------------------------------
// Search models
// ---------------------------------------------------------------------------

@doc("Search parameters for Coverage resources.")
model CoverageSearchParams {
  @doc("Filter by beneficiary (patient) reference id")
  @query beneficiary?: string;

  @doc("Filter by subscriber reference id")
  @query subscriber?: string;

  @doc("Filter by payor (organization) reference id")
  @query payor?: string;

  @doc("Filter by coverage status")
  @query status?: CoverageStatus;

  @doc("Filter by coverage type code")
  @query type?: string;

  @doc("Filter coverages active at or after this date")
  @query dateFrom?: utcDateTime;

  @doc("Filter coverages active at or before this date")
  @query dateTo?: utcDateTime;

  @doc("Page number (1-based)")
  @query page?: int32;

  @doc("Number of results per page")
  @query pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD and search operations for Coverage resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface CoverageManagement {
  @doc("Create a new Coverage record.")
  @post
  @operationId("createCoverage")
  create(
    @body body: Coverage,
  ): {
    @statusCode statusCode: 201;
    @body coverage: Coverage;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single Coverage by id.")
  @get
  @operationId("getCoverage")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body coverage: Coverage;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing Coverage record.")
  @put
  @operationId("updateCoverage")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Coverage,
  ): {
    @statusCode statusCode: 200;
    @body coverage: Coverage;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a Coverage record.")
  @patch
  @operationId("patchCoverage")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body coverage: Coverage;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a Coverage record by id.")
  @delete
  @operationId("deleteCoverage")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for Coverage resources using filter parameters.")
  @get
  @operationId("searchCoverages")
  @route("/search")
  search(
    ...CoverageSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Coverage>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Real-time eligibility verification service (HIPAA 270/271 equivalent).")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface EligibilityService {
  @doc("Submit a real-time eligibility verification inquiry for a patient and coverage.")
  @post
  @operationId("verifyEligibility")
  verifyEligibility(
    @body body: EligibilityRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: EligibilityResponse;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
