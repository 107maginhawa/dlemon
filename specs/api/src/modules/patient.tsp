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
 * Patient profile extending Person - exported without namespace
 */
@doc("Patient profile with medical and administrative information")
model Patient extends BaseEntity {
  @doc("Reference to person record ID or expanded person object")
  @extension("x-expandable-field", #{ opId: "getPerson" })
  person: UUID | Person;

  @doc("Primary care provider information")
  primaryProvider?: ProviderInfo;

  @doc("Primary pharmacy information")
  primaryPharmacy?: PharmacyInfo;
}

/**
 * Provider info model - exported without namespace
 */
@doc("Provider information for patient reference")
model ProviderInfo {
  @doc("Provider name")
  @minLength(1)
  @maxLength(100)
  name: string;

  @doc("Provider specialty")
  @maxLength(100)
  specialty?: string;

  @doc("Provider contact phone")
  phone?: PhoneNumber;

  @doc("Provider fax number")
  fax?: FaxNumber;
}

/**
 * Pharmacy info model - exported without namespace
 */
@doc("Pharmacy information for patient reference")
model PharmacyInfo {
  @doc("Pharmacy name")
  @minLength(1)
  @maxLength(100)
  name: string;

  @doc("Pharmacy address")
  @maxLength(500)
  address?: string;

  @doc("Pharmacy contact phone")
  phone?: PhoneNumber;

  @doc("Pharmacy fax number")
  fax?: FaxNumber;
}

// Patient Management Module - namespace only for interfaces
/**
 * Patient Management Module
 * 
 * Extends the Person module to provide patient-specific functionality including
 * primary provider and pharmacy information management.
 * Focuses on essential patient data management with simple CRUD operations.
 */
@route("/patients")
@tag("Patient")
namespace PatientModule {
  /**
   * Patient management interface
   */
  interface PatientManagement {
    @doc("List patients.")
    @operationId("listPatients")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "support"])
    listPatients(
      ...ExpandParams,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<Patient>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Create new patient.")
    @operationId("createPatient")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createPatient(
      @body patient: PatientCreateRequest
    ): ApiCreatedResponse<Patient>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiConflictResponse;

    @doc("Get patient profile. Use 'me' as the patient ID to get the current authenticated user's patient profile.")
    @operationId("getPatient")
    @get
    @route("/{patient}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "support", "patient:owner"])
    getPatient(
      @path @doc("Patient ID (UUID) or 'me' for current user's profile") patient: UUID | "me",
      ...ExpandParams
    ): ApiOkResponse<Patient>
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Update patient profile.")
    @operationId("updatePatient")
    @patch(#{implicitOptionality: true})
    @route("/{patient}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["patient:owner"])
    updatePatient(
      @path patient: UUID,
      @body updates: PatientUpdateRequest
    ): ApiOkResponse<Patient>
      | ApiNotFoundResponse
      | ApiForbiddenResponse
      | ApiBadRequestResponse;

    @doc("Delete patient.")
    @operationId("deletePatient")
    @delete
    @route("/{patient}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["patient:owner"])
    deletePatient(
      @path patient: UUID
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;
  }
}

// Supporting Models - exported without namespace


/**
 * Patient create request - exported without namespace
 */
@doc("Patient creation request")
model PatientCreateRequest {
  @doc("Person demographic information")
  person?: PersonCreateRequest;

  @doc("Primary care provider information")
  primaryProvider?: ProviderInfo;

  @doc("Primary pharmacy information")
  primaryPharmacy?: PharmacyInfo;
}

/**
 * Provider info for updates (with nullable fields)
 */
@doc("Provider information for patient reference - update model")
model ProviderInfoUpdate {
  @doc("Provider name")
  @minLength(1)
  @maxLength(100)
  name?: string;

  @doc("Provider specialty - can be null to clear")
  @maxLength(100)
  specialty?: string | null;

  @doc("Provider contact phone - can be null to clear")
  phone?: PhoneNumber | null;

  @doc("Provider fax number - can be null to clear")
  fax?: FaxNumber | null;
}

/**
 * Pharmacy info for updates (with nullable fields)
 */
@doc("Pharmacy information for patient reference - update model")
model PharmacyInfoUpdate {
  @doc("Pharmacy name")
  @minLength(1)
  @maxLength(100)
  name?: string;

  @doc("Pharmacy address - can be null to clear")
  @maxLength(500)
  address?: string | null;

  @doc("Pharmacy contact phone - can be null to clear")
  phone?: PhoneNumber | null;

  @doc("Pharmacy fax number - can be null to clear")
  fax?: FaxNumber | null;
}

/**
 * Patient update request - exported without namespace
 */
@doc("Patient profile update request")
model PatientUpdateRequest {
  @doc("Primary care provider information - can be null to clear")
  primaryProvider?: ProviderInfoUpdate | null;

  @doc("Primary pharmacy information - can be null to clear")
  primaryPharmacy?: PharmacyInfoUpdate | null;
}
