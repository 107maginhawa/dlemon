/**
 * sources.test.ts — TDD for the deterministic comparator that underpins the
 * coverage-artifact FRESHNESS gate.
 *
 * Run from repo root:  bun test ./scripts/coverage/lib/sources.test.ts
 *
 * WHY this exists: the freshness gate (CI step `git diff --exit-code
 * docs/testing/coverage` after a regen) only holds if a Linux/CI regen is
 * BYTE-identical to the committed (often macOS-generated) artifacts. The matrix
 * row sorts previously used `String.prototype.localeCompare`, whose ordering is
 * ICU/locale-dependent and can differ across Bun versions (CI pins 1.2.21; a dev
 * may run 1.2.19) — a silent source of false-positive diffs. `cmpByCodepoint`
 * sorts by UTF-16 code unit, which is identical on every platform/runtime.
 */

import { describe, expect, test } from 'bun:test';
import { cmpByCodepoint } from './sources';

describe('cmpByCodepoint (env-independent ordering for the freshness gate)', () => {
  test('orders by UTF-16 code unit — uppercase before lowercase (NOT locale-folded)', () => {
    // localeCompare would fold case and return > 0 here; codepoint is the stable choice.
    expect(cmpByCodepoint('B', 'a')).toBeLessThan(0); // 'B'=66 < 'a'=97
    expect(cmpByCodepoint('CephMgmt_x', 'acceptOption')).toBeLessThan(0);
  });

  test('is a total order: returns 0 for equal, sign-symmetric for swaps', () => {
    expect(cmpByCodepoint('x', 'x')).toBe(0);
    expect(Math.sign(cmpByCodepoint('a', 'b'))).toBe(-Math.sign(cmpByCodepoint('b', 'a')));
  });

  test('zero-padded ids sort in their intended numeric order without a numeric collator', () => {
    const ids = ['WF-010', 'WF-002', 'WF-001', 'WF-084'];
    expect([...ids].sort(cmpByCodepoint)).toEqual(['WF-001', 'WF-002', 'WF-010', 'WF-084']);
  });

  test('matches the default Array.sort() string ordering (both are codepoint)', () => {
    const xs = ['delta', 'Alpha', 'bravo', 'Charlie', 'alpha2'];
    expect([...xs].sort(cmpByCodepoint)).toEqual([...xs].sort());
  });
});
