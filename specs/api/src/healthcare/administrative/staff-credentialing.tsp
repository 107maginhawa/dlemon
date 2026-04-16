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
 * Medical Staff Credentialing and Privileging — manages the process of verifying
 * practitioner qualifications and granting clinical privileges to practice at a
 * healthcare facility.
 *
 * Aligned with Joint Commission medical staff standards (MS.06.01.01–MS.06.01.13)
 * and NCQA Credentialing standards. Supports primary source verification, privilege
 * delineation, and re-credentialing cycle management.
 */
namespace Healthcare.Administrative.Credentialing;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of a medical staff credentialing application or record.")
enum CredentialingStatus {
  @doc("The application has been submitted and is awaiting assignment to a reviewer")
  pending,

  @doc("The application is currently under review by the credentials committee or medical staff office")
  underReview,

  @doc("The credentials have been verified and the practitioner has been approved for membership or re-appointment")
  approved,

  @doc("The application has been denied; the denial reason is documented in the credentialing record")
  denied,

  @doc("The credentialing record or privilege grant has passed its expiration date and renewal is required")
  expired,

  @doc("The practitioner's privileges have been temporarily suspended (e.g., pending investigation)")
  suspended,

  @doc("The practitioner's appointment or privileges have been permanently revoked")
  revoked,
}

@doc("The level of supervision required for a clinical privilege grant.")
enum PrivilegeLevel {
  @doc("The practitioner may independently exercise the privilege without supervision")
  independent,

  @doc("The practitioner must have a supervisor available and cases reviewed as specified")
  supervised,

  @doc("The practitioner has been granted a provisional privilege pending satisfactory completion of a proctoring period")
  provisional,

  @doc("Temporary privileges granted for a limited period (e.g., locum tenens coverage, disaster response)")
  temporary,

  @doc("Emergency privileges granted under disaster or extreme patient care circumstances as permitted by facility policy")
  emergency,
}

@doc("The medical or surgical specialty category for a clinical privilege delineation.")
enum PrivilegeCategory {
  @doc("General medical privileges for non-surgical patient management")
  medical,

  @doc("Surgical privileges for operative and invasive procedures")
  surgical,

  @doc("Anesthesia privileges for the administration of anesthesia and sedation")
  anesthesia,

  @doc("Radiology and imaging privileges including diagnostic and interventional procedures")
  radiology,

  @doc("Pathology privileges for laboratory diagnosis and autopsy")
  pathology,

  @doc("Emergency medicine privileges")
  emergency,

  @doc("Obstetric and gynaecology privileges")
  obstetrics,

  @doc("Paediatric privileges for care of patients under 18 years")
  pediatrics,

  @doc("Psychiatry and behavioural health privileges")
  psychiatry,

  @doc("Other specialty category not captured above")
  other,
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("A credentialing record documenting the verification of a practitioner's qualifications, training, and professional standing for membership on a healthcare facility's medical staff. Captures the complete credentialing lifecycle including application, primary source verification, committee review, and approval or denial.")
model CredentialingRecord extends HealthcareBaseEntity {
  @doc("Reference to the Practitioner being credentialed")
  practitioner: Reference;

  @doc("Reference to the healthcare Organization (facility) at which credentialing is being sought")
  organization: Reference;

  @doc("Current status of the credentialing application or appointment")
  status: CredentialingStatus;

  @doc("Date the initial credentialing application was submitted")
  applicationDate: utcDateTime;

  @doc("Date the credentials committee or medical staff office commenced formal review")
  reviewDate?: utcDateTime;

  @doc("Date the governing body formally approved the practitioner's appointment")
  approvalDate?: utcDateTime;

  @doc("Date on which the current appointment expires and re-credentialing must be completed")
  expirationDate?: utcDateTime;

  @doc("The stated reason for denial if the application was not approved. Required when status is 'denied'.")
  denialReason?: string;

  @doc("Conditions imposed on the appointment (e.g., 'Chest radiograph required annually due to prior TB exposure')")
  conditions?: string[];

  @doc("Restrictions on the scope of practice (e.g., 'No independent after-hours procedures without on-call attending availability')")
  restrictions?: string[];

  @doc("Name or identifier of the medical executive committee or credentials committee that reviewed this application")
  reviewCommittee?: string;

  @doc("Date by which re-credentialing must begin to ensure continuity of appointment")
  nextReviewDate?: utcDateTime;

  @doc("References to supporting documents (e.g., medical school diploma, board certificates, malpractice history, DEA registration) stored as DocumentReference resources")
  documents?: Reference[];

  @doc("Medical staff office notes, reviewer comments, and committee minutes")
  note?: Annotation[];
}

@doc("A delineated clinical privilege grant authorising a practitioner to exercise specific clinical procedures or patient care activities at a healthcare facility. Privileges are granted based on demonstrated training, experience, and current competence.")
model ClinicalPrivilege extends HealthcareBaseEntity {
  @doc("Reference to the Practitioner holding this privilege")
  practitioner: Reference;

  @doc("Reference to the healthcare Organization (facility) that granted this privilege")
  organization: Reference;

  @doc("Medical or surgical specialty category for this privilege delineation")
  category: PrivilegeCategory;

  @doc("List of specific procedures or activities covered by this privilege grant (SNOMED CT or CPT coded)")
  procedures: CodeableConcept[];

  @doc("The level of supervision required to exercise these privileges")
  level: PrivilegeLevel;

  @doc("Date on which these privileges were formally granted by the governing body")
  grantedDate: utcDateTime;

  @doc("Date on which these privileges expire. Must be renewed through the re-appointment process.")
  expirationDate?: utcDateTime;

  @doc("Current status of this privilege grant")
  status: CredentialingStatus;

  @doc("Reference to the supervising Practitioner when level is 'supervised' or 'provisional'")
  supervisor?: Reference;

  @doc("Conditions specific to the exercise of these privileges (e.g., 'Laparoscopic cases only — no open conversion without attending backup')")
  conditions?: string[];

  @doc("Minimum case volume or competency requirements for privilege renewal (e.g., 'Minimum 10 cases per year required for renewal of laparoscopic cholecystectomy')")
  caseRequirements?: string;

  @doc("Medical staff office and committee notes related to this privilege grant")
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Search Parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for credentialing record queries.")
model CredentialingSearchParams {
  @doc("Filter by practitioner reference ID")
  @query
  practitioner?: string;

  @doc("Filter by organization reference ID")
  @query
  organization?: string;

  @doc("Filter by credentialing status")
  @query
  status?: CredentialingStatus;

  @doc("Filter records expiring at or before this date-time (for renewal sweeps)")
  @query
  expiringBefore?: utcDateTime;

  @doc("Filter records expiring at or after this date-time")
  @query
  expiringAfter?: utcDateTime;

  ...OffsetPaginationParams;
}

@doc("Search parameters for clinical privilege queries.")
model PrivilegeSearchParams {
  @doc("Filter by practitioner reference ID")
  @query
  practitioner?: string;

  @doc("Filter by privilege category")
  @query
  category?: PrivilegeCategory;

  @doc("Filter by privilege status")
  @query
  status?: CredentialingStatus;

  @doc("Filter by privilege level")
  @query
  level?: PrivilegeLevel;

  @doc("Filter by organization reference ID")
  @query
  organization?: string;

  @doc("Filter privileges expiring at or before this date-time")
  @query
  expiringBefore?: utcDateTime;

  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Medical staff credentialing lifecycle management — initiate applications, track primary source verification, record committee decisions, and manage re-credentialing cycles. Aligned with Joint Commission MS standards.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
@route("/administrative/credentialing")
interface CredentialingManagement {
  @doc("Create a new credentialing record for a practitioner applying for medical staff membership or re-appointment at a facility.")
  @operationId("createCredentialingRecord")
  @extension("x-security-required-roles", #["admin"])
  @post
  createCredentialingRecord(
    @body body: CredentialingRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: CredentialingRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a credentialing record by its logical ID.")
  @operationId("getCredentialingRecord")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getCredentialingRecord(
    @path @doc("CredentialingRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CredentialingRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a credentialing record with review dates, committee decisions, approval or denial, and conditions of appointment.")
  @operationId("updateCredentialingRecord")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateCredentialingRecord(
    @path @doc("CredentialingRecord logical ID") id: UUID,
    @body body: CredentialingRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: CredentialingRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a credentialing record. Only permitted for applications in 'pending' status that were submitted in error.")
  @operationId("deleteCredentialingRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteCredentialingRecord(
    @path @doc("CredentialingRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search credentialing records by practitioner, organization, status, and expiry date. Supports renewal reminder workflows and committee work queues.")
  @operationId("searchCredentialingRecords")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchCredentialingRecords(
    ...CredentialingSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CredentialingRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Clinical privilege management — grant, modify, and expire specific delineated privileges for medical staff members based on demonstrated competence.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
@route("/administrative/privileges")
interface PrivilegeManagement {
  @doc("Grant a new clinical privilege to a practitioner at a specific facility.")
  @operationId("createClinicalPrivilege")
  @extension("x-security-required-roles", #["admin"])
  @post
  createClinicalPrivilege(
    @body body: ClinicalPrivilege,
  ): {
    @statusCode statusCode: 201;
    @body result: ClinicalPrivilege;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a clinical privilege grant by its logical ID.")
  @operationId("getClinicalPrivilege")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getClinicalPrivilege(
    @path @doc("ClinicalPrivilege logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ClinicalPrivilege;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a clinical privilege — modify the scope of procedures, change the supervision level, add conditions, or record renewal.")
  @operationId("updateClinicalPrivilege")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateClinicalPrivilege(
    @path @doc("ClinicalPrivilege logical ID") id: UUID,
    @body body: ClinicalPrivilege,
  ): {
    @statusCode statusCode: 200;
    @body result: ClinicalPrivilege;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a clinical privilege record. Only permitted for privileges entered in error; use status='revoked' or status='expired' for normal privilege termination.")
  @operationId("deleteClinicalPrivilege")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteClinicalPrivilege(
    @path @doc("ClinicalPrivilege logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search clinical privileges by practitioner, category, status, and expiry. Supports compliance audits, privilege expiry notifications, and operating room access control verification.")
  @operationId("searchClinicalPrivileges")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchClinicalPrivileges(
    ...PrivilegeSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ClinicalPrivilege>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
