import { describe, test, expect } from 'bun:test';
import {
  DAYS,
  defaultWorkingHours,
  toCanonical,
  fromCanonical,
  validateWorkingHours,
  type WorkingHoursMap,
} from './working-hours.logic';

/**
 * G1-shape (P0 gate): the editor shape `{ open:boolean, start, end }` must
 * serialize to the ENFORCED canonical shape `{ enabled, open, close }` that the
 * scheduler reads off `dental_branch.working_hours`. The `open` field flips
 * meaning across the two shapes (boolean "is open" vs "opening time"); a payload
 * written without this transform is silently parsed as closed/unset.
 */
describe('working-hours toCanonical — editor → enforced shape', () => {
  test('maps open(boolean)→enabled and start/end→open/close (NOT the colliding open field)', () => {
    const wh = defaultWorkingHours();
    const canonical = toCanonical(wh);

    // Monday is open 09:00–17:00 by default.
    expect(canonical.monday).toEqual({ enabled: true, open: '09:00', close: '17:00' });
    // The editor boolean must NOT leak into the canonical `open` time field.
    expect(typeof canonical.monday!.open).toBe('string');
    expect(typeof canonical.monday!.enabled).toBe('boolean');
  });

  test('closed day → enabled:false', () => {
    const canonical = toCanonical(defaultWorkingHours());
    expect(canonical.sunday!.enabled).toBe(false);
  });

  test('every day carries the enforced keys', () => {
    const canonical = toCanonical(defaultWorkingHours());
    for (const day of DAYS) {
      expect(canonical[day]).toHaveProperty('enabled');
      expect(canonical[day]).toHaveProperty('open');
      expect(canonical[day]).toHaveProperty('close');
    }
  });
});

describe('working-hours fromCanonical — enforced → editor shape', () => {
  test('maps enabled→open(boolean) and open/close→start/end', () => {
    const editor = fromCanonical({ monday: { enabled: true, open: '08:00', close: '12:00' } });
    expect(editor.monday).toEqual({ open: true, start: '08:00', end: '12:00' });
  });

  test('absent day → closed (open:false)', () => {
    const editor = fromCanonical({ monday: { enabled: true, open: '09:00', close: '17:00' } });
    expect(editor.tuesday.open).toBe(false);
  });

  test('enabled day with missing times falls back to defaults', () => {
    const editor = fromCanonical({ monday: { enabled: true } });
    expect(editor.monday).toEqual({ open: true, start: '09:00', end: '17:00' });
  });

  test('null/undefined → all-default editor map', () => {
    expect(fromCanonical(null)).toEqual(defaultWorkingHours());
  });
});

describe('working-hours round-trip', () => {
  test('editor → canonical → editor is stable', () => {
    const wh: WorkingHoursMap = defaultWorkingHours();
    wh.monday = { open: true, start: '08:30', end: '16:30' };
    wh.saturday = { open: true, start: '10:00', end: '14:00' };
    expect(fromCanonical(toCanonical(wh))).toEqual(wh);
  });
});

describe('working-hours validation', () => {
  test('valid default → no errors', () => {
    expect(validateWorkingHours(defaultWorkingHours())).toHaveLength(0);
  });
  test('start >= end → error', () => {
    const wh = defaultWorkingHours();
    wh.monday = { open: true, start: '17:00', end: '09:00' };
    expect(validateWorkingHours(wh)).toContain('monday: start must be before end');
  });
});
