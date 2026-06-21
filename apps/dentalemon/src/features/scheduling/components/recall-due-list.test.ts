/**
 * RecallDueList — unit tests (P1-24, P3)
 *
 * Tests the exported pure helper (formatDueDate). No DOM rendering — mirrors the
 * appointment-card.test.ts convention of testing the stable exported surface.
 */

import { describe, test, expect } from 'bun:test';
import { formatDueDate, canReachOut } from './recall-due-list';

// Regression: ISSUE-022 — "Reach out" on an already-'sent' (Reminded) recall
// PATCHed status:'sent', which the recall FSM rejects (422), and the failure was
// swallowed by a bare catch — front-desk staff got zero feedback and assumed the
// patient was re-contacted. The button must only render when the transition is
// valid (status === 'pending'); the catch now surfaces toastError.
// Found by /qa on 2026-06-20.
// Report: .gstack/qa-reports/qa-report-localhost-2026-06-20.md
describe('canReachOut', () => {
  test('offers reach-out only for a pending (Due) recall', () => {
    expect(canReachOut('pending')).toBe(true);
  });

  test('does NOT offer reach-out for an already-sent (Reminded) recall', () => {
    // sent → sent is an invalid FSM transition (422); offering it = silent failure.
    expect(canReachOut('sent')).toBe(false);
  });

  test('does NOT offer reach-out for terminal recalls', () => {
    expect(canReachOut('completed')).toBe(false);
    expect(canReachOut('cancelled')).toBe(false);
  });
});

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
