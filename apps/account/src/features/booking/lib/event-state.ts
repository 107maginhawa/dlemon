/**
 * Pure state transforms for the BookingEventEditor.
 *
 * Lifted out of the React component so the
 * `eventToState` / `stateToCreateBody` / `stateToUpdateBody` round-trips can
 * be unit-tested without React Testing Library or a full form render.
 */

import { buildPatch } from '@monobase/sdk-ts/utils/patch'
import type {
  BookingEvent,
  BookingEventCreateRequest,
  BookingEventUpdateRequest,
  DailyConfig,
  LocationType,
} from '@monobase/sdk-ts/generated/types.gen'

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type DayKey = (typeof DAY_KEYS)[number]

export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

export interface DayState {
  enabled: boolean
  startTime: string
  endTime: string
  slotDuration: number
}

export interface FormState {
  title: string
  description: string
  timezone: string
  locationTypes: LocationType[]
  status: 'draft' | 'active'
  priceCents: number
  currency: string
  cancellationThresholdMinutes: number
  days: Record<DayKey, DayState>
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
  } catch {
    return 'America/New_York'
  }
}

const blankDay: DayState = {
  enabled: false,
  startTime: '09:00',
  endTime: '17:00',
  slotDuration: 60,
}

export function emptyState(timezone: string = detectTimezone()): FormState {
  return {
    title: '',
    description: '',
    timezone,
    locationTypes: ['video'],
    status: 'draft',
    priceCents: 0,
    currency: 'USD',
    cancellationThresholdMinutes: 1440,
    days: {
      mon: { ...blankDay, enabled: true },
      tue: { ...blankDay, enabled: true },
      wed: { ...blankDay, enabled: true },
      thu: { ...blankDay, enabled: true },
      fri: { ...blankDay, enabled: true },
      sat: { ...blankDay },
      sun: { ...blankDay },
    },
  }
}

export function eventToState(ev: BookingEvent): FormState {
  const days = Object.fromEntries(DAY_KEYS.map((k) => [k, { ...blankDay }])) as FormState['days']
  for (const key of DAY_KEYS) {
    const cfg = ev.dailyConfigs?.[key] as DailyConfig | undefined
    if (!cfg) continue
    const block = cfg.timeBlocks?.[0]
    days[key] = {
      enabled: cfg.enabled,
      startTime: block?.startTime ?? blankDay.startTime,
      endTime: block?.endTime ?? blankDay.endTime,
      slotDuration: block?.slotDuration ?? blankDay.slotDuration,
    }
  }
  return {
    title: ev.title,
    description: ev.description ?? '',
    timezone: ev.timezone,
    locationTypes: ev.locationTypes,
    status: ev.status === 'active' ? 'active' : 'draft',
    priceCents: ev.billingConfig?.price ?? 0,
    currency: ev.billingConfig?.currency ?? 'USD',
    cancellationThresholdMinutes: ev.billingConfig?.cancellationThresholdMinutes ?? 1440,
    days,
  }
}

export function stateToDailyConfigs(s: FormState): Record<string, DailyConfig> {
  const out: Record<string, DailyConfig> = {}
  for (const key of DAY_KEYS) {
    const d = s.days[key]
    out[key] = {
      enabled: d.enabled,
      timeBlocks: d.enabled
        ? [{ startTime: d.startTime, endTime: d.endTime, slotDuration: d.slotDuration }]
        : [],
    }
  }
  return out
}

export function stateToCreateBody(s: FormState): BookingEventCreateRequest {
  const body: BookingEventCreateRequest = {
    title: s.title,
    timezone: s.timezone,
    locationTypes: s.locationTypes,
    status: s.status,
    dailyConfigs: stateToDailyConfigs(s),
  }
  if (s.description) body.description = s.description
  if (s.priceCents > 0) {
    body.billingConfig = {
      price: s.priceCents,
      currency: s.currency,
      cancellationThresholdMinutes: s.cancellationThresholdMinutes,
    }
  }
  return body
}

export function stateToUpdateBody(s: FormState): BookingEventUpdateRequest {
  return buildPatch<BookingEventUpdateRequest>({
    title: s.title,
    description: s.description || null,
    timezone: s.timezone,
    locationTypes: s.locationTypes,
    status: s.status,
    dailyConfigs: stateToDailyConfigs(s),
    billingConfig:
      s.priceCents > 0
        ? {
            price: s.priceCents,
            currency: s.currency,
            cancellationThresholdMinutes: s.cancellationThresholdMinutes,
          }
        : null,
  })
}
