/**
 * Regression: ISSUE-009 — invoice Due Date rendered as a raw ISO timestamp
 * ("2026-06-19T16:05:51.990Z") instead of a formatted calendar date, while
 * Visit Date (a date-only string) rendered fine. The SDK serializes dueDate as
 * a full Date->ISO string; the display now goes through formatInvoiceDate.
 * Found by /qa on 2026-06-20 (Workspace clinical batch).
 * Report: .gstack/qa-reports/qa-report-localhost-2026-06-20.md
 */

import { describe, test, expect } from 'bun:test';
import { formatInvoiceDate } from './invoice-detail.helpers';

describe('formatInvoiceDate — ISSUE-009', () => {
  test('drops the time component from a full ISO timestamp', () => {
    const out = formatInvoiceDate('2026-06-19T16:05:51.990Z');
    // No leaked time/zone artifacts in the rendered string.
    expect(out).not.toContain('T');
    expect(out).not.toContain('Z');
    expect(out).not.toContain(':');
    expect(out).not.toContain('.990');
    expect(out.length).toBeGreaterThan(0);
  });

  test('renders a date-only string without leaking time and without TZ day-shift', () => {
    const out = formatInvoiceDate('2026-06-19');
    expect(out).not.toContain('T');
    expect(out).not.toContain(':');
    // Parsed as local midnight, so the calendar day must be preserved.
    expect(out).toContain('19');
    expect(out).toContain('2026');
  });

  test('returns empty string for undefined (field hidden by caller guard)', () => {
    expect(formatInvoiceDate(undefined)).toBe('');
    expect(formatInvoiceDate('')).toBe('');
  });

  test('falls back to the raw value when unparseable (never worse than before)', () => {
    expect(formatInvoiceDate('not-a-date')).toBe('not-a-date');
  });
});
