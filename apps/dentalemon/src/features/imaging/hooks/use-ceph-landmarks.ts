import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useMemo } from 'react'
import { apiBaseUrl } from '@/lib/config'

export type CephLandmarkCode = 'S' | 'N' | 'A' | 'B' | 'ANS' | 'PNS' | 'Go' | 'Po' | 'Me' | 'Or' | 'Pog' | 'Gn' | 'U1T' | 'U1A' | 'L1T' | 'L1A'
export type CephLandmarkSource = 'manual' | 'ai' | 'ai_corrected'
export type CephLandmarkStatus = 'placed' | 'confirmed' | 'locked'

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

export function useCephLandmarks(imageId: string) {
  const queryClient = useQueryClient()
  const seqRef = useRef(0)

  const landmarksQueryKey = useMemo(() => ['ceph-landmarks', imageId], [imageId])
  const analysisQueryKey = useMemo(() => ['ceph-analysis', imageId], [imageId])
  const enabled = Boolean(imageId)

  const query = useQuery({
    queryKey: landmarksQueryKey,
    queryFn: async (): Promise<CephLandmarksResponse> => {
      const res = await fetch(`${apiBaseUrl}/dental/imaging/images/${imageId}/ceph/landmarks`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<CephLandmarksResponse>
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
      const body: Record<string, unknown> = { x: vars.x, y: vars.y }
      if (vars.status) body.status = vars.status
      const res = await fetch(
        `${apiBaseUrl}/dental/imaging/images/${imageId}/ceph/landmarks/${vars.code}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as CephLandmarksResponse
      return { ...data, _seq: seq }
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
      const res = await fetch(`${apiBaseUrl}/dental/imaging/images/${imageId}/ceph/landmarks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarks }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<CephLandmarksResponse>
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
      const res = await fetch(
        `${apiBaseUrl}/dental/imaging/images/${imageId}/ceph/landmarks/${code}`,
        { method: 'DELETE', credentials: 'include' },
      )
      if (!res.ok && res.status !== 204) throw new Error(await res.text())
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
  }
}
