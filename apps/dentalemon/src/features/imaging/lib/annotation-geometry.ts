/**
 * Pure geometry transforms for annotation edit/move. All coordinates are IMAGE
 * space (the overlay stores + renders in image space via the canvas transform).
 * Deltas are image-space too — callers convert screen deltas with screenToImage
 * before calling here, so these stay transform-agnostic and unit-testable.
 */

type XY = { x: number; y: number }
type Geo = Record<string, unknown>

const shift = (p: XY, dx: number, dy: number): XY => ({ x: p.x + dx, y: p.y + dy })

/** Point-array geometries (line/distance/angle/area/freehand). */
const POINT_ARRAY_TYPES = new Set(['line', 'distance', 'angle', 'area', 'freehand'])
/** Single-anchor geometries (label/tooth). */
const POINT_TYPES = new Set(['label', 'tooth'])

/**
 * Translate an entire annotation by (dx, dy) in image space — the move/nudge op.
 * Preserves every non-positional field (text, toothNumber, shapeType, …). Returns
 * the original object untouched for unknown/malformed geometry (defensive no-op).
 */
export function translateGeometry(type: string, geo: Geo, dx: number, dy: number): Geo {
  if (dx === 0 && dy === 0) return geo

  if (POINT_ARRAY_TYPES.has(type)) {
    const pts = geo.points as XY[] | undefined
    if (!pts) return geo
    return { ...geo, points: pts.map((p) => shift(p, dx, dy)) }
  }

  if (POINT_TYPES.has(type)) {
    const p = geo.point as XY | undefined
    if (!p) return geo
    return { ...geo, point: shift(p, dx, dy) }
  }

  if (type === 'arrow') {
    const from = geo.from as XY | undefined
    const to = geo.to as XY | undefined
    if (!from || !to) return geo
    return { ...geo, from: shift(from, dx, dy), to: shift(to, dx, dy) }
  }

  if (type === 'shape') {
    const x = geo.x as number | undefined
    const y = geo.y as number | undefined
    if (x == null || y == null) return geo
    return { ...geo, x: x + dx, y: y + dy }
  }

  return geo
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

/**
 * Resize a rect/ellipse `shape` by dragging one corner handle (dx, dy image space);
 * the opposite corner stays fixed. Result is normalized to a non-negative box so a
 * handle dragged past its opposite simply flips the box rather than going negative.
 * No-op for non-shape geometry.
 */
export function resizeShapeGeometry(geo: Geo, handle: ResizeHandle, dx: number, dy: number): Geo {
  const x = geo.x as number | undefined
  const y = geo.y as number | undefined
  const width = geo.width as number | undefined
  const height = geo.height as number | undefined
  if (x == null || y == null || width == null || height == null) return geo

  let left = x
  let top = y
  let right = x + width
  let bottom = y + height

  if (handle === 'nw') { left += dx; top += dy }
  else if (handle === 'ne') { right += dx; top += dy }
  else if (handle === 'sw') { left += dx; bottom += dy }
  else { right += dx; bottom += dy } // se

  return {
    ...geo,
    x: Math.min(left, right),
    y: Math.min(top, bottom),
    width: Math.abs(right - left),
    height: Math.abs(bottom - top),
  }
}
