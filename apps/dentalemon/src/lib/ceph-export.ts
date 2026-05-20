import type { CephLandmark } from '../features/imaging/hooks/use-ceph-landmarks'
import { activeLinesForLandmarks } from '../features/imaging/lib/ceph-geometry'

export interface CephExportOptions {
  maxSize?: number
}

/**
 * Renders the X-ray image + ceph tracing overlays onto an offscreen canvas.
 * Always preserves the source image's natural aspect ratio (D-N metrology MUST-FIX).
 * Coordinates are image-space px (D-C); no screen-space transform applied.
 */
export function composeCephCanvas(
  img: HTMLImageElement,
  landmarks: CephLandmark[],
  options?: CephExportOptions,
): HTMLCanvasElement {
  const maxSize = options?.maxSize ?? 2048
  const nw = img.naturalWidth || img.width
  const nh = img.naturalHeight || img.height

  // Scale to fit maxSize along longest side; never upscale
  const scale = Math.min(1, maxSize / Math.max(nw, nh))
  const w = Math.round(nw * scale)
  const h = Math.round(nh * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.drawImage(img as unknown as CanvasImageSource, 0, 0, w, h)

  // Tracing lines in image-space coordinates, scaled to export resolution
  const placed = new Set(landmarks.map((l) => l.landmarkCode))
  const lines = activeLinesForLandmarks(placed)
  const lmMap = new Map(landmarks.map((l) => [l.landmarkCode, l]))

  ctx.save()
  ctx.strokeStyle = '#FFE97D'
  ctx.lineWidth = Math.max(1, 1.5 * scale)
  ctx.setLineDash([4, 2])

  for (const line of lines) {
    const from = lmMap.get(line.from)
    const to = lmMap.get(line.to)
    if (!from || !to) continue
    ctx.beginPath()
    ctx.moveTo(from.x * scale, from.y * scale)
    ctx.lineTo(to.x * scale, to.y * scale)
    ctx.stroke()
  }

  ctx.setLineDash([])
  ctx.fillStyle = '#FFE97D'
  for (const lm of landmarks) {
    ctx.beginPath()
    ctx.arc(lm.x * scale, lm.y * scale, 3 * scale, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
  return canvas
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob returned null'))
    }, 'image/png')
  })
}
