import { describe, test, expect } from 'bun:test';
import type { Point } from './index';
import {
  registerSimilarity,
  applyTransform,
  invertTransform,
  computeLandmarkDeltas,
  computeMetricDeltas,
  computeSuperimposition,
  DegenerateRegistrationError,
  InsufficientRegistrationLandmarksError,
  ReferenceNotImplementedError,
  REGISTRATION_BASIS,
  type SimilarityTransform,
} from './superimposition';

const EPS = 1e-3;

// ─── Synthetic transform generator (oracle) ──────────────────────────────────
// Build B = T·S·R·A for a known (scale, θ, t) and assert recovery within ε.
function forward(p: Point, scale: number, theta: number, tx: number, ty: number): Point {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    x: scale * (cos * p.x - sin * p.y) + tx,
    y: scale * (sin * p.x + cos * p.y) + ty,
  };
}

describe('registerSimilarity — recovers a known synthetic transform', () => {
  // We register fromPts → toPts. Construct toPts = forward(fromPts).
  test.each([
    { scale: 1, theta: 0, tx: 0, ty: 0 }, // identity
    { scale: 1.25, theta: 0.3, tx: 40, ty: -15 },
    { scale: 0.8, theta: -1.1, tx: -200, ty: 333 },
    { scale: 2.0, theta: 2.7, tx: 12.5, ty: 12.5 },
  ])('scale=$scale θ=$theta t=($tx,$ty)', ({ scale, theta, tx, ty }) => {
    const from: Point[] = [
      { x: 100, y: 100 },
      { x: 300, y: 120 },
      { x: 210, y: 400 },
    ];
    const to = from.map((p) => forward(p, scale, theta, tx, ty));
    const t = registerSimilarity(from, to);
    expect(t.scale).toBeCloseTo(scale, 3);
    // rotation may wrap; compare via sin/cos
    expect(Math.cos(t.rotationRad)).toBeCloseTo(Math.cos(theta), 3);
    expect(Math.sin(t.rotationRad)).toBeCloseTo(Math.sin(theta), 3);
    expect(t.tx).toBeCloseTo(tx, 2);
    expect(t.ty).toBeCloseTo(ty, 2);
    // and applying it reproduces the targets
    for (let i = 0; i < from.length; i++) {
      const mapped = applyTransform(from[i]!, t);
      expect(mapped.x).toBeCloseTo(to[i]!.x, 2);
      expect(mapped.y).toBeCloseTo(to[i]!.y, 2);
    }
  });

  test('identity: same landmarks in/out → identity transform', () => {
    const pts: Point[] = [
      { x: 50, y: 60 },
      { x: 150, y: 200 },
    ];
    const t = registerSimilarity(pts, pts);
    expect(t.scale).toBeCloseTo(1, 6);
    expect(Math.abs(Math.sin(t.rotationRad))).toBeLessThan(EPS);
    expect(t.tx).toBeCloseTo(0, 4);
    expect(t.ty).toBeCloseTo(0, 4);
  });

  test('two-point (S–N) case is exact', () => {
    const from: Point[] = [
      { x: 400, y: 300 }, // S
      { x: 500, y: 250 }, // N
    ];
    const to = from.map((p) => forward(p, 1.1, 0.2, 30, -10));
    const t = registerSimilarity(from, to, ['S', 'N']);
    expect(t.basis).toEqual(['S', 'N']);
    for (let i = 0; i < from.length; i++) {
      const m = applyTransform(from[i]!, t);
      expect(m.x).toBeCloseTo(to[i]!.x, 4);
      expect(m.y).toBeCloseTo(to[i]!.y, 4);
    }
  });
});

describe('round-trip / isomorphism (parallels coords.ts inverse tests)', () => {
  test('applyTransform then invertTransform returns original within ε', () => {
    const t: SimilarityTransform = registerSimilarity(
      [
        { x: 10, y: 20 },
        { x: 90, y: 40 },
      ],
      [
        { x: 15, y: 25 },
        { x: 100, y: 55 },
      ],
      ['S', 'N'],
    );
    const inv = invertTransform(t);
    for (const p of [
      { x: 0, y: 0 },
      { x: 123.4, y: -56.7 },
      { x: 999, y: 1000 },
    ]) {
      const back = applyTransform(applyTransform(p, t), inv);
      expect(back.x).toBeCloseTo(p.x, 6);
      expect(back.y).toBeCloseTo(p.y, 6);
    }
  });
});

describe('degenerate input', () => {
  test('coincident source points → DegenerateRegistrationError (not NaN)', () => {
    expect(() =>
      registerSimilarity(
        [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
        ],
        [
          { x: 1, y: 1 },
          { x: 9, y: 9 },
        ],
      ),
    ).toThrow(DegenerateRegistrationError);
  });

  test('coincident target points → DegenerateRegistrationError (not NaN)', () => {
    expect(() =>
      registerSimilarity(
        [
          { x: 1, y: 1 },
          { x: 9, y: 9 },
        ],
        [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
        ],
      ),
    ).toThrow(DegenerateRegistrationError);
  });

  test('fewer than 2 points throws', () => {
    expect(() => registerSimilarity([{ x: 1, y: 1 }], [{ x: 2, y: 2 }])).toThrow(
      DegenerateRegistrationError,
    );
  });
});

describe('computeLandmarkDeltas — mm gated on calibration', () => {
  const transform = registerSimilarity(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    ['S', 'N'],
  ); // identity

  test('known displaced landmark → correct mm magnitude + direction', () => {
    // A point at (0,0) in from; (5,0) in to → after identity transform, Δ = (5,0)px
    const { deltas, uncalibrated } = computeLandmarkDeltas(
      { A: { x: 0, y: 0 } },
      { A: { x: 5, y: 0 } },
      transform,
      { fromPixelSpacingMm: 0.1, toPixelSpacingMm: 0.1 },
    );
    expect(uncalibrated).toBe(false);
    const a = deltas.find((d) => d.landmarkCode === 'A')!;
    expect(a.dxPx).toBe(5);
    expect(a.magnitudePx).toBe(5);
    expect(a.magnitudeMm).toBeCloseTo(0.5, 4); // 5px · 0.1 mm/px
    expect(a.directionDeg).toBeCloseTo(0, 4);
  });

  test('uncalibrated → null mm (never px-as-mm), px still emitted', () => {
    const { deltas, uncalibrated } = computeLandmarkDeltas(
      { A: { x: 0, y: 0 } },
      { A: { x: 3, y: 4 } },
      transform,
      { fromPixelSpacingMm: null, toPixelSpacingMm: 0.1 },
    );
    expect(uncalibrated).toBe(true);
    const a = deltas.find((d) => d.landmarkCode === 'A')!;
    expect(a.magnitudePx).toBe(5);
    expect(a.magnitudeMm).toBeNull();
    expect(a.dxMm).toBeNull();
  });

  test('out-of-range calibration → uncalibrated (mm gate)', () => {
    const { uncalibrated } = computeLandmarkDeltas(
      { A: { x: 0, y: 0 } },
      { A: { x: 1, y: 0 } },
      transform,
      { fromPixelSpacingMm: 0.1, toPixelSpacingMm: 99 },
    );
    expect(uncalibrated).toBe(true);
  });

  test('only landmarks present in both snapshots are compared', () => {
    const { deltas } = computeLandmarkDeltas(
      { A: { x: 0, y: 0 }, B: { x: 1, y: 1 } },
      { A: { x: 0, y: 0 } },
      transform,
      { fromPixelSpacingMm: 0.1, toPixelSpacingMm: 0.1 },
    );
    expect(deltas.map((d) => d.landmarkCode)).toEqual(['A']);
  });
});

describe('computeMetricDeltas — signed Δ, no fabrication', () => {
  test('signed per-metric delta (to − from)', () => {
    const deltas = computeMetricDeltas({ anb: 4.1, sna: 82 }, { anb: 2.3, sna: 82 });
    const anb = deltas.find((d) => d.metric === 'anb')!;
    expect(anb.delta).toBeCloseTo(-1.8, 4);
    const sna = deltas.find((d) => d.metric === 'sna')!;
    expect(sna.delta).toBe(0);
  });

  test('missing key in one snapshot → null delta (no fabricated Δ)', () => {
    const deltas = computeMetricDeltas({ anb: 4 }, { anb: null, impa: 95 });
    expect(deltas.find((d) => d.metric === 'anb')!.delta).toBeNull();
    expect(deltas.find((d) => d.metric === 'impa')!.delta).toBeNull();
  });
});

describe('computeSuperimposition — orchestration', () => {
  const base = {
    reference: 'cranial_base' as const,
    fromLandmarks: { S: { x: 100, y: 100 }, N: { x: 200, y: 90 }, A: { x: 150, y: 200 } },
    toLandmarks: { S: { x: 100, y: 100 }, N: { x: 200, y: 90 }, A: { x: 153, y: 204 } },
    fromMeasurements: { anb: 4.1 },
    toMeasurements: { anb: 2.3 },
    fromPixelSpacingMm: 0.1,
    toPixelSpacingMm: 0.1,
  };

  test('cranial_base happy path: identity registration on S–N → A displacement read', () => {
    const r = computeSuperimposition(base);
    expect(r.reference).toBe('cranial_base');
    expect(r.transform.basis).toEqual(['S', 'N']);
    expect(r.uncalibrated).toBe(false);
    const a = r.landmarkDeltas.find((d) => d.landmarkCode === 'A')!;
    // S,N identical across timepoints → identity → A Δ = (3,4)px = 5px = 0.5mm
    expect(a.magnitudePx).toBeCloseTo(5, 1);
    expect(a.magnitudeMm).toBeCloseTo(0.5, 2);
    const anb = r.metricDeltas.find((d) => d.metric === 'anb')!;
    expect(anb.delta).toBeCloseTo(-1.8, 2);
  });

  test('non-cranial_base reference → ReferenceNotImplementedError in v1', () => {
    expect(() => computeSuperimposition({ ...base, reference: 'maxillary' })).toThrow(
      ReferenceNotImplementedError,
    );
  });

  test('missing basis landmark → InsufficientRegistrationLandmarksError', () => {
    expect(() =>
      computeSuperimposition({
        ...base,
        toLandmarks: { S: { x: 100, y: 100 }, A: { x: 1, y: 1 } }, // N missing
      }),
    ).toThrow(InsufficientRegistrationLandmarksError);
  });

  test('basis declares S,N for cranial_base', () => {
    expect(REGISTRATION_BASIS.cranial_base).toEqual(['S', 'N']);
  });
});
