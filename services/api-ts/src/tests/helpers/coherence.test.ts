/**
 * Unit tests for the backend coherence oracle `assertEndpointTotalEqualsRepoSum`.
 *
 * Pure function — no DB. Tests the three contract guarantees that mirror the FE
 * oracle: (1) total == Σ rows passes; (2) a mismatch throws; (3) a non-zero
 * total with zero rows throws (the EM-BIL-002 "all-tenant sum, no rows" shape).
 */

import { describe, test, expect } from 'bun:test';
import { assertEndpointTotalEqualsRepoSum } from './coherence';

describe('assertEndpointTotalEqualsRepoSum', () => {
  test('passes when the total equals the sum of the returned rows', () => {
    expect(() =>
      assertEndpointTotalEqualsRepoSum({ total: 5000, rowAmounts: [2000, 3000] }),
    ).not.toThrow();
  });

  test('passes for the empty case (zero total, zero rows)', () => {
    expect(() =>
      assertEndpointTotalEqualsRepoSum({ total: 0, rowAmounts: [] }),
    ).not.toThrow();
  });

  test('throws when the total does not match the sum of the rows (scope drift)', () => {
    // Total is summed across a wider scope (95000) than the rows it ships (5000).
    expect(() =>
      assertEndpointTotalEqualsRepoSum({ total: 95000, rowAmounts: [5000], label: 'AR total' }),
    ).toThrow(/AR total reads 95000 but the 1 returned row\(s\) sum to 5000/);
  });

  test('throws when a non-zero total is returned with zero rows to explain it', () => {
    // The "all-tenant sum, no rows" leak shape. The sum-mismatch branch fires
    // first (Σ[] = 0 ≠ 90000) — same ordering as the FE oracle — so the message
    // reports the mismatch; the dedicated zero-rows guard is defense-in-depth.
    expect(() =>
      assertEndpointTotalEqualsRepoSum({ total: 90000, rowAmounts: [], label: 'AR total' }),
    ).toThrow(/AR total reads 90000 but the 0 returned row\(s\) sum to 0/);
  });

  test('compares in integer minor units (tolerates float-representation drift)', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in IEEE-754; minor-unit rounding agrees.
    expect(() =>
      assertEndpointTotalEqualsRepoSum({ total: 0.3, rowAmounts: [0.1, 0.2] }),
    ).not.toThrow();
  });
});
