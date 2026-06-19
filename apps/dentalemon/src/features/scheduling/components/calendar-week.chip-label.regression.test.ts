/**
 * Regression: ISSUE-011 — Week view rendered appointment chips with the raw
 * patient UUID ("af269b48...") instead of the patient name, even though the
 * Appointment carries patientName (the Day view already preferred the name).
 * Found by /qa on 2026-06-20 (Calendar batch).
 * Report: .gstack/qa-reports/qa-report-localhost-2026-06-20.md
 */

import { describe, test, expect } from 'bun:test';
import { chipLabel } from './calendar-week';

describe('CalendarWeek chipLabel — ISSUE-011', () => {
  test('prefers the patient name when present (not the UUID)', () => {
    const label = chipLabel({
      patientName: 'Juan dela Cruz',
      patientId: 'af269b48-efb6-4ee4-9ca6-c972c094778a',
    });
    expect(label).toBe('Juan dela Cruz');
    expect(label).not.toContain('af269');
  });

  test('falls back to a truncated id when the name is absent', () => {
    const label = chipLabel({ patientId: 'af269b48-efb6-4ee4-9ca6-c972c094778a' });
    expect(label).toBe('af269b48...');
  });

  test('empty-string name is treated as present (no UUID leak for blank names)', () => {
    // ?? only falls back on null/undefined, matching the day-view contract.
    expect(chipLabel({ patientName: '', patientId: 'abcd1234-0000' })).toBe('');
  });
});
