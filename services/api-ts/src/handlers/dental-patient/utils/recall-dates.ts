/**
 * recall-dates.ts (P1-24)
 *
 * Date helpers for the recall (continuing-care) engine. Recall `dueDate` is a
 * `YYYY-MM-DD` text value (a calendar date, not an instant). Due-ness is judged
 * against "today in the branch timezone" so a Manila clinic's recalls roll over
 * at local midnight, not UTC midnight.
 *
 * Pure functions — trivially unit-testable across timezone boundaries.
 */

/** Today's calendar date (YYYY-MM-DD) in the given IANA timezone. */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD; timeZone shifts to the branch's local day.
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    // Unknown tz → fall back to UTC date.
    return now.toISOString().slice(0, 10);
  }
}

/** Add a whole number of months to a YYYY-MM-DD date, clamping the day-of-month. */
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return dateStr;
  // JS months are 0-based; Date in UTC avoids tz drift on the calendar math.
  const base = new Date(Date.UTC(y, m - 1, 1));
  base.setUTCMonth(base.getUTCMonth() + months);
  // Clamp day to the last day of the target month.
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const yy = base.getUTCFullYear().toString().padStart(4, '0');
  const mm = (base.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** True when `dueDate` (YYYY-MM-DD) is on or before `today` (YYYY-MM-DD). */
export function isDueOnOrBefore(dueDate: string, today: string): boolean {
  // Lexicographic comparison is valid for zero-padded ISO dates.
  return dueDate <= today;
}
