/**
 * Test #1 — auto-advance sequence generator.
 *
 * The full-mouth exam is ~500 inputs; correct, fast sequencing is the make-or-break
 * UX. This locks the order (maxillary-first, facial-then-lingual), the wrap to the
 * next tooth, adult vs primary tooth sets, and back-navigation.
 */

import { describe, test, expect } from 'bun:test';
import {
  buildPerioSequence,
  nextStepIndex,
  prevStepIndex,
  nextToothFirstStepIndex,
  ADULT_FDI_TEETH,
  PRIMARY_FDI_TEETH,
  PERIO_SITES,
} from './perio-types';

describe('buildPerioSequence', () => {
  test('adult sequence has 32 teeth × 6 sites = 192 steps', () => {
    const seq = buildPerioSequence('adult');
    expect(seq).toHaveLength(ADULT_FDI_TEETH.length * 6);
    expect(seq).toHaveLength(192);
  });

  test('primary sequence has 20 teeth × 6 sites = 120 steps', () => {
    const seq = buildPerioSequence('primary');
    expect(seq).toHaveLength(PRIMARY_FDI_TEETH.length * 6);
    expect(seq).toHaveLength(120);
  });

  test('starts maxillary (tooth 18) at the buccal-mesial site', () => {
    const seq = buildPerioSequence('adult');
    expect(seq[0]).toEqual({ tooth: 18, site: 'BM' });
  });

  test('walks the buccal pass then the lingual pass within a tooth', () => {
    const seq = buildPerioSequence('adult');
    const first6 = seq.slice(0, 6).map((s) => s.site);
    expect(first6).toEqual([...PERIO_SITES]);
    // buccal sites precede lingual sites
    expect(first6.slice(0, 3)).toEqual(['BM', 'BC', 'BD']);
    expect(first6.slice(3, 6)).toEqual(['LM', 'LC', 'LD']);
  });

  test('maxillary teeth all precede mandibular teeth', () => {
    const seq = buildPerioSequence('adult');
    const firstMandibularIdx = seq.findIndex((s) => s.tooth >= 31 && s.tooth <= 48);
    const lastMaxillaryIdx = seq.map((s) => s.tooth).lastIndexOf(28);
    expect(firstMandibularIdx).toBeGreaterThan(lastMaxillaryIdx);
  });
});

describe('navigation helpers', () => {
  const seq = buildPerioSequence('adult');

  test('nextStepIndex advances to the next site within a tooth', () => {
    expect(nextStepIndex(seq, { tooth: 18, site: 'BM' })).toBe(1);
    expect(seq[1]).toEqual({ tooth: 18, site: 'BC' });
  });

  test('nextStepIndex wraps from a tooth last site to the next tooth first site', () => {
    const idx = nextStepIndex(seq, { tooth: 18, site: 'LD' });
    expect(idx).toBe(6);
    expect(seq[6]).toEqual({ tooth: 17, site: 'BM' });
  });

  test('nextStepIndex is null at the very last step', () => {
    const last = seq[seq.length - 1];
    expect(nextStepIndex(seq, last)).toBeNull();
  });

  test('prevStepIndex steps back, null at the start', () => {
    expect(prevStepIndex(seq, { tooth: 18, site: 'BM' })).toBeNull();
    expect(prevStepIndex(seq, { tooth: 18, site: 'BC' })).toBe(0);
  });

  test('nextToothFirstStepIndex jumps to the first site of the following tooth', () => {
    const idx = nextToothFirstStepIndex(seq, 18);
    expect(idx).toBe(6);
    expect(seq[6]).toEqual({ tooth: 17, site: 'BM' });
  });

  test('nextToothFirstStepIndex is null on the last tooth', () => {
    expect(nextToothFirstStepIndex(seq, 48)).toBeNull();
  });
});
