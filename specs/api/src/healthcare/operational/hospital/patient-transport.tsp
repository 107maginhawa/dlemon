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
 * Patient Transport module.
 *
 * Provides models and operations for managing intra-facility patient transport:
 * request creation and dispatch, transport team assignments, and movement tracking
 * from origin to destination. Supports all transport modes from ambulatory to
 * isolation bed transfers.
 */
namespace Healthcare.Operational.Hospital.Transport;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Priority level of a transport request, governing response time targets.")
enum TransportPriority {
  @doc("Routine transport — no clinical urgency, scheduled within the standard queue")
  routine,

  @doc("Urgent transport — patient condition requires prompt movement, target response within 20 minutes")
  urgent,

  @doc("Stat transport — clinically time-critical, immediate response required within 5 minutes")
  stat,
}

@doc("Mode of patient transport based on mobility and clinical status.")
enum TransportMode {
  @doc("Patient can walk with or without assistive devices")
  ambulatory,

  @doc("Patient is transported in a standard hospital wheelchair")
  wheelchair,

  @doc("Patient is transported on a stretcher or gurney")
  stretcher,

  @doc("Patient remains in their hospital bed during transport (e.g., post-surgical, ICU)")
  bed,

  @doc("Patient requires an isolation-equipped transport bed to prevent pathogen transmission")
  isolationBed,
}

@doc("Lifecycle status of a transport request.")
enum TransportStatus {
  @doc("The request has been created and is awaiting assignment to a transport team member")
  requested,

  @doc("A transport team member has been assigned and is en route to the origin location")
  assigned,

  @doc("The patient is currently being transported between locations")
  inTransit,

  @doc("The patient has been delivered to the destination and transport is complete")
  completed,

  @doc("The transport request was cancelled before or after assignment")
  cancelled,
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A patient transport request capturing origin, destination, mode, priority, and transport status throughout the movement lifecycle.")
model TransportRequest extends HealthcareBaseEntity {
  @doc("Reference to the Patient to be transported")
  patient: Reference;

  @doc("Reference to the Encounter associated with this transport event")
  encounter?: Reference;

  @doc("Reference to the Location the patient is being transported from")
  fromLocation: Reference;

  @doc("Reference to the Location the patient is being transported to")
  toLocation: Reference;

  @doc("Reference to the Practitioner or staff member who requested the transport")
  requestedBy: Reference;

  @doc("Date and time the transport was requested")
  requestedAt: utcDateTime;

  @doc("Scheduled or target date and time for transport to begin")
  scheduledAt?: utcDateTime;

  @doc("Clinical priority of this transport request")
  priority: TransportPriority;

  @doc("Mode of transport required based on the patient's mobility and clinical condition")
  transportMode: TransportMode;

  @doc("Current lifecycle status of the transport request")
  status: TransportStatus;

  @doc("Reference to the transport team member assigned to fulfil this request")
  assignedTo?: Reference;

  @doc("Date and time the transporter departed from the origin location with the patient")
  departedAt?: utcDateTime;

  @doc("Date and time the patient arrived at the destination location")
  arrivedAt?: utcDateTime;

  @doc("Special requirements or clinical considerations for this transport (e.g., 'Oxygen required', 'IV pole', 'Cardiac monitor', 'Fall risk — two-person assist')")
  specialRequirements?: string[];
}

@doc("A transport team defining a group of staff members responsible for patient movement within the facility.")
model TransportTeam extends HealthcareBaseEntity {
  @doc("Human-readable name for the transport team (e.g., 'Day Shift Transport — West Wing')")
  name: string;

  @doc("References to the Practitioner resources who are members of this transport team")
  members: Reference[];

  @doc("Department or unit this team is primarily assigned to")
  department?: string;

  @doc("Whether this team is currently active and available for assignment")
  active: boolean;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for transport requests.")
model TransportRequestSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by origin location reference ID") @query fromLocation?: string;
  @doc("Filter by destination location reference ID") @query toLocation?: string;
  @doc("Filter by requesting staff reference ID") @query requestedBy?: string;
  @doc("Filter by assigned transporter reference ID") @query assignedTo?: string;
  @doc("Filter by transport priority") @query priority?: TransportPriority;
  @doc("Filter by transport mode") @query transportMode?: TransportMode;
  @doc("Filter by transport status") @query status?: TransportStatus;
  @doc("Filter requests created at or after this date-time") @query requestedFrom?: utcDateTime;
  @doc("Filter requests created at or before this date-time") @query requestedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for transport teams.")
model TransportTeamSearchParams {
  @doc("Filter by team active status") @query active?: boolean;
  @doc("Filter by department name") @query department?: string;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Transport request management — create, assign, dispatch, and complete patient transport requests across the facility.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/transport/requests")
interface TransportRequestManagement {
  @doc("Create a new patient transport request.")
  @operationId("createTransportRequest")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createTransportRequest(
    @body body: TransportRequest,
  ): {
    @statusCode statusCode: 201;
    @body result: TransportRequest;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a transport request by its logical ID.")
  @operationId("getTransportRequest")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getTransportRequest(
    @path @doc("TransportRequest logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: TransportRequest;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a transport request.")
  @operationId("updateTransportRequest")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateTransportRequest(
    @path @doc("TransportRequest logical ID") id: UUID,
    @body body: TransportRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: TransportRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a transport request.")
  @operationId("deleteTransportRequest")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteTransportRequest(
    @path @doc("TransportRequest logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search transport requests by patient, location, priority, mode, status, or date range.")
  @operationId("searchTransportRequests")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchTransportRequests(
    ...TransportRequestSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<TransportRequest>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Assign a transport request to a specific team member.")
  @operationId("assignTransportRequest")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/assign")
  assignTransportRequest(
    @path @doc("TransportRequest logical ID") id: UUID,
    @body body: { assignedTo: string },
  ): {
    @statusCode statusCode: 200;
    @body result: TransportRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Mark a transport request as dispatched — the transporter has departed from the origin with the patient.")
  @operationId("dispatchTransportRequest")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/dispatch")
  dispatchTransportRequest(
    @path @doc("TransportRequest logical ID") id: UUID,
    @body body: { departedAt: utcDateTime },
  ): {
    @statusCode statusCode: 200;
    @body result: TransportRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Complete a transport request, recording the time the patient arrived at the destination.")
  @operationId("completeTransportRequest")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/complete")
  completeTransportRequest(
    @path @doc("TransportRequest logical ID") id: UUID,
    @body body: { arrivedAt: utcDateTime; note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: TransportRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Transport team management — create and maintain teams of staff members responsible for patient transport.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/transport/teams")
interface TransportTeamManagement {
  @doc("Create a new transport team.")
  @operationId("createTransportTeam")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createTransportTeam(
    @body body: TransportTeam,
  ): {
    @statusCode statusCode: 201;
    @body result: TransportTeam;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a transport team by its logical ID.")
  @operationId("getTransportTeam")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getTransportTeam(
    @path @doc("TransportTeam logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: TransportTeam;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a transport team — modify membership, name, or department.")
  @operationId("updateTransportTeam")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateTransportTeam(
    @path @doc("TransportTeam logical ID") id: UUID,
    @body body: TransportTeam,
  ): {
    @statusCode statusCode: 200;
    @body result: TransportTeam;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a transport team.")
  @operationId("deleteTransportTeam")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteTransportTeam(
    @path @doc("TransportTeam logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search transport teams by active status or department.")
  @operationId("searchTransportTeams")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchTransportTeams(
    ...TransportTeamSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<TransportTeam>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
