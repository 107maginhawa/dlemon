import { useMutation, useQuery } from '@tanstack/react-query'
import { apiBaseUrl } from '@/lib/config'
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
      const res = await fetch(`${apiBaseUrl}/dental/imaging/ceph/superimpositions/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Superimposition failed (${res.status})`)
      }
      return (await res.json()) as CephSuperimposition
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
      const res = await fetch(`${apiBaseUrl}/dental/imaging/images/${imageId}/ceph/reports`, {
        credentials: 'include',
      })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { id: string; version: number; createdAt: string }
      return { id: data.id, version: data.version, createdAt: data.createdAt }
    },
    enabled: Boolean(imageId),
    staleTime: 30_000,
  })
}
