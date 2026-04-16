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
 * Compliance Program module.
 *
 * Provides models and operations for managing the seven core elements of an
 * effective healthcare compliance programme: written policies and procedures,
 * business associate agreement tracking, corrective and preventive action (CAPA)
 * management, data retention schedules, and legal hold management.
 * Aligned with OIG Compliance Program Guidance, HIPAA Privacy and Security Rules,
 * and 45 CFR Parts 160 and 164.
 */
namespace Healthcare.Compliance.ComplianceProgram;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Category of compliance policy, aligned with major regulatory domains in healthcare.")
enum PolicyCategory {
  @doc("HIPAA general compliance — combines elements of both Privacy and Security Rules")
  hipaa,

  @doc("HIPAA Privacy Rule — policies governing the use and disclosure of protected health information")
  privacy,

  @doc("HIPAA Security Rule — administrative, physical, and technical safeguards for ePHI")
  security,

  @doc("Fraud, waste, and abuse — policies supporting compliance with the False Claims Act, Stark Law, and Anti-Kickback Statute")
  fraud,

  @doc("Clinical coding compliance — ICD-10, CPT, HCPCS coding accuracy and documentation requirements")
  coding,

  @doc("Clinical safety and quality — patient safety event reporting, sentinel event management")
  clinicalSafety,

  @doc("Infection prevention and control — HAI prevention, isolation protocols, hand hygiene")
  infectionControl,

  @doc("Occupational Safety and Health Administration (OSHA) — workplace safety, bloodborne pathogens")
  osha,

  @doc("Other compliance domain not captured by the above categories")
  other,
}

@doc("Publication and lifecycle status of a compliance policy.")
enum PolicyStatus {
  @doc("The policy is in draft and has not yet been reviewed or approved")
  draft,

  @doc("The policy has been approved by the designated authority but is not yet in effect")
  approved,

  @doc("The policy is currently in effect and staff are expected to follow it")
  active,

  @doc("The policy is undergoing a scheduled or triggered review cycle")
  underReview,

  @doc("The policy has been retired and replaced or superseded")
  retired,
}

@doc("Type of business associate or data processing agreement.")
enum BAAType {
  @doc("Business Associate Agreement — standard HIPAA BAA required under 45 CFR 164.308(b)")
  businessAssociateAgreement,

  @doc("Data Processing Agreement — GDPR-aligned agreement governing processor responsibilities")
  dataProcessingAgreement,

  @doc("Data Use Agreement — governing access to limited data sets as defined under HIPAA")
  dataUseAgreement,

  @doc("Subcontractor Agreement — BAA between a business associate and its subcontractors")
  subcontractorAgreement,
}

@doc("Status of a business associate agreement.")
enum BAAStatus {
  @doc("The agreement is currently in effect")
  active,

  @doc("The agreement has passed its expiration date without renewal")
  expired,

  @doc("The agreement has been formally terminated by either party")
  terminated,

  @doc("The agreement is being reviewed for renewal or amendment")
  underReview,
}

@doc("Workflow status of a Corrective and Preventive Action (CAPA) record.")
enum CAPAStatus {
  @doc("The CAPA has been opened and is awaiting assignment and initial investigation")
  open,

  @doc("A root cause investigation is actively in progress")
  investigating,

  @doc("Corrective or preventive actions have been defined and are being executed")
  actionInProgress,

  @doc("Actions have been completed and are awaiting verification of effectiveness")
  awaitingVerification,

  @doc("The CAPA has been fully resolved and closed after effectiveness verification")
  closed,

  @doc("The CAPA due date has passed without resolution")
  overdue,
}

@doc("Type of post-retention action applied to records when the retention period expires.")
enum RetentionAction {
  @doc("Records are moved to long-term archival storage in a read-only state")
  archive,

  @doc("Personally identifiable information is removed or generalised, preserving the record for research")
  anonymize,

  @doc("Records are securely and permanently destroyed in accordance with NIST SP 800-88")
  delete,
}

@doc("Status of a legal hold.")
enum LegalHoldStatus {
  @doc("The legal hold is active; covered records must not be modified or destroyed")
  active,

  @doc("The legal hold has been formally released; normal retention schedules resume")
  released,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A single action item within a CAPA record, assigned to a responsible party with its own due date and completion tracking.")
model CAPAAction {
  @doc("Narrative description of the specific action to be taken")
  description: string;

  @doc("Reference to the Practitioner or staff member responsible for completing this action")
  assignedTo?: Reference;

  @doc("Target completion date for this specific action")
  dueDate?: plainDate;

  @doc("Date the action was actually completed")
  completedDate?: plainDate;

  @doc("Current status of this individual action item")
  status: CAPAActionStatus;
}

@doc("Status of an individual CAPA action item.")
enum CAPAActionStatus {
  @doc("The action has been defined but work has not yet started")
  pending,

  @doc("Work on this action is currently in progress")
  inProgress,

  @doc("The action has been completed and submitted for verification")
  completed,

  @doc("The action has been independently verified as effective")
  verified,
}

@doc("Defines the scope of records covered by a legal hold — which resource types and selection criteria are affected.")
model LegalHoldScope {
  @doc("The FHIR resource type or system entity type to which the hold applies (e.g., 'Patient', 'Encounter', 'Claim')")
  resourceType: string;

  @doc("Structured filter criteria identifying the specific records covered (e.g., patient ID ranges, date ranges, facility codes)")
  criteria: Record<unknown>;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A compliance policy record representing a written policy or procedure that governs a regulatory or operational domain within the organisation.")
model CompliancePolicy extends HealthcareBaseEntity {
  @doc("Human-readable title of the policy or procedure")
  title: string;

  @doc("Organisation-assigned policy code or number (e.g., 'HIPAA-001', 'IC-015')")
  code?: string;

  @doc("Regulatory or operational category this policy addresses")
  category: PolicyCategory;

  @doc("Version identifier for this edition of the policy (e.g., '3.1', '2024-Q1')")
  policyVersion: string;

  @doc("Date on which this version of the policy becomes effective")
  effectiveDate: plainDate;

  @doc("Date this version was last formally reviewed")
  reviewDate?: plainDate;

  @doc("Date by which the next scheduled review must be completed")
  nextReviewDate?: plainDate;

  @doc("Current publication status of this policy")
  status: PolicyStatus;

  @doc("Reference to the Practitioner or Organisation that owns and is responsible for this policy")
  owner: Reference;

  @doc("Reference to the Practitioner or committee that formally approved this policy version")
  approvedBy?: Reference;

  @doc("Reference to the DocumentReference resource containing the full policy document")
  document?: Reference;

  @doc("Brief narrative description of the policy scope and purpose")
  description?: string;
}

@doc("A record of a staff member's attestation that they have read, understood, and agree to comply with a compliance policy.")
model PolicyAttestation extends HealthcareBaseEntity {
  @doc("Reference to the CompliancePolicy being attested to")
  policy: Reference;

  @doc("Reference to the Practitioner or staff member who completed the attestation")
  attestedBy: Reference;

  @doc("Date and time the attestation was completed")
  attestedAt: utcDateTime;

  @doc("Whether the staff member affirmatively acknowledged and agreed to comply with the policy")
  acknowledged: boolean;

  @doc("Reference to an electronic signature resource if a digital signature was captured")
  signature?: Reference;

  @doc("Date and time this attestation expires and must be renewed (e.g., annual re-attestation)")
  expiresAt?: utcDateTime;
}

@doc("A Business Associate Agreement (BAA) or equivalent data processing agreement record tracking a contractual relationship between the covered entity and a business associate.")
model BAARecord extends HealthcareBaseEntity {
  @doc("Reference to the Organisation (covered entity) that is party to this agreement")
  organization: Reference;

  @doc("Name of the business associate or vendor that is the counterparty to this agreement")
  businessAssociate: string;

  @doc("Type of agreement governing the data relationship")
  baaType: BAAType;

  @doc("Date the agreement was formally executed and signed by both parties")
  executedDate: plainDate;

  @doc("Date the agreement expires or must be renewed (absent for evergreen agreements)")
  expirationDate?: plainDate;

  @doc("Current status of this business associate agreement")
  status: BAAStatus;

  @doc("Reference to the DocumentReference containing the signed BAA document")
  documentReference?: Reference;

  @doc("Name of the primary contact at the business associate for compliance matters")
  contactName?: string;

  @doc("Email address of the primary compliance contact at the business associate")
  contactEmail?: string;

  @doc("Additional notes regarding the agreement, renewal terms, or outstanding issues")
  note?: string;
}

@doc("A Corrective and Preventive Action (CAPA) record managing the full lifecycle of identified compliance deficiencies from root cause analysis through to verified corrective action.")
model CAPARecord extends HealthcareBaseEntity {
  @doc("Brief descriptive title for this CAPA (e.g., 'Inadequate PHI access logging in radiology')")
  title: string;

  @doc("Whether this is a corrective action (addressing a current nonconformity) or preventive action (addressing a potential risk)")
  type: CAPAType;

  @doc("The type of source that triggered this CAPA")
  sourceType: CAPASourceType;

  @doc("Reference to the source record that triggered this CAPA (e.g., IncidentReport, audit finding)")
  source?: Reference;

  @doc("Detailed description of the problem, nonconformity, or risk being addressed")
  description: string;

  @doc("Root cause analysis narrative identifying the underlying systemic cause(s)")
  rootCause?: string;

  @doc("One or more corrective actions to address the identified root cause")
  correctiveActions: CAPAAction[];

  @doc("One or more preventive actions to reduce the risk of recurrence or similar issues")
  preventiveActions?: CAPAAction[];

  @doc("Current workflow status of this CAPA record")
  status: CAPAStatus;

  @doc("Reference to the Practitioner or staff member responsible for this CAPA")
  assignedTo: Reference;

  @doc("Target date by which all actions must be completed and verified")
  dueDate: plainDate;

  @doc("Date the CAPA was formally closed after effectiveness verification")
  closedDate?: plainDate;

  @doc("Reference to the Practitioner who closed and verified the CAPA")
  closedBy?: Reference;
}

@doc("Whether a CAPA is corrective (addressing a current issue) or preventive (addressing a potential future risk).")
enum CAPAType {
  @doc("Corrective action — addresses a confirmed nonconformity or compliance failure")
  corrective,

  @doc("Preventive action — proactively addresses a potential risk before a failure occurs")
  preventive,
}

@doc("The type of source that triggered a CAPA record.")
enum CAPASourceType {
  @doc("CAPA triggered by a patient safety incident report")
  incident,

  @doc("CAPA triggered by an internal or external compliance audit finding")
  audit,

  @doc("CAPA triggered by a patient or employee complaint")
  complaint,

  @doc("CAPA triggered by a regulatory survey finding or citation")
  regulatoryFinding,

  @doc("CAPA triggered by an internal management review or risk assessment")
  internalReview,
}

@doc("A data retention schedule defining how long a specific category of records must be retained, the legal basis for that retention, and the action to take when the retention period expires.")
model DataRetentionSchedule extends HealthcareBaseEntity {
  @doc("The FHIR resource type or system record type covered by this schedule (e.g., 'Patient', 'Encounter', 'Claim')")
  resourceType: string;

  @doc("Sub-category or record type description (e.g., 'Medical Records', 'Billing Records', 'HR Files')")
  category: string;

  @doc("Minimum retention period in months required by the applicable law or regulation")
  retentionPeriod: int32;

  @doc("The legal, regulatory, or contractual basis for this retention requirement (e.g., '45 CFR 164.530(j)', 'State law — 7 years')")
  legalBasis: string;

  @doc("Jurisdiction to which this retention requirement applies (e.g., 'Federal', 'California', 'New York')")
  jurisdiction?: string;

  @doc("Action to take when the retention period expires")
  afterAction: RetentionAction;

  @doc("Whether this retention schedule is currently active and enforced")
  active: boolean;
}

@doc("A legal hold record suspending normal data retention and destruction schedules for records within a defined scope, typically in anticipation of or during litigation or regulatory investigation.")
model LegalHold extends HealthcareBaseEntity {
  @doc("Human-readable name for this legal hold (e.g., 'Smith v. General Hospital — Discovery Hold')")
  name: string;

  @doc("Description of the legal matter, regulatory inquiry, or other reason the hold was initiated")
  reason: string;

  @doc("Current status of the legal hold")
  status: LegalHoldStatus;

  @doc("Reference to the Practitioner or staff member who created this legal hold")
  initiatedBy: Reference;

  @doc("Date and time the legal hold was created and became effective")
  createdAt: utcDateTime;

  @doc("Date and time the legal hold was formally released")
  releasedAt?: utcDateTime;

  @doc("Reference to the Practitioner who released the legal hold")
  releasedBy?: Reference;

  @doc("One or more scope definitions identifying which records are covered by this hold")
  scope: LegalHoldScope[];

  @doc("Additional notes from legal counsel or the compliance officer regarding the hold")
  note?: string;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for compliance policy queries.")
model CompliancePolicySearchParams {
  @doc("Filter by policy category") @query category?: PolicyCategory;
  @doc("Filter by policy status") @query status?: PolicyStatus;
  @doc("Filter by owner reference ID") @query owner?: string;
  @doc("Filter policies effective on or after this date") @query effectiveFrom?: plainDate;
  @doc("Free-text search on policy title") @query title?: string;
  ...OffsetPaginationParams;
}

@doc("Search parameters for policy attestation queries.")
model PolicyAttestationSearchParams {
  @doc("Filter by policy reference ID") @query policy?: string;
  @doc("Filter by attesting staff reference ID") @query attestedBy?: string;
  @doc("Filter attestations completed on or after this date") @query attestedFrom?: utcDateTime;
  @doc("Filter attestations expiring on or before this date") @query expiresBy?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for BAA record queries.")
model BAARecordSearchParams {
  @doc("Filter by organisation reference ID") @query organization?: string;
  @doc("Filter by business associate name (partial match)") @query businessAssociate?: string;
  @doc("Filter by agreement type") @query baaType?: BAAType;
  @doc("Filter by agreement status") @query status?: BAAStatus;
  @doc("Filter agreements expiring on or before this date") @query expiringBy?: plainDate;
  ...OffsetPaginationParams;
}

@doc("Search parameters for CAPA record queries.")
model CAPARecordSearchParams {
  @doc("Filter by CAPA type") @query type?: CAPAType;
  @doc("Filter by source type") @query sourceType?: CAPASourceType;
  @doc("Filter by CAPA status") @query status?: CAPAStatus;
  @doc("Filter by assigned-to reference ID") @query assignedTo?: string;
  @doc("Filter CAPAs due on or before this date") @query dueBy?: plainDate;
  ...OffsetPaginationParams;
}

@doc("Search parameters for legal hold queries.")
model LegalHoldSearchParams {
  @doc("Filter by hold status") @query status?: LegalHoldStatus;
  @doc("Filter by creator reference ID") @query createdBy?: string;
  @doc("Filter holds created on or after this date") @query createdFrom?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Compliance policy management — create, publish, review, and retire written compliance policies across all regulatory domains.")
@tag("Healthcare:Compliance")
@useAuth(bearerAuth)
@route("/compliance/policies")
interface CompliancePolicyManagement {
  @doc("Create a new compliance policy.")
  @operationId("createCompliancePolicy")
  @extension("x-security-required-roles", #["admin"])
  @post
  createCompliancePolicy(
    @body body: CompliancePolicy,
  ): {
    @statusCode statusCode: 201;
    @body result: CompliancePolicy;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a compliance policy by its logical ID.")
  @operationId("getCompliancePolicy")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getCompliancePolicy(
    @path @doc("CompliancePolicy logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CompliancePolicy;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a compliance policy.")
  @operationId("updateCompliancePolicy")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateCompliancePolicy(
    @path @doc("CompliancePolicy logical ID") id: UUID,
    @body body: CompliancePolicy,
  ): {
    @statusCode statusCode: 200;
    @body result: CompliancePolicy;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a compliance policy (only permitted for draft policies).")
  @operationId("deleteCompliancePolicy")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteCompliancePolicy(
    @path @doc("CompliancePolicy logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search compliance policies by category, status, owner, or effective date.")
  @operationId("searchCompliancePolicies")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchCompliancePolicies(
    ...CompliancePolicySearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CompliancePolicy>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Policy attestation management — track and verify that staff have acknowledged and agreed to comply with all applicable compliance policies.")
@tag("Healthcare:Compliance")
@useAuth(bearerAuth)
@route("/compliance/attestations")
interface PolicyAttestationManagement {
  @doc("Record a new policy attestation.")
  @operationId("createPolicyAttestation")
  @extension("x-security-required-roles", #["admin"])
  @post
  createPolicyAttestation(
    @body body: PolicyAttestation,
  ): {
    @statusCode statusCode: 201;
    @body result: PolicyAttestation;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a policy attestation by its logical ID.")
  @operationId("getPolicyAttestation")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getPolicyAttestation(
    @path @doc("PolicyAttestation logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: PolicyAttestation;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a policy attestation record.")
  @operationId("updatePolicyAttestation")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updatePolicyAttestation(
    @path @doc("PolicyAttestation logical ID") id: UUID,
    @body body: PolicyAttestation,
  ): {
    @statusCode statusCode: 200;
    @body result: PolicyAttestation;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a policy attestation record.")
  @operationId("deletePolicyAttestation")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deletePolicyAttestation(
    @path @doc("PolicyAttestation logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search policy attestations by policy, attesting staff member, or date range.")
  @operationId("searchPolicyAttestations")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchPolicyAttestations(
    ...PolicyAttestationSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PolicyAttestation>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("BAA record management — track all business associate agreements and data processing agreements to ensure HIPAA compliance and timely renewal.")
@tag("Healthcare:Compliance")
@useAuth(bearerAuth)
@route("/compliance/baa-records")
interface BAARecordManagement {
  @doc("Create a new BAA or data processing agreement record.")
  @operationId("createBAARecord")
  @extension("x-security-required-roles", #["admin"])
  @post
  createBAARecord(
    @body body: BAARecord,
  ): {
    @statusCode statusCode: 201;
    @body result: BAARecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a BAA record by its logical ID.")
  @operationId("getBAARecord")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getBAARecord(
    @path @doc("BAARecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: BAARecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a BAA record.")
  @operationId("updateBAARecord")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateBAARecord(
    @path @doc("BAARecord logical ID") id: UUID,
    @body body: BAARecord,
  ): {
    @statusCode statusCode: 200;
    @body result: BAARecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a BAA record.")
  @operationId("deleteBAARecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteBAARecord(
    @path @doc("BAARecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search BAA records by organisation, business associate, type, status, or expiration date.")
  @operationId("searchBAARecords")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchBAARecords(
    ...BAARecordSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<BAARecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CAPA record management — manage the full lifecycle of corrective and preventive actions from root cause identification through to effectiveness verification.")
@tag("Healthcare:Compliance")
@useAuth(bearerAuth)
@route("/compliance/capa-records")
interface CAPARecordManagement {
  @doc("Open a new CAPA record.")
  @operationId("createCAPARecord")
  @extension("x-security-required-roles", #["admin"])
  @post
  createCAPARecord(
    @body body: CAPARecord,
  ): {
    @statusCode statusCode: 201;
    @body result: CAPARecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a CAPA record by its logical ID.")
  @operationId("getCAPARecord")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getCAPARecord(
    @path @doc("CAPARecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CAPARecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a CAPA record with investigation findings, action progress, or closure details.")
  @operationId("updateCAPARecord")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateCAPARecord(
    @path @doc("CAPARecord logical ID") id: UUID,
    @body body: CAPARecord,
  ): {
    @statusCode statusCode: 200;
    @body result: CAPARecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a CAPA record (only permitted for open CAPAs with no actions in progress).")
  @operationId("deleteCAPARecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteCAPARecord(
    @path @doc("CAPARecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search CAPA records by type, source, status, assignee, or due date.")
  @operationId("searchCAPARecords")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchCAPARecords(
    ...CAPARecordSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CAPARecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Transition a CAPA to a new workflow status.")
  @operationId("transitionCAPAStatus")
  @extension("x-security-required-roles", #["admin"])
  @post
  @route("/{id}/status")
  transitionCAPAStatus(
    @path @doc("CAPARecord logical ID") id: UUID,
    @body body: { status: CAPAStatus; note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: CAPARecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Data retention schedule management — define and maintain the organisation's records retention programme in accordance with federal and state law.")
@tag("Healthcare:Compliance")
@useAuth(bearerAuth)
@route("/compliance/retention-schedules")
interface DataRetentionManagement {
  @doc("Create a new data retention schedule entry.")
  @operationId("createRetentionSchedule")
  @extension("x-security-required-roles", #["admin"])
  @post
  createRetentionSchedule(
    @body body: DataRetentionSchedule,
  ): {
    @statusCode statusCode: 201;
    @body result: DataRetentionSchedule;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a retention schedule by its logical ID.")
  @operationId("getRetentionSchedule")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getRetentionSchedule(
    @path @doc("DataRetentionSchedule logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: DataRetentionSchedule;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a retention schedule entry.")
  @operationId("updateRetentionSchedule")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateRetentionSchedule(
    @path @doc("DataRetentionSchedule logical ID") id: UUID,
    @body body: DataRetentionSchedule,
  ): {
    @statusCode statusCode: 200;
    @body result: DataRetentionSchedule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a retention schedule entry.")
  @operationId("deleteRetentionSchedule")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteRetentionSchedule(
    @path @doc("DataRetentionSchedule logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search retention schedules by resource type, category, jurisdiction, or active status.")
  @operationId("searchRetentionSchedules")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchRetentionSchedules(
    @doc("Filter by resource type") @query resourceType?: string,
    @doc("Filter by category") @query category?: string,
    @doc("Filter by jurisdiction") @query jurisdiction?: string,
    @doc("Filter by active status") @query active?: boolean,
    ...OffsetPaginationParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<DataRetentionSchedule>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Legal hold management — create, manage, and release legal holds that suspend normal data retention and destruction activities for records covered by litigation or regulatory proceedings.")
@tag("Healthcare:Compliance")
@useAuth(bearerAuth)
@route("/compliance/legal-holds")
interface LegalHoldManagement {
  @doc("Create a new legal hold.")
  @operationId("createLegalHold")
  @extension("x-security-required-roles", #["admin"])
  @post
  createLegalHold(
    @body body: LegalHold,
  ): {
    @statusCode statusCode: 201;
    @body result: LegalHold;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a legal hold by its logical ID.")
  @operationId("getLegalHold")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getLegalHold(
    @path @doc("LegalHold logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: LegalHold;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a legal hold record (e.g., to add scope entries or update notes).")
  @operationId("updateLegalHold")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateLegalHold(
    @path @doc("LegalHold logical ID") id: UUID,
    @body body: LegalHold,
  ): {
    @statusCode statusCode: 200;
    @body result: LegalHold;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a legal hold record (only permitted for holds in 'released' status).")
  @operationId("deleteLegalHold")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteLegalHold(
    @path @doc("LegalHold logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search legal holds by status, creator, or creation date.")
  @operationId("searchLegalHolds")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchLegalHolds(
    ...LegalHoldSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<LegalHold>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Release an active legal hold, restoring normal data retention and destruction schedules for covered records.")
  @operationId("releaseLegalHold")
  @extension("x-security-required-roles", #["admin"])
  @post
  @route("/{id}/release")
  releaseLegalHold(
    @path @doc("LegalHold logical ID") id: UUID,
    @body body: { releasedBy: Reference; note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: LegalHold;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
