/**
 * Pure helper that splits a list of bookings into "upcoming" and "past"
 * buckets. Lifted out of <BookingList> so the partition logic is testable
 * without rendering a React tree.
 *
 *   - upcoming: scheduledAt is now-or-later AND status isn't cancelled / rejected
 *   - past:     everything else (cancelled, rejected, completed, or scheduled in the past)
 *
 * The list is also sorted within each bucket: upcoming chronologically ascending,
 * past most-recent-first.
 */

import type { Booking } from '@monobase/sdk-ts/generated/types.gen'

export interface PartitionedBookings {
  upcoming: Booking[]
  past: Booking[]
}

export function partitionBookings(
  bookings: Booking[] | undefined,
  now: number = Date.now(),
): PartitionedBookings {
  if (!bookings) return { upcoming: [], past: [] }

  const upcoming: Booking[] = []
  const past: Booking[] = []
  for (const b of bookings) {
    const isFuture = b.scheduledAt.getTime() >= now
    const isCancelled = b.status === 'cancelled' || b.status === 'rejected'
    if (isFuture && !isCancelled) {
      upcoming.push(b)
    } else {
      past.push(b)
    }
  }

  upcoming.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
  past.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())

  return { upcoming, past }
}
