/**
 * availability.ts (P1-25)
 *
 * Computes bookable slots ON-READ from working hours minus existing
 * appointments and active holds. No materialized slot rows — availability is
 * truthful by construction (avoids the legacy booking/ module's drift problem).
 *
 * The time-grid math is ported from booking/utils/slotGeneration.ts
 * (day-walking + Intl/timezone conversion) but emits ephemeral candidate slots
 * rather than DB rows, and is decomposed so the pure grid generator is unit
 * testable without a database.
 */

import type { WorkingHours, DaySchedule } from './workingHours';

export interface CandidateSlot {
  startAt: Date;
  endAt: Date;
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

/** Day-of-week key for a Date in the given IANA timezone. */
function dayKeyInTz(date: Date, timezone: string): keyof WorkingHours {
  return date.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }).toLowerCase() as keyof WorkingHours;
}

/** YYYY-MM-DD in the given timezone (used to walk calendar days). */
function dateKeyInTz(date: Date, timezone: string): string {
  // en-CA yields ISO-ish YYYY-MM-DD.
  return date.toLocaleDateString('en-CA', { timeZone: timezone });
}

/**
 * Resolve the UTC instant for a given local wall-clock (YYYY-MM-DD + minutes
 * since midnight) in an IANA timezone. Uses the standard offset-probe technique
 * so it is correct across DST without pulling in a tz library.
 */
function zonedWallClockToUtc(dateKey: string, minutesSinceMidnight: number, timezone: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const hh = Math.floor(minutesSinceMidnight / 60);
  const mm = minutesSinceMidnight % 60;
  // Initial guess: treat the wall-clock as if it were UTC.
  const guess = Date.UTC(y!, m! - 1, d!, hh, mm, 0, 0);
  // What wall-clock does that UTC instant render as in the target tz?
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') === 24 ? 0 : get('hour'), get('minute'), get('second'));
  // Offset between the rendered wall-clock and the target wall-clock = tz offset.
  const offset = asUtc - guess;
  return new Date(guess - offset);
}

function parseHHMM(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h! * 60 + m!;
}

/**
 * Generate ephemeral candidate slots across [dateFrom, dateTo] for one provider's
 * working hours. Pure: no DB, no conflict subtraction. Caller subtracts
 * appointments/holds and applies provider identity.
 *
 * - Walks each calendar day in the branch timezone.
 * - For enabled days with open/close, steps a grid of `stepMinutes` and emits
 *   a slot of `durationMinutes` when it fits entirely before close.
 * - Drops slots that start before `notBefore` (lead-time) or after `notAfter`
 *   (horizon).
 */
export function generateCandidateSlots(params: {
  hours: WorkingHours;
  timezone: string;
  dateFrom: Date;
  dateTo: Date;
  stepMinutes: number;
  durationMinutes: number;
  notBefore: Date;
  notAfter: Date;
}): CandidateSlot[] {
  const { hours, timezone, dateFrom, dateTo, stepMinutes, durationMinutes, notBefore, notAfter } = params;
  const slots: CandidateSlot[] = [];
  if (stepMinutes <= 0 || durationMinutes <= 0) return slots;

  // Walk by calendar day. Use UTC-midnight cursor incremented 1 day; resolve the
  // tz-local day key for each. Guard the loop to a sane horizon.
  const MS_DAY = 24 * 60 * 60 * 1000;
  const startCursor = new Date(Date.UTC(
    dateFrom.getUTCFullYear(), dateFrom.getUTCMonth(), dateFrom.getUTCDate(),
  ));
  const endCursor = new Date(Date.UTC(
    dateTo.getUTCFullYear(), dateTo.getUTCMonth(), dateTo.getUTCDate(),
  ));

  for (let t = startCursor.getTime() - MS_DAY; t <= endCursor.getTime() + MS_DAY; t += MS_DAY) {
    const probe = new Date(t);
    const dateKey = dateKeyInTz(probe, timezone);
    const dayKey = dayKeyInTz(probe, timezone);
    const schedule: DaySchedule | undefined = hours[dayKey];
    if (!schedule?.enabled || !schedule.open || !schedule.close) continue;

    const openMins = parseHHMM(schedule.open);
    const closeMins = parseHHMM(schedule.close);

    for (let m = openMins; m + durationMinutes <= closeMins; m += stepMinutes) {
      const startAt = zonedWallClockToUtc(dateKey, m, timezone);
      const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
      if (startAt < notBefore) continue;
      if (startAt > notAfter) continue;
      if (startAt < dateFrom || startAt > dateTo) continue;
      slots.push({ startAt, endAt });
    }
  }

  // Stable sort by start time (calendar-day walking can emit out of order across DST).
  slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return slots;
}

export interface OccupiedInterval {
  startAt: Date;
  durationMinutes: number;
}

/** A candidate is free when it does not overlap any occupied interval. */
export function isSlotFree(slot: CandidateSlot, occupied: OccupiedInterval[]): boolean {
  const sStart = slot.startAt.getTime();
  const sEnd = slot.endAt.getTime();
  for (const o of occupied) {
    const oStart = o.startAt.getTime();
    const oEnd = oStart + o.durationMinutes * 60 * 1000;
    if (oStart < sEnd && oEnd > sStart) return false;
  }
  return true;
}
