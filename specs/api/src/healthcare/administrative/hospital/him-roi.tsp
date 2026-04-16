import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../../common/models.tsp";
import "../../../common/errors.tsp";
import "../../../common/pagination.tsp";
import "../../../common/security.tsp";
import "../../core/primitives.tsp";
import "../../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Health Information Management (HIM) and Release of Information (ROI) module.
 *
 * Manages the full lifecycle of patient information release requests, medical
 * record requests, and clinical coding review workflows. Supports HIPAA-compliant
 * authorization tracking, delivery method selection, fee management, and ICD/DRG
 * coding documentation aligned with HIM best practices.
 */
namespace Healthcare.Administrative.Hospital.HIMROI;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Category of entity requesting a release of information.")
enum ROIRequestorType {
  @doc("The patient themselves is requesting their own records")
  patient,

  @doc("An attorney acting on behalf of the patient or in a legal proceeding")
  attorney,

  @doc("An insurance carrier or managed care organization")
  insurance,

  @doc("The patient's current or prospective employer")
  employer,

  @doc("Another healthcare provider treating the patient")
  otherProvider,

  @doc("Law enforcement agency with legal authority to request records")
  lawEnforcement,

  @doc("A government agency with statutory authority to access records")
  government,

  @doc("Any other requestor type not covered by the above categories")
  other,
}

@doc("Lifecycle status of a Release of Information request.")
enum ROIStatus {
  @doc("The request has been received and logged but not yet reviewed")
  received,

  @doc("The request is currently under review for completeness and validity")
  inReview,

  @doc("A valid authorization form is required before processing can proceed")
  authorizationPending,

  @doc("The records are being gathered and prepared for release")
  processing,

  @doc("Records have been prepared and are ready to be released to the requestor")
  readyForRelease,

  @doc("Records have been released to the requestor")
  released,

  @doc("The request has been denied (e.g., invalid authorization, legal hold, no records found)")
  denied,

  @doc("The request has been cancelled by the requestor or the organization")
  cancelled,
}

@doc("Method by which released records are delivered to the requestor.")
enum DeliveryMethod {
  @doc("Physical records delivered via postal mail")
  mail,

  @doc("Records transmitted via secure fax")
  fax,

  @doc("Records made available through a secure patient or provider portal")
  electronicPortal,

  @doc("Records transmitted via HIPAA-compliant secure email")
  secureEmail,

  @doc("Records picked up or reviewed in person at the facility")
  inPerson,
}

@doc("Type of medical record request submitted by or on behalf of a patient.")
enum RecordRequestType {
  @doc("Request for a copy of medical records")
  copy,

  @doc("Request to amend or correct information in the medical record")
  amendment,

  @doc("Request to restrict use or disclosure of protected health information")
  restriction,

  @doc("Request for an accounting of disclosures of protected health information")
  accounting,
}

@doc("Lifecycle status of a medical record request.")
enum RecordRequestStatus {
  @doc("The request has been submitted and is awaiting processing")
  submitted,

  @doc("The request is currently being processed")
  inProgress,

  @doc("The request has been fulfilled")
  completed,

  @doc("The request has been denied with documented reason")
  denied,
}

@doc("Workflow status of a clinical coding review record.")
enum CodingReviewStatus {
  @doc("The coding review is in draft and has not been submitted for validation")
  draft,

  @doc("Codes have been assigned and the review is ready for quality check")
  coded,

  @doc("A clinical documentation improvement (CDI) query has been sent to the provider")
  querySent,

  @doc("The CDI query has been answered by the provider and coding can be finalized")
  queryResolved,

  @doc("The coding review is finalized and submitted for billing")
  finalized,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("Parameters for releasing records on an ROI request.")
model ROIReleaseParams {
  @doc("Date and time the records were released to the requestor")
  releasedDate: utcDateTime;

  @doc("Reference to the staff member who performed the release")
  releasedBy: Reference;

  @doc("Delivery method used for this release")
  deliveryMethod: DeliveryMethod;

  @doc("Optional note documenting the release details")
  note?: string;
}

@doc("Parameters for denying an ROI request.")
model ROIDenyParams {
  @doc("Documented reason for denial")
  reason: string;

  @doc("Optional reference to a specific policy or regulatory basis for denial")
  policyReference?: string;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A Release of Information request representing a formal request to disclose patient health information to an authorized requestor.")
model ROIRequest extends HealthcareBaseEntity {
  @doc("Reference to the patient whose records are being requested")
  patient: Reference;

  @doc("Name or organization name of the party requesting the records")
  requestor: string;

  @doc("Category of the requestor — used to determine applicable authorization requirements")
  requestorType: ROIRequestorType;

  @doc("Date and time the request was formally received")
  requestDate: utcDateTime;

  @doc("Purpose for which the information will be used — aligns with HIPAA permitted purposes")
  purpose: PurposeOfUse;

  @doc("List of record types or specific records being requested (e.g., 'radiology reports', 'operative notes')")
  recordsRequested: string[];

  @doc("Start of the date range for records being requested")
  dateRangeFrom?: utcDateTime;

  @doc("End of the date range for records being requested")
  dateRangeTo?: utcDateTime;

  @doc("Current workflow status of this ROI request")
  status: ROIStatus;

  @doc("Reference to the signed patient authorization (Consent resource) for this release, if required")
  authorization?: Reference;

  @doc("Reference to the HIM staff member assigned to process this request")
  assignedTo?: Reference;

  @doc("Target completion date for this request (e.g., regulatory deadline)")
  dueDate?: plainDate;

  @doc("Date and time records were released to the requestor")
  releasedDate?: utcDateTime;

  @doc("Reference to the staff member who completed the release")
  releasedBy?: Reference;

  @doc("Method used to deliver the released records")
  deliveryMethod?: DeliveryMethod;

  @doc("Fee charged for processing and releasing the records, if applicable")
  fee?: Money;

  @doc("Clinical or administrative notes associated with this request")
  note?: Annotation[];
}

@doc("A patient's formal request for access to or amendment of their medical records.")
model MedicalRecordRequest extends HealthcareBaseEntity {
  @doc("Reference to the patient whose records are the subject of this request")
  patient: Reference;

  @doc("Reference to a specific encounter, if the request is limited to one visit")
  encounter?: Reference;

  @doc("Reference to the individual who submitted this request (patient, guardian, or authorized representative)")
  requestedBy: Reference;

  @doc("Type of request being made")
  requestType: RecordRequestType;

  @doc("Specific records or record categories included in the scope of this request")
  records: string[];

  @doc("Current workflow status of this medical record request")
  status: RecordRequestStatus;

  @doc("Date and time the request was fulfilled or closed")
  completedDate?: utcDateTime;

  @doc("Clinical or administrative notes associated with this request")
  note?: Annotation[];
}

@doc("A clinical coding review record documenting the ICD-10/PCS codes and DRG assignment for an inpatient or outpatient encounter.")
model CodingReview extends HealthcareBaseEntity {
  @doc("Reference to the encounter being coded")
  encounter: Reference;

  @doc("Reference to the coder or CDI specialist performing this review")
  coder: Reference;

  @doc("Date and time this coding review was conducted or last updated")
  reviewDate: utcDateTime;

  @doc("Primary diagnosis code assigned (ICD-10-CM)")
  primaryDiagnosis: CodeableConcept;

  @doc("Secondary diagnosis codes (comorbidities, complications — ICD-10-CM)")
  secondaryDiagnoses?: CodeableConcept[];

  @doc("Procedure codes assigned (ICD-10-PCS or CPT)")
  procedures?: CodeableConcept[];

  @doc("Diagnosis-Related Group code assigned based on the coding")
  drgCode?: string;

  @doc("DRG relative weight factor — used to calculate expected reimbursement")
  drgWeight?: float64;

  @doc("Current workflow status of this coding review")
  status: CodingReviewStatus;

  @doc("CDI query sent to the attending provider requesting clarification on a diagnosis or procedure")
  cdiQuery?: string;

  @doc("Provider's response to the CDI query")
  queryResponse?: string;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for ROI requests.")
model ROIRequestSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by requestor type") @query requestorType?: ROIRequestorType;
  @doc("Filter by ROI status") @query status?: ROIStatus;
  @doc("Filter by assigned staff reference ID") @query assignedTo?: string;
  @doc("Filter by delivery method") @query deliveryMethod?: DeliveryMethod;
  @doc("Filter requests received at or after this date") @query requestedFrom?: utcDateTime;
  @doc("Filter requests received at or before this date") @query requestedTo?: utcDateTime;
  @doc("Filter by due date on or before this date") @query dueBy?: plainDate;
  ...OffsetPaginationParams;
}

@doc("Search parameters for medical record requests.")
model MedicalRecordRequestSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by request type") @query requestType?: RecordRequestType;
  @doc("Filter by request status") @query status?: RecordRequestStatus;
  @doc("Filter by submitting party reference ID") @query requestedBy?: string;
  ...OffsetPaginationParams;
}

@doc("Search parameters for coding reviews.")
model CodingReviewSearchParams {
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by coder reference ID") @query coder?: string;
  @doc("Filter by coding review status") @query status?: CodingReviewStatus;
  @doc("Filter by DRG code") @query drgCode?: string;
  @doc("Filter reviews conducted at or after this date") @query reviewedFrom?: utcDateTime;
  @doc("Filter reviews conducted at or before this date") @query reviewedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("ROI request management — full lifecycle of Release of Information requests including creation, assignment, release, and denial workflows.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
@route("/him/roi-requests")
interface ROIRequestManagement {
  @doc("Create a new Release of Information request.")
  @operationId("createROIRequest")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  createROIRequest(
    @body body: ROIRequest,
  ): {
    @statusCode statusCode: 201;
    @body result: ROIRequest;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an ROI request by its logical ID.")
  @operationId("getROIRequest")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @route("/{id}")
  getROIRequest(
    @path @doc("ROIRequest logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ROIRequest;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an ROI request — assignment, status, authorization, or fee.")
  @operationId("updateROIRequest")
  @extension("x-security-required-roles", #["admin", "biller"])
  @put
  @route("/{id}")
  updateROIRequest(
    @path @doc("ROIRequest logical ID") id: UUID,
    @body body: ROIRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: ROIRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an ROI request.")
  @operationId("deleteROIRequest")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteROIRequest(
    @path @doc("ROIRequest logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search ROI requests by patient, requestor type, status, delivery method, or date range.")
  @operationId("searchROIRequests")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @route("/search")
  searchROIRequests(
    ...ROIRequestSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ROIRequest>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Mark an ROI request as released — records the releasing staff member, delivery method, and release timestamp.")
  @operationId("releaseROIRequest")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @route("/{id}/release")
  releaseROIRequest(
    @path @doc("ROIRequest logical ID") id: UUID,
    @body body: ROIReleaseParams,
  ): {
    @statusCode statusCode: 200;
    @body result: ROIRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Deny an ROI request with a documented reason.")
  @operationId("denyROIRequest")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @route("/{id}/deny")
  denyROIRequest(
    @path @doc("ROIRequest logical ID") id: UUID,
    @body body: ROIDenyParams,
  ): {
    @statusCode statusCode: 200;
    @body result: ROIRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Medical record request management — patient access, amendment, restriction, and accounting of disclosure requests.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
@route("/him/medical-record-requests")
interface MedicalRecordRequestManagement {
  @doc("Create a new medical record request.")
  @operationId("createMedicalRecordRequest")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  createMedicalRecordRequest(
    @body body: MedicalRecordRequest,
  ): {
    @statusCode statusCode: 201;
    @body result: MedicalRecordRequest;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a medical record request by its logical ID.")
  @operationId("getMedicalRecordRequest")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @route("/{id}")
  getMedicalRecordRequest(
    @path @doc("MedicalRecordRequest logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: MedicalRecordRequest;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a medical record request — status, completion date, or notes.")
  @operationId("updateMedicalRecordRequest")
  @extension("x-security-required-roles", #["admin", "biller"])
  @put
  @route("/{id}")
  updateMedicalRecordRequest(
    @path @doc("MedicalRecordRequest logical ID") id: UUID,
    @body body: MedicalRecordRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: MedicalRecordRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a medical record request.")
  @operationId("deleteMedicalRecordRequest")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteMedicalRecordRequest(
    @path @doc("MedicalRecordRequest logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search medical record requests by patient, encounter, type, or status.")
  @operationId("searchMedicalRecordRequests")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @route("/search")
  searchMedicalRecordRequests(
    ...MedicalRecordRequestSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<MedicalRecordRequest>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Coding review management — ICD-10/PCS coding, DRG assignment, and clinical documentation improvement query tracking for inpatient and outpatient encounters.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
@route("/him/coding-reviews")
interface CodingReviewManagement {
  @doc("Create a new coding review for an encounter.")
  @operationId("createCodingReview")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  createCodingReview(
    @body body: CodingReview,
  ): {
    @statusCode statusCode: 201;
    @body result: CodingReview;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a coding review by its logical ID.")
  @operationId("getCodingReview")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @route("/{id}")
  getCodingReview(
    @path @doc("CodingReview logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CodingReview;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a coding review — codes, DRG assignment, query status, or review notes.")
  @operationId("updateCodingReview")
  @extension("x-security-required-roles", #["admin", "biller"])
  @put
  @route("/{id}")
  updateCodingReview(
    @path @doc("CodingReview logical ID") id: UUID,
    @body body: CodingReview,
  ): {
    @statusCode statusCode: 200;
    @body result: CodingReview;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a coding review.")
  @operationId("deleteCodingReview")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteCodingReview(
    @path @doc("CodingReview logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search coding reviews by encounter, coder, status, DRG code, or date range.")
  @operationId("searchCodingReviews")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @route("/search")
  searchCodingReviews(
    ...CodingReviewSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CodingReview>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Finalize a coding review — transitions status to finalized and locks codes for billing submission.")
  @operationId("finalizeCodingReview")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @route("/{id}/finalize")
  finalizeCodingReview(
    @path @doc("CodingReview logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CodingReview;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
