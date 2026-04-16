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
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * FHIR Extended Operations ($ operations) — server-level and resource-level
 * named operations defined by the FHIR specification beyond the standard CRUD
 * and search interactions.
 *
 * Covered operations: $match, $everything, $validate, $document.
 * All operations follow the FHIR R4 operation framework (http://hl7.org/fhir/operations.html).
 */
namespace Healthcare.Conformance.Operations;

// ---------------------------------------------------------------------------
// Patient $match
// ---------------------------------------------------------------------------

@doc("Input parameters for the FHIR $match operation, which performs probabilistic patient matching against the master patient index.")
model PatientMatchRequest {
  @doc("A Patient resource representing the patient to be matched. The resource need not be persisted — it acts as a query template. The server will compare identifying attributes (name, DOB, address, identifiers) against its patient registry.")
  resource: Record<unknown>;

  @doc("If true, the server returns only results with a high confidence score. This reduces recall in favour of precision, which is appropriate for automated merge workflows where a false positive would be harmful.")
  onlyCertainMatches?: boolean;

  @doc("Maximum number of ranked match candidates to return. Defaults to server-defined limit when omitted.")
  count?: int32;
}

@doc("An individual match candidate entry returned by the $match operation.")
model PatientMatchEntry {
  @doc("Reference to the matched Patient resource in the registry")
  resource: Reference;

  @doc("Match scoring information associated with this candidate")
  search: {
    @doc("Confidence score in the range [0.0, 1.0] where 1.0 represents a certain match. Scores below the server's threshold are excluded from results.")
    @minValue(0.0)
    @maxValue(1.0)
    score: float64;
  };
}

@doc("Response bundle returned by the FHIR Patient $match operation, containing ranked match candidates from the master patient index.")
model PatientMatchResponse {
  @doc("Ranked match candidates ordered by descending confidence score")
  entry: PatientMatchEntry[];
}

// ---------------------------------------------------------------------------
// Patient $everything
// ---------------------------------------------------------------------------

@doc("Query parameters for the Patient $everything operation, which retrieves all resources associated with a patient in a single response Bundle.")
model PatientEverythingParams {
  @doc("ISO 8601 date — only return resources with a relevant date at or after this value")
  @query
  start?: string;

  @doc("ISO 8601 date — only return resources with a relevant date at or before this value")
  @query
  end?: string;

  @doc("Comma-separated list of FHIR resource type names to include (e.g., 'Observation,Condition'). When omitted all supported resource types are returned.")
  @query
  _type?: string;

  @doc("Maximum number of resources to return per page when the server pages large patient compartments")
  @query
  _count?: int32;
}

// ---------------------------------------------------------------------------
// $validate
// ---------------------------------------------------------------------------

@doc("Input parameters for the FHIR $validate operation, which checks a resource against a profile for conformance errors and warnings.")
model ValidationRequest {
  @doc("The FHIR resource to be validated. The resource type is determined from the 'resourceType' field within the object.")
  resource: Record<unknown>;

  @doc("Canonical URL of the profile to validate the resource against. When omitted, the server validates against the base FHIR resource profile.")
  @format("uri")
  profile?: string;

  @doc("Validation mode that guides what aspects are checked (create | update | delete | profile). Defaults to 'create'.")
  mode?: string;
}

@doc("The severity level of an individual validation issue. Aligns with FHIR IssueSeverity.")
enum IssueSeverity {
  @doc("The issue caused the action to fail and no further checking could be performed")
  fatal,

  @doc("The issue is sufficiently important to cause the action to fail")
  error,

  @doc("The issue is not important enough to cause the action to fail but may cause problems in the future")
  warning,

  @doc("The issue does not indicate a problem; it is provided for informational purposes")
  information,
}

@doc("A single conformance issue found during FHIR resource validation.")
model ValidationIssue {
  @doc("Severity of this issue — determines whether the resource can be considered valid")
  severity: IssueSeverity;

  @doc("FHIR issue type code (e.g., 'required', 'value', 'invariant', 'structure')")
  code: string;

  @doc("Human-readable description of what is wrong, why, and (where possible) how to fix it")
  details?: string;

  @doc("FHIRPath expression(s) identifying the element(s) in the resource that caused this issue")
  expression?: string[];
}

@doc("Response returned by the FHIR $validate operation, containing a list of conformance issues found in the submitted resource.")
model ValidationResponse {
  @doc("List of validation issues found. An empty array indicates the resource is fully conformant.")
  issues: ValidationIssue[];
}

// ---------------------------------------------------------------------------
// Composition $document
// ---------------------------------------------------------------------------

@doc("Input parameters for the Composition $document operation, which assembles a self-contained FHIR Document Bundle from an existing Composition resource.")
model DocumentBundleRequest {
  @doc("Logical ID of the Composition resource to assemble into a document")
  id: string;

  @doc("If true, the server stores the generated Bundle as a persistent resource and returns its ID in the response Location header. Defaults to false (transient document).")
  persist?: boolean;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

@doc("FHIR extended operation endpoints ($ operations) providing advanced clinical and administrative capabilities beyond standard CRUD. All operations require clinical or administrative roles.")
@tag("Healthcare:Conformance")
@useAuth(bearerAuth)
@route("/fhir")
interface FHIROperationsService {
  @doc("Performs probabilistic matching of a supplied Patient resource against the master patient index. Returns ranked candidate matches with confidence scores. Used for patient identity resolution, de-duplication workflows, and merge reconciliation.")
  @operationId("patientMatch")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/Patient/$match")
  patientMatch(
    @body body: PatientMatchRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: PatientMatchResponse;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieves all FHIR resources in a patient's clinical compartment (Observations, Conditions, MedicationRequests, Encounters, etc.) in a single Bundle response. Supports date-range and resource-type filtering for large compartments.")
  @operationId("patientEverything")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/Patient/{id}/$everything")
  patientEverything(
    @path @doc("Patient resource logical ID") id: string,
    ...PatientEverythingParams,
  ): {
    @statusCode statusCode: 200;
    @body result: Record<unknown>;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Validates a FHIR resource against the base specification or a named profile, returning a list of conformance issues. Use before persisting data received from external systems or user-submitted resources to ensure structural and terminology correctness.")
  @operationId("validateResource")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/$validate")
  validateResource(
    @body body: ValidationRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: ValidationResponse;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Assembles a self-contained FHIR Document Bundle from the specified Composition resource, resolving all referenced resources and bundling them together. Produces a portable, immutable clinical document suitable for exchange, archival, or patient sharing.")
  @operationId("generateDocument")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/Composition/{id}/$document")
  generateDocument(
    @path @doc("Composition resource logical ID") id: string,
    @body body: DocumentBundleRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: Record<unknown>;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
