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
 * Environmental Services (EVS) module.
 *
 * Provides models and operations for managing hospital housekeeping and
 * environmental hygiene: cleaning task dispatch and verification, recurring
 * location cleaning schedules, and operational metrics reporting. Supports
 * infection prevention workflows including isolation room terminal cleans.
 */
namespace Healthcare.Operational.Hospital.EVS;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Type of cleaning activity required for a location.")
enum CleaningType {
  @doc("Discharge clean performed after a patient leaves to prepare the room for a new admission")
  discharge,

  @doc("Routine daily cleaning of an occupied patient room")
  daily,

  @doc("Thorough terminal clean performed after a patient with a communicable disease vacates")
  terminal,

  @doc("Enhanced isolation clean for rooms with active contact, droplet, or airborne precautions")
  isolation,

  @doc("Immediate unscheduled cleaning required due to a spill or unexpected soiling")
  stat,
}

@doc("Priority level assigned to a cleaning task, governing response time targets.")
enum CleaningPriority {
  @doc("Standard priority — completion expected within the normal scheduling window")
  routine,

  @doc("Elevated priority — completion expected within 30 minutes")
  urgent,

  @doc("Highest priority — immediate response required within 15 minutes")
  stat,
}

@doc("Lifecycle status of a cleaning task.")
enum CleaningTaskStatus {
  @doc("The task has been created but not yet assigned to a staff member")
  pending,

  @doc("The task has been assigned to a staff member")
  assigned,

  @doc("The assigned staff member has begun work")
  inProgress,

  @doc("The staff member has marked the task complete")
  completed,

  @doc("The task has been independently verified by a supervisor or quality officer")
  verified,
}

@doc("Frequency at which a cleaning schedule repeats.")
enum CleaningFrequency {
  @doc("Cleaned once per day")
  daily,

  @doc("Cleaned twice per day (typically morning and evening)")
  twiceDaily,

  @doc("Cleaned after each patient leaves the location (e.g., procedure rooms, dialysis chairs)")
  afterEachPatient,

  @doc("Cleaned once per week")
  weekly,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("Aggregate EVS performance metrics for a reporting period.")
model EVSMetrics {
  @doc("The reporting period start and end times")
  period: Period;

  @doc("Average elapsed time in minutes from task creation to task assignment")
  avgResponseMinutes: float32;

  @doc("Average elapsed time in minutes from task assignment to completion")
  avgCompletionMinutes: float32;

  @doc("Total number of cleaning tasks completed in this period")
  tasksCompleted: int32;

  @doc("Total number of cleaning tasks still pending at the end of the period")
  tasksPending: int32;

  @doc("Cleaning compliance rate as a percentage (0–100) based on completed vs scheduled tasks")
  complianceRate: float32;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A discrete cleaning task for a specific hospital location, generated on demand or from a schedule.")
model CleaningTask extends HealthcareBaseEntity {
  @doc("Reference to the Location resource that requires cleaning")
  location: Reference;

  @doc("Type of cleaning required")
  type: CleaningType;

  @doc("Priority level that determines response time expectations")
  priority: CleaningPriority;

  @doc("Current lifecycle status of this cleaning task")
  status: CleaningTaskStatus;

  @doc("Reference to the staff member (Practitioner or RelatedPerson) assigned to perform the clean")
  assignedTo?: Reference;

  @doc("Date and time the cleaning task was requested or generated")
  requestedAt: utcDateTime;

  @doc("Date and time the assigned staff member began cleaning")
  startedAt?: utcDateTime;

  @doc("Date and time the staff member marked the clean as complete")
  completedAt?: utcDateTime;

  @doc("Date and time a supervisor verified the quality of the completed clean")
  verifiedAt?: utcDateTime;

  @doc("Reference to the Practitioner or supervisor who performed the quality verification")
  verifiedBy?: Reference;

  @doc("Active isolation precautions in effect for this location that affect cleaning procedures (e.g., 'Contact — C.diff', 'Airborne — TB')")
  isolationPrecautions?: string;

  @doc("Cleaning products and disinfectants required or used for this task (product codes or names)")
  products?: string[];

  @doc("Additional notes or special instructions for the cleaning staff")
  note?: string;
}

@doc("A recurring cleaning schedule defining the frequency and timing of routine cleaning for a hospital location.")
model CleaningSchedule extends HealthcareBaseEntity {
  @doc("Reference to the Location resource this schedule applies to")
  location: Reference;

  @doc("How often this location should be cleaned")
  frequency: CleaningFrequency;

  @doc("Days of the week on which scheduled cleans should occur (e.g., ['Monday', 'Wednesday', 'Friday']). Applicable when frequency is 'weekly'.")
  dayOfWeek?: string[];

  @doc("Preferred time of day for the scheduled clean (e.g., '07:30', '14:00') in 24-hour format")
  time?: string;

  @doc("Type of cleaning to be performed on this schedule")
  type: CleaningType;

  @doc("Whether this schedule is currently active and generating tasks")
  active: boolean;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for cleaning tasks.")
model CleaningTaskSearchParams {
  @doc("Filter by location reference ID") @query location?: string;
  @doc("Filter by cleaning type") @query type?: CleaningType;
  @doc("Filter by priority level") @query priority?: CleaningPriority;
  @doc("Filter by task status") @query status?: CleaningTaskStatus;
  @doc("Filter by assigned staff reference ID") @query assignedTo?: string;
  @doc("Filter tasks requested at or after this date-time") @query requestedFrom?: utcDateTime;
  @doc("Filter tasks requested at or before this date-time") @query requestedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for cleaning schedules.")
model CleaningScheduleSearchParams {
  @doc("Filter by location reference ID") @query location?: string;
  @doc("Filter by cleaning frequency") @query frequency?: CleaningFrequency;
  @doc("Filter by active state") @query active?: boolean;
  ...OffsetPaginationParams;
}

@doc("Parameters for the EVS metrics report query.")
model EVSMetricsParams {
  @doc("Start of the reporting period") @query periodStart: utcDateTime;
  @doc("End of the reporting period") @query periodEnd: utcDateTime;
  @doc("Optionally filter metrics to a specific location reference ID") @query location?: string;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Cleaning task management — dispatch, assign, complete, and verify individual cleaning tasks across the facility.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/evs/cleaning-tasks")
interface CleaningTaskManagement {
  @doc("Create a new cleaning task for a location.")
  @operationId("createCleaningTask")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createCleaningTask(
    @body body: CleaningTask,
  ): {
    @statusCode statusCode: 201;
    @body result: CleaningTask;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a cleaning task by its logical ID.")
  @operationId("getCleaningTask")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getCleaningTask(
    @path @doc("CleaningTask logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CleaningTask;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a cleaning task.")
  @operationId("updateCleaningTask")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateCleaningTask(
    @path @doc("CleaningTask logical ID") id: UUID,
    @body body: CleaningTask,
  ): {
    @statusCode statusCode: 200;
    @body result: CleaningTask;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a cleaning task.")
  @operationId("deleteCleaningTask")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteCleaningTask(
    @path @doc("CleaningTask logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search cleaning tasks by location, type, priority, status, assignee, or date range.")
  @operationId("searchCleaningTasks")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchCleaningTasks(
    ...CleaningTaskSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CleaningTask>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Assign a pending or unassigned cleaning task to a staff member.")
  @operationId("assignCleaningTask")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/assign")
  assignCleaningTask(
    @path @doc("CleaningTask logical ID") id: UUID,
    @body body: { assignedTo: string },
  ): {
    @statusCode statusCode: 200;
    @body result: CleaningTask;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Mark a cleaning task as complete.")
  @operationId("completeCleaningTask")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/complete")
  completeCleaningTask(
    @path @doc("CleaningTask logical ID") id: UUID,
    @body body: { completedAt: utcDateTime; note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: CleaningTask;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Verify that a completed cleaning task meets quality standards.")
  @operationId("verifyCleaningTask")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/verify")
  verifyCleaningTask(
    @path @doc("CleaningTask logical ID") id: UUID,
    @body body: { verifiedBy: string; verifiedAt: utcDateTime; note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: CleaningTask;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Cleaning schedule management — create and manage recurring automated cleaning schedules for hospital locations.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/evs/cleaning-schedules")
interface CleaningScheduleManagement {
  @doc("Create a new recurring cleaning schedule for a location.")
  @operationId("createCleaningSchedule")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createCleaningSchedule(
    @body body: CleaningSchedule,
  ): {
    @statusCode statusCode: 201;
    @body result: CleaningSchedule;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a cleaning schedule by its logical ID.")
  @operationId("getCleaningSchedule")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getCleaningSchedule(
    @path @doc("CleaningSchedule logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CleaningSchedule;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a cleaning schedule.")
  @operationId("updateCleaningSchedule")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateCleaningSchedule(
    @path @doc("CleaningSchedule logical ID") id: UUID,
    @body body: CleaningSchedule,
  ): {
    @statusCode statusCode: 200;
    @body result: CleaningSchedule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a cleaning schedule.")
  @operationId("deleteCleaningSchedule")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteCleaningSchedule(
    @path @doc("CleaningSchedule logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search cleaning schedules by location, frequency, or active status.")
  @operationId("searchCleaningSchedules")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchCleaningSchedules(
    ...CleaningScheduleSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CleaningSchedule>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("EVS metrics service — retrieve operational performance metrics for the environmental services department.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/evs/metrics")
interface EVSMetricsService {
  @doc("Retrieve aggregate EVS performance metrics for a specified reporting period.")
  @operationId("getEVSMetrics")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  getEVSMetrics(
    ...EVSMetricsParams,
  ): {
    @statusCode statusCode: 200;
    @body result: EVSMetrics;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
