import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";
import "../core/primitives.tsp";
import "../core/terminology.tsp";
import "./capability-statement.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;
using Healthcare.Conformance.Capabilities;

/**
 * FHIR Terminology Service — management and runtime operations for CodeSystem,
 * ValueSet, and ConceptMap resources. Implements the FHIR Terminology Service
 * specification (http://hl7.org/fhir/terminology-service.html) including the
 * $lookup, $validate-code, $expand, and $translate extended operations.
 */
namespace Healthcare.Conformance.Terminology;

// ---------------------------------------------------------------------------
// CodeSystem Models
// ---------------------------------------------------------------------------

@doc("A designation — an alternative code or display representation for a concept, typically in a different language or context.")
model Designation {
  @doc("BCP 47 language code for this designation (e.g., 'en', 'fr', 'de'). When omitted, defaults to the server's configured default language.")
  language?: string;

  @doc("The purpose of this designation (e.g., 'display', 'definition', 'fully-specified name'). Drawn from the FHIR designation-use value set.")
  use?: CodeableConcept;

  @doc("The text value of this designation")
  value: string;
}

@doc("A property value associated with a CodeSystem concept, used to capture non-display metadata such as concept status, parent hierarchy, or domain-specific attributes.")
model ConceptProperty {
  @doc("Code identifying the property (must match a property declared in the CodeSystem.property list)")
  code: string;

  @doc("The property value when the property type is 'code'")
  valueCode?: string;

  @doc("The property value when the property type is 'string'")
  valueString?: string;

  @doc("The property value when the property type is 'boolean'")
  valueBoolean?: boolean;

  @doc("The property value when the property type is 'integer'")
  valueInteger?: int32;
}

@doc("A concept defined by the code system, potentially containing child concepts for hierarchical terminologies.")
model CodeSystemConcept {
  @doc("A code — a symbol defined by the code system that uniquely identifies a concept within the system")
  code: string;

  @doc("A human-readable representation of the concept recommended for display to a user")
  display?: string;

  @doc("The formal definition of the concept")
  definition?: string;

  @doc("Additional representations for the concept — other languages, aliases, specialized displays")
  designation?: Designation[];

  @doc("Additional properties of the concept beyond display and definition")
  property?: ConceptProperty[];

  @doc("Child concepts in the hierarchy (for polyhierarchical code systems)")
  concept?: CodeSystemConcept[];
}

@doc("A CodeSystem resource defines a set of codes with meanings (enumerations, terminologies, classification schemes, or code lists). Extends HealthcareBaseEntity to support multi-tenancy and audit trails.")
model CodeSystemResource extends HealthcareBaseEntity {
  @doc("Canonical URL that uniquely identifies this code system across all servers and environments")
  @format("uri")
  url: string;

  @doc("Computer-friendly name for the code system; suitable for use as an identifier in code and URLs")
  name: string;

  @doc("A short, descriptive, user-friendly title for the code system")
  title?: string;

  @doc("Publication lifecycle status of this code system")
  status: PublicationStatus;

  @doc("A free text natural language description of the code system")
  description?: string;

  @doc("How much of the content of the code system is represented in this resource (complete | not-complete | example | fragment | supplement)")
  content: string;

  @doc("The total number of concepts defined by the code system. Informational; may differ from the actual count of concept entries when content is not 'complete'.")
  count?: int32;

  @doc("Concepts in the code system. Only populated when content is 'complete' or 'fragment'.")
  concept?: CodeSystemConcept[];
}

// ---------------------------------------------------------------------------
// ValueSet Models
// ---------------------------------------------------------------------------

@doc("A concept drawn from a specific code system to be included in a value set expansion or compose include.")
model ValueSetConcept {
  @doc("The code from the code system")
  code: string;

  @doc("Display name for this code in the context of this value set. Overrides the code system's display if specified.")
  display?: string;
}

@doc("A filter criterion applied to a code system to select a subset of concepts for inclusion in a value set.")
model ValueSetFilter {
  @doc("A property defined by the code system on which the filter operates (e.g., 'concept', 'status', 'parent')")
  property: string;

  @doc("The kind of operation to perform as part of the filter criteria (e.g., '=', 'is-a', 'descendent-of', 'is-not-a', 'regex', 'in', 'not-in', 'generalizes', 'exists')")
  operator: string;

  @doc("The match value for the filter operation. For 'is-a' and 'descendent-of', this is a concept code. For 'regex', it is a regular expression.")
  value: string;
}

@doc("A group of concepts to include or exclude from a value set, drawn from a single code system.")
model ValueSetInclude {
  @doc("Canonical URI of the code system from which concepts are selected")
  @format("uri")
  system?: string;

  @doc("Specific version of the code system to use. When omitted, the server resolves the version according to its version management policy.")
  version?: string;

  @doc("Enumerated list of specific concepts to include. Mutually exclusive with 'filter'.")
  concept?: ValueSetConcept[];

  @doc("Filter criteria applied to the code system. Mutually exclusive with 'concept'.")
  filter?: ValueSetFilter[];
}

@doc("Formal definition of the value set content based on logical inclusions and exclusions of code system concepts.")
model ValueSetCompose {
  @doc("Includes — groups of concepts to be included in the value set")
  include: ValueSetInclude[];
}

@doc("An individual concept in the expanded value set.")
model ValueSetExpansionContains {
  @doc("The URI of the system from which this concept was selected")
  @format("uri")
  system?: string;

  @doc("The code for this concept in the code system")
  code: string;

  @doc("The recommended display for this concept in the context of this value set")
  display?: string;
}

@doc("The expansion of a value set into a list of concepts. Generated on demand by the $expand operation.")
model ValueSetExpansion {
  @doc("The timestamp when this expansion was generated")
  timestamp: utcDateTime;

  @doc("The total number of concepts in the expansion (before paging)")
  total?: int32;

  @doc("The concepts in the expansion")
  contains: ValueSetExpansionContains[];
}

@doc("A ValueSet resource specifies a set of codes from defined code systems or composes a new set by combining subsets. Used for validation, UI population, and data entry constraints. Extends HealthcareBaseEntity.")
model ValueSetResource extends HealthcareBaseEntity {
  @doc("Canonical URL that uniquely identifies this value set")
  @format("uri")
  url: string;

  @doc("Computer-friendly name for the value set")
  name: string;

  @doc("A short, descriptive, user-friendly title for the value set")
  title?: string;

  @doc("Publication lifecycle status of this value set")
  status: PublicationStatus;

  @doc("A free text natural language description of the value set")
  description?: string;

  @doc("Content logical definition of the value set")
  compose?: ValueSetCompose;

  @doc("Cached expansion of the value set. May be present when the value set has been pre-expanded for performance.")
  expansion?: ValueSetExpansion;
}

// ---------------------------------------------------------------------------
// ConceptMap Models
// ---------------------------------------------------------------------------

@doc("A target concept in a concept mapping, representing the relationship between a source concept and a target code system concept.")
model ConceptMapTarget {
  @doc("Code that identifies the target concept")
  code: string;

  @doc("Display for the target code")
  display?: string;

  @doc("The equivalence between the source and target concepts (equivalent | equal | wider | subsumes | narrower | specializes | inexact | unmatched | disjoint)")
  equivalence: string;
}

@doc("A source concept element from the source code system and its mapped target concepts.")
model ConceptMapElement {
  @doc("Code in the source code system")
  code: string;

  @doc("Display for the source code")
  display?: string;

  @doc("Concept in target code system for element")
  target: ConceptMapTarget[];
}

@doc("A group of mappings between a source code system and a target code system.")
model ConceptMapGroup {
  @doc("Source code system URI (when not specified on the element level)")
  @format("uri")
  source?: string;

  @doc("Target code system URI (when not specified on the element level)")
  @format("uri")
  target?: string;

  @doc("Source concept elements to be mapped")
  element: ConceptMapElement[];
}

@doc("A ConceptMap resource defines a mapping from a set of concepts in one code system to concepts in another. Used for translating between terminologies such as ICD-10 to SNOMED CT. Extends HealthcareBaseEntity.")
model ConceptMapResource extends HealthcareBaseEntity {
  @doc("Canonical URL that uniquely identifies this concept map")
  @format("uri")
  url: string;

  @doc("Computer-friendly name for the concept map")
  name: string;

  @doc("Publication lifecycle status of this concept map")
  status: PublicationStatus;

  @doc("Canonical URI that identifies the source value set or code system of this mapping")
  @format("uri")
  sourceUri?: string;

  @doc("Canonical URI that identifies the target value set or code system of this mapping")
  @format("uri")
  targetUri?: string;

  @doc("Groups of mappings — each group maps between one source and one target system")
  group: ConceptMapGroup[];
}

// ---------------------------------------------------------------------------
// Operation Request/Response Models
// ---------------------------------------------------------------------------

@doc("Input parameters for the CodeSystem $lookup operation, which looks up a specific concept and returns its display and properties.")
model LookupRequest {
  @doc("The code system URI in which to look up the code")
  @format("uri")
  system: string;

  @doc("The concept code to look up")
  code: string;

  @doc("The version of the code system. When omitted the server uses its default version resolution policy.")
  version?: string;
}

@doc("Response from the CodeSystem $lookup operation containing display and properties for the requested concept.")
model LookupResponse {
  @doc("The name of the code system")
  name: string;

  @doc("The preferred display for this concept")
  display: string;

  @doc("Additional designations (alternative displays and translations)")
  designation?: Designation[];

  @doc("Properties of the concept as defined by the code system")
  property?: ConceptProperty[];
}

@doc("Input parameters for the ValueSet $validate-code operation, which tests whether a display is valid for a given concept in a value set.")
model ValidateCodeRequest {
  @doc("Canonical URL of the value set to validate the code against")
  @format("uri")
  url: string;

  @doc("The code to be validated")
  code: string;

  @doc("The code system URI for the code. Required when the value set includes concepts from multiple code systems.")
  @format("uri")
  system?: string;

  @doc("The display associated with the code to be validated. When provided, the server checks that this display is valid for the code.")
  display?: string;
}

@doc("Response from the ValueSet $validate-code operation.")
model ValidateCodeResponse {
  @doc("Whether the code is valid in the specified value set")
  result: boolean;

  @doc("Human-readable description of why the code is valid or invalid")
  message?: string;

  @doc("The recommended display for this code when the provided display was not recognised")
  display?: string;
}

@doc("Input parameters for the ValueSet $expand operation, which generates an explicit list of codes from the value set definition.")
model ExpandRequest {
  @doc("Canonical URL of the value set to expand")
  @format("uri")
  url: string;

  @doc("Text filter applied to the display names of concepts to include (case-insensitive substring match)")
  filter?: string;

  @doc("Maximum number of concepts to return in the expansion (for paging large value sets)")
  count?: int32;

  @doc("Offset into the expansion for paging (0-based)")
  offset?: int32;
}

@doc("Input parameters for the ConceptMap $translate operation, which translates a code from one code system to another using the specified concept map.")
model TranslateRequest {
  @doc("Canonical URL of the concept map to use for translation")
  @format("uri")
  url: string;

  @doc("The source code system URI")
  @format("uri")
  system: string;

  @doc("The source code to translate")
  code: string;

  @doc("The target code system URI")
  @format("uri")
  targetSystem: string;
}

@doc("A single translation match from the $translate operation.")
model TranslateMatch {
  @doc("The equivalence relationship between the source and the target concept (equivalent | wider | narrower | inexact | unmatched | disjoint)")
  equivalence: string;

  @doc("The target concept in the target code system")
  concept: CodeableConcept;
}

@doc("Response from the ConceptMap $translate operation.")
model TranslateResponse {
  @doc("Whether a translation was found for the source code")
  result: boolean;

  @doc("One or more matches in the target code system when result is true")
  match?: TranslateMatch[];
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

@doc("FHIR Terminology Service — full lifecycle management (CRUD) and extended operations ($lookup, $validate-code, $expand, $translate) for CodeSystem, ValueSet, and ConceptMap resources. Implements the HL7 FHIR Terminology Service specification.")
@tag("Healthcare:Conformance")
@useAuth(bearerAuth)
@route("/fhir")
interface TerminologyService {
  // --- CodeSystem CRUD ---

  @doc("Create a new CodeSystem resource.")
  @operationId("createCodeSystem")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/CodeSystem")
  createCodeSystem(
    @body body: CodeSystemResource,
  ): {
    @statusCode statusCode: 201;
    @body result: CodeSystemResource;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a CodeSystem by its logical ID.")
  @operationId("getCodeSystem")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/CodeSystem/{id}")
  getCodeSystem(
    @path @doc("CodeSystem resource logical ID") id: string,
  ): {
    @statusCode statusCode: 200;
    @body result: CodeSystemResource;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an existing CodeSystem resource.")
  @operationId("updateCodeSystem")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/CodeSystem/{id}")
  updateCodeSystem(
    @path @doc("CodeSystem resource logical ID") id: string,
    @body body: CodeSystemResource,
  ): {
    @statusCode statusCode: 200;
    @body result: CodeSystemResource;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a CodeSystem resource by its logical ID.")
  @operationId("deleteCodeSystem")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/CodeSystem/{id}")
  deleteCodeSystem(
    @path @doc("CodeSystem resource logical ID") id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Look up the details (display name, designations, properties) of a specific concept in a code system.")
  @operationId("lookupCode")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/CodeSystem/$lookup")
  lookupCode(
    @body body: LookupRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: LookupResponse;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  // --- ValueSet CRUD ---

  @doc("Create a new ValueSet resource.")
  @operationId("createValueSet")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/ValueSet")
  createValueSet(
    @body body: ValueSetResource,
  ): {
    @statusCode statusCode: 201;
    @body result: ValueSetResource;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a ValueSet by its logical ID.")
  @operationId("getValueSet")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/ValueSet/{id}")
  getValueSet(
    @path @doc("ValueSet resource logical ID") id: string,
  ): {
    @statusCode statusCode: 200;
    @body result: ValueSetResource;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an existing ValueSet resource.")
  @operationId("updateValueSet")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/ValueSet/{id}")
  updateValueSet(
    @path @doc("ValueSet resource logical ID") id: string,
    @body body: ValueSetResource,
  ): {
    @statusCode statusCode: 200;
    @body result: ValueSetResource;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a ValueSet resource by its logical ID.")
  @operationId("deleteValueSet")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/ValueSet/{id}")
  deleteValueSet(
    @path @doc("ValueSet resource logical ID") id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Validate that a code is in the specified value set and optionally verify the provided display text.")
  @operationId("validateCode")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/ValueSet/$validate-code")
  validateCode(
    @body body: ValidateCodeRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: ValidateCodeResponse;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Expand a value set into a list of codes. Supports filtering, paging, and version pinning. Essential for populating UI dropdowns and autocomplete fields from terminology-bound data elements.")
  @operationId("expandValueSet")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/ValueSet/$expand")
  expandValueSet(
    @body body: ExpandRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: ValueSetResource;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  // --- ConceptMap CRUD ---

  @doc("Create a new ConceptMap resource.")
  @operationId("createConceptMap")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/ConceptMap")
  createConceptMap(
    @body body: ConceptMapResource,
  ): {
    @statusCode statusCode: 201;
    @body result: ConceptMapResource;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a ConceptMap by its logical ID.")
  @operationId("getConceptMap")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/ConceptMap/{id}")
  getConceptMap(
    @path @doc("ConceptMap resource logical ID") id: string,
  ): {
    @statusCode statusCode: 200;
    @body result: ConceptMapResource;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an existing ConceptMap resource.")
  @operationId("updateConceptMap")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/ConceptMap/{id}")
  updateConceptMap(
    @path @doc("ConceptMap resource logical ID") id: string,
    @body body: ConceptMapResource,
  ): {
    @statusCode statusCode: 200;
    @body result: ConceptMapResource;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a ConceptMap resource by its logical ID.")
  @operationId("deleteConceptMap")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/ConceptMap/{id}")
  deleteConceptMap(
    @path @doc("ConceptMap resource logical ID") id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Translate a code from one code system to another using the mappings defined in a ConceptMap. Used for cross-terminology interoperability, claim code translation, and data harmonisation workflows.")
  @operationId("translateCode")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/ConceptMap/$translate")
  translateCode(
    @body body: TranslateRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: TranslateResponse;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
