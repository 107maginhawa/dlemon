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
 * Break-Glass Emergency Access module.
 *
 * Provides the mechanism for clinicians to override normal access controls
 * in emergency situations where a patient is unavailable to provide consent
 * or when immediate access to restricted records is required to prevent harm.
 * Every break-glass activation is logged, reviewed, and can trigger automated
 * compliance alerts. Aligns with HIPAA emergency access provision and
 * HL7 FHIR AuditEvent requirements.
 */
namespace Healthcare.Support.BreakGlass;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Clinical or administrative reason justifying a break-glass access override.")
enum BreakGlassReason {
  @doc("Patient is receiving emergency treatment and delay in access would compromise care")
  emergencyTreatment,
  @doc("There is an immediate, credible threat to the life of the patient or others")
  immediateThreatToLife,
  @doc("Patient is unable to provide consent (unconscious, incapacitated) and no surrogate is available")
  patientUnavailableForConsent,
  @doc("A declared public health emergency requires access to patient data without normal consent")
  publicHealthEmergency,
  @doc("Reason not covered by other categories — justification field is mandatory")
  other,
}

@doc("Lifecycle status of a break-glass override record.")
enum BreakGlassStatus {
  @doc("Override is currently in effect and the clinician may access restricted data")
  active,
  @doc("Override has passed its expiry time and is no longer effective")
  expired,
  @doc("Override has been reviewed by a compliance officer or supervisor")
  reviewed,
  @doc("Override has been flagged for compliance or clinical review")
  flaggedForReview,
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

@doc("A break-glass emergency access override record. Created when a clinician bypasses normal access controls in an emergency. Every override must be reviewed post-hoc by a compliance officer.")
model BreakGlassOverride extends HealthcareBaseEntity {
  @doc("Reference to the Practitioner activating the break-glass override")
  practitioner: Reference;

  @doc("Reference to the Patient whose restricted records are being accessed")
  patient: Reference;

  @doc("Reference to the Encounter in which the emergency access occurred, if known")
  encounter?: Reference;

  @doc("Clinical reason for activating the break-glass override")
  reason: BreakGlassReason;

  @doc("Detailed clinical justification for the emergency access — required when reason is 'other' or when sensitive category overrides are present")
  justification: string;

  @doc("Date and time the override was activated")
  activatedAt: utcDateTime;

  @doc("Date and time at which the override automatically expires. Default is four hours after activation.")
  expiresAt: utcDateTime;

  @doc("Date and time the override actually expired (may be earlier than expiresAt if manually closed)")
  expiredAt?: utcDateTime;

  @doc("References to the resources that were accessed under this override")
  resourcesAccessed?: Reference[];

  @doc("Sensitive data categories for which normal restrictions were bypassed")
  sensitivityOverrides?: SensitiveDataCategory[];

  @doc("Current lifecycle status of the override")
  status: BreakGlassStatus;

  @doc("Date and time the post-hoc review was completed")
  reviewedAt?: utcDateTime;

  @doc("Reference to the Practitioner or compliance officer who conducted the review")
  reviewedBy?: Reference;

  @doc("Outcome of the post-hoc review (e.g., 'Justified', 'Unjustified — refer to compliance')")
  reviewOutcome?: string;

  @doc("Reference to the AuditEvent resource created when this override was activated")
  auditEventRef?: Reference;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for break-glass override records.")
model BreakGlassOverrideSearchParams {
  @doc("Filter by practitioner reference ID") @query practitioner?: string;
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by override status") @query status?: BreakGlassStatus;
  @doc("Filter by activation reason") @query reason?: BreakGlassReason;
  @doc("Filter overrides activated at or after this date-time") @query activatedFrom?: utcDateTime;
  @doc("Filter overrides activated at or before this date-time") @query activatedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

@doc("Break-glass emergency access service. Provides activation, retrieval, search, and post-hoc review of emergency access overrides.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/emergency-access")
interface BreakGlassService {
  @doc("Activate a break-glass emergency access override. Creates an override record and an associated AuditEvent. The activating practitioner must supply a clinical justification.")
  @operationId("activateBreakGlass")
  @extension("x-security-required-roles", #["clinician"])
  @post
  activateBreakGlass(
    @body body: BreakGlassOverride,
  ): {
    @statusCode statusCode: 201;
    @body result: BreakGlassOverride;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a break-glass override record by its logical ID.")
  @operationId("getBreakGlassOverride")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getBreakGlassOverride(
    @path @doc("BreakGlassOverride logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: BreakGlassOverride;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search break-glass override records by practitioner, patient, date range, or status.")
  @operationId("searchBreakGlassOverrides")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchBreakGlassOverrides(
    ...BreakGlassOverrideSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<BreakGlassOverride>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Submit a post-hoc review of a break-glass override. Marks the record as reviewed and records the review outcome. Only compliance officers and administrators may review overrides.")
  @operationId("reviewBreakGlassOverride")
  @extension("x-security-required-roles", #["admin"])
  @post
  @route("/{id}/review")
  reviewBreakGlassOverride(
    @path @doc("BreakGlassOverride logical ID") id: UUID,
    @body body: {
      @doc("Outcome of the review (e.g., 'Justified', 'Unjustified — refer to compliance')") reviewOutcome: string;
      @doc("Whether the override should be flagged for further compliance action") flagForCompliance?: boolean;
    },
  ): {
    @statusCode statusCode: 200;
    @body result: BreakGlassOverride;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
