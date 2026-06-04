/**
 * Keyboard-flow helpers for the cephalometric workspace.
 *
 * Pure logic — no DOM. Supports the high-volume-operator flow:
 *   • Tab / Enter → advance selection to the next unplaced landmark
 *   • Arrow keys → nudge the selected (placed, non-locked) landmark 1px (+y down)
 */

import { LANDMARK_CODES } from './ceph-geometry'
import type { CephLandmarkCode } from './ceph-geometry'

export interface NudgeDelta {
  dx: number
  dy: number
}

/** Map an arrow key to a 1px delta (image space, +y down). Non-arrows → null. */
export function arrowDelta(key: string): NudgeDelta | null {
  switch (key) {
    case 'ArrowLeft':
      return { dx: -1, dy: 0 }
    case 'ArrowRight':
      return { dx: 1, dy: 0 }
    case 'ArrowUp':
      return { dx: 0, dy: -1 }
    case 'ArrowDown':
      return { dx: 0, dy: 1 }
    default:
      return null
  }
}

/**
 * Return the next unplaced landmark code in canonical order, starting AFTER the
 * current selection (wrapping). With no current selection, scans from the start.
 * Returns null when every landmark is already placed.
 */
export function nextUnplacedCode(
  placed: Set<string>,
  current: CephLandmarkCode | null,
): CephLandmarkCode | null {
  const codes = LANDMARK_CODES as readonly CephLandmarkCode[]
  const startAfter = current ? codes.indexOf(current) : -1
  for (let i = 1; i <= codes.length; i++) {
    const code = codes[(startAfter + i + codes.length) % codes.length]
    if (code && !placed.has(code)) return code
  }
  return null
}

// ---------------------------------------------------------------------------
// Keydown reducer
// ---------------------------------------------------------------------------

export interface CephKeyLandmark {
  landmarkCode: string
  x: number
  y: number
  status: 'not_placed' | 'placed' | 'confirmed' | 'locked' | string
}

export interface CephKeyContext {
  key: string
  selectedCode: CephLandmarkCode | null
  landmarks: CephKeyLandmark[]
}

export type CephKeyAction =
  | { type: 'select'; code: CephLandmarkCode | null }
  | { type: 'nudge'; code: CephLandmarkCode; x: number; y: number }
  | { type: 'none' }

export interface CephKeyDecision {
  action: CephKeyAction
  /** True when the workspace consumed the key (focus trap — stop browser default). */
  preventDefault: boolean
}

/**
 * Decide what a keydown does in the ceph workspace. Pure — the component just
 * dispatches the returned action.
 *   • Tab / Enter → advance selection to the next unplaced landmark (focus trap)
 *   • Arrow → nudge the selected placed/confirmed (non-locked) landmark 1px
 */
export function decideCephKey(ctx: CephKeyContext): CephKeyDecision {
  const { key, selectedCode, landmarks } = ctx

  if (key === 'Tab' || key === 'Enter') {
    const placed = new Set(landmarks.map((l) => l.landmarkCode))
    return { action: { type: 'select', code: nextUnplacedCode(placed, selectedCode) }, preventDefault: true }
  }

  const delta = arrowDelta(key)
  if (delta && selectedCode) {
    const lm = landmarks.find((l) => l.landmarkCode === selectedCode)
    if (lm && lm.status !== 'locked') {
      return {
        action: { type: 'nudge', code: selectedCode, x: lm.x + delta.dx, y: lm.y + delta.dy },
        preventDefault: true,
      }
    }
  }

  return { action: { type: 'none' }, preventDefault: false }
}
