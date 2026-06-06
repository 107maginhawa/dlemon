import { useMutation, useQuery } from '@tanstack/react-query'
import {
  cephMgmtPreviewCephSuperimposition,
  cephMgmtGetCephReport,
} from '@monobase/sdk-ts/generated'
import type { SimilarityTransform } from '@monobase/ceph-math'

/** Registration reference. v1 supports `cranial_base` only. */
export type SuperimpositionReference = 'cranial_base' | 'maxillary' | 'mandibular'

export interface CephLandmarkDelta {
  landmarkCode: string
  dxPx: number
  dyPx: number
  magnitudePx: number
  dxMm: number | null
  dyMm: number | null
  magnitudeMm: number | null
  directionDeg: number
}

export interface CephMetricDelta {
  metric: string
  from: number | null
  to: number | null
  delta: number | null
}

export interface CephSuperimposition {
  id: string | null
  patientId: string
  reportFromId: string
  reportToId: string
  reference: SuperimpositionReference
  transform: SimilarityTransform
  landmarkDeltas: CephLandmarkDelta[]
  metricDeltas: CephMetricDelta[]
  uncalibrated: boolean
  calibrationBasis: Record<string, unknown>
  label: string
  createdAt: string | null
}

export interface SuperimpositionInput {
  reportFromId: string
  reportToId: string
  reference: SuperimpositionReference
}

/**
 * Compute-on-the-fly superimposition preview (P1-11 v1). Does not persist.
 * The backend returns the v1 honesty `label` which the UI surfaces verbatim.
 */
export function useCephSuperimpositionPreview() {
  return useMutation({
    mutationKey: ['ceph-superimposition-preview'],
    mutationFn: async (input: SuperimpositionInput): Promise<CephSuperimposition> => {
      const { data } = await cephMgmtPreviewCephSuperimposition({
        body: input,
        throwOnError: true,
      })
      // data is DentalImagingModuleCephSuperimposition | ErrorResponse;
      // narrow via 'patientId' discriminant (absent in ErrorResponse).
      const raw = data as {
        id: string | null
        patientId: string
        reportFromId: string
        reportToId: string
        reference: SuperimpositionReference
        transform: SimilarityTransform
        landmarkDeltas: CephLandmarkDelta[]
        metricDeltas: CephMetricDelta[]
        uncalibrated: boolean
        calibrationBasis: Record<string, unknown>
        label: string
        createdAt: Date | string | null
      }
      return {
        id: raw.id,
        patientId: raw.patientId,
        reportFromId: raw.reportFromId,
        reportToId: raw.reportToId,
        reference: raw.reference,
        transform: raw.transform,
        landmarkDeltas: raw.landmarkDeltas,
        metricDeltas: raw.metricDeltas,
        uncalibrated: raw.uncalibrated,
        calibrationBasis: raw.calibrationBasis,
        label: raw.label,
        createdAt:
          raw.createdAt == null
            ? null
            : raw.createdAt instanceof Date
            ? raw.createdAt.toISOString()
            : String(raw.createdAt),
      }
    },
  })
}

export interface LatestCephReport {
  id: string
  version: number
  createdAt: string
}

/**
 * Fetch the latest ceph report-version snapshot for an image (the timepoint a
 * superimposition consumes — plan §6.1, "report versions are snapshots").
 * Returns null when the image has no report yet (superimposition unavailable).
 */
export function useLatestCephReport(imageId: string | undefined) {
  return useQuery({
    queryKey: ['ceph-report-latest', imageId],
    queryFn: async (): Promise<LatestCephReport | null> => {
      // 404→null: use throwOnError: false so we get the response status from
      // the result object (compatible with both the SdkError interceptor path
      // in production and the bare mock-fetch path in unit tests).
      const result = await cephMgmtGetCephReport({
        path: { imageId: imageId! },
        throwOnError: false,
      })
      // Access the raw HTTP response status from the resolved result.
      const httpStatus = (result as { response?: Response }).response?.status
      if (httpStatus === 404) return null
      // Surface other non-2xx errors to TanStack Query's error boundary.
      if (result.error != null) {
        throw new Error(
          typeof result.error === 'string'
            ? result.error
            : JSON.stringify(result.error),
        )
      }
      const raw = result.data as { id: string; version: number; createdAt: Date | string }
      return {
        id: raw.id,
        version: raw.version,
        createdAt:
          raw.createdAt instanceof Date ? raw.createdAt.toISOString() : String(raw.createdAt),
      }
    },
    enabled: Boolean(imageId),
    staleTime: 30_000,
  })
}
