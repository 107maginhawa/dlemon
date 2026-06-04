/**
 * P1-26 — Coverage estimate engine tests (pure calculator).
 *
 * Covers: covered/patient split, annual-limit capping, excluded procedures,
 * itemized per-procedure caps, blanket caps, zero-coverage cash patient, and
 * integer-centavo edge values. Model after rounding.test.ts.
 */

import { describe, test, expect } from 'bun:test';
import { estimateCoverage, type EstimateLineInput } from './coverage-estimate';

const lines = (...specs: Array<[string, number]>): EstimateLineInput[] =>
  specs.map(([cdtCode, billedAmountCents]) => ({ cdtCode, billedAmountCents }));

describe('estimateCoverage — cash patient (no active profile)', () => {
  test('fully patient-pay; nothing covered', () => {
    const r = estimateCoverage(lines(['D1110', 100000], ['D2391', 250000]), {
      hasActiveProfile: false,
    });
    expect(r.estimatedCoveredCents).toBe(0);
    expect(r.estimatedPatientPortionCents).toBe(350000);
    expect(r.estimatedBilledCents).toBe(350000);
    expect(r.uncoveredProcedures).toEqual(['D1110', 'D2391']);
    expect(r.cappedByAnnualLimit).toBe(false);
  });
});

describe('estimateCoverage — blanket approved cap', () => {
  test('covers up to billed when uncapped', () => {
    const r = estimateCoverage(lines(['D1110', 100000]), {
      hasActiveProfile: true,
    });
    expect(r.estimatedCoveredCents).toBe(100000);
    expect(r.estimatedPatientPortionCents).toBe(0);
  });

  test('blanket approvedAmount caps total coverage; patient pays the excess', () => {
    const r = estimateCoverage(lines(['D1110', 100000], ['D2391', 250000]), {
      hasActiveProfile: true,
      approvedAmountCents: 120000,
    });
    expect(r.estimatedCoveredCents).toBe(120000);
    expect(r.estimatedPatientPortionCents).toBe(230000);
    // First line fully covered (100000), second covered to remaining 20000.
    expect(r.perLine[0]!.coveredCents).toBe(100000);
    expect(r.perLine[1]!.coveredCents).toBe(20000);
    expect(r.perLine[1]!.patientPortionCents).toBe(230000);
  });
});

describe('estimateCoverage — itemized covered procedures', () => {
  test('only listed CDT codes are covered; others are patient portion', () => {
    const r = estimateCoverage(lines(['D1110', 100000], ['D2740', 800000]), {
      hasActiveProfile: true,
      coveredProcedures: [{ cdtCode: 'D1110' }],
    });
    expect(r.perLine[0]!.coveredCents).toBe(100000);
    expect(r.perLine[1]!.coveredCents).toBe(0);
    expect(r.perLine[1]!.uncovered).toBe(true);
    expect(r.uncoveredProcedures).toEqual(['D2740']);
    expect(r.estimatedCoveredCents).toBe(100000);
    expect(r.estimatedPatientPortionCents).toBe(800000);
  });

  test('per-procedure approvedAmount caps the covered amount for that line', () => {
    const r = estimateCoverage(lines(['D2391', 250000]), {
      hasActiveProfile: true,
      coveredProcedures: [{ cdtCode: 'D2391', approvedAmountCents: 150000 }],
    });
    expect(r.perLine[0]!.coveredCents).toBe(150000);
    expect(r.perLine[0]!.patientPortionCents).toBe(100000);
  });
});

describe('estimateCoverage — annual limit capping', () => {
  test('annual limit clips coverage and flags cappedByAnnualLimit', () => {
    const r = estimateCoverage(lines(['D1110', 100000], ['D2391', 250000]), {
      hasActiveProfile: true,
      annualLimitRemainingCents: 120000,
    });
    expect(r.estimatedCoveredCents).toBe(120000);
    expect(r.cappedByAnnualLimit).toBe(true);
  });

  test('exhausted annual limit covers nothing', () => {
    const r = estimateCoverage(lines(['D1110', 100000]), {
      hasActiveProfile: true,
      annualLimitRemainingCents: 0,
    });
    expect(r.estimatedCoveredCents).toBe(0);
    expect(r.estimatedPatientPortionCents).toBe(100000);
    expect(r.cappedByAnnualLimit).toBe(true);
  });

  test('annual limit not flagged when it never binds', () => {
    const r = estimateCoverage(lines(['D1110', 100000]), {
      hasActiveProfile: true,
      annualLimitRemainingCents: 500000,
    });
    expect(r.estimatedCoveredCents).toBe(100000);
    expect(r.cappedByAnnualLimit).toBe(false);
  });
});

describe('estimateCoverage — invariants & edges', () => {
  test('covered + patient always equals billed for every line', () => {
    const r = estimateCoverage(lines(['D1110', 99999], ['D2391', 1], ['D2740', 350001]), {
      hasActiveProfile: true,
      approvedAmountCents: 100000,
      annualLimitRemainingCents: 200000,
    });
    for (const l of r.perLine) {
      expect(l.coveredCents + l.patientPortionCents).toBe(l.billedAmountCents);
      expect(l.coveredCents).toBeGreaterThanOrEqual(0);
      expect(l.patientPortionCents).toBeGreaterThanOrEqual(0);
    }
    expect(r.estimatedCoveredCents + r.estimatedPatientPortionCents).toBe(r.estimatedBilledCents);
  });

  test('empty line set yields zeros', () => {
    const r = estimateCoverage([], { hasActiveProfile: true });
    expect(r.estimatedCoveredCents).toBe(0);
    expect(r.estimatedPatientPortionCents).toBe(0);
    expect(r.perLine).toHaveLength(0);
  });

  test('negative billed amounts clamp to zero', () => {
    const r = estimateCoverage(lines(['D1110', -500]), { hasActiveProfile: true });
    expect(r.estimatedBilledCents).toBe(0);
    expect(r.perLine[0]!.coveredCents).toBe(0);
  });
});
