// Public type barrel for the SDK.
// Re-exports types from per-module service files so consumers can import from
// a stable `@monobase/sdk/types` entrypoint instead of deep-linking into services.

export type {
  Appointment,
  AppointmentStatus,
  Booking,
  BookingEvent,
  BookingEventData,
  BookingProvider,
  BookingTimeSlot,
  CreateBookingEventData,
  DailyConfig,
  FormConfig,
  FormFieldConfig,
  GetAvailabilityParams,
  ListBookingEventsParams,
  ListBookingsParams,
  LocationType,
  ProviderWithSlots,
  SearchProvidersParams,
  TimeBlock,
} from './services/booking'

export type { Invoice, InvoiceStatus, InvoiceListParams } from './services/billing'

export type { Notification, NotificationType } from './services/notifications'

export type {
  ConsultationNote,
  ConsultationStatus,
  CreateConsultationRequest,
  UpdateConsultationRequest,
  VitalsData,
  SymptomsData,
  PrescriptionData,
  FollowUpData,
} from './services/emr'

export type { Patient } from './services/patient'

export type { Provider } from './services/provider'

export type { Person } from './services/person'

export type { User } from './services/auth'

export type { PaginatedResponse } from './api'
