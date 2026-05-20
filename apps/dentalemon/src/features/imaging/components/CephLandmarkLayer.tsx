import { useRef } from 'react'
import { imageToScreen, screenToImage } from '../../../lib/ceph-coords'
import type { CephTransformState } from '../../../lib/ceph-coords'
import type { CephLandmark, CephLandmarkCode } from '../hooks/use-ceph-landmarks'

export interface CephLandmarkLayerProps {
  landmarks: CephLandmark[]
  selectedCode: CephLandmarkCode | null
  transform: CephTransformState
  onPlace: (code: CephLandmarkCode, x: number, y: number) => void
  onDrag: (code: CephLandmarkCode, x: number, y: number) => void
  onCommit: (code: CephLandmarkCode, x: number, y: number) => void
  width: number
  height: number
}

function fillForStatus(status: CephLandmark['status']): string {
  switch (status) {
    case 'confirmed':
      return '#86efac'
    case 'locked':
      return '#94a3b8'
    case 'placed':
    default:
      return '#FFE97D'
  }
}

export function CephLandmarkLayer({
  landmarks,
  selectedCode,
  transform,
  onPlace,
  onDrag,
  onCommit,
  width,
  height,
}: CephLandmarkLayerProps) {
  const dragRef = useRef<CephLandmarkCode | null>(null)

  function localPoint(e: React.PointerEvent | React.MouseEvent) {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!selectedCode) return
    const already = landmarks.find((l) => l.landmarkCode === selectedCode)
    if (already && already.status === 'locked') return
    if (already) return
    const { x, y } = localPoint(e)
    const img = screenToImage(x, y, transform)
    onPlace(selectedCode, img.x, img.y)
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return
    const { x, y } = localPoint(e)
    const img = screenToImage(x, y, transform)
    onDrag(dragRef.current, img.x, img.y)
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return
    const code = dragRef.current
    const { x, y } = localPoint(e)
    const img = screenToImage(x, y, transform)
    dragRef.current = null
    onCommit(code, img.x, img.y)
  }

  return (
    <svg
      width={width}
      height={height}
      data-testid="ceph-landmark-layer"
      style={{ position: 'absolute', inset: 0 }}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {landmarks.map((l) => {
        const { x, y } = imageToScreen(l.x, l.y, transform)
        const locked = l.status === 'locked'
        return (
          <circle
            key={l.landmarkCode}
            cx={x}
            cy={y}
            r={5}
            fill={fillForStatus(l.status)}
            data-landmark-code={l.landmarkCode}
            aria-label={`${l.landmarkCode} landmark`}
            style={locked ? { pointerEvents: 'none' } : undefined}
            onPointerDown={(e) => {
              if (locked) return
              e.stopPropagation()
              dragRef.current = l.landmarkCode
            }}
          />
        )
      })}
    </svg>
  )
}
