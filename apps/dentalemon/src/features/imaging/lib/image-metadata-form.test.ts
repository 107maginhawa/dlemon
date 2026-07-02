import { describe, it, expect } from 'bun:test'
import {
  normalizeTags,
  tagsToInput,
  buildMetadataBody,
  isValidLinkTarget,
  isoToDateInput,
  dateInputToIso,
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

  // §capture-date: the editor sends the full metadata each save, so capturedAt is
  // only included when the operator actually changed the date — otherwise every
  // save would re-stamp source=manual + write an audit row.
  it('omits capturedAt when unchanged from the initial value', () => {
    const body = buildMetadataBody({
      isDiagnostic: true, qualityStatus: 'ok', retakeReason: '', tagsInput: '',
      capturedAtInput: '2026-05-01', initialCapturedAtInput: '2026-05-01',
    })
    expect('capturedAt' in body).toBe(false)
  })

  it('includes capturedAt (Date at midnight UTC) when the date changed', () => {
    const body = buildMetadataBody({
      isDiagnostic: true, qualityStatus: 'ok', retakeReason: '', tagsInput: '',
      capturedAtInput: '2026-04-15', initialCapturedAtInput: '2026-05-01',
    })
    expect(body.capturedAt).toBeInstanceOf(Date)
    expect((body.capturedAt as Date).toISOString()).toBe('2026-04-15T00:00:00.000Z')
  })

  it('omits capturedAt when the input is blank', () => {
    const body = buildMetadataBody({
      isDiagnostic: true, qualityStatus: 'ok', retakeReason: '', tagsInput: '',
      capturedAtInput: '', initialCapturedAtInput: '2026-05-01',
    })
    expect('capturedAt' in body).toBe(false)
  })
})

describe('capture-date input helpers (§capture-date)', () => {
  it('isoToDateInput → YYYY-MM-DD (UTC day)', () => {
    expect(isoToDateInput('2026-05-01T09:30:00.000Z')).toBe('2026-05-01')
    expect(isoToDateInput(null)).toBe('')
  })
  it('dateInputToIso → midnight-UTC ISO', () => {
    expect(dateInputToIso('2026-05-01')).toBe('2026-05-01T00:00:00.000Z')
    expect(dateInputToIso('')).toBe('')
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
