/**
 * seed-clock.test.ts
 *
 * Proves the demo-seed slot helper never produces an appointment the
 * working-hours validator would reject (422 OUTSIDE_WORKING_HOURS), regardless
 * of which weekday the seed runs on or the host timezone.
 *
 * The oracle is the REAL scheduler validator (isWithinWorkingHours), so this
 * test fails the moment the seed and the scheduler disagree about what counts as
 * a bookable slot.
 *
 * Background: scripts/seed-demo.ts §9 posts appointments over HTTP; a slot the
 * validator rejects 422s and the appointment is silently dropped. The old seed
 * helpers built instants with Date#setHours (the HOST timezone) and hard-coded
 * relative days, so on a UTC CI runner "09:00" became 17:00 Manila, and weekend
 * runs landed appointments on closed days (Sun) or after the short Saturday
 * window — both outside the clinic's Asia/Manila working hours.
 */
import { describe, test, expect } from 'bun:test';
import {
  workingSlotISO,
  manilaInstant,
  manilaMidnight,
  CLINIC_WORKING_HOURS,
  CLINIC_TZ,
} from '../../../scripts/lib/seed-clock';
import { isWithinWorkingHours, parseWorkingHours } from './workingHours';

const HOURS = parseWorkingHours(JSON.stringify(CLINIC_WORKING_HOURS))!;

// Every (dayOffset, hour, minute, durationMin) the seeds actually request —
// the union of scripts/seed-demo.ts §9 and
// services/api-ts/scripts/seed-supplement.ts. Keep in sync when those change.
const SEED_SLOTS: Array<{ label: string; day: number; hour: number; min: number; dur: number }> = [
  // seed-demo §9
  { label: 'demo: today 09:00 checkup',   day: 0,   hour: 9,  min: 0,  dur: 60 },
  { label: 'demo: today 10:30 follow-up', day: 0,   hour: 10, min: 30, dur: 30 },
  { label: 'demo: today 14:00 emergency', day: 0,   hour: 14, min: 0,  dur: 45 },
  { label: 'demo: +1 09:00 pediatric',    day: 1,   hour: 9,  min: 0,  dur: 45 },
  { label: 'demo: +1 11:00 implant',      day: 1,   hour: 11, min: 0,  dur: 60 },
  { label: 'demo: +7 10:00 ortho',        day: 7,   hour: 10, min: 0,  dur: 30 },
  { label: 'demo: -30 09:00 completed',   day: -30, hour: 9,  min: 0,  dur: 60 },
  { label: 'demo: +2 13:00 cancelled',    day: 2,   hour: 13, min: 0,  dur: 30 },
  { label: 'demo: -10 10:00 no_show',     day: -10, hour: 10, min: 0,  dur: 60 },
  // seed-supplement
  { label: 'supp: today 09:00',           day: 0,   hour: 9,  min: 0,  dur: 30 },
  { label: 'supp: today 10:30',           day: 0,   hour: 10, min: 30, dur: 45 },
  { label: 'supp: today 11:30 walk-in',   day: 0,   hour: 11, min: 30, dur: 30 },
  { label: 'supp: today 14:00 crown',     day: 0,   hour: 14, min: 0,  dur: 60 },
  { label: 'supp: +1 09:00 extraction',   day: 1,   hour: 9,  min: 0,  dur: 60 },
  { label: 'supp: +1 11:00 implant',      day: 1,   hour: 11, min: 0,  dur: 45 },
  { label: 'supp: +2 10:00 ortho',        day: 2,   hour: 10, min: 0,  dur: 30 },
  { label: 'supp: +3 15:00 root canal',   day: 3,   hour: 15, min: 0,  dur: 90 },
  { label: 'supp: -10 09:00 exam',        day: -10, hour: 9,  min: 0,  dur: 30 },
  { label: 'supp: -20 10:00 crown prep',  day: -20, hour: 10, min: 0,  dur: 60 },
  { label: 'supp: -7 14:00 perio SRP',    day: -7,  hour: 14, min: 0,  dur: 45 },
  { label: 'supp: -5 11:00 cleaning',     day: -5,  hour: 11, min: 0,  dur: 30 },
  { label: 'supp: -3 13:00 extraction',   day: -3,  hour: 13, min: 0,  dur: 60 },
  { label: 'supp: -2 16:00 sensitivity',  day: -2,  hour: 16, min: 0,  dur: 30 },
];

// Seven consecutive Manila "today"s → covers every weekday (Sun..Sat).
// 2026-06-14 is a Sunday in Manila; +0..6 walks the full week.
const WEEK = Array.from({ length: 7 }, (_, i) => manilaInstant(2026, 5, 14 + i, 12, 0));

describe('seed-clock: appointment slots respect Asia/Manila working hours', () => {
  test('manilaInstant builds a Manila wall-clock instant (fixed UTC+8, no DST)', () => {
    const t = manilaInstant(2026, 5, 15, 9, 30); // 2026-06-15 09:30 Manila
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: CLINIC_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(t);
    const get = (ty: string) => parts.find((p) => p.type === ty)!.value;
    expect(`${get('year')}-${get('month')}-${get('day')}`).toBe('2026-06-15');
    expect(`${get('hour')}:${get('minute')}`).toBe('09:30');
    // ...and it is exactly 8h ahead of UTC.
    expect(t.toISOString()).toBe('2026-06-15T01:30:00.000Z');
  });

  for (const now of WEEK) {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: CLINIC_TZ, weekday: 'long' }).format(now);
    describe(`run-day = ${weekday}`, () => {
      for (const s of SEED_SLOTS) {
        test(`${s.label} lands inside working hours`, () => {
          const iso = workingSlotISO(now, s.day, s.hour, s.min, s.dur);
          expect(isWithinWorkingHours(new Date(iso), s.dur, HOURS, CLINIC_TZ)).toBe(true);
        });
      }

      test('past slots stay in the past; today/future are not before today', () => {
        const todayMidnight = manilaMidnight(now).getTime();
        for (const s of SEED_SLOTS) {
          const t = new Date(workingSlotISO(now, s.day, s.hour, s.min, s.dur)).getTime();
          if (s.day < 0) expect(t).toBeLessThan(todayMidnight);
          else expect(t).toBeGreaterThanOrEqual(todayMidnight);
        }
      });
    });
  }
});
