import { describe, expect, test } from 'bun:test'
import type { Booking } from '@monobase/sdk-ts/generated/types.gen'
import { partitionBookings } from './partition-bookings'

const NOW = new Date('2026-05-15T12:00:00Z').getTime()

function build(
  id: string,
  scheduledAtIso: string,
  status: Booking['status'] = 'confirmed',
): Booking {
  return {
    id,
    version: 1,
    createdAt: new Date(scheduledAtIso),
    updatedAt: new Date(scheduledAtIso),
    client: 'c-1',
    host: 'h-1',
    slot: 's-1',
    locationType: 'video',
    reason: 'because',
    status,
    bookedAt: new Date(scheduledAtIso),
    scheduledAt: new Date(scheduledAtIso),
    durationMinutes: 30,
  } as Booking
}

describe('partitionBookings', () => {
  test('returns empty buckets for undefined input', () => {
    expect(partitionBookings(undefined, NOW)).toEqual({ upcoming: [], past: [] })
  })

  test('separates future confirmed bookings from past ones', () => {
    const future = build('a', '2026-05-20T10:00:00Z', 'confirmed')
    const past = build('b', '2026-05-10T10:00:00Z', 'confirmed')
    const result = partitionBookings([future, past], NOW)
    expect(result.upcoming.map((b) => b.id)).toEqual(['a'])
    expect(result.past.map((b) => b.id)).toEqual(['b'])
  })

  test('cancelled or rejected bookings always end up in past, even if scheduled later', () => {
    const cancelled = build('c', '2026-05-20T10:00:00Z', 'cancelled')
    const rejected = build('r', '2026-05-25T10:00:00Z', 'rejected')
    const confirmed = build('o', '2026-05-21T10:00:00Z', 'confirmed')
    const result = partitionBookings([cancelled, rejected, confirmed], NOW)
    expect(result.upcoming.map((b) => b.id)).toEqual(['o'])
    // sorted past = most recent scheduledAt first
    expect(result.past.map((b) => b.id)).toEqual(['r', 'c'])
  })

  test('upcoming sorted ascending by scheduledAt', () => {
    const a = build('a', '2026-05-20T10:00:00Z')
    const b = build('b', '2026-05-18T10:00:00Z')
    const c = build('c', '2026-05-16T10:00:00Z')
    const result = partitionBookings([a, b, c], NOW)
    expect(result.upcoming.map((b) => b.id)).toEqual(['c', 'b', 'a'])
  })

  test('past sorted descending by scheduledAt', () => {
    const a = build('a', '2026-05-10T10:00:00Z')
    const b = build('b', '2026-05-12T10:00:00Z')
    const c = build('c', '2026-05-14T10:00:00Z')
    const result = partitionBookings([a, b, c], NOW)
    expect(result.past.map((b) => b.id)).toEqual(['c', 'b', 'a'])
  })

  test('right-now boundary: scheduledAt exactly equal to now is upcoming', () => {
    const exact = build('e', new Date(NOW).toISOString())
    const result = partitionBookings([exact], NOW)
    expect(result.upcoming).toHaveLength(1)
    expect(result.past).toHaveLength(0)
  })

  test('completed bookings (no longer cancelled, but in the past) end up in past', () => {
    const completed = build('done', '2026-05-10T10:00:00Z', 'completed')
    const result = partitionBookings([completed], NOW)
    expect(result.upcoming).toHaveLength(0)
    expect(result.past).toHaveLength(1)
  })
})
