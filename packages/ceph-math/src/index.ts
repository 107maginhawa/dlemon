/**
 * Cephalometric math engine — pure, isomorphic (Bun + QuickJS/Tauri).
 * No DB imports. No side effects.
 *
 * Coordinate system: image-space, +y downward (standard for image data).
 * Angles computed via atan2 — rotation-invariant, sign-safe in +y-down space.
 * All output rounded to 2 decimal places for cross-runtime determinism (D8).
 *
 * Reference plane: Sella-Nasion (SN). D-F labels apply — values are NOT
 * interchangeable with Frankfort-referenced norms.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Point = { x: number; y: number };
export type LandmarkMap = Partial<Record<string, Point>>;

export interface AnisotropyOptions {
  rowSpacingMm: number;
  colSpacingMm: number;
}

export interface CephResult {
  measurements: Record<string, number | null>;
  missing: string[];
  uncalibrated: boolean;
}

// ---------------------------------------------------------------------------
// D-A landmark set (D5 — single source of truth, mirrors TypeSpec enum)
// ---------------------------------------------------------------------------

export const LANDMARK_CODES = [
  'S', 'N', 'A', 'B', 'ANS', 'PNS', 'Go', 'Po', 'Me', 'Or',
  'Pog', 'Gn', 'U1T', 'U1A', 'L1T', 'L1A',
] as const;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Angle at vertex formed by v→p1 and v→p2, in degrees [0, 180]. */
function interiorAngleDeg(p1: Point, vertex: Point, p2: Point): number {
  const ax = p1.x - vertex.x;
  const ay = p1.y - vertex.y;
  const bx = p2.x - vertex.x;
  const by = p2.y - vertex.y;
  const dot = ax * bx + ay * by;
  const cross = ax * by - ay * bx;
  return (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
}

/**
 * Signed angle from vector a→b to vector c→d, measured at their intersection.
 * Returns the interior angle at vertex formed by two directed rays.
 * Used for angles that need directionality (SNA, SNB, etc.).
 */
function interiorAngleDegSigned(
  from: Point, vertex: Point, to: Point,
  _referenceFrom?: Point, _referenceTo?: Point,
): number {
  return interiorAngleDeg(from, vertex, to);
}

/** Signed angle of line p1→p2 relative to horizontal, in degrees. */
function lineAngleDeg(p1: Point, p2: Point): number {
  return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
}

/** Angle between two lines (each defined by two points), [0, 90]. */
function acuteAngleBetweenLines(
  a1: Point, a2: Point,
  b1: Point, b2: Point,
): number {
  const ang1 = lineAngleDeg(a1, a2);
  const ang2 = lineAngleDeg(b1, b2);
  let diff = Math.abs(ang1 - ang2) % 180;
  if (diff > 90) diff = 180 - diff;
  return diff;
}

/** Euclidean distance in pixels. */
function dist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Project point p onto line defined by a→b.
 * Returns signed distance from a along the line (+y-down aware).
 */
function projectOntoLine(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return a;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

// ---------------------------------------------------------------------------
// Calibration validation (D-J, D-C)
// ---------------------------------------------------------------------------

const MM_PX_MIN = 0.05;
const MM_PX_MAX = 0.50;
const ANISOTROPY_THRESHOLD = 0.01; // 1%

function validateCalibration(
  pixelSpacingMm: number | null,
  anisotropy?: AnisotropyOptions,
): { spacingMm: number | null; uncalibrated: boolean } {
  if (anisotropy) {
    const ratio = Math.abs(anisotropy.rowSpacingMm - anisotropy.colSpacingMm) /
      Math.max(anisotropy.rowSpacingMm, anisotropy.colSpacingMm);
    if (ratio > ANISOTROPY_THRESHOLD) {
      // Anisotropic pixels corrupt angles — treat as uncalibrated (D-C)
      return { spacingMm: null, uncalibrated: true };
    }
    // Use average spacing
    const avg = (anisotropy.rowSpacingMm + anisotropy.colSpacingMm) / 2;
    if (avg < MM_PX_MIN || avg > MM_PX_MAX) {
      return { spacingMm: null, uncalibrated: true };
    }
    return { spacingMm: avg, uncalibrated: false };
  }

  if (pixelSpacingMm === null) {
    return { spacingMm: null, uncalibrated: false }; // angles still valid
  }
  if (pixelSpacingMm < MM_PX_MIN || pixelSpacingMm > MM_PX_MAX) {
    return { spacingMm: null, uncalibrated: true };
  }
  return { spacingMm: pixelSpacingMm, uncalibrated: false };
}

// ---------------------------------------------------------------------------
// Main engine
// ---------------------------------------------------------------------------

/**
 * Compute cephalometric analysis from a landmark map.
 *
 * @param landmarks  Partial map of landmark code → image-space {x,y} pixel coordinate
 * @param pixelSpacingMm  mm per pixel (null = angles only, no mm metrics)
 * @param anisotropy  Optional separate row/col spacing for anisotropy detection
 */
export function computeCephAnalysis(
  landmarks: LandmarkMap,
  pixelSpacingMm: number | null,
  anisotropy?: AnisotropyOptions,
): CephResult {
  const missing: string[] = [];
  const measurements: Record<string, number | null> = {};

  const { spacingMm, uncalibrated } = validateCalibration(pixelSpacingMm, anisotropy);

  // Landmark accessor — records missing names
  const seen = new Set<string>();
  function get(code: string): Point | null {
    const p = landmarks[code];
    if (!p) {
      if (!seen.has(code)) {
        missing.push(code);
        seen.add(code);
      }
      return null;
    }
    return p;
  }

  // Helper to record a metric (null if any required landmark is absent)
  function angle(name: string, compute: () => number | null) {
    try {
      const v = compute();
      measurements[name] = v !== null ? r2(v) : null;
    } catch {
      measurements[name] = null;
    }
  }

  function mmMetric(name: string, compute: () => number | null) {
    if (!spacingMm) {
      measurements[name] = null;
      return;
    }
    try {
      const v = compute();
      measurements[name] = v !== null ? r2(v * spacingMm) : null;
    } catch {
      measurements[name] = null;
    }
  }

  // Snapshot landmarks (before missing tracking side-effects)
  const S = landmarks['S'] ?? null;
  const N = landmarks['N'] ?? null;
  const A = landmarks['A'] ?? null;
  const B = landmarks['B'] ?? null;
  const Pog = landmarks['Pog'] ?? null;
  const Me = landmarks['Me'] ?? null;
  const Gn = landmarks['Gn'] ?? null;
  const Go = landmarks['Go'] ?? null;
  const U1T = landmarks['U1T'] ?? null;
  const U1A = landmarks['U1A'] ?? null;
  const L1T = landmarks['L1T'] ?? null;
  const L1A = landmarks['L1A'] ?? null;
  const ANS = landmarks['ANS'] ?? null;
  const PNS = landmarks['PNS'] ?? null;

  // Derived: Gn constructed from Pog+Me when both present (D-P), else Me
  const gnDerived: Point | null = Gn ?? (Pog && Me
    ? { x: (Pog.x + Me.x) / 2, y: (Pog.y + Me.y) / 2 }
    : Me);

  // ---------------------------------------------------------------------------
  // Skeletal angles (SN-referenced, D-B / D-F)
  // ---------------------------------------------------------------------------

  // SNA — vertex N, rays N→S and N→A
  angle('sna', () => {
    if (!S || !N || !A) { get('S'); get('N'); get('A'); return null; }
    return interiorAngleDeg(S, N, A);
  });

  // SNB — vertex N, rays N→S and N→B
  angle('snb', () => {
    if (!S || !N || !B) { get('S'); get('N'); get('B'); return null; }
    return interiorAngleDeg(S, N, B);
  });

  // ANB = SNA - SNB (signed; never abs) — negative = Class III (D-M / plan §2)
  angle('anb', () => {
    const sna = measurements['sna'];
    const snb = measurements['snb'];
    if (sna === null || snb === null || sna === undefined || snb === undefined) return null;
    return sna - snb;
  });

  // Convexity N-A-Pog: signed. Positive = A anterior to N-Pog (convex, Class II tendency).
  // Negative = A posterior to N-Pog (concave, Class III). D-M: never abs().
  angle('convexity_napog', () => {
    if (!N || !A || !Pog) { get('N'); get('A'); get('Pog'); return null; }
    const magnitude = 180 - interiorAngleDeg(N, A, Pog);
    // Sign from cross product N→Pog × N→A.
    // In +y-down: negative cross → A anterior to N-Pog → convex → positive.
    const cross = (Pog.x - N.x) * (A.y - N.y) - (Pog.y - N.y) * (A.x - N.x);
    return cross < 0 ? magnitude : -magnitude;
  });

  // SN-GoMe — angle between SN line and Go-Me (mandibular plane)
  angle('sn_gome', () => {
    if (!S || !N || !Go || !Me) { get('S'); get('N'); get('Go'); get('Me'); return null; }
    return acuteAngleBetweenLines(S, N, Go, Me);
  });

  // Facial angle SN — N-Pog vs SN (D-F: not Frankfort variant)
  angle('facial_angle_sn', () => {
    if (!N || !Pog || !S) { get('N'); get('Pog'); get('S'); return null; }
    return acuteAngleBetweenLines(S, N, N, Pog);
  });

  // Y-axis SN — S-Me (or S-Gn if Gn available) vs SN
  angle('y_axis_sn', () => {
    if (!S || !N) { get('S'); get('N'); return null; }
    const target = gnDerived;
    if (!target) { get('Me'); return null; }
    return acuteAngleBetweenLines(S, N, S, target);
  });

  // ---------------------------------------------------------------------------
  // Dental angles
  // ---------------------------------------------------------------------------

  // U1-SN — upper central incisor axis vs SN
  angle('u1_sn', () => {
    if (!U1A || !U1T || !S || !N) { get('U1A'); get('U1T'); get('S'); get('N'); return null; }
    return acuteAngleBetweenLines(S, N, U1A, U1T);
  });

  // IMPA — L1 axis vs GoMe (mandibular plane)
  angle('impa', () => {
    if (!L1A || !L1T || !Go || !Me) { get('L1A'); get('L1T'); get('Go'); get('Me'); return null; }
    return acuteAngleBetweenLines(Go, Me, L1A, L1T);
  });

  // U1-NA angle — upper incisor axis vs NA line
  angle('u1_na_angle', () => {
    if (!U1A || !U1T || !N || !A) { get('U1A'); get('U1T'); get('N'); get('A'); return null; }
    return acuteAngleBetweenLines(N, A, U1A, U1T);
  });

  // L1-NB angle — lower incisor axis vs NB line
  angle('l1_nb_angle', () => {
    if (!L1A || !L1T || !N || !B) { get('L1A'); get('L1T'); get('N'); get('B'); return null; }
    return acuteAngleBetweenLines(N, B, L1A, L1T);
  });

  // Interincisal — angle between directed axes U1A→U1T and L1A→L1T (plan §3)
  angle('interincisal', () => {
    if (!U1A || !U1T || !L1A || !L1T) {
      get('U1A'); get('U1T'); get('L1A'); get('L1T'); return null;
    }
    // Directed axes: apex→tip. Interincisal = angle between these two vectors.
    // Use 180 - acute to get the opening angle between the teeth.
    const acute = acuteAngleBetweenLines(U1A, U1T, L1A, L1T);
    return 180 - acute;
  });

  // ---------------------------------------------------------------------------
  // Linear metrics (mm, require calibration)
  // ---------------------------------------------------------------------------

  // U1-NA distance — perpendicular distance from U1T to NA line
  mmMetric('u1_na_mm', () => {
    if (!U1T || !N || !A) { get('U1T'); get('N'); get('A'); return null; }
    const proj = projectOntoLine(U1T, N, A);
    return dist(U1T, proj);
  });

  // L1-NB distance — perpendicular distance from L1T to NB line
  mmMetric('l1_nb_mm', () => {
    if (!L1T || !N || !B) { get('L1T'); get('N'); get('B'); return null; }
    const proj = projectOntoLine(L1T, N, B);
    return dist(L1T, proj);
  });

  // Overjet — signed horizontal separation of incisal edges, projected on facial axis (plan §4, §5)
  // Facial axis ≈ SN-derived direction. Sign: positive = Class II, negative = Class III (reverse OJ)
  mmMetric('overjet', () => {
    if (!U1T || !L1T) { get('U1T'); get('L1T'); return null; }
    if (!S || !N) { get('S'); get('N'); return null; }
    // Project both incisal tips onto the SN line (facial reference)
    const u1proj = projectOntoLine(U1T, S, N);
    const l1proj = projectOntoLine(L1T, S, N);
    // Signed along facial axis: U1T leads → positive OJ
    const snDx = N.x - S.x;
    const snDy = N.y - S.y;
    const snLen = Math.sqrt(snDx * snDx + snDy * snDy);
    const uDot = ((u1proj.x - S.x) * snDx + (u1proj.y - S.y) * snDy) / snLen;
    const lDot = ((l1proj.x - S.x) * snDx + (l1proj.y - S.y) * snDy) / snLen;
    return uDot - lDot;
  });

  // Overbite — signed vertical separation of incisal edges (plan §4)
  // Perpendicular to facial axis. Positive = overbite, negative = open bite
  mmMetric('overbite', () => {
    if (!U1T || !L1T) { get('U1T'); get('L1T'); return null; }
    if (!S || !N) { get('S'); get('N'); return null; }
    // Perpendicular to SN in +y-down space
    const snDx = N.x - S.x;
    const snDy = N.y - S.y;
    const snLen = Math.sqrt(snDx * snDx + snDy * snDy);
    // Perpendicular unit vector (rotated 90° CW in +y-down = (snDy, -snDx)/len)
    const perpX = snDy / snLen;
    const perpY = -snDx / snLen;
    const uPerp = (U1T.x - S.x) * perpX + (U1T.y - S.y) * perpY;
    const lPerp = (L1T.x - S.x) * perpX + (L1T.y - S.y) * perpY;
    return lPerp - uPerp; // positive when L1T is further down (overbite)
  });

  // Tilt guard: axis_tilt_deg — SN line vs image horizontal (plan §5)
  angle('axis_tilt_deg', () => {
    if (!S || !N) { get('S'); get('N'); return null; }
    return r2(Math.abs(lineAngleDeg(S, N)));
  });

  // ---------------------------------------------------------------------------
  // Ensure all D-A metrics are present in output (null if uncomputed)
  // ---------------------------------------------------------------------------
  const allMetrics = [
    'sna', 'snb', 'anb', 'convexity_napog', 'sn_gome',
    'facial_angle_sn', 'y_axis_sn', 'u1_sn', 'impa',
    'u1_na_angle', 'l1_nb_angle', 'interincisal',
    'u1_na_mm', 'l1_nb_mm', 'overjet', 'overbite', 'axis_tilt_deg',
  ];
  for (const m of allMetrics) {
    if (!(m in measurements)) measurements[m] = null;
  }

  return { measurements, missing: [...new Set(missing)], uncalibrated };
}

export * from './coords'
export * from './norms'
export * from './pattern'
