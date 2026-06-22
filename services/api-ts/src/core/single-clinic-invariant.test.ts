/**
 * Pure-predicate unit test for the single-clinic RLS trip-wire (plan 014 S5).
 * The DB-querying script (scripts/check-single-clinic-invariant.ts) is a release
 * gate, not a suite test; this pins the decision logic it keys off.
 */

import { describe, test, expect } from 'bun:test';
import {
  violatesSingleClinicInvariant,
  RLS_FULLY_ACTIVATED,
} from '../../scripts/check-single-clinic-invariant';

describe('violatesSingleClinicInvariant', () => {
  test('0 or 1 org is always fine (no tenant boundary to cross)', () => {
    expect(violatesSingleClinicInvariant(0, false)).toBe(false);
    expect(violatesSingleClinicInvariant(1, false)).toBe(false);
  });

  test('>1 org while RLS NOT fully activated is a violation', () => {
    expect(violatesSingleClinicInvariant(2, false)).toBe(true);
    expect(violatesSingleClinicInvariant(10, false)).toBe(true);
  });

  test('>1 org is permitted once RLS is fully activated', () => {
    expect(violatesSingleClinicInvariant(2, true)).toBe(false);
    expect(violatesSingleClinicInvariant(50, true)).toBe(false);
  });

  test('the gate currently treats RLS as NOT fully activated (ADR-010 P3b deferred)', () => {
    // Guards the lift: flipping this constant is a deliberate, reviewed event.
    expect(RLS_FULLY_ACTIVATED).toBe(false);
  });
});
