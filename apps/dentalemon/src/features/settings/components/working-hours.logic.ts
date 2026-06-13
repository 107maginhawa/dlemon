/**
 * working-hours.logic.ts — pure (no React/SDK) working-hours transforms.
 *
 * The Settings editor uses an ergonomic per-day shape `{ open, start, end }`,
 * but the ENFORCED contract (the `dental_branch.working_hours` column read by
 * the scheduler in `createAppointment`) is the canonical `{ enabled, open, close }`
 * shape (decision §6: backend shape is canonical). `open` is a boolean in the
 * editor shape but an "opening time string" in the canonical shape — a field-name
 * collision that silently mis-parses if the editor payload is written straight to
 * the column. These transforms reconcile the two so the UI write lands in the
 * shape the scheduler enforces.
 */

export type DayOfWeek =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const DAYS: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

/** Editor shape (FE-ergonomic). */
export interface DaySchedule {
  open: boolean;
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}
export type WorkingHoursMap = Record<DayOfWeek, DaySchedule>;

/** Canonical/enforced shape persisted to `dental_branch.working_hours`. */
export interface CanonicalDaySchedule {
  enabled: boolean;
  open?: string;  // "HH:mm"
  close?: string; // "HH:mm"
}
export type CanonicalWorkingHours = Partial<Record<DayOfWeek, CanonicalDaySchedule>>;

export function defaultWorkingHours(): WorkingHoursMap {
  const base = {} as WorkingHoursMap;
  for (const day of DAYS) {
    base[day] = { open: day !== 'sunday', start: '09:00', end: '17:00' };
  }
  return base;
}

/**
 * Editor → canonical. `open` (boolean) becomes `enabled`; `start`/`end` become
 * the `open`/`close` time strings the scheduler enforces.
 */
export function toCanonical(hours: WorkingHoursMap): CanonicalWorkingHours {
  const out: CanonicalWorkingHours = {};
  for (const day of DAYS) {
    const d = hours[day];
    out[day] = { enabled: d.open, open: d.start, close: d.end };
  }
  return out;
}

/**
 * Canonical → editor. A day absent from the column, or `enabled:false`, renders
 * as closed; missing times fall back to the 09:00–17:00 defaults so the selects
 * always have a value.
 */
export function fromCanonical(raw: CanonicalWorkingHours | null | undefined): WorkingHoursMap {
  const result = defaultWorkingHours();
  if (!raw) return result;
  for (const day of DAYS) {
    const d = raw[day];
    if (!d) { result[day] = { ...result[day], open: false }; continue; }
    result[day] = {
      open: !!d.enabled,
      start: typeof d.open === 'string' ? d.open : result[day].start,
      end: typeof d.close === 'string' ? d.close : result[day].end,
    };
  }
  return result;
}

export function validateWorkingHours(hours: WorkingHoursMap): string[] {
  const errors: string[] = [];
  for (const day of DAYS) {
    const d = hours[day];
    if (!d.open) continue;
    if (!/^\d{2}:\d{2}$/.test(d.start)) { errors.push(`${day}: invalid start time`); continue; }
    if (!/^\d{2}:\d{2}$/.test(d.end)) { errors.push(`${day}: invalid end time`); continue; }
    if (d.start >= d.end) errors.push(`${day}: start must be before end`);
  }
  return errors;
}
