import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Dental Erasure Module (V-DG-002 / WFG-006)
 *
 * Right-to-erasure (GDPR Art.17 / RA 10173 §34) as a two-step, auditable
 * workflow over `dental_erasure_request`: request → approve / reject. Approval
 * runs ANONYMIZATION (PII redacted in place, de-identified row kept) — never a
 * hard delete; the audit trail is never touched; an active legal hold blocks
 * erasure. Admin-only.
 *
 * Contract source: docs/product/DATA_GOVERNANCE.md §3.
 * Routes emit via the `DentalErasureMgmt` interface re-declared in main.tsp
 * (the @route/@tag live on that service-namespace interface, matching the other
 * dental modules); operations below carry only relative sub-routes.
 */
namespace DentalErasureModule {

  @doc("Lifecycle of an erasure request")
  enum ErasureRequestStatus {
    @doc("Requested; nothing mutated yet")
    requested: "requested",
    @doc("Approved; transient state before anonymization runs")
    approved: "approved",
    @doc("PII anonymization completed (terminal success)")
    anonymized: "anonymized",
    @doc("Declined by reviewer or blocked by legal hold (terminal)")
    rejected: "rejected",
  }

  @doc("An erasure request record")
  model ErasureRequest extends BaseEntity {
    @doc("Person (central PII record) targeted for erasure")
    subjectPersonId: UUID;
    @doc("Optional patient profile link")
    subjectPatientId: UUID | null;
    @doc("Tenant (organization) context")
    tenantId: UUID;
    @doc("Branch context, if any")
    branchId: UUID | null;
    @doc("Current lifecycle status")
    status: ErasureRequestStatus;
    @doc("Why erasure was requested")
    reason: string;
    @doc("Actor who requested erasure")
    requestedBy: UUID;
    @doc("Reviewer who approved/rejected")
    reviewedBy: UUID | null;
    @doc("When reviewed (ISO 8601 UTC)")
    reviewedAt: utcDateTime | null;
    @doc("When anonymization completed (ISO 8601 UTC)")
    processedAt: utcDateTime | null;
    @doc("Reason supplied on rejection")
    rejectionReason: string | null;
    @doc("True if the request was refused because the subject was under a legal hold")
    legalHoldBlocked: boolean;
  }

  @doc("Body to request erasure of a subject")
  model RequestErasureRequest {
    subjectPersonId: UUID;
    subjectPatientId?: UUID;
    tenantId: UUID;
    branchId?: UUID;
    @doc("Reason for the erasure request")
    reason: string;
  }

  @doc("Body to approve an erasure request")
  model ApproveErasureRequest {
    @doc("Reviewer assertion that the subject is under an active legal hold (blocks erasure)")
    legalHold?: boolean;
  }

  @doc("Body to reject an erasure request")
  model RejectErasureRequest {
    @doc("Reason for the rejection")
    rejectionReason: string;
  }

  @doc("List of erasure requests")
  model ErasureRequestList {
    data: ErasureRequest[];
  }

  @doc("Right-to-erasure workflow (admin-only)")
  interface ErasureManagement {
    @doc("Request erasure of a subject's PII")
    @operationId("requestErasure")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    requestErasure(
      @body body: RequestErasureRequest,
    ): ApiCreatedResponse<ErasureRequest>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ErrorResponse;

    @doc("List erasure requests with optional filters")
    @operationId("listErasureRequests")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listErasureRequests(
      @query status?: ErasureRequestStatus,
      @query subjectPersonId?: UUID,
      @query tenantId?: UUID,
    ): ApiOkResponse<ErasureRequestList>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ErrorResponse;

    @doc("Fetch a single erasure request")
    @operationId("getErasureRequest")
    @get
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getErasureRequest(
      @path id: UUID,
    ): ApiOkResponse<ErasureRequest>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Approve an erasure request — runs anonymization (legal hold blocks it)")
    @operationId("approveErasure")
    @post
    @route("/{id}/approve")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    approveErasure(
      @path id: UUID,
      @body body: ApproveErasureRequest,
    ): ApiOkResponse<ErasureRequest>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Reject an erasure request with a reason")
    @operationId("rejectErasure")
    @post
    @route("/{id}/reject")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    rejectErasure(
      @path id: UUID,
      @body body: RejectErasureRequest,
    ): ApiOkResponse<ErasureRequest>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }
}
