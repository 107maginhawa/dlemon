import { apiGet, apiPost, apiPatch, ApiError, type PaginatedResponse } from '../api'
import { sanitizeObject } from '../utils/api'
import { formatDate } from '../utils/format'
import type { components } from '@monobase/api-spec/types'

// ============================================================================
// Booking Types
// ============================================================================

/**
 * Time block within a daily schedule
 */
export interface TimeBlock {
  startTime: string    // HH:MM format (e.g., "09:00")
  endTime: string      // HH:MM format (e.g., "17:00")
  slotDuration?: number // minutes (default: 30)
  bufferTime?: number   // minutes (default: 0)
}

/**
 * Daily configuration for a specific day of the week
 */
export interface DailyConfig {
  enabled: boolean
  timeBlocks: TimeBlock[]
}

/**
 * Form field configuration for booking forms
 */
export interface FormFieldConfig {
  name: string
  type: 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'date' | 'datetime' | 'url' | 'select' | 'multiselect' | 'checkbox' | 'display'
  label: string
  required?: boolean
  options?: Array<{ label: string; value: string }>
  validation?: {
    minLength?: number
    maxLength?: number
    min?: number | string
    max?: number | string
    pattern?: string
  }
  placeholder?: string
  helpText?: string
}

/**
 * Form configuration for a booking event
 */
export interface FormConfig {
  fields?: FormFieldConfig[]
}

/**
 * Time slot offered by a host
 */
export interface BookingTimeSlot {
  id: string
  hostId: string
  date: Date
  startTime: Date
  endTime: Date
  status: 'available' | 'booked' | 'blocked'
  locationTypes: ('video' | 'phone' | 'in-person')[]
  price: number
  billingOverride?: {
    price?: number
    currency?: string
    paymentRequired?: boolean
    freeCancellationMinutes?: number
  }
}

/**
 * Public host information shown alongside a booking event.
 * A host is any person publishing availability — coach, consultant, advisor,
 * trainer, mechanic, instructor, etc.
 */
export interface BookingHost {
  id: string
  name: string
  email?: string
  avatar?: string
  bio?: string
  city?: string
  state?: string
  languages?: string[]
}

/**
 * Booking event - defines a host's availability and booking configuration
 */
export interface BookingEvent {
  // BaseEntity fields
  id: string
  version: number
  createdAt: Date
  updatedAt: Date
  createdBy?: string
  updatedBy?: string

  // BookingEvent fields
  owner: string  // person ID
  context?: string
  title: string
  description?: string
  keywords?: string[]
  tags?: string[]
  timezone: string
  locationTypes: ('video' | 'phone' | 'in-person')[]
  maxBookingDays: number
  minBookingMinutes: number
  formConfig?: FormConfig
  billingConfig?: {
    price: number
    currency: string
    cancellationThresholdMinutes: number
  }
  status: 'draft' | 'active' | 'paused' | 'archived'
  effectiveFrom: Date
  effectiveTo?: Date
  dailyConfigs: Record<string, DailyConfig>  // Keys: "sun", "mon", "tue", "wed", "thu", "fri", "sat"
}

export interface HostWithSlots {
  host: BookingHost
  slots: BookingTimeSlot[]
  event?: BookingEvent
}

export type BookingEventData = BookingEvent

export interface Booking {
  id: string
  version: number
  createdAt: Date
  createdBy?: string
  updatedAt: Date
  updatedBy?: string
  client: string
  host: string
  slot: string
  locationType: 'video' | 'phone' | 'in-person'
  reason: string
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed' | 'no_show_client' | 'no_show_host'
  bookedAt: Date
  confirmationTimestamp?: Date
  scheduledAt: Date
  durationMinutes: number
  cancellationReason?: string
  cancelledBy?: string
  cancelledAt?: Date
  noShowMarkedBy?: string
  noShowMarkedAt?: Date
  formResponses?: {
    data: Record<string, any>
    metadata?: {
      submittedAt?: Date
      completionTimeSeconds?: number
      ipAddress?: string
    }
  }
  invoice?: string
}

export type Appointment = Booking
export type LocationType = Booking['locationType']
export type AppointmentStatus = Booking['status']

// ============================================================================
// API Type Aliases
// ============================================================================

type ApiPerson = components["schemas"]["Person"]
type ApiBooking = components["schemas"]["Booking"]
type ApiTimeSlot = components["schemas"]["TimeSlot"]
type ApiBookingEvent = components["schemas"]["BookingEvent"]

// ============================================================================
// Mapper Functions
// ============================================================================

/**
 * Convert API TimeSlot to a frontend BookingTimeSlot with Date objects
 */
function mapApiTimeSlotToFrontend(apiSlot: ApiTimeSlot): BookingTimeSlot {
  const startTime = new Date(apiSlot.startTime)
  const endTime = new Date(apiSlot.endTime)

  return {
    id: apiSlot.id,
    hostId: apiSlot.owner,
    date: startTime,
    startTime,
    endTime,
    status: apiSlot.status as 'available' | 'booked' | 'blocked',
    locationTypes: apiSlot.locationTypes as ('video' | 'phone' | 'in-person')[],
    price: apiSlot.billingConfig?.price || 0,
    billingOverride: apiSlot.billingConfig ? {
      price: apiSlot.billingConfig.price,
      currency: apiSlot.billingConfig.currency,
      paymentRequired: true,
      freeCancellationMinutes: apiSlot.billingConfig.cancellationThresholdMinutes,
    } : undefined,
  }
}

/**
 * Convert API Person to a frontend BookingHost.
 */
function mapApiPersonToHost(apiPerson: ApiPerson): BookingHost {
  return {
    id: apiPerson.id,
    name: `${apiPerson.firstName} ${apiPerson.lastName || ''}`.trim(),
    email: apiPerson.contactInfo?.email,
    avatar: apiPerson.avatar?.url,
    city: apiPerson.primaryAddress?.city,
    state: apiPerson.primaryAddress?.state,
    languages: apiPerson.languagesSpoken,
  }
}

/**
 * Convert API BookingEvent to frontend BookingEvent
 */
function mapApiBookingEventToFrontend(apiEvent: ApiBookingEvent): BookingEvent {
  return {
    id: apiEvent.id,
    version: apiEvent.version,
    createdAt: new Date(apiEvent.createdAt),
    updatedAt: new Date(apiEvent.updatedAt),
    createdBy: apiEvent.createdBy,
    updatedBy: apiEvent.updatedBy,
    owner: typeof apiEvent.owner === 'string' ? apiEvent.owner : apiEvent.owner.id,
    context: apiEvent.context,
    title: apiEvent.title,
    description: apiEvent.description,
    keywords: apiEvent.keywords,
    tags: apiEvent.tags,
    timezone: apiEvent.timezone,
    locationTypes: apiEvent.locationTypes as ('video' | 'phone' | 'in-person')[],
    maxBookingDays: apiEvent.maxBookingDays,
    minBookingMinutes: apiEvent.minBookingMinutes,
    formConfig: apiEvent.formConfig,
    billingConfig: apiEvent.billingConfig,
    status: apiEvent.status as 'draft' | 'active' | 'paused' | 'archived',
    effectiveFrom: new Date(apiEvent.effectiveFrom),
    effectiveTo: apiEvent.effectiveTo ? new Date(apiEvent.effectiveTo) : undefined,
    dailyConfigs: apiEvent.dailyConfigs as Record<string, DailyConfig>,
  }
}

/**
 * Convert API Booking to frontend Booking with Date objects.
 *
 * The API still names the host-side foreign key `provider` for historical
 * reasons; the SDK exposes it as `host` to keep the surface vertical-neutral.
 */
function mapApiBookingToFrontend(apiBooking: ApiBooking): Booking {
  const apiHost = (apiBooking as unknown as { provider?: string | { id: string }; host?: string | { id: string } })
  const hostRef = apiHost.host ?? apiHost.provider
  const hostId = typeof hostRef === 'string' ? hostRef : hostRef?.id ?? ''
  return {
    id: apiBooking.id,
    version: apiBooking.version,
    createdAt: new Date(apiBooking.createdAt),
    createdBy: apiBooking.createdBy,
    updatedAt: new Date(apiBooking.updatedAt),
    updatedBy: apiBooking.updatedBy,
    client: typeof apiBooking.client === 'string' ? apiBooking.client : apiBooking.client.id,
    host: hostId,
    slot: typeof apiBooking.slot === 'string' ? apiBooking.slot : apiBooking.slot.id,
    locationType: apiBooking.locationType,
    reason: apiBooking.reason,
    status: apiBooking.status as Booking['status'],
    bookedAt: new Date(apiBooking.bookedAt),
    confirmationTimestamp: apiBooking.confirmationTimestamp ? new Date(apiBooking.confirmationTimestamp) : undefined,
    scheduledAt: new Date(apiBooking.scheduledAt),
    durationMinutes: apiBooking.durationMinutes,
    cancellationReason: apiBooking.cancellationReason,
    cancelledBy: apiBooking.cancelledBy,
    cancelledAt: apiBooking.cancelledAt ? new Date(apiBooking.cancelledAt) : undefined,
    noShowMarkedBy: apiBooking.noShowMarkedBy,
    noShowMarkedAt: apiBooking.noShowMarkedAt ? new Date(apiBooking.noShowMarkedAt) : undefined,
    formResponses: apiBooking.formResponses ? {
      data: apiBooking.formResponses.data,
      metadata: apiBooking.formResponses.metadata ? {
        submittedAt: apiBooking.formResponses.metadata.submittedAt ? new Date(apiBooking.formResponses.metadata.submittedAt) : undefined,
        completionTimeSeconds: apiBooking.formResponses.metadata.completionTimeSeconds,
        ipAddress: apiBooking.formResponses.metadata.ipAddress,
      } : undefined,
    } : undefined,
    invoice: apiBooking.invoice,
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * List booking events with filters
 */
export interface ListBookingEventsParams {
  owner?: string
  context?: string
  locationType?: 'video' | 'phone' | 'in-person'
  status?: 'draft' | 'active' | 'paused' | 'archived'
  availableFrom?: Date
  availableTo?: Date
  tags?: string[]
  offset?: number
  limit?: number
}

export async function listBookingEvents(params?: ListBookingEventsParams): Promise<PaginatedResponse<BookingEvent>> {
  const queryParams = sanitizeObject({
    owner: params?.owner,
    context: params?.context,
    locationType: params?.locationType,
    status: params?.status,
    availableFrom: params?.availableFrom ? formatDate(params.availableFrom, { format: 'iso' }) : undefined,
    availableTo: params?.availableTo ? formatDate(params.availableTo, { format: 'iso' }) : undefined,
    tags: params?.tags?.join(','),
    offset: params?.offset,
    limit: params?.limit,
  }, { nullable: [] })

  const response = await apiGet<PaginatedResponse<ApiBookingEvent>>('/booking/events', queryParams)

  return {
    data: response.data.map(mapApiBookingEventToFrontend),
    pagination: response.pagination,
  }
}

/**
 * Get a single booking event by ID
 */
export async function getBookingEvent(eventId: string, params?: { expand?: string }): Promise<BookingEvent> {
  const queryParams = sanitizeObject({
    expand: params?.expand,
  }, { nullable: [] })

  const response = await apiGet<ApiBookingEvent>(`/booking/events/${eventId}`, queryParams)
  return mapApiBookingEventToFrontend(response)
}

/**
 * Search params for host discovery via the booking event endpoint.
 */
export interface SearchHostsParams {
  q?: string
  location?: string
  language?: string
  availableFrom?: Date
  availableTo?: Date
  offset?: number
  limit?: number
}

// ============================================================================
// Host's own booking event management
// ============================================================================

/**
 * Get the caller's own booking event configuration
 */
export async function getMyBookingEvent(): Promise<BookingEvent | null> {
  try {
    const response = await apiGet<ApiBookingEvent>('/booking/events/me')
    return mapApiBookingEventToFrontend(response)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Request data for creating a booking event
 */
export interface CreateBookingEventData {
  title: string
  description?: string
  keywords?: string[]
  tags?: string[]
  context?: string
  timezone?: string
  locationTypes?: ('video' | 'phone' | 'in-person')[]
  maxBookingDays?: number
  minBookingMinutes?: number
  formConfig?: FormConfig
  billingConfig?: {
    price: number
    currency: string
    cancellationThresholdMinutes: number
  }
  status?: 'draft' | 'active' | 'paused' | 'archived'
  effectiveFrom?: string  // ISO date string
  effectiveTo?: string    // ISO date string
  dailyConfigs: Record<string, DailyConfig>
}

/**
 * Create a new booking event.
 * POST /booking/events
 */
export async function createBookingEvent(data: CreateBookingEventData): Promise<BookingEvent> {
  const sanitized = sanitizeObject(data, { nullable: [] })
  const response = await apiPost<ApiBookingEvent>('/booking/events', sanitized)
  return mapApiBookingEventToFrontend(response)
}

/**
 * Update an existing booking event.
 * PATCH /booking/events/{event}
 */
export async function updateBookingEvent(
  eventId: string,
  data: Partial<CreateBookingEventData>
): Promise<BookingEvent> {
  const sanitized = sanitizeObject(data, {
    nullable: ['description', 'keywords', 'tags', 'formConfig', 'billingConfig', 'effectiveTo']
  })
  const response = await apiPatch<ApiBookingEvent>(`/booking/events/${eventId}`, sanitized)
  return mapApiBookingEventToFrontend(response)
}

/**
 * Get the caller's own availability slots
 */
export interface GetAvailabilityParams {
  startDate?: Date
  endDate?: Date
  status?: 'available' | 'booked' | 'blocked'
  limit?: number
  offset?: number
}

export async function getMyAvailability(params?: GetAvailabilityParams): Promise<PaginatedResponse<BookingTimeSlot>> {
  const queryParams = sanitizeObject({
    startDate: params?.startDate ? formatDate(params.startDate, { format: 'iso' }) : undefined,
    endDate: params?.endDate ? formatDate(params.endDate, { format: 'iso' }) : undefined,
    status: params?.status,
    limit: params?.limit,
    offset: params?.offset,
  }, { nullable: [] })

  const response = await apiGet<PaginatedResponse<ApiTimeSlot>>('/booking/availability/me', queryParams)

  return {
    data: response.data.map(mapApiTimeSlotToFrontend),
    pagination: response.pagination,
  }
}

/**
 * Create an availability slot
 */
export async function createAvailabilitySlot(data: {
  date: Date
  startTime: Date
  endTime: Date
  locationTypes: ('video' | 'phone' | 'in-person')[]
  price?: number
  currency?: string
}): Promise<BookingTimeSlot> {
  const sanitized = sanitizeObject({
    startTime: data.startTime.toISOString(),
    endTime: data.endTime.toISOString(),
    locationTypes: data.locationTypes,
    billingConfig: data.price ? {
      price: data.price,
      currency: data.currency || 'USD',
      cancellationThresholdMinutes: 24 * 60,
    } : undefined,
  }, { nullable: [] })
  const response = await apiPost<ApiTimeSlot>('/booking/availability', sanitized)
  return mapApiTimeSlotToFrontend(response)
}

/**
 * Update an availability slot
 */
export async function updateAvailabilitySlot(
  slotId: string,
  data: Partial<{
    startTime: Date
    endTime: Date
    locationTypes: ('video' | 'phone' | 'in-person')[]
    status: 'available' | 'booked' | 'blocked'
    price: number
    currency: string
  }>
): Promise<BookingTimeSlot> {
  const sanitized = sanitizeObject({
    startTime: data.startTime?.toISOString(),
    endTime: data.endTime?.toISOString(),
    locationTypes: data.locationTypes,
    status: data.status,
    billingConfig: data.price !== undefined ? {
      price: data.price,
      currency: data.currency || 'USD',
      cancellationThresholdMinutes: 24 * 60,
    } : undefined,
  }, {
    nullable: ['billingConfig']
  })
  const response = await apiPatch<ApiTimeSlot>(`/booking/availability/${slotId}`, sanitized)
  return mapApiTimeSlotToFrontend(response)
}

/**
 * Delete an availability slot
 */
export async function deleteAvailabilitySlot(slotId: string): Promise<void> {
  await apiGet(`/booking/availability/${slotId}`, {
    method: 'DELETE',
  } as never)
}

/**
 * Bulk-create availability slots on a recurring schedule
 */
export async function createRecurringAvailability(data: {
  startDate: Date
  endDate: Date
  daysOfWeek: number[] // 0 = Sunday, 6 = Saturday
  timeSlots: Array<{
    startTime: string // HH:mm format
    endTime: string // HH:mm format
  }>
  locationTypes: ('video' | 'phone' | 'in-person')[]
  price?: number
  currency?: string
}): Promise<{ created: number }> {
  const sanitized = sanitizeObject({
    startDate: formatDate(data.startDate, { format: 'iso' }),
    endDate: formatDate(data.endDate, { format: 'iso' }),
    daysOfWeek: data.daysOfWeek,
    timeSlots: data.timeSlots,
    locationTypes: data.locationTypes,
    billingConfig: data.price ? {
      price: data.price,
      currency: data.currency || 'USD',
      cancellationThresholdMinutes: 24 * 60,
    } : undefined,
  }, { nullable: [] })
  const response = await apiPost<{ created: number }>('/booking/availability/bulk', sanitized)
  return response
}

// ============================================================================
// Booking Instance CRUD Operations
// ============================================================================

export interface ListBookingsParams {
  status?: Booking['status']
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
  /** Comma-separated list of relationships to expand, e.g. "host,client". */
  expand?: string
  /** Sort key, e.g. "scheduledAt" or "-scheduledAt" for descending. */
  sort?: string
}

/**
 * List bookings the caller hosts
 */
export async function listBookings(params?: ListBookingsParams): Promise<PaginatedResponse<Booking>> {
  const queryParams = sanitizeObject({
    status: params?.status,
    startDate: params?.startDate ? formatDate(params.startDate, { format: 'iso' }) : undefined,
    endDate: params?.endDate ? formatDate(params.endDate, { format: 'iso' }) : undefined,
    limit: params?.limit,
    offset: params?.offset,
  }, { nullable: [] })

  const response = await apiGet<PaginatedResponse<ApiBooking>>('/booking/bookings', queryParams)

  return {
    data: response.data.map(mapApiBookingToFrontend),
    pagination: response.pagination,
  }
}

/**
 * Get a single booking by ID
 */
export async function getBooking(bookingId: string): Promise<Booking> {
  const response = await apiGet<ApiBooking>(`/booking/bookings/${bookingId}`)
  return mapApiBookingToFrontend(response)
}

/**
 * Confirm a booking request (host action)
 */
export async function confirmBooking(bookingId: string, reason?: string): Promise<Booking> {
  const response = await apiPost<ApiBooking>(`/booking/bookings/${bookingId}/confirm`, { reason })
  return mapApiBookingToFrontend(response)
}

/**
 * Reject a booking request (host action)
 */
export async function rejectBooking(bookingId: string, reason?: string): Promise<Booking> {
  const response = await apiPost<ApiBooking>(`/booking/bookings/${bookingId}/reject`, { reason })
  return mapApiBookingToFrontend(response)
}

/**
 * Cancel a booking
 */
export async function cancelBooking(bookingId: string, reason?: string): Promise<Booking> {
  const response = await apiPost<ApiBooking>(`/booking/bookings/${bookingId}/cancel`, { reason })
  return mapApiBookingToFrontend(response)
}

/**
 * Mark a booking as no-show (host action)
 */
export async function markBookingNoShow(bookingId: string): Promise<Booking> {
  const response = await apiPost<ApiBooking>(`/booking/bookings/${bookingId}/no-show`, {})
  return mapApiBookingToFrontend(response)
}

// ============================================================================
// Client-Side Booking Creation
// ============================================================================

export interface CreateBookingData {
  slot: string
  locationType?: 'video' | 'phone' | 'in_person'
  reason?: string
  formResponses?: Record<string, any>
}

/**
 * Create a new booking (client action)
 */
export async function createBooking(data: CreateBookingData): Promise<Booking> {
  const sanitized = sanitizeObject({
    slot: data.slot,
    locationType: data.locationType,
    reason: data.reason,
    formResponses: data.formResponses ? { data: data.formResponses } : undefined,
  }, { nullable: [] })
  const response = await apiPost<ApiBooking>('/booking/bookings', sanitized)
  return mapApiBookingToFrontend(response)
}

void mapApiPersonToHost
