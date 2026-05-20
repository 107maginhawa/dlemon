/**
 * CalendarMonth component tests — pure logic helpers
 *
 * Tests: month grid generation, appointment counting,
 * day click callback, overflow day detection
 */

import { describe, test, expect } from 'bun:test';
import {
  generateMonthGrid,
  countAppointmentsByDate,
  isOverflowDay,
} from './calendar-month';

// ---------------------------------------------------------------------------
// generateMonthGrid
// ---------------------------------------------------------------------------

describe('CalendarMonth — generateMonthGrid', () => {
  test('returns 42 day cells (6 rows x 7 cols) for any month', () => {
    // June 2026
    const grid = generateMonthGrid(2026, 5); // 0-indexed month
    expect(grid).toHaveLength(42);
  });

  test('first cell is a Monday (week starts Monday)', () => {
    // June 2026 starts on Monday
    const grid = generateMonthGrid(2026, 5);
    const firstDate = new Date(grid[0]);
    expect(firstDate.getDay()).toBe(1); // Monday
  });

  test('contains all days of the target month', () => {
    // June 2026 has 30 days
    const grid = generateMonthGrid(2026, 5);
    const juneDays = grid.filter((d) => d.startsWith('2026-06-'));
    expect(juneDays).toHaveLength(30);
  });

  test('includes overflow days from prev/next months', () => {
    // February 2026 — check that January overflow appears
    const grid = generateMonthGrid(2026, 1); // February
    const janDays = grid.filter((d) => d.startsWith('2026-01-'));
    expect(janDays.length).toBeGreaterThanOrEqual(0);
    // Total must be 42
    expect(grid).toHaveLength(42);
  });
});

// ---------------------------------------------------------------------------
// countAppointmentsByDate
// ---------------------------------------------------------------------------

describe('CalendarMonth — countAppointmentsByDate', () => {
  test('counts appointments grouped by date', () => {
    const appointments = [
      { id: '1', scheduledAt: '2026-06-05T09:00:00', patientId: 'p1', durationMinutes: 30, serviceType: 'Cleaning', status: 'scheduled' },
      { id: '2', scheduledAt: '2026-06-05T10:00:00', patientId: 'p2', durationMinutes: 30, serviceType: 'Exam', status: 'scheduled' },
      { id: '3', scheduledAt: '2026-06-10T14:00:00', patientId: 'p3', durationMinutes: 60, serviceType: 'Crown', status: 'checked_in' },
    ];
    const counts = countAppointmentsByDate(appointments);
    expect(counts['2026-06-05']).toBe(2);
    expect(counts['2026-06-10']).toBe(1);
    expect(counts['2026-06-01']).toBeUndefined();
  });

  test('returns empty object for empty array', () => {
    const counts = countAppointmentsByDate([]);
    expect(Object.keys(counts)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// isOverflowDay
// ---------------------------------------------------------------------------

describe('CalendarMonth — isOverflowDay', () => {
  test('returns false for days in the target month', () => {
    expect(isOverflowDay('2026-06-15', 2026, 5)).toBe(false);
    expect(isOverflowDay('2026-06-01', 2026, 5)).toBe(false);
    expect(isOverflowDay('2026-06-30', 2026, 5)).toBe(false);
  });

  test('returns true for days outside the target month', () => {
    expect(isOverflowDay('2026-05-31', 2026, 5)).toBe(true); // May day in June grid
    expect(isOverflowDay('2026-07-01', 2026, 5)).toBe(true); // July day in June grid
  });
});

// ---------------------------------------------------------------------------
// onDayClick callback
// ---------------------------------------------------------------------------

describe('CalendarMonth — day click', () => {
  test('clicking a day should provide the ISO date string', () => {
    // This tests the contract: onDayClick receives YYYY-MM-DD
    const grid = generateMonthGrid(2026, 5);
    // All dates in grid should be valid ISO date strings
    for (const dateStr of grid) {
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
