/**
 * RecallDueList — unit tests (P1-24, P3)
 *
 * Tests the exported pure helper (formatDueDate). No DOM rendering — mirrors the
 * appointment-card.test.ts convention of testing the stable exported surface.
 */

import { describe, test, expect } from 'bun:test';
import { formatDueDate } from './recall-due-list';

describe('formatDueDate', () => {
  test('renders a YYYY-MM-DD due date as a locale date with no TZ drift', () => {
    // 2026-06-15 must render as June 15 regardless of the runner's local timezone.
    const out = formatDueDate('2026-06-15');
    expect(out).toContain('15');
    expect(out).toContain('2026');
    expect(out.toLowerCase()).toContain('jun');
  });

  test('passes through a malformed date unchanged', () => {
    expect(formatDueDate('not-a-date')).toBe('not-a-date');
  });

  test('handles the first of the month without rolling back a day', () => {
    const out = formatDueDate('2026-01-01');
    expect(out).toContain('1');
    expect(out).toContain('2026');
    expect(out.toLowerCase()).toContain('jan');
  });
});
