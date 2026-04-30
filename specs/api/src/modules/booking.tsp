import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";
import "./person.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Booking Module - Flexible event scheduling system
 *
 * Provides event booking functionality with discovery,
 * schedule management, and booking lifecycle management.
 */

// ============================================================================
// DATA MODELS
// ============================================================================

/**
 * Form field types
 */
@doc("Form field types")
enum FormFieldType {
  @doc("Single-line text input")
  text: "text",

  @doc("Multi-line text area")
  textarea: "textarea",

  @doc("Email input")
  email: "email",

  @doc("Phone number input")
  phone: "phone",

  @doc("Number input")
  number: "number",

  @doc("Date picker")
  date: "date",

  @doc("Date and time picker")
  datetime: "datetime",

  @doc("URL input")
  url: "url",

  @doc("Single-select dropdown")
  select: "select",

  @doc("Multi-select dropdown")
  multiselect: "multiselect",

  @doc("Checkbox input")
  checkbox: "checkbox",

  @doc("Display-only text (no input)")
  display: "display",
}

/**
 * Option for select/multiselect fields
 */
@doc("Option for select/multiselect fields")
model FormFieldOption {
  @doc("Display label")
  label: string;

  @doc("Option value")
  value: string;
}

/**
 * Validation rules for form fields
 */
@doc("Validation rules for form fields")
model FormFieldValidation {
  @doc("Minimum string length")
  minLength?: int32;

  @doc("Maximum string length")
  maxLength?: int32;

  @doc("Minimum value (numeric for number fields, date string for date fields)")
  min?: float64 | string;

  @doc("Maximum value (numeric for number fields, date string for date fields)")
  max?: float64 | string;

  @doc("Regex pattern for validation")
  pattern?: string;
}

/**
 * Form configuration structure
 */
@doc("Configuration for booking forms")
model FormConfig {
  @doc("Form fields configuration")
  fields?: FormFieldConfig[];
}

/**
 * Individual form field configuration
 */
@doc("Form field configuration")
model FormFieldConfig {
  @doc("Field name/identifier")
  name: string;

  @doc("Field type")
  type: FormFieldType;

  @doc("Field label")
  label: string;

  @doc("Whether field is required")
  required?: boolean;

  @doc("Field options for select/multiselect (required for select/multiselect types)")
  options?: FormFieldOption[];

  @doc("Validation rules")
  validation?: FormFieldValidation;

  @doc("Placeholder text")
  placeholder?: string;

  @doc("Help text")
  helpText?: string;
}

/**
 * Billing configuration for events
 */
@doc("Billing configuration for booking events")
model BillingConfig {
  @doc("Price for the event in cents")
  price: CurrencyAmount;

  @doc("Currency code (e.g., 'CAD', 'USD')")
  currency: string;

  @doc("Free cancellation threshold in minutes before event")
  @minValue(0)
  @maxValue(10080) // 7 days max
  cancellationThresholdMinutes: int32;
}

// ============================================================================
// CORE MODELS
// ============================================================================

/**
 * Booking event with configurable availability schedule
 */
@doc("Booking event with configurable availability schedule")
model BookingEvent extends BaseEntity {
  @doc("Event owner (provider, organization, etc.)")
  @extension("x-expandable-field", #{ opId: "getPerson" })
  owner: string | Person;

  @doc("Optional context for domain associations")
  context?: string;

  @doc("Event title")
  title: string;

  @doc("Event description")
  description?: string;

  @doc("Searchable keywords for discovery (e.g., 'therapy', 'massage', 'counseling')")
  keywords?: string[];

  @doc("Category tags for filtering (e.g., 'wellness', 'mental-health', 'fitness')")
  tags?: string[];

  @doc("Event timezone")
  timezone: string;

  @doc("Available location types for this event")
  locationTypes: LocationType[];

  @doc("Maximum days in advance clients can book")
  @minValue(0)
  @maxValue(365)
  maxBookingDays: int32;

  @doc("Minimum minutes advance notice required")
  @minValue(0)
  @maxValue(4320) // 72 hours max
  minBookingMinutes: int32;

  @doc("Optional form configuration")
  formConfig?: FormConfig;

  @doc("Optional billing configuration")
  billingConfig?: BillingConfig;

  @doc("Event status")
  status: BookingEventStatus;

  @doc("Schedule effective from date and time")
  effectiveFrom: utcDateTime;

  @doc("Schedule effective to date and time (optional)")
  effectiveTo?: utcDateTime;

  @doc("Daily configurations mapped by day name (sun, mon, tue, wed, thu, fri, sat)")
  dailyConfigs: Record<DailyConfig>;
}

@doc("Daily configuration within a weekly schedule")
model DailyConfig {
  @doc("Whether this day is enabled")
  enabled: boolean;

  @doc("Time blocks for this day")
  timeBlocks: TimeBlock[];
}

@doc("Time block representing a work period within a day")
model TimeBlock {
  @doc("Start time (HH:MM format)")
  @pattern("^([01]\\d|2[0-3]):[0-5]\\d$")
  startTime: string;

  @doc("End time (HH:MM format)")
  @pattern("^([01]\\d|2[0-3]):[0-5]\\d$")
  endTime: string;

  @doc("Booking duration in minutes for this block")
  @minValue(15)
  @maxValue(480)
  slotDuration?: int32 = 30;

  @doc("Buffer time between bookings in minutes")
  @minValue(0)
  @maxValue(120)
  bufferTime?: int32 = 0;
}

@doc("Individual bookable time slots generated from booking events")
model TimeSlot extends BaseEntity {
  @doc("Unique slot identifier")
  id: UUID;

  @doc("Slot owner (inherited from event)")
  owner: UUID;

  @doc("Source booking event")
  @extension("x-expandable-field", #{ opId: "getBookingEvent" })
  event: string | BookingEvent;

  @doc("Optional context (inherited from event)")
  context?: string;

  @doc("Slot start time (UTC)")
  startTime: utcDateTime;

  @doc("Slot end time (UTC)")
  endTime: utcDateTime;

  @doc("Available location types for this slot")
  locationTypes: LocationType[];

  @doc("Slot availability status")
  status: SlotStatus;

  @doc("Optional billing configuration for this specific slot (overrides event billingConfig)")
  billingConfig?: BillingConfig;

  @doc("Linked booking if booked")
  booking?: UUID;
}

@doc("Booking between client and provider")
model Booking extends BaseEntity {
  @doc("Client user ID (person.id)")
  @extension("x-expandable-field", #{ opId: "getPerson" })
  client: string | Person;

  @doc("Provider user ID (person.id)")
  @extension("x-expandable-field", #{ opId: "getPerson" })
  provider: string | Person;

  @doc("Time slot")
  @extension("x-expandable-field", #{ opId: "getTimeSlot" })
  slot: string | TimeSlot;

  @doc("Selected location type")
  locationType: LocationType;

  @doc("Booking reason")
  @maxLength(500)
  reason: string;

  @doc("Booking status")
  status: BookingStatus;

  @doc("When booking was created (UTC)")
  bookedAt: utcDateTime;

  @doc("When provider confirmed (UTC)")
  confirmationTimestamp?: utcDateTime;

  @doc("Scheduled booking date/time (UTC)")
  scheduledAt: utcDateTime;

  @doc("Booking duration in minutes")
  @minValue(15)
  @maxValue(480)
  durationMinutes: int32;

  @doc("Cancellation reason if cancelled")
  cancellationReason?: string;

  @doc("Who cancelled the booking")
  cancelledBy?: string;

  @doc("When cancelled (UTC)")
  cancelledAt?: utcDateTime;

  @doc("Who marked no-show")
  noShowMarkedBy?: string;

  @doc("When no-show was marked (UTC)")
  noShowMarkedAt?: utcDateTime;

  @doc("Client's booking form responses")
  formResponses?: FormResponses;

  @doc("Reference to billing invoice if payment required")
  invoice?: UUID;
}

@doc("Event-specific blocked time periods")
model ScheduleException extends BaseEntity {
  @doc("Booking event")
  event: UUID;

  @doc("Exception owner (inherited from event)")
  owner: UUID;

  @doc("Optional context (inherited from event)")
  context?: string;

  @doc("Exception timezone (can differ from event timezone)")
  timezone: string;

  @doc("Block start date/time (UTC)")
  startDatetime: utcDateTime;

  @doc("Block end date/time (UTC)")
  endDatetime: utcDateTime;

  @doc("Reason for blocking")
  @maxLength(500)
  reason: string;

  @doc("Whether this exception repeats")
  recurring: boolean;

  @doc("Recurrence pattern if recurring")
  recurrencePattern?: RecurrencePattern;
}

/**
 * Recurrence pattern for schedule exceptions
 */
@doc("Recurrence pattern for schedule exceptions")
model RecurrencePattern {
  @doc("Recurrence type")
  type: RecurrenceType;

  @doc("Interval between recurrences")
  @minValue(1)
  interval?: int32 = 1;

  @doc("Days of week for weekly recurrence (0=Sunday, 6=Saturday)")
  daysOfWeek?: int32[];

  @doc("Day of month for monthly recurrence")
  @minValue(1)
  @maxValue(31)
  dayOfMonth?: int32;

  @doc("Month of year for yearly recurrence (1-12)")
  @minValue(1)
  @maxValue(12)
  monthOfYear?: int32;

  @doc("End date for recurrence")
  endDate?: plainDate;

  @doc("Maximum number of occurrences")
  @minValue(1)
  maxOccurrences?: int32;
}

// ============================================================================
// ENUMS
// ============================================================================

@doc("Booking event status")
enum BookingEventStatus {
  @doc("Event is in draft state")
  draft: "draft",

  @doc("Event is active and accepting bookings")
  active: "active",

  @doc("Event is temporarily paused")
  paused: "paused",

  @doc("Event is archived")
  archived: "archived",
}

@doc("Booking status throughout lifecycle")
enum BookingStatus {
  @doc("Booking pending provider confirmation")
  pending: "pending",

  @doc("Booking confirmed by provider")
  confirmed: "confirmed",

  @doc("Booking rejected by provider")
  rejected: "rejected",

  @doc("Booking cancelled")
  cancelled: "cancelled",

  @doc("Booking completed")
  completed: "completed",

  @doc("Client marked as no-show")
  no_show_client: "no_show_client",

  @doc("Provider marked as no-show")
  no_show_provider: "no_show_provider",
}

@doc("Time slot availability status")
enum SlotStatus {
  @doc("Slot is available for booking")
  available: "available",

  @doc("Slot is booked")
  booked: "booked",

  @doc("Slot is blocked")
  blocked: "blocked",
}

@doc("Location types for bookings")
enum LocationType {
  @doc("Video call")
  video: "video",

  @doc("Phone call")
  phone: "phone",

  @doc("In-person meeting")
  `in-person`: "in-person",
}


@doc("Recurrence type for schedule exceptions")
enum RecurrenceType {
  @doc("Daily recurrence")
  daily: "daily",

  @doc("Weekly recurrence")
  weekly: "weekly",

  @doc("Monthly recurrence")
  monthly: "monthly",

  @doc("Yearly recurrence")
  yearly: "yearly",
}

// ============================================================================
// REQUEST MODELS
// ============================================================================

@doc("Create booking event request")
model BookingEventCreateRequest {
  @doc("Event title")
  title: string;

  @doc("Event description")
  description?: string;

  @doc("Searchable keywords for discovery")
  keywords?: string[];

  @doc("Category tags for filtering")
  tags?: string[];

  @doc("Optional context for domain associations")
  context?: string;

  @doc("Event timezone (default: 'America/New_York')")
  timezone?: string;

  @doc("Available location types (default: all types)")
  locationTypes?: LocationType[];

  @doc("Maximum booking days (default: 30)")
  @minValue(0)
  @maxValue(365)
  maxBookingDays?: int32;

  @doc("Minimum booking minutes (default: 1440 - 24 hours)")
  @minValue(0)
  @maxValue(4320)
  minBookingMinutes?: int32;

  @doc("Optional form configuration")
  formConfig?: FormConfig;

  @doc("Optional billing configuration")
  billingConfig?: BillingConfig;

  @doc("Event status (default: 'active')")
  status?: BookingEventStatus;

  @doc("Schedule effective from date (default: today)")
  effectiveFrom?: utcDateTime;

  @doc("Schedule effective to date")
  effectiveTo?: utcDateTime;

  @doc("Daily configurations mapped by day of week")
  dailyConfigs: Record<DailyConfig>;
}

@doc("Update booking event request")
model BookingEventUpdateRequest {
  @doc("Event title")
  title?: string;

  @doc("Event description - can be null to clear")
  description?: string | null;

  @doc("Searchable keywords for discovery - can be null to clear")
  keywords?: string[] | null;

  @doc("Category tags for filtering - can be null to clear")
  tags?: string[] | null;

  @doc("Event timezone")
  timezone?: string;

  @doc("Available location types")
  locationTypes?: LocationType[];

  @doc("Maximum booking days")
  maxBookingDays?: int32;

  @doc("Minimum booking minutes")
  minBookingMinutes?: int32;

  @doc("Optional form configuration - can be null to clear")
  formConfig?: FormConfig | null;

  @doc("Optional billing configuration - can be null to clear")
  billingConfig?: BillingConfig | null;

  @doc("Event status")
  status?: BookingEventStatus;

  @doc("Schedule effective to date - can be null to clear")
  effectiveTo?: utcDateTime | null;

  @doc("Daily configurations (partial update supported)")
  dailyConfigs?: Record<DailyConfig>;
}

@doc("Create schedule exception request")
model ScheduleExceptionCreateRequest {
  @doc("Exception timezone (defaults to event timezone if not specified)")
  timezone?: string;

  @doc("Block start date/time")
  startDatetime: utcDateTime;

  @doc("Block end date/time")
  endDatetime: utcDateTime;

  @doc("Reason for blocking")
  @maxLength(500)
  reason: string;

  @doc("Whether this exception repeats")
  recurring?: boolean;

  @doc("Recurrence pattern")
  recurrencePattern?: RecurrencePattern;
}

@doc("Form response data for booking creation")
model FormResponseData {
  @doc("Form field responses")
  data: Record<unknown>;
}

@doc("Complete form responses metadata")
model FormResponseMetaData {
  @doc("When the form was submitted")
  submittedAt?: utcDateTime;

  @doc("Time taken to complete the form in seconds")
  completionTimeSeconds?: int32;

  @doc("Client IP address")
  ipAddress?: string;
}

@doc("Complete form responses with metadata")
model FormResponses {
  @doc("Form field responses")
  data: Record<unknown>;

  @doc("Submission metadata (system-generated)")
  metadata?: FormResponseMetaData;
}

@doc("Create booking request")
model BookingCreateRequest {
  @doc("Time slot (required)")
  slot: UUID;

  @doc("Selected location type (optional - defaults to slot's first locationType)")
  locationType?: LocationType;

  @doc("Visit reason (optional)")
  @maxLength(500)
  reason?: string;

  @doc("Form responses (optional)")
  formResponses?: FormResponseData;
}

@doc("Booking action request")
model BookingActionRequest {
  @doc("Action reason - required for audit trail")
  @maxLength(500)
  reason: string;
}

// ============================================================================
// API INTERFACES
// ============================================================================

@route("/booking")
namespace BookingModule {
  /**
   * Booking Event Management
   * Handles booking event availability schedules with atomic operations.
   */
  interface BookingEventManagement {
    @doc("List booking events. Public endpoint with optional authentication for personalization.")
    @operationId("listBookingEvents")
    @get
    @useAuth(bearerAuth | Http.NoAuth)
    @route("/events")
    listBookingEvents(
      @doc("Filter by event owner (person ID)")
      @query owner?: UUID,
      @doc("Filter by context")
      @query context?: string,
      @doc("Filter by location type")
      @query locationType?: LocationType,
      @doc("Filter by event status")
      @query status?: BookingEventStatus,
      @doc("Filter by availability start time (UTC, ISO 8601 format)")
      @query availableFrom?: utcDateTime,
      @doc("Filter by availability end time (UTC, ISO 8601 format)")
      @query availableTo?: utcDateTime,
      @doc("Filter by tags. Supports OR filtering (comma-separated: 'tag1,tag2') or AND filtering (repeated parameter: ?tags=tag1&tags=tag2)")
      @query tags?: string | string[],
      ...ExpandParams,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<BookingEvent>>
      | ApiBadRequestResponse;

    @doc("Create booking event. Owner is automatically set to the authenticated user.")
    @operationId("createBookingEvent")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @route("/events")
    createBookingEvent(
      @body request: BookingEventCreateRequest
    ): ApiCreatedResponse<BookingEvent>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get booking event. Optional authentication - supports 'me' parameter when authenticated.")
    @operationId("getBookingEvent")
    @get
    @useAuth(bearerAuth | Http.NoAuth)
    @route("/events/{event}")
    getBookingEvent(
      @path event: UUID | "me",
      ...ExpandParams
    ): ApiOkResponse<BookingEvent>
      | ApiNotFoundResponse;

    @doc("List available time slots for a booking event. Default: available slots from now to +7 days.")
    @operationId("listEventSlots")
    @get
    @useAuth(bearerAuth | Http.NoAuth)
    @route("/events/{event}/slots")
    listEventSlots(
      @path event: UUID,
      @query startTime?: utcDateTime,
      @query endTime?: utcDateTime,
      @query status?: SlotStatus
    ): ApiOkResponse<TimeSlot[]>
      | ApiNotFoundResponse;

    @doc("Update booking event (partial updates supported).")
    @operationId("updateBookingEvent")
    @patch(#{implicitOptionality: true})
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["event:owner", "admin"])
    @route("/events/{event}")
    updateBookingEvent(
      @path event: UUID,
      @body request: BookingEventUpdateRequest
    ): ApiOkResponse<BookingEvent>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete booking event.")
    @operationId("deleteBookingEvent")
    @delete
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["event:owner", "admin"])
    @route("/events/{event}")
    deleteBookingEvent(
      @path event: UUID
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * Schedule Exception Management
   * Handles blocking and unblocking of time periods for events.
   */
  interface ScheduleExceptionManagement {
    @doc("Create schedule exception (block time).")
    @operationId("createScheduleException")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["event:owner", "admin"])
    @route("/events/{event}/exceptions")
    createScheduleException(
      @path event: UUID,
      @body request: ScheduleExceptionCreateRequest
    ): ApiCreatedResponse<ScheduleException>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List schedule exceptions.")
    @operationId("listScheduleExceptions")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["event:owner", "admin", "support"])
    @route("/events/{event}/exceptions")
    listScheduleExceptions(
      @path event: UUID,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<ScheduleException>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Get schedule exception.")
    @operationId("getScheduleException")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["event:owner", "admin", "support"])
    @route("/events/{event}/exceptions/{exception}")
    getScheduleException(
      @path event: UUID,
      @path exception: UUID
    ): ApiOkResponse<ScheduleException>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete schedule exception.")
    @operationId("deleteScheduleException")
    @delete
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["event:owner", "admin"])
    @route("/events/{event}/exceptions/{exception}")
    deleteScheduleException(
      @path event: UUID,
      @path exception: UUID
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * Slot Discovery (Public)
   * Public endpoints for viewing slot availability.
   */
  interface SlotDiscovery {
    @doc("Get individual time slot details. Public endpoint with optional authentication.")
    @operationId("getTimeSlot")
    @get
    @useAuth([bearerAuth, Http.NoAuth])
    @route("/slots/{slotId}")
    getTimeSlot(
      @path slotId: UUID,
      ...ExpandParams
    ): ApiOkResponse<TimeSlot>
      | ApiNotFoundResponse;
  }

  /**
   * Booking Management
   * Handles booking creation, confirmation, cancellation, and lifecycle.
   */
  interface BookingManagement {
    @doc("Create booking.")
    @operationId("createBooking")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @route("/bookings")
    createBooking(
      @body request: BookingCreateRequest
    ): ApiCreatedResponse<Booking>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiConflictResponse;

    @doc("List bookings with role-based filtering. Both client and provider filters use user IDs (person.id).")
    @operationId("listBookings")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["client:owner", "provider:owner", "admin", "support"])
    @route("/bookings")
    listBookings(
      @doc("Filter by provider user ID (person.id)")
      @query provider?: UUID,
      @doc("Filter by client user ID (person.id)")
      @query client?: UUID,
      @doc("Filter by booking status (pending, confirmed, cancelled, completed, etc.)")
      @query status?: BookingStatus,
      @doc("Start date for filtering bookings (inclusive)")
      @query startDate?: utcDateTime,
      @doc("End date for filtering bookings (inclusive)")
      @query endDate?: utcDateTime,
      ...ExpandParams,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<Booking>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get booking details. Role-based access control.")
    @operationId("getBooking")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["client:owner", "provider:owner", "admin", "support"])
    @route("/bookings/{booking}")
    getBooking(
      @path booking: UUID,
      ...ExpandParams
    ): ApiOkResponse<Booking>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Confirm booking.")
    @operationId("confirmBooking")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["provider:owner", "admin"])
    @route("/bookings/{booking}/confirm")
    confirmBooking(
      @path booking: UUID,
      @body request: BookingActionRequest
    ): ApiOkResponse<Booking>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Reject booking.")
    @operationId("rejectBooking")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["provider:owner", "admin"])
    @route("/bookings/{booking}/reject")
    rejectBooking(
      @path booking: UUID,
      @body request: BookingActionRequest
    ): ApiOkResponse<Booking>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Cancel booking. Mutual cancellation rights.")
    @operationId("cancelBooking")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["client:owner", "provider:owner", "admin"])
    @route("/bookings/{booking}/cancel")
    cancelBooking(
      @path booking: UUID,
      @body request: BookingActionRequest
    ): ApiOkResponse<Booking>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Mark no-show booking. Both parties can mark each other as no-show.")
    @operationId("markNoShowBooking")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["client:owner", "provider:owner", "admin"])
    @route("/bookings/{booking}/no-show")
    markNoShowBooking(
      @path booking: UUID,
      @body request: BookingActionRequest
    ): ApiOkResponse<Booking>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

  }

}
