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
 * Proxy Access Management module.
 *
 * Manages delegated access grants that allow a proxy (e.g., parent, guardian,
 * personal representative) to act on behalf of a patient. Supports granular
 * scope control, sensitive data exclusions, and adolescent confidentiality
 * age thresholds in compliance with applicable state and federal law.
 */
namespace Healthcare.Support.ProxyAccess;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The scope of access granted to the proxy on behalf of the patient.")
enum ProxyAccessScope {
  @doc("Full access equivalent to the patient — read and write across all permitted resources")
  full,
  @doc("Limited access — read-only on a defined subset of resources")
  limited,
  @doc("Emergency situations only — access is restricted to emergency-treatment context")
  emergencyOnly,
  @doc("Read-only access across all permitted resources without write capability")
  readOnly,
}

@doc("Lifecycle status of a proxy access grant.")
enum ProxyAccessStatus {
  @doc("Grant request is awaiting approval or patient consent confirmation")
  pending,
  @doc("Grant is active and the proxy may exercise the delegated access")
  active,
  @doc("Grant has been temporarily suspended pending review")
  suspended,
  @doc("Grant has passed its expiry date and is no longer effective")
  expired,
  @doc("Grant was explicitly revoked before its expiry date")
  revoked,
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("A proxy access grant delegating a patient's healthcare record access to another party. Extends HealthcareBaseEntity to inherit tenancy, identifiers, sensitivity labels, and audit fields.")
model ProxyAccessGrant extends HealthcareBaseEntity {
  @doc("Reference to the Patient for whom proxy access is being granted")
  patient: Reference;

  @doc("Reference to the proxy — typically a RelatedPerson or another Patient resource")
  proxy: Reference;

  @doc("Relationship of the proxy to the patient (e.g., parent, guardian, spouse, personal representative)")
  relationship: CodeableConcept;

  @doc("Scope of access delegated to the proxy")
  scope: ProxyAccessScope;

  @doc("Current lifecycle status of the grant")
  status: ProxyAccessStatus;

  @doc("Date and time the grant was created/activated")
  grantedAt: utcDateTime;

  @doc("Reference to the Practitioner or User who created the grant")
  grantedBy: Reference;

  @doc("Date and time at which the grant automatically expires. Omit for indefinite grants.")
  expiresAt?: utcDateTime;

  @doc("Date and time the grant was revoked, if revoked before expiry")
  revokedAt?: utcDateTime;

  @doc("Reference to the Practitioner or User who revoked the grant")
  revokedBy?: Reference;

  @doc("Reason provided for revoking the grant")
  revokedReason?: string;

  @doc("Sensitive data categories that the proxy is explicitly EXCLUDED from accessing, regardless of scope")
  excludedCategories?: SensitiveDataCategory[];

  @doc("Jurisdiction-specific age at which a minor gains independent confidential access. When the patient reaches this age, the grant may be automatically suspended pending review.")
  adolescentAge?: int32;

  @doc("Reference to the associated Consent resource that formally authorises this proxy grant")
  consentReference?: Reference;

  @doc("Free-text note recorded at the time the grant was created")
  note?: string;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for proxy access grants.")
model ProxyAccessGrantSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by proxy reference ID") @query proxy?: string;
  @doc("Filter by grant status") @query status?: ProxyAccessStatus;
  @doc("Filter by scope") @query scope?: ProxyAccessScope;
  @doc("Filter grants active at or after this date-time") @query activeFrom?: utcDateTime;
  @doc("Filter grants expiring at or before this date-time") @query expiresTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

@doc("Proxy access grant management — create, retrieve, update, search, and revoke delegated access grants on behalf of patients.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/proxy-access")
interface ProxyAccessManagement {
  @doc("Create a new proxy access grant.")
  @operationId("createProxyAccessGrant")
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @post
  createProxyAccessGrant(
    @body body: ProxyAccessGrant,
  ): {
    @statusCode statusCode: 201;
    @body result: ProxyAccessGrant;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a proxy access grant by its logical ID.")
  @operationId("getProxyAccessGrant")
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @get
  @route("/{id}")
  getProxyAccessGrant(
    @path @doc("ProxyAccessGrant logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ProxyAccessGrant;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a proxy access grant — used to change scope, expiry, or excluded categories.")
  @operationId("updateProxyAccessGrant")
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @put
  @route("/{id}")
  updateProxyAccessGrant(
    @path @doc("ProxyAccessGrant logical ID") id: UUID,
    @body body: ProxyAccessGrant,
  ): {
    @statusCode statusCode: 200;
    @body result: ProxyAccessGrant;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a proxy access grant record.")
  @operationId("deleteProxyAccessGrant")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteProxyAccessGrant(
    @path @doc("ProxyAccessGrant logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search proxy access grants by patient, proxy, status, or date range.")
  @operationId("searchProxyAccessGrants")
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @get
  @route("/search")
  searchProxyAccessGrants(
    ...ProxyAccessGrantSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ProxyAccessGrant>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Revoke an active proxy access grant before its expiry date.")
  @operationId("revokeProxyAccessGrant")
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @post
  @route("/{id}/revoke")
  revokeProxyAccessGrant(
    @path @doc("ProxyAccessGrant logical ID") id: UUID,
    @body body: {
      @doc("Reason for revoking the grant") reason: string;
    },
  ): {
    @statusCode statusCode: 200;
    @body result: ProxyAccessGrant;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
