import { describe, test, expect } from 'bun:test'
import {
  FMX_TEMPLATE,
  assignImagesToFmx,
  unmountedImages,
  type FmxImageLike,
} from './fmx-layout'

function img(id: string, modality: string, toothNumbers: number[]): FmxImageLike {
  return { id, modality, toothNumbers }
}

describe('FMX mount template (P2-5)', () => {
  test('template has the three anatomical rows', () => {
    const rows = new Set(FMX_TEMPLATE.map((p) => p.row))
    expect(rows.has('maxillary')).toBe(true)
    expect(rows.has('bitewing')).toBe(true)
    expect(rows.has('mandibular')).toBe(true)
  })

  test('template defines a full intraoral series (>= 18 films)', () => {
    expect(FMX_TEMPLATE.length).toBeGreaterThanOrEqual(18)
  })

  test('every position id is unique', () => {
    const ids = FMX_TEMPLATE.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('assignImagesToFmx', () => {
  test('slots a periapical into a maxillary position by tooth number', () => {
    const result = assignImagesToFmx([img('a', 'periapical', [3])])
    const max = result.find((r) => r.position.id === 'max-ur-molar')
    expect(max?.image?.id).toBe('a')
  })

  test('slots a bitewing into a bitewing position, not a periapical slot', () => {
    const result = assignImagesToFmx([img('bw', 'bitewing', [3])])
    const bw = result.find((r) => r.position.row === 'bitewing' && r.image?.id === 'bw')
    expect(bw).toBeDefined()
    const max = result.find((r) => r.position.id === 'max-ur-molar')
    expect(max?.image).toBeNull()
  })

  test('a periapical does not fill a bitewing slot', () => {
    const result = assignImagesToFmx([img('pa', 'periapical', [3])])
    const anyBitewing = result.filter((r) => r.position.row === 'bitewing')
    expect(anyBitewing.every((r) => r.image === null)).toBe(true)
  })

  test('each image is used at most once across positions', () => {
    const result = assignImagesToFmx([img('a', 'periapical', [8])])
    const placements = result.filter((r) => r.image?.id === 'a')
    expect(placements.length).toBe(1)
  })

  test('empty slots are returned with image=null', () => {
    const result = assignImagesToFmx([])
    expect(result.length).toBe(FMX_TEMPLATE.length)
    expect(result.every((r) => r.image === null)).toBe(true)
  })
})

describe('unmountedImages', () => {
  test('returns images that match no slot (e.g. a panoramic)', () => {
    const left = unmountedImages([img('pano', 'panoramic', [])])
    expect(left.map((i) => i.id)).toContain('pano')
  })

  test('mounted periapicals are not reported as unmounted', () => {
    const left = unmountedImages([img('a', 'periapical', [8])])
    expect(left.map((i) => i.id)).not.toContain('a')
  })
})
