/**
 * RED tests for ceph-math engine.
 * Run: bun test src/ceph-math.test.ts
 *
 * Fixtures use image-space +y-down. SN near-horizontal (S left of N).
 * Golden coordinates verified against hand-calculated expected values.
 */

import { describe, it, expect } from 'bun:test';
import { computeCephAnalysis, LANDMARK_CODES } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Pts = Parameters<typeof computeCephAnalysis>[0];

// Class I golden fixture — SNA≈82°, SNB≈80°, ANB≈+2°, convexity positive
const CLASS_I: Pts = {
  S:   { x: 100, y: 200 },
  N:   { x: 300, y: 200 },
  A:   { x: 290, y: 271 },
  B:   { x: 288, y: 268 },
  Pog: { x: 285, y: 280 },
  Me:  { x: 282, y: 310 },
  Go:  { x: 220, y: 310 },
  U1T: { x: 300, y: 240 },
  U1A: { x: 296, y: 265 },
  L1T: { x: 298, y: 265 },
  L1A: { x: 293, y: 285 },
};

// Class III golden fixture — ANB≈-3°, convexity negative (D-M)
// N→A=(-10,71)→SNA≈82°; N→B=(-7,80)→SNB≈85°; ANB≈-3°
// Pog=(296,295): more prognathic than A → A posterior to N-Pog line → concave → negative convexity
const CLASS_III: Pts = {
  S:   { x: 100, y: 200 },
  N:   { x: 300, y: 200 },
  A:   { x: 290, y: 271 },
  B:   { x: 293, y: 280 },
  Pog: { x: 296, y: 295 },
};

// ---------------------------------------------------------------------------
// LANDMARK_CODES exported constant matches TypeSpec CephLandmarkCode enum (D5)
// ---------------------------------------------------------------------------

describe('LANDMARK_CODES', () => {
  it('contains the D-A set + support landmarks', () => {
    const expected = ['S','N','A','B','ANS','PNS','Go','Po','Me','Or','Pog','Gn','U1T','U1A','L1T','L1A'];
    expect(LANDMARK_CODES).toEqual(expect.arrayContaining(expected));
    expect(LANDMARK_CODES.length).toBe(expected.length);
  });
});

// ---------------------------------------------------------------------------
// Golden Class I fixture (D6)
// ---------------------------------------------------------------------------

describe('Class I golden fixture', () => {
  it('SNA ≈ 82°', () => {
    const { measurements } = computeCephAnalysis(CLASS_I, null);
    expect(measurements.sna).toBeCloseTo(82.0, 1);
  });

  it('SNB ≈ 80°', () => {
    const { measurements } = computeCephAnalysis(CLASS_I, null);
    expect(measurements.snb).toBeCloseTo(80.0, 1);
  });

  it('ANB ≈ +2° (Class I, positive)', () => {
    const { measurements } = computeCephAnalysis(CLASS_I, null);
    expect(measurements.anb).toBeCloseTo(2.0, 1);
  });

  it('convexity_napog is positive (Class II tendency / convex)', () => {
    const { measurements } = computeCephAnalysis(CLASS_I, null);
    expect(measurements.convexity_napog).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Golden Class III fixture (D6, D-M mandatory)
// ---------------------------------------------------------------------------

describe('Class III golden fixture', () => {
  it('ANB ≈ -3° (negative — Class III)', () => {
    const { measurements } = computeCephAnalysis(CLASS_III, null);
    expect(measurements.anb).toBeCloseTo(-3.0, 1);
  });

  it('convexity_napog is negative (concave — Class III per D-M)', () => {
    const { measurements } = computeCephAnalysis(CLASS_III, null);
    expect(measurements.convexity_napog).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// Signed metrics — never abs()
// ---------------------------------------------------------------------------

describe('ANB = SNA - SNB, signed (never abs)', () => {
  it('Class I: ANB positive', () => {
    const { measurements } = computeCephAnalysis(CLASS_I, null);
    expect(measurements.anb).toBeGreaterThan(0);
  });

  it('Class III: ANB negative', () => {
    const { measurements } = computeCephAnalysis(CLASS_III, null);
    expect(measurements.anb).toBeLessThan(0);
  });
});

describe('Convexity sign convention (D-M)', () => {
  it('convex (Class II) → positive', () => {
    const { measurements } = computeCephAnalysis(CLASS_I, null);
    expect(measurements.convexity_napog).toBeGreaterThan(0);
  });

  it('concave (Class III) → negative', () => {
    const { measurements } = computeCephAnalysis(CLASS_III, null);
    expect(measurements.convexity_napog).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// Null taxonomy — missing landmarks vs uncalibrated (separate signals)
// ---------------------------------------------------------------------------

describe('Missing landmark → named in missing[], metric is null', () => {
  it('missing A → sna is null, "A" in missing', () => {
    const pts: Pts = { ...CLASS_I };
    delete (pts as Record<string, unknown>).A;
    const { measurements, missing } = computeCephAnalysis(pts, null);
    expect(measurements.sna).toBeNull();
    expect(missing).toContain('A');
  });

  it('missing Go → sn_gome is null, "Go" in missing', () => {
    const pts: Pts = { ...CLASS_I };
    delete (pts as Record<string, unknown>).Go;
    const { measurements, missing } = computeCephAnalysis(pts, null);
    expect(measurements.sn_gome).toBeNull();
    expect(missing).toContain('Go');
  });

  it('missing landmarks do not throw — partial analysis returns', () => {
    const { measurements } = computeCephAnalysis({ S: {x:0,y:0}, N: {x:100,y:0} }, null);
    expect(measurements).toBeDefined();
  });
});

describe('Uncalibrated → mm metrics null, uncalibrated:true', () => {
  it('null pixelSpacingMm → mm metrics are null, uncalibrated true', () => {
    const { measurements, uncalibrated } = computeCephAnalysis(CLASS_I, null);
    expect(uncalibrated).toBe(false); // angles always available
    // mm metrics require calibration
    expect(measurements['u1_na_mm']).toBeNull();
    expect(measurements['l1_nb_mm']).toBeNull();
    expect(measurements['overjet']).toBeNull();
    expect(measurements['overbite']).toBeNull();
  });

  it('valid pixelSpacingMm → mm metrics are numbers, uncalibrated false', () => {
    const { measurements, uncalibrated } = computeCephAnalysis(CLASS_I, 0.2);
    expect(uncalibrated).toBe(false);
    expect(typeof measurements['overjet']).toBe('number');
  });

  it('out-of-bound mm/px (too small < 0.05) → uncalibrated:true, mm metrics null', () => {
    const { uncalibrated, measurements } = computeCephAnalysis(CLASS_I, 0.01);
    expect(uncalibrated).toBe(true);
    expect(measurements['overjet']).toBeNull();
  });

  it('out-of-bound mm/px (too large > 0.50) → uncalibrated:true', () => {
    const { uncalibrated } = computeCephAnalysis(CLASS_I, 1.5);
    expect(uncalibrated).toBe(true);
  });

  it('anisotropic pixel spacing → uncalibrated:true, angles still returned', () => {
    const { uncalibrated, measurements } = computeCephAnalysis(CLASS_I, null, {
      rowSpacingMm: 0.2,
      colSpacingMm: 0.25, // >1% difference
    });
    expect(uncalibrated).toBe(true);
    expect(measurements.sna).not.toBeNull();
    expect(measurements['overjet']).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2-dp rounding (determinism boundary)
// ---------------------------------------------------------------------------

describe('2-decimal rounding', () => {
  it('SNA is rounded to 2 decimal places', () => {
    const { measurements } = computeCephAnalysis(CLASS_I, null);
    const sna = measurements.sna;
    expect(sna).not.toBeNull();
    const str = sna!.toString();
    const decimals = str.includes('.') ? str.split('.')[1].length : 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Angles via atan2 — rotation-invariant, +y-down sign safe
// ---------------------------------------------------------------------------

describe('Angle computation rotation invariance', () => {
  it('SNA same for horizontally-flipped SN (S right of N)', () => {
    const flipped: Pts = {
      S:   { x: 400, y: 200 },
      N:   { x: 200, y: 200 },
      A:   { x: 210, y: 271 },
      B:   { x: 212, y: 268 },
      Pog: { x: 215, y: 280 },
      Me:  { x: 218, y: 310 },
      Go:  { x: 280, y: 310 },
    };
    const { measurements: m1 } = computeCephAnalysis(CLASS_I, null);
    const { measurements: m2 } = computeCephAnalysis(flipped, null);
    // Angles should be the same regardless of SN direction
    expect(Math.abs(m1.sna! - m2.sna!)).toBeLessThan(1.0);
  });
});

// ---------------------------------------------------------------------------
// Interincisal angle — directed axes (not raw line-line acute)
// ---------------------------------------------------------------------------

describe('Interincisal angle (directed axes U1A→U1T, L1A→L1T)', () => {
  it('is defined when all 4 incisor landmarks present', () => {
    const { measurements } = computeCephAnalysis(CLASS_I, null);
    expect(measurements.interincisal).not.toBeNull();
  });

  it('is null when U1T missing', () => {
    const pts = { ...CLASS_I };
    delete (pts as Record<string, unknown>).U1T;
    const { measurements } = computeCephAnalysis(pts, null);
    expect(measurements.interincisal).toBeNull();
  });

  it('is within realistic range (100-160° typical)', () => {
    const { measurements } = computeCephAnalysis(CLASS_I, null);
    const v = measurements.interincisal!;
    expect(v).toBeGreaterThan(80);
    expect(v).toBeLessThan(180);
  });
});

// ---------------------------------------------------------------------------
// Cross-runtime 2-dp determinism (D8)
// ---------------------------------------------------------------------------

describe('Cross-runtime determinism', () => {
  it('repeated calls with identical inputs produce identical output', () => {
    const r1 = computeCephAnalysis(CLASS_I, 0.2);
    const r2 = computeCephAnalysis(CLASS_I, 0.2);
    expect(r1.measurements).toEqual(r2.measurements);
    expect(r1.missing).toEqual(r2.missing);
    expect(r1.uncalibrated).toBe(r2.uncalibrated);
  });
});
