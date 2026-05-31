import { describe, test, expect } from 'bun:test'
import { composeCephCanvas, canvasToPngBlob } from './ceph-export'
import type { CephLandmark } from '../features/imaging/hooks/use-ceph-landmarks'

function mkImg(naturalWidth: number, naturalHeight: number): HTMLImageElement {
  return { naturalWidth, naturalHeight, width: naturalWidth, height: naturalHeight } as HTMLImageElement
}

function mkLandmark(code: CephLandmark['landmarkCode'], x: number, y: number): CephLandmark {
  return {
    id: `id-${code}`,
    imageId: 'img1',
    landmarkCode: code,
    x,
    y,
    source: 'manual',
    confidence: null,
    status: 'confirmed',
    createdAt: '',
    updatedAt: '',
  }
}

describe('composeCephCanvas — aspect ratio', () => {
  test('preserves 4:3 (landscape)', () => {
    const canvas = composeCephCanvas(mkImg(800, 600), [])
    expect(canvas.width / canvas.height).toBeCloseTo(800 / 600, 5)
  })

  test('preserves 3:4 (portrait)', () => {
    const canvas = composeCephCanvas(mkImg(600, 800), [])
    expect(canvas.width / canvas.height).toBeCloseTo(600 / 800, 5)
  })

  test('preserves 1:1 (square)', () => {
    const canvas = composeCephCanvas(mkImg(512, 512), [])
    expect(canvas.width / canvas.height).toBeCloseTo(1, 5)
  })

  test('preserves 16:9 (widescreen)', () => {
    const canvas = composeCephCanvas(mkImg(1920, 1080), [])
    expect(canvas.width / canvas.height).toBeCloseTo(1920 / 1080, 4)
  })
})

describe('composeCephCanvas — sizing', () => {
  test('large image capped at maxSize along longest side', () => {
    const canvas = composeCephCanvas(mkImg(4000, 3000), [], { maxSize: 2048 })
    expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(2048)
    expect(canvas.width / canvas.height).toBeCloseTo(4000 / 3000, 5)
  })

  test('tall image capped along height when height is longer', () => {
    const canvas = composeCephCanvas(mkImg(1000, 4000), [], { maxSize: 2048 })
    expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(2048)
    expect(canvas.width / canvas.height).toBeCloseTo(1000 / 4000, 5)
  })

  test('small image is not upscaled', () => {
    const canvas = composeCephCanvas(mkImg(400, 300), [], { maxSize: 2048 })
    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(300)
  })

  test('default maxSize is applied when option omitted', () => {
    const canvas = composeCephCanvas(mkImg(5000, 4000), [])
    expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(2048)
  })
})

describe('composeCephCanvas — output type', () => {
  test('returns an HTMLCanvasElement', () => {
    const canvas = composeCephCanvas(mkImg(800, 600), [])
    expect(canvas).toBeInstanceOf(HTMLCanvasElement)
  })

  test('accepts landmarks without throwing', () => {
    const lms = [
      mkLandmark('S', 100, 200),
      mkLandmark('N', 300, 200),
      mkLandmark('A', 290, 271),
    ]
    expect(() => composeCephCanvas(mkImg(800, 600), lms)).not.toThrow()
  })
})

describe('canvasToPngBlob', () => {
  test('resolves with a Blob when toBlob succeeds', async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 10
    canvas.height = 10
    const mockBlob = new Blob(['x'], { type: 'image/png' })
    canvas.toBlob = (cb: BlobCallback) => { queueMicrotask(() => cb(mockBlob)) }
    const blob = await canvasToPngBlob(canvas)
    expect(blob).toBeInstanceOf(Blob)
  })

  test('rejects when toBlob returns null', async () => {
    const canvas = document.createElement('canvas')
    canvas.toBlob = (cb: BlobCallback) => { queueMicrotask(() => cb(null)) }
    await expect(canvasToPngBlob(canvas)).rejects.toThrow()
  })
})
