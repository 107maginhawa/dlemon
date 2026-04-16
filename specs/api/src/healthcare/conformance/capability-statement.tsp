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
 * FHIR Capability Statement — declares the functional capabilities of this server
 * instance in a standard machine-readable form, enabling clients to discover
 * supported interactions, search parameters, and operations at runtime.
 *
 * Aligns with HL7 FHIR R4 CapabilityStatement resource (http://hl7.org/fhir/capabilitystatement.html).
 */
namespace Healthcare.Conformance.Capabilities;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The lifecycle publication status of a conformance or knowledge artifact. Aligns with FHIR PublicationStatus.")
enum PublicationStatus {
  @doc("This resource is still under development and is not yet considered to be ready for normal use")
  draft,

  @doc("This resource is ready for normal use")
  active,

  @doc("This resource has been withdrawn or superseded and should no longer be used")
  retired,

  @doc("The authoring system does not know which of the status values currently applies")
  `unknown`: "unknown",
}

@doc("How a capability statement is intended to be used. Aligns with FHIR CapabilityStatementKind.")
enum CapabilityStatementKind {
  @doc("The CapabilityStatement instance represents the present capabilities of a specific system instance")
  instance,

  @doc("The CapabilityStatement instance represents a set of capabilities merged from multiple separate capability statements")
  capability,

  @doc("The CapabilityStatement instance represents a set of desired capabilities for use in a particular context")
  requirements,
}

@doc("Whether the application acts as a client or server in a given context. Aligns with FHIR RestfulCapabilityMode.")
enum RestfulCapabilityMode {
  @doc("The application acts as a client for this resource")
  client,

  @doc("The application acts as a server for this resource")
  server,
}

@doc("Supported FHIR interactions on a resource type. Aligns with FHIR TypeRestfulInteraction.")
enum ResourceInteractionCode {
  @doc("Read the current state of the resource")
  read,

  @doc("Read the state of a specific version of the resource")
  vread,

  @doc("Update an existing resource by its id")
  update,

  @doc("Update an existing resource by posting a set of changes to it")
  patch,

  @doc("Delete a resource")
  delete,

  @doc("Retrieve the change history for a particular resource")
  historyInstance,

  @doc("Retrieve the change history for all resources of a particular type")
  historyType,

  @doc("Create a new resource with a server assigned id")
  create,

  @doc("Search all resources of the specified type based on some filter criteria")
  searchType,
}

@doc("Supported system-level FHIR interactions. Aligns with FHIR SystemRestfulInteraction.")
enum SystemInteractionCode {
  @doc("Update, create or delete a set of resources as a single transaction")
  transaction,

  @doc("Perform a set of a operations on a server in a single HTTP request/response")
  batch,

  @doc("Search all resources based on some filter criteria")
  searchSystem,

  @doc("Retrieve the change history for all resources on a system")
  historySystem,
}

@doc("The type of search parameter. Aligns with FHIR SearchParamType.")
enum SearchParamType {
  @doc("Search parameter is on a number")
  number,

  @doc("Search parameter is on a date/time")
  date,

  @doc("Search parameter is on a string")
  string,

  @doc("Search parameter is on a token")
  token,

  @doc("Search parameter is on a reference")
  reference,

  @doc("Search parameter is on a composite of other search parameters")
  composite,

  @doc("Search parameter is on a quantity")
  quantity,

  @doc("Search parameter is on a URI")
  uri,

  @doc("Search parameter is on a special data type (not a standard FHIR type)")
  special,
}

// ---------------------------------------------------------------------------
// Supporting Models
// ---------------------------------------------------------------------------

@doc("A search parameter supported by the server on this resource type.")
model CapabilitySearchParam {
  @doc("Name of the search parameter (as used in the URL query string)")
  name: string;

  @doc("The type of the search parameter")
  type: SearchParamType;

  @doc("Human-readable documentation describing the semantics and valid values for this search parameter")
  documentation?: string;
}

@doc("An extended operation supported on a resource type or at the system level.")
model CapabilityOperation {
  @doc("Name of the operation — used as the suffix of the $ operation URL (e.g., 'validate', 'expand')")
  name: string;

  @doc("Canonical URL to the OperationDefinition that defines this operation")
  @format("uri")
  definition: string;

  @doc("Human-readable documentation describing additional constraints or usage notes for this operation")
  documentation?: string;
}

@doc("Declares the capabilities of the server for a single FHIR resource type.")
model CapabilityRestResource {
  @doc("The FHIR resource type (e.g., Patient, Observation, Encounter)")
  type: string;

  @doc("Canonical URL of a base profile all resources of this type must conform to")
  @format("uri")
  profile?: string;

  @doc("Canonical URLs of profiles that instances of this resource type may conform to in addition to the base profile")
  supportedProfile?: string[];

  @doc("Interactions supported on this resource type")
  interaction: ResourceInteractionCode[];

  @doc("Search parameters supported on this resource type")
  searchParam?: CapabilitySearchParam[];

  @doc("Operations supported on this resource type")
  operation?: CapabilityOperation[];

  @doc("The supported versioning policy for this resource type (no-version, versioned, versioned-update)")
  versioning?: string;

  @doc("Whether vRead can return past versions as current")
  readHistory?: boolean;

  @doc("Whether update can create new identities")
  updateCreate?: boolean;

  @doc("Whether the server supports conditional create on this resource type")
  conditionalCreate?: boolean;

  @doc("A code that indicates how the server supports conditional read (not-supported, modified-since, not-match, full-support)")
  conditionalRead?: string;

  @doc("Whether the server supports conditional update on this resource type")
  conditionalUpdate?: boolean;

  @doc("A code that indicates how the server supports conditional delete (not-supported, single, multiple)")
  conditionalDelete?: string;
}

@doc("A description of the FHIR REST API capabilities at the system level and for individual resource types.")
model CapabilityStatementRest {
  @doc("Whether the application acts as a client or server")
  mode: RestfulCapabilityMode;

  @doc("Information about the system's restful capabilities that apply across all resource types")
  documentation?: string;

  @doc("A specification of the restful capabilities of the solution for each resource type")
  resource: CapabilityRestResource[];

  @doc("System-level interactions supported by the server")
  interaction?: SystemInteractionCode[];

  @doc("Operations supported at the system level")
  operation?: CapabilityOperation[];
}

// ---------------------------------------------------------------------------
// Root Resource
// ---------------------------------------------------------------------------

@doc("A Capability Statement is a set of capabilities of a FHIR server that may be used as a statement of actual server functionality or a statement of required or desired server implementation. Aligns with FHIR R4 CapabilityStatement.")
model CapabilityStatement {
  @doc("Publication lifecycle status of this capability statement")
  status: PublicationStatus;

  @doc("The way this statement is intended to be used — to describe an actual running instance, a set of capabilities independent of a specific realisation, or requirements of a desired implementation")
  kind: CapabilityStatementKind;

  @doc("The version of the FHIR specification on which this capability statement is based (e.g., '4.0.1')")
  fhirVersion: string;

  @doc("A list of the formats supported by this implementation using their content types (MIME types, e.g. 'application/fhir+json')")
  format: string[];

  @doc("A list of the patch formats supported by this implementation using their content types (e.g., 'application/json-patch+json')")
  patchFormat?: string[];

  @doc("A list of implementation guides that this implementation conforms to")
  implementationGuide?: string[];

  @doc("A definition of the restful capabilities of the solution, if any")
  rest: CapabilityStatementRest[];

  @doc("A natural language name identifying the capability statement; names should be usable as an identifier for the module by machine processing applications")
  name?: string;

  @doc("A short, descriptive, user-friendly title for the capability statement")
  title?: string;

  @doc("The date on which the resource content was last reviewed")
  date: utcDateTime;

  @doc("The name of the organization or individual that published the capability statement")
  publisher?: string;

  @doc("A free text natural language description of the capability statement from a consumer's perspective")
  description?: string;

  @doc("Explanation of why this capability statement is needed and why it has been designed as it has")
  purpose?: string;

  @doc("A copyright statement relating to the capability statement and/or its contents")
  copyright?: string;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

@doc("Provides machine-readable conformance information about this FHIR server. The capability statement endpoint is public and does not require authentication.")
@tag("Healthcare:Conformance")
@route("/fhir")
interface CapabilityStatementService {
  @doc("Returns the capability statement for this FHIR server, describing all supported resource types, interactions, search parameters, and extended operations. This is a public endpoint conforming to FHIR R4 §3.2.")
  @operationId("getCapabilityStatement")
  @get
  @route("/")
  getCapabilityStatement(): {
    @statusCode statusCode: 200;
    @body body: CapabilityStatement;
  } | ApiInternalServerErrorResponse;

  @doc("Returns the capability statement for this FHIR server at the standard /metadata path. Functionally equivalent to GET /fhir/ and provided for FHIR specification conformance.")
  @operationId("getMetadata")
  @get
  @route("/metadata")
  getMetadata(): {
    @statusCode statusCode: 200;
    @body body: CapabilityStatement;
  } | ApiInternalServerErrorResponse;
}
