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

namespace Healthcare.Support.Provenance;

// Models

@doc("Why the activity occurred.")
enum ProvenanceActivityType {
  @doc("Resource was created")
  create,
  @doc("Resource was updated")
  update,
  @doc("Resource was deleted")
  delete,
  @doc("Resource was accessed/read")
  access,
  @doc("Resource was transmitted/disclosed")
  transmit,
  @doc("Resource was verified/attested")
  verify,
  @doc("Resource was signed")
  sign,
  @doc("Resource was amended/corrected")
  amend,
  @doc("Resource was merged with another")
  merge,
  @doc("Resource was de-identified")
  deidentify,
  @doc("Resource was re-identified")
  reidentify,
}

@doc("Role of an agent in a provenance event.")
enum ProvenanceAgentRole {
  @doc("The entity that originated the activity")
  author,
  @doc("The entity that performed the activity")
  performer,
  @doc("The entity that verified/attested the activity")
  verifier,
  @doc("The entity that approved the activity")
  approver,
  @doc("The entity responsible for the activity")
  custodian,
  @doc("A device or software that assisted in the activity")
  assembler,
  @doc("The entity that informed the activity")
  informant,
  @doc("The entity on whose behalf the activity was performed")
  onBehalfOf,
}

@doc("How an entity was used in the activity.")
enum ProvenanceEntityRole {
  @doc("The entity is a precursor to the target")
  derivation,
  @doc("The entity was the previous version of the target")
  revision,
  @doc("The entity was copied/quoted into the target")
  quotation,
  @doc("The entity is the source of the target")
  source,
  @doc("The entity was removed/deleted")
  removal,
}

@doc("An agent involved in a provenance event.")
model ProvenanceAgent {
  @doc("The functional role of the agent with respect to the activity")
  role: ProvenanceAgentRole;

  @doc("Reference to the agent (Practitioner, Patient, Organization, Device)")
  who: Reference;

  @doc("Reference to the organization the agent was acting on behalf of")
  onBehalfOf?: Reference;
}

@doc("An entity used in the provenance activity.")
model ProvenanceEntity {
  @doc("How the entity was used in the activity")
  role: ProvenanceEntityRole;

  @doc("Reference to the entity involved")
  what: Reference;
}

@doc("Record of who did what, when, and why to a clinical resource. Aligns with FHIR Provenance resource. Essential for HIPAA compliance and clinical data trust.")
model ProvenanceRecord extends HealthcareBaseEntity {
  @doc("Reference to the resource(s) this provenance record is about")
  target: Reference[];

  @doc("When the activity occurred (Mutually exclusive with occurredPeriod — exactly one must be provided)")
  occurredDateTime?: utcDateTime;

  @doc("When the activity occurred (period) (Mutually exclusive with occurredDateTime — exactly one must be provided)")
  occurredPeriod?: Period;

  @doc("When the provenance was recorded")
  recorded: utcDateTime;

  @doc("Policy or plan that authorized the activity")
  policy?: string[];

  @doc("Reference to the location where the activity occurred")
  location?: Reference;

  @doc("The reason the activity took place")
  reason?: CodeableConcept[];

  @doc("The type of activity that occurred")
  activity?: ProvenanceActivityType;

  @doc("Agents involved in the activity")
  agent: ProvenanceAgent[];

  @doc("Entities used in the activity")
  entity?: ProvenanceEntity[];

  @doc("Digital signature for non-repudiation")
  signature?: Reference[];

  @doc("Purpose of use for this data access")
  purposeOfUse?: PurposeOfUse[];

  @doc("Confidentiality level that applied during this activity")
  confidentiality?: ConfidentialityClassification;
}

@doc("Request to create a provenance record")
model CreateProvenanceRequest {
  @doc("Reference to the resource(s) this provenance record is about")
  target: Reference[];
  @doc("When the activity occurred (Mutually exclusive with occurredPeriod — exactly one must be provided)")
  occurredDateTime?: utcDateTime;
  @doc("When the activity occurred (period) (Mutually exclusive with occurredDateTime — exactly one must be provided)")
  occurredPeriod?: Period;
  @doc("Policy or plan that authorized the activity")
  policy?: string[];
  @doc("Reference to the location where the activity occurred")
  location?: Reference;
  @doc("The reason the activity took place")
  reason?: CodeableConcept[];
  @doc("The type of activity that occurred")
  activity?: ProvenanceActivityType;
  @doc("Agents involved in the activity")
  agent: ProvenanceAgent[];
  @doc("Entities used in the activity")
  entity?: ProvenanceEntity[];
  @doc("Purpose of use for this data access")
  purposeOfUse?: PurposeOfUse[];
}

// Interface

@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface ProvenanceManagement {
  @doc("Create a provenance record for a clinical resource change or access.")
  @operationId("createProvenance")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  create(
    @body body: CreateProvenanceRequest
  ): {
    @statusCode statusCode: 201;
    @body body: ProvenanceRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

  @doc("Get a provenance record by ID.")
  @operationId("getProvenance")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  get(
    @path id: UUID
  ): {
    @statusCode statusCode: 200;
    @body body: ProvenanceRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

  @doc("Search provenance records for a target resource.")
  @operationId("searchProvenance")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  search(
    @query target?: string,
    @query activity?: ProvenanceActivityType,
    @query agent?: string,
    @query recorded?: string,
    ...PaginationQuery
  ): {
    @statusCode statusCode: 200;
    @body body: PaginatedResponse<ProvenanceRecord>;
  } | ApiUnauthorizedResponse | ApiForbiddenResponse;
}
