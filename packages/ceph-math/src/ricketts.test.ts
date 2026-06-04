import { describe, test, expect } from 'bun:test'
import { computeRickettsAnalysis } from './ricketts'
import { computeAnalysis, ANALYSIS_TYPES } from './index'
import { getNorm } from './norms'

type Pts = Record<string, { x: number; y: number }>

// Frankfort-clean fixture: FH (Po-Or) horizontal, facial line (N-Pog) vertical,
// mandibular plane (Go-Me) horizontal, A 10px anterior to the facial line.
const FH_CLEAN: Pts = {
  Po: { x: 100, y: 300 },
  Or: { x: 300, y: 300 }, // FH horizontal
  N: { x: 300, y: 100 },
  Pog: { x: 300, y: 400 }, // N-Pog vertical (x=300)
  Go: { x: 100, y: 400 },
  Me: { x: 300, y: 400 }, // Go-Me horizontal
  A: { x: 310, y: 250 }, // 10px right (anterior) of the facial line
  U1A: { x: 300, y: 240 },
  U1T: { x: 300, y: 270 },
  L1A: { x: 300, y: 360 },
  L1T: { x: 300, y: 330 },
}

// A-Pog-clean fixture: A-Pog vertical, lower incisor axis vertical 10px anterior.
const APOG_CLEAN: Pts = {
  Po: { x: 100, y: 300 },
  Or: { x: 300, y: 300 },
  N: { x: 300, y: 100 },
  A: { x: 300, y: 250 },
  Pog: { x: 300, y: 400 }, // A-Pog vertical
  Go: { x: 100, y: 400 },
  Me: { x: 300, y: 400 },
  L1A: { x: 310, y: 360 },
  L1T: { x: 310, y: 330 }, // L1 axis vertical, 10px anterior to A-Pog
}

describe('computeRickettsAnalysis — Frankfort-referenced (distinct from Steiner-SN)', () => {
  test('facial_angle is the angle between FH and the N-Pog facial line', () => {
    // FH horizontal vs N-Pog vertical → 90°
    const { measurements } = computeRickettsAnalysis(FH_CLEAN, null)
    expect(measurements.facial_angle).toBe(90)
  })

  test('mandibular_plane_fh is FH vs Go-Me (both horizontal → 0°)', () => {
    const { measurements } = computeRickettsAnalysis(FH_CLEAN, null)
    expect(measurements.mandibular_plane_fh).toBe(0)
  })

  test('convexity_mm is the signed distance of A from the facial line (10px @ 0.2mm = 2mm)', () => {
    const { measurements } = computeRickettsAnalysis(FH_CLEAN, 0.2)
    expect(measurements.convexity_mm).toBeCloseTo(2.0, 5)
  })

  test('l1_apog_angle is the lower incisor axis vs A-Pog (parallel → 0°)', () => {
    const { measurements } = computeRickettsAnalysis(APOG_CLEAN, null)
    expect(measurements.l1_apog_angle).toBe(0)
  })

  test('l1_apog_mm is the distance of the lower incisor tip from A-Pog (10px @ 0.2 = 2mm)', () => {
    const { measurements } = computeRickettsAnalysis(APOG_CLEAN, 0.2)
    expect(measurements.l1_apog_mm).toBeCloseTo(2.0, 5)
  })

  test('mm metrics are null without calibration', () => {
    const { measurements } = computeRickettsAnalysis(FH_CLEAN, null)
    expect(measurements.convexity_mm).toBeNull()
  })

  test('missing Frankfort landmarks (Po/Or) surface in missing[] and null the facial angle', () => {
    const noFH: Pts = { N: { x: 300, y: 100 }, Pog: { x: 300, y: 400 } }
    const { measurements, missing } = computeRickettsAnalysis(noFH, null)
    expect(measurements.facial_angle).toBeNull()
    expect(missing).toContain('Po')
    expect(missing).toContain('Or')
  })
})

describe('computeAnalysis dispatcher', () => {
  test('ANALYSIS_TYPES includes steiner_hybrid_sn and ricketts', () => {
    expect(ANALYSIS_TYPES).toContain('steiner_hybrid_sn')
    expect(ANALYSIS_TYPES).toContain('ricketts')
  })

  test('dispatches ricketts to the Ricketts engine (facial_angle present, no SNA)', () => {
    const { measurements } = computeAnalysis('ricketts', FH_CLEAN, null)
    expect(measurements.facial_angle).toBe(90)
    expect(measurements.sna).toBeUndefined()
  })

  test('defaults to Steiner for steiner_hybrid_sn (sna present, no facial_angle)', () => {
    const { measurements } = computeAnalysis('steiner_hybrid_sn', FH_CLEAN, null)
    expect(measurements.sna).not.toBeUndefined()
    expect(measurements.facial_angle).toBeUndefined()
  })
})

describe('Ricketts norms are keyed by analysis type', () => {
  test('getNorm("ricketts", "facial_angle") returns the Ricketts norm, not Steiner', () => {
    const norm = getNorm('ricketts', 'facial_angle')
    expect(norm).not.toBeNull()
    expect(norm?.mean).toBe(87)
  })

  test('Steiner metrics are NOT served under the ricketts key', () => {
    expect(getNorm('ricketts', 'sna')).toBeNull()
  })
})
