import { describe, test, expect } from 'bun:test'
import {
  computeDownsAnalysis,
  computeTweedAnalysis,
  computeMcNamaraAnalysis,
  computeJarabakAnalysis,
} from './analyses'
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
  A: { x: 310, y: 250 }, // 10px anterior of the facial line
  B: { x: 300, y: 350 },
  S: { x: 100, y: 100 },
  U1A: { x: 300, y: 240 },
  U1T: { x: 300, y: 270 },
  L1A: { x: 300, y: 360 },
  L1T: { x: 300, y: 330 },
}

describe('computeDownsAnalysis — Frankfort-referenced', () => {
  test('facial_angle is FH vs N-Pog facial line (horizontal vs vertical → 90°)', () => {
    const { measurements } = computeDownsAnalysis(FH_CLEAN, null)
    expect(measurements.facial_angle).toBe(90)
  })

  test('mandibular_plane_angle is FH vs Go-Me (both horizontal → 0°)', () => {
    const { measurements } = computeDownsAnalysis(FH_CLEAN, null)
    expect(measurements.mandibular_plane_angle).toBe(0)
  })

  test('interincisal is the opening angle between U1 and L1 axes (parallel → 180°)', () => {
    const { measurements } = computeDownsAnalysis(FH_CLEAN, null)
    expect(measurements.interincisal).toBe(180)
  })

  test('missing Frankfort landmarks surface in missing[] and null facial_angle', () => {
    const { measurements, missing } = computeDownsAnalysis(
      { N: { x: 300, y: 100 }, Pog: { x: 300, y: 400 } },
      null,
    )
    expect(measurements.facial_angle).toBeNull()
    expect(missing).toContain('Po')
  })
})

describe('computeTweedAnalysis — Frankfort triangle (FMA/IMPA/FMIA)', () => {
  test('fma is FH vs mandibular plane (both horizontal → 0°)', () => {
    const { measurements } = computeTweedAnalysis(FH_CLEAN, null)
    expect(measurements.fma).toBe(0)
  })

  test('impa is L1 axis vs mandibular plane (vertical L1 vs horizontal Go-Me → 90°)', () => {
    const { measurements } = computeTweedAnalysis(FH_CLEAN, null)
    expect(measurements.impa).toBe(90)
  })

  test('fmia is FH vs L1 axis (horizontal FH vs vertical L1 → 90°)', () => {
    const { measurements } = computeTweedAnalysis(FH_CLEAN, null)
    expect(measurements.fmia).toBe(90)
  })

  test('fma + impa + fmia sum to ~180 (the Tweed triangle invariant)', () => {
    const { measurements } = computeTweedAnalysis(FH_CLEAN, null)
    const sum =
      (measurements.fma ?? 0) + (measurements.impa ?? 0) + (measurements.fmia ?? 0)
    expect(sum).toBeCloseTo(180, 5)
  })
})

describe('computeMcNamaraAnalysis — N-perpendicular linear (mm)', () => {
  test('a_to_nperp is A relative to the N-perpendicular to FH (10px @ 0.2 = +2mm)', () => {
    const { measurements } = computeMcNamaraAnalysis(FH_CLEAN, 0.2)
    // N-perp is the vertical line through N (FH is horizontal). A is 10px anterior.
    expect(measurements.a_to_nperp).toBeCloseTo(2.0, 5)
  })

  test('mm metrics are null without calibration', () => {
    const { measurements } = computeMcNamaraAnalysis(FH_CLEAN, null)
    expect(measurements.a_to_nperp).toBeNull()
  })

  test('missing landmarks surface and null the metric', () => {
    const { measurements, missing } = computeMcNamaraAnalysis(
      { N: { x: 300, y: 100 } },
      0.2,
    )
    expect(measurements.a_to_nperp).toBeNull()
    expect(missing.length).toBeGreaterThan(0)
  })
})

describe('computeJarabakAnalysis — posterior/anterior facial-height ratio', () => {
  test('pa_fhr is (S-Go / N-Me) * 100; S-Go=300, N-Me=300 → 100%', () => {
    // S(100,100)-Go(100,400) = 300px ; N(300,100)-Me(300,400) = 300px
    const { measurements } = computeJarabakAnalysis(FH_CLEAN, null)
    expect(measurements.pa_fhr).toBeCloseTo(100, 5)
  })

  test('ratio is unitless — present without calibration', () => {
    const { measurements } = computeJarabakAnalysis(FH_CLEAN, null)
    expect(measurements.pa_fhr).not.toBeNull()
  })

  test('missing landmarks null the ratio', () => {
    const { measurements, missing } = computeJarabakAnalysis(
      { S: { x: 100, y: 100 } },
      null,
    )
    expect(measurements.pa_fhr).toBeNull()
    expect(missing.length).toBeGreaterThan(0)
  })
})

describe('computeAnalysis dispatcher — new protocols', () => {
  test('ANALYSIS_TYPES includes downs, tweed, mcnamara, jarabak', () => {
    expect(ANALYSIS_TYPES).toContain('downs')
    expect(ANALYSIS_TYPES).toContain('tweed')
    expect(ANALYSIS_TYPES).toContain('mcnamara')
    expect(ANALYSIS_TYPES).toContain('jarabak')
  })

  test('dispatches downs to the Downs engine', () => {
    const { measurements } = computeAnalysis('downs', FH_CLEAN, null)
    expect(measurements.facial_angle).toBe(90)
    expect(measurements.sna).toBeUndefined()
  })

  test('dispatches tweed to the Tweed engine', () => {
    const { measurements } = computeAnalysis('tweed', FH_CLEAN, null)
    expect(measurements.fma).toBe(0)
  })

  test('dispatches mcnamara to the McNamara engine', () => {
    const { measurements } = computeAnalysis('mcnamara', FH_CLEAN, 0.2)
    expect(measurements.a_to_nperp).toBeCloseTo(2.0, 5)
  })

  test('dispatches jarabak to the Jarabak engine', () => {
    const { measurements } = computeAnalysis('jarabak', FH_CLEAN, null)
    expect(measurements.pa_fhr).toBeCloseTo(100, 5)
  })
})

describe('new-protocol norms are keyed by analysis type (no cross-bleed)', () => {
  test('getNorm("downs","facial_angle") returns the Downs norm (87.8 ± 3.6)', () => {
    const n = getNorm('downs', 'facial_angle')
    expect(n).not.toBeNull()
    expect(n?.mean).toBeCloseTo(87.8, 5)
  })

  test('getNorm("tweed","impa") returns the Tweed norm (~90 ± 5)', () => {
    const n = getNorm('tweed', 'impa')
    expect(n).not.toBeNull()
    expect(n?.mean).toBe(90)
  })

  test('getNorm("jarabak","pa_fhr") returns the Jarabak ratio norm', () => {
    expect(getNorm('jarabak', 'pa_fhr')).not.toBeNull()
  })

  test('Steiner metrics are NOT served under the new keys', () => {
    expect(getNorm('downs', 'sna')).toBeNull()
    expect(getNorm('tweed', 'sna')).toBeNull()
  })
})
