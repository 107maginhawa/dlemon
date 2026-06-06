import { useQuery } from '@tanstack/react-query'
import { cephMgmtGetCephAnalysis } from '@monobase/sdk-ts/generated'
import type {
  DentalImagingModuleCephLandmarkListResponse,
} from '@monobase/sdk-ts/generated'
import type { CephAnalysis } from './use-ceph-landmarks'

export type { CephAnalysis }

export function useCephAnalysis(imageId: string, analysisType: string = 'steiner_hybrid_sn') {
  const query = useQuery({
    // analysisType in the key so the switcher refetches per protocol; the commit
    // mutation's invalidate(['ceph-analysis', imageId]) prefix-matches all types.
    queryKey: ['ceph-analysis', imageId, analysisType],
    queryFn: async (): Promise<CephAnalysis> => {
      const { data } = await cephMgmtGetCephAnalysis({
        path: { imageId },
        query: { analysisType },
        throwOnError: true,
      })
      // data is DentalImagingModuleCephLandmarkListResponse | ErrorResponse.
      // With throwOnError: true, ErrorResponse becomes a thrown error so data
      // always narrows to the success branch here. Use the 'error' discriminant
      // from ErrorResponse to keep TypeScript happy, then map .analysis.
      if ('error' in data) throw new Error(String((data as { error: unknown }).error))
      const success = data as DentalImagingModuleCephLandmarkListResponse
      const a = success.analysis
      return {
        imageId: a.imageId,
        analysisType: a.analysisType,
        measurements: a.measurements as Record<string, number | null>,
        missing: a.missing,
        uncalibrated: a.uncalibrated,
        calibrationValue: a.calibrationValue,
        calibrationMethod: a.calibrationMethod,
        calibratedAt: a.calibratedAt != null
          ? (a.calibratedAt instanceof Date ? a.calibratedAt.toISOString() : String(a.calibratedAt))
          : null,
        calibratedBy: a.calibratedBy,
        updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : String(a.updatedAt),
      }
    },
    enabled: Boolean(imageId),
    staleTime: 30_000,
    // A tier-gate 403 (free/null imaging tier) will never succeed on retry, so
    // surface it to the addon/upgrade UI immediately instead of running the
    // default 3× exponential backoff first (which delayed the gate >15s under
    // load and flaked the B01 journey). Other (transient) errors still retry.
    retry: (failureCount, error) => {
      // The SDK throws the parsed response body on non-2xx; it may be an Error
      // instance (with errorInterceptor installed), a plain string, or a raw
      // object (e.g. { error: { code, message } } when the interceptor is absent
      // in tests). Normalise to a string the regex can match against.
      const msg = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : JSON.stringify(error)
      if (/403|forbidden|imaging_tier_required/i.test(msg)) return false
      return failureCount < 2
    },
  })

  return {
    analysis: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
