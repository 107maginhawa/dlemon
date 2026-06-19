import { computeAngleDeg, computePolygonArea, euclidean } from '../lib/geometry'
import type { ToolMode } from './measurement-toolbar'
import type { CreateMeasurementInput } from '../hooks/use-measurements'

export interface Point {
  x: number
  y: number
}

export type ToolClickAction =
  | { type: 'noop' }
  | { type: 'setPoints'; points: Point[] }
  | { type: 'openCalibration'; pixelDistance: number; points: Point[] }
  | { type: 'commit'; input: CreateMeasurementInput }
  | { type: 'promptLabel'; point: Point }
  | { type: 'promptTooth'; point: Point }

export interface CalibrationRequest {
  pixelSpacingMm: number
  pointA: Point
  pointB: Point
  knownDistanceMm: number
}

/**
 * G6: build the versioned-calibration request body from the 2 ruler points the
 * operator drew + the real-world distance they entered. Returns null for an
 * unusable calibration (missing second point, coincident points, or a
 * non-positive distance) so the caller skips the PATCH rather than persisting
 * garbage. pixelSpacingMm is derived here for the optimistic UI; the server
 * re-derives it authoritatively from the same inputs.
 */
export function buildCalibrationRequest({
  points,
  actualMm,
}: {
  points: Point[]
  actualMm: number
}): CalibrationRequest | null {
  if (points.length < 2 || !(actualMm > 0)) return null
  const [pointA, pointB] = points as [Point, Point]
  const pixelDistance = euclidean(pointA, pointB)
  if (!(pixelDistance > 0)) return null
  return {
    pixelSpacingMm: actualMm / pixelDistance,
    pointA,
    pointB,
    knownDistanceMm: actualMm,
  }
}

/**
 * Run a calibration save and branch on the outcome. On failure the error is
 * routed to `onError` (a user-facing toast) and the function returns WITHOUT
 * calling `onSuccess`, so the caller's success-only resets (closing the dialog,
 * clearing draw points) never run and the operator can retry. Extracted from the
 * ImagingWorkspace callback purely so the failure branch is unit-testable without
 * rendering the canvas-heavy component.
 */
export async function confirmCalibrationSave(opts: {
  save: () => Promise<unknown>
  onError: (err: unknown) => void
  onSuccess: () => void
}): Promise<void> {
  try {
    await opts.save()
  } catch (err) {
    opts.onError(err)
    return
  }
  opts.onSuccess()
}

export interface ProcessToolClickArgs {
  toolMode: ToolMode
  drawPoints: Point[]
  newPoint: Point
  isDoubleClick: boolean
  pixelSpacingMm: number | null
}

export function processToolClick({
  toolMode,
  drawPoints,
  newPoint,
  isDoubleClick,
  pixelSpacingMm,
}: ProcessToolClickArgs): ToolClickAction {
  if (toolMode === 'none') return { type: 'noop' }

  const newPoints = [...drawPoints, newPoint]

  if (toolMode === 'calibration') {
    if (newPoints.length < 2) return { type: 'setPoints', points: newPoints }
    return {
      type: 'openCalibration',
      pixelDistance: euclidean(newPoints[0]!, newPoints[1]!),
      points: newPoints,
    }
  }

  if (toolMode === 'distance') {
    if (newPoints.length < 2) return { type: 'setPoints', points: newPoints }
    const distPx = euclidean(newPoints[0]!, newPoints[1]!)
    const value = pixelSpacingMm ? distPx * pixelSpacingMm : distPx
    return {
      type: 'commit',
      input: {
        type: 'distance',
        geometry: { points: newPoints },
        measurementValue: Math.round(value * 10) / 10,
        measurementUnit: pixelSpacingMm ? 'mm' : 'px',
      },
    }
  }

  if (toolMode === 'angle') {
    if (newPoints.length < 3) return { type: 'setPoints', points: newPoints }
    const deg = computeAngleDeg(newPoints[0]!, newPoints[1]!, newPoints[2]!)
    return {
      type: 'commit',
      input: {
        type: 'angle',
        geometry: { points: newPoints },
        measurementValue: Math.round(deg * 10) / 10,
        measurementUnit: 'deg',
      },
    }
  }

  if (toolMode === 'area') {
    if (isDoubleClick && newPoints.length >= 3) {
      const polygon = newPoints.slice(0, -1)
      const areaPx = computePolygonArea(polygon)
      const value = pixelSpacingMm ? areaPx * pixelSpacingMm * pixelSpacingMm : areaPx
      return {
        type: 'commit',
        input: {
          type: 'area',
          geometry: { points: polygon },
          measurementValue: Math.round(value * 10) / 10,
          measurementUnit: pixelSpacingMm ? 'mm²' : 'px²',
        },
      }
    }
    return { type: 'setPoints', points: newPoints }
  }

  if (toolMode === 'label') return { type: 'promptLabel', point: newPoint }
  if (toolMode === 'tooth') return { type: 'promptTooth', point: newPoint }

  if (toolMode === 'arrow') {
    if (newPoints.length < 2) return { type: 'setPoints', points: newPoints }
    return {
      type: 'commit',
      input: {
        type: 'arrow',
        geometry: { type: 'arrow', from: newPoints[0]!, to: newPoints[1]! },
      },
    }
  }

  if (toolMode === 'freehand') {
    if (isDoubleClick && newPoints.length >= 2) {
      return {
        type: 'commit',
        input: {
          type: 'freehand',
          geometry: { type: 'freehand', points: newPoints.slice(0, -1) },
        },
      }
    }
    return { type: 'setPoints', points: newPoints }
  }

  if (toolMode === 'shape') {
    if (newPoints.length < 2) return { type: 'setPoints', points: newPoints }
    const p0 = newPoints[0]!
    const p1 = newPoints[1]!
    return {
      type: 'commit',
      input: {
        type: 'shape',
        geometry: {
          type: 'shape',
          shapeType: 'rect',
          x: Math.min(p0.x, p1.x),
          y: Math.min(p0.y, p1.y),
          width: Math.abs(p1.x - p0.x),
          height: Math.abs(p1.y - p0.y),
        },
      },
    }
  }

  return { type: 'noop' }
}

export function buildLabelMeasurement(point: Point, rawText: string): CreateMeasurementInput | null {
  const text = rawText.trim()
  if (text.length === 0) return null
  return {
    type: 'label',
    geometry: { type: 'label', point, text: text.slice(0, 200) },
  }
}

export function buildToothMeasurement(point: Point, rawInput: string): CreateMeasurementInput | null {
  const toothNumber = parseInt(rawInput, 10)
  if (isNaN(toothNumber) || toothNumber < 1 || toothNumber > 32) return null
  return {
    type: 'tooth',
    geometry: { type: 'tooth', point, toothNumber },
  }
}
