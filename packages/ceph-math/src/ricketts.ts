/**
 * Ricketts cephalometric analysis — Frankfort-Horizontal-referenced.
 *
 * Genuinely distinct from the Steiner-SN analysis (which references Sella-Nasion):
 * Ricketts measures against Frankfort Horizontal (Porion-Orbitale) and the A-Pog
 * (facial) line. Only the subset of Ricketts metrics computable from the 16-code
 * D-A landmark set is implemented — metrics needing Basion / Pterygoid (e.g. the
 * facial axis) are intentionally omitted rather than fabricated.
 *
 * Pure + isomorphic. Local geometry helpers (kept independent of the Steiner engine
 * so changes here can never destabilise the shipped Steiner golden values).
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

function projectOntoLine(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return a
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  return { x: a.x + t * dx, y: a.y + t * dy }
}

/**
 * Signed perpendicular distance of `p` from the directed line a→b (pixels).
 * Positive when `p` is on the anterior (cross < 0) side — matches the convexity
 * sign convention used by the Steiner engine.
 */
function signedPerpDistance(p: Point, a: Point, b: Point): number {
  const proj = projectOntoLine(p, a, b)
  const magnitude = dist(p, proj)
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
  return cross < 0 ? magnitude : -magnitude
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

/** Ricketts metric keys emitted (null when uncomputable). */
const RICKETTS_METRICS = [
  'facial_angle',
  'mandibular_plane_fh',
  'convexity_mm',
  'l1_apog_angle',
  'l1_apog_mm',
  'interincisal',
] as const

export function computeRickettsAnalysis(
  landmarks: LandmarkMap,
  pixelSpacingMm: number | null,
  anisotropy?: AnisotropyOptions,
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

  // Facial angle: FH (Po-Or) vs facial line (N-Pog).
  angle('facial_angle', () => {
    const Po = need('Po'), Or = need('Or'), N = need('N'), Pog = need('Pog')
    if (!Po || !Or || !N || !Pog) return null
    return acuteAngleBetweenLines(Po, Or, N, Pog)
  })

  // Mandibular plane angle: FH (Po-Or) vs mandibular plane (Go-Me).
  angle('mandibular_plane_fh', () => {
    const Po = need('Po'), Or = need('Or'), Go = need('Go'), Me = need('Me')
    if (!Po || !Or || !Go || !Me) return null
    return acuteAngleBetweenLines(Po, Or, Go, Me)
  })

  // Convexity: signed distance of A from the N-Pog facial line (mm).
  mmMetric('convexity_mm', () => {
    const A = need('A'), N = need('N'), Pog = need('Pog')
    if (!A || !N || !Pog) return null
    return signedPerpDistance(A, N, Pog)
  })

  // Lower incisor to A-Pog: axis angle and tip distance.
  angle('l1_apog_angle', () => {
    const L1A = need('L1A'), L1T = need('L1T'), A = need('A'), Pog = need('Pog')
    if (!L1A || !L1T || !A || !Pog) return null
    return acuteAngleBetweenLines(A, Pog, L1A, L1T)
  })

  mmMetric('l1_apog_mm', () => {
    const L1T = need('L1T'), A = need('A'), Pog = need('Pog')
    if (!L1T || !A || !Pog) return null
    return signedPerpDistance(L1T, A, Pog)
  })

  // Interincisal angle: U1 axis vs L1 axis (opening angle).
  angle('interincisal', () => {
    const U1A = need('U1A'), U1T = need('U1T'), L1A = need('L1A'), L1T = need('L1T')
    if (!U1A || !U1T || !L1A || !L1T) return null
    return 180 - acuteAngleBetweenLines(U1A, U1T, L1A, L1T)
  })

  for (const m of RICKETTS_METRICS) {
    if (!(m in measurements)) measurements[m] = null
  }

  return { measurements, missing: [...new Set(missing)], uncalibrated }
}
