/**
 * Superimposition compositor geometry (P1-11, pure / testable).
 *
 * The overlay stacks two timepoints. Timepoint-A is the base; timepoint-B is
 * rendered transformed by the registration matrix on top, and BOTH layers share
 * one view transform (synced zoom/pan/rotate). This routes everything through
 * the already-tested `coords.ts` (view transform) + `applyTransform`
 * (registration transform) so the registration sits UNDER the view transform
 * without coordinate drift (plan §3.2 + §8 compositing risk mitigation).
 */

import { imageToScreen, applyTransform } from '@monobase/ceph-math'
import type { CephTransformState, SimilarityTransform, Point } from '@monobase/ceph-math'

/**
 * Map a timepoint-A image-space point → screen.
 * A is the base frame: only the shared view transform applies.
 */
export function timepointAToScreen(p: Point, view: CephTransformState): { x: number; y: number } {
  return imageToScreen(p.x, p.y, view)
}

/**
 * Map a timepoint-B image-space point → screen, composing the registration
 * transform (B→A image-space) UNDER the shared view transform.
 */
export function timepointBToScreen(
  p: Point,
  registration: SimilarityTransform,
  view: CephTransformState,
): { x: number; y: number } {
  const inA = applyTransform(p, registration) // B image-space → A image-space
  return imageToScreen(inA.x, inA.y, view) // A image-space → screen (shared view)
}

/**
 * Onion-skin / opacity resolution. Honors prefers-reduced-motion: when reduced
 * motion is requested, the animated crossfade is disabled and the static
 * opacity value is used as the equal path (CAROUSEL §G).
 *
 * @returns the B-layer alpha in [0,1].
 */
export function resolveBLayerOpacity(opts: {
  /** static slider value 0..100 (%) */
  opacityPct: number
  /** whether onion-skin animation is enabled by the user */
  onionSkin: boolean
  /** prefers-reduced-motion media state */
  reducedMotion: boolean
  /** animation phase 0..1 (only consulted when onion-skin animates) */
  phase?: number
}): number {
  const clampedPct = Math.max(0, Math.min(100, opts.opacityPct))
  // Reduced motion (or onion-skin off) → static slider opacity, no animation.
  if (opts.reducedMotion || !opts.onionSkin) {
    return clampedPct / 100
  }
  // Animated crossfade A↔B: triangle wave on phase.
  const phase = ((opts.phase ?? 0) % 1 + 1) % 1
  const tri = phase < 0.5 ? phase * 2 : (1 - phase) * 2
  return tri
}
