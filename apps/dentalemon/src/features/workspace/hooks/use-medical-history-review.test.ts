/**
 * isReviewDue — P1-4 periodic re-confirmation logic
 *
 * "Due for review" when the history was reviewed > ~6 months ago, or never.
 */

import { describe, test, expect } from 'bun:test';
import { isReviewDue, REVIEW_DUE_MONTHS } from './use-medical-history-review';

const now = new Date('2026-06-01T00:00:00Z');

describe('isReviewDue', () => {
  test('never reviewed (null/undefined) is due', () => {
    expect(isReviewDue(null, now)).toBe(true);
    expect(isReviewDue(undefined, now)).toBe(true);
  });

  test('reviewed within the window is NOT due', () => {
    // 2 months ago
    expect(isReviewDue('2026-04-01T00:00:00Z', now)).toBe(false);
  });

  test('reviewed beyond the window IS due', () => {
    // 8 months ago (> 6)
    expect(isReviewDue('2025-10-01T00:00:00Z', now)).toBe(true);
  });

  test('exactly at the threshold edge', () => {
    const threshold = new Date(now);
    threshold.setMonth(threshold.getMonth() - REVIEW_DUE_MONTHS);
    // One day inside the window is not due
    const inside = new Date(threshold);
    inside.setDate(inside.getDate() + 1);
    expect(isReviewDue(inside.toISOString(), now)).toBe(false);
  });

  test('unparseable timestamp is treated as due', () => {
    expect(isReviewDue('not-a-date', now)).toBe(true);
  });
});
