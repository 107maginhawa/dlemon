/**
 * Dental Scheduling Module
 *
 * Covers FR3.x:
 * - DentalAppointment: dental-specific appointment wrapping the generic booking
 * - Status lifecycle: scheduled -> checked_in -> completed | cancelled | no_show
 * - Check-in: creates a draft DentalVisit linked to the appointment
 * - Walk-in support, operatory assignment, procedure type
 * - No-show is reversible (can revert to completed)
 */

import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

enum AppointmentStatus {
  scheduled,
  checked_in,
  completed,
  cancelled,
  no_show,
}

// V-SCH-007: visit_type is a constrained enum (checkup/treatment/emergency/recall),
// not free-text. Wire field name is `visitType` (camelCase per repo convention).
enum VisitType {
  checkup,
  treatment,
  emergency,
  recall,
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

// V-SCH-006: canonical wire schema uses providerId/startAt/endAt/visitType
// (API_CONTRACTS provider_id/start_at/end_at/visit_type). Duration is derived
// from startAt/endAt; the DB still stores dentist_member_id/scheduled_at/
// duration_minutes/service_type internally (see MODULE_SPEC §7).
@example(#{
  id: "apt-1a2b3c4d-0000-4000-8000-000000000001",
  createdAt: utcDateTime.fromISO("2026-03-01T08:00:00Z"),
  updatedAt: utcDateTime.fromISO("2026-03-01T08:00:00Z"),
  version: 1,
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  providerId: "m1a2b3c4-0000-4000-8000-000000000001",
  branchId: "b1a2b3c4-0000-4000-8000-000000000001",
  startAt: utcDateTime.fromISO("2026-03-15T09:00:00Z"),
  endAt: utcDateTime.fromISO("2026-03-15T10:00:00Z"),
  visitType: VisitType.checkup,
  walkIn: false,
  status: AppointmentStatus.scheduled,
  notes: "First visit — bring previous X-rays if available",
}, #{ title: "Scheduled checkup" })
model DentalAppointment {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  patientId: UUID;
  providerId: UUID;
  branchId: UUID;
  startAt: utcDateTime;
  endAt: utcDateTime;
  visitType: VisitType;
  operatoryId?: UUID;
  walkIn: boolean;
  status: AppointmentStatus;
  checkInTime?: utcDateTime;
  visitId?: UUID;
  notes?: string;
  cancelledAt?: utcDateTime;
  cancellationReason?: string;
  no_showAt?: utcDateTime;
  warnings?: string[];
}

@example(#{
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  providerId: "m1a2b3c4-0000-4000-8000-000000000001",
  branchId: "b1a2b3c4-0000-4000-8000-000000000001",
  startAt: utcDateTime.fromISO("2026-03-15T09:00:00Z"),
  endAt: utcDateTime.fromISO("2026-03-15T10:00:00Z"),
  visitType: VisitType.checkup,
  walkIn: false,
  notes: "First visit — bring previous X-rays if available",
}, #{ title: "Book a checkup" })
model CreateAppointmentRequest {
  patientId: UUID;
  providerId: UUID;
  branchId: UUID;
  startAt: utcDateTime;
  endAt: utcDateTime;
  visitType: VisitType;
  operatoryId?: UUID;
  walkIn?: boolean;

  @maxLength(500)
  notes?: string;
}

model UpdateAppointmentRequest {
  startAt?: utcDateTime;
  endAt?: utcDateTime;
  providerId?: UUID;
  visitType?: VisitType;
  operatoryId?: UUID;

  @maxLength(500)
  notes?: string;

  status?: AppointmentStatus;
  cancellationReason?: string;
}

model CheckInResponse {
  appointment: DentalAppointment;
  visitId: UUID;
}

// ---------------------------------------------------------------------------
// API Interfaces
// ---------------------------------------------------------------------------

namespace DentalSchedulingModule {
  interface AppointmentManagement {
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createAppointment")
    create(
      @body body: CreateAppointmentRequest
    ): ApiCreatedResponse<DentalAppointment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listAppointments")
    list(
      // V-SCH-004: branchId + date_from/date_to window (max 31 days) are required;
      // page/per_page replace the old single date + limit/offset.
      @query branchId: UUID,
      @query("date_from") dateFrom: string,
      @query("date_to") dateTo: string,
      @query providerId?: UUID,
      @query patientId?: UUID,
      @query status?: AppointmentStatus,
      @query @minValue(1) page?: int32,
      @query("per_page") @minValue(1) @maxValue(200) perPage?: int32
    ): ApiOkResponse<DentalAppointment[]>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{appointmentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getAppointment")
    get(
      @path appointmentId: UUID
    ): ApiOkResponse<DentalAppointment>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @patch
    @route("/{appointmentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updateAppointment")
    update(
      @path appointmentId: UUID,
      @body body: UpdateAppointmentRequest
    ): ApiOkResponse<DentalAppointment>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @delete
    @route("/{appointmentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("cancelAppointment")
    cancel(
      @path appointmentId: UUID,
      // V-SCH-003: cancellation reason is a required query param, min:5/max:500.
      @query @minLength(5) @maxLength(500) reason: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/{appointmentId}/check-in")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("checkInAppointment")
    checkIn(
      @path appointmentId: UUID
    ): ApiOkResponse<CheckInResponse>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;
  }
}
