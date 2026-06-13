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
  confirmed,
  checked_in,
  completed,
  cancelled,
  no_show,
}

// V-SCH-007: visit_type is a constrained enum (checkup/treatment/emergency/recall/hygiene),
// not free-text. Wire field name is `visitType` (camelCase per repo convention).
// E3: 'hygiene' marks a hygienist-led recall/prophy/perio appointment — on check-in it
// derives a hygiene-typed dental_visit, which is the only context where a hygienist may
// create/own a visit. All other service types derive a 'general' (dentist-led) visit.
enum VisitType {
  checkup,
  treatment,
  emergency,
  recall,
  hygiene,
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
  confirmedAt?: utcDateTime;
  // P1-24: how the appointment was confirmed — 'staff' | 'sms' | 'email' | 'link'.
  confirmedVia?: string;
  checkInTime?: utcDateTime;
  visitId?: UUID;
  notes?: string;
  cancelledAt?: utcDateTime;
  cancellationReason?: string;
  // V-SCH-006 (SCH-DRIFT-001): camelCase to match every other *At field and the
  // actual handler wire output (toWire emits `noShowAt`). Was authored as the
  // lone snake_case `no_showAt`, which drifted the SDK type away from the wire.
  noShowAt?: utcDateTime;
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
// P1-25: Online / self-service patient booking (public surface)
// ---------------------------------------------------------------------------

// Per-branch online-booking policy that drives the public booking form.
// Mirrors the `onlineBooking` block stored on dental_branch.settings.
model PublicBookingProvider {
  providerId: UUID;
  displayName: string;
}

model PublicBookingConfig {
  branchId: UUID;
  branchName: string;
  timezone: string;
  enabled: boolean;
  bookableVisitTypes: VisitType[];
  leadTimeMinutes: int32;
  horizonDays: int32;
  slotStepMinutes: int32;
  requirePatientAuth: boolean;
  providers: PublicBookingProvider[];
}

// A single computed open slot. Carries NO patient PII and no existing-appointment
// detail — only free/bookable windows (plan §3.1.6 PII boundary).
model PublicAvailabilitySlot {
  startAt: utcDateTime;
  endAt: utcDateTime;
  providerId: UUID;
  visitType: VisitType;
}

model PublicAvailabilityResponse {
  branchId: UUID;
  visitType: VisitType;
  slots: PublicAvailabilitySlot[];
}

@example(#{
  providerId: "m1a2b3c4-0000-4000-8000-000000000001",
  startAt: utcDateTime.fromISO("2026-03-15T09:00:00Z"),
  visitType: VisitType.checkup,
}, #{ title: "Hold a checkup slot" })
model CreateHoldRequest {
  providerId: UUID;
  startAt: utcDateTime;
  visitType: VisitType;
}

model HoldResponse {
  holdId: UUID;
  sessionToken: string;
  providerId: UUID;
  startAt: utcDateTime;
  endAt: utcDateTime;
  expiresAt: utcDateTime;
}

@example(#{
  providerId: "m1a2b3c4-0000-4000-8000-000000000001",
  startAt: utcDateTime.fromISO("2026-03-15T09:00:00Z"),
  visitType: VisitType.checkup,
  firstName: "Jordan",
  lastName: "Rivera",
  phone: "+15551234567",
  email: "jordan@example.com",
}, #{ title: "Book online (prospect)" })
model CreateOnlineBookingRequest {
  providerId: UUID;
  startAt: utcDateTime;
  visitType: VisitType;

  // Optional hold token (recommended path) — caps the read-then-write race.
  sessionToken?: string;

  @maxLength(120)
  firstName: string;

  @maxLength(120)
  lastName?: string;

  phone?: string;
  email?: string;
  dateOfBirth?: string;

  @maxLength(500)
  notes?: string;
}

model OnlineBookingResponse {
  confirmationCode: string;
  appointmentId: UUID;
  branchId: UUID;
  providerId: UUID;
  startAt: utcDateTime;
  endAt: utcDateTime;
  visitType: VisitType;
  status: AppointmentStatus;
}

model BookingLookupResponse {
  confirmationCode: string;
  branchId: UUID;
  branchName: string;
  providerName: string;
  startAt: utcDateTime;
  endAt: utcDateTime;
  visitType: VisitType;
  status: AppointmentStatus;
  confirmationState: string;
}

// P1-24: response for the public, token-gated patient self-confirm link.
// Carries no PII — only the appointment's new status + window.
model PublicConfirmResponse {
  appointmentId: UUID;
  status: AppointmentStatus;
  startAt: utcDateTime;
  endAt: utcDateTime;
  confirmedAt: utcDateTime;
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
      // V-SCH-003: cancellation reason (min:5/max:500) is validated IN THE HANDLER
      // so a missing/short reason yields the contract's 422 REASON_REQUIRED
      // (AC-SCH-004), not a generic 400 from the query validator. Kept optional at
      // the schema layer for that reason — do not re-add @minLength here.
      @query reason?: string
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

    // P1-24: staff confirm action — moves a scheduled appointment to `confirmed`
    // (sets confirmedVia='staff') and synchronously expires queued reminder rows.
    @post
    @route("/{appointmentId}/confirm")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("confirmAppointment")
    confirm(
      @path appointmentId: UUID
    ): ApiOkResponse<DentalAppointment>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;
  }

  // P1-25: public self-service booking surface. No bearer auth — these routes
  // are reachable unauthenticated and rely on per-branch online-booking config,
  // application-level rate-limiting, short-TTL holds, and a transactional final
  // overlap re-check. They write real `dental_appointment` rows in `scheduled`
  // status that flow through the existing check-in → visit lifecycle.
  interface PublicBookingManagement {
    @get
    @route("/branches/{branchId}/booking-config")
    @operationId("getPublicBookingConfig")
    getConfig(
      @path branchId: UUID
    ): ApiOkResponse<PublicBookingConfig>
      | ApiNotFoundResponse
      | ApiBadRequestResponse;

    @get
    @route("/branches/{branchId}/availability")
    @operationId("getPublicAvailability")
    availability(
      @path branchId: UUID,
      @query visitType: VisitType,
      @query("date_from") dateFrom: string,
      @query("date_to") dateTo: string,
      @query providerId?: UUID
    ): ApiOkResponse<PublicAvailabilityResponse>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiRateLimitResponse;

    @post
    @route("/branches/{branchId}/holds")
    @operationId("createBookingHold")
    createHold(
      @path branchId: UUID,
      @body body: CreateHoldRequest
    ): ApiCreatedResponse<HoldResponse>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiConflictResponse
      | ApiRateLimitResponse;

    @post
    @route("/branches/{branchId}/bookings")
    @operationId("createOnlineBooking")
    book(
      @path branchId: UUID,
      @body body: CreateOnlineBookingRequest
    ): ApiCreatedResponse<OnlineBookingResponse>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiConflictResponse
      | ApiRateLimitResponse;

    @get
    @route("/bookings/{confirmationCode}")
    @operationId("getOnlineBooking")
    lookup(
      @path confirmationCode: string
    ): ApiOkResponse<BookingLookupResponse>
      | ApiNotFoundResponse
      | ApiBadRequestResponse;

    // P1-24: public, token-gated patient self-confirm. No auth; the single-use
    // `confirmationToken` (random UUID embedded in the reminder link) is the
    // bearer. Valid + unconfirmed → confirmed (confirmedVia='link'); reused or
    // unknown token → 404. Rate-limited.
    @post
    @route("/appointments/{appointmentId}/confirm/{token}")
    @operationId("confirmAppointmentByToken")
    confirmByToken(
      @path appointmentId: UUID,
      @path token: UUID
    ): ApiOkResponse<PublicConfirmResponse>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiRateLimitResponse;
  }
}
