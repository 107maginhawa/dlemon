import { useEffect, useRef } from 'react'
import { BRAND_GOLD } from '@/constants/brand'
import {
  computeLoupeSource,
  loupeZoomForCode,
  DEFAULT_LOUPE_SIZE,
} from '../lib/ceph-loupe'

export interface CephLoupeProps {
  /** The main viewer canvas to sample from (image + transforms already composited). */
  sourceCanvas: HTMLCanvasElement | null
  /** Pointer position in main-canvas pixels, or null when not over the image. */
  pointer: { x: number; y: number } | null
  /** Selected landmark code — drives visibility and zoom (6× for U1A/L1A). */
  selectedCode: string | null
  /** Side length of the square inset (default 160px). */
  size?: number
}

/**
 * Fixed-corner magnifier loupe (top-right inset). Samples the rendered main
 * canvas around the pointer at 4× (6× for the incisor apices) so the clinician
 * can place landmarks precisely. NOT follow-cursor — a follow-cursor loupe
 * occludes the very target it magnifies. Shown only while a landmark is selected.
 */
export function CephLoupe({
  sourceCanvas,
  pointer,
  selectedCode,
  size = DEFAULT_LOUPE_SIZE,
}: CephLoupeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const zoom = loupeZoomForCode(selectedCode)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !sourceCanvas || !pointer) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, size, size)

    const { sx, sy, sw, sh } = computeLoupeSource(pointer, zoom, size)
    try {
      ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, size, size)
    } catch {
      // drawImage throws if the source rect is fully outside the canvas — ignore.
    }

    // Crosshair centered on the magnified pointer.
    ctx.strokeStyle = BRAND_GOLD
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(size / 2, 0)
    ctx.lineTo(size / 2, size)
    ctx.moveTo(0, size / 2)
    ctx.lineTo(size, size / 2)
    ctx.stroke()
  }, [sourceCanvas, pointer, zoom, size])

  if (!selectedCode || !pointer) return null

  return (
    <div
      data-testid="ceph-loupe"
      className="pointer-events-none absolute top-2 right-2 z-20 rounded-md border border-lemon/50 bg-black/80 shadow-lg"
      style={{ width: size, height: size }}
    >
      <canvas ref={canvasRef} width={size} height={size} className="block rounded-md" />
      <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-medium text-lemon tabular-nums">
        {zoom}×
      </span>
      <span className="absolute top-1 left-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
        {selectedCode}
      </span>
    </div>
  )
}
