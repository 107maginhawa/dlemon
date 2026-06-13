/**
 * visit-status helper tests.
 *
 * The "New Visit" affordance must be gated on whether the patient already has an
 * OPEN visit (active or draft) — the one-active-visit business rule the backend
 * enforces (409 ACTIVE_VISIT_EXISTS). Offering "New Visit" unconditionally is a
 * false affordance: it is guaranteed to fail whenever a visit is open (which is
 * the state every seeded patient is in). Discarded/completed/locked visits do NOT
 * count as open.
 */
import { describe, test, expect } from 'bun:test';
import { findOpenVisit, canStartNewVisit } from './visit-status';

const v = (id: string, status: string) => ({ id, status });

describe('findOpenVisit', () => {
  test('returns the active visit when one exists', () => {
    expect(findOpenVisit([v('a', 'completed'), v('b', 'active')])?.id).toBe('b');
  });

  test('returns a draft visit (checked-in, not yet activated)', () => {
    expect(findOpenVisit([v('a', 'completed'), v('b', 'draft')])?.id).toBe('b');
  });

  test('returns undefined when only completed/locked visits exist', () => {
    expect(findOpenVisit([v('a', 'completed'), v('b', 'locked')])).toBeUndefined();
  });

  test('ignores discarded visits (not open)', () => {
    expect(findOpenVisit([v('a', 'discarded'), v('b', 'completed')])).toBeUndefined();
  });

  test('returns undefined for an empty list', () => {
    expect(findOpenVisit([])).toBeUndefined();
  });
});

describe('canStartNewVisit', () => {
  test('false when an open visit exists', () => {
    expect(canStartNewVisit([v('a', 'active')])).toBe(false);
    expect(canStartNewVisit([v('a', 'draft')])).toBe(false);
  });

  test('true when no open visit (none / completed / locked / discarded)', () => {
    expect(canStartNewVisit([])).toBe(true);
    expect(canStartNewVisit([v('a', 'completed')])).toBe(true);
    expect(canStartNewVisit([v('a', 'locked')])).toBe(true);
    expect(canStartNewVisit([v('a', 'discarded')])).toBe(true);
  });
});
