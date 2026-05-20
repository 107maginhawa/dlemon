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

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

model DentalAppointment {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  patientId: UUID;
  dentistMemberId: UUID;
  branchId: UUID;
  scheduledAt: utcDateTime;
  durationMinutes: int32;
  serviceType: string;
  operatoryId?: UUID;
  walkIn: boolean;
  status: AppointmentStatus;
  checkInTime?: utcDateTime;
  visitId?: UUID;
  notes?: string;
  cancelledAt?: utcDateTime;
  cancellationReason?: string;
  no_showAt?: utcDateTime;
}

model CreateAppointmentRequest {
  patientId: UUID;
  dentistMemberId: UUID;
  branchId: UUID;
  scheduledAt: utcDateTime;
  durationMinutes: int32;
  serviceType: string;
  operatoryId?: UUID;
  walkIn?: boolean;
  notes?: string;
}

model UpdateAppointmentRequest {
  scheduledAt?: utcDateTime;
  durationMinutes?: int32;
  serviceType?: string;
  operatoryId?: UUID;
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
      @query branchId?: UUID,
      @query dentistMemberId?: UUID,
      @query date?: string,
      @query status?: AppointmentStatus
    ): ApiOkResponse<DentalAppointment[]>
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
      @path appointmentId: UUID
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
