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
 * Healthcare Administrative Prior Authorization — lifecycle management of prior
 * authorization requests from draft through submission, payer decision, and
 * expiry. Supports FHIR R4 CoverageEligibilityRequest / ClaimResponse patterns
 * and integrates with Coverage and Claims modules.
 */
namespace Healthcare.Administrative.PriorAuth;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

@doc("The lifecycle status of a prior authorization request.")
enum PriorAuthStatus {
  @doc("The request has been created but not yet submitted to the payer")
  draft,

  @doc("The request has been submitted to the payer and awaits acknowledgement")
  submitted,

  @doc("The request has been acknowledged and is under review by the payer")
  pending,

  @doc("The payer has approved the request in full")
  approved,

  @doc("The payer has approved a subset of the requested services or quantity")
  partiallyApproved,

  @doc("The payer has denied the request")
  denied,

  @doc("The request has been cancelled before or after submission")
  cancelled,

  @doc("An approved authorization that has passed its valid period end date")
  expired,
}

@doc("The payer's decision on a prior authorization request.")
enum PriorAuthDecision {
  @doc("The requested service has been fully approved")
  approved,

  @doc("The requested service has been approved for a reduced scope or quantity")
  partiallyApproved,

  @doc("The requested service has been denied")
  denied,

  @doc("A decision has been deferred; additional information may be required")
  deferred,
}

// ---------------------------------------------------------------------------
// Resource model
// ---------------------------------------------------------------------------

@doc("A prior authorization request submitted to an insurer for pre-approval of a healthcare service. Aligned with FHIR R4 CoverageEligibilityRequest / ClaimResponse patterns.")
model PriorAuthorization extends HealthcareBaseEntity {
  @doc("Current lifecycle status of the prior authorization")
  status: PriorAuthStatus;

  @doc("The patient for whom authorization is being requested")
  patient: Reference;

  @doc("The clinical encounter that generated this prior authorization request")
  encounter?: Reference;

  @doc("The service or procedure requiring authorization (CPT or SNOMED CT code)")
  requestedService: CodeableConcept;

  @doc("The practitioner requesting authorization on behalf of the patient")
  requestedBy: Reference;

  @doc("The insurer or payer organization to whom the request is directed")
  insurer: Reference;

  @doc("The patient coverage to be used for the authorized service")
  coverage: Reference;

  @doc("Free-text clinical justification notes supporting the authorization request")
  @maxLength(5000)
  clinicalNotes?: string;

  @doc("References to supporting clinical documents (lab results, imaging reports, referral letters)")
  supportingDocuments?: Reference[];

  @doc("Date and time when the prior authorization was submitted to the payer")
  submittedAt?: utcDateTime;

  @doc("Date and time when a decision response was received from the payer")
  responseReceivedAt?: utcDateTime;

  @doc("The payer's decision on the authorization request")
  decision?: PriorAuthDecision;

  @doc("Free-text reason provided by the payer for the decision (required for denials)")
  @maxLength(2000)
  decisionReason?: string;

  @doc("Authorization number issued by the payer upon approval")
  @maxLength(50)
  authorizationNumber?: string;

  @doc("The period during which an approved authorization is valid")
  validPeriod?: Period;

  @doc("Approved quantity when the payer partially approves (e.g., 6 of 12 requested sessions)")
  approvedQuantity?: Quantity;

  @doc("Clinical and administrative notes added throughout the authorization lifecycle")
  notes?: Annotation[];
}

// ---------------------------------------------------------------------------
// Request / search models
// ---------------------------------------------------------------------------

@doc("Request body for submitting a prior authorization to the payer.")
model PriorAuthSubmitRequest {
  @doc("The id of the PriorAuthorization to submit; must be in draft status")
  priorAuthorizationId: string;
}

@doc("Request body for transitioning a prior authorization to a new lifecycle status.")
model PriorAuthStatusTransitionRequest {
  @doc("The target lifecycle status for the prior authorization")
  status: PriorAuthStatus;

  @doc("Coded reason for the status transition")
  reason?: CodeableConcept;

  @doc("Payer's decision when transitioning to approved, partiallyApproved, or denied")
  decision?: PriorAuthDecision;

  @doc("Free-text reason from the payer explaining the decision")
  @maxLength(2000)
  decisionReason?: string;

  @doc("Authorization number issued by the payer on approval")
  @maxLength(50)
  authorizationNumber?: string;

  @doc("Valid period for an approved authorization")
  validPeriod?: Period;

  @doc("Approved service quantity for partial approvals")
  approvedQuantity?: Quantity;
}

@doc("Search parameters for PriorAuthorization resources.")
model PriorAuthSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by requesting practitioner reference id")
  @query requestedBy?: string;

  @doc("Filter by insurer (organization) reference id")
  @query insurer?: string;

  @doc("Filter by coverage reference id")
  @query coverage?: string;

  @doc("Filter by prior authorization status")
  @query status?: PriorAuthStatus;

  @doc("Filter by payer decision")
  @query decision?: PriorAuthDecision;

  @doc("Filter by service code (CPT or SNOMED)")
  @query serviceCode?: string;

  @doc("Filter requests submitted at or after this date-time")
  @query dateFrom?: utcDateTime;

  @doc("Filter requests submitted at or before this date-time")
  @query dateTo?: utcDateTime;

  @doc("When true, only return authorizations with a valid period covering the current date")
  @query activeOnly?: boolean;

  @doc("Page number (1-based)")
  @query page?: int32;

  @doc("Number of results per page")
  @query pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

@doc("CRUD, submission, search, and status transition operations for PriorAuthorization resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface PriorAuthorizationManagement {
  @doc("Create a new PriorAuthorization in draft status.")
  @post
  @operationId("createPriorAuthorization")
  create(
    @body body: PriorAuthorization,
  ): {
    @statusCode statusCode: 201;
    @body priorAuthorization: PriorAuthorization;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single PriorAuthorization by id.")
  @get
  @operationId("getPriorAuthorization")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body priorAuthorization: PriorAuthorization;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing PriorAuthorization.")
  @put
  @operationId("updatePriorAuthorization")
  @route("/{id}")
  update(
    @path id: string,
    @body body: PriorAuthorization,
  ): {
    @statusCode statusCode: 200;
    @body priorAuthorization: PriorAuthorization;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a PriorAuthorization.")
  @patch
  @operationId("patchPriorAuthorization")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body priorAuthorization: PriorAuthorization;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a PriorAuthorization by id.")
  @delete
  @operationId("deletePriorAuthorization")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Submit a prior authorization to the payer, transitioning its status from draft to submitted.")
  @post
  @operationId("submitPriorAuthorization")
  @route("/submit")
  submit(
    @body body: PriorAuthSubmitRequest,
  ): {
    @statusCode statusCode: 200;
    @body priorAuthorization: PriorAuthorization;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Transition a PriorAuthorization to a new lifecycle status (e.g., record payer decision).")
  @post
  @operationId("transitionPriorAuthorizationStatus")
  @route("/{id}/status")
  transitionStatus(
    @path id: string,
    @body body: PriorAuthStatusTransitionRequest,
  ): {
    @statusCode statusCode: 200;
    @body priorAuthorization: PriorAuthorization;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Search for PriorAuthorization resources using filter parameters.")
  @get
  @operationId("searchPriorAuthorizations")
  @route("/search")
  search(
    ...PriorAuthSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PriorAuthorization>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
