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
 * Healthcare De-Identification module.
 *
 * Provides models and operations for defining de-identification profiles,
 * managing pseudonymisation mappings, and executing de-identification
 * pipelines to transform protected health information (PHI) for research
 * and analytics use cases. Supports HIPAA Safe Harbor, Expert Determination,
 * k-Anonymity, l-Diversity, t-Closeness, and custom methods.
 */
namespace Healthcare.Analytics.DeIdentification;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The de-identification method applied by a profile.")
enum DeIdMethod {
  @doc("HIPAA Safe Harbor method — removes all 18 identifiers listed in 45 CFR §164.514(b)(2)")
  safeHarbor,

  @doc("HIPAA Expert Determination method — a statistical or scientific expert certifies that risk of re-identification is very small")
  expertDetermination,

  @doc("k-Anonymity — each record is indistinguishable from at least k-1 others with respect to quasi-identifying attributes")
  kAnonymity,

  @doc("l-Diversity — extends k-anonymity by requiring at least l well-represented values for each sensitive attribute in an equivalence class")
  lDiversity,

  @doc("t-Closeness — extends l-diversity by requiring the distribution of a sensitive attribute in each equivalence class to be close to its distribution in the overall dataset")
  tCloseness,

  @doc("A custom de-identification method defined by the implementation")
  custom,
}

@doc("The publication status of a de-identification profile.")
enum ProfileStatus {
  @doc("The profile is under development and not yet approved for use")
  draft,

  @doc("The profile is approved and available for use in production de-identification pipelines")
  active,

  @doc("The profile has been superseded or withdrawn and should no longer be used")
  retired,
}

@doc("The action to apply to a field during de-identification.")
enum DeIdAction {
  @doc("Remove the field entirely from the output")
  remove,

  @doc("Replace a precise value with a less precise one (e.g., exact age → age range)")
  generalize,

  @doc("Replace the real value with a consistent but meaningless surrogate")
  pseudonymize,

  @doc("Shift date values by a random offset to obscure exact dates while preserving intervals")
  dateShift,

  @doc("Replace characters with a masking character (e.g., asterisks) while retaining length")
  mask,

  @doc("Remove trailing characters to reduce precision (e.g., 5-digit ZIP → 3-digit ZIP)")
  truncate,

  @doc("Add statistical noise to numeric values to prevent exact identification")
  noise,

  @doc("Replace the value with a null or empty value")
  suppress,

  @doc("Replace the value with a redaction marker (e.g., [REDACTED])")
  redact,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * A single rule specifying how a particular field should be transformed
 * during the de-identification process.
 */
model DeIdRule {
  /** The field path to which this rule applies (e.g., "patient.birthDate", "name[*].given"). */
  field: string;

  /** The de-identification action to apply to this field. */
  action: DeIdAction;

  /** Optional parameters controlling the de-identification action (e.g., noise level, date shift range, masking character). */
  parameters?: Record<unknown>;
}

// ---------------------------------------------------------------------------
// Root resource — DeIdentificationProfile
// ---------------------------------------------------------------------------

/**
 * A reusable specification of how to de-identify a dataset, including the
 * method, transformation rules, and metadata about what is retained or removed.
 */
model DeIdentificationProfile extends HealthcareBaseEntity {
  /** A human-friendly name for this de-identification profile. */
  name: string;

  /** A free-text description of the profile and its intended use. */
  description?: string;

  /** The de-identification method applied by this profile. */
  method: DeIdMethod;

  /** The publication status of this profile. */
  status: ProfileStatus;

  /** The ordered list of field-level transformation rules applied by this profile. */
  rules: DeIdRule[];

  /** A list of field paths that are explicitly retained in the de-identified output. */
  retainedElements?: string[];

  /** A list of field paths that are explicitly removed from the de-identified output. */
  removedElements?: string[];
}

// ---------------------------------------------------------------------------
// Root resource — PseudonymizationMap
// ---------------------------------------------------------------------------

/**
 * A mapping between a real source identifier and its pseudonym, created
 * during pseudonymisation. These records are kept in a secure vault to
 * enable re-identification only under authorised circumstances.
 */
model PseudonymizationMap extends HealthcareBaseEntity {
  /** The de-identification profile under which this pseudonymisation mapping was created. */
  profile: Reference;

  @doc("SENSITIVE — Contains PHI (Protected Health Information). This field MUST be stored encrypted at rest. Access restricted to authorized privacy officers only. Never included in standard API responses.")
  sourceIdentifier: string;

  /** The pseudonym assigned to the source identifier. */
  pseudonym: string;

  /** The date and time at which this pseudonymisation mapping was created. */
  createdAt: utcDateTime;

  /** The date and time at which this pseudonymisation mapping expires, after which re-identification using this mapping is no longer permitted. */
  expiresAt?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Operation models
// ---------------------------------------------------------------------------

/** Request body for executing a de-identification pipeline. */
model DeIdentificationExecuteRequest {
  /** The de-identification profile to apply. */
  profileId: string;

  /** The resource type of the input data (e.g., "Patient", "Observation", "Bundle"). */
  resourceType: string;

  /** The raw resource data to de-identify, represented as an arbitrary JSON object. */
  resource: Record<unknown>;

  /** If true, create and persist pseudonymisation mapping records for any pseudonymised fields. */
  persistMappings?: boolean;
}

/** Response body for a successful de-identification execution. */
model DeIdentificationExecuteResponse {
  /** The de-identified resource. */
  resource: Record<unknown>;

  /** The ids of pseudonymisation mapping records created during this execution, if any. */
  pseudonymizationMapIds?: string[];

  /** Summary statistics about the transformations applied. */
  summary: DeIdentificationSummary;
}

/** A summary of the transformations performed during a de-identification execution. */
model DeIdentificationSummary {
  /** The total number of fields processed. */
  fieldsProcessed: int32;

  /** The number of fields removed. */
  fieldsRemoved: int32;

  /** The number of fields transformed (generalised, masked, shifted, etc.). */
  fieldsTransformed: int32;

  /** The number of pseudonymisation mappings created. */
  mappingsCreated: int32;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/** Query parameters for searching DeIdentificationProfile resources. */
model DeIdentificationProfileSearchParams {
  /** Filter by profile name (partial match). */
  @query name?: string;

  /** Filter by de-identification method. */
  @query method?: string;

  /** Filter by profile status. */
  @query status?: string;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD operations for DeIdentificationProfile resources and execution of
 * de-identification pipelines.
 */
@tag("Healthcare:Analytics")
@useAuth(bearerAuth)
interface DeIdentificationManagement {
  /** Create a new DeIdentificationProfile. */
  @extension("x-security-required-roles", #["admin", "researcher", "privacy-officer"])
  @post
  @operationId("createDeIdentificationProfile")
  create(
    @body body: DeIdentificationProfile,
  ): {
    @statusCode statusCode: 201;
    @body deIdentificationProfile: DeIdentificationProfile;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single DeIdentificationProfile by id. */
  @extension("x-security-required-roles", #["admin", "researcher", "privacy-officer"])
  @get
  @operationId("getDeIdentificationProfile")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body deIdentificationProfile: DeIdentificationProfile;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing DeIdentificationProfile. */
  @extension("x-security-required-roles", #["admin", "researcher", "privacy-officer"])
  @put
  @operationId("updateDeIdentificationProfile")
  @route("/{id}")
  update(
    @path id: string,
    @body body: DeIdentificationProfile,
  ): {
    @statusCode statusCode: 200;
    @body deIdentificationProfile: DeIdentificationProfile;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update a DeIdentificationProfile. */
  @extension("x-security-required-roles", #["admin", "researcher", "privacy-officer"])
  @patch
  @operationId("patchDeIdentificationProfile")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body deIdentificationProfile: DeIdentificationProfile;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete a DeIdentificationProfile by id. */
  @extension("x-security-required-roles", #["admin", "researcher", "privacy-officer"])
  @delete
  @operationId("deleteDeIdentificationProfile")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for DeIdentificationProfiles using filter parameters. */
  @extension("x-security-required-roles", #["admin", "researcher", "privacy-officer"])
  @get
  @operationId("searchDeIdentificationProfiles")
  @route("/search")
  search(
    ...DeIdentificationProfileSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<DeIdentificationProfile>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Execute a de-identification pipeline against a resource using a specified profile. */
  @extension("x-security-required-roles", #["admin", "researcher", "privacy-officer"])
  @post
  @operationId("executeDeIdentification")
  @extension("x-security-required-roles", #["privacy-officer"])
  @route("/execute")
  execute(
    @body body: DeIdentificationExecuteRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: DeIdentificationExecuteResponse;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
