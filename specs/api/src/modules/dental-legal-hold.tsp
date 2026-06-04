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
 * Dental Legal-Hold Module (V-DG-002 support / WFG-006)
 *
 * A legal hold suspends data-governance actions (retention + erasure) for a
 * subject while litigation/investigation is pending. The erasure engine consults
 * this store: a subject with an ACTIVE hold is never anonymized. Releasing a hold
 * resumes normal schedules. Admin-only.
 *
 * Contract source: docs/product/DATA_GOVERNANCE.md §3. RBAC (admin) is enforced
 * in-handler; routes emit via `DentalLegalHoldMgmt` in main.tsp.
 */
namespace DentalLegalHoldModule {
  @doc("Lifecycle of a legal hold")
  enum LegalHoldStatus {
    @doc("Hold is active; data-governance actions on the subject are blocked")
    active: "active",
    @doc("Hold has been released; normal schedules resume")
    released: "released",
  }

  @doc("A legal-hold record")
  model LegalHold extends BaseEntity {
    @doc("Tenant (organization) context")
    tenantId: UUID;
    @doc("Branch context, if any")
    branchId: UUID | null;
    @doc("Person (central PII record) whose data is held")
    subjectPersonId: UUID;
    @doc("Human-readable hold name / matter label")
    name: string;
    @doc("Why the hold was placed")
    reason: string;
    @doc("Current lifecycle status")
    status: LegalHoldStatus;
    @doc("Actor who placed the hold")
    initiatedBy: UUID;
    @doc("Actor who released the hold")
    releasedBy: UUID | null;
    @doc("When released (ISO 8601 UTC)")
    releasedAt: utcDateTime | null;
    @doc("Optional free-text note")
    note: string | null;
  }

  @doc("Body to place a legal hold on a subject")
  model PlaceLegalHoldRequest {
    tenantId: UUID;
    subjectPersonId: UUID;
    branchId?: UUID;
    @doc("Human-readable hold name / matter label")
    name: string;
    @doc("Why the hold is being placed")
    reason: string;
    @doc("Optional free-text note")
    note?: string;
  }

  @doc("Right-to-erasure legal-hold workflow (admin-only)")
  interface LegalHoldManagement {
    @doc("Place a legal hold on a subject")
    @operationId("placeLegalHold")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    placeLegalHold(
      @body body: PlaceLegalHoldRequest,
    ): ApiCreatedResponse<LegalHold>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ErrorResponse;

    @doc("List legal holds with optional filters")
    @operationId("listLegalHolds")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listLegalHolds(
      @query status?: LegalHoldStatus,
      @query subjectPersonId?: UUID,
      @query tenantId?: UUID,
    ): ApiOkResponse<LegalHold[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ErrorResponse;

    @doc("Release an active legal hold")
    @operationId("releaseLegalHold")
    @post
    @route("/{id}/release")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    releaseLegalHold(
      @path id: UUID,
    ): ApiOkResponse<LegalHold>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }
}
