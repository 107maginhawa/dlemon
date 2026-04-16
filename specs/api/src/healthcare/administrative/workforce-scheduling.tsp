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
 * Healthcare Administrative Workforce Scheduling — staff work schedule management,
 * shift assignment and swapping, time-off requests, and on-call scheduling for
 * clinical and administrative personnel.
 */
namespace Healthcare.Administrative.WorkforceScheduling;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The type of work shift.")
enum ShiftType {
  @doc("Standard daytime shift (typically 07:00–15:00 or 08:00–16:00)")
  day,

  @doc("Evening or afternoon shift (typically 15:00–23:00)")
  evening,

  @doc("Overnight or graveyard shift (typically 23:00–07:00)")
  night,

  @doc("On-call shift where the practitioner responds as needed")
  oncall,

  @doc("A split shift with a gap between two working periods")
  split,
}

@doc("The status of a shift assignment.")
enum ShiftStatus {
  @doc("The shift has been assigned but not yet confirmed by the practitioner")
  scheduled,

  @doc("The practitioner has confirmed they will work this shift")
  confirmed,

  @doc("The practitioner is currently working this shift")
  inProgress,

  @doc("The shift has been completed")
  completed,

  @doc("The practitioner did not report for this shift")
  noShow,

  @doc("The shift has been swapped with another practitioner")
  swapped,

  @doc("The shift assignment has been cancelled")
  cancelled,
}

@doc("The type of time-off requested.")
enum TimeOffType {
  @doc("Paid annual or vacation leave")
  vacation,

  @doc("Sick leave for illness or medical appointments")
  sick,

  @doc("Personal day or personal leave")
  personal,

  @doc("Bereavement leave for family loss")
  bereavement,

  @doc("Continuing education or professional development leave")
  education,

  @doc("Maternity leave")
  maternity,

  @doc("Paternity leave")
  paternity,

  @doc("A leave type not covered by other values")
  other,
}

@doc("The approval status of a time-off request.")
enum TimeOffStatus {
  @doc("The request is awaiting review and approval")
  pending,

  @doc("The request has been approved")
  approved,

  @doc("The request has been denied")
  denied,

  @doc("The request was cancelled by the practitioner")
  cancelled,
}

@doc("The type of on-call duty.")
enum OnCallType {
  @doc("First-line on-call coverage, expected to respond immediately")
  primary,

  @doc("Second-line on-call, called if primary is unavailable")
  secondary,

  @doc("Backup on-call, called only if both primary and secondary are unavailable")
  backup,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A repeating pattern of working hours within a work schedule.")
model SchedulePattern {
  @doc("The day of the week (monday, tuesday, wednesday, thursday, friday, saturday, sunday)")
  @maxLength(10)
  dayOfWeek: string;

  @doc("The shift start time in HH:MM (24-hour) format")
  @maxLength(5)
  startTime: string;

  @doc("The shift end time in HH:MM (24-hour) format")
  @maxLength(5)
  endTime: string;

  @doc("The type of shift for this day")
  shiftType: ShiftType;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A recurring work schedule defining when a practitioner is expected to work.")
model WorkSchedule extends HealthcareBaseEntity {
  @doc("The practitioner to whom this schedule applies")
  practitioner: Reference;

  @doc("The organisation responsible for this schedule")
  organization: Reference;

  @doc("The department or unit this schedule is for")
  department?: Reference;

  @doc("The period during which this schedule is effective")
  effectivePeriod: Period;

  @doc("The recurring shift patterns that make up this schedule")
  pattern: SchedulePattern[];
}

@doc("An assignment of a specific practitioner to a specific shift on a given date.")
model ShiftAssignment extends HealthcareBaseEntity {
  @doc("The practitioner assigned to this shift")
  practitioner: Reference;

  @doc("The date on which this shift occurs")
  date: plainDate;

  @doc("The type of shift assigned")
  shiftType: ShiftType;

  @doc("The department in which the shift will be worked")
  department: Reference;

  @doc("The physical location where the shift will be worked")
  location?: Reference;

  @doc("The scheduled start date and time of the shift")
  startTime: utcDateTime;

  @doc("The scheduled end date and time of the shift")
  endTime: utcDateTime;

  @doc("The current status of the shift assignment")
  status: ShiftStatus;

  @doc("The practitioner with whom this shift was swapped, if applicable")
  swappedWith?: Reference;

  @doc("Additional notes about this shift assignment")
  @maxLength(500)
  note?: string;
}

@doc("A request from a practitioner to take time off.")
model TimeOffRequest extends HealthcareBaseEntity {
  @doc("The practitioner requesting time off")
  practitioner: Reference;

  @doc("The type of leave being requested")
  type: TimeOffType;

  @doc("The first day of the requested leave period")
  startDate: plainDate;

  @doc("The last day of the requested leave period (inclusive)")
  endDate: plainDate;

  @doc("The current status of the time-off request")
  status: TimeOffStatus;

  @doc("The reason for the time-off request")
  @maxLength(500)
  reason?: string;

  @doc("The manager or administrator who approved or denied the request")
  approvedBy?: Reference;

  @doc("The date and time the decision was made")
  approvedAt?: utcDateTime;
}

@doc("An on-call schedule entry assigning a practitioner to be available for emergent calls.")
model OnCallSchedule extends HealthcareBaseEntity {
  @doc("The practitioner assigned to on-call duty")
  practitioner: Reference;

  @doc("The department for which the practitioner is on call")
  department: Reference;

  @doc("The start of the on-call period")
  startTime: utcDateTime;

  @doc("The end of the on-call period")
  endTime: utcDateTime;

  @doc("The on-call duty type (primary, secondary, backup)")
  type: OnCallType;

  @doc("The contact phone number for reaching the practitioner during on-call hours")
  @maxLength(20)
  contactNumber: string;
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

@doc("Request body for swapping a shift with another practitioner.")
model ShiftSwapRequest {
  @doc("The id of the shift assignment to swap away")
  fromShiftId: string;

  @doc("The practitioner who will take this shift")
  swapWithPractitioner: Reference;

  @doc("Optional reason for the swap")
  @maxLength(500)
  reason?: string;
}

@doc("Request body for approving or denying a time-off request.")
model TimeOffDecisionRequest {
  @doc("The approval decision")
  decision: TimeOffStatus;

  @doc("Optional reason for the decision")
  @maxLength(500)
  reason?: string;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for ShiftAssignment resources.")
model ShiftAssignmentSearchParams {
  @doc("Filter by practitioner reference id")
  @query practitioner?: string;

  @doc("Filter by department reference id")
  @query department?: string;

  @doc("Filter by shift status")
  @query status?: ShiftStatus;

  @doc("Filter by shift type")
  @query shiftType?: ShiftType;

  @doc("Filter assignments on or after this date")
  @query dateFrom?: plainDate;

  @doc("Filter assignments on or before this date")
  @query dateTo?: plainDate;

  ...PaginationQuery;
}

@doc("Search parameters for TimeOffRequest resources.")
model TimeOffRequestSearchParams {
  @doc("Filter by practitioner reference id")
  @query practitioner?: string;

  @doc("Filter by leave type")
  @query type?: TimeOffType;

  @doc("Filter by request status")
  @query status?: TimeOffStatus;

  @doc("Filter requests starting on or after this date")
  @query startFrom?: plainDate;

  @doc("Filter requests starting on or before this date")
  @query startTo?: plainDate;

  ...PaginationQuery;
}

@doc("Search parameters for OnCallSchedule resources.")
model OnCallScheduleSearchParams {
  @doc("Filter by practitioner reference id")
  @query practitioner?: string;

  @doc("Filter by department reference id")
  @query department?: string;

  @doc("Filter by on-call type")
  @query type?: OnCallType;

  @doc("Filter on-call periods starting on or after this date-time")
  @query startFrom?: utcDateTime;

  @doc("Filter on-call periods starting on or before this date-time")
  @query startTo?: utcDateTime;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD operations for WorkSchedule resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface WorkScheduleManagement {
  @doc("Create a new WorkSchedule.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @post
  @operationId("createWorkSchedule")
  create(
    @body body: WorkSchedule,
  ): {
    @statusCode statusCode: 201;
    @body workSchedule: WorkSchedule;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single WorkSchedule by id.")
  @extension("x-security-required-roles", #["admin", "scheduler", "clinician"])
  @get
  @operationId("getWorkSchedule")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body workSchedule: WorkSchedule;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing WorkSchedule.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @put
  @operationId("updateWorkSchedule")
  @route("/{id}")
  update(
    @path id: string,
    @body body: WorkSchedule,
  ): {
    @statusCode statusCode: 200;
    @body workSchedule: WorkSchedule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a WorkSchedule by id.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @delete
  @operationId("deleteWorkSchedule")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD, search, and swap operations for ShiftAssignment resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface ShiftAssignmentManagement {
  @doc("Create a new ShiftAssignment.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @post
  @operationId("createShiftAssignment")
  create(
    @body body: ShiftAssignment,
  ): {
    @statusCode statusCode: 201;
    @body shiftAssignment: ShiftAssignment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single ShiftAssignment by id.")
  @extension("x-security-required-roles", #["admin", "scheduler", "clinician"])
  @get
  @operationId("getShiftAssignment")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body shiftAssignment: ShiftAssignment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing ShiftAssignment.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @put
  @operationId("updateShiftAssignment")
  @route("/{id}")
  update(
    @path id: string,
    @body body: ShiftAssignment,
  ): {
    @statusCode statusCode: 200;
    @body shiftAssignment: ShiftAssignment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a ShiftAssignment (e.g., status transition).")
  @extension("x-security-required-roles", #["admin", "scheduler", "clinician"])
  @patch
  @operationId("patchShiftAssignment")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body shiftAssignment: ShiftAssignment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a ShiftAssignment by id.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @delete
  @operationId("deleteShiftAssignment")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for ShiftAssignment resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "scheduler", "clinician"])
  @get
  @operationId("searchShiftAssignments")
  @route("/search")
  search(
    ...ShiftAssignmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ShiftAssignment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Request a shift swap with another practitioner.")
  @extension("x-security-required-roles", #["admin", "scheduler", "clinician"])
  @post
  @operationId("swapShift")
  @route("/swap")
  swap(
    @body body: ShiftSwapRequest,
  ): {
    @statusCode statusCode: 200;
    @body shiftAssignment: ShiftAssignment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and approve/deny operations for TimeOffRequest resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface TimeOffRequestManagement {
  @doc("Submit a new TimeOffRequest.")
  @extension("x-security-required-roles", #["admin", "scheduler", "clinician"])
  @post
  @operationId("createTimeOffRequest")
  create(
    @body body: TimeOffRequest,
  ): {
    @statusCode statusCode: 201;
    @body timeOffRequest: TimeOffRequest;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single TimeOffRequest by id.")
  @extension("x-security-required-roles", #["admin", "scheduler", "clinician"])
  @get
  @operationId("getTimeOffRequest")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body timeOffRequest: TimeOffRequest;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a TimeOffRequest by id.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @delete
  @operationId("deleteTimeOffRequest")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for TimeOffRequest resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "scheduler", "clinician"])
  @get
  @operationId("searchTimeOffRequests")
  @route("/search")
  search(
    ...TimeOffRequestSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<TimeOffRequest>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Approve or deny a pending TimeOffRequest.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @post
  @operationId("decideTimeOffRequest")
  @route("/{id}/decision")
  decide(
    @path id: string,
    @body body: TimeOffDecisionRequest,
  ): {
    @statusCode statusCode: 200;
    @body timeOffRequest: TimeOffRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD, search, and current on-call query operations for OnCallSchedule resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface OnCallScheduleManagement {
  @doc("Create a new OnCallSchedule entry.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @post
  @operationId("createOnCallSchedule")
  create(
    @body body: OnCallSchedule,
  ): {
    @statusCode statusCode: 201;
    @body onCallSchedule: OnCallSchedule;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single OnCallSchedule entry by id.")
  @extension("x-security-required-roles", #["admin", "scheduler", "clinician"])
  @get
  @operationId("getOnCallSchedule")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body onCallSchedule: OnCallSchedule;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing OnCallSchedule entry.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @put
  @operationId("updateOnCallSchedule")
  @route("/{id}")
  update(
    @path id: string,
    @body body: OnCallSchedule,
  ): {
    @statusCode statusCode: 200;
    @body onCallSchedule: OnCallSchedule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an OnCallSchedule entry by id.")
  @extension("x-security-required-roles", #["admin", "scheduler"])
  @delete
  @operationId("deleteOnCallSchedule")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for OnCallSchedule entries using filter parameters.")
  @extension("x-security-required-roles", #["admin", "scheduler", "clinician"])
  @get
  @operationId("searchOnCallSchedules")
  @route("/search")
  search(
    ...OnCallScheduleSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<OnCallSchedule>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve the practitioner(s) currently on call for a given department.")
  @extension("x-security-required-roles", #["admin", "scheduler", "clinician"])
  @get
  @operationId("getCurrentOnCall")
  @route("/current")
  getCurrentOnCall(
    @query department: string,
  ): {
    @statusCode statusCode: 200;
    @body onCallSchedules: OnCallSchedule[];
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
