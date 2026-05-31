/**
 * Magnifier-loupe geometry for the cephalometric workspace.
 *
 * Pure math — no DOM. The loupe is a fixed-corner inset (top-right) that samples
 * the already-rendered main canvas around the pointer and scales it up. Because
 * it crops the composited canvas (image + transforms baked in), it needs no
 * knowledge of the ceph transform — only the pointer position in canvas pixels.
 */

/** Side length (px) of the square loupe inset. */
export const DEFAULT_LOUPE_SIZE = 160

/**
 * Zoom factor for a given selected landmark. Bumps to 6× for the upper/lower
 * incisor root apices (U1A / L1A) — the hardest points to place precisely —
 * and stays at 4× for everything else.
 */
export function loupeZoomForCode(code: string | null): number {
  return code === 'U1A' || code === 'L1A' ? 6 : 4
}

export interface LoupeSource {
  sx: number
  sy: number
  sw: number
  sh: number
}

/**
 * Compute the source crop rect (in main-canvas pixels) to draw into the loupe.
 * The crop is `loupeSize / zoom` on a side, centered on the pointer, so a higher
 * zoom samples a tighter region.
 */
export function computeLoupeSource(
  pointer: { x: number; y: number },
  zoom: number,
  loupeSize: number = DEFAULT_LOUPE_SIZE,
): LoupeSource {
  const sw = loupeSize / zoom
  const sh = loupeSize / zoom
  return {
    sx: pointer.x - sw / 2,
    sy: pointer.y - sh / 2,
    sw,
    sh,
  }
}
