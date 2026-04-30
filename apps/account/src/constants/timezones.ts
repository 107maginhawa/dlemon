import { getTimeZones } from '@vvo/tzdb'

/**
 * Timezone data structure
 *
 * IMPORTANT: Timezone codes use IANA timezone database format (Area/Location).
 * This ensures compatibility with:
 * - JavaScript Intl.DateTimeFormat API
 * - Database timezone columns (PostgreSQL, MySQL)
 * - Backend timezone handling libraries
 * - Cross-platform date/time operations
 *
 * @example
 * { code: 'America/New_York', name: 'EST - New York', offset: 'UTC-5', group: 'America' }
 * { code: 'Europe/London', name: 'GMT - London', offset: 'UTC+0', group: 'Europe' }
 * { code: 'Asia/Tokyo', name: 'JST - Tokyo', offset: 'UTC+9', group: 'Asia' }
 */
export interface Timezone {
  /** IANA timezone code (e.g., 'America/New_York') */
  code: string
  /** Human-readable name with abbreviation and city */
  name: string
  /** UTC offset (e.g., 'UTC-5', 'UTC+9', 'UTC+5:30') */
  offset: string
  /** Geographic group/continent */
  group: string
  /** Main cities in this timezone (for search keywords) */
  mainCities: string[]
}

const timezones = getTimeZones()

export const TIMEZONES: Timezone[] = timezones.map(tz => ({
  code: tz.name,
  name: `${tz.currentTimeFormat.split(' ')[0]} - ${tz.mainCities[0] || tz.name.split('/')[1]}`,
  offset: tz.currentTimeOffsetInMinutes >= 0
    ? `UTC+${Math.floor(tz.currentTimeOffsetInMinutes / 60)}${tz.currentTimeOffsetInMinutes % 60 ? ':' + (tz.currentTimeOffsetInMinutes % 60) : ''}`
    : `UTC${Math.floor(tz.currentTimeOffsetInMinutes / 60)}${tz.currentTimeOffsetInMinutes % 60 ? ':' + Math.abs(tz.currentTimeOffsetInMinutes % 60) : ''}`,
  group: tz.group[0] || 'Other',
  mainCities: tz.mainCities || []
}))
