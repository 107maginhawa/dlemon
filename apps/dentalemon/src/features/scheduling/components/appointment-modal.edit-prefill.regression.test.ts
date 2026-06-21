/**
 * Regression: ISSUE-012 — the Edit Appointment modal opened with every field
 * blank (it never loaded the appointment), so rescheduling forced re-entry of
 * patient/date/time/service and tripped "Patient ID is required". The modal now
 * pre-populates from the appointment; splitScheduledAt feeds the date/time
 * inputs and must round-trip with buildTimeRange (both use local wall-clock).
 * Found by /qa on 2026-06-20 (Calendar batch).
 * Report: .gstack/qa-reports/qa-report-localhost-2026-06-20.md
 */

import { describe, test, expect } from 'bun:test';
import { splitScheduledAt, buildTimeRange } from './appointment-modal';

describe('splitScheduledAt — ISSUE-012', () => {
  test('round-trips with buildTimeRange (same instant)', () => {
    // Build an ISO instant the way the modal does, then split it back.
    const { startAt } = buildTimeRange('2026-06-19', '14:00', 30);
    const { date, time } = splitScheduledAt(startAt);
    // Re-building from the split values must yield the identical instant.
    expect(buildTimeRange(date, time, 30).startAt).toBe(startAt);
  });

  test('produces YYYY-MM-DD and HH:MM shapes for the date/time inputs', () => {
    const { startAt } = buildTimeRange('2026-01-05', '09:05', 60);
    const { date, time } = splitScheduledAt(startAt);
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(time).toMatch(/^\d{2}:\d{2}$/);
  });

  test('returns empty fields for an unparseable value (no NaN leak into inputs)', () => {
    expect(splitScheduledAt('not-a-date')).toEqual({ date: '', time: '' });
  });
});
