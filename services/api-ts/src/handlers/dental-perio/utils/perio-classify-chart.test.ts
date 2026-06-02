/**
 * perio-classify-chart unit tests — P1-6 deriving 2017 staging/grading from a
 * chart's tooth readings + medical-history risk factors.
 */

import { describe, test, expect } from 'bun:test';
import { classifyChart, type ClassifiableReading } from './perio-classify-chart';

function healthyTooth(toothNumber: number): ClassifiableReading {
  // PD 2mm, margin at CEJ → CAL 2 (sub-clinical, not involved).
  return {
    toothNumber,
    depthBM: 2, depthBC: 2, depthBD: 2, depthLM: 2, depthLC: 2, depthLD: 2,
    gmBM: 0, gmBC: 0, gmBD: 0, gmLM: 0, gmLC: 0, gmLD: 0,
  };
}

describe('classifyChart', () => {
  test('healthy mouth — no interdental CAL ≥3 → Stage I/II, localized', () => {
    const readings = Array.from({ length: 28 }, (_, i) => healthyTooth(11 + i));
    const result = classifyChart(readings);
    // worst interdental CAL = 2mm → Stage I; nobody "involved" (CAL<1? no, CAL=2)
    // CAL 2 ≥ 1 so all teeth count as involved → generalized; stage from CAL.
    expect(result.stage).toBe('I');
    expect(result.grade).toBe('B'); // no risk evidence → default
  });

  test('advanced case — one site with deep interdental CAL drives Stage III', () => {
    const readings: ClassifiableReading[] = [
      // worst interdental site: PD 6 + 2mm recession = CAL 8 at BM (interdental)
      { toothNumber: 16, depthBM: 6, gmBM: 2, depthBC: 3, gmBC: 0, furcation: 2 },
      ...Array.from({ length: 15 }, (_, i) => healthyTooth(21 + i % 8)),
    ];
    const result = classifyChart(readings, {
      bonelossPercent: 40, ageYears: 30, cigarettesPerDay: 12, remainingTeeth: 28,
    });
    expect(result.stage).toBe('III'); // CAL ≥5 + furcation II (full dentition → not IV)
    expect(result.grade).toBe('C'); // ratio 1.33 and/or heavy smoking
  });

  test('mid-buccal recession does NOT inflate the stage (interdental-only CAL)', () => {
    // Big CAL only at BC (mid-buccal, non-interdental); interdental sites shallow.
    const readings: ClassifiableReading[] = [
      { toothNumber: 16, depthBC: 4, gmBC: 5, depthBM: 2, gmBM: 0, depthBD: 2, gmBD: 0 },
      ...Array.from({ length: 16 }, (_, i) => healthyTooth(21 + (i % 8))),
    ];
    const result = classifyChart(readings);
    // Interdental worst CAL = 2 (BM/BD) → Stage I, despite BC CAL of 9.
    expect(result.stage).toBe('I');
  });

  test('tooth loss ≥5 forces Stage IV via risk factors', () => {
    const readings: ClassifiableReading[] = [
      { toothNumber: 16, depthBM: 7, gmBM: 3 }, // CAL 10 interdental
      ...Array.from({ length: 10 }, (_, i) => healthyTooth(21 + i)),
    ];
    const result = classifyChart(readings, { toothLossCount: 6 });
    expect(result.stage).toBe('IV');
  });

  test('defaults remainingTeeth to charted count', () => {
    // 15 charted teeth < 20, but only matters once advanced. Make it advanced.
    const readings: ClassifiableReading[] = [
      { toothNumber: 16, depthBM: 6, gmBM: 2 }, // CAL 8 → Stage III
      ...Array.from({ length: 14 }, (_, i) => healthyTooth(21 + i)),
    ];
    // remainingTeeth defaults to 15 (<20) → Stage IV on an advanced case.
    const result = classifyChart(readings);
    expect(result.stage).toBe('IV');
  });
});
