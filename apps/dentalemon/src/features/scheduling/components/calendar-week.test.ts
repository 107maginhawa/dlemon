/**
 * CalendarWeek component tests — pure logic helpers
 *
 * Tests: week date generation, slot positioning, height,
 * chip time formatting, ID truncation
 */

import { describe, test, expect } from 'bun:test';
import {
  getWeekDates,
  getTopPx,
  getHeightPx,
  formatChipTime,
  truncateId,
} from './calendar-week';

// ---------------------------------------------------------------------------
// getWeekDates
// ---------------------------------------------------------------------------

describe('CalendarWeek — getWeekDates', () => {
  test('returns 7 dates starting from weekStart', () => {
    const dates = getWeekDates('2026-06-01');
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('2026-06-01');
    expect(dates[6]).toBe('2026-06-07');
  });

  test('increments day-by-day across month boundary', () => {
    const dates = getWeekDates('2026-05-30');
    expect(dates[0]).toBe('2026-05-30');
    expect(dates[1]).toBe('2026-05-31');
    expect(dates[2]).toBe('2026-06-01');
    expect(dates[6]).toBe('2026-06-05');
  });

  test('each entry is ISO YYYY-MM-DD format', () => {
    const dates = getWeekDates('2026-01-05');
    for (const d of dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// getTopPx
// ---------------------------------------------------------------------------

describe('CalendarWeek — getTopPx', () => {
  test('appointment at 07:00 is at 0px (day start)', () => {
    // 07:00 UTC on 2026-06-01
    const iso = new Date('2026-06-01T07:00:00').toISOString();
    expect(getTopPx(iso)).toBe(0);
  });

  test('appointment at 07:30 is 48px (one slot)', () => {
    const iso = new Date('2026-06-01T07:30:00').toISOString();
    expect(getTopPx(iso)).toBe(48);
  });

  test('appointment at 08:00 is 96px (two slots)', () => {
    const iso = new Date('2026-06-01T08:00:00').toISOString();
    expect(getTopPx(iso)).toBe(96);
  });
});

// ---------------------------------------------------------------------------
// getHeightPx
// ---------------------------------------------------------------------------

describe('CalendarWeek — getHeightPx', () => {
  test('30-minute appointment is 44px (48 - 4 gutter)', () => {
    expect(getHeightPx(30)).toBe(44);
  });

  test('60-minute appointment is 92px', () => {
    expect(getHeightPx(60)).toBe(92);
  });

  test('very short appointment clamps to minimum 30px', () => {
    expect(getHeightPx(5)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// formatChipTime
// ---------------------------------------------------------------------------

describe('CalendarWeek — formatChipTime', () => {
  test('formats 09:00 as 9:00 AM', () => {
    const iso = new Date('2026-06-01T09:00:00').toISOString();
    expect(formatChipTime(iso)).toBe('9:00 AM');
  });

  test('formats 13:30 as 1:30 PM', () => {
    const iso = new Date('2026-06-01T13:30:00').toISOString();
    expect(formatChipTime(iso)).toBe('1:30 PM');
  });

  test('formats midnight (00:00) as 12:00 AM', () => {
    const iso = new Date('2026-06-01T00:00:00').toISOString();
    expect(formatChipTime(iso)).toBe('12:00 AM');
  });

  test('formats noon (12:00) as 12:00 PM', () => {
    const iso = new Date('2026-06-01T12:00:00').toISOString();
    expect(formatChipTime(iso)).toBe('12:00 PM');
  });
});

// ---------------------------------------------------------------------------
// truncateId
// ---------------------------------------------------------------------------

describe('CalendarWeek — truncateId', () => {
  test('short IDs pass through unchanged', () => {
    expect(truncateId('abc123')).toBe('abc123');
  });

  test('IDs at maxLen boundary pass through unchanged', () => {
    expect(truncateId('12345678')).toBe('12345678');
  });

  test('long UUIDs are truncated with ellipsis', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const result = truncateId(uuid);
    expect(result).toBe('a1b2c3d4...');
    expect(result.length).toBe(11); // 8 chars + '...'
  });

  test('custom maxLen is respected', () => {
    const result = truncateId('hello-world', 5);
    expect(result).toBe('hello...');
  });
});
