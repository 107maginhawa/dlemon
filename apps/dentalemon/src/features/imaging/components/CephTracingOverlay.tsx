import { activeLinesForLandmarks } from '../lib/ceph-geometry'
import { imageToScreen } from '../../../lib/ceph-coords'
import type { CephTransformState } from '../../../lib/ceph-coords'
import type { CephLandmark } from '../hooks/use-ceph-landmarks'

export interface CephTracingOverlayProps {
  landmarks: CephLandmark[]
  transform: CephTransformState
  visible?: boolean
  width: number
  height: number
}

export function CephTracingOverlay({
  landmarks,
  transform,
  visible = true,
  width,
  height,
}: CephTracingOverlayProps) {
  if (!visible) return null

  const byCode = new Map(landmarks.map((l) => [l.landmarkCode, l]))
  const placed = new Set<string>(landmarks.map((l) => l.landmarkCode))
  const lines = activeLinesForLandmarks(placed)

  return (
    <svg
      width={width}
      height={height}
      data-testid="ceph-tracing-overlay"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {lines.map((line) => {
        const a = byCode.get(line.from)!
        const b = byCode.get(line.to)!
        const p1 = imageToScreen(a.x, a.y, transform)
        const p2 = imageToScreen(b.x, b.y, transform)
        return (
          <line
            key={line.id}
            data-line-id={line.id}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="#86efac"
            strokeWidth={1.5}
            strokeOpacity={0.8}
          />
        )
      })}
    </svg>
  )
}
