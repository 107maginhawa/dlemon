/**
 * Screen ↔ image coordinate transform for the cephalometric workspace.
 *
 * Inverts the 6-step canvas matrix drawn in imaging-workspace.tsx:497-500:
 *   ctx.translate(W/2 + offsetX, H/2 + offsetY)
 *   ctx.scale(s * (flip ? -1 : 1), s)
 *   ctx.rotate(rot * π/2)
 *   ctx.drawImage(img, -imgWidth/2, -imgHeight/2)
 *
 * Caller MUST supply img.width / img.height (the drawn dimensions used by the
 * canvas), NOT naturalWidth / naturalHeight — they diverge if the img element
 * is resized or a resized bitmap is used, which is exactly the sub-mm error
 * this layer is designed to prevent (D-C).
 */

export interface CephTransformState {
  canvasWidth: number
  canvasHeight: number
  imgWidth: number  // img.width — drawn dims, NOT naturalWidth
  imgHeight: number // img.height — drawn dims, NOT naturalHeight
  scale: number
  flip: boolean
  rotation: number  // quarter turns: 0=0°, 1=90°, 2=180°, 3=270°
  offsetX: number
  offsetY: number
}

/** image-space (px, py) → screen-space */
export function imageToScreen(
  px: number,
  py: number,
  state: CephTransformState,
): { x: number; y: number } {
  const { canvasWidth: W, canvasHeight: H, imgWidth: imgW, imgHeight: imgH, scale, flip, rotation, offsetX, offsetY } = state
  const flipSign = flip ? -1 : 1
  const θ = (rotation * Math.PI) / 2
  const cosθ = Math.cos(θ)
  const sinθ = Math.sin(θ)

  // Shift to image-centre origin (mirrors drawImage's -imgW/2, -imgH/2 offset)
  const lx = px - imgW / 2
  const ly = py - imgH / 2

  // Rotate (R is the innermost/rightmost factor in CTM = T × S × R)
  const rx = lx * cosθ - ly * sinθ
  const ry = lx * sinθ + ly * cosθ

  // Scale
  const sx = rx * scale * flipSign
  const sy = ry * scale

  // Translate
  return { x: sx + W / 2 + offsetX, y: sy + H / 2 + offsetY }
}

/** screen-space (screenX, screenY) → image-space (exact inverse of imageToScreen) */
export function screenToImage(
  screenX: number,
  screenY: number,
  state: CephTransformState,
): { x: number; y: number } {
  const { canvasWidth: W, canvasHeight: H, imgWidth: imgW, imgHeight: imgH, scale, flip, rotation, offsetX, offsetY } = state
  const flipSign = flip ? -1 : 1
  const θ = (rotation * Math.PI) / 2
  const cosθ = Math.cos(θ)
  const sinθ = Math.sin(θ)

  // Un-translate
  const ux = screenX - (W / 2 + offsetX)
  const uy = screenY - (H / 2 + offsetY)

  // Un-scale
  const rx = ux / (scale * flipSign)
  const ry = uy / scale

  // Un-rotate: apply R^T (= R^-1 since R is orthogonal)
  const lx = rx * cosθ + ry * sinθ
  const ly = -rx * sinθ + ry * cosθ

  // Shift back from image-centre origin to image top-left
  return { x: lx + imgW / 2, y: ly + imgH / 2 }
}
