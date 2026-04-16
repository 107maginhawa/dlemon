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
 * Privacy Workflow module.
 *
 * Provides models and operations for managing HIPAA Privacy Rule workflows:
 * patient rights (amendment requests), accounting of disclosures, breach
 * assessment and notification under 45 CFR 164.400–414, and privacy complaint
 * investigation. All interfaces require privacy officer (admin) access.
 * Aligned with 45 CFR Parts 160 and 164, the HHS Breach Notification Rule,
 * and OCR enforcement guidance.
 */
namespace Healthcare.Compliance.PrivacyWorkflow;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Workflow status of a patient's request to amend their protected health information under 45 CFR 164.526.")
enum AmendmentStatus {
  @doc("The amendment request has been received and is awaiting initial review")
  received,

  @doc("A privacy officer is reviewing the request to determine whether amendment is appropriate")
  underReview,

  @doc("The amendment has been approved and the designated record set will be corrected")
  approved,

  @doc("The amendment has been denied; the organisation must provide a denial statement and inform the patient of their right to disagree")
  denied,

  @doc("The approved amendment has been applied to the record and the patient has been notified")
  completed,
}

@doc("Purpose of use for a disclosure of protected health information, used in accounting of disclosures and audit logging.")
enum PurposeOfUse {
  @doc("Treatment — disclosure for provision, coordination, or management of health care")
  treatment,

  @doc("Payment — disclosure for billing, reimbursement, or related activities")
  payment,

  @doc("Operations — disclosure for quality assessment, legal services, or other healthcare operations")
  operations,

  @doc("Public health — disclosure to a public health authority for disease surveillance or control")
  publicHealth,

  @doc("Research — disclosure for an IRB-approved research study")
  research,

  @doc("Legal — disclosure pursuant to a court order, subpoena, or law enforcement request")
  legal,

  @doc("Marketing — disclosure for marketing purposes (requires prior written authorisation)")
  marketing,

  @doc("Other — purpose not covered by the above categories")
  other,
}

@doc("Risk level of a breach as determined by the four-factor risk assessment under 45 CFR 164.402.")
enum BreachRiskLevel {
  @doc("Low risk — high probability that the PHI was not compromised; notification not required under the Safe Harbor exception")
  low,

  @doc("Medium risk — some probability of compromise; notification may be required depending on mitigation")
  medium,

  @doc("High risk — clear probability that PHI was compromised; notification is required")
  high,
}

@doc("Workflow status of a breach assessment.")
enum BreachAssessmentStatus {
  @doc("The four-factor risk assessment is actively being conducted")
  assessing,

  @doc("The assessment is complete and has determined that notification is required")
  notificationRequired,

  @doc("Notification letters or media notices are currently being sent")
  notifying,

  @doc("All required notifications have been sent and documented")
  notified,

  @doc("The breach assessment is closed; all required actions are complete")
  closed,

  @doc("The assessment determined that this incident does not meet the definition of a reportable breach")
  noBreachDetermined,
}

@doc("Type of breach notification required under 45 CFR 164.404–408.")
enum BreachNotificationType {
  @doc("Individual notification — written notice to each individual whose PHI was involved")
  individual,

  @doc("HHS Secretary notification — annual or immediate report to HHS depending on breach size")
  hhsSecretary,

  @doc("Media notification — required when breach affects more than 500 residents of a state or jurisdiction")
  media,

  @doc("State Attorney General notification — required in certain states in addition to HHS")
  stateAttorneyGeneral,
}

@doc("Method used to deliver a breach notification to affected individuals or authorities.")
enum BreachNotificationMethod {
  @doc("First-class letter mailed to the last known address of the individual")
  letter,

  @doc("Email notification, only if the individual has previously agreed to electronic notice")
  email,

  @doc("Substitute notice (e.g., website posting or media notice) when contact information is out of date")
  substitute,

  @doc("Media notification via prominent local media outlet")
  media,
}

@doc("Category of privacy complaint received.")
enum PrivacyComplaintCategory {
  @doc("Inappropriate access — PHI accessed without authorisation or beyond minimum necessary")
  inappropriateAccess,

  @doc("Inappropriate disclosure — PHI shared with unauthorised recipients")
  inappropriateDisclosure,

  @doc("Minimum necessary — more PHI used or disclosed than was necessary for the purpose")
  minimumNecessary,

  @doc("Safeguards — failure to implement adequate administrative, physical, or technical safeguards")
  safeguards,

  @doc("Rights denial — failure to honour a patient's rights (access, amendment, restriction)")
  rightsDenial,

  @doc("Retaliation — adverse action taken against a patient for filing a complaint or exercising rights")
  retaliation,

  @doc("Other privacy concern not captured by the above categories")
  other,
}

@doc("Status of a privacy complaint through the investigation and resolution lifecycle.")
enum PrivacyComplaintStatus {
  @doc("The complaint has been received and logged but not yet assigned for investigation")
  received,

  @doc("The complaint is actively being investigated by a privacy officer")
  investigating,

  @doc("The investigation found the complaint to be substantiated; corrective action is required")
  substantiated,

  @doc("The investigation found insufficient evidence to support the complaint")
  unsubstantiated,

  @doc("The complaint has been resolved and any corrective actions have been completed")
  resolved,

  @doc("The complaint has been referred to the HHS Office for Civil Rights for investigation")
  referredToOCR,
}

@doc("The type of complainant who filed a privacy complaint.")
enum ComplainantType {
  @doc("A patient or their legally authorised representative")
  patient,

  @doc("A current or former employee of the organisation")
  employee,

  @doc("An external party (e.g., another healthcare provider, business associate)")
  external,

  @doc("An anonymous complainant whose identity is unknown or protected")
  anonymous,
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A patient's formal request to amend their protected health information in the designated record set, processed under 45 CFR 164.526.")
model AmendmentRequest extends HealthcareBaseEntity {
  @doc("Reference to the Patient whose PHI is being requested to be amended")
  patient: Reference;

  @doc("Date and time the amendment request was received from the patient or their representative")
  requestDate: utcDateTime;

  @doc("Name or description of the patient or authorised representative submitting the request")
  requestedBy: string;

  @doc("Narrative description of what the patient believes is incorrect or incomplete in their record")
  description: string;

  @doc("The specific field, document, or section of the record that the patient is requesting to amend")
  fieldToAmend: string;

  @doc("The existing value or content in the record as it currently appears")
  currentValue?: string;

  @doc("The patient's proposed correction or addition to the record")
  proposedValue?: string;

  @doc("Current status of the amendment request in the review and processing workflow")
  status: AmendmentStatus;

  @doc("Reference to the Practitioner (privacy officer) who reviewed the request")
  reviewedBy?: Reference;

  @doc("Date and time the privacy officer completed their review")
  reviewedAt?: utcDateTime;

  @doc("Reason provided to the patient if the amendment request was denied")
  denialReason?: string;

  @doc("Date and time the amendment was applied to the record and the patient was notified")
  completedAt?: utcDateTime;

  @doc("Additional notes from the privacy officer regarding processing of this request")
  note?: string;
}

@doc("A record of a disclosure of protected health information that must be tracked for the accounting of disclosures under 45 CFR 164.528, excluding disclosures for treatment, payment, and operations.")
model AccountingOfDisclosures extends HealthcareBaseEntity {
  @doc("Reference to the Patient whose PHI was disclosed")
  patient: Reference;

  @doc("Date and time the disclosure occurred")
  disclosureDate: utcDateTime;

  @doc("Name or description of the recipient of the disclosed PHI")
  recipient: string;

  @doc("Name of the organisation or agency to which the disclosure was made")
  recipientOrganization?: string;

  @doc("Purpose for which the PHI was disclosed")
  purpose: PurposeOfUse;

  @doc("Description of the types of records or specific FHIR resource types that were disclosed")
  resourcesDisclosed: string[];

  @doc("Method by which the PHI was transmitted or provided to the recipient")
  method: DisclosureMethod;

  @doc("Reference to the Practitioner who authorised or made the disclosure")
  disclosedBy: Reference;

  @doc("Legal authority or basis for the disclosure (e.g., court order number, patient authorisation ID)")
  legalAuthority?: string;

  @doc("Additional documentation notes regarding the disclosure")
  note?: string;
}

@doc("Method by which PHI was disclosed to the recipient.")
enum DisclosureMethod {
  @doc("Electronic transmission (e.g., Direct Secure Messaging, API, secure email)")
  electronic,

  @doc("Facsimile transmission")
  fax,

  @doc("Physical mail")
  mail,

  @doc("In-person disclosure (e.g., verbal with records handed over)")
  inPerson,

  @doc("Verbal disclosure only, with no physical or electronic records transferred")
  verbal,
}

@doc("A HIPAA breach risk assessment conducted following the discovery of a potential breach of unsecured PHI, as required by 45 CFR 164.402.")
model BreachAssessment extends HealthcareBaseEntity {
  @doc("Reference to an IncidentReport that triggered this breach assessment, if applicable")
  incidentReport?: Reference;

  @doc("Date and time the potential breach was discovered by the organisation")
  discoveryDate: utcDateTime;

  @doc("Reference to the privacy officer who conducted the four-factor risk assessment")
  assessedBy: Reference;

  @doc("Whether the incident involved unsecured protected health information (PHI)")
  phiInvolved: boolean;

  @doc("Estimated number of individuals whose PHI may have been compromised")
  individualsAffected: int64;

  @doc("Categories of PHI data elements that were involved in the potential breach (e.g., 'SSN', 'diagnoses', 'financial')")
  dataElements: string[];

  @doc("Overall risk level determined by the four-factor risk assessment")
  riskLevel: BreachRiskLevel;

  @doc("Mitigating factors identified during the assessment that reduce the probability of harm (e.g., encryption, limited access)")
  mitigatingFactors?: string[];

  @doc("Whether the four-factor assessment determined that breach notification is required under 45 CFR 164.410")
  notificationRequired: boolean;

  @doc("The date by which notification must be completed (within 60 days of discovery for HHS; sooner for individual notification)")
  notificationDueDate?: plainDate;

  @doc("Current status of the breach assessment")
  status: BreachAssessmentStatus;
}

@doc("A record of a breach notification sent to an individual, HHS Secretary, media outlet, or state attorney general pursuant to 45 CFR 164.404–408.")
model BreachNotification extends HealthcareBaseEntity {
  @doc("Reference to the BreachAssessment that determined notification was required")
  breachAssessment: Reference;

  @doc("The type of recipient to whom this notification was sent")
  notificationType: BreachNotificationType;

  @doc("Date and time the notification was sent or transmitted")
  notifiedAt: utcDateTime;

  @doc("Reference to the Practitioner or staff member who sent the notification")
  notifiedBy: Reference;

  @doc("Method used to send the notification")
  method: BreachNotificationMethod;

  @doc("Number of recipients who received this notification batch (e.g., for individual mailings)")
  recipientCount?: int64;

  @doc("Summary of the content of the notification, including description of breach, types of PHI, steps taken, and contact information")
  contentSummary?: string;

  @doc("Reference to a DocumentReference containing proof of notification (e.g., certified mail receipt, HHS submission confirmation)")
  proofOfNotification?: Reference;
}

@doc("A formal privacy complaint received from a patient, employee, or external party alleging a violation of the HIPAA Privacy Rule or the organisation's privacy policies.")
model PrivacyComplaint extends HealthcareBaseEntity {
  @doc("Name or identifier of the person filing the complaint (may be 'Anonymous')")
  complainant: string;

  @doc("Type of entity or relationship of the complainant to the organisation")
  complainantType: ComplainantType;

  @doc("Date and time the complaint was received by the privacy office")
  receivedDate: utcDateTime;

  @doc("Narrative description of the alleged privacy violation as provided by the complainant")
  description: string;

  @doc("Category of privacy concern being raised")
  category: PrivacyComplaintCategory;

  @doc("Current status of the complaint investigation")
  status: PrivacyComplaintStatus;

  @doc("Reference to the Practitioner (privacy officer) assigned to investigate this complaint")
  assignedTo?: Reference;

  @doc("Description of the resolution reached, including any corrective actions taken")
  resolution?: string;

  @doc("Date the complaint was formally resolved or closed")
  resolvedDate?: utcDateTime;

  @doc("Name of the regulatory agency to which the complaint was referred (e.g., 'HHS OCR Region IV')")
  referralAgency?: string;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for amendment request queries.")
model AmendmentRequestSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by amendment status") @query status?: AmendmentStatus;
  @doc("Filter by reviewing privacy officer reference ID") @query reviewedBy?: string;
  @doc("Filter requests received on or after this date") @query receivedFrom?: utcDateTime;
  @doc("Filter requests received on or before this date") @query receivedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for accounting of disclosures queries.")
model AccountingOfDisclosuresSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by purpose of use") @query purpose?: PurposeOfUse;
  @doc("Filter by disclosing practitioner reference ID") @query disclosedBy?: string;
  @doc("Filter disclosures on or after this date") @query disclosedFrom?: utcDateTime;
  @doc("Filter disclosures on or before this date") @query disclosedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for breach assessment queries.")
model BreachAssessmentSearchParams {
  @doc("Filter by assessment status") @query status?: BreachAssessmentStatus;
  @doc("Filter by risk level") @query riskLevel?: BreachRiskLevel;
  @doc("Filter to only assessments requiring notification") @query notificationRequired?: boolean;
  @doc("Filter assessments discovered on or after this date") @query discoveredFrom?: utcDateTime;
  @doc("Filter assessments discovered on or before this date") @query discoveredTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for breach notification queries.")
model BreachNotificationSearchParams {
  @doc("Filter by breach assessment reference ID") @query breachAssessment?: string;
  @doc("Filter by notification type") @query notificationType?: BreachNotificationType;
  @doc("Filter notifications sent on or after this date") @query notifiedFrom?: utcDateTime;
  @doc("Filter notifications sent on or before this date") @query notifiedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for privacy complaint queries.")
model PrivacyComplaintSearchParams {
  @doc("Filter by complainant type") @query complainantType?: ComplainantType;
  @doc("Filter by complaint category") @query category?: PrivacyComplaintCategory;
  @doc("Filter by complaint status") @query status?: PrivacyComplaintStatus;
  @doc("Filter by assigned privacy officer reference ID") @query assignedTo?: string;
  @doc("Filter complaints received on or after this date") @query receivedFrom?: utcDateTime;
  @doc("Filter complaints received on or before this date") @query receivedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Amendment request management — receive, review, approve, and deny patient requests to amend their protected health information per 45 CFR 164.526.")
@tag("Healthcare:Compliance")
@useAuth(bearerAuth)
@route("/compliance/privacy/amendment-requests")
interface AmendmentRequestManagement {
  @doc("Create a new amendment request record when a patient submits a request to amend their PHI.")
  @operationId("createAmendmentRequest")
  @extension("x-security-required-roles", #["admin"])
  @post
  createAmendmentRequest(
    @body body: AmendmentRequest,
  ): {
    @statusCode statusCode: 201;
    @body result: AmendmentRequest;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an amendment request by its logical ID.")
  @operationId("getAmendmentRequest")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getAmendmentRequest(
    @path @doc("AmendmentRequest logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: AmendmentRequest;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an amendment request record.")
  @operationId("updateAmendmentRequest")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateAmendmentRequest(
    @path @doc("AmendmentRequest logical ID") id: UUID,
    @body body: AmendmentRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: AmendmentRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an amendment request record.")
  @operationId("deleteAmendmentRequest")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteAmendmentRequest(
    @path @doc("AmendmentRequest logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search amendment requests by patient, status, reviewer, or date range.")
  @operationId("searchAmendmentRequests")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchAmendmentRequests(
    ...AmendmentRequestSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<AmendmentRequest>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Approve an amendment request and trigger the record correction workflow.")
  @operationId("approveAmendmentRequest")
  @extension("x-security-required-roles", #["admin"])
  @post
  @route("/{id}/approve")
  approveAmendmentRequest(
    @path @doc("AmendmentRequest logical ID") id: UUID,
    @body body: { reviewedBy: Reference; note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: AmendmentRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Deny an amendment request with a written explanation of the reason for denial.")
  @operationId("denyAmendmentRequest")
  @extension("x-security-required-roles", #["admin"])
  @post
  @route("/{id}/deny")
  denyAmendmentRequest(
    @path @doc("AmendmentRequest logical ID") id: UUID,
    @body body: { reviewedBy: Reference; denialReason: string },
  ): {
    @statusCode statusCode: 200;
    @body result: AmendmentRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Accounting of disclosures management — create and search records of PHI disclosures that must be tracked for the patient's right to an accounting under 45 CFR 164.528. Records are immutable after creation.")
@tag("Healthcare:Compliance")
@useAuth(bearerAuth)
@route("/compliance/privacy/disclosures")
interface AccountingOfDisclosuresManagement {
  @doc("Record a new PHI disclosure that falls within the accounting requirement.")
  @operationId("createDisclosureRecord")
  @extension("x-security-required-roles", #["admin"])
  @post
  createDisclosureRecord(
    @body body: AccountingOfDisclosures,
  ): {
    @statusCode statusCode: 201;
    @body result: AccountingOfDisclosures;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a disclosure record by its logical ID.")
  @operationId("getDisclosureRecord")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getDisclosureRecord(
    @path @doc("AccountingOfDisclosures logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: AccountingOfDisclosures;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search disclosure records by patient, purpose, disclosing staff member, or date range.")
  @operationId("searchDisclosureRecords")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchDisclosureRecords(
    ...AccountingOfDisclosuresSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<AccountingOfDisclosures>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Breach assessment management — document and manage four-factor risk assessments following potential PHI breaches per 45 CFR 164.402.")
@tag("Healthcare:Compliance")
@useAuth(bearerAuth)
@route("/compliance/privacy/breach-assessments")
interface BreachAssessmentManagement {
  @doc("Create a new breach risk assessment record.")
  @operationId("createBreachAssessment")
  @extension("x-security-required-roles", #["admin"])
  @post
  createBreachAssessment(
    @body body: BreachAssessment,
  ): {
    @statusCode statusCode: 201;
    @body result: BreachAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a breach assessment by its logical ID.")
  @operationId("getBreachAssessment")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getBreachAssessment(
    @path @doc("BreachAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: BreachAssessment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a breach assessment record.")
  @operationId("updateBreachAssessment")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateBreachAssessment(
    @path @doc("BreachAssessment logical ID") id: UUID,
    @body body: BreachAssessment,
  ): {
    @statusCode statusCode: 200;
    @body result: BreachAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a breach assessment record.")
  @operationId("deleteBreachAssessment")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteBreachAssessment(
    @path @doc("BreachAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search breach assessments by status, risk level, notification requirement, or discovery date.")
  @operationId("searchBreachAssessments")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchBreachAssessments(
    ...BreachAssessmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<BreachAssessment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Breach notification management — document and track all breach notifications sent to individuals, HHS, media, and state attorneys general per 45 CFR 164.404–408.")
@tag("Healthcare:Compliance")
@useAuth(bearerAuth)
@route("/compliance/privacy/breach-notifications")
interface BreachNotificationManagement {
  @doc("Record a new breach notification.")
  @operationId("createBreachNotification")
  @extension("x-security-required-roles", #["admin"])
  @post
  createBreachNotification(
    @body body: BreachNotification,
  ): {
    @statusCode statusCode: 201;
    @body result: BreachNotification;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a breach notification by its logical ID.")
  @operationId("getBreachNotification")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getBreachNotification(
    @path @doc("BreachNotification logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: BreachNotification;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a breach notification record.")
  @operationId("updateBreachNotification")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateBreachNotification(
    @path @doc("BreachNotification logical ID") id: UUID,
    @body body: BreachNotification,
  ): {
    @statusCode statusCode: 200;
    @body result: BreachNotification;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a breach notification record.")
  @operationId("deleteBreachNotification")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteBreachNotification(
    @path @doc("BreachNotification logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search breach notifications by assessment, type, or send date.")
  @operationId("searchBreachNotifications")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchBreachNotifications(
    ...BreachNotificationSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<BreachNotification>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Privacy complaint management — receive, investigate, and resolve privacy complaints from patients, employees, and external parties, including referrals to HHS OCR.")
@tag("Healthcare:Compliance")
@useAuth(bearerAuth)
@route("/compliance/privacy/complaints")
interface PrivacyComplaintManagement {
  @doc("Create a new privacy complaint record.")
  @operationId("createPrivacyComplaint")
  @extension("x-security-required-roles", #["admin"])
  @post
  createPrivacyComplaint(
    @body body: PrivacyComplaint,
  ): {
    @statusCode statusCode: 201;
    @body result: PrivacyComplaint;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a privacy complaint by its logical ID.")
  @operationId("getPrivacyComplaint")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getPrivacyComplaint(
    @path @doc("PrivacyComplaint logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: PrivacyComplaint;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a privacy complaint record.")
  @operationId("updatePrivacyComplaint")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updatePrivacyComplaint(
    @path @doc("PrivacyComplaint logical ID") id: UUID,
    @body body: PrivacyComplaint,
  ): {
    @statusCode statusCode: 200;
    @body result: PrivacyComplaint;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a privacy complaint record.")
  @operationId("deletePrivacyComplaint")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deletePrivacyComplaint(
    @path @doc("PrivacyComplaint logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search privacy complaints by complainant type, category, status, or date range.")
  @operationId("searchPrivacyComplaints")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchPrivacyComplaints(
    ...PrivacyComplaintSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PrivacyComplaint>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Transition a privacy complaint to a new investigation or resolution status.")
  @operationId("transitionPrivacyComplaintStatus")
  @extension("x-security-required-roles", #["admin"])
  @post
  @route("/{id}/status")
  transitionPrivacyComplaintStatus(
    @path @doc("PrivacyComplaint logical ID") id: UUID,
    @body body: { status: PrivacyComplaintStatus; resolution?: string; note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: PrivacyComplaint;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
