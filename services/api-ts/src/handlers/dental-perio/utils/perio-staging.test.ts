/**
 * perio-staging unit tests — P1-6 2017 AAP/EFP staging, grading & extent.
 *
 * Thresholds pinned against docs/reviews/research/perio.md §"2017 AAP/EFP
 * classification — Staging & Grading (numeric thresholds)".
 */

import { describe, test, expect } from 'bun:test';
import {
  computeStage,
  computeGrade,
  computeExtent,
  classifyPerio,
} from './perio-staging';

describe('computeStage — interdental CAL primary determinant', () => {
  test('Stage I — CAL 1–2mm, low complexity', () => {
    expect(computeStage({ worstInterdentalCalMm: 2, maxProbingDepthMm: 4 })).toBe('I');
  });

  test('Stage II — CAL 3–4mm', () => {
    expect(computeStage({ worstInterdentalCalMm: 4, maxProbingDepthMm: 5 })).toBe('II');
  });

  test('Stage III — CAL ≥5mm', () => {
    expect(computeStage({ worstInterdentalCalMm: 6, maxProbingDepthMm: 6 })).toBe('III');
  });

  test('complexity bumps CAL-II case to III when PD ≥6mm', () => {
    expect(computeStage({ worstInterdentalCalMm: 4, maxProbingDepthMm: 7 })).toBe('III');
  });

  test('furcation grade II bumps to at least III', () => {
    expect(computeStage({ worstInterdentalCalMm: 3, maxFurcationGrade: 2 })).toBe('III');
  });

  test('tooth loss ≥5 forces Stage IV', () => {
    expect(computeStage({ worstInterdentalCalMm: 6, toothLossCount: 5 })).toBe('IV');
  });

  test('mobility ≥2 on an advanced case forces Stage IV', () => {
    expect(
      computeStage({ worstInterdentalCalMm: 6, maxProbingDepthMm: 6, maxMobilityGrade: 2 }),
    ).toBe('IV');
  });

  test('<20 remaining teeth on an advanced case forces Stage IV', () => {
    expect(
      computeStage({ worstInterdentalCalMm: 5, maxProbingDepthMm: 6, remainingTeeth: 18 }),
    ).toBe('IV');
  });

  test('mobility ≥2 does NOT force IV on an early (Stage I/II) case', () => {
    expect(computeStage({ worstInterdentalCalMm: 2, maxMobilityGrade: 3 })).toBe('I');
  });

  test('returns null without CAL evidence', () => {
    expect(computeStage({ worstInterdentalCalMm: null })).toBeNull();
  });
});

describe('computeGrade — start at B, shift via ratio + modifiers', () => {
  test('default assumption is Grade B with no evidence', () => {
    expect(computeGrade({})).toBe('B');
  });

  test('Grade A — %bone-loss ÷ age < 0.25', () => {
    // 10% bone loss at age 50 → 0.20
    expect(computeGrade({ bonelossPercent: 10, ageYears: 50 })).toBe('A');
  });

  test('Grade B — ratio 0.25–1.0', () => {
    // 30% at age 50 → 0.60
    expect(computeGrade({ bonelossPercent: 30, ageYears: 50 })).toBe('B');
  });

  test('Grade C — ratio > 1.0', () => {
    // 40% at age 30 → 1.33
    expect(computeGrade({ bonelossPercent: 40, ageYears: 30 })).toBe('C');
  });

  test('heavy smoking (≥10/day) forces Grade C even with low ratio', () => {
    expect(computeGrade({ bonelossPercent: 10, ageYears: 50, cigarettesPerDay: 10 })).toBe('C');
  });

  test('light smoking (<10/day) raises Grade A → B', () => {
    expect(computeGrade({ bonelossPercent: 10, ageYears: 50, cigarettesPerDay: 5 })).toBe('B');
  });

  test('diabetes HbA1c ≥7.0 forces Grade C', () => {
    expect(
      computeGrade({ bonelossPercent: 10, ageYears: 50, hasDiabetes: true, hba1cPercent: 7.5 }),
    ).toBe('C');
  });

  test('controlled diabetes (HbA1c <7.0) raises A → B only', () => {
    expect(
      computeGrade({ bonelossPercent: 10, ageYears: 50, hasDiabetes: true, hba1cPercent: 6.5 }),
    ).toBe('B');
  });

  test('direct 5-yr progression ≥2mm → C, overriding indirect ratio', () => {
    expect(computeGrade({ bonelossPercent: 10, ageYears: 50, fiveYearProgressionMm: 2.5 })).toBe('C');
  });

  test('direct 5-yr progression of 0mm → A', () => {
    expect(computeGrade({ fiveYearProgressionMm: 0 })).toBe('A');
  });
});

describe('computeExtent', () => {
  test('localized — <30% of teeth involved', () => {
    expect(computeExtent({ involvedTeeth: 5, totalTeeth: 28 })).toBe('localized'); // ~18%
  });

  test('generalized — ≥30% of teeth involved', () => {
    expect(computeExtent({ involvedTeeth: 10, totalTeeth: 28 })).toBe('generalized'); // ~36%
  });

  test('molar/incisor pattern takes precedence', () => {
    expect(
      computeExtent({ involvedTeeth: 4, totalTeeth: 28, molarIncisorPattern: true }),
    ).toBe('molar_incisor');
  });

  test('returns null with no teeth examined', () => {
    expect(computeExtent({ involvedTeeth: 0, totalTeeth: 0 })).toBeNull();
  });
});

describe('classifyPerio — aggregate', () => {
  test('combines stage, grade and extent', () => {
    const result = classifyPerio(
      { worstInterdentalCalMm: 6, maxProbingDepthMm: 7, toothLossCount: 2 },
      { bonelossPercent: 40, ageYears: 30 },
      { involvedTeeth: 12, totalTeeth: 28 },
    );
    expect(result).toEqual({ stage: 'III', grade: 'C', extent: 'generalized' });
  });
});
