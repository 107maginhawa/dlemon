import { describe, test, expect } from 'bun:test'
import { computeLoupeSource, loupeZoomForCode, DEFAULT_LOUPE_SIZE } from './ceph-loupe'

describe('loupeZoomForCode — 4× default, 6× for incisor apices', () => {
  test('returns 4 for a normal landmark code', () => {
    expect(loupeZoomForCode('S')).toBe(4)
    expect(loupeZoomForCode('N')).toBe(4)
    expect(loupeZoomForCode('A')).toBe(4)
  })

  test('returns 6 for the hardest points U1A and L1A', () => {
    expect(loupeZoomForCode('U1A')).toBe(6)
    expect(loupeZoomForCode('L1A')).toBe(6)
  })

  test('returns 4 when no landmark is selected', () => {
    expect(loupeZoomForCode(null)).toBe(4)
  })
})

describe('computeLoupeSource — centered crop sized by zoom', () => {
  test('source rect is loupeSize/zoom wide and centered on the pointer', () => {
    const src = computeLoupeSource({ x: 100, y: 80 }, 4, 160)
    // 160 / 4 = 40 px crop
    expect(src.sw).toBe(40)
    expect(src.sh).toBe(40)
    // centered: sx = px - sw/2
    expect(src.sx).toBe(80)
    expect(src.sy).toBe(60)
  })

  test('6× zoom yields a tighter crop than 4×', () => {
    const at4 = computeLoupeSource({ x: 200, y: 200 }, 4, 160)
    const at6 = computeLoupeSource({ x: 200, y: 200 }, 6, 160)
    expect(at6.sw).toBeLessThan(at4.sw)
    expect(at6.sw).toBeCloseTo(160 / 6, 5)
  })

  test('DEFAULT_LOUPE_SIZE is the 160px inset documented in the plan', () => {
    expect(DEFAULT_LOUPE_SIZE).toBe(160)
  })
})
