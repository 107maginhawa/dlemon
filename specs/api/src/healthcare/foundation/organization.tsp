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
 * Organization contact - a designated contact within an organization
 */
@doc("Contact for the organization for a certain purpose")
model OrganizationContact {
  @doc("Indicates a purpose for which the contact can be reached")
  purpose?: CodeableConcept;

  @doc("A name associated with the contact")
  name?: HumanName;

  @doc("Contact details (telephone, email, etc.) for the contact")
  telecom?: ContactPoint[];

  @doc("Visiting or postal addresses for the contact")
  address?: Address;
}

/**
 * Organization model - FHIR R4 Organization resource aligned
 */
@doc("FHIR R4-aligned organization record representing a formally or informally recognized grouping of people or organizations formed for the purpose of achieving some form of collective action")
model Organization extends HealthcareBaseEntity {
  @doc("Whether the organization's record is still in active use")
  active: boolean;

  @doc("Kind of organization (e.g. hospital, clinic, pharmacy, lab, insurance, payer)")
  type: CodeableConcept[];

  @doc("Name used for the organization")
  name: string;

  @doc("A list of alternate names that the organization is known as or was known as in the past")
  aliases?: string[];

  @doc("A contact detail for the organization")
  telecom?: ContactPoint[];

  @doc("An address for the organization")
  address?: Address[];

  @doc("Reference to the organization of which this organization forms a part")
  partOf?: Reference;

  @doc("Contact for the organization for a certain purpose")
  contact?: OrganizationContact[];

  @doc("Technical endpoints providing access to services operated for the organization (FHIR, HL7 v2, integration endpoints)")
  endpoint?: string[];
}

/**
 * Organization create request
 */
@doc("Request body for registering a new organization")
model CreateOrganizationRequest {
  @doc("Name used for the organization (required)")
  name: string;

  @doc("Kind of organization (at least one type required)")
  type: CodeableConcept[];

  @doc("Whether the organization's record is in active use")
  active?: boolean;

  @doc("Alternate names for the organization")
  aliases?: string[];

  @doc("Contact details for the organization")
  telecom?: ContactPoint[];

  @doc("Addresses for the organization")
  address?: Address[];

  @doc("Reference to the parent organization")
  partOf?: Reference;

  @doc("Designated contacts within the organization")
  contact?: OrganizationContact[];

  @doc("Technical integration endpoints")
  endpoint?: string[];
}

/**
 * Organization update request - all fields optional, nullable for clearing
 */
@doc("Request body for updating an organization record; null values clear the field")
model UpdateOrganizationRequest {
  @doc("Updated name - null clears the field (use with caution)")
  name?: string | null;

  @doc("Updated organization types - null clears all types")
  type?: CodeableConcept[] | null;

  @doc("Updated active status")
  active?: boolean | null;

  @doc("Updated alternate names - null clears all aliases")
  aliases?: string[] | null;

  @doc("Updated contact details - null clears all telecom entries")
  telecom?: ContactPoint[] | null;

  @doc("Updated addresses - null clears all addresses")
  address?: Address[] | null;

  @doc("Updated parent organization reference - null removes the parent relationship")
  partOf?: Reference | null;

  @doc("Updated organization contacts - null clears all contacts")
  contact?: OrganizationContact[] | null;

  @doc("Updated technical endpoints - null clears all endpoints")
  endpoint?: string[] | null;
}

/**
 * Healthcare Foundation - Organization Management
 *
 * FHIR R4-aligned management of organizations such as hospitals, clinics, pharmacies,
 * laboratories, insurers, and payers. Supports hierarchical organization structures
 * via the partOf relationship and multi-type classification.
 */
namespace Healthcare.Foundation {
  /**
   * Organization management interface
   */
  @tag("Organization")
  interface OrganizationManagement {
    @doc("Register a new organization.")
    @operationId("createOrganization")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "org-admin"])
    createOrganization(
      @body organization: CreateOrganizationRequest
    ): ApiCreatedResponse<Organization>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("List organizations with optional filtering by name, type, or address components.")
    @operationId("listOrganizations")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "support"])
    listOrganizations(
      ...PaginationQuery,
      @doc("Filter by organization name (partial match)")
      @query name?: string,
      @doc("Filter by organization type code (CodeableConcept code value)")
      @query type?: string,
      @doc("Filter by city")
      @query city?: string,
      @doc("Filter by state or province")
      @query state?: string,
      @doc("Filter by ISO 3166-1 alpha-2 country code")
      @query country?: string,
      @doc("Filter by active status")
      @query active?: boolean
    ): ApiOkResponse<PaginatedResponse<Organization>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Retrieve a single organization record by ID.")
    @operationId("getOrganization")
    @get
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "support"])
    getOrganization(
      @path @doc("Organization record UUID") id: UUID
    ): ApiOkResponse<Organization>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update an organization record. Provide only the fields to change; null values clear optional fields.")
    @operationId("updateOrganization")
    @patch(#{implicitOptionality: true})
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "org-admin"])
    updateOrganization(
      @path @doc("Organization record UUID") id: UUID,
      @body updates: UpdateOrganizationRequest
    ): ApiOkResponse<Organization>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Deactivate an organization record (sets active=false). Records are retained for audit and legal purposes.")
    @operationId("deactivateOrganization")
    @delete
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deactivateOrganization(
      @path @doc("Organization record UUID") id: UUID
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }
}
