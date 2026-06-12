import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Dental Retention Module (FR8.14 — retention enforcement observability / G2)
 *
 * The retention engine runs dry-run-by-default and env-gated: a clinic cannot
 * otherwise tell whether records are being archived per policy, or even that the
 * cron is acting. This read API surfaces an operator-visible status derived from
 * the `retention.*` compliance audit events the engine already writes — last run,
 * dry-run-vs-live mode, and the last run's counts — so enforcement is verifiable
 * without DB/env access. Admin-only.
 *
 * Contract source: docs/product/DATA_GOVERNANCE.md. RBAC (admin) is enforced both
 * via `x-security-required-roles` (generated middleware) and in-handler.
 */
namespace DentalRetentionModule {
  @doc("Mode of the most recent retention run")
  enum RetentionRunMode {
    @doc("The run archived eligible records (RETENTION_ENFORCEMENT_ENABLED=true)")
    enforced: "enforced",
    @doc("The run only counted eligible records without archiving")
    dryRun: "dry-run",
  }

  @doc("Operator-visible retention enforcement status (FR8.14)")
  model RetentionStatus {
    @doc("Whether the cron runs LIVE (archives) or dry-run only")
    enforcementEnabled: boolean;
    @doc("ISO 8601 UTC timestamp of the most recent retention run, or null if never run")
    lastRunAt: utcDateTime | null;
    @doc("Mode of the most recent run, or null if never run")
    lastRunMode: RetentionRunMode | null;
    @doc("Count of run-outcome events observed (dry_run + enforced)")
    runsObserved: int32;
    @doc("`actionedCount` recorded on the most recent run event")
    lastActionedCount: int32;
    @doc("`eligibleCount` recorded on the most recent run event")
    lastEligibleCount: int32;
  }

  @doc("Retention enforcement observability (admin-only)")
  interface RetentionManagement {
    @doc("Get retention enforcement status, optionally scoped to a tenant")
    @operationId("getRetentionStatus")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    getRetentionStatus(
      @query tenantId?: UUID,
    ): ApiOkResponse<RetentionStatus>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ErrorResponse;
  }
}
