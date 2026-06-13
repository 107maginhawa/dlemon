/**
 * fee-resolution.test.ts — unit tests for the canonical fee price-resolution helper.
 *
 * dental-org G2 (decision §5 = DRIVE pricing). The single rule for resolving the
 * effective price of a CDT code: a per-branch override (settings.feeSchedule[cdt])
 * wins; otherwise fall back to the global catalog default; otherwise 0.
 */
import { describe, test, expect } from 'bun:test';
import { resolveFeeCents } from './fee-resolution';

describe('resolveFeeCents', () => {
  test('returns the per-branch override when set', () => {
    expect(resolveFeeCents({ D1110: 25000 }, 'D1110', 50000)).toBe(25000);
  });

  test('falls back to the catalog default when no override', () => {
    expect(resolveFeeCents({ D0120: 5000 }, 'D1110', 50000)).toBe(50000);
  });

  test('honours an override of 0 (not treated as "unset")', () => {
    expect(resolveFeeCents({ D1110: 0 }, 'D1110', 50000)).toBe(0);
  });

  test('falls back to catalog default when overrides is null/undefined', () => {
    expect(resolveFeeCents(null, 'D1110', 50000)).toBe(50000);
    expect(resolveFeeCents(undefined, 'D1110', 50000)).toBe(50000);
  });

  test('returns 0 when neither override nor catalog default is available', () => {
    expect(resolveFeeCents({}, 'D9999', null)).toBe(0);
    expect(resolveFeeCents({}, 'D9999', undefined)).toBe(0);
  });
});
