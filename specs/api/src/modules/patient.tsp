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
 * Patient Communication preference
 */
@doc("Language communication preference for a patient")
model PatientCommunication {
  @doc("Language expressed as a CodeableConcept (BCP-47 system)")
  language: CodeableConcept;

  @doc("Whether this is the patient's preferred communication language")
  preferred?: boolean;
}

/**
 * Patient link type enumeration
 */
@doc("Type of link between patient records")
enum PatientLinkType {
  @doc("The patient resource containing this link must no longer be used; the link points forward to the patient resource that should be used instead")
  replacedBy: "replaced-by",

  @doc("The patient resource containing this link is the current active patient record; the link points back to an inactive patient resource that should no longer be used to identify this patient")
  replaces: "replaces",

  @doc("The patient resource containing this link is in use and valid, but not considered the main source of information about this patient; the link points forward to another patient resource that should be consulted to retrieve additional patient information")
  refer: "refer",

  @doc("The patient resource containing this link is in use and valid, but points to another patient resource that is known to contain data about the same person; data in this resource might overlap or contradict information found in the other patient resource")
  seealso: "seealso",
}

/**
 * Patient link - used for record merging and replacement references
 */
@doc("Link to another patient resource that concerns the same actual patient")
model PatientLink {
  @doc("The other patient or related person resource that the link refers to")
  other: Reference;

  @doc("The type of link between this patient resource and another patient resource")
  type: PatientLinkType;
}

/**
 * Emergency contact for a patient
 */
@doc("A contact party for the patient in case of emergency")
model EmergencyContact {
  @doc("The kind of relationship (e.g. next-of-kin, guardian, spouse)")
  relationship: CodeableConcept[];

  @doc("A name associated with the emergency contact person")
  name?: HumanName;

  @doc("A contact detail for the person, e.g. a telephone number or email address")
  telecom?: ContactPoint[];
}

/**
 * Patient model - FHIR R4 Patient resource aligned
 */
@doc("FHIR R4-aligned patient record extending the healthcare base entity")
@example(#{
  id: "f5c7e14a-3b92-4d81-a6e0-7c2f9b8d4e31",
  version: 1,
  tenantId: "tenant-001",
  createdAt: utcDateTime.fromISO("2024-01-15T10:30:00Z"),
  updatedAt: utcDateTime.fromISO("2024-01-15T10:30:00Z"),
  active: true,
  name: #[#{ use: NameUse.official, family: "Smith", given: #["John", "Michael"] }],
  birthDate: plainDate.fromISO("1985-03-15"),
  gender: AdministrativeGender.male,
  mrn: "MRN-2024-001",
  telecom: #[#{ system: ContactSystem.phone, value: "+1-555-0123", use: ContactUse.mobile }],
}, #{ title: "Adult male patient" })
model Patient extends HealthcareBaseEntity {
  @doc("Whether this patient record is in active use")
  active: boolean;

  @doc("A name associated with the patient")
  name: HumanName[];

  @doc("The date of birth for the individual")
  birthDate: plainDate;

  @doc("Administrative gender (for administrative and record keeping purposes)")
  gender: AdministrativeGender;

  @doc("The patient's gender identity (SNOMED CT coded)")
  genderIdentity?: CodeableConcept;

  @doc("The patient's preferred pronouns (e.g. 'he/him', 'she/her', 'they/them')")
  pronouns?: string;

  @doc("Marital (civil) status of a patient")
  maritalStatus?: CodeableConcept;

  @doc("Indicates if the patient is deceased")
  deceased?: boolean;

  @doc("Date/time of death if known")
  deceasedDateTime?: utcDateTime;

  @doc("An address for the individual")
  address?: Address[];

  @doc("A contact detail (telephone, email, etc.) for the individual")
  telecom?: ContactPoint[];

  @doc("The patient's primary language (BCP-47 tag, e.g. 'en', 'fr-CA')")
  language?: string;

  @doc("A list of languages which may be used to communicate with the patient about their health")
  communication?: PatientCommunication[];

  @doc("Patient's nominated primary care providers")
  generalPractitioner?: Reference[];

  @doc("Organization that is the custodian of the patient record")
  managingOrganization?: Reference;

  @doc("Link to another patient resource that concerns the same actual person")
  link?: PatientLink[];

  @doc("Image of the patient")
  photo?: Attachment[];

  @doc("A contact party (e.g. guardian, partner, friend) for the patient")
  emergencyContact?: EmergencyContact[];

  @doc("Medical record number - shorthand identifier within managing organization")
  mrn?: string;

  @doc("Insurance coverage references for the patient")
  insuranceCoverage?: Reference[];

  @doc("Patient's primary care provider (free-form, kept for SDK compatibility)")
  primaryProvider?: PrimaryProviderInfo;

  @doc("Patient's primary pharmacy (free-form, kept for SDK compatibility)")
  primaryPharmacy?: PrimaryPharmacyInfo;

  @doc("Preferred dental branch ID for this patient")
  preferredBranchId?: UUID;

  @doc("Free-text summary of the patient's dental history")
  dentalHistorySummary?: string;

  @doc("Whether this patient has pending treatments requiring a follow-up visit")
  needsFollowUp?: boolean;

  @doc("Whether this patient has an active payment plan (set by billing module); prevents archiving")
  hasActivePaymentPlan?: boolean;
}

/**
 * Lightweight free-form description of a primary care provider.
 * Distinct from the FHIR-style Practitioner resource — used only by the
 * SDK convenience field `Patient.primaryProvider`.
 */
model PrimaryProviderInfo {
  @doc("Provider name")
  @minLength(1)
  @maxLength(100)
  name: string;

  @doc("Provider specialty")
  @maxLength(100)
  specialty?: string;

  @doc("Provider contact phone")
  phone?: string;
}

/**
 * Lightweight free-form description of a pharmacy.
 * Distinct from the FHIR-style Organization resource — used only by the
 * SDK convenience field `Patient.primaryPharmacy`.
 */
model PrimaryPharmacyInfo {
  @doc("Pharmacy name")
  @minLength(1)
  @maxLength(100)
  name: string;

  @doc("Pharmacy address")
  @maxLength(500)
  address?: string;

  @doc("Pharmacy contact phone")
  phone?: string;
}

/**
 * Patient create request
 */
@doc("Request body for creating a new patient record")
model CreatePatientRequest {
  @doc("A name associated with the patient (at least one required)")
  name: HumanName[];

  @doc("The date of birth for the individual")
  birthDate: plainDate;

  @doc("Administrative gender")
  gender: AdministrativeGender;

  @doc("Whether this patient record is in active use")
  active?: boolean;

  @doc("The patient's gender identity (SNOMED CT coded)")
  genderIdentity?: CodeableConcept;

  @doc("The patient's preferred pronouns")
  pronouns?: string;

  @doc("Marital (civil) status of the patient")
  maritalStatus?: CodeableConcept;

  @doc("Indicates if the patient is deceased")
  deceased?: boolean;

  @doc("Date/time of death if known")
  deceasedDateTime?: utcDateTime;

  @doc("An address for the individual")
  address?: Address[];

  @doc("A contact detail for the individual")
  telecom?: ContactPoint[];

  @doc("The patient's primary language (BCP-47 tag)")
  language?: string;

  @doc("Language communication preferences")
  communication?: PatientCommunication[];

  @doc("Patient's nominated primary care providers")
  generalPractitioner?: Reference[];

  @doc("Organization that is the custodian of the patient record")
  managingOrganization?: Reference;

  @doc("Image of the patient")
  photo?: Attachment[];

  @doc("Emergency contacts for the patient")
  emergencyContact?: EmergencyContact[];

  @doc("Medical record number within managing organization")
  mrn?: string;

  @doc("Insurance coverage references for the patient")
  insuranceCoverage?: Reference[];

  @doc("Preferred dental branch ID for this patient")
  preferredBranchId?: UUID;

  @doc("Free-text summary of the patient's dental history")
  dentalHistorySummary?: string;
}

/**
 * Patient update request - all fields optional, nullable for clearing
 */
@doc("Request body for updating an existing patient record; null values clear the field")
model UpdatePatientRequest {
  @doc("Updated names for the patient - null clears all names (use with caution)")
  name?: HumanName[] | null;

  @doc("Updated date of birth - null clears the field")
  birthDate?: plainDate | null;

  @doc("Updated administrative gender")
  gender?: AdministrativeGender | null;

  @doc("Updated active status")
  active?: boolean | null;

  @doc("Updated gender identity - null clears the field")
  genderIdentity?: CodeableConcept | null;

  @doc("Updated preferred pronouns - null clears the field")
  pronouns?: string | null;

  @doc("Updated marital status - null clears the field")
  maritalStatus?: CodeableConcept | null;

  @doc("Updated deceased flag - null clears the field")
  deceased?: boolean | null;

  @doc("Updated date/time of death - null clears the field")
  deceasedDateTime?: utcDateTime | null;

  @doc("Updated addresses - null clears all addresses")
  address?: Address[] | null;

  @doc("Updated contact details - null clears all contact points")
  telecom?: ContactPoint[] | null;

  @doc("Updated primary language - null clears the field")
  language?: string | null;

  @doc("Updated language communication preferences - null clears all preferences")
  communication?: PatientCommunication[] | null;

  @doc("Updated primary care providers - null clears all GP references")
  generalPractitioner?: Reference[] | null;

  @doc("Updated managing organization - null clears the field")
  managingOrganization?: Reference | null;

  @doc("Updated patient photos - null clears all photos")
  photo?: Attachment[] | null;

  @doc("Updated emergency contacts - null clears all emergency contacts")
  emergencyContact?: EmergencyContact[] | null;

  @doc("Updated medical record number - null clears the field")
  mrn?: string | null;

  @doc("Updated insurance coverage references - null clears all coverage")
  insuranceCoverage?: Reference[] | null;

  @doc("Updated preferred dental branch ID - null clears the field")
  preferredBranchId?: UUID | null;

  @doc("Updated dental history summary - null clears the field")
  dentalHistorySummary?: string | null;

  @doc("Updated needs-follow-up flag - null clears the field")
  needsFollowUp?: boolean | null;
}

@doc("Request to merge two patient records into one")
model PatientMergeRequest {
  @doc("The patient record to keep (target)")
  targetPatientId: UUID;
  @doc("The patient record to merge into the target (source — will be marked as replaced)")
  sourcePatientId: UUID;
  @doc("Reason for the merge")
  reason: string;
  @doc("Whether to preview the merge without executing")
  dryRun?: boolean;
}

@doc("Request to reverse a previous patient merge")
model PatientUnmergeRequest {
  @doc("The merged (target) patient ID")
  targetPatientId: UUID;
  @doc("The original source patient ID to restore")
  sourcePatientId: UUID;
  @doc("Reason for the unmerge")
  reason: string;
}

@doc("Result of a patient merge or unmerge operation")
model PatientMergeResult {
  @doc("Whether the operation succeeded")
  success: boolean;
  @doc("The surviving patient record")
  targetPatient: Patient;
  @doc("Number of records updated")
  recordsUpdated: int64;
  @doc("Details of what was merged/unmerged")
  details?: string;
}

/**
 * Patient Management Module
 *
 * FHIR R4-aligned patient record management providing comprehensive demographic,
 * clinical context, and administrative data for individuals receiving healthcare.
 * Supports full patient lifecycle from registration through deactivation.
 */
@route("/patients")
@tag("Patient")
namespace PatientModule {
  /**
   * Patient management interface
   */
  interface PatientManagement {
    @doc("Create a new patient record.")
    @operationId("createPatient")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "registrar", "user"])
    createPatient(
      @body patient: CreatePatientRequest
    ): ApiCreatedResponse<Patient>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("List patients with optional filtering by name, birth date, gender, MRN, or active status.")
    @operationId("listPatients")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "support", "user"])
    listPatients(
      ...PaginationQuery,
      @doc("Filter by patient name (searches across all HumanName components)")
      @query name?: string,
      @doc("Filter by date of birth (ISO 8601 date, e.g. '1990-05-21')")
      @query birthDate?: string,
      @doc("Filter by administrative gender (male, female, other, unknown)")
      @query gender?: string,
      @doc("Filter by medical record number")
      @query mrn?: string,
      @doc("Filter by active status")
      @query active?: boolean,
      @doc("Filter patients by preferred dental branch ID")
      @query branchId?: UUID,
      @doc("Filter patients who need a follow-up visit")
      @query needsFollowUp?: boolean
    ): ApiOkResponse<PaginatedResponse<Patient>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Retrieve a single patient record by ID.")
    @operationId("getPatient")
    @get
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "support", "user", "patient:owner"])
    getPatient(
      @path @doc("Patient record UUID") id: UUID
    ): ApiOkResponse<Patient>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update an existing patient record. Provide only the fields to change; null values clear optional fields.")
    @operationId("updatePatient")
    @patch(#{implicitOptionality: true})
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "registrar", "user", "patient:owner"])
    updatePatient(
      @path @doc("Patient record UUID") id: UUID,
      @body updates: UpdatePatientRequest
    ): ApiOkResponse<Patient>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Deactivate a patient record (sets active=false). Records are retained for audit and legal purposes.")
    @operationId("deactivatePatient")
    @delete
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "registrar", "user"])
    deactivatePatient(
      @path @doc("Patient record UUID") id: UUID
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Merge two patient records. The source patient record is marked as replaced and all references are updated to point to the target patient.")
    @operationId("mergePatients")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    @post
    @route("/merge")
    mergePatients(
      @body body: PatientMergeRequest
    ): ApiOkResponse<PatientMergeResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Unmerge previously merged patient records. Reverses a merge operation and restores the source patient record.")
    @operationId("unmergePatients")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    @post
    @route("/unmerge")
    unmergePatients(
      @body body: PatientUnmergeRequest
    ): ApiOkResponse<PatientMergeResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
