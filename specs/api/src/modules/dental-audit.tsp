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
 * Dental Audit Module
 *
 * Dental-specific, append-only compliance audit trail (table: dental_audit_log).
 * Append-only — no UPDATE or DELETE (AC-AUD-002). Read access is branch-scoped
 * and restricted to dentist_owner (AC-AUD-003).
 *
 * Contract source of truth: docs/product/modules/dental-audit/MODULE_SPEC.md §10.
 *
 * PHI safety (AC-AUD-004 / V-AUD-003): the viewer DTO carries only non-PHI fields.
 * The dental_audit_log table's beforeSnapshot/afterSnapshot JSONB columns are
 * NOT part of this contract and are never serialized in the viewer response.
 */
// Routes emit via the `DentalAuditMgmt` interface re-declared in main.tsp
// (@route/@tag live there, matching the other dental modules); the operation
// below carries no base route of its own.
namespace DentalAuditModule {

  @doc("Classification of an audited event against the domain event catalog")
  enum DentalAuditEventType {
    @doc("User authentication / session event")
    authentication: "authentication",

    @doc("PHI / record access")
    dataAccess: "data-access",

    @doc("Data modification")
    dataModification: "data-modification",

    @doc("Security-relevant event (e.g. denied access, lockout)")
    security: "security",

    @doc("Compliance event")
    compliance: "compliance",

    @doc("System configuration change")
    systemConfig: "system-config",
  }

  // ==========================================================================
  // Models
  // ==========================================================================

  @example(#{
    id: "ae-1a2b3c4d-0000-4000-8000-000000000001",
    createdAt: utcDateTime.fromISO("2026-05-26T09:00:00Z"),
    updatedAt: utcDateTime.fromISO("2026-05-26T09:00:00Z"),
    version: 1,
    branchId: "br-1a2b3c4d-0000-4000-8000-000000000001",
    tenantId: "or-1a2b3c4d-0000-4000-8000-000000000001",
    actorId: "p1a2b3c4-0000-4000-8000-000000000001",
    actorRole: "dentist_owner",
    eventType: DentalAuditEventType.dataModification,
    action: "invoice.voided",
    resourceType: "dental_invoice",
    resourceId: "in-1a2b3c4d-0000-4000-8000-000000000001",
    reason: null,
    ipAddress: null,
    userAgent: null,
    metadata: null,
    timestamp: utcDateTime.fromISO("2026-05-26T09:00:00Z"),
  }, #{ title: "Invoice voided — data modification event" })
  @doc("A single append-only dental audit event (viewer DTO — no PHI snapshots)")
  model DentalAuditEvent extends BaseEntity {
    @doc("Branch the event occurred in (audit viewer is always branch-scoped)")
    branchId: UUID | null;

    @doc("Tenant (organization) the event belongs to")
    tenantId: UUID;

    @doc("Actor who performed the action (UUID only — never a name)")
    actorId: UUID;

    @doc("Membership role the actor held at time of the event")
    actorRole: string | null;

    @doc("Event classification against the domain event catalog")
    eventType: DentalAuditEventType | null;

    @doc("Action performed (e.g. 'invoice.voided', 'visit.complete')")
    action: string;

    @doc("Type of the affected resource (e.g. 'dental_invoice')")
    resourceType: string;

    @doc("UUID of the affected resource — null for non-entity events")
    resourceId: UUID | null;

    @doc("Optional reason supplied with the action")
    reason: string | null;

    @doc("Request IP address (web requests only; null offline-first)")
    ipAddress: string | null;

    @doc("Request user agent (web requests only)")
    userAgent: string | null;

    @doc("Safe, non-PHI context (IDs, counts, status/CDT codes, flags)")
    metadata: Record<unknown> | null;

    @doc("When the event occurred (ISO 8601 UTC)")
    timestamp: utcDateTime;
  }

  @doc("Pagination metadata for the audit viewer response")
  model DentalAuditEventsMeta {
    @doc("Total number of events matching the filter")
    total: int32;

    @doc("Items per page")
    limit: int32;

    @doc("Current offset")
    offset: int32;
  }

  @doc("Paginated audit events response")
  model DentalAuditEventsResponse {
    @doc("Audit events for the current page")
    data: DentalAuditEvent[];

    @doc("Pagination metadata")
    meta: DentalAuditEventsMeta;
  }

  // ==========================================================================
  // Interface
  // ==========================================================================

  @doc("Dental audit log viewer (append-only; read-only via API)")
  interface DentalAuditManagement {
    @doc("List branch-scoped audit events with filtering and pagination")
    @operationId("getAuditEvents")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getAuditEvents(
      @doc("Branch to query — REQUIRED; the viewer is always branch-scoped")
      @query branchId: UUID,

      @doc("Filter by acting user UUID")
      @query actorId?: UUID,

      @doc("Filter by event classification")
      @query eventType?: DentalAuditEventType,

      @doc("Filter by action (e.g. 'invoice.voided')")
      @query action?: SafeQueryString,

      @doc("Filter by affected resource type")
      @query targetType?: SafeQueryString,

      @doc("Filter by affected resource UUID")
      @query targetId?: UUID,

      @doc("Start of the date range, inclusive (ISO 8601 UTC)")
      @query from?: StrictUtcDateTime,

      @doc("End of the date range, inclusive (ISO 8601 UTC). Must be >= from")
      @query to?: StrictUtcDateTime,

      @doc("Max items per page (capped at 200)")
      @query limit?: int32,

      @doc("Offset for pagination")
      @query offset?: int32,
    ): ApiOkResponse<DentalAuditEventsResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ErrorResponse;
  }
}
