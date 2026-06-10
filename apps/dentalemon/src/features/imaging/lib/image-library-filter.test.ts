import { describe, it, expect } from 'bun:test'
import { filterImageLibrary, collectTags } from './image-library-filter'
import type { PatientImageItem } from '@/features/imaging/hooks/use-imaging-studies'

const make = (over: Partial<PatientImageItem>): PatientImageItem => ({
  id: 'x', source: 'imaging', modality: 'periapical', fileName: 'a', mimeType: 'image/png',
  fileSizeBytes: 1, studyId: 's', visitId: null, toothNumbers: [], createdAt: '2026-01-01',
  downloadUrl: null, isDiagnostic: true, qualityStatus: 'ok', retakeReason: null, tags: [],
  ...over,
})

const items: PatientImageItem[] = [
  make({ id: 'a', tags: ['ortho'] }),
  make({ id: 'b', isDiagnostic: false, qualityStatus: 'retake', tags: ['review', 'PA'] }),
]

describe('filterImageLibrary', () => {
  it('no filter → identity', () => {
    expect(filterImageLibrary(items, {})).toHaveLength(2)
  })
  it('diagnosticOnly drops non-diagnostic', () => {
    expect(filterImageLibrary(items, { diagnosticOnly: true }).map((i) => i.id)).toEqual(['a'])
  })
  it('qualityStatus filters', () => {
    expect(filterImageLibrary(items, { qualityStatus: 'retake' }).map((i) => i.id)).toEqual(['b'])
  })
  it('tag match is case-insensitive', () => {
    expect(filterImageLibrary(items, { tag: 'pa' }).map((i) => i.id)).toEqual(['b'])
  })
})

describe('collectTags', () => {
  it('returns distinct sorted tags', () => {
    // localeCompare orders case-insensitively (o < p < r).
    expect(collectTags(items)).toEqual(['ortho', 'PA', 'review'])
  })
})
