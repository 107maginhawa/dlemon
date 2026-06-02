import { describe, expect, test } from 'bun:test'
import type { CephTransformState, SimilarityTransform } from '@monobase/ceph-math'
import { imageToScreen, applyTransform } from '@monobase/ceph-math'
import {
  timepointAToScreen,
  timepointBToScreen,
  resolveBLayerOpacity,
} from './ceph-superimposition-geometry'

const VIEW: CephTransformState = {
  canvasWidth: 800,
  canvasHeight: 600,
  imgWidth: 400,
  imgHeight: 300,
  scale: 1.5,
  flip: false,
  rotation: 1,
  offsetX: 20,
  offsetY: -10,
}

const IDENTITY: SimilarityTransform = {
  scale: 1,
  rotationRad: 0,
  tx: 0,
  ty: 0,
  basis: ['S', 'N'],
}

describe('compositor: registration UNDER view transform', () => {
  test('timepointAToScreen is the plain view transform', () => {
    const p = { x: 123, y: 77 }
    expect(timepointAToScreen(p, VIEW)).toEqual(imageToScreen(p.x, p.y, VIEW))
  })

  test('identity registration → B maps exactly like A (synced)', () => {
    const p = { x: 200, y: 150 }
    const a = timepointAToScreen(p, VIEW)
    const b = timepointBToScreen(p, IDENTITY, VIEW)
    expect(b.x).toBeCloseTo(a.x, 8)
    expect(b.y).toBeCloseTo(a.y, 8)
  })

  test('non-identity registration composes correctly (registration then view)', () => {
    const reg: SimilarityTransform = { scale: 1.2, rotationRad: 0.3, tx: 30, ty: -15, basis: ['S', 'N'] }
    const p = { x: 100, y: 90 }
    // expected: apply registration in image-space, then view transform
    const inA = applyTransform(p, reg)
    const expected = imageToScreen(inA.x, inA.y, VIEW)
    const got = timepointBToScreen(p, reg, VIEW)
    expect(got.x).toBeCloseTo(expected.x, 8)
    expect(got.y).toBeCloseTo(expected.y, 8)
  })

  test('both layers share ONE view transform (zoom change moves both equally)', () => {
    const zoomed: CephTransformState = { ...VIEW, scale: 3 }
    const p = { x: 250, y: 120 }
    const a = timepointAToScreen(p, zoomed)
    const b = timepointBToScreen(p, IDENTITY, zoomed)
    expect(b.x).toBeCloseTo(a.x, 8)
    expect(b.y).toBeCloseTo(a.y, 8)
  })
})

describe('resolveBLayerOpacity — onion-skin / reduced-motion', () => {
  test('static slider drives B-layer alpha when onion-skin off', () => {
    expect(resolveBLayerOpacity({ opacityPct: 40, onionSkin: false, reducedMotion: false })).toBeCloseTo(0.4, 6)
    expect(resolveBLayerOpacity({ opacityPct: 0, onionSkin: false, reducedMotion: false })).toBe(0)
    expect(resolveBLayerOpacity({ opacityPct: 100, onionSkin: false, reducedMotion: false })).toBe(1)
  })

  test('reduced-motion disables animation → static slider value (equal path)', () => {
    const alpha = resolveBLayerOpacity({
      opacityPct: 65,
      onionSkin: true,
      reducedMotion: true,
      phase: 0.5,
    })
    expect(alpha).toBeCloseTo(0.65, 6)
  })

  test('onion-skin animates as triangle wave when motion allowed', () => {
    expect(resolveBLayerOpacity({ opacityPct: 50, onionSkin: true, reducedMotion: false, phase: 0 })).toBeCloseTo(0, 6)
    expect(resolveBLayerOpacity({ opacityPct: 50, onionSkin: true, reducedMotion: false, phase: 0.5 })).toBeCloseTo(1, 6)
    expect(resolveBLayerOpacity({ opacityPct: 50, onionSkin: true, reducedMotion: false, phase: 1 })).toBeCloseTo(0, 6)
  })

  test('opacity clamps out-of-range input', () => {
    expect(resolveBLayerOpacity({ opacityPct: 150, onionSkin: false, reducedMotion: false })).toBe(1)
    expect(resolveBLayerOpacity({ opacityPct: -20, onionSkin: false, reducedMotion: false })).toBe(0)
  })
})
