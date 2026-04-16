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
 * Healthcare Administrative Claims — FHIR R4-aligned Claim submission and ClaimResponse
 * adjudication processing for institutional, professional, oral, pharmacy, and vision claims.
 */
namespace Healthcare.Administrative.Claims;

// ---------------------------------------------------------------------------
// Enums (re-declare locally; ClaimStatus and ClaimUse are also in Terminology)
// ---------------------------------------------------------------------------

@doc("The status of the claim resource. Aligns with FHIR Claim status.")
enum ClaimStatus {
  @doc("The instance is currently in-force")
  active,

  @doc("The instance is withdrawn, rescinded, or reversed")
  cancelled,

  @doc("A new instance not yet made available for action")
  draft,

  @doc("An instance that should not have existed")
  enteredInError,
}

@doc("The purpose of the claim. Aligns with FHIR Claim use.")
enum ClaimUse {
  @doc("Complete claim for services rendered including any pre-authorization")
  claim,

  @doc("Pre-authorization request for proposed services")
  preauthorization,

  @doc("Pre-determination request for estimated costs")
  predetermination,
}

@doc("The outcome of claim adjudication. Aligns with FHIR remittance-outcome.")
enum ClaimOutcome {
  @doc("The adjudication has been queued and is pending processing")
  queued,

  @doc("The adjudication is complete")
  complete,

  @doc("The adjudication returned an error")
  error,

  @doc("The adjudication is partially complete, further work is needed")
  partial,
}

// ---------------------------------------------------------------------------
// Claim supporting models
// ---------------------------------------------------------------------------

@doc("Members of the care team contributing to the claim.")
model ClaimCareTeam {
  @doc("Sequence number identifying this care team member within the claim")
  @minValue(1)
  sequence: int32;

  @doc("Reference to the practitioner or organization on the care team")
  provider: Reference;

  @doc("Whether this practitioner is the primary responsible practitioner for this claim")
  responsible?: boolean;

  @doc("Role on the care team (e.g., primary, assist, supervisor, referring)")
  role?: CodeableConcept;

  @doc("Practitioner qualification code applicable to this service")
  qualification?: CodeableConcept;
}

@doc("Additional supporting information relevant to the claim.")
model ClaimSupportingInfo {
  @doc("Sequence number for referencing this item from other elements in the claim")
  @minValue(1)
  sequence: int32;

  @doc("Category of the supporting information (info, discharge, onset, related, exception, material, attachment, missingtooth, prosthesis, other)")
  category: CodeableConcept;

  @doc("System and code pertaining to the specific information regarding the reason for the claim")
  code?: CodeableConcept;

  @doc("When the information is a date or date range as a single date")
  timingDate?: utcDateTime;

  @doc("When the information is a date or date range as a period")
  timingPeriod?: Period;

  @doc("Supporting information as a string value")
  @maxLength(1000)
  valueString?: string;

  @doc("Supporting information as a measured quantity")
  valueQuantity?: Quantity;

  @doc("Supporting information as an attachment (lab report, referral letter, etc.)")
  valueAttachment?: Attachment;

  @doc("Reason for including the supporting information")
  reason?: CodeableConcept;
}

@doc("Pertinent diagnosis information for the claim.")
model ClaimDiagnosis {
  @doc("Sequence number for referencing this diagnosis from claim items")
  @minValue(1)
  sequence: int32;

  @doc("The nature of illness or problem (ICD-10-CM code)")
  diagnosisCode: CodeableConcept;

  @doc("Timing or nature of the diagnosis (admitting, principal, secondary, discharge)")
  type?: CodeableConcept[];

  @doc("Indicator of whether the diagnosis was present on admission to a facility")
  onAdmission?: CodeableConcept;

  @doc("Package billing code for the diagnosis grouper")
  packageCode?: CodeableConcept;
}

@doc("Clinical procedures performed for the claim.")
model ClaimProcedure {
  @doc("Sequence number for referencing this procedure from claim items")
  @minValue(1)
  sequence: int32;

  @doc("Category of procedure (primary, secondary)")
  type?: CodeableConcept[];

  @doc("Date and optionally time the procedure was performed")
  date?: utcDateTime;

  @doc("The specific procedure (ICD-10-PCS or CPT code)")
  procedureCode: CodeableConcept;
}

@doc("Financial information for a coverage plan on the claim.")
model ClaimInsurance {
  @doc("Sequence of coverage priority — lower values are processed first")
  @minValue(1)
  sequence: int32;

  @doc("Whether this is the focal (primary adjudicating) coverage for this claim")
  focal: boolean;

  @doc("Reference to the patient Coverage")
  coverage: Reference;

  @doc("Pre-authorization reference number from a prior authorization request")
  @maxLength(50)
  preAuthRef?: string;
}

@doc("A single service line item on the claim.")
model ClaimItem {
  @doc("Item sequence number — used to reference item adjudications in ClaimResponse")
  @minValue(1)
  sequence: int32;

  @doc("Care team members applicable to this service line")
  careTeamSequence?: int32[];

  @doc("Applicable diagnoses for this service line by sequence number")
  diagnosisSequence?: int32[];

  @doc("Applicable procedures for this service line by sequence number")
  procedureSequence?: int32[];

  @doc("Revenue or cost center code for this line item")
  revenue?: CodeableConcept;

  @doc("Benefit category (e.g., oral, vision, medical, pharmacy)")
  category?: CodeableConcept;

  @doc("Billing code for the service rendered (CPT, HCPCS, CDT, etc.)")
  productOrService: CodeableConcept;

  @doc("Item typification or modifiers reducing or expanding service rendering")
  modifier?: CodeableConcept[];

  @doc("Date of service as a single date")
  servicedDate?: utcDateTime;

  @doc("Date of service as a period")
  servicedPeriod?: Period;

  @doc("Place of service code for professional claims")
  locationCode?: CodeableConcept;

  @doc("Number of service units")
  quantity?: Quantity;

  @doc("Fee, charge, or cost per unit of service")
  unitPrice?: Money;

  @doc("Price scaling factor applied to unit price for total calculation")
  factor?: float64;

  @doc("Total cost after quantity and factor are applied")
  net?: Money;
}

// ---------------------------------------------------------------------------
// ClaimResponse supporting models
// ---------------------------------------------------------------------------

@doc("Adjudication results for a single claim item.")
model ClaimResponseItem {
  @doc("Claim item sequence number this adjudication applies to")
  @minValue(1)
  itemSequence: int32;

  @doc("Adjudication amounts and categories for this item")
  adjudication: ClaimAdjudication[];
}

@doc("A single adjudication result — a category of amount with optional reason.")
model ClaimAdjudication {
  @doc("Category of adjudication (submitted, copay, eligible, benefit, deductible, unallocdeduct, eligpercent, tax, ar-amount)")
  category: CodeableConcept;

  @doc("Reason why the amount is different from the submitted amount (e.g., adjustment code)")
  reason?: CodeableConcept;

  @doc("Monetary amount associated with this adjudication category")
  amount?: Money;

  @doc("Non-monetary value (e.g., coinsurance percentage)")
  value?: float64;
}

@doc("Payment details in the claim response.")
model ClaimPayment {
  @doc("Whether the payment is complete or partial")
  type: CodeableConcept;

  @doc("Total amount of any adjustment being applied to the payment")
  adjustment?: Money;

  @doc("Reason for any payment adjustment")
  adjustmentReason?: CodeableConcept;

  @doc("Estimated date of payment")
  date?: utcDateTime;

  @doc("Total payment issued to the provider")
  amount: Money;

  @doc("Issuer's claim reference or check number")
  @maxLength(50)
  identifier?: string;
}

@doc("A note about the processing of this claim.")
model ClaimProcessNote {
  @doc("Note instance identifier")
  @minValue(1)
  number?: int32;

  @doc("The business purpose of the note text (display, print, printoper)")
  @maxLength(20)
  type?: string;

  @doc("The explanation or description associated with the processing")
  @maxLength(2000)
  text: string;

  @doc("Language of the text")
  language?: CodeableConcept;
}

@doc("Totals for a particular adjudication category in the claim response.")
model ClaimResponseTotal {
  @doc("The adjudication category total — submitted, eligible, benefit, etc.")
  category: CodeableConcept;

  @doc("Summed monetary value for the category")
  amount: Money;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A healthcare claim for billing. Aligns with FHIR R4 Claim.")
model Claim extends HealthcareBaseEntity {
  @doc("The status of the resource instance")
  status: ClaimStatus;

  @doc("Category of claim (institutional, oral, pharmacy, professional, vision)")
  type: CodeableConcept;

  @doc("A more granular claim category code")
  subType?: CodeableConcept;

  @doc("Whether the claim is for a completed service, pre-authorization, or pre-determination")
  use: ClaimUse;

  @doc("The party to whom the professional services and/or facility services were provided")
  patient: Reference;

  @doc("The period for which charges are being submitted")
  billablePeriod?: Period;

  @doc("The date this resource was created")
  created: utcDateTime;

  @doc("Person who created the claim")
  enterer?: Reference;

  @doc("Target insurer or adjudicator")
  insurer?: Reference;

  @doc("The provider who is legally responsible for this claim")
  provider: Reference;

  @doc("Desired processing priority (stat, normal, deferred)")
  priority: CodeableConcept;

  @doc("Prescription that initiated this claim")
  prescription?: Reference;

  @doc("Original prescription if superseded by this claim")
  originalPrescription?: Reference;

  @doc("Treatment referral")
  referral?: Reference;

  @doc("Servicing facility")
  facility?: Reference;

  @doc("Members of the care team")
  careTeam?: ClaimCareTeam[];

  @doc("Supporting information")
  supportingInfo?: ClaimSupportingInfo[];

  @doc("Pertinent diagnosis information")
  diagnosis: ClaimDiagnosis[];

  @doc("Clinical procedures performed")
  procedure?: ClaimProcedure[];

  @doc("Patient insurance information")
  insurance: ClaimInsurance[];

  @doc("Service line items being adjudicated")
  item: ClaimItem[];

  @doc("Total claim cost")
  total?: Money;
}

@doc("The adjudication response to a submitted Claim. Aligns with FHIR R4 ClaimResponse.")
model ClaimResponse extends HealthcareBaseEntity {
  @doc("The status of the resource instance")
  status: ClaimStatus;

  @doc("Category of claim (institutional, oral, pharmacy, professional, vision)")
  type: CodeableConcept;

  @doc("Whether the response is for a claim, pre-authorization, or pre-determination")
  use: ClaimUse;

  @doc("The party to whom the professional services were provided")
  patient: Reference;

  @doc("The date this resource was created")
  created: utcDateTime;

  @doc("Party responsible for reimbursement")
  insurer: Reference;

  @doc("Party responsible for the claim")
  requestor?: Reference;

  @doc("Reference to the original submitted Claim")
  request: Reference;

  @doc("The outcome of the claim, predetermination, or preauthorization processing")
  outcome: ClaimOutcome;

  @doc("A human readable description of the status of the adjudication")
  @maxLength(1000)
  disposition?: string;

  @doc("Preauthorization reference issued by the insurer")
  @maxLength(50)
  preAuthRef?: string;

  @doc("Party to be reimbursed")
  payeeType?: CodeableConcept;

  @doc("Adjudication for claim line items")
  item?: ClaimResponseItem[];

  @doc("Payment details for the adjudicated claim")
  payment?: ClaimPayment;

  @doc("Processing notes")
  processNote?: ClaimProcessNote[];

  @doc("Adjudication category totals")
  total?: ClaimResponseTotal[];
}

// ---------------------------------------------------------------------------
// Request / search models
// ---------------------------------------------------------------------------

@doc("Request body for submitting a Claim for adjudication.")
model ClaimSubmitRequest {
  @doc("The Claim to submit (must be in draft status)")
  claimId: string;
}

@doc("Search parameters for Claim resources.")
model ClaimSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by claim status")
  @query status?: ClaimStatus;

  @doc("Filter by claim use")
  @query use?: ClaimUse;

  @doc("Filter by insurer reference id")
  @query insurer?: string;

  @doc("Filter by provider reference id")
  @query provider?: string;

  @doc("Filter claims created at or after this date-time")
  @query dateFrom?: utcDateTime;

  @doc("Filter claims created at or before this date-time")
  @query dateTo?: utcDateTime;

  @doc("Page number (1-based)")
  @query page?: int32;

  @doc("Number of results per page")
  @query pageSize?: int32;
}

@doc("Search parameters for ClaimResponse resources.")
model ClaimResponseSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by insurer reference id")
  @query insurer?: string;

  @doc("Filter by claim response outcome")
  @query outcome?: ClaimOutcome;

  @doc("Filter by the original Claim reference id")
  @query request?: string;

  @doc("Filter responses created at or after this date-time")
  @query dateFrom?: utcDateTime;

  @doc("Filter responses created at or before this date-time")
  @query dateTo?: utcDateTime;

  @doc("Page number (1-based)")
  @query page?: int32;

  @doc("Number of results per page")
  @query pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD, search, and submission operations for Claim resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface ClaimManagement {
  @doc("Create a new Claim in draft status.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @operationId("createClaim")
  create(
    @body body: Claim,
  ): {
    @statusCode statusCode: 201;
    @body claim: Claim;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single Claim by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("getClaim")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body claim: Claim;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing Claim.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @put
  @operationId("updateClaim")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Claim,
  ): {
    @statusCode statusCode: 200;
    @body claim: Claim;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a Claim.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @patch
  @operationId("patchClaim")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body claim: Claim;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a Claim by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @delete
  @operationId("deleteClaim")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Submit a Claim to the insurer for adjudication, transitioning its status from draft to active.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @operationId("submitClaim")
  @route("/submit")
  submit(
    @body body: ClaimSubmitRequest,
  ): {
    @statusCode statusCode: 200;
    @body claim: Claim;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Search for Claim resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("searchClaims")
  @route("/search")
  search(
    ...ClaimSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Claim>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Read and search operations for ClaimResponse resources produced by adjudication.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface ClaimResponseManagement {
  @doc("Retrieve a single ClaimResponse by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("getClaimResponse")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body claimResponse: ClaimResponse;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for ClaimResponse resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("searchClaimResponses")
  @route("/search")
  search(
    ...ClaimResponseSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ClaimResponse>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
