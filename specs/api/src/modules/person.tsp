import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";
import "./storage.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Contact information
 */
@doc("Contact details")
model ContactInfo {
  @doc("Primary email address")
  email?: Email;

  @doc("Primary phone number")
  phone?: PhoneNumber;
}

/**
 * Person model - exported without namespace
 */
@doc("Person demographic and contact information")
model Person extends BaseEntity {
  @doc("First name")
  @minLength(1)
  @maxLength(50)
  firstName: string;

  @doc("Last name")
  @minLength(1)
  @maxLength(50)
  lastName?: string;

  @doc("Middle name")
  @maxLength(50)
  middleName?: string;

  @doc("Date of birth")
  dateOfBirth?: plainDate;

  @doc("Gender")
  gender?: Gender;

  @doc("Primary address")
  primaryAddress?: Address;

  @doc("Contact information")
  contactInfo?: ContactInfo;

  @doc("Avatar image")
  avatar?: MaybeStoredFile;

  @doc("Languages spoken by the person")
  languagesSpoken?: LanguageCode[];

  @doc("Person's timezone")
  timezone?: TimezoneId;
}

/**
 * Gender enumeration - exported without namespace
 */
@doc("Gender identity")
enum Gender {
  @doc("Male")
  male: "male",
  
  @doc("Female")
  female: "female",
  
  @doc("Non-binary")
  nonBinary: "non-binary",
  
  @doc("Other")
  other: "other",
  
  @doc("Prefer not to say")
  preferNotToSay: "prefer-not-to-say",
}


// Namespace only for the interfaces/endpoints
/**
 * Person Management Module
 * 
 * Handles personal information, demographics, and contact details
 * for all individuals in the system.
 */
@route("/persons")
@tag("Person")
namespace PersonModule {
  /**
   * Person management interface
   */
  interface PersonManagement {
    @doc("Create new person.")
    @operationId("createPerson")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createPerson(
      @body person: PersonCreateRequest
    ): ApiCreatedResponse<Person>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get person by ID.")
    @operationId("getPerson")
    @get
    @route("/{person}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "support", "user:owner"])
    getPerson(
      @path @doc("Person ID (UUID) or 'me' for current user's profile") person: UUID | "me"
    ): ApiOkResponse<Person>
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Update person.")
    @operationId("updatePerson")
    @patch(#{implicitOptionality: true})
    @route("/{person}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user:owner"])
    updatePerson(
      @path person: UUID,
      @body updates: PersonUpdateRequest
    ): ApiOkResponse<Person>
      | ApiNotFoundResponse
      | ApiForbiddenResponse
      | ApiBadRequestResponse;

    @doc("List persons.")
    @operationId("listPersons")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "support"])
    listPersons(
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<Person>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

  }
}

// Supporting Models - exported without namespace


/**
 * Person creation request
 */
@doc("Person creation request")
model PersonCreateRequest {
  @doc("First name")
  @minLength(1)
  @maxLength(50)
  firstName: string;

  @doc("Last name")
  @minLength(1)
  @maxLength(50)
  lastName?: string;

  @doc("Middle name")
  @maxLength(50)
  middleName?: string;

  @doc("Date of birth")
  dateOfBirth?: plainDate;

  @doc("Gender")
  gender?: Gender;

  @doc("Primary address")
  primaryAddress?: Address;

  @doc("Contact information")
  contactInfo?: ContactInfo;

  @doc("Avatar image")
  avatar?: MaybeStoredFile;

  @doc("Languages spoken by the person")
  languagesSpoken?: LanguageCode[];

  @doc("Person's timezone")
  timezone?: TimezoneId;
}

/**
 * Person update request
 */
@doc("Person update request")
model PersonUpdateRequest {
  @doc("First name")
  @minLength(1)
  @maxLength(50)
  firstName?: string;

  @doc("Last name - can be null to clear")
  @minLength(1)
  @maxLength(50)
  lastName?: string | null;

  @doc("Middle name - can be null to clear")
  @maxLength(50)
  middleName?: string | null;

  @doc("Date of birth - can be null to clear")
  dateOfBirth?: plainDate | null;

  @doc("Gender - can be null to clear")
  gender?: Gender | null;

  @doc("Primary address - can be null to clear")
  primaryAddress?: AddressUpdate | null;

  @doc("Contact information - can be null to clear")
  contactInfo?: ContactInfo | null;

  @doc("Avatar image - can be null to clear")
  avatar?: MaybeStoredFileUpdate | null;

  @doc("Languages spoken by the person - can be null to clear")
  languagesSpoken?: LanguageCode[] | null;

  @doc("Person's timezone - can be null to clear")
  timezone?: TimezoneId | null;
}



