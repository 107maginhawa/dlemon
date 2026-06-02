import { useRef } from 'react'
import { imageToScreen, screenToImage } from '@monobase/ceph-math'
import type { CephTransformState } from '@monobase/ceph-math'
import type { CephLandmark, CephLandmarkCode } from '../hooks/use-ceph-landmarks'
import { CEPH_LOW_CONFIDENCE_THRESHOLD } from '../hooks/use-ceph-landmarks'
import { BRAND_GOLD } from '@/constants/brand'

// AI overlay palette — deliberately NOT the lemon accent (lemon = primary action /
// next-unplaced). AI-unconfirmed points read as provisional: a cyan hollow/dashed
// ring; low-confidence AI points pick up an amber attention tint.
const AI_RING = '#38bdf8' // cyan-400 — AI suggested, unconfirmed
const AI_LOW_CONFIDENCE_RING = '#fbbf24' // amber-400 — AI + low confidence (flagged)

/** An AI-originated point that the clinician has not yet corrected or confirmed. */
function isAiUnconfirmed(l: CephLandmark): boolean {
  return l.source === 'ai' && l.status === 'placed'
}

function isLowConfidence(l: CephLandmark): boolean {
  return l.confidence != null && l.confidence < CEPH_LOW_CONFIDENCE_THRESHOLD
}

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
      return BRAND_GOLD
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
        const aiUnconfirmed = isAiUnconfirmed(l)
        const lowConfidence = aiUnconfirmed && isLowConfidence(l)
        const ringColor = lowConfidence ? AI_LOW_CONFIDENCE_RING : AI_RING

        const commonProps = {
          'data-landmark-code': l.landmarkCode,
          'data-source': l.source,
          'data-confidence': l.confidence != null ? String(l.confidence) : undefined,
          'aria-label': aiUnconfirmed
            ? `${l.landmarkCode} landmark (AI suggested, unconfirmed${lowConfidence ? ', low confidence' : ''})`
            : `${l.landmarkCode} landmark`,
          style: locked ? { pointerEvents: 'none' as const } : undefined,
          onPointerDown: (e: React.PointerEvent) => {
            if (locked) return
            e.stopPropagation()
            dragRef.current = l.landmarkCode
          },
        }

        // AI-unconfirmed → DISTINCT state: hollow (no fill) dashed ring, NOT lemon.
        if (aiUnconfirmed) {
          return (
            <g key={l.landmarkCode}>
              <circle
                cx={x}
                cy={y}
                r={6}
                fill="none"
                stroke={ringColor}
                strokeWidth={2}
                strokeDasharray="3 2"
                data-ai-unconfirmed="true"
                data-low-confidence={lowConfidence ? 'true' : undefined}
                {...commonProps}
              />
              {/* small filled center dot keeps the exact point legible inside the hollow ring */}
              <circle cx={x} cy={y} r={1.5} fill={ringColor} style={{ pointerEvents: 'none' }} />
            </g>
          )
        }

        return (
          <circle
            key={l.landmarkCode}
            cx={x}
            cy={y}
            r={5}
            fill={fillForStatus(l.status)}
            {...commonProps}
          />
        )
      })}
    </svg>
  )
}
