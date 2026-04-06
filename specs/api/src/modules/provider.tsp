import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";
import "./person.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Provider type enumeration - exported without namespace
 */
@doc("Type of healthcare provider")
enum ProviderType {
  @doc("Pharmacist")
  pharmacist: "pharmacist",
  
  @doc("Other Healthcare Provider")
  other: "other",
}


/**
 * Healthcare provider profile extending Person - exported without namespace
 */
@doc("Healthcare provider profile with professional credentials and practice information")
model Provider extends BaseEntity {
  @doc("Reference to person record ID or expanded person object")
  @extension("x-expandable-field", #{ opId: "getPerson" })
  person: UUID | Person;

  @doc("Provider type")
  providerType: ProviderType;

  @doc("Years of experience")
  @minValue(0)
  @maxValue(70)
  yearsOfExperience?: int32;

  @doc("Professional biography")
  @maxLength(2000)
  biography?: string;

  @doc("Minor ailments specialties")
  minorAilmentsSpecialties?: string[];

  @doc("Minor ailment practice locations")
  minorAilmentsPracticeLocations?: string[];
}



/**
 * Provider update model - exported without namespace
 */
@doc("Provider profile update request")
model ProviderUpdateRequest {
  @doc("Years of experience")
  @minValue(0)
  @maxValue(70)
  yearsOfExperience?: int32 | null;

  @doc("Professional biography")
  @maxLength(2000)
  biography?: string | null;

  @doc("Minor ailments specialties")
  minorAilmentsSpecialties?: string[] | null;

  @doc("Minor ailment practice locations")
  minorAilmentsPracticeLocations?: string[] | null;
}



/**
 * Provider create request - exported without namespace
 */
@doc("Provider creation request")
model ProviderCreateRequest {
  @doc("Person demographic information")
  person?: PersonCreateRequest;

  @doc("Provider type")
  providerType: ProviderType;

  @doc("Years of experience")
  @minValue(0)
  @maxValue(70)
  yearsOfExperience?: int32;

  @doc("Professional biography")
  @maxLength(2000)
  biography?: string;

  @doc("Minor ailments specialties")
  minorAilmentsSpecialties?: string[];

  @doc("Minor ailment practice locations")
  minorAilmentsPracticeLocations?: string[];
}

// Namespace only for the interface/endpoints
@route("/providers")
@tag("Provider")
namespace ProviderModule {
  /**
   * Provider management interface
   */
  interface ProviderManagement {
  @doc("List providers. Public endpoint with optional authentication.")
  @operationId("listProviders")
  @get
  @useAuth([bearerAuth, Http.NoAuth])
  listProviders(
    @doc("Filter by provider minor ailment specialty")
    @query minorAilmentsSpecialty?: string,
    @doc("Filter by provider minor ailment practice location")
    @query minorAilmentsPracticeLocation?: string,
    @doc("Filter by language spoken")
    @query languageSpoken?: LanguageCode,
    ...ExpandParams,
    ...PaginationQuery
  ): ApiOkResponse<PaginatedResponse<Provider>>;

  @doc("Create new provider.")
  @operationId("createProvider")
  @post
  @useAuth(bearerAuth)
  @extension("x-security-required-roles", #["user"])
  createProvider(
    @body provider: ProviderCreateRequest
  ): ApiCreatedResponse<Provider>
    | ApiBadRequestResponse
    | ApiUnauthorizedResponse
    | ApiForbiddenResponse
    | ApiConflictResponse;

  @doc("Get provider profile. Optional authentication - returns additional details when authenticated. Use 'me' as the provider ID to get the current authenticated user's profile (requires authentication).")
  @operationId("getProvider")
  @get
  @useAuth([bearerAuth, Http.NoAuth])
  @route("/{provider}")
  getProvider(
    @path @doc("Provider ID (UUID) or 'me' for current user's profile") provider: UUID | "me",
    ...ExpandParams
  ): ApiOkResponse<Provider>
    | ApiNotFoundResponse;

  @doc("Update provider profile.")
  @operationId("updateProvider")
  @patch(#{implicitOptionality: true})
  @route("/{provider}")
  @useAuth(bearerAuth)
  @extension("x-security-required-roles", #["provider:owner"])
  updateProvider(
    @path provider: UUID,
    @body updates: ProviderUpdateRequest
  ): ApiOkResponse<Provider>
    | ApiNotFoundResponse
    | ApiForbiddenResponse
    | ApiBadRequestResponse
    | ApiUnauthorizedResponse;

  @doc("Delete provider.")
  @operationId("deleteProvider")
  @delete
  @route("/{provider}")
  @useAuth(bearerAuth)
  @extension("x-security-required-roles", #["provider:owner"])
  deleteProvider(
    @path provider: UUID
  ): ApiNoContentResponse
    | ApiNotFoundResponse
    | ApiForbiddenResponse
    | ApiUnauthorizedResponse;
  }
}
