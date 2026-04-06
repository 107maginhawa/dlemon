import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  searchProviders,
  getProviderWithSlots,
  listBookingEvents,
  getBookingEvent,
  type SearchProvidersParams,
  type ListBookingEventsParams,
  type ProviderWithSlots,
  type BookingTimeSlot,
} from '../../services/booking'
import { queryKeys } from '../query-keys'
import { ApiError, apiGet } from '../../api'
import type { components } from '@monobase/api-spec/types'

// ============================================================================
// Booking Events Hooks
// ============================================================================

/**
 * Hook to list booking events with filters
 */
export function useListBookingEvents(params?: ListBookingEventsParams) {
  return useQuery({
    queryKey: ['booking', 'events', params],
    queryFn: () => listBookingEvents(params),
    retry: (failureCount, error) => {
      // Don't retry on client errors (4xx)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false
      }
      return failureCount < 3
    },
  })
}

/**
 * Hook to get a single booking event by ID
 */
export function useBookingEvent(eventId: string, options?: {
  enabled?: boolean
  expand?: string
  onError?: (error: Error) => void
}) {
  return useQuery({
    queryKey: ['booking', 'events', eventId, options?.expand],
    queryFn: () => getBookingEvent(eventId, { expand: options?.expand }),
    enabled: options?.enabled !== false && !!eventId,
    retry: (failureCount, error) => {
      // Don't retry on 404 (event not found)
      if (error instanceof ApiError && error.status === 404) {
        return false
      }
      return failureCount < 3
    },
    meta: {
      onError: (error: Error) => {
        console.error('Failed to fetch booking event:', error)
        if (error instanceof ApiError) {
          toast.error(error.message || 'Failed to load booking event')
        } else {
          toast.error('Failed to load booking event. Please try again.')
        }
        options?.onError?.(error)
      },
    },
  })
}

// ============================================================================
// Provider Search Hooks (Deprecated)
// ============================================================================

/**
 * Hook to search providers with filters
 * @deprecated Use useListBookingEvents() instead - /booking/providers endpoint no longer exists
 */
export function useSearchProviders(params: SearchProvidersParams) {
  return useQuery({
    queryKey: queryKeys.bookingProviders(params as Record<string, unknown>),
    queryFn: () => searchProviders(params),
    retry: (failureCount, error) => {
      // Don't retry on client errors (4xx)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false
      }
      return failureCount < 3
    },
  })
}

/**
 * Hook to get provider with available slots and event data
 * @deprecated Use useBookingEvent() instead - /booking/providers endpoint no longer exists
 */
export function useProviderWithSlots(providerId: string, options?: {
  enabled?: boolean
  onError?: (error: Error) => void
}) {
  return useQuery({
    queryKey: queryKeys.bookingProviderSlots(providerId),
    queryFn: () => getProviderWithSlots(providerId),
    enabled: options?.enabled !== false && !!providerId,
    retry: (failureCount, error) => {
      // Don't retry on 404 (provider not found)
      if (error instanceof ApiError && error.status === 404) {
        return false
      }
      return failureCount < 3
    },
    meta: {
      onError: (error: Error) => {
        console.error('Failed to fetch provider slots:', error)
        if (error instanceof ApiError) {
          toast.error(error.message || 'Failed to load provider availability')
        } else {
          toast.error('Failed to load provider availability. Please try again.')
        }
        options?.onError?.(error)
      },
    },
  })
}

/**
 * Hook to get a single time slot by ID
 */
export function useTimeSlot(slotId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['booking', 'slots', slotId],
    queryFn: async () => {
      const slot = await apiGet<components["schemas"]["TimeSlot"]>(`/booking/slots/${slotId}`, { expand: 'event' })
      return slot
    },
    enabled: options?.enabled !== false && !!slotId,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) {
        return false
      }
      return failureCount < 3
    },
  })
}

// ============================================================================
// Provider Availability Management Hooks
// ============================================================================

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getMyBookingEvent,
  createBookingEvent,
  updateBookingEvent,
  getMyAvailability,
  createAvailabilitySlot,
  updateAvailabilitySlot,
  deleteAvailabilitySlot,
  createRecurringAvailability,
  type GetAvailabilityParams,
  type CreateBookingEventData,
} from '../../services/booking'

/**
 * Hook to get provider's own booking event configuration
 */
export function useMyBookingEvent() {
  return useQuery({
    queryKey: ['booking', 'event', 'me'],
    queryFn: getMyBookingEvent,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) {
        return false
      }
      return failureCount < 3
    },
  })
}

/**
 * Hook to create booking event
 */
export function useCreateBookingEvent(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createBookingEvent,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking', 'event', 'me'] })
      
      if (options?.toastSuccess !== false) {
        toast.success('Booking event created successfully')
      }
      
      options?.onSuccess?.(data)
    },
    onError: (error: Error) => {
      console.error('Failed to create booking event:', error)
      
      if (options?.toastError !== false) {
        toast.error('Failed to create booking event')
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Hook to update booking event
 */
export function useUpdateBookingEvent(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: Partial<CreateBookingEventData> }) =>
      updateBookingEvent(eventId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking', 'event', 'me'] })
      
      if (options?.toastSuccess !== false) {
        toast.success('Booking settings updated successfully')
      }
      
      options?.onSuccess?.(data)
    },
    onError: (error: Error) => {
      console.error('Failed to update booking settings:', error)
      
      if (options?.toastError !== false) {
        toast.error('Failed to update booking settings')
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Hook to get provider's availability slots
 */
export function useMyAvailability(params?: GetAvailabilityParams) {
  return useQuery({
    queryKey: ['booking', 'availability', 'me', params],
    queryFn: () => getMyAvailability(params),
    retry: 3,
  })
}

/**
 * Hook to create availability slot
 */
export function useCreateAvailabilitySlot(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createAvailabilitySlot,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking', 'availability', 'me'] })
      
      if (options?.toastSuccess !== false) {
        toast.success('Availability slot created')
      }
      
      options?.onSuccess?.(data)
    },
    onError: (error: Error) => {
      console.error('Failed to create availability slot:', error)
      
      if (options?.toastError !== false) {
        toast.error('Failed to create availability slot')
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Hook to update availability slot
 */
export function useUpdateAvailabilitySlot(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ slotId, data }: { slotId: string; data: Parameters<typeof updateAvailabilitySlot>[1] }) => 
      updateAvailabilitySlot(slotId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking', 'availability', 'me'] })
      
      if (options?.toastSuccess !== false) {
        toast.success('Availability slot updated')
      }
      
      options?.onSuccess?.(data)
    },
    onError: (error: Error) => {
      console.error('Failed to update availability slot:', error)
      
      if (options?.toastError !== false) {
        toast.error('Failed to update availability slot')
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Hook to delete availability slot
 */
export function useDeleteAvailabilitySlot(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteAvailabilitySlot,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking', 'availability', 'me'] })
      
      if (options?.toastSuccess !== false) {
        toast.success('Availability slot deleted')
      }
      
      options?.onSuccess?.(data)
    },
    onError: (error: Error) => {
      console.error('Failed to delete availability slot:', error)
      
      if (options?.toastError !== false) {
        toast.error('Failed to delete availability slot')
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Hook to create recurring availability
 */
export function useCreateRecurringAvailability(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createRecurringAvailability,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking', 'availability', 'me'] })
      
      if (options?.toastSuccess !== false) {
        toast.success(`Created ${data.created} availability slots`)
      }
      
      options?.onSuccess?.(data)
    },
    onError: (error: Error) => {
      console.error('Failed to create recurring availability:', error)
      
      if (options?.toastError !== false) {
        toast.error('Failed to create recurring availability')
      }
      
      options?.onError?.(error)
    },
  })
}

// ============================================================================
// Booking Instance CRUD Hooks (Provider Side)
// ============================================================================

import {
  listBookings,
  getBooking,
  confirmBooking,
  rejectBooking,
  cancelBooking,
  markBookingNoShow,
  type ListBookingsParams,
} from '../../services/booking'

/**
 * List bookings for provider
 */
export function useListBookings(params?: ListBookingsParams) {
  return useQuery({
    queryKey: ['booking', 'bookings', params],
    queryFn: () => listBookings(params),
    retry: 3,
  })
}

/**
 * Get single booking
 */
export function useBooking(bookingId: string) {
  return useQuery({
    queryKey: ['booking', 'bookings', bookingId],
    queryFn: () => getBooking(bookingId),
    enabled: !!bookingId,
    retry: 3,
  })
}

/**
 * Confirm a booking request
 */
export function useConfirmBooking(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      confirmBooking(bookingId, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking', 'bookings'] })
      
      if (options?.toastSuccess !== false) {
        toast.success('Booking confirmed successfully')
      }
      
      options?.onSuccess?.(data)
    },
    onError: (error: Error) => {
      console.error('Failed to confirm booking:', error)
      
      if (options?.toastError !== false) {
        toast.error('Failed to confirm booking')
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Reject a booking request
 */
export function useRejectBooking(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      rejectBooking(bookingId, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking', 'bookings'] })
      
      if (options?.toastSuccess !== false) {
        toast.success('Booking rejected')
      }
      
      options?.onSuccess?.(data)
    },
    onError: (error: Error) => {
      console.error('Failed to reject booking:', error)
      
      if (options?.toastError !== false) {
        toast.error('Failed to reject booking')
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Cancel a booking
 */
export function useCancelBooking(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      cancelBooking(bookingId, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking', 'bookings'] })
      
      if (options?.toastSuccess !== false) {
        toast.success('Booking cancelled')
      }
      
      options?.onSuccess?.(data)
    },
    onError: (error: Error) => {
      console.error('Failed to cancel booking:', error)
      
      if (options?.toastError !== false) {
        toast.error('Failed to cancel booking')
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Mark booking as no-show
 */
export function useMarkBookingNoShow(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (bookingId: string) => markBookingNoShow(bookingId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking', 'bookings'] })
      
      if (options?.toastSuccess !== false) {
        toast.success('Booking marked as no-show')
      }
      
      options?.onSuccess?.(data)
    },
    onError: (error: Error) => {
      console.error('Failed to mark booking as no-show:', error)
      
      if (options?.toastError !== false) {
        toast.error('Failed to mark booking as no-show')
      }
      
      options?.onError?.(error)
    },
  })
}

// ============================================================================
// Patient-Side Booking Creation Hooks
// ============================================================================

import { createBooking, type CreateBookingData } from '../../services/booking'

/**
 * Create a new booking (patient action)
 */
export function useCreateBooking(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: any) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createBooking,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking', 'bookings'] })
      
      if (options?.toastSuccess !== false) {
        toast.success('Booking created successfully')
      }
      
      options?.onSuccess?.(data)
    },
    onError: (error: Error) => {
      console.error('Failed to create booking:', error)
      
      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          toast.error(error.message || 'Failed to create booking')
        } else {
          toast.error('Failed to create booking')
        }
      }
      
      options?.onError?.(error)
    },
  })
}
