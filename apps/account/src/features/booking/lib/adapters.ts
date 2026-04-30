/**
 * Adapters from generated SDK types to the presentation-shape types the
 * BookingWidget / ActiveBookingCard components expect.
 */

import type {
  BookingEvent,
  Person,
  TimeSlot,
} from '@monobase/sdk-ts/generated/types.gen'
import type { BookingHost, BookingTimeSlot } from '@/features/booking/types'

export function toBookingHost(person: Person): BookingHost {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ') || 'Host'
  return {
    id: person.id,
    name,
    email: person.contactInfo?.email,
    avatar: person.avatar?.url,
    city: person.primaryAddress?.city,
    state: person.primaryAddress?.state,
    languages: person.languagesSpoken,
  }
}

export function toBookingTimeSlot(slot: TimeSlot, event: BookingEvent | null): BookingTimeSlot {
  // The widget groups slots by date; truncate startTime to midnight (UTC).
  const date = new Date(slot.startTime)
  date.setUTCHours(0, 0, 0, 0)
  return {
    id: slot.id,
    hostId: slot.owner,
    date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    status: slot.status,
    locationTypes: slot.locationTypes,
    price: event?.billingConfig?.price ?? 0,
  }
}
