/**
 * Additional cephalometric analyses — Downs, Tweed, McNamara, Jarabak.
 *
 * Each is a genuinely distinct protocol (own reference frame + metric set),
 * implemented only over the 16-code D-A landmark set. Metrics that need landmarks
 * outside the set (Articulare, Basion, Condylion, Pterygoid) are intentionally
 * OMITTED rather than fabricated — same discipline as the Ricketts engine.
 *
 * Pure + isomorphic (Bun + QuickJS/Tauri). No DB imports, no side effects.
 * Local geometry helpers kept independent of the Steiner engine so changes here
 * can never destabilise the shipped Steiner/Ricketts golden values.
 *
 *  - Downs    — Frankfort-Horizontal referenced (Po-Or). facial_angle,
 *               mandibular_plane_angle, interincisal.
 *  - Tweed    — Frankfort triangle: FMA (FH·GoMe), IMPA (L1·GoMe), FMIA (FH·L1).
 *  - McNamara — N-perpendicular-to-FH linear assessment of A and Pog (mm).
 *  - Jarabak  — posterior/anterior facial-height ratio (S-Go / N-Me) %.
 */

import type { LandmarkMap, CephResult, AnisotropyOptions, Point } from './index'

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function lineAngleDeg(p1: Point, p2: Point): number {
  return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI
}

/** Acute angle between two lines, [0, 90]. */
function acuteAngleBetweenLines(a1: Point, a2: Point, b1: Point, b2: Point): number {
  const ang1 = lineAngleDeg(a1, a2)
  const ang2 = lineAngleDeg(b1, b2)
  let diff = Math.abs(ang1 - ang2) % 180
  if (diff > 90) diff = 180 - diff
  return diff
}

function dist(a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

const MM_PX_MIN = 0.05
const MM_PX_MAX = 0.5
const ANISOTROPY_THRESHOLD = 0.01

function validateCalibration(
  pixelSpacingMm: number | null,
  anisotropy?: AnisotropyOptions,
): { spacingMm: number | null; uncalibrated: boolean } {
  if (anisotropy) {
    const ratio =
      Math.abs(anisotropy.rowSpacingMm - anisotropy.colSpacingMm) /
      Math.max(anisotropy.rowSpacingMm, anisotropy.colSpacingMm)
    if (ratio > ANISOTROPY_THRESHOLD) return { spacingMm: null, uncalibrated: true }
    const avg = (anisotropy.rowSpacingMm + anisotropy.colSpacingMm) / 2
    if (avg < MM_PX_MIN || avg > MM_PX_MAX) return { spacingMm: null, uncalibrated: true }
    return { spacingMm: avg, uncalibrated: false }
  }
  if (pixelSpacingMm === null) return { spacingMm: null, uncalibrated: false }
  if (pixelSpacingMm < MM_PX_MIN || pixelSpacingMm > MM_PX_MAX) {
    return { spacingMm: null, uncalibrated: true }
  }
  return { spacingMm: pixelSpacingMm, uncalibrated: false }
}

/**
 * Signed distance (pixels) of point `p` from the perpendicular to line a→b that
 * passes through `origin`. Positive = `p` lies on the +(a→b) side of that
 * perpendicular. Used for N-perpendicular linear assessment (McNamara): a→b is FH,
 * origin is N. A point anterior to the N-perpendicular returns positive.
 */
function signedDistanceFromPerpendicular(
  p: Point,
  origin: Point,
  a: Point,
  b: Point,
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return 0
  // Project (p - origin) onto the unit FH direction.
  return ((p.x - origin.x) * dx + (p.y - origin.y) * dy) / len
}

/**
 * Engine factory shared by the simple protocols below: builds the missing[]
 * tracker + angle/mm recorders, runs `build`, then null-fills declared metrics.
 */
function makeEngine(
  metricKeys: readonly string[],
  landmarks: LandmarkMap,
  pixelSpacingMm: number | null,
  anisotropy: AnisotropyOptions | undefined,
  build: (api: {
    need: (code: string) => Point | null
    angle: (name: string, compute: () => number | null) => void
    mmMetric: (name: string, compute: () => number | null) => void
    ratio: (name: string, compute: () => number | null) => void
  }) => void,
): CephResult {
  const missing: string[] = []
  const measurements: Record<string, number | null> = {}
  const { spacingMm, uncalibrated } = validateCalibration(pixelSpacingMm, anisotropy)

  const seen = new Set<string>()
  function need(code: string): Point | null {
    const p = landmarks[code]
    if (!p) {
      if (!seen.has(code)) {
        missing.push(code)
        seen.add(code)
      }
      return null
    }
    return p
  }

  function angle(name: string, compute: () => number | null) {
    try {
      const v = compute()
      measurements[name] = v !== null ? r2(v) : null
    } catch {
      measurements[name] = null
    }
  }

  function mmMetric(name: string, compute: () => number | null) {
    if (!spacingMm) {
      measurements[name] = null
      return
    }
    try {
      const v = compute()
      measurements[name] = v !== null ? r2(v * spacingMm) : null
    } catch {
      measurements[name] = null
    }
  }

  // Unitless ratios/percentages — independent of calibration.
  function ratio(name: string, compute: () => number | null) {
    try {
      const v = compute()
      measurements[name] = v !== null ? r2(v) : null
    } catch {
      measurements[name] = null
    }
  }

  build({ need, angle, mmMetric, ratio })

  for (const m of metricKeys) {
    if (!(m in measurements)) measurements[m] = null
  }

  return { measurements, missing: [...new Set(missing)], uncalibrated }
}

// ---------------------------------------------------------------------------
// Downs (Frankfort-Horizontal referenced)
// ---------------------------------------------------------------------------

const DOWNS_METRICS = ['facial_angle', 'mandibular_plane_angle', 'interincisal'] as const

export function computeDownsAnalysis(
  landmarks: LandmarkMap,
  pixelSpacingMm: number | null,
  anisotropy?: AnisotropyOptions,
): CephResult {
  return makeEngine(DOWNS_METRICS, landmarks, pixelSpacingMm, anisotropy, ({ need, angle }) => {
    // Facial angle: FH (Po-Or) vs facial line (N-Pog).
    angle('facial_angle', () => {
      const Po = need('Po'), Or = need('Or'), N = need('N'), Pog = need('Pog')
      if (!Po || !Or || !N || !Pog) return null
      return acuteAngleBetweenLines(Po, Or, N, Pog)
    })
    // Mandibular plane angle: FH (Po-Or) vs mandibular plane (Go-Me).
    angle('mandibular_plane_angle', () => {
      const Po = need('Po'), Or = need('Or'), Go = need('Go'), Me = need('Me')
      if (!Po || !Or || !Go || !Me) return null
      return acuteAngleBetweenLines(Po, Or, Go, Me)
    })
    // Interincisal angle: opening angle between U1 and L1 axes.
    angle('interincisal', () => {
      const U1A = need('U1A'), U1T = need('U1T'), L1A = need('L1A'), L1T = need('L1T')
      if (!U1A || !U1T || !L1A || !L1T) return null
      return 180 - acuteAngleBetweenLines(U1A, U1T, L1A, L1T)
    })
  })
}

// ---------------------------------------------------------------------------
// Tweed (Frankfort triangle — FMA / IMPA / FMIA)
// ---------------------------------------------------------------------------

const TWEED_METRICS = ['fma', 'impa', 'fmia'] as const

export function computeTweedAnalysis(
  landmarks: LandmarkMap,
  pixelSpacingMm: number | null,
  anisotropy?: AnisotropyOptions,
): CephResult {
  return makeEngine(TWEED_METRICS, landmarks, pixelSpacingMm, anisotropy, ({ need, angle }) => {
    // FMA: FH (Po-Or) vs mandibular plane (Go-Me).
    angle('fma', () => {
      const Po = need('Po'), Or = need('Or'), Go = need('Go'), Me = need('Me')
      if (!Po || !Or || !Go || !Me) return null
      return acuteAngleBetweenLines(Po, Or, Go, Me)
    })
    // IMPA: lower incisor axis (L1A-L1T) vs mandibular plane (Go-Me).
    angle('impa', () => {
      const L1A = need('L1A'), L1T = need('L1T'), Go = need('Go'), Me = need('Me')
      if (!L1A || !L1T || !Go || !Me) return null
      return acuteAngleBetweenLines(Go, Me, L1A, L1T)
    })
    // FMIA: FH (Po-Or) vs lower incisor axis (L1A-L1T).
    angle('fmia', () => {
      const Po = need('Po'), Or = need('Or'), L1A = need('L1A'), L1T = need('L1T')
      if (!Po || !Or || !L1A || !L1T) return null
      return acuteAngleBetweenLines(Po, Or, L1A, L1T)
    })
  })
}

// ---------------------------------------------------------------------------
// McNamara (Nasion-perpendicular-to-FH linear assessment, mm)
// ---------------------------------------------------------------------------

const MCNAMARA_METRICS = ['a_to_nperp', 'pog_to_nperp'] as const

export function computeMcNamaraAnalysis(
  landmarks: LandmarkMap,
  pixelSpacingMm: number | null,
  anisotropy?: AnisotropyOptions,
): CephResult {
  return makeEngine(MCNAMARA_METRICS, landmarks, pixelSpacingMm, anisotropy, ({ need, mmMetric }) => {
    // A to the N-perpendicular (perpendicular to FH through N). Positive = anterior.
    mmMetric('a_to_nperp', () => {
      const A = need('A'), N = need('N'), Po = need('Po'), Or = need('Or')
      if (!A || !N || !Po || !Or) return null
      return signedDistanceFromPerpendicular(A, N, Po, Or)
    })
    // Pog to the N-perpendicular. Positive = anterior (well-balanced males are slightly negative).
    mmMetric('pog_to_nperp', () => {
      const Pog = need('Pog'), N = need('N'), Po = need('Po'), Or = need('Or')
      if (!Pog || !N || !Po || !Or) return null
      return signedDistanceFromPerpendicular(Pog, N, Po, Or)
    })
  })
}

// ---------------------------------------------------------------------------
// Jarabak (posterior/anterior facial-height ratio)
// ---------------------------------------------------------------------------

const JARABAK_METRICS = ['pa_fhr'] as const

export function computeJarabakAnalysis(
  landmarks: LandmarkMap,
  pixelSpacingMm: number | null,
  anisotropy?: AnisotropyOptions,
): CephResult {
  return makeEngine(JARABAK_METRICS, landmarks, pixelSpacingMm, anisotropy, ({ need, ratio }) => {
    // Posterior/anterior facial-height ratio = (S-Go / N-Me) * 100.
    // Unitless ratio — calibration cancels, so it is valid even uncalibrated.
    ratio('pa_fhr', () => {
      const S = need('S'), Go = need('Go'), N = need('N'), Me = need('Me')
      if (!S || !Go || !N || !Me) return null
      const anterior = dist(N, Me)
      if (anterior === 0) return null
      return (dist(S, Go) / anterior) * 100
    })
  })
}
