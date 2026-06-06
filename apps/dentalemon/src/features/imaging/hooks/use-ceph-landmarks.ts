import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useMemo } from 'react'
import {
  cephMgmtListCephLandmarks,
  cephMgmtUpdateCephLandmark,
  cephMgmtBatchUpsertCephLandmarks,
  cephMgmtDeleteCephLandmark,
  cephMgmtDetectCephLandmarks,
} from '@monobase/sdk-ts/generated'
import type {
  DentalImagingModuleCephLandmark,
  DentalImagingModuleCephAnalysis,
  DentalImagingModuleCephLandmarkListResponse,
  DentalImagingModuleCephLandmarkDetectionResult,
  DentalImagingModuleCephLandmarkInput,
} from '@monobase/sdk-ts/generated'

export type CephLandmarkCode = 'S' | 'N' | 'A' | 'B' | 'ANS' | 'PNS' | 'Go' | 'Po' | 'Me' | 'Or' | 'Pog' | 'Gn' | 'U1T' | 'U1A' | 'L1T' | 'L1A'
export type CephLandmarkSource = 'manual' | 'ai' | 'ai_corrected'
export type CephLandmarkStatus = 'placed' | 'confirmed' | 'locked'

// View-model: timestamps as ISO strings (consumers treat them as strings).
// SDK types them as Date; we normalize in the queryFn below.
export interface CephLandmark {
  id: string
  imageId: string
  landmarkCode: CephLandmarkCode
  x: number
  y: number
  source: CephLandmarkSource
  confidence: number | null
  status: CephLandmarkStatus
  createdAt: string
  updatedAt: string
}

export interface CephAnalysis {
  imageId: string
  analysisType: string
  measurements: Record<string, number | null>
  missing: string[]
  uncalibrated: boolean
  calibrationValue: number | null
  calibrationMethod: string
  calibratedAt: string | null
  calibratedBy: string | null
  updatedAt: string
}

export interface CephLandmarksResponse {
  items: CephLandmark[]
  analysis: CephAnalysis
}

export interface CephLandmarkInput {
  landmarkCode: CephLandmarkCode
  x: number
  y: number
  source?: CephLandmarkSource
  confidence?: number | null
  status?: CephLandmarkStatus
}

interface CommitLandmarkVars {
  code: CephLandmarkCode
  x: number
  y: number
  status?: CephLandmarkStatus
}

export interface CephLandmarkPrediction {
  landmarkCode: CephLandmarkCode
  x: number
  y: number
  confidence: number
}

export interface CephDetectionResult {
  jobId: string
  status: 'pending' | 'succeeded' | 'failed'
  modelVersion: string
  provider: string
  predictions: CephLandmarkPrediction[]
  items: CephLandmark[]
  analysis: CephAnalysis | null
  error?: string
}

/**
 * P1-10: per-point low-confidence threshold (single source of truth shared with
 * the overlay + palette). Mirrors the backend CEPH_LOW_CONFIDENCE_THRESHOLD.
 */
export const CEPH_LOW_CONFIDENCE_THRESHOLD = 0.6

// SDK transforms Date fields; normalize to ISO strings for the view-model.
const toIso = (d: Date | string | undefined | null): string =>
  d == null ? '' : d instanceof Date ? d.toISOString() : String(d)

function sdkLandmarkToViewModel(l: DentalImagingModuleCephLandmark): CephLandmark {
  return {
    id: l.id,
    imageId: l.imageId,
    landmarkCode: l.landmarkCode as CephLandmarkCode,
    x: l.x,
    y: l.y,
    source: l.source as CephLandmarkSource,
    confidence: l.confidence,
    status: l.status as CephLandmarkStatus,
    createdAt: toIso(l.createdAt),
    updatedAt: toIso(l.updatedAt),
  }
}

function sdkAnalysisToViewModel(a: DentalImagingModuleCephAnalysis): CephAnalysis {
  return {
    imageId: a.imageId,
    analysisType: a.analysisType,
    measurements: a.measurements as Record<string, number | null>,
    missing: a.missing,
    uncalibrated: a.uncalibrated,
    calibrationValue: a.calibrationValue,
    calibrationMethod: a.calibrationMethod,
    calibratedAt: a.calibratedAt != null ? toIso(a.calibratedAt) : null,
    calibratedBy: a.calibratedBy,
    updatedAt: toIso(a.updatedAt),
  }
}

function sdkResponseToViewModel(
  raw: DentalImagingModuleCephLandmarkListResponse,
): CephLandmarksResponse {
  return {
    items: raw.items.map(sdkLandmarkToViewModel),
    analysis: sdkAnalysisToViewModel(raw.analysis),
  }
}

/** Narrow data from DentalImagingModuleCephLandmarkListResponse | ErrorResponse to the success type. */
function narrowLandmarkResponse(
  data: DentalImagingModuleCephLandmarkListResponse | { error: unknown },
): DentalImagingModuleCephLandmarkListResponse {
  if ('error' in data) throw new Error(String((data as { error: unknown }).error))
  return data as DentalImagingModuleCephLandmarkListResponse
}

/** Normalize a non-Error thrown value (SDK throws parsed body on non-2xx) to an Error. */
function normalizeThrown(e: unknown): never {
  if (e instanceof Error) throw e
  const msg = typeof e === 'string'
    ? e
    : (e as Record<string, unknown>)?.code != null
      ? String((e as Record<string, unknown>).code)
      : JSON.stringify(e)
  throw new Error(msg)
}

export function useCephLandmarks(imageId: string) {
  const queryClient = useQueryClient()
  const seqRef = useRef(0)

  const landmarksQueryKey = useMemo(() => ['ceph-landmarks', imageId], [imageId])
  const analysisQueryKey = useMemo(() => ['ceph-analysis', imageId], [imageId])
  const enabled = Boolean(imageId)

  const query = useQuery({
    queryKey: landmarksQueryKey,
    queryFn: async (): Promise<CephLandmarksResponse> => {
      const { data } = await cephMgmtListCephLandmarks({
        path: { imageId },
        throwOnError: true,
      })
      // With throwOnError: true, ErrorResponse is thrown; narrow for TypeScript.
      return sdkResponseToViewModel(narrowLandmarkResponse(data))
    },
    enabled,
    staleTime: 30_000,
  })

  // Local-only optimistic position update during drag — NO network call.
  // Component calls this on every pointermove; commitLandmark fires on pointerup only.
  function dragLandmark(code: CephLandmarkCode, x: number, y: number) {
    queryClient.setQueryData<CephLandmarksResponse>(landmarksQueryKey, (old) => {
      if (!old) return old
      return {
        ...old,
        items: old.items.map((l) => (l.landmarkCode === code ? { ...l, x, y } : l)),
      }
    })
  }

  // Pointer-up commit: PATCH with request sequencing.
  // seqRef increments in onMutate (before mutationFn runs); mutationFn captures
  // the current seq so onSuccess can ignore stale arrivals.
  const commitLandmark = useMutation<
    CephLandmarksResponse & { _seq: number },
    Error,
    CommitLandmarkVars,
    { snapshot: CephLandmarksResponse | undefined }
  >({
    mutationFn: async (vars) => {
      const seq = seqRef.current
      const { data } = await cephMgmtUpdateCephLandmark({
        path: { imageId, landmarkCode: vars.code },
        body: {
          x: vars.x,
          y: vars.y,
          ...(vars.status ? { status: vars.status } : {}),
        },
        throwOnError: true,
      })
      const normalized = sdkResponseToViewModel(narrowLandmarkResponse(data))
      return { ...normalized, _seq: seq }
    },
    onMutate: async (vars) => {
      seqRef.current += 1
      await queryClient.cancelQueries({ queryKey: landmarksQueryKey })
      const snapshot = queryClient.getQueryData<CephLandmarksResponse>(landmarksQueryKey)
      queryClient.setQueryData<CephLandmarksResponse>(landmarksQueryKey, (old) => {
        if (!old) return old
        return {
          ...old,
          items: old.items.map((l) =>
            l.landmarkCode === vars.code ? { ...l, x: vars.x, y: vars.y } : l,
          ),
        }
      })
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(landmarksQueryKey, context.snapshot)
      }
    },
    onSuccess: (data) => {
      // Only seed analysis cache from the most recent mutation; ignore stale arrivals.
      if (data._seq === seqRef.current) {
        queryClient.setQueryData<CephAnalysis>(analysisQueryKey, data.analysis)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: landmarksQueryKey })
      void queryClient.invalidateQueries({ queryKey: analysisQueryKey })
    },
  })

  const batchUpsert = useMutation({
    mutationFn: async (landmarks: CephLandmarkInput[]): Promise<CephLandmarksResponse> => {
      // Map local input to SDK input: drop null confidence (SDK accepts undefined only).
      const sdkLandmarks: DentalImagingModuleCephLandmarkInput[] = landmarks.map((l) => ({
        landmarkCode: l.landmarkCode,
        x: l.x,
        y: l.y,
        ...(l.source ? { source: l.source } : {}),
        ...(l.confidence != null ? { confidence: l.confidence } : {}),
        ...(l.status ? { status: l.status } : {}),
      }))
      try {
        const { data } = await cephMgmtBatchUpsertCephLandmarks({
          path: { imageId },
          body: { landmarks: sdkLandmarks },
          throwOnError: true,
        })
        return sdkResponseToViewModel(narrowLandmarkResponse(data))
      } catch (e: unknown) {
        normalizeThrown(e)
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<CephLandmarksResponse>(landmarksQueryKey, data)
      queryClient.setQueryData<CephAnalysis>(analysisQueryKey, data.analysis)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: landmarksQueryKey })
      void queryClient.invalidateQueries({ queryKey: analysisQueryKey })
    },
  })

  const deleteLandmark = useMutation({
    mutationFn: async (code: CephLandmarkCode): Promise<void> => {
      await cephMgmtDeleteCephLandmark({
        path: { imageId, landmarkCode: code },
        throwOnError: true,
      })
    },
    onMutate: async (code) => {
      await queryClient.cancelQueries({ queryKey: landmarksQueryKey })
      const snapshot = queryClient.getQueryData<CephLandmarksResponse>(landmarksQueryKey)
      queryClient.setQueryData<CephLandmarksResponse>(landmarksQueryKey, (old) => {
        if (!old) return old
        return { ...old, items: old.items.filter((l) => l.landmarkCode !== code) }
      })
      return { snapshot }
    },
    onError: (_err, _code, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(landmarksQueryKey, context.snapshot)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: landmarksQueryKey })
      void queryClient.invalidateQueries({ queryKey: analysisQueryKey })
    },
  })

  // P1-10: AI / auto landmark detection. POSTs to the detect endpoint; the server
  // persists predictions (source='ai', status='placed') and returns the post-write
  // landmark set, which seeds the caches so AI points render immediately. Tier/flag
  // gating surfaces as a thrown error (reuses isAddonError / FEATURE_DISABLED).
  const autoDetect = useMutation<CephDetectionResult, Error, void>({
    mutationFn: async (): Promise<CephDetectionResult> => {
      try {
        const { data } = await cephMgmtDetectCephLandmarks({
          path: { imageId },
          throwOnError: true,
        })
        // data is DentalImagingModuleCephLandmarkDetectionResult | ErrorResponse.
        if ('error' in data) throw new Error(String((data as { error: unknown }).error))
        const raw = data as DentalImagingModuleCephLandmarkDetectionResult
        return {
          jobId: raw.jobId,
          status: raw.status,
          modelVersion: raw.modelVersion,
          provider: raw.provider,
          predictions: raw.predictions.map((p) => ({
            landmarkCode: p.landmarkCode as CephLandmarkCode,
            x: p.x,
            y: p.y,
            confidence: p.confidence,
          })),
          items: raw.items.map(sdkLandmarkToViewModel),
          analysis: raw.analysis ? sdkAnalysisToViewModel(raw.analysis) : null,
          error: raw.error,
        }
      } catch (e: unknown) {
        normalizeThrown(e)
      }
    },
    onSuccess: (data) => {
      if (data.analysis) {
        queryClient.setQueryData<CephLandmarksResponse>(landmarksQueryKey, {
          items: data.items,
          analysis: data.analysis,
        })
        queryClient.setQueryData<CephAnalysis>(analysisQueryKey, data.analysis)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: landmarksQueryKey })
      void queryClient.invalidateQueries({ queryKey: analysisQueryKey })
    },
  })

  return {
    landmarks: query.data?.items ?? [],
    analysis: query.data?.analysis ?? null,
    isLoading: query.isLoading,
    // CONF-IMG-L2-001 (V-IMG-004): surface the landmarks/analysis query error so
    // the UI can render it instead of swallowing failures (tier-block / 422).
    error: query.error,
    // CONF-IMG-L2-001 (V-IMG-004): readable surface for the most recent mutation
    // failure (batchUpsert/commit/delete tier-block 402/403, validation 422) for
    // visible error UI.
    mutationError:
      commitLandmark.error ?? batchUpsert.error ?? deleteLandmark.error ?? null,
    dragLandmark,
    commitLandmark,
    batchUpsert,
    deleteLandmark,
    autoDetect,
  }
}
