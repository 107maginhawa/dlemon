/**
 * seed-clock.ts — timezone- and working-hours-aware date helpers for the demo seeds.
 *
 * The demo branches are onboarded in Asia/Manila (a fixed UTC+8 offset — the
 * Philippines has had no daylight saving since 1944), and the scheduler
 * validates every appointment's start against the branch's working hours
 * *interpreted in that timezone* (see
 * services/api-ts/src/handlers/dental-scheduling/workingHours.ts → isWithinWorkingHours).
 *
 * The previous seed helpers built instants with Date#setHours, which uses the
 * RUNNER's local timezone and ignores the clinic calendar. On a non-Manila host
 * (e.g. a UTC CI runner) "09:00" became 17:00 Manila, and the hard-coded
 * relative days ("today", "tomorrow", "+7") landed on closed days (Sun) or
 * after the short Saturday window — all rejected by createAppointment as
 * OUTSIDE_WORKING_HOURS (422), silently dropping appointments from the demo.
 *
 * workingSlotISO() fixes both: it constructs Manila wall-clock instants and
 * snaps each requested slot to the nearest OPEN day, clamping the start time so
 * the whole appointment fits inside that day's window. Past offsets roll
 * backward (so historical appointments stay in the past); today/future offsets
 * roll forward.
 *
 * Pure module — no dependencies, no DB — so it is shared by both seed scripts
 * (scripts/seed-demo.ts over HTTP, services/api-ts/scripts/seed-supplement.ts via
 * direct insert) and unit-tested against the real validator
 * (src/handlers/dental-scheduling/seed-clock.test.ts).
 */

export const CLINIC_TZ = 'Asia/Manila';

/** Manila is a fixed UTC+8 with no DST — safe to treat as a constant offset. */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DayWindow {
  enabled: boolean;
  open?: string; // 'HH:MM'
  close?: string; // 'HH:MM'
}

export type WorkingHours = {
  monday: DayWindow;
  tuesday: DayWindow;
  wednesday: DayWindow;
  thursday: DayWindow;
  friday: DayWindow;
  saturday: DayWindow;
  sunday: DayWindow;
};

/**
 * The working hours the demo seed PUTs onto the branch (Mon–Fri 09–17,
 * Sat 09–13, Sun closed). Kept here so the slot math and seed-demo's
 * `/working-hours` payload share one source of truth — if you change one,
 * change the other (the seed-clock test asserts every seeded slot fits these).
 */
export const CLINIC_WORKING_HOURS: WorkingHours = {
  monday: { enabled: true, open: '09:00', close: '17:00' },
  tuesday: { enabled: true, open: '09:00', close: '17:00' },
  wednesday: { enabled: true, open: '09:00', close: '17:00' },
  thursday: { enabled: true, open: '09:00', close: '17:00' },
  friday: { enabled: true, open: '09:00', close: '17:00' },
  saturday: { enabled: true, open: '09:00', close: '13:00' },
  sunday: { enabled: false },
};

// Index 0..6 = Sun..Sat, matching Date#getUTCDay().
const DAY_KEYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const;

interface ManilaParts {
  y: number;
  mo: number; // 0-11
  d: number;
  weekday: number; // 0=Sun..6=Sat, in Manila
}

/** The Manila wall-clock calendar components of an instant. */
function manilaParts(t: Date): ManilaParts {
  const shifted = new Date(t.getTime() + MANILA_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    mo: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/** Build the instant whose Manila wall-clock is (y, mo[0-11], d, h, min). */
export function manilaInstant(y: number, mo: number, d: number, h: number, min = 0): Date {
  return new Date(Date.UTC(y, mo, d, h, min) - MANILA_OFFSET_MS);
}

/** Midnight (00:00 Manila) of the Manila calendar day containing `t`. */
export function manilaMidnight(t: Date): Date {
  const p = manilaParts(t);
  return manilaInstant(p.y, p.mo, p.d, 0, 0);
}

interface Window {
  openMin: number;
  closeMin: number;
}

function windowFor(weekday: number, hours: WorkingHours): Window | null {
  const w = hours[DAY_KEYS[weekday]!];
  if (!w?.enabled || !w.open || !w.close) return null;
  const [oh, om] = w.open.split(':').map(Number);
  const [ch, cm] = w.close.split(':').map(Number);
  return { openMin: oh! * 60 + om!, closeMin: ch! * 60 + cm! };
}

/**
 * Returns an ISO instant for an appointment of `durationMin` minutes near
 * (referenceNow + dayOffset days) at the desired Manila wall-clock
 * `hour:minute`, snapped so it lands inside the clinic's working hours.
 *
 * - `dayOffset >= 0` rolls FORWARD to the next open day (today/future stays
 *   today-or-later); `dayOffset < 0` rolls BACKWARD (past stays past).
 * - The start is clamped into `[open, close - durationMin]` so the whole
 *   appointment fits the chosen day's window. This mirrors
 *   isWithinWorkingHours exactly, so a slot produced here is never a 422.
 */
export function workingSlotISO(
  referenceNow: Date,
  dayOffset: number,
  hour: number,
  minute: number,
  durationMin: number,
  hours: WorkingHours = CLINIC_WORKING_HOURS,
): string {
  const dir = dayOffset < 0 ? -1 : 1;
  const target = new Date(manilaMidnight(referenceNow).getTime() + dayOffset * DAY_MS);

  for (let i = 0; i < 14; i++) {
    const day = new Date(target.getTime() + dir * i * DAY_MS);
    const p = manilaParts(day);
    const win = windowFor(p.weekday, hours);
    if (!win) continue; // closed day
    const latestStart = win.closeMin - durationMin;
    if (latestStart < win.openMin) continue; // window too short for this duration
    const desired = hour * 60 + minute;
    const startMin = Math.min(Math.max(desired, win.openMin), latestStart);
    return manilaInstant(p.y, p.mo, p.d, Math.floor(startMin / 60), startMin % 60).toISOString();
  }

  // Unreachable for the seeded hours, but never throw inside a seed: fall back
  // to the target day's nominal open time.
  const p = manilaParts(target);
  return manilaInstant(p.y, p.mo, p.d, 9, 0).toISOString();
}
