import { describe, expect, test } from 'bun:test'
import type { BookingEvent } from '@monobase/sdk-ts/generated/types.gen'
import {
  DAY_KEYS,
  emptyState,
  eventToState,
  stateToCreateBody,
  stateToDailyConfigs,
  stateToUpdateBody,
} from './event-state'

function buildEvent(overrides: Partial<BookingEvent> = {}): BookingEvent {
  return {
    id: 'e-1',
    version: 1,
    createdAt: new Date('2026-04-30T00:00:00Z'),
    updatedAt: new Date('2026-04-30T00:00:00Z'),
    owner: 'p-host',
    title: 'Coaching',
    timezone: 'America/New_York',
    locationTypes: ['video'],
    maxBookingDays: 30,
    minBookingMinutes: 1440,
    status: 'active',
    effectiveFrom: new Date('2026-04-30T00:00:00Z'),
    dailyConfigs: {
      mon: {
        enabled: true,
        timeBlocks: [{ startTime: '09:00', endTime: '12:00', slotDuration: 30 }],
      },
      tue: { enabled: false, timeBlocks: [] },
    },
    ...overrides,
  } as BookingEvent
}

describe('emptyState', () => {
  test('defaults to draft, USD, weekday-only schedule', () => {
    const s = emptyState('UTC')
    expect(s.title).toBe('')
    expect(s.timezone).toBe('UTC')
    expect(s.status).toBe('draft')
    expect(s.priceCents).toBe(0)
    expect(s.currency).toBe('USD')
    expect(s.locationTypes).toEqual(['video'])
    expect(s.days.mon.enabled).toBe(true)
    expect(s.days.fri.enabled).toBe(true)
    expect(s.days.sat.enabled).toBe(false)
    expect(s.days.sun.enabled).toBe(false)
  })
})

describe('eventToState', () => {
  test('hydrates form state from a populated BookingEvent', () => {
    const s = eventToState(buildEvent())
    expect(s.title).toBe('Coaching')
    expect(s.timezone).toBe('America/New_York')
    expect(s.status).toBe('active')
    expect(s.days.mon).toEqual({
      enabled: true,
      startTime: '09:00',
      endTime: '12:00',
      slotDuration: 30,
    })
    expect(s.days.tue.enabled).toBe(false)
    // Days not in the event's dailyConfigs default to disabled with the blank slot.
    expect(s.days.wed.enabled).toBe(false)
    expect(s.days.wed.startTime).toBe('09:00')
  })

  test('treats anything other than active as draft', () => {
    expect(eventToState(buildEvent({ status: 'draft' })).status).toBe('draft')
    expect(eventToState(buildEvent({ status: 'paused' })).status).toBe('draft')
    expect(eventToState(buildEvent({ status: 'archived' })).status).toBe('draft')
  })

  test('reads price + currency + cancellation threshold from billingConfig', () => {
    const s = eventToState(
      buildEvent({
        billingConfig: { price: 7500, currency: 'EUR', cancellationThresholdMinutes: 720 },
      }),
    )
    expect(s.priceCents).toBe(7500)
    expect(s.currency).toBe('EUR')
    expect(s.cancellationThresholdMinutes).toBe(720)
  })
})

describe('stateToDailyConfigs', () => {
  test('emits empty timeBlocks for disabled days', () => {
    const s = emptyState('UTC')
    s.days.sat.enabled = false
    const out = stateToDailyConfigs(s)
    expect(out.sat).toEqual({ enabled: false, timeBlocks: [] })
    expect(out.mon.enabled).toBe(true)
    expect(out.mon.timeBlocks).toHaveLength(1)
    expect(out.mon.timeBlocks[0]).toEqual({
      startTime: '09:00',
      endTime: '17:00',
      slotDuration: 60,
    })
  })

  test('always emits all seven day keys', () => {
    const out = stateToDailyConfigs(emptyState('UTC'))
    for (const key of DAY_KEYS) {
      expect(out[key]).toBeDefined()
    }
  })
})

describe('stateToCreateBody', () => {
  test('omits description when empty and skips billingConfig when free', () => {
    const s = emptyState('UTC')
    s.title = 'Office hours'
    const body = stateToCreateBody(s)
    expect(body.title).toBe('Office hours')
    expect('description' in body).toBe(false)
    expect(body.billingConfig).toBeUndefined()
    expect(body.locationTypes).toEqual(['video'])
    expect(body.status).toBe('draft')
    expect(body.dailyConfigs.mon.enabled).toBe(true)
  })

  test('includes billingConfig when priceCents > 0', () => {
    const s = emptyState('UTC')
    s.title = 'Paid'
    s.priceCents = 5000
    s.currency = 'USD'
    s.cancellationThresholdMinutes = 60
    const body = stateToCreateBody(s)
    expect(body.billingConfig).toEqual({
      price: 5000,
      currency: 'USD',
      cancellationThresholdMinutes: 60,
    })
  })
})

describe('stateToUpdateBody', () => {
  test('emits null for description when blank (clearable PATCH)', () => {
    const s = emptyState('UTC')
    s.title = 'New title'
    const body = stateToUpdateBody(s)
    // buildPatch keeps null in the payload because PersonUpdate-style nullables
    // mean "explicitly clear".
    expect(body.description).toBeNull()
  })

  test('emits null for billingConfig when free, value when priced', () => {
    const free = stateToUpdateBody(emptyState('UTC'))
    expect(free.billingConfig).toBeNull()

    const paid = emptyState('UTC')
    paid.priceCents = 9999
    const body = stateToUpdateBody(paid)
    expect(body.billingConfig).toEqual({
      price: 9999,
      currency: 'USD',
      cancellationThresholdMinutes: 1440,
    })
  })
})
