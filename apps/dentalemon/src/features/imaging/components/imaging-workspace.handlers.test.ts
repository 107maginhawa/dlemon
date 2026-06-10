import { describe, it, expect } from 'bun:test'
import { buildCalibrationRequest } from './imaging-workspace.handlers'

describe('buildCalibrationRequest (G6 versioned calibration)', () => {
  it('threads the 2 ruler points + known distance and derives pixelSpacingMm', () => {
    const req = buildCalibrationRequest({
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      actualMm: 20,
    })
    expect(req).not.toBeNull()
    expect(req!.pointA).toEqual({ x: 0, y: 0 })
    expect(req!.pointB).toEqual({ x: 100, y: 0 })
    expect(req!.knownDistanceMm).toBe(20)
    // 20 mm / 100 px
    expect(req!.pixelSpacingMm).toBeCloseTo(0.2, 5)
  })

  it('computes the pixel distance from the points (not assumed axis-aligned)', () => {
    const req = buildCalibrationRequest({
      points: [{ x: 0, y: 0 }, { x: 30, y: 40 }], // 3-4-5 → 50 px
      actualMm: 10,
    })
    expect(req!.pixelSpacingMm).toBeCloseTo(0.2, 5)
  })

  it('returns null when fewer than 2 points are supplied', () => {
    expect(buildCalibrationRequest({ points: [{ x: 1, y: 1 }], actualMm: 10 })).toBeNull()
    expect(buildCalibrationRequest({ points: [], actualMm: 10 })).toBeNull()
  })

  it('returns null for a non-positive distance or coincident points', () => {
    expect(
      buildCalibrationRequest({ points: [{ x: 0, y: 0 }, { x: 0, y: 0 }], actualMm: 10 }),
    ).toBeNull()
    expect(
      buildCalibrationRequest({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], actualMm: 0 }),
    ).toBeNull()
  })
})
