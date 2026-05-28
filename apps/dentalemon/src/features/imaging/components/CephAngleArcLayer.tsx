import { activeArcsForLandmarks } from '../lib/ceph-geometry'
import { imageToScreen } from '@monobase/ceph-math'
import type { CephTransformState } from '@monobase/ceph-math'
import type { CephLandmark } from '../hooks/use-ceph-landmarks'

export interface CephAngleArcLayerProps {
  landmarks: CephLandmark[]
  transform: CephTransformState
  measurements: Record<string, number | null>
  visible?: boolean
  width: number
  height: number
}

const ARC_R = 20

function arcPath(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
): string {
  // Draw the shorter sweep between the two angles.
  let delta = a1 - a0
  while (delta <= -Math.PI) delta += 2 * Math.PI
  while (delta > Math.PI) delta -= 2 * Math.PI
  const end = a0 + delta
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(end)
  const y1 = cy + r * Math.sin(end)
  const largeArc = Math.abs(delta) > Math.PI ? 1 : 0
  const sweep = delta >= 0 ? 1 : 0
  return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} ${sweep} ${x1} ${y1}`
}

export function CephAngleArcLayer({
  landmarks,
  transform,
  measurements,
  visible = true,
  width,
  height,
}: CephAngleArcLayerProps) {
  if (!visible) return null

  const byCode = new Map(landmarks.map((l) => [l.landmarkCode, l]))
  const placed = new Set<string>(landmarks.map((l) => l.landmarkCode))
  const arcs = activeArcsForLandmarks(placed)

  return (
    <svg
      width={width}
      height={height}
      data-testid="ceph-angle-arc-layer"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {arcs.map((arc) => {
        const v = byCode.get(arc.vertex)!
        const r1 = byCode.get(arc.ray1)!
        const r2 = byCode.get(arc.ray2)!
        const vp = imageToScreen(v.x, v.y, transform)
        const p1 = imageToScreen(r1.x, r1.y, transform)
        const p2 = imageToScreen(r2.x, r2.y, transform)
        const a0 = Math.atan2(p1.y - vp.y, p1.x - vp.x)
        const a1 = Math.atan2(p2.y - vp.y, p2.x - vp.x)
        const value = measurements[arc.metricKey]
        const label = value == null ? '--' : `${value.toFixed(2)}°`
        return (
          <g key={arc.id}>
            <path
              data-arc-id={arc.id}
              d={arcPath(vp.x, vp.y, ARC_R, a0, a1)}
              fill="none"
              stroke="#FFE97D"
              strokeWidth={1.5}
              strokeOpacity={0.9}
            />
            <text
              x={vp.x + ARC_R + 4}
              y={vp.y}
              fill="#FFE97D"
              fontSize={11}
              data-arc-label={arc.id}
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
