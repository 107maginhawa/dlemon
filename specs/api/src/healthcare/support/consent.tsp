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
 * Healthcare Consent Management module.
 *
 * Provides FHIR R4-aligned models and operations for Consent resources.
 * Supports HIPAA privacy consent, treatment consent, advance directives,
 * and research consent workflows with granular provision controls.
 */
namespace Healthcare.Support.ConsentManagement;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Identifies the type of provision (permit/deny) in a consent rule. Aligns with FHIR ConsentProvisionType.")
enum ConsentProvisionType {
  @doc("Consent is denied for the specified data or action")
  deny,

  @doc("Consent is permitted for the specified data or action")
  permit,
}

@doc("How a resource reference is interpreted when evaluating consent provisions. Aligns with FHIR ConsentDataMeaning.")
enum ConsentDataMeaning {
  @doc("The consent applies directly to the instance of the resource")
  instance,

  @doc("The consent applies directly to the instance and instances that refer to it")
  related,

  @doc("The consent applies directly to the instance and instances in the subtree")
  dependents,

  @doc("The consent applies to instances authored by the principal")
  authoredby,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * A reference to a computable policy (e.g., regulations or organisational policies)
 * that defines the base consent.
 */
model ConsentPolicy {
  /** Entity or organization that is the authority for the applicable policy. */
  authority?: string;

  /** The references to the policies that are included in this consent scope. */
  uri?: string;
}

/**
 * Whether a treatment instruction such as artificially administered food and
 * water is verified by a patient, related person, or a practitioner.
 */
model ConsentVerification {
  /** Has the instruction been verified. */
  verified: boolean;

  /** Who verified the instruction (patient, related person, or practitioner). */
  verifiedWith?: Reference;

  /** Date and time the verification was collected. */
  verificationDate?: utcDateTime;
}

/**
 * Who or what is controlled by this rule. Use group to identify a set of actors
 * by some attribute they share.
 */
model ConsentProvisionActor {
  /** How the individual is involved in the resources content that is described in the exception. */
  role: CodeableConcept;

  /** The resource that identifies the actor; to whom consent is given or withheld. */
  reference: Reference;
}

/**
 * The resources controlled by this rule if specific resources are referenced.
 */
model ConsentProvisionData {
  /** How the resource reference is interpreted when testing consent restrictions. */
  meaning: ConsentDataMeaning;

  /** A reference to a specific resource that defines which resources are covered by this consent. */
  reference: Reference;
}

/**
 * An exception to the base policy of this consent. Provisions are used to grant
 * or deny specific access to named actors for named resources over a period.
 */
model ConsentProvision {
  /** Action to take — either permit or deny. */
  type?: ConsentProvisionType;

  /** The timeframe in this rule is valid. */
  period?: Period;

  /** Who or what is controlled by this rule. */
  actor?: ConsentProvisionActor[];

  /** Actions controlled by this Rule. */
  action?: CodeableConcept[];

  /** A security label, comprised of 0 to many security label fields (Security Label Noun Phrase), applying to this resource. */
  securityLabel?: CodeableConcept[];

  /** The context of the activities a user is taking — why the user is accessing the resource and just.<br/>Use values from HL7 ActReason value set. */
  purpose?: CodeableConcept[];

  /** The class of information covered by this rule. */
  class?: CodeableConcept[];

  /** If this code is found in an instance, then the rule applies. */
  code?: CodeableConcept[];

  /** Clinical or Operational Relevant period of time that bounds the data controlled by this rule. */
  dataPeriod?: Period;

  /** The resources controlled by this rule if specific resources are referenced. */
  data?: ConsentProvisionData[];
}

// ---------------------------------------------------------------------------
// Root resource — Consent
// ---------------------------------------------------------------------------

/**
 * A record of a healthcare consumer's choices or choices made on their behalf by
 * a third party, which permits or denies identified recipient(s) or recipient
 * role(s) to perform one or more actions within a given policy context.
 * Mapped to FHIR R4 Consent.
 */
model Consent extends HealthcareBaseEntity {
  /** Indicates the current state of this consent resource. */
  status: ConsentStatus;

  /**
   * A selector of the type of consent being presented with the base being required
   * for execution. Values: adr (advance directive), research, treatment, patientPrivacy.
   */
  scope: CodeableConcept;

  /** A classification of the type of consents found in the statement. */
  category: CodeableConcept[];

  /** The patient/healthcare consumer to whom this consent applies. */
  patient?: Reference;

  /** When this Consent was issued / created / indexed. */
  dateTime: utcDateTime;

  /** Either the Grantor, which is the entity responsible for granting the rights listed in a Consent Directive or the Grantee, which is the entity responsible for complying with the Consent Directive. */
  performer?: Reference[];

  /** The organization that manages the consent, and the framework within which it is executed. */
  organization?: Reference[];

  /** The source on which this consent statement is based. */
  sourceAttachment?: Attachment;

  /** A reference to a consent that links back to such a source, a reference to a document repository. */
  sourceReference?: Reference;

  /** The references to the policies that are included in this consent scope. */
  policy?: ConsentPolicy[];

  /** A reference to the specific base computable regulation or policy. */
  policyRule?: CodeableConcept;

  /** Whether a treatment instruction (e.g., DNR) was verified with the patient, related person, or another practitioner. */
  verification?: ConsentVerification[];

  /** An exception to the base policy of this consent. */
  provision?: ConsentProvision;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/** Query parameters for searching Consent resources. */
model ConsentSearchParams {
  /** Filter by patient reference id. */
  @query patient?: string;

  /** Filter by consent scope code (adr, research, treatment, patientPrivacy). */
  @query scope?: string;

  /** Filter by consent status. */
  @query status?: string;

  /** Filter by category code. */
  @query category?: string;

  /** Filter by performer reference id. */
  @query performer?: string;

  /** Filter by organization reference id. */
  @query organization?: string;

  /** Page number (1-based). */
  @query page?: int32;

  /** Number of results per page. */
  @query pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for Consent resources.
 */
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface ConsentManagement {
  /** Create a new Consent. */
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @post
  @operationId("createConsent")
  create(
    @body body: Consent,
  ): {
    @statusCode statusCode: 201;
    @body consent: Consent;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single Consent by id. */
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @get
  @operationId("getConsent")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body consent: Consent;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing Consent. */
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @put
  @operationId("updateConsent")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Consent,
  ): {
    @statusCode statusCode: 200;
    @body consent: Consent;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update a Consent. */
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @patch
  @operationId("patchConsent")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body consent: Consent;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete a Consent by id. */
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @delete
  @operationId("deleteConsent")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for Consents using filter parameters. */
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @get
  @operationId("searchConsents")
  @route("/search")
  search(
    ...ConsentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Consent>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
