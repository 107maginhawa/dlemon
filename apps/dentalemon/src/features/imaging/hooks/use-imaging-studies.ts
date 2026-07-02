/**
 * useImagingStudies — TanStack Query hook for patient image list
 *
 * API: GET /dental/patients/{patientId}/images?branchId=
 */
import { useQuery } from '@tanstack/react-query'
import {
  patientImageMgmtListPatientImagesOptions,
} from '@monobase/sdk-ts/generated/react-query'
import type { DentalImagingModulePatientImageItem } from '@monobase/sdk-ts/generated'

// String-dated, number-sized view-model the image-list consumers + E2E fixtures
// expect. The SDK models fileSizeBytes as bigint and createdAt as Date; we
// normalize both at the edge so consumers (and JSON-serializable test fixtures)
// keep working against plain primitives.
export interface PatientImageItem {
  id: string
  source: DentalImagingModulePatientImageItem['source']
  modality: DentalImagingModulePatientImageItem['modality']
  fileName: string
  mimeType: string
  fileSizeBytes: number
  studyId: string | null
  visitId: string | null
  toothNumbers: number[]
  createdAt: string
  // §capture-date: when the image was TAKEN (ISO). Null only for rows with no
  // backing metadata; consumers coalesce capturedAt ?? createdAt. Provenance in
  // capturedAtSource ('dicom_tag' | 'manual' | 'defaulted_upload' | …).
  capturedAt: string | null
  capturedAtSource: string | null
  downloadUrl: string | null
  isVolume?: boolean
  frameCount?: number | null
  viewerKind?: DentalImagingModulePatientImageItem['viewerKind']
  // G5 library metadata (defaulted at the edge so older fixtures keep working).
  isDiagnostic: boolean
  qualityStatus: 'ok' | 'retake'
  retakeReason: string | null
  tags: string[]
  // G5b context links (treatment plan / report).
  links: { id: string; linkType: 'treatment_plan' | 'report'; targetId: string }[]
}

const toIso = (d: Date | string): string => (d instanceof Date ? d.toISOString() : String(d))

function toViewModel(item: DentalImagingModulePatientImageItem): PatientImageItem {
  return {
    id: item.id,
    source: item.source,
    modality: item.modality,
    fileName: item.fileName,
    mimeType: item.mimeType,
    fileSizeBytes: Number(item.fileSizeBytes),
    studyId: item.studyId,
    visitId: item.visitId,
    toothNumbers: item.toothNumbers,
    createdAt: toIso(item.createdAt),
    capturedAt: item.capturedAt != null ? toIso(item.capturedAt) : null,
    capturedAtSource: item.capturedAtSource ?? null,
    downloadUrl: item.downloadUrl,
    ...(item.isVolume !== undefined ? { isVolume: item.isVolume } : {}),
    ...(item.frameCount !== undefined ? { frameCount: item.frameCount } : {}),
    ...(item.viewerKind !== undefined ? { viewerKind: item.viewerKind } : {}),
    // G5: default to diagnostic/ok/untagged when the server omits the fields.
    isDiagnostic: item.isDiagnostic ?? true,
    qualityStatus: item.qualityStatus ?? 'ok',
    retakeReason: item.retakeReason ?? null,
    tags: item.tags ?? [],
    links: (item.links ?? []).map((l) => ({ id: l.id, linkType: l.linkType, targetId: l.targetId })),
  }
}

export function useImagingStudies(patientId: string, branchId?: string) {
  return useQuery({
    ...patientImageMgmtListPatientImagesOptions({
      path: { patientId },
      query: { branchId: branchId! },
    }),
    enabled: Boolean(patientId) && Boolean(branchId),
    staleTime: 30_000,
    select: (data): { items: PatientImageItem[]; total: number } => {
      // SDK returns DentalImagingModuleListPatientImagesResponse | ErrorResponse
      // (the latter discriminated by a top-level `error` object).
      if (!data || 'error' in data) return { items: [], total: 0 }
      return { items: data.items.map(toViewModel), total: data.total }
    },
  })
}
