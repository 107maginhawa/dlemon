import { describe, it, expect, mock } from 'bun:test'
import {
  buildCalibrationRequest,
  buildLabelMeasurement,
  buildToothMeasurement,
  confirmCalibrationSave,
  decideAnnotationKey,
  processToolClick,
  type Point,
  type ProcessToolClickArgs,
} from './imaging-workspace.handlers'

// processToolClick is the single reducer that turns each on-canvas click into a
// tool action. It encodes the EXACT gesture every tool needs (how many clicks,
// whether a double-click finishes) — the behavior a user has to discover to
// "draw a line". These tests pin that gesture contract per tool.
const P = (x: number, y: number): Point => ({ x, y })

function click(over: Partial<ProcessToolClickArgs>) {
  return processToolClick({
    toolMode: 'none',
    drawPoints: [],
    newPoint: P(0, 0),
    isDoubleClick: false,
    pixelSpacingMm: null,
    ...over,
  })
}

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

describe('confirmCalibrationSave (failure surfacing)', () => {
  it('on save failure: routes the error to onError and skips onSuccess (dialog stays open)', async () => {
    const onError = mock((_err: unknown) => {})
    const onSuccess = mock(() => {})

    await confirmCalibrationSave({
      save: () => Promise.reject(new Error('boom')),
      onError,
      onSuccess,
    })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('on success: runs onSuccess and not onError', async () => {
    const onError = mock((_err: unknown) => {})
    const onSuccess = mock(() => {})

    await confirmCalibrationSave({
      save: () => Promise.resolve(),
      onError,
      onSuccess,
    })

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })
})

describe('processToolClick — no tool active', () => {
  it('returns noop when toolMode is none (canvas clicks are ignored)', () => {
    expect(click({ toolMode: 'none' })).toEqual({ type: 'noop' })
  })

  it('returns noop in select mode (selecting/removing must never draw)', () => {
    expect(click({ toolMode: 'select', drawPoints: [{ x: 1, y: 1 }] })).toEqual({ type: 'noop' })
  })
})

describe('decideAnnotationKey (select-mode keyboard)', () => {
  it('Delete / Backspace remove the selected annotation', () => {
    expect(decideAnnotationKey('Delete', true)).toBe('delete')
    expect(decideAnnotationKey('Backspace', true)).toBe('delete')
  })

  it('Escape clears the selection', () => {
    expect(decideAnnotationKey('Escape', true)).toBe('deselect')
  })

  it('does nothing when there is no selection', () => {
    expect(decideAnnotationKey('Delete', false)).toBeNull()
    expect(decideAnnotationKey('Escape', false)).toBeNull()
  })

  it('ignores unrelated keys', () => {
    expect(decideAnnotationKey('a', true)).toBeNull()
  })
})

describe('processToolClick — calibration (2 clicks)', () => {
  it('first click just stores the point', () => {
    expect(click({ toolMode: 'calibration', drawPoints: [], newPoint: P(0, 0) })).toEqual({
      type: 'setPoints',
      points: [P(0, 0)],
    })
  })

  it('second click opens the calibration dialog with the pixel distance', () => {
    const action = click({ toolMode: 'calibration', drawPoints: [P(0, 0)], newPoint: P(30, 40) })
    expect(action.type).toBe('openCalibration')
    if (action.type !== 'openCalibration') throw new Error('unreachable')
    expect(action.pixelDistance).toBe(50) // 3-4-5 triangle
    expect(action.points).toEqual([P(0, 0), P(30, 40)])
  })
})

describe('processToolClick — Distance (2 clicks)', () => {
  it('first click stores the start point (no commit yet)', () => {
    expect(click({ toolMode: 'distance', drawPoints: [], newPoint: P(0, 0) })).toEqual({
      type: 'setPoints',
      points: [P(0, 0)],
    })
  })

  it('second click commits a distance measurement in mm when calibrated', () => {
    const action = click({
      toolMode: 'distance',
      drawPoints: [P(0, 0)],
      newPoint: P(100, 0),
      pixelSpacingMm: 0.2, // 0.2 mm per px → 100px = 20mm
    })
    expect(action.type).toBe('commit')
    if (action.type !== 'commit') throw new Error('unreachable')
    expect(action.input.type).toBe('distance')
    expect(action.input.measurementValue).toBe(20)
    expect(action.input.measurementUnit).toBe('mm')
  })

  it('falls back to raw px when the image is not calibrated', () => {
    const action = click({
      toolMode: 'distance',
      drawPoints: [P(0, 0)],
      newPoint: P(100, 0),
      pixelSpacingMm: null,
    })
    if (action.type !== 'commit') throw new Error('unreachable')
    expect(action.input.measurementValue).toBe(100)
    expect(action.input.measurementUnit).toBe('px')
  })

  it('rounds the value to 0.1', () => {
    const action = click({
      toolMode: 'distance',
      drawPoints: [P(0, 0)],
      newPoint: P(3, 4), // 5px
      pixelSpacingMm: 0.3333, // 1.6665 → 1.7
    })
    if (action.type !== 'commit') throw new Error('unreachable')
    expect(action.input.measurementValue).toBe(1.7)
  })
})

describe('processToolClick — Angle (3 clicks, vertex is 2nd, never calibration-gated)', () => {
  it('accumulates the first two clicks without committing', () => {
    expect(click({ toolMode: 'angle', drawPoints: [], newPoint: P(1, 0) }).type).toBe('setPoints')
    expect(click({ toolMode: 'angle', drawPoints: [P(1, 0)], newPoint: P(0, 0) }).type).toBe(
      'setPoints',
    )
  })

  it('third click commits the angle in degrees regardless of calibration', () => {
    const action = click({
      toolMode: 'angle',
      drawPoints: [P(1, 0), P(0, 0)], // vertex at origin
      newPoint: P(0, 1),
      pixelSpacingMm: null, // uncalibrated — angle must still work
    })
    if (action.type !== 'commit') throw new Error('unreachable')
    expect(action.input.type).toBe('angle')
    expect(action.input.measurementValue).toBe(90)
    expect(action.input.measurementUnit).toBe('deg')
  })
})

describe('processToolClick — Area (polygon, double-click to close)', () => {
  it('single clicks accumulate vertices', () => {
    expect(click({ toolMode: 'area', drawPoints: [P(0, 0)], newPoint: P(4, 0) })).toEqual({
      type: 'setPoints',
      points: [P(0, 0), P(4, 0)],
    })
  })

  it('a double-click with fewer than 3 points does NOT commit', () => {
    const action = click({
      toolMode: 'area',
      drawPoints: [P(0, 0)],
      newPoint: P(4, 0),
      isDoubleClick: true,
    })
    expect(action.type).toBe('setPoints')
  })

  it('double-click closes the polygon, drops the duplicated final point, computes area', () => {
    const action = click({
      toolMode: 'area',
      drawPoints: [P(0, 0), P(4, 0), P(0, 3)], // triangle area 6px²
      newPoint: P(0, 3), // duplicated close point from the double-click
      isDoubleClick: true,
      pixelSpacingMm: null,
    })
    if (action.type !== 'commit') throw new Error('unreachable')
    expect(action.input.type).toBe('area')
    const geo = action.input.geometry as { points: Point[] }
    expect(geo.points).toHaveLength(3) // last point dropped
    expect(action.input.measurementValue).toBe(6)
    expect(action.input.measurementUnit).toBe('px²')
  })

  it('area scales by mm-per-px squared when calibrated', () => {
    const action = click({
      toolMode: 'area',
      drawPoints: [P(0, 0), P(4, 0), P(0, 3)],
      newPoint: P(0, 3),
      isDoubleClick: true,
      pixelSpacingMm: 0.5, // 6 * 0.5 * 0.5 = 1.5
    })
    if (action.type !== 'commit') throw new Error('unreachable')
    expect(action.input.measurementValue).toBe(1.5)
    expect(action.input.measurementUnit).toBe('mm²')
  })
})

describe('processToolClick — Label & Tooth (single click → dialog)', () => {
  it('Label opens the text dialog on the very first click', () => {
    expect(click({ toolMode: 'label', newPoint: P(7, 8) })).toEqual({
      type: 'promptLabel',
      point: P(7, 8),
    })
  })

  it('Tooth opens the tooth-number dialog on the very first click', () => {
    expect(click({ toolMode: 'tooth', newPoint: P(7, 8) })).toEqual({
      type: 'promptTooth',
      point: P(7, 8),
    })
  })
})

describe('processToolClick — Arrow (TWO clicks, not a drag)', () => {
  it('first click stores the start; nothing is committed (this is why a drag draws nothing)', () => {
    expect(click({ toolMode: 'arrow', drawPoints: [], newPoint: P(1, 1) })).toEqual({
      type: 'setPoints',
      points: [P(1, 1)],
    })
  })

  it('second click commits an arrow from start → end', () => {
    const action = click({ toolMode: 'arrow', drawPoints: [P(1, 1)], newPoint: P(9, 9) })
    if (action.type !== 'commit') throw new Error('unreachable')
    expect(action.input.type).toBe('arrow')
    expect(action.input.geometry).toEqual({ type: 'arrow', from: P(1, 1), to: P(9, 9) })
  })
})

describe('processToolClick — Freehand (click each vertex, double-click to finish)', () => {
  it('a single click (not double) keeps accumulating even past 2 points', () => {
    const action = click({
      toolMode: 'freehand',
      drawPoints: [P(0, 0), P(1, 1)],
      newPoint: P(2, 2),
      isDoubleClick: false,
    })
    expect(action.type).toBe('setPoints')
  })

  it('double-click finishes the polyline and drops the duplicated final point', () => {
    const action = click({
      toolMode: 'freehand',
      drawPoints: [P(0, 0), P(1, 1)],
      newPoint: P(1, 1),
      isDoubleClick: true,
    })
    if (action.type !== 'commit') throw new Error('unreachable')
    expect(action.input.type).toBe('freehand')
    const geo = action.input.geometry as { type: string; points: Point[] }
    expect(geo.points).toEqual([P(0, 0), P(1, 1)])
  })
})

describe('processToolClick — Shape (TWO clicks: corner → opposite corner, always a rect)', () => {
  it('first click stores the first corner', () => {
    expect(click({ toolMode: 'shape', drawPoints: [], newPoint: P(10, 10) })).toEqual({
      type: 'setPoints',
      points: [P(10, 10)],
    })
  })

  it('second click commits a rect from min-corner + abs-span (order-independent)', () => {
    const action = click({ toolMode: 'shape', drawPoints: [P(30, 40)], newPoint: P(10, 10) })
    if (action.type !== 'commit') throw new Error('unreachable')
    expect(action.input.geometry).toEqual({
      type: 'shape',
      shapeType: 'rect',
      x: 10,
      y: 10,
      width: 20,
      height: 30,
    })
  })
})

describe('buildLabelMeasurement', () => {
  it('trims text and produces a label measurement', () => {
    const m = buildLabelMeasurement(P(1, 2), '  caries  ')
    expect(m).not.toBeNull()
    expect(m!.type).toBe('label')
    expect(m!.geometry).toEqual({ type: 'label', point: P(1, 2), text: 'caries' })
  })

  it('rejects empty / whitespace-only text', () => {
    expect(buildLabelMeasurement(P(0, 0), '')).toBeNull()
    expect(buildLabelMeasurement(P(0, 0), '   ')).toBeNull()
  })

  it('clamps text to 200 chars', () => {
    const m = buildLabelMeasurement(P(0, 0), 'x'.repeat(500))
    const geo = m!.geometry as { text: string }
    expect(geo.text).toHaveLength(200)
  })
})

describe('buildToothMeasurement', () => {
  it('accepts a whole tooth number 1–32', () => {
    const m = buildToothMeasurement(P(1, 2), '16')
    expect(m!.type).toBe('tooth')
    expect(m!.geometry).toEqual({ type: 'tooth', point: P(1, 2), toothNumber: 16 })
  })

  it('rejects out-of-range and non-numeric input', () => {
    expect(buildToothMeasurement(P(0, 0), '0')).toBeNull()
    expect(buildToothMeasurement(P(0, 0), '33')).toBeNull()
    expect(buildToothMeasurement(P(0, 0), 'abc')).toBeNull()
  })
})
