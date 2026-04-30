import { describe, expect, test } from 'bun:test'
import type { BookingEvent, Person, TimeSlot } from '@monobase/sdk-ts/generated/types.gen'
import { toBookingHost, toBookingTimeSlot } from './adapters'

function buildPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'p-1',
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    firstName: 'Ada',
    ...overrides,
  } as Person
}

function buildSlot(overrides: Partial<TimeSlot> = {}): TimeSlot {
  return {
    id: 's-1',
    version: 1,
    createdAt: new Date('2026-04-30T00:00:00Z'),
    updatedAt: new Date('2026-04-30T00:00:00Z'),
    owner: 'p-host',
    event: 'e-1',
    startTime: new Date('2026-05-15T14:30:00Z'),
    endTime: new Date('2026-05-15T15:00:00Z'),
    locationTypes: ['video'],
    status: 'available',
    ...overrides,
  } as TimeSlot
}

function buildEvent(overrides: Partial<BookingEvent> = {}): BookingEvent {
  return {
    id: 'e-1',
    version: 1,
    createdAt: new Date('2026-04-30T00:00:00Z'),
    updatedAt: new Date('2026-04-30T00:00:00Z'),
    owner: 'p-host',
    title: 'Coaching session',
    timezone: 'America/New_York',
    locationTypes: ['video'],
    maxBookingDays: 30,
    minBookingMinutes: 1440,
    status: 'active',
    effectiveFrom: new Date('2026-04-30T00:00:00Z'),
    dailyConfigs: {},
    ...overrides,
  } as BookingEvent
}

describe('toBookingHost', () => {
  test('combines first and last name into a display name', () => {
    const host = toBookingHost(buildPerson({ firstName: 'Ada', lastName: 'Lovelace' }))
    expect(host.id).toBe('p-1')
    expect(host.name).toBe('Ada Lovelace')
  })

  test('falls back to first name only when last name missing', () => {
    expect(toBookingHost(buildPerson({ firstName: 'Solo' })).name).toBe('Solo')
  })

  test('falls back to "Host" when both names empty', () => {
    expect(toBookingHost(buildPerson({ firstName: '' as never })).name).toBe('Host')
  })

  test('passes through email, avatar URL, city, languages', () => {
    const host = toBookingHost(
      buildPerson({
        contactInfo: { email: 'ada@example.com' },
        avatar: { url: 'https://cdn/avatar.png' },
        primaryAddress: {
          street1: '1 Example St',
          city: 'NYC',
          state: 'NY',
          postalCode: '10001',
          country: 'US',
        },
        languagesSpoken: ['en', 'fr'],
      }),
    )
    expect(host.email).toBe('ada@example.com')
    expect(host.avatar).toBe('https://cdn/avatar.png')
    expect(host.city).toBe('NYC')
    expect(host.languages).toEqual(['en', 'fr'])
  })
})

describe('toBookingTimeSlot', () => {
  test('produces presentation slot with date truncated to UTC midnight', () => {
    const slot = toBookingTimeSlot(buildSlot(), buildEvent())
    expect(slot.id).toBe('s-1')
    expect(slot.hostId).toBe('p-host')
    expect(slot.date.toISOString()).toBe('2026-05-15T00:00:00.000Z')
    expect(slot.startTime.toISOString()).toBe('2026-05-15T14:30:00.000Z')
    expect(slot.endTime.toISOString()).toBe('2026-05-15T15:00:00.000Z')
    expect(slot.status).toBe('available')
    expect(slot.locationTypes).toEqual(['video'])
  })

  test('inherits price from the event billingConfig', () => {
    const slot = toBookingTimeSlot(
      buildSlot(),
      buildEvent({
        billingConfig: { price: 5000, currency: 'USD', cancellationThresholdMinutes: 1440 },
      }),
    )
    expect(slot.price).toBe(5000)
  })

  test('defaults price to 0 when no billingConfig or no event', () => {
    expect(toBookingTimeSlot(buildSlot(), null).price).toBe(0)
    expect(toBookingTimeSlot(buildSlot(), buildEvent()).price).toBe(0)
  })

  test('does not mutate the input slot when computing date', () => {
    const input = buildSlot()
    const before = input.startTime.toISOString()
    toBookingTimeSlot(input, null)
    expect(input.startTime.toISOString()).toBe(before)
  })
})
