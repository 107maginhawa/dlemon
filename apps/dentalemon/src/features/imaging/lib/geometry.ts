// Geometry helpers for imaging measurement tools

export interface Point {
  x: number
  y: number
}

export function euclidean(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
}

export function computeAngleDeg(p1: Point, vertex: Point, p3: Point): number {
  const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y }
  const v2 = { x: p3.x - vertex.x, y: p3.y - vertex.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2)
  if (mag === 0) return 0
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI
}

export function computePolygonArea(pts: Point[]): number {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    const pi = pts[i]!
    const pj = pts[j]!
    area += pi.x * pj.y
    area -= pj.x * pi.y
  }
  return Math.abs(area / 2)
}
