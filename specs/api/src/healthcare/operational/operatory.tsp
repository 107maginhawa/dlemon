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

namespace Healthcare.Operational.Operatory;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Functional type of an operatory room determining its clinical configuration.
 */
enum OperatoryType {
  /** Standard multi-purpose treatment room. */
  general,
  /** Room configured primarily for dental hygiene appointments. */
  hygiene,
  /** Room equipped for oral surgical procedures. */
  surgical,
  /** Child-friendly room for paediatric dental appointments. */
  pediatric,
  /** Room configured with orthodontic-specific equipment. */
  orthodontic,
}

/**
 * Real-time availability status of an operatory room.
 */
enum OperatoryStatus {
  /** Room is clean, equipped, and available to accept a patient. */
  available,
  /** Room is currently occupied by a patient in treatment. */
  occupied,
  /** Room is being cleaned and prepared between patients. */
  turnover,
  /** Room is undergoing maintenance or equipment repair. */
  maintenance,
  /** Room has been taken out of service. */
  closed,
}

/**
 * Lifecycle status of a chair-time block for a scheduled appointment.
 */
enum ChairBlockStatus {
  /** Appointment is booked and the patient has not yet arrived. */
  scheduled,
  /** Patient has arrived and checked in at reception. */
  checkedIn,
  /** Patient is seated in the chair and treatment is underway. */
  inProgress,
  /** Treatment has concluded and the patient has left the chair. */
  completed,
  /** Patient did not attend the appointment. */
  noShow,
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

/**
 * A physical operatory room within a dental facility.
 */
model Operatory extends HealthcareBaseEntity {
  /** Display name or room number of the operatory. */
  name: string;

  /** Physical location (building, wing, or suite) containing this operatory. */
  location: Reference;

  /** Functional type of the operatory. */
  type: OperatoryType;

  /** Current real-time availability status. */
  status: OperatoryStatus;

  /** Fixed or moveable equipment present in the operatory (e.g. dental unit, CBCT). */
  equipment?: CodeableConcept[];

  /** Special features or capabilities of the operatory (e.g. nitrous oxide, laser). */
  features?: string[];
}

/**
 * An assignment linking a practitioner to a specific operatory on a given day and shift.
 */
model OperatoryAssignment extends HealthcareBaseEntity {
  /** Operatory being assigned to the practitioner. */
  operatory: Reference;

  /** Practitioner assigned to this operatory for the shift. */
  practitioner: Reference;

  /** Calendar date of the assignment. */
  date: plainDate;

  /** Wall-clock start time of the assignment in local time (ISO 8601 time, e.g. 08:00). */
  startTime: string;

  /** Wall-clock end time of the assignment in local time (ISO 8601 time, e.g. 17:00). */
  endTime: string;

  /** Descriptive label for the shift type (e.g. morning, afternoon, full-day). */
  shiftType?: string;
}

/**
 * A block of chair time in an operatory allocated to a specific appointment.
 */
model ChairTimeBlock extends HealthcareBaseEntity {
  /** Operatory in which the appointment chair time is reserved. */
  operatory: Reference;

  /** Appointment being conducted during this chair-time block. */
  appointment: Reference;

  /** Patient occupying the chair during this block. */
  patient: Reference;

  /** Scheduled or actual start date and time of the chair block. */
  startTime: utcDateTime;

  /** Actual time the patient left the chair. */
  endTime?: utcDateTime;

  /** Current status of the chair-time block. */
  status: ChairBlockStatus;
}

/**
 * A record of a room turnover event between consecutive patient appointments.
 */
model TurnoverEvent extends HealthcareBaseEntity {
  /** Operatory in which the turnover is taking place. */
  operatory: Reference;

  /** Appointment that was completed immediately before the turnover began. */
  previousAppointment?: Reference;

  /** Date and time the turnover process began. */
  startTime: utcDateTime;

  /** Date and time the room was ready for the next patient. */
  endTime?: utcDateTime;

  /** Staff member(s) who performed the turnover. */
  performedBy?: Reference;
}

/**
 * Aggregated utilisation metrics for an operatory room on a given date.
 * Not a persisted resource; computed on demand from chair-time block data.
 */
model OperatoryMetrics {
  /** Identifier of the operatory these metrics relate to. */
  operatoryId: string;

  /** Calendar date these metrics cover. */
  date: plainDate;

  /** Total scheduled minutes the operatory was available for appointments. */
  totalMinutesAvailable: int32;

  /** Total minutes the operatory was occupied by patient care. */
  totalMinutesOccupied: int32;

  /** Utilisation percentage calculated as (occupied / available) * 100. */
  utilizationPercent: float64;

  /** Number of turnover events recorded during the day. */
  turnoverCount: int32;

  /** Average duration in minutes of each turnover event during the day. */
  avgTurnoverMinutes: float64;
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

model OperatoryCreateRequest {
  ...OmitProperties<Operatory, "id" | "meta" | "createdAt" | "updatedAt">;
}

model OperatorySearchParams {
  locationId?: string;
  type?: OperatoryType;
  status?: OperatoryStatus;
  ...PaginationQuery;
}

model StatusBoardParams {
  locationId?: string;
  date?: plainDate;
}

model OperatoryAssignmentCreateRequest {
  ...OmitProperties<OperatoryAssignment, "id" | "meta" | "createdAt" | "updatedAt">;
}

model OperatoryAssignmentSearchParams {
  operatoryId?: string;
  practitionerId?: string;
  date?: plainDate;
  dateFrom?: plainDate;
  dateTo?: plainDate;
  ...PaginationQuery;
}

model ChairTimeBlockCreateRequest {
  ...OmitProperties<ChairTimeBlock, "id" | "meta" | "createdAt" | "updatedAt">;
}

model ChairTimeBlockSearchParams {
  operatoryId?: string;
  patientId?: string;
  appointmentId?: string;
  status?: ChairBlockStatus;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model TurnoverEventCreateRequest {
  ...OmitProperties<TurnoverEvent, "id" | "meta" | "createdAt" | "updatedAt">;
}

model TurnoverSearchParams {
  operatoryId?: string;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model OperatoryMetricsParams {
  operatoryId: string;
  date: plainDate;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD, search, and status-board operations for operatory rooms.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Operational")
interface OperatoryManagement {
  /**
   * Create a new operatory room record.
   * @param body Operatory creation payload.
   * @returns The newly created operatory record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createOperatory")
  create(@body body: OperatoryCreateRequest): {
    @statusCode statusCode: 201;
    @body operatory: Operatory;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an operatory by its unique identifier.
   * @param id The operatory identifier.
   * @returns The requested operatory record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getOperatory")
  read(@path id: string): Operatory | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing operatory record.
   * @param id The operatory identifier.
   * @param body Updated operatory payload.
   * @returns The updated operatory record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateOperatory")
  update(@path id: string, @body body: OperatoryCreateRequest): Operatory | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an operatory record.
   * @param id The operatory identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteOperatory")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search operatories by location, type, or current status.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching operatory records.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchOperatories")
  search(...OperatorySearchParams): PaginatedResponse<Operatory> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a real-time status board showing the current state of all operatories at a location.
   * @param params Optional location and date filters.
   * @returns A list of operatories with their current status and occupancy information.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getOperatoryStatusBoard")
  @route("/status-board")
  getStatusBoard(...StatusBoardParams): Operatory[] | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for practitioner-to-operatory assignments.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Operational")
interface OperatoryAssignmentManagement {
  /**
   * Create a new operatory assignment for a practitioner shift.
   * @param body Operatory assignment creation payload.
   * @returns The newly created operatory assignment.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createOperatoryAssignment")
  create(@body body: OperatoryAssignmentCreateRequest): {
    @statusCode statusCode: 201;
    @body assignment: OperatoryAssignment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an operatory assignment by its unique identifier.
   * @param id The operatory assignment identifier.
   * @returns The requested operatory assignment.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getOperatoryAssignment")
  read(@path id: string): OperatoryAssignment | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing operatory assignment.
   * @param id The operatory assignment identifier.
   * @param body Updated assignment payload.
   * @returns The updated operatory assignment.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateOperatoryAssignment")
  update(@path id: string, @body body: OperatoryAssignmentCreateRequest): OperatoryAssignment | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an operatory assignment.
   * @param id The operatory assignment identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteOperatoryAssignment")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search operatory assignments by operatory, practitioner, date, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching operatory assignments.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchOperatoryAssignments")
  search(...OperatoryAssignmentSearchParams): PaginatedResponse<OperatoryAssignment> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for chair-time blocks tied to scheduled appointments.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Operational")
interface ChairTimeBlockManagement {
  /**
   * Create a new chair-time block for an appointment.
   * @param body Chair-time block creation payload.
   * @returns The newly created chair-time block.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createChairTimeBlock")
  create(@body body: ChairTimeBlockCreateRequest): {
    @statusCode statusCode: 201;
    @body block: ChairTimeBlock;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a chair-time block by its unique identifier.
   * @param id The chair-time block identifier.
   * @returns The requested chair-time block.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getChairTimeBlock")
  read(@path id: string): ChairTimeBlock | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing chair-time block.
   * @param id The chair-time block identifier.
   * @param body Updated chair-time block payload.
   * @returns The updated chair-time block.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateChairTimeBlock")
  update(@path id: string, @body body: ChairTimeBlockCreateRequest): ChairTimeBlock | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a chair-time block record.
   * @param id The chair-time block identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteChairTimeBlock")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search chair-time blocks by operatory, patient, appointment, status, or time range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching chair-time blocks.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchChairTimeBlocks")
  search(...ChairTimeBlockSearchParams): PaginatedResponse<ChairTimeBlock> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * Create and search operations for operatory turnover events.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Operational")
interface TurnoverManagement {
  /**
   * Record a new turnover event for an operatory.
   * @param body Turnover event creation payload.
   * @returns The newly created turnover event record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createTurnoverEvent")
  create(@body body: TurnoverEventCreateRequest): {
    @statusCode statusCode: 201;
    @body event: TurnoverEvent;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search turnover events by operatory or time range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching turnover events.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchTurnoverEvents")
  search(...TurnoverSearchParams): PaginatedResponse<TurnoverEvent> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * On-demand operatory utilisation metrics service.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Operational")
interface OperatoryMetricsService {
  /**
   * Retrieve aggregated utilisation metrics for a specific operatory on a given date.
   * Metrics are computed from chair-time block and turnover event data.
   * @param params Operatory identifier and target date.
   * @returns Computed utilisation metrics for the specified operatory and date.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getOperatoryMetrics")
  getMetrics(...OperatoryMetricsParams): OperatoryMetrics | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
