import { describe, it, expect } from 'bun:test'
import {
  normalizeTags,
  tagsToInput,
  buildMetadataBody,
  isValidLinkTarget,
} from './image-metadata-form'

describe('normalizeTags', () => {
  it('splits on commas, trims, drops blanks', () => {
    expect(normalizeTags(' ortho ,  , review ')).toEqual(['ortho', 'review'])
  })
  it('de-dupes preserving first occurrence', () => {
    expect(normalizeTags('PA, pa, PA, review')).toEqual(['PA', 'pa', 'review'])
  })
  it('clamps each tag to 50 chars', () => {
    const long = 'x'.repeat(80)
    expect(normalizeTags(long)).toEqual(['x'.repeat(50)])
  })
  it('caps at 30 tags', () => {
    const many = Array.from({ length: 40 }, (_, i) => `t${i}`).join(',')
    expect(normalizeTags(many)).toHaveLength(30)
  })
  it('empty input → empty array', () => {
    expect(normalizeTags('   ')).toEqual([])
  })
})

describe('tagsToInput', () => {
  it('joins tags with comma+space for round-tripping into the input', () => {
    expect(tagsToInput(['ortho', 'review'])).toBe('ortho, review')
  })
  it('empty list → empty string', () => {
    expect(tagsToInput([])).toBe('')
  })
})

describe('buildMetadataBody', () => {
  it('passes through flags and normalizes tags', () => {
    expect(
      buildMetadataBody({
        isDiagnostic: false,
        qualityStatus: 'ok',
        retakeReason: '',
        tagsInput: 'ortho, ortho, review',
      }),
    ).toEqual({
      isDiagnostic: false,
      qualityStatus: 'ok',
      retakeReason: null,
      tags: ['ortho', 'review'],
    })
  })
  it('keeps a trimmed retake reason only when quality is retake', () => {
    expect(
      buildMetadataBody({
        isDiagnostic: true,
        qualityStatus: 'retake',
        retakeReason: '  overexposed  ',
        tagsInput: '',
      }),
    ).toEqual({
      isDiagnostic: true,
      qualityStatus: 'retake',
      retakeReason: 'overexposed',
      tags: [],
    })
  })
  it('forces retakeReason null when quality is ok even if text present', () => {
    const body = buildMetadataBody({
      isDiagnostic: true,
      qualityStatus: 'ok',
      retakeReason: 'leftover text',
      tagsInput: '',
    })
    expect(body.retakeReason).toBeNull()
  })
  it('forces retakeReason null when quality is retake but reason blank', () => {
    const body = buildMetadataBody({
      isDiagnostic: true,
      qualityStatus: 'retake',
      retakeReason: '   ',
      tagsInput: '',
    })
    expect(body.retakeReason).toBeNull()
  })
})

describe('isValidLinkTarget', () => {
  it('accepts a uuid', () => {
    expect(isValidLinkTarget('11111111-2222-3333-4444-555555555555')).toBe(true)
  })
  it('rejects non-uuid strings', () => {
    expect(isValidLinkTarget('not-a-uuid')).toBe(false)
    expect(isValidLinkTarget('')).toBe(false)
    expect(isValidLinkTarget('  ')).toBe(false)
  })
  it('trims surrounding whitespace before validating', () => {
    expect(isValidLinkTarget('  11111111-2222-3333-4444-555555555555  ')).toBe(true)
  })
})
