import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";
import "../healthcare/core/primitives.tsp";
import "../healthcare/core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Credential type enumeration
 */
@doc("Type of professional credential held by a practitioner")
enum CredentialType {
  @doc("National Provider Identifier (US)")
  npi: "npi",

  @doc("Drug Enforcement Administration registration")
  dea: "dea",

  @doc("State-issued professional license")
  stateLicense: "state-license",

  @doc("Board certification from a medical specialty board")
  boardCertification: "board-certification",

  @doc("Continuing Medical Education certificate")
  cme: "cme",

  @doc("Other credential type not listed")
  other: "other",
}

/**
 * Credential status enumeration
 */
@doc("Current lifecycle status of a practitioner credential")
enum CredentialStatus {
  @doc("Credential is current and in good standing")
  active: "active",

  @doc("Credential has passed its expiry date")
  expired: "expired",

  @doc("Credential has been temporarily suspended")
  suspended: "suspended",

  @doc("Credential has been permanently revoked")
  revoked: "revoked",

  @doc("Credential application is pending approval")
  pending: "pending",
}

/**
 * Practitioner qualification (education, training, certification)
 */
@doc("Qualifications obtained by training and certification for the practitioner")
model PractitionerQualification {
  @doc("An identifier for this qualification for the individual")
  identifier?: Identifier[];

  @doc("Coded representation of the qualification (e.g. MBBS, MD, PhD)")
  code: CodeableConcept;

  @doc("Period during which the qualification is valid")
  period?: Period;

  @doc("Organization that regulates and issues the qualification")
  issuer?: Reference;
}

/**
 * Practitioner professional credential
 */
@doc("A verified professional credential (license, DEA, NPI, etc.) held by the practitioner")
model PractitionerCredential {
  @doc("Type of credential")
  type: CredentialType;

  @doc("Credential number or identifier issued by the authority")
  number: string;

  @doc("State or jurisdiction that issued the credential (if applicable)")
  state?: string;

  @doc("Date the credential was issued")
  issuedDate: plainDate;

  @doc("Date the credential expires")
  expiryDate: plainDate;

  @doc("Timestamp when this credential was last verified")
  verifiedAt?: utcDateTime;

  @doc("Reference to the practitioner or organization that performed verification")
  verifiedBy?: Reference;

  @doc("Current lifecycle status of the credential")
  status: CredentialStatus;
}

/**
 * Practitioner model - FHIR R4 Practitioner resource aligned
 */
@doc("FHIR R4-aligned practitioner record representing a person who is directly or indirectly involved in the provisioning of healthcare")
model Practitioner extends HealthcareBaseEntity {
  @doc("Whether this practitioner's record is in active use")
  active: boolean;

  @doc("The name(s) associated with the practitioner")
  name: HumanName[];

  @doc("A contact detail for the practitioner (e.g. telephone number or email address)")
  telecom?: ContactPoint[];

  @doc("Address(es) of the practitioner that are not role specific")
  address?: Address[];

  @doc("Administrative gender of the practitioner")
  gender?: AdministrativeGender;

  @doc("The date of birth for the practitioner")
  birthDate?: plainDate;

  @doc("Image of the practitioner")
  photo?: Attachment[];

  @doc("The official qualifications, certifications, accreditations, training, licenses, etc. that authorize or otherwise pertain to the provision of care")
  qualification: PractitionerQualification[];

  @doc("Professional credentials (licenses, DEA, NPI, board certifications, etc.) held by the practitioner")
  credential: PractitionerCredential[];

  @doc("Clinical specialties the practitioner is able to perform (SNOMED CT specialty codes)")
  specialties: CodeableConcept[];

  @doc("Languages in which the practitioner can communicate with patients")
  languages?: CodeableConcept[];
}

/**
 * Available time window within a PractitionerRole
 */
@doc("A collection of times the practitioner is available or performing this role at the location and/or healthcareservice")
model AvailableTime {
  @doc("Days of the week (mon, tue, wed, thu, fri, sat, sun)")
  daysOfWeek?: string[];

  @doc("Always available for all days - overrides daysOfWeek")
  allDay?: boolean;

  @doc("Opening time of day (HH:mm:ss, e.g. '08:00:00')")
  availableStartTime?: string;

  @doc("Closing time of day (HH:mm:ss, e.g. '17:00:00')")
  availableEndTime?: string;
}

/**
 * Not-available time window within a PractitionerRole
 */
@doc("The practitioner is not available during this period due to the provided reason")
model NotAvailableTime {
  @doc("The reason that can be presented to the user as to why this time is not available")
  description: string;

  @doc("Service not available from this date through the end date")
  during?: Period;
}

/**
 * PractitionerRole model - FHIR R4 PractitionerRole resource aligned
 */
@doc("FHIR R4-aligned record of a practitioner's roles, locations, specialties and availability within an organization")
model PractitionerRole extends HealthcareBaseEntity {
  @doc("Whether this practitioner role record is in active use")
  active: boolean;

  @doc("The period during which the practitioner is authorized to perform in these role(s)")
  period?: Period;

  @doc("Reference to the Practitioner this role belongs to")
  practitioner: Reference;

  @doc("The organization where the roles are available")
  organization: Reference;

  @doc("Roles which this practitioner is authorized to perform for the organization (e.g. doctor, nurse, pharmacist)")
  code: CodeableConcept[];

  @doc("Specific specialty of the practitioner in this role (SNOMED CT)")
  specialty: CodeableConcept[];

  @doc("The location(s) at which this practitioner provides care")
  location?: Reference[];

  @doc("The list of healthcare services that this worker provides for this role's Organization/Location(s)")
  healthcareService?: Reference[];

  @doc("Contact details that are specific to the role/location/service")
  telecom?: ContactPoint[];

  @doc("A collection of times the practitioner is available or performing this role")
  availableTime?: AvailableTime[];

  @doc("The practitioner is not available or performing this role during these periods")
  notAvailable?: NotAvailableTime[];
}

/**
 * Practitioner create request
 */
@doc("Request body for registering a new practitioner")
model CreatePractitionerRequest {
  @doc("The name(s) associated with the practitioner (at least one required)")
  name: HumanName[];

  @doc("Whether this practitioner's record is in active use")
  active?: boolean;

  @doc("Contact details for the practitioner")
  telecom?: ContactPoint[];

  @doc("Addresses for the practitioner")
  address?: Address[];

  @doc("Administrative gender of the practitioner")
  gender?: AdministrativeGender;

  @doc("Date of birth")
  birthDate?: plainDate;

  @doc("Image(s) of the practitioner")
  photo?: Attachment[];

  @doc("Official qualifications and certifications")
  qualification?: PractitionerQualification[];

  @doc("Professional credentials held by the practitioner")
  credential?: PractitionerCredential[];

  @doc("Clinical specialties (SNOMED CT codes)")
  specialties?: CodeableConcept[];

  @doc("Languages in which the practitioner can communicate")
  languages?: CodeableConcept[];
}

/**
 * Practitioner update request - all fields optional, nullable for clearing
 */
@doc("Request body for updating a practitioner record; null values clear the field")
model UpdatePractitionerRequest {
  @doc("Updated names - null clears all names (use with caution)")
  name?: HumanName[] | null;

  @doc("Updated active status")
  active?: boolean | null;

  @doc("Updated contact details - null clears all telecom entries")
  telecom?: ContactPoint[] | null;

  @doc("Updated addresses - null clears all addresses")
  address?: Address[] | null;

  @doc("Updated administrative gender - null clears the field")
  gender?: AdministrativeGender | null;

  @doc("Updated date of birth - null clears the field")
  birthDate?: plainDate | null;

  @doc("Updated photos - null clears all photos")
  photo?: Attachment[] | null;

  @doc("Updated qualifications - null clears all qualifications")
  qualification?: PractitionerQualification[] | null;

  @doc("Updated credentials - null clears all credentials")
  credential?: PractitionerCredential[] | null;

  @doc("Updated specialties - null clears all specialties")
  specialties?: CodeableConcept[] | null;

  @doc("Updated languages - null clears all language entries")
  languages?: CodeableConcept[] | null;
}

/**
 * PractitionerRole create request
 */
@doc("Request body for creating a new practitioner role assignment")
model CreatePractitionerRoleRequest {
  @doc("Reference to the Practitioner")
  practitioner: Reference;

  @doc("Reference to the Organization")
  organization: Reference;

  @doc("Role codes for this assignment")
  code: CodeableConcept[];

  @doc("Clinical specialties for this role")
  specialty: CodeableConcept[];

  @doc("Whether this role record is active")
  active?: boolean;

  @doc("Period during which this role is valid")
  period?: Period;

  @doc("Location references where this practitioner provides care")
  location?: Reference[];

  @doc("Healthcare service references")
  healthcareService?: Reference[];

  @doc("Contact details specific to this role")
  telecom?: ContactPoint[];

  @doc("Availability windows")
  availableTime?: AvailableTime[];

  @doc("Not-available time blocks")
  notAvailable?: NotAvailableTime[];
}

/**
 * PractitionerRole update request - all fields optional, nullable for clearing
 */
@doc("Request body for updating a practitioner role record; null values clear the field")
model UpdatePractitionerRoleRequest {
  @doc("Updated active status")
  active?: boolean | null;

  @doc("Updated validity period - null clears the field")
  period?: Period | null;

  @doc("Updated role codes - null clears all codes")
  code?: CodeableConcept[] | null;

  @doc("Updated specialties - null clears all specialties")
  specialty?: CodeableConcept[] | null;

  @doc("Updated location references - null clears all locations")
  location?: Reference[] | null;

  @doc("Updated healthcare service references - null clears all services")
  healthcareService?: Reference[] | null;

  @doc("Updated role-specific contact details - null clears all telecom entries")
  telecom?: ContactPoint[] | null;

  @doc("Updated availability windows - null clears all availability")
  availableTime?: AvailableTime[] | null;

  @doc("Updated not-available blocks - null clears all entries")
  notAvailable?: NotAvailableTime[] | null;
}

/**
 * Provider Module
 *
 * FHIR R4-aligned management of Practitioners (individuals who provide healthcare)
 * and PractitionerRoles (role/location/availability assignments within organizations).
 * Supports credentialing workflows, specialty search, and schedule management.
 */
/**
 * ProviderType — pre-FHIR enumeration kept for SDK compatibility.
 */
@doc("Type of provider (pre-FHIR enumeration)")
enum ProviderType {
  dentist: "dentist",
  hygienist: "hygienist",
  orthodontist: "orthodontist",
  endodontist: "endodontist",
  periodontist: "periodontist",
  oral_surgeon: "oral_surgeon",
  pediatric_dentist: "pediatric_dentist",
  pharmacist: "pharmacist",
  other: "other",
}

/**
 * Provider — pre-FHIR provider model kept for SDK compatibility.
 *
 * The runtime "provider" terminology predates the FHIR-aligned Practitioner
 * rename. This model carries the original SDK fields (providerType,
 * yearsOfExperience, biography, minorAilmentsSpecialties,
 * minorAilmentsPracticeLocations) plus a `person` reference. New code should
 * prefer the FHIR-style Practitioner above.
 */
@doc("Pre-FHIR provider model kept for SDK compatibility")
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

@route("/providers")
@tag("Provider")
namespace ProviderModule {
  /**
   * Practitioner management interface
   */
  interface PractitionerManagement {
    @doc("Register a new practitioner.")
    @operationId("createPractitioner")
    @post
    @route("/practitioners")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "credentialing"])
    createPractitioner(
      @body practitioner: CreatePractitionerRequest
    ): ApiCreatedResponse<Practitioner>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("List practitioners with optional filtering by name, specialty, location, or NPI.")
    @operationId("listPractitioners")
    @get
    @route("/practitioners")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "support"])
    listPractitioners(
      ...PaginationQuery,
      @doc("Filter by practitioner name")
      @query name?: string,
      @doc("Filter by SNOMED CT specialty code")
      @query specialty?: string,
      @doc("Filter by NPI number")
      @query npi?: string,
      @doc("Filter by active status")
      @query active?: boolean
    ): ApiOkResponse<PaginatedResponse<Practitioner>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Retrieve a single practitioner record by ID.")
    @operationId("getPractitioner")
    @get
    @route("/practitioners/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "support", "practitioner:owner"])
    getPractitioner(
      @path @doc("Practitioner record UUID") id: UUID
    ): ApiOkResponse<Practitioner>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a practitioner record. Provide only the fields to change; null values clear optional fields.")
    @operationId("updatePractitioner")
    @patch(#{implicitOptionality: true})
    @route("/practitioners/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "credentialing", "practitioner:owner"])
    updatePractitioner(
      @path @doc("Practitioner record UUID") id: UUID,
      @body updates: UpdatePractitionerRequest
    ): ApiOkResponse<Practitioner>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Deactivate a practitioner record (sets active=false). Records are retained for audit and legal purposes.")
    @operationId("deactivatePractitioner")
    @delete
    @route("/practitioners/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deactivatePractitioner(
      @path @doc("Practitioner record UUID") id: UUID
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * PractitionerRole management interface
   */
  interface PractitionerRoleManagement {
    @doc("Create a new practitioner role assignment linking a practitioner to an organization.")
    @operationId("createPractitionerRole")
    @post
    @route("/practitioner-roles")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "credentialing"])
    createPractitionerRole(
      @body role: CreatePractitionerRoleRequest
    ): ApiCreatedResponse<PractitionerRole>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("List practitioner roles with optional filtering by practitioner, organization, specialty, or location.")
    @operationId("listPractitionerRoles")
    @get
    @route("/practitioner-roles")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "support"])
    listPractitionerRoles(
      ...PaginationQuery,
      @doc("Filter by practitioner UUID")
      @query practitioner?: UUID,
      @doc("Filter by organization UUID")
      @query organization?: UUID,
      @doc("Filter by SNOMED CT specialty code")
      @query specialty?: string,
      @doc("Filter by location UUID")
      @query location?: UUID,
      @doc("Filter by active status")
      @query active?: boolean
    ): ApiOkResponse<PaginatedResponse<PractitionerRole>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Retrieve a single practitioner role record by ID.")
    @operationId("getPractitionerRole")
    @get
    @route("/practitioner-roles/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "support", "practitioner:owner"])
    getPractitionerRole(
      @path @doc("PractitionerRole record UUID") id: UUID
    ): ApiOkResponse<PractitionerRole>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a practitioner role record. Provide only the fields to change; null values clear optional fields.")
    @operationId("updatePractitionerRole")
    @patch(#{implicitOptionality: true})
    @route("/practitioner-roles/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "credentialing", "practitioner:owner"])
    updatePractitionerRole(
      @path @doc("PractitionerRole record UUID") id: UUID,
      @body updates: UpdatePractitionerRoleRequest
    ): ApiOkResponse<PractitionerRole>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Deactivate a practitioner role record (sets active=false).")
    @operationId("deactivatePractitionerRole")
    @delete
    @route("/practitioner-roles/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deactivatePractitionerRole(
      @path @doc("PractitionerRole record UUID") id: UUID
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }
}
