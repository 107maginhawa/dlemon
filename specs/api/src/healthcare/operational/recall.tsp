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
 * Healthcare Operational Recall — patient recall rule management, schedule tracking,
 * contact attempt recording, and campaign management for preventive and follow-up care
 * recall programmes.
 */
namespace Healthcare.Operational.Recall;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The urgency priority of a recall rule.")
enum RecallPriority {
  @doc("Routine recall — the patient should be contacted within the standard interval")
  routine,

  @doc("Urgent recall — the patient requires expedited follow-up")
  urgent,
}

@doc("The current status of a patient recall schedule entry.")
enum RecallStatus {
  @doc("The recall has been scheduled and the patient has not yet been contacted")
  scheduled,

  @doc("The patient has been contacted and is being followed up")
  contacted,

  @doc("The patient has booked an appointment in response to the recall")
  booked,

  @doc("The recall has been fulfilled (appointment attended or care delivered)")
  completed,

  @doc("The recall has been dismissed as no longer applicable")
  dismissed,

  @doc("The recall due date has passed without the patient responding")
  overdue,

  @doc("Multiple contact attempts have been made without a response")
  unresponsive,
}

@doc("The lifecycle status of a recall campaign.")
enum CampaignStatus {
  @doc("The campaign is in draft and has not yet launched")
  draft,

  @doc("The campaign is active and patients are being contacted")
  active,

  @doc("The campaign has been temporarily paused")
  paused,

  @doc("The campaign has concluded")
  completed,
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A recall rule defining the criteria and interval for a recurring patient recall programme.")
model RecallRule extends HealthcareBaseEntity {
  @doc("A human-readable name for this recall rule")
  @maxLength(200)
  name: string;

  @doc("The procedure or service code that triggers this recall (e.g., dental cleaning, mammogram)")
  procedureCode?: CodeableConcept;

  @doc("The interval in months between recalls")
  intervalMonths: int32;

  @doc("The urgency priority of this recall")
  priority: RecallPriority;

  @doc("A description of the clinical rationale for this recall")
  @maxLength(500)
  description?: string;

  @doc("Whether this rule is currently active and generating recall schedules")
  active: boolean;
}

@doc("A recall schedule entry tracking the recall status and contact history for a specific patient.")
model RecallSchedule extends HealthcareBaseEntity {
  @doc("The patient who is due for recall")
  patient: Reference;

  @doc("The recall rule that generated this schedule entry, if applicable")
  rule?: Reference;

  @doc("The date by which the patient should be seen or contacted")
  dueDate: plainDate;

  @doc("The current status of this recall")
  status: RecallStatus;

  @doc("The date and time of the most recent contact attempt")
  lastContactDate?: utcDateTime;

  @doc("The total number of contact attempts made for this recall")
  contactAttempts: int32;

  @doc("The appointment that was booked as a result of this recall")
  bookedAppointment?: Reference;

  @doc("Additional notes about this recall entry")
  @maxLength(500)
  note?: string;
}

@doc("A targeted recall campaign contacting a cohort of patients matching defined criteria.")
model RecallCampaign extends HealthcareBaseEntity {
  @doc("A human-readable name for this recall campaign")
  @maxLength(200)
  name: string;

  @doc("The filter criteria used to identify the target patient cohort")
  targetCriteria: Record<unknown>;

  @doc("The date on which the campaign begins")
  startDate: plainDate;

  @doc("The date on which the campaign ends, if applicable")
  endDate?: plainDate;

  @doc("The current lifecycle status of the campaign")
  status: CampaignStatus;

  @doc("The total number of patients identified as targets for this campaign")
  patientsTargeted: int32;

  @doc("The number of patients who have been contacted so far")
  patientsContacted?: int32;

  @doc("The number of patients who have booked an appointment as a result of the campaign")
  patientsBooked?: int32;
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

@doc("Request body for recording a contact attempt against a recall schedule entry.")
model RecallContactRequest {
  @doc("The date and time the contact attempt was made")
  contactDate: utcDateTime;

  @doc("Notes about the contact attempt (e.g., left voicemail, no answer, spoke with patient)")
  @maxLength(500)
  note?: string;
}

@doc("Request body for dismissing a recall schedule entry.")
model RecallDismissRequest {
  @doc("The reason the recall is being dismissed")
  @maxLength(500)
  reason: string;
}

@doc("Request body for running a recall campaign against its target criteria.")
model CampaignRunRequest {
  @doc("Whether to send outreach immediately upon running, or only generate schedule entries")
  sendOutreach?: boolean;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for RecallSchedule resources.")
model RecallScheduleSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by recall rule reference id")
  @query rule?: string;

  @doc("Filter by recall status")
  @query status?: RecallStatus;

  @doc("Filter by priority via associated rule")
  @query priority?: RecallPriority;

  @doc("Filter recalls due on or after this date")
  @query dueFrom?: plainDate;

  @doc("Filter recalls due on or before this date")
  @query dueTo?: plainDate;

  @doc("Filter by minimum number of contact attempts")
  @query minContactAttempts?: int32;

  ...PaginationQuery;
}

@doc("Search parameters for RecallCampaign resources.")
model RecallCampaignSearchParams {
  @doc("Filter by campaign status")
  @query status?: CampaignStatus;

  @doc("Filter by name keyword")
  @query name?: string;

  @doc("Filter campaigns starting on or after this date")
  @query startFrom?: plainDate;

  @doc("Filter campaigns starting on or before this date")
  @query startTo?: plainDate;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD operations for RecallRule resources.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
interface RecallRuleManagement {
  @doc("Create a new RecallRule.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @post
  @operationId("createRecallRule")
  create(
    @body body: RecallRule,
  ): {
    @statusCode statusCode: 201;
    @body recallRule: RecallRule;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single RecallRule by id.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @get
  @operationId("getRecallRule")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body recallRule: RecallRule;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing RecallRule.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @put
  @operationId("updateRecallRule")
  @route("/{id}")
  update(
    @path id: string,
    @body body: RecallRule,
  ): {
    @statusCode statusCode: 200;
    @body recallRule: RecallRule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a RecallRule (e.g., activate or deactivate).")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @patch
  @operationId("patchRecallRule")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body recallRule: RecallRule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a RecallRule by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteRecallRule")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD, search, contact, and dismiss operations for RecallSchedule resources.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
interface RecallScheduleManagement {
  @doc("Create a new RecallSchedule entry.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @post
  @operationId("createRecallSchedule")
  create(
    @body body: RecallSchedule,
  ): {
    @statusCode statusCode: 201;
    @body recallSchedule: RecallSchedule;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single RecallSchedule entry by id.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @get
  @operationId("getRecallSchedule")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body recallSchedule: RecallSchedule;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing RecallSchedule entry.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @put
  @operationId("updateRecallSchedule")
  @route("/{id}")
  update(
    @path id: string,
    @body body: RecallSchedule,
  ): {
    @statusCode statusCode: 200;
    @body recallSchedule: RecallSchedule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a RecallSchedule entry by id.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @delete
  @operationId("deleteRecallSchedule")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for RecallSchedule entries using filter parameters.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @get
  @operationId("searchRecallSchedules")
  @route("/search")
  search(
    ...RecallScheduleSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<RecallSchedule>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Record a contact attempt for a recall schedule entry, incrementing the attempt counter.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @post
  @operationId("recordRecallContact")
  @route("/{id}/contact")
  contact(
    @path id: string,
    @body body: RecallContactRequest,
  ): {
    @statusCode statusCode: 200;
    @body recallSchedule: RecallSchedule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Dismiss a recall schedule entry, marking it as no longer applicable.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @post
  @operationId("dismissRecall")
  @route("/{id}/dismiss")
  dismiss(
    @path id: string,
    @body body: RecallDismissRequest,
  ): {
    @statusCode statusCode: 200;
    @body recallSchedule: RecallSchedule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD, run, and report operations for RecallCampaign resources.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
interface RecallCampaignManagement {
  @doc("Create a new RecallCampaign.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @post
  @operationId("createRecallCampaign")
  create(
    @body body: RecallCampaign,
  ): {
    @statusCode statusCode: 201;
    @body recallCampaign: RecallCampaign;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single RecallCampaign by id.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @get
  @operationId("getRecallCampaign")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body recallCampaign: RecallCampaign;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing RecallCampaign.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @put
  @operationId("updateRecallCampaign")
  @route("/{id}")
  update(
    @path id: string,
    @body body: RecallCampaign,
  ): {
    @statusCode statusCode: 200;
    @body recallCampaign: RecallCampaign;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a RecallCampaign by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteRecallCampaign")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for RecallCampaign resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @get
  @operationId("searchRecallCampaigns")
  @route("/search")
  search(
    ...RecallCampaignSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<RecallCampaign>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Execute a recall campaign against its target criteria, creating recall schedule entries and optionally triggering outreach.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @post
  @operationId("runRecallCampaign")
  @route("/{id}/run")
  run(
    @path id: string,
    @body body: CampaignRunRequest,
  ): {
    @statusCode statusCode: 200;
    @body recallCampaign: RecallCampaign;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an engagement report for a recall campaign including contact and booking rates.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @get
  @operationId("getRecallCampaignReport")
  @route("/{id}/report")
  getReport(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body report: RecallCampaign;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
