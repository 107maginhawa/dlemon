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
 * Form configuration for booking event
 */
export interface FormConfig {
  fields?: FormFieldConfig[]
}

/**
 * Time slot for appointments
 */
export interface BookingTimeSlot {
  id: string
  providerId: string
  date: Date
  startTime: Date
  endTime: Date
  status: 'available' | 'booked' | 'blocked'
  consultationModes: ('video' | 'phone' | 'in-person')[]
  price: number
  billingOverride?: {
    price?: number
    currency?: string
    paymentRequired?: boolean
    freeCancellationMinutes?: number
  }
}

/**
 * Provider information for booking display
 */
export interface BookingProvider {
  id: string
  name: string
  email?: string
  avatar?: string
  biography?: string
  yearsOfExperience?: number
  specialties?: string[]
  serviceLocations?: string[]
  city?: string
  state?: string
  languages?: string[]
}

/**
 * Booking event - defines provider availability and booking configuration
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

export interface ProviderWithSlots {
  provider: BookingProvider
  slots: BookingTimeSlot[]
  event?: BookingEvent
}

export interface Booking {
  id: string
  version: number
  createdAt: Date
  createdBy?: string
  updatedAt: Date
  updatedBy?: string
  client: string
  provider: string
  slot: string
  locationType: 'video' | 'phone' | 'in-person'
  reason: string
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed' | 'no_show_client' | 'no_show_provider'
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

// ============================================================================
// API Type Aliases
// ============================================================================

type ApiPerson = components["schemas"]["Person"]
type ApiBooking = components["schemas"]["Booking"]
type ApiTimeSlot = components["schemas"]["TimeSlot"]
type ApiBookingEvent = components["schemas"]["BookingEvent"]

// Extended Person type for provider responses (Person + slots + event)
type ApiPersonWithSlots = ApiPerson & {
  slots?: ApiTimeSlot[]
  event?: ApiBookingEvent
}

// ============================================================================
// Mapper Functions
// ============================================================================

/**
 * Convert API TimeSlot to Frontend TimeSlot with Date objects
 */
function mapApiTimeSlotToFrontend(apiSlot: ApiTimeSlot): BookingTimeSlot {
  const startTime = new Date(apiSlot.startTime)
  const endTime = new Date(apiSlot.endTime)

  return {
    id: apiSlot.id,
    providerId: apiSlot.owner,
    date: startTime, // Use startTime as date
    startTime,
    endTime,
    status: apiSlot.status as 'available' | 'booked' | 'blocked',
    consultationModes: apiSlot.locationTypes as ('video' | 'phone' | 'in-person')[],
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
 * Convert API Person to Frontend BookingProvider
 * In monobase, providers are Person entities with provider role
 */
function mapApiPersonToProvider(apiPerson: ApiPerson): BookingProvider {
  return {
    id: apiPerson.id,
    name: `${apiPerson.firstName} ${apiPerson.lastName || ''}`.trim(),
    email: apiPerson.contactInfo?.email,
    avatar: apiPerson.avatar?.url,
    biography: undefined, // TODO: Add when provider-specific fields exist
    yearsOfExperience: undefined,
    specialties: [],
    serviceLocations: [],
    city: apiPerson.primaryAddress?.city,
    state: apiPerson.primaryAddress?.state,
    languages: apiPerson.languagesSpoken,
  }
}

/**
 * Convert API BookingEvent to Frontend BookingEvent
 */
function mapApiBookingEventToFrontend(apiEvent: ApiBookingEvent): BookingEvent {
  return {
    // BaseEntity fields
    id: apiEvent.id,
    version: apiEvent.version,
    createdAt: new Date(apiEvent.createdAt),
    updatedAt: new Date(apiEvent.updatedAt),
    createdBy: apiEvent.createdBy,
    updatedBy: apiEvent.updatedBy,
    
    // BookingEvent fields
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
 * Convert API Booking to Frontend Booking with Date objects
 */
function mapApiBookingToFrontend(apiBooking: ApiBooking): Booking {
  return {
    id: apiBooking.id,
    version: apiBooking.version,
    createdAt: new Date(apiBooking.createdAt),
    createdBy: apiBooking.createdBy,
    updatedAt: new Date(apiBooking.updatedAt),
    updatedBy: apiBooking.updatedBy,
    client: typeof apiBooking.client === 'string' ? apiBooking.client : apiBooking.client.id,
    provider: typeof apiBooking.provider === 'string' ? apiBooking.provider : apiBooking.provider.id,
    slot: typeof apiBooking.slot === 'string' ? apiBooking.slot : apiBooking.slot.id,
    locationType: apiBooking.locationType,
    reason: apiBooking.reason,
    status: apiBooking.status,
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
 * Search providers with filters
 * @deprecated Use listBookingEvents() instead - this endpoint no longer exists
 */
export interface SearchProvidersParams {
  q?: string
  specialty?: string
  location?: string
  language?: string
  availableFrom?: Date
  availableTo?: Date
  offset?: number
  limit?: number
}

export async function searchProviders(params: SearchProvidersParams): Promise<PaginatedResponse<BookingProvider>> {
  const queryParams = sanitizeObject({
    q: params.q,
    specialty: params.specialty,
    location: params.location,
    language: params.language,
    availableFrom: params.availableFrom ? formatDate(params.availableFrom, { format: 'iso' }) : undefined,
    availableTo: params.availableTo ? formatDate(params.availableTo, { format: 'iso' }) : undefined,
    offset: params.offset,
    limit: params.limit,
    expand: 'person',
  }, { nullable: [] })

  const response = await apiGet<PaginatedResponse<ApiPerson>>('/booking/providers', queryParams)

  return {
    data: response.data.map(mapApiPersonToProvider),
    pagination: response.pagination,
  }
}

/**
 * Get provider (Person) with available slots and event data
 * @deprecated Use getBookingEvent() instead - /booking/providers endpoint no longer exists
 */
export async function getProviderWithSlots(providerId: string): Promise<ProviderWithSlots> {
  const response = await apiGet<ApiPersonWithSlots>(`/booking/providers/${providerId}`, {
    expand: 'person,slots,event',
  })

  const provider = mapApiPersonToProvider(response)
  const slots = (response.slots || []).map(mapApiTimeSlotToFrontend)
  const event = response.event ? mapApiBookingEventToFrontend(response.event) : undefined

  return {
    provider,
    slots,
    event,
  }
}

// ============================================================================
// Provider Availability Management
// ============================================================================

/**
 * Get provider's own booking event configuration
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
 * Create a new booking event
 * POST /booking/events
 */
export async function createBookingEvent(data: CreateBookingEventData): Promise<BookingEvent> {
  const sanitized = sanitizeObject(data, {
    nullable: []  // CREATE operation: empty fields omitted, not sent as null
  })
  const response = await apiPost<ApiBookingEvent>('/booking/events', sanitized)
  return mapApiBookingEventToFrontend(response)
}

/**
 * Update an existing booking event
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
 * Get provider's availability slots
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
 * Create availability slot
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
      currency: data.currency || 'CAD',
      cancellationThresholdMinutes: 24 * 60, // 24 hours default
    } : undefined,
  }, {
    nullable: []  // CREATE operation: empty fields omitted, not sent as null
  })
  const response = await apiPost<ApiTimeSlot>('/booking/availability', sanitized)
  return mapApiTimeSlotToFrontend(response)
}

/**
 * Update availability slot
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
      currency: data.currency || 'CAD',
      cancellationThresholdMinutes: 24 * 60,
    } : undefined,
  }, {
    nullable: ['billingConfig']  // PATCH operation: allow clearing billing config
  })
  const response = await apiGet<ApiTimeSlot>(`/booking/availability/${slotId}`, {
    method: 'PATCH',
    body: JSON.stringify(sanitized),
  })
  return mapApiTimeSlotToFrontend(response)
}

/**
 * Delete availability slot
 */
export async function deleteAvailabilitySlot(slotId: string): Promise<void> {
  await apiGet(`/booking/availability/${slotId}`, {
    method: 'DELETE',
  })
}

/**
 * Bulk create availability slots (recurring schedule)
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
      currency: data.currency || 'CAD',
      cancellationThresholdMinutes: 24 * 60,
    } : undefined,
  }, {
    nullable: []  // CREATE operation: empty fields omitted, not sent as null
  })
  const response = await apiPost<{ created: number }>('/booking/availability/bulk', sanitized)
  return response
}

// ============================================================================
// Booking Instance CRUD Operations (Provider Side)
// ============================================================================

export interface ListBookingsParams {
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected' | 'no_show_client' | 'no_show_provider'
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

/**
 * List bookings for provider
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
 * Get single booking by ID
 */
export async function getBooking(bookingId: string): Promise<Booking> {
  const response = await apiGet<ApiBooking>(`/booking/bookings/${bookingId}`)
  return mapApiBookingToFrontend(response)
}

/**
 * Confirm a booking request (provider action)
 */
export async function confirmBooking(bookingId: string, reason?: string): Promise<Booking> {
  const response = await apiPost<ApiBooking>(`/booking/bookings/${bookingId}/confirm`, { reason })
  return mapApiBookingToFrontend(response)
}

/**
 * Reject a booking request (provider action)
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
 * Mark booking as no-show (provider action)
 */
export async function markBookingNoShow(bookingId: string): Promise<Booking> {
  const response = await apiPost<ApiBooking>(`/booking/bookings/${bookingId}/no-show`, {})
  return mapApiBookingToFrontend(response)
}

// ============================================================================
// Patient-Side Booking Creation
// ============================================================================

export interface CreateBookingData {
  slot: string
  locationType?: 'video' | 'phone' | 'in_person'
  reason?: string
  formResponses?: Record<string, any>
}

/**
 * Create a new booking (patient action)
 */
export async function createBooking(data: CreateBookingData): Promise<Booking> {
  const sanitized = sanitizeObject({
    slot: data.slot,
    locationType: data.locationType,
    reason: data.reason,
    formResponses: data.formResponses ? { data: data.formResponses } : undefined,
  }, {
    nullable: []  // CREATE operation: empty fields omitted, not sent as null
  })
  const response = await apiPost<ApiBooking>('/booking/bookings', sanitized)
  return mapApiBookingToFrontend(response)
}
