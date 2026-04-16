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
 * Medical Staff Peer Review module.
 *
 * Provides models and operations for managing confidential peer review cases,
 * peer review panel deliberations, and resulting actions or recommendations.
 * All records are protected under applicable peer review privilege statutes
 * and are accessible only to authorized quality and medical staff leadership.
 * Access is strictly limited to the admin role to enforce peer review
 * confidentiality requirements.
 */
namespace Healthcare.Operational.Hospital.PeerReview;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Clinical or quality category that triggered the peer review referral.")
enum PeerReviewCategory {
  @doc("Inpatient mortality case referred for review of care appropriateness")
  mortality,

  @doc("Adverse event or complication arising from a procedure or treatment")
  complication,

  @doc("Unplanned readmission within 30 days of discharge")
  readmission,

  @doc("Concern raised regarding clinical quality, documentation, or care delivery")
  qualityConcern,

  @doc("A sentinel event — an unexpected event involving death or serious physical or psychological harm")
  sentinel,

  @doc("Routine peer review selected randomly or by scheduled criteria (not event-driven)")
  routine,
}

@doc("Lifecycle status of a peer review case.")
enum PeerReviewStatus {
  @doc("The case has been referred and logged but review has not yet begun")
  referred,

  @doc("The case is actively under review by the assigned reviewer or committee")
  underReview,

  @doc("The case has been escalated to the peer review committee for panel deliberation")
  committeeReview,

  @doc("The committee has determined that corrective action is required")
  actionRequired,

  @doc("All required actions have been completed and the case is closed pending final sign-off")
  resolved,

  @doc("The case is fully closed — no further action required")
  closed,
}

@doc("Priority level assigned to a peer review case.")
enum PeerReviewPriority {
  @doc("Standard case — reviewed in the normal cycle")
  routine,

  @doc("Case involving significant patient safety concern — reviewed within days")
  urgent,

  @doc("Sentinel event or imminent safety threat — reviewed within 24 hours")
  immediate,
}

@doc("Type of action taken by the peer review committee as an outcome of the review.")
enum PeerReviewActionType {
  @doc("The practitioner is required to complete specified continuing education")
  educationRequired,

  @doc("The practitioner's performance will be monitored under direct or concurrent proctoring")
  proctoring,

  @doc("A restriction has been imposed on the practitioner's clinical privileges")
  restrictionImposed,

  @doc("Clinical privileges have been suspended pending investigation or further review")
  privilegeSuspended,

  @doc("Clinical privileges have been permanently revoked")
  privilegeRevoked,

  @doc("The review found no deviation from the standard of care — no action required")
  noActionRequired,

  @doc("The practitioner is commended for exemplary clinical performance")
  commendation,

  @doc("A system-level process improvement initiative is recommended based on findings")
  processImprovement,
}

@doc("Status of a peer review action item.")
enum ActionStatus {
  @doc("The action has been assigned but not yet started")
  pending,

  @doc("The action is currently being completed")
  inProgress,

  @doc("The action has been completed and verified")
  completed,

  @doc("The action's due date has passed without completion")
  overdue,
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A peer review case representing a clinical encounter or practitioner performance concern submitted for formal medical staff review.")
model PeerReviewCase extends HealthcareBaseEntity {
  @doc("Reference to the encounter under review — omitted for cases involving de-identified records")
  encounter?: Reference;

  @doc("Reference to the patient involved in the case — may be de-identified per peer review policy")
  patient?: Reference;

  @doc("Reference to the Practitioner or staff member who referred this case for review")
  referredBy: Reference;

  @doc("Date and time the case was formally referred for peer review")
  referralDate: utcDateTime;

  @doc("Clinical or quality category that prompted this referral")
  category: PeerReviewCategory;

  @doc("Current lifecycle status of this peer review case")
  status: PeerReviewStatus;

  @doc("Priority level of this case — determines review timeline")
  priority: PeerReviewPriority;

  @doc("Narrative description of the clinical concern, event, or reason for referral — maintained as confidential")
  description: string;

  @doc("Whether this record is flagged as confidential peer review information")
  isConfidential: boolean;

  @doc("Whether this case and its documentation are protected under applicable state or federal peer review privilege statutes")
  protectedUnderStatute?: boolean;

  @doc("Notes associated with this case — restricted to authorized quality personnel")
  note?: Annotation[];
}

@doc("A peer review panel record documenting the committee members, deliberation, findings, and recommendations for a peer review case.")
model PeerReviewPanel extends HealthcareBaseEntity {
  @doc("Reference to the PeerReviewCase being deliberated by this panel")
  peerReviewCase: Reference;

  @doc("References to Practitioner resources serving as panel members")
  panelMembers: Reference[];

  @doc("Reference to the Practitioner chairing the panel")
  chairperson: Reference;

  @doc("Date and time the panel meeting is scheduled to occur")
  scheduledDate?: utcDateTime;

  @doc("Date and time the panel meeting actually took place")
  meetingDate?: utcDateTime;

  @doc("Narrative summary of the panel's clinical findings")
  findings?: string;

  @doc("Ordered list of formal recommendations made by the panel")
  recommendations?: string[];

  @doc("Detailed action plan specifying corrective or improvement measures required")
  actionPlan?: string;

  @doc("Date and time the panel completed its vote or formal determination")
  votedDate?: utcDateTime;
}

@doc("A peer review action item — a specific corrective, educational, or improvement measure assigned as an outcome of peer review deliberation.")
model PeerReviewAction extends HealthcareBaseEntity {
  @doc("Reference to the PeerReviewCase that generated this action")
  peerReviewCase: Reference;

  @doc("Type of action determined by the peer review committee")
  actionType: PeerReviewActionType;

  @doc("Reference to the Practitioner or department assigned to carry out this action")
  assignedTo?: Reference;

  @doc("Date by which this action must be completed")
  dueDate?: plainDate;

  @doc("Date and time the action was completed and verified")
  completedDate?: utcDateTime;

  @doc("Current completion status of this action item")
  status: ActionStatus;

  @doc("Notes documenting the specifics of this action, completion evidence, or follow-up requirements")
  note?: string;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for peer review cases.")
model PeerReviewCaseSearchParams {
  @doc("Filter by referral category") @query category?: PeerReviewCategory;
  @doc("Filter by case status") @query status?: PeerReviewStatus;
  @doc("Filter by case priority") @query priority?: PeerReviewPriority;
  @doc("Filter by referring party reference ID") @query referredBy?: string;
  @doc("Filter by confidentiality flag") @query isConfidential?: boolean;
  @doc("Filter cases referred on or after this date") @query referredFrom?: utcDateTime;
  @doc("Filter cases referred on or before this date") @query referredTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for peer review panels.")
model PeerReviewPanelSearchParams {
  @doc("Filter by peer review case reference ID") @query peerReviewCase?: string;
  @doc("Filter by chairperson reference ID") @query chairperson?: string;
  @doc("Filter by panel meeting date on or after this date") @query meetingFrom?: utcDateTime;
  @doc("Filter by panel meeting date on or before this date") @query meetingTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for peer review actions.")
model PeerReviewActionSearchParams {
  @doc("Filter by peer review case reference ID") @query peerReviewCase?: string;
  @doc("Filter by action type") @query actionType?: PeerReviewActionType;
  @doc("Filter by assigned practitioner reference ID") @query assignedTo?: string;
  @doc("Filter by action status") @query status?: ActionStatus;
  @doc("Filter actions due on or before this date") @query dueBy?: plainDate;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Supporting request models
// ---------------------------------------------------------------------------

@doc("Request body for transitioning a peer review case to a new status.")
model PeerReviewStatusTransitionRequest {
  @doc("Target status for the peer review case")
  status: PeerReviewStatus;

  @doc("Reason or note documenting the basis for this status change")
  note?: string;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Peer review case management — highly restricted confidential case management for medical staff quality review. Access is limited to authorized quality administration staff only.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/peer-review/cases")
interface PeerReviewCaseManagement {
  @doc("Create a new peer review case referral.")
  @operationId("createPeerReviewCase")
  @extension("x-security-required-roles", #["admin"])
  @post
  createPeerReviewCase(
    @body body: PeerReviewCase,
  ): {
    @statusCode statusCode: 201;
    @body result: PeerReviewCase;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a peer review case by its logical ID.")
  @operationId("getPeerReviewCase")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getPeerReviewCase(
    @path @doc("PeerReviewCase logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: PeerReviewCase;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a peer review case — priority, description, confidentiality flag, or notes.")
  @operationId("updatePeerReviewCase")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updatePeerReviewCase(
    @path @doc("PeerReviewCase logical ID") id: UUID,
    @body body: PeerReviewCase,
  ): {
    @statusCode statusCode: 200;
    @body result: PeerReviewCase;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a peer review case.")
  @operationId("deletePeerReviewCase")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deletePeerReviewCase(
    @path @doc("PeerReviewCase logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search peer review cases by category, status, priority, referring party, or referral date range.")
  @operationId("searchPeerReviewCases")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchPeerReviewCases(
    ...PeerReviewCaseSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PeerReviewCase>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Transition a peer review case to a new status — e.g., from referred to underReview, or actionRequired to resolved.")
  @operationId("transitionPeerReviewCaseStatus")
  @extension("x-security-required-roles", #["admin"])
  @post
  @route("/{id}/status")
  transitionPeerReviewCaseStatus(
    @path @doc("PeerReviewCase logical ID") id: UUID,
    @body body: PeerReviewStatusTransitionRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: PeerReviewCase;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Peer review panel management — manage committee composition, schedule deliberations, and record findings and recommendations.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/peer-review/panels")
interface PeerReviewPanelManagement {
  @doc("Create a new peer review panel for a case.")
  @operationId("createPeerReviewPanel")
  @extension("x-security-required-roles", #["admin"])
  @post
  createPeerReviewPanel(
    @body body: PeerReviewPanel,
  ): {
    @statusCode statusCode: 201;
    @body result: PeerReviewPanel;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a peer review panel record by its logical ID.")
  @operationId("getPeerReviewPanel")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getPeerReviewPanel(
    @path @doc("PeerReviewPanel logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: PeerReviewPanel;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a peer review panel — members, meeting date, findings, recommendations, or action plan.")
  @operationId("updatePeerReviewPanel")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updatePeerReviewPanel(
    @path @doc("PeerReviewPanel logical ID") id: UUID,
    @body body: PeerReviewPanel,
  ): {
    @statusCode statusCode: 200;
    @body result: PeerReviewPanel;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a peer review panel record.")
  @operationId("deletePeerReviewPanel")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deletePeerReviewPanel(
    @path @doc("PeerReviewPanel logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search peer review panels by case, chairperson, or meeting date range.")
  @operationId("searchPeerReviewPanels")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchPeerReviewPanels(
    ...PeerReviewPanelSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PeerReviewPanel>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Peer review action management — track and manage corrective or improvement actions assigned as outcomes of peer review deliberation.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/peer-review/actions")
interface PeerReviewActionManagement {
  @doc("Create a new peer review action item.")
  @operationId("createPeerReviewAction")
  @extension("x-security-required-roles", #["admin"])
  @post
  createPeerReviewAction(
    @body body: PeerReviewAction,
  ): {
    @statusCode statusCode: 201;
    @body result: PeerReviewAction;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a peer review action by its logical ID.")
  @operationId("getPeerReviewAction")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getPeerReviewAction(
    @path @doc("PeerReviewAction logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: PeerReviewAction;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a peer review action — due date, completion date, status, or notes.")
  @operationId("updatePeerReviewAction")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updatePeerReviewAction(
    @path @doc("PeerReviewAction logical ID") id: UUID,
    @body body: PeerReviewAction,
  ): {
    @statusCode statusCode: 200;
    @body result: PeerReviewAction;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a peer review action.")
  @operationId("deletePeerReviewAction")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deletePeerReviewAction(
    @path @doc("PeerReviewAction logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search peer review actions by case, action type, assigned practitioner, status, or due date.")
  @operationId("searchPeerReviewActions")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchPeerReviewActions(
    ...PeerReviewActionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PeerReviewAction>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
