/**
 * Locks the "what counts as a visit" rule shared by the folder list, patient
 * profile, statement, and the seed coherence guard. ONLY finished encounters
 * (completed/locked) count. The open in-progress visit (draft/active) shows as
 * "Current" but is NOT counted, and discarded visits never count — so the folder
 * number stays monotonic and matches how clinicians read "how many visits".
 */
import { describe, test, expect } from 'bun:test';
import { isCountedVisit, COUNTED_VISIT_STATUSES } from './visit-dental-patient.facade';

describe('isCountedVisit (visit-count rule)', () => {
  test('finished encounters count', () => {
    expect(isCountedVisit('completed')).toBe(true);
    expect(isCountedVisit('locked')).toBe(true);
  });

  test('open and abandoned visits do not count', () => {
    expect(isCountedVisit('draft')).toBe(false);   // not yet started
    expect(isCountedVisit('active')).toBe(false);  // in progress = "Current"
    expect(isCountedVisit('discarded')).toBe(false);
  });

  test('counted set is exactly completed + locked', () => {
    expect([...COUNTED_VISIT_STATUSES].sort()).toEqual(['completed', 'locked']);
  });
});
