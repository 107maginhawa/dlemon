/**
 * Unit tests for recall date helpers (P1-24). Pure functions; cover timezone
 * boundaries (plan §7 / step B1 "across timezone/date boundaries").
 */

import { describe, test, expect } from 'bun:test';
import { todayInTimezone, addMonths, isDueOnOrBefore } from './recall-dates';

describe('recall-dates', () => {
  test('todayInTimezone yields the local calendar date (Manila vs UTC differ near midnight)', () => {
    // 2026-06-02T16:30:00Z = 2026-06-03 00:30 in Asia/Manila (+08).
    const instant = new Date('2026-06-02T16:30:00Z');
    expect(todayInTimezone('UTC', instant)).toBe('2026-06-02');
    expect(todayInTimezone('Asia/Manila', instant)).toBe('2026-06-03');
  });

  test('todayInTimezone falls back to UTC date for an unknown timezone', () => {
    const instant = new Date('2026-06-02T10:00:00Z');
    expect(todayInTimezone('Not/AZone', instant)).toBe('2026-06-02');
  });

  test('addMonths advances whole months', () => {
    expect(addMonths('2026-01-15', 6)).toBe('2026-07-15');
    expect(addMonths('2026-06-30', 6)).toBe('2026-12-30');
  });

  test('addMonths clamps day-of-month at month boundaries', () => {
    // Jan 31 + 1 month → Feb 28 (2026 is not a leap year).
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    // Aug 31 + 1 month → Sep 30.
    expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
  });

  test('addMonths rolls over the year', () => {
    expect(addMonths('2026-11-10', 3)).toBe('2027-02-10');
  });

  test('isDueOnOrBefore compares ISO dates lexicographically', () => {
    expect(isDueOnOrBefore('2026-06-01', '2026-06-02')).toBe(true);
    expect(isDueOnOrBefore('2026-06-02', '2026-06-02')).toBe(true);
    expect(isDueOnOrBefore('2026-06-03', '2026-06-02')).toBe(false);
  });
});
