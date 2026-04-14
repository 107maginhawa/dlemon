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
 * Healthcare Administrative Scheduling — FHIR R4-aligned Schedule, Slot, and Appointment
 * management for booking and calendar orchestration across practitioners, locations, and devices.
 */
namespace Healthcare.Administrative.Scheduling;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

@doc("The free/busy status of a slot. Aligns with FHIR SlotStatus.")
enum SlotStatus {
  @doc("Indicates that the time interval is busy because one or more events have been scheduled for that interval")
  busy,

  @doc("Indicates that the time interval is free for scheduling")
  free,

  @doc("Indicates that the time interval is busy and cannot be scheduled")
  busyUnavailable,

  @doc("Indicates that the time interval is tentatively busy")
  busyTentative,

  @doc("This instance should not have been part of this patient's schedule")
  enteredInError,
}

@doc("The overall status of the appointment. Aligns with FHIR AppointmentStatus.")
enum AppointmentStatus {
  @doc("None of the participant(s) have finalized acceptance; start/end time may not be set")
  proposed,

  @doc("Some or all participant(s) have not finalized acceptance")
  pending,

  @doc("All participant(s) have been considered; appointment is confirmed")
  booked,

  @doc("The patient has arrived and is waiting to be seen")
  arrived,

  @doc("The planning stages are complete; encounter resource will track further status")
  fulfilled,

  @doc("The appointment has been cancelled")
  cancelled,

  @doc("The patient did not appear for the appointment")
  noShow,

  @doc("This instance should not have been part of this patient's schedule")
  enteredInError,

  @doc("Placed on a waitlist to be scheduled when a slot becomes available")
  waitlist,

  @doc("The patient has been seen and the appointment is complete")
  checkedIn,
}

@doc("Whether a participant is required for the appointment. Aligns with FHIR participantrequired.")
enum ParticipantRequired {
  @doc("The participant is required to attend the appointment")
  required,

  @doc("The participant may optionally attend the appointment")
  optional,

  @doc("The participant is excluded from the appointment and information is only being made available for their awareness")
  informationOnly,
}

@doc("The participation status of a participant. Aligns with FHIR ParticipationStatus.")
enum ParticipantStatus {
  @doc("The participant has accepted the invitation")
  accepted,

  @doc("The participant has declined the invitation")
  declined,

  @doc("The participant has tentatively accepted the invitation")
  tentative,

  @doc("The participant needs to indicate their participation status")
  needsAction,
}

@doc("The modality of the visit for the appointment.")
enum VisitType {
  @doc("The patient attends the appointment in person at the facility")
  inPerson,

  @doc("The appointment is conducted via video or audio-video technology")
  virtual,

  @doc("The appointment takes place at the patient's home")
  homeVisit,

  @doc("The appointment is conducted via telephone only")
  phone,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A participant in an appointment with their role, status, and optional period.")
model AppointmentParticipant {
  @doc("Role(s) of participant in appointment")
  type?: CodeableConcept[];

  @doc("Person, Location/HealthcareService or Device")
  actor: Reference;

  @doc("Whether this participant is required to be present at the appointment")
  required?: ParticipantRequired;

  @doc("Participation status of the actor")
  status: ParticipantStatus;

  @doc("Participation period of the actor")
  period?: Period;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A container for slots of time that may be available for booking appointments. Aligns with FHIR R4 Schedule.")
model Schedule extends HealthcareBaseEntity {
  @doc("Whether this schedule is in active use")
  active: boolean;

  @doc("High-level category of service to be performed during appointments booked in this Schedule")
  serviceCategory?: CodeableConcept[];

  @doc("Specific service within category to be performed during appointments booked in this Schedule")
  serviceType?: CodeableConcept[];

  @doc("Type of specialty needed")
  specialty?: CodeableConcept[];

  @doc("Resource(s) that availability information is being provided for (Practitioner, Location, Device)")
  actor: Reference[];

  @doc("Period of time covered by schedule")
  planningHorizon?: Period;

  @doc("Comments on the availability to describe any extended information")
  comment?: string;
}

@doc("A slot of time on a schedule that may be available for booking appointments. Aligns with FHIR R4 Slot.")
model Slot extends HealthcareBaseEntity {
  @doc("High-level category of service to be performed during appointments booked in this slot")
  serviceCategory?: CodeableConcept[];

  @doc("Specific service within category to be performed during appointments booked in this slot")
  serviceType?: CodeableConcept[];

  @doc("Type of specialty needed")
  specialty?: CodeableConcept[];

  @doc("Style of appointment or patient that has been booked in the slot")
  appointmentType?: CodeableConcept;

  @doc("The schedule resource that this slot defines an interval of status information")
  schedule: Reference;

  @doc("Free | busy | busy-unavailable | busy-tentative | entered-in-error")
  status: SlotStatus;

  @doc("Date/Time that the slot is to begin")
  start: utcDateTime;

  @doc("Date/Time that the slot is to conclude")
  end: utcDateTime;

  @doc("This slot has already been overbooked, appointments are unlikely to be accepted for this time")
  overbooked?: boolean;

  @doc("Comments on the slot to describe any extended information")
  comment?: string;
}

@doc("A booking of a healthcare event among patient(s), practitioner(s), related person(s) and/or device(s). Aligns with FHIR R4 Appointment.")
model Appointment extends HealthcareBaseEntity {
  @doc("The overall status of the appointment")
  status: AppointmentStatus;

  @doc("The coded reason for the appointment being cancelled")
  cancellationReason?: CodeableConcept;

  @doc("High-level category of service to be performed during the appointment")
  serviceCategory?: CodeableConcept[];

  @doc("Specific service within category to be performed during the appointment")
  serviceType?: CodeableConcept[];

  @doc("Type of specialty needed")
  specialty?: CodeableConcept[];

  @doc("Style of appointment or patient that has been booked in the slot")
  appointmentType?: CodeableConcept;

  @doc("Coded reason this appointment is scheduled")
  reasonCode?: CodeableConcept[];

  @doc("Reason the appointment is to take place (resource reference)")
  reasonReference?: Reference[];

  @doc("Used to make informed decisions if needing to re-prioritize; lower values are higher priority")
  @minValue(0)
  priority?: int32;

  @doc("Shown on a subject line in a meeting request, or appointment list")
  description?: string;

  @doc("Additional information to support the appointment")
  supportingInformation?: Reference[];

  @doc("When appointment is to take place")
  start?: utcDateTime;

  @doc("When appointment is to conclude")
  end?: utcDateTime;

  @doc("Can be less than start/end (e.g. estimate)")
  @minValue(1)
  minutesDuration?: int32;

  @doc("The slots that this appointment is filling")
  slot?: Reference[];

  @doc("The date that this appointment was initially created")
  created: utcDateTime;

  @doc("Additional comments")
  comment?: string;

  @doc("Detailed information and instructions for the patient")
  patientInstruction?: string;

  @doc("The service request this appointment is allocated to assess")
  basedOn?: Reference[];

  @doc("Participants involved in appointment")
  participant: AppointmentParticipant[];

  @doc("Potential date/time interval(s) requested to allocate the appointment within")
  requestedPeriod?: Period[];

  @doc("The modality of the visit — in-person, virtual, home visit, or phone")
  visitType?: VisitType;

  @doc("URL for virtual/telemedicine appointments")
  @format("uri")
  telemedicineUrl?: string;
}

// ---------------------------------------------------------------------------
// Request / search models
// ---------------------------------------------------------------------------

@doc("Request body for transitioning an appointment to a new status.")
model AppointmentStatusTransitionRequest {
  @doc("The target status for the appointment")
  status: AppointmentStatus;

  @doc("Coded reason for the status transition (e.g., cancellation reason)")
  reason?: CodeableConcept;
}

@doc("Search parameters for Schedule resources.")
model ScheduleSearchParams {
  @doc("Filter by actor reference id")
  @query actor?: string;

  @doc("Filter by active status")
  @query active?: boolean;

  @doc("Filter by service type code")
  @query serviceType?: string;

  @doc("Filter by specialty code")
  @query specialty?: string;

  @doc("Planning horizon start (inclusive)")
  @query dateFrom?: utcDateTime;

  @doc("Planning horizon end (inclusive)")
  @query dateTo?: utcDateTime;

  @doc("Page number (1-based)")
  @query page?: int32;

  @doc("Number of results per page")
  @query pageSize?: int32;
}

@doc("Search parameters for Slot resources.")
model SlotSearchParams {
  @doc("Filter by schedule reference id")
  @query schedule?: string;

  @doc("Filter by slot status")
  @query status?: SlotStatus;

  @doc("Filter by service type code")
  @query serviceType?: string;

  @doc("Filter slots starting at or after this date-time")
  @query dateFrom?: utcDateTime;

  @doc("Filter slots starting at or before this date-time")
  @query dateTo?: utcDateTime;

  @doc("Page number (1-based)")
  @query page?: int32;

  @doc("Number of results per page")
  @query pageSize?: int32;
}

@doc("Search parameters for Appointment resources.")
model AppointmentSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by practitioner reference id")
  @query practitioner?: string;

  @doc("Filter by appointment status")
  @query status?: AppointmentStatus;

  @doc("Filter by visit type")
  @query visitType?: VisitType;

  @doc("Filter appointments starting at or after this date-time")
  @query dateFrom?: utcDateTime;

  @doc("Filter appointments starting at or before this date-time")
  @query dateTo?: utcDateTime;

  @doc("Filter by service type code")
  @query serviceType?: string;

  @doc("Page number (1-based)")
  @query page?: int32;

  @doc("Number of results per page")
  @query pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD and search operations for Schedule resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface ScheduleManagement {
  @doc("Create a new Schedule.")
  @post
  @operationId("createSchedule")
  create(
    @body body: Schedule,
  ): {
    @statusCode statusCode: 201;
    @body schedule: Schedule;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single Schedule by id.")
  @get
  @operationId("getSchedule")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body schedule: Schedule;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing Schedule.")
  @put
  @operationId("updateSchedule")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Schedule,
  ): {
    @statusCode statusCode: 200;
    @body schedule: Schedule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a Schedule.")
  @patch
  @operationId("patchSchedule")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body schedule: Schedule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a Schedule by id.")
  @delete
  @operationId("deleteSchedule")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for Schedules using filter parameters.")
  @get
  @operationId("searchSchedules")
  @route("/search")
  search(
    ...ScheduleSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Schedule>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for Slot resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface SlotManagement {
  @doc("Create a new Slot.")
  @post
  @operationId("createSlot")
  create(
    @body body: Slot,
  ): {
    @statusCode statusCode: 201;
    @body slot: Slot;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single Slot by id.")
  @get
  @operationId("getSlot")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body slot: Slot;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing Slot.")
  @put
  @operationId("updateSlot")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Slot,
  ): {
    @statusCode statusCode: 200;
    @body slot: Slot;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a Slot.")
  @patch
  @operationId("patchSlot")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body slot: Slot;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a Slot by id.")
  @delete
  @operationId("deleteSlot")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for Slots using filter parameters.")
  @get
  @operationId("searchSlots")
  @route("/search")
  search(
    ...SlotSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Slot>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD, search, and status transition operations for Appointment resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface AppointmentManagement {
  @doc("Create a new Appointment.")
  @post
  @operationId("createAppointment")
  create(
    @body body: Appointment,
  ): {
    @statusCode statusCode: 201;
    @body appointment: Appointment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single Appointment by id.")
  @get
  @operationId("getAppointment")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body appointment: Appointment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing Appointment.")
  @put
  @operationId("updateAppointment")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Appointment,
  ): {
    @statusCode statusCode: 200;
    @body appointment: Appointment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update an Appointment.")
  @patch
  @operationId("patchAppointment")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body appointment: Appointment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an Appointment by id.")
  @delete
  @operationId("deleteAppointment")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Transition an Appointment to a new lifecycle status.")
  @post
  @operationId("transitionAppointmentStatus")
  @route("/{id}/status")
  transitionStatus(
    @path id: string,
    @body body: AppointmentStatusTransitionRequest,
  ): {
    @statusCode statusCode: 200;
    @body appointment: Appointment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for Appointments using filter parameters.")
  @get
  @operationId("searchAppointments")
  @route("/search")
  search(
    ...AppointmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Appointment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
