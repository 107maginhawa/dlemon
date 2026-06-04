/**
 * Test #8 — furcation control soft-gate for single-rooted FDI teeth.
 *
 * Furcation grading is clinically meaningless on single-rooted teeth. The backend
 * does not gate this, so the FE disables the control for incisors, canines, and
 * single-rooted premolars. Molars (and the two-rooted maxillary first premolar)
 * keep the control enabled.
 */

import { describe, test, expect } from 'bun:test';
import { isSingleRooted } from './perio-types';

describe('isSingleRooted', () => {
  test('central + lateral incisors are single-rooted', () => {
    for (const t of [11, 21, 31, 41, 12, 22, 32, 42]) {
      expect(isSingleRooted(t)).toBe(true);
    }
  });

  test('canines are single-rooted', () => {
    for (const t of [13, 23, 33, 43]) {
      expect(isSingleRooted(t)).toBe(true);
    }
  });

  test('molars are multi-rooted (control enabled)', () => {
    for (const t of [16, 17, 18, 26, 36, 46, 47, 48]) {
      expect(isSingleRooted(t)).toBe(false);
    }
  });

  test('maxillary first premolar (commonly two-rooted) is NOT gated', () => {
    expect(isSingleRooted(14)).toBe(false);
    expect(isSingleRooted(24)).toBe(false);
  });

  test('mandibular first premolar is single-rooted', () => {
    expect(isSingleRooted(34)).toBe(true);
    expect(isSingleRooted(44)).toBe(true);
  });

  test('second premolars are single-rooted', () => {
    for (const t of [15, 25, 35, 45]) {
      expect(isSingleRooted(t)).toBe(true);
    }
  });
});
