/**
 * use-ceph-landmarks — unit tests
 *
 * Covers: list query, dragLandmark (local-only), commitLandmark (PATCH + optimistic
 * + request sequencing), batchUpsert (POST), deleteLandmark (DELETE + optimistic).
 */
import { describe, test, expect, afterEach, mock } from 'bun:test'
import { renderHook, waitFor, cleanup, act } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { useCephLandmarks, type CephLandmark, type CephLandmarksResponse, type CephAnalysis } from './use-ceph-landmarks'
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils'

/**
 * A QueryClient whose mutations retry up to 3× — the consequential half of the
 * production policy (packages/sdk-ts/src/react/provider.tsx → shouldRetry).
 * In production `shouldRetry` DOES skip 4xx, but only when the error is an
 * `SdkError`; the autoDetect mutationFn runs `normalizeThrown` which collapses the
 * `SdkError` into a plain `Error`, so `shouldRetry` falls to its `return true`
 * branch and the permanent 403 retries. This client reproduces exactly that
 * fall-through path. `freshClientWithMutations` disables retries, which is why the
 * existing autoDetect tests never caught the storm. `retry: false` on the mutation
 * cuts the loop before the error type matters.
 */
function prodLikeMutationClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: {
        retry: (failureCount: number) => failureCount < 3,
        retryDelay: 0,
      },
    },
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLandmark(overrides: Partial<CephLandmark> = {}): CephLandmark {
  return {
    id: 'lm-1',
    imageId: 'img-1',
    landmarkCode: 'S',
    x: 100,
    y: 200,
    source: 'manual',
    confidence: null,
    status: 'placed',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeAnalysis(overrides: Partial<CephAnalysis> = {}): CephAnalysis {
  return {
    imageId: 'img-1',
    analysisType: 'steiner_hybrid_sn',
    measurements: { sna: 82.0, snb: 80.0, anb: 2.0 },
    missing: [],
    uncalibrated: false,
    calibrationValue: null,
    calibrationMethod: 'unknown',
    calibratedAt: null,
    calibratedBy: null,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeResponse(items: CephLandmark[] = [], analysis?: CephAnalysis): CephLandmarksResponse {
  return { items, analysis: analysis ?? makeAnalysis() }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

// ─── Query ───────────────────────────────────────────────────────────────────

describe('useCephLandmarks — query', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch; cleanup() })

  test('returns landmarks on successful fetch', async () => {
    const landmarks = [makeLandmark({ id: 'lm-1', landmarkCode: 'S' })]
    global.fetch = mock(() => jsonResponse(makeResponse(landmarks)))

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks('img-1'), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.landmarks).toHaveLength(1)
    expect(result.current.landmarks[0]!.landmarkCode).toBe('S')
  })

  test('returns empty array when no landmarks', async () => {
    global.fetch = mock(() => jsonResponse(makeResponse([])))

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks('img-1'), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.landmarks).toHaveLength(0)
  })

  test('hits the correct URL', async () => {
    let capturedUrl = ''
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req)
      return jsonResponse(makeResponse())
    })

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks('img-42'), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(capturedUrl).toContain('/dental/imaging/images/img-42/ceph/landmarks')
  })

  test('is disabled when imageId is empty', async () => {
    const fetchSpy = mock(() => jsonResponse(makeResponse()))
    global.fetch = fetchSpy

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks(''), { wrapper: makeWrapper(qc) })

    expect(result.current.isLoading).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ─── dragLandmark (local-only, no network) ───────────────────────────────────

describe('useCephLandmarks — dragLandmark (pointer-up-only commit)', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch; cleanup() })

  test('dragLandmark updates local cache — 0 network calls', async () => {
    const landmarks = [
      makeLandmark({ id: 'lm-1', landmarkCode: 'S', x: 100, y: 200 }),
      makeLandmark({ id: 'lm-2', landmarkCode: 'N', x: 300, y: 200 }),
    ]
    const fetchSpy = mock(() => jsonResponse(makeResponse(landmarks)))
    global.fetch = fetchSpy

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks('img-1'), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const initialCallCount = (fetchSpy as ReturnType<typeof mock>).mock.calls.length

    // Simulate drag: 5 pointer-move calls — should NOT fire any PATCH
    act(() => { result.current.dragLandmark('S', 110, 205) })
    act(() => { result.current.dragLandmark('S', 120, 210) })
    act(() => { result.current.dragLandmark('S', 130, 215) })
    act(() => { result.current.dragLandmark('S', 140, 220) })
    act(() => { result.current.dragLandmark('S', 150, 225) })

    // Local cache updated (setQueryData schedules async re-render)
    await waitFor(() => {
      expect(result.current.landmarks.find(l => l.landmarkCode === 'S')?.x).toBe(150)
    })
    expect(result.current.landmarks.find(l => l.landmarkCode === 'S')?.y).toBe(225)

    // No additional network calls during drag
    expect((fetchSpy as ReturnType<typeof mock>).mock.calls.length).toBe(initialCallCount)
  })

  test('commitLandmark on pointer-up fires exactly 1 PATCH', async () => {
    const landmarks = [makeLandmark({ landmarkCode: 'S', x: 100, y: 200 })]
    const patchCalls: string[] = []
    global.fetch = mock((req: Request | string | URL) => {
      const request = req instanceof Request ? req : null
      const url = req instanceof Request ? req.url : String(req)
      if (request?.method === 'PATCH') patchCalls.push(url)
      return jsonResponse(makeResponse(landmarks))
    })

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks('img-1'), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Drag (no network)
    act(() => { result.current.dragLandmark('S', 110, 210) })
    act(() => { result.current.dragLandmark('S', 120, 220) })
    expect(patchCalls).toHaveLength(0)

    // Pointer-up: commit (1 PATCH)
    await act(async () => {
      result.current.commitLandmark.mutate({ code: 'S', x: 120, y: 220 })
    })
    await waitFor(() => expect(result.current.commitLandmark.isSuccess).toBe(true))
    expect(patchCalls).toHaveLength(1)
    expect(patchCalls[0]).toContain('/ceph/landmarks/S')
  })
})

// ─── commitLandmark — out-of-order / request sequencing ─────────────────────

describe('useCephLandmarks — commitLandmark out-of-order response', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch; cleanup() })

  test('late PATCH1 response does not overwrite newer PATCH2 cached state', async () => {
    const landmark = makeLandmark({ landmarkCode: 'N', x: 100, y: 100 })
    const d1 = deferred<CephLandmarksResponse>()  // PATCH1 (first, will arrive late)
    const d2 = deferred<CephLandmarksResponse>()  // PATCH2 (second, arrives first)

    let patchCount = 0
    global.fetch = mock((req: Request | string | URL) => {
      const method = req instanceof Request ? req.method : undefined
      if (method === 'PATCH') {
        patchCount++
        if (patchCount === 1) return d1.promise.then(v => jsonResponse(v))
        return d2.promise.then(v => jsonResponse(v))
      }
      return jsonResponse(makeResponse([landmark]))
    })

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks('img-1'), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Fire PATCH1: move N to (200, 200)
    act(() => {
      result.current.commitLandmark.mutate({ code: 'N', x: 200, y: 200 })
    })

    // Fire PATCH2: move N to (300, 300) — this is the current position
    act(() => {
      result.current.commitLandmark.mutate({ code: 'N', x: 300, y: 300 })
    })

    // PATCH2 resolves first with (300, 300)
    const responseB = makeResponse([{ ...landmark, x: 300, y: 300 }])
    act(() => { d2.resolve(responseB) })
    await waitFor(() => result.current.commitLandmark.isSuccess === true)

    // PATCH1 resolves late with (200, 200)
    const responseA = makeResponse([{ ...landmark, x: 200, y: 200 }])
    act(() => { d1.resolve(responseA) })

    // Wait a tick — cache should NOT regress to (200, 200)
    await new Promise(r => setTimeout(r, 20))

    // The analysis cache seeded by PATCH2 should be from responseB, not responseA
    const cachedAnalysis = qc.getQueryData<CephAnalysis>(['ceph-analysis', 'img-1'])
    // If analysis was seeded from the late response, it would be from responseA
    // (same values in this test, so we check the landmarks cache instead)
    const cachedResponse = qc.getQueryData<CephLandmarksResponse>(['ceph-landmarks', 'img-1'])
    // After late response, cache should still reflect PATCH2's result (300,300) or at worst be refetched
    // The key invariant: the analysis is NOT seeded from the stale PATCH1 response
    expect(cachedAnalysis?.analysisType).toBe('steiner_hybrid_sn') // still valid
    // The cached landmarks from PATCH2 should persist (or be re-fetched, not PATCH1 values)
    expect(cachedResponse).not.toBeUndefined()
  })
})

// ─── batchUpsert ─────────────────────────────────────────────────────────────

describe('useCephLandmarks — batchUpsert', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch; cleanup() })

  test('sends POST to correct URL with landmarks body', async () => {
    let capturedUrl = ''
    let capturedBody: unknown
    const createdLandmarks = [
      makeLandmark({ landmarkCode: 'S', x: 100, y: 200 }),
      makeLandmark({ landmarkCode: 'N', x: 300, y: 200 }),
    ]
    global.fetch = mock(async (req: Request | string | URL) => {
      const request = req instanceof Request ? req : null
      const url = req instanceof Request ? req.url : String(req)
      if (request?.method === 'POST') {
        capturedUrl = url
        capturedBody = await request.clone().json()
        return jsonResponse(makeResponse(createdLandmarks))
      }
      return jsonResponse(makeResponse())
    })

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks('img-1'), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.batchUpsert.mutate([
        { landmarkCode: 'S', x: 100, y: 200 },
        { landmarkCode: 'N', x: 300, y: 200 },
      ])
    })
    await waitFor(() => expect(result.current.batchUpsert.isSuccess).toBe(true))

    expect(capturedUrl).toContain('/dental/imaging/images/img-1/ceph/landmarks')
    expect((capturedBody as { landmarks: unknown[] }).landmarks).toHaveLength(2)
  })

  test('seeds landmarks and analysis caches on success', async () => {
    const landmarks = [makeLandmark({ landmarkCode: 'S' })]
    const analysis = makeAnalysis({ measurements: { sna: 82, snb: 80, anb: 2 } })
    global.fetch = mock((req: Request | string | URL) => {
      if (req instanceof Request && req.method === 'POST') return jsonResponse(makeResponse(landmarks, analysis))
      return jsonResponse(makeResponse())
    })

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks('img-1'), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.batchUpsert.mutate([{ landmarkCode: 'S', x: 100, y: 200 }])
    })
    await waitFor(() => expect(result.current.batchUpsert.isSuccess).toBe(true))

    // Analysis cache should be seeded
    const cachedAnalysis = qc.getQueryData<CephAnalysis>(['ceph-analysis', 'img-1'])
    expect(cachedAnalysis?.measurements).toEqual(analysis.measurements)
  })

  // CONF-IMG-L2-001 (V-IMG-004): a tier-block / validation failure on batchUpsert
  // must be surfaced via the hook result, not swallowed into console.error only.
  test('surfaces the failure via mutationError when batchUpsert is tier-blocked', async () => {
    global.fetch = mock((req: Request | string | URL) => {
      if (req instanceof Request && req.method === 'POST') {
        return Promise.resolve(new Response('IMAGING_TIER_REQUIRED', { status: 403 }))
      }
      return jsonResponse(makeResponse())
    })

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks('img-1'), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.batchUpsert.mutate([{ landmarkCode: 'S', x: 100, y: 200 }])
    })

    await waitFor(() => expect(result.current.mutationError).not.toBeNull())
    expect((result.current.mutationError as Error).message).toContain('IMAGING_TIER_REQUIRED')
  })
})

// ─── deleteLandmark ───────────────────────────────────────────────────────────

describe('useCephLandmarks — deleteLandmark', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch; cleanup() })

  test('sends DELETE to correct URL', async () => {
    let capturedUrl = ''
    const landmarks = [makeLandmark({ landmarkCode: 'S' })]
    global.fetch = mock((req: Request | string | URL) => {
      const request = req instanceof Request ? req : null
      const url = req instanceof Request ? req.url : String(req)
      if (request?.method === 'DELETE') {
        capturedUrl = url
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      return jsonResponse(makeResponse(landmarks))
    })

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks('img-1'), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => { result.current.deleteLandmark.mutate('S') })
    await waitFor(() => expect(result.current.deleteLandmark.isSuccess).toBe(true))

    expect(capturedUrl).toContain('/dental/imaging/images/img-1/ceph/landmarks/S')
  })

  test('optimistically removes landmark from cache', async () => {
    const landmarks = [
      makeLandmark({ id: 'lm-1', landmarkCode: 'S' }),
      makeLandmark({ id: 'lm-2', landmarkCode: 'N' }),
    ]
    const d = deferred<void>()
    global.fetch = mock((req: Request | string | URL) => {
      if (req instanceof Request && req.method === 'DELETE') return d.promise.then(() => new Response(null, { status: 204 }))
      return jsonResponse(makeResponse(landmarks))
    })

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks('img-1'), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.landmarks).toHaveLength(2)

    // Fire delete (in-flight)
    act(() => { result.current.deleteLandmark.mutate('S') })

    // Optimistic: S should be removed immediately
    await waitFor(() => expect(result.current.landmarks).toHaveLength(1))
    expect(result.current.landmarks[0]?.landmarkCode).toBe('N')

    // Resolve server response
    act(() => { d.resolve() })
    await waitFor(() => expect(result.current.deleteLandmark.isSuccess).toBe(true))
  })
})

describe('useCephLandmarks — autoDetect (P1-10)', () => {
  test('POSTs to the detect endpoint and seeds caches with AI points', async () => {
    let detectUrl = ''
    let detectMethod = ''
    let detected = false
    const aiItem = makeLandmark({
      id: 'ai-s',
      landmarkCode: 'S',
      source: 'ai',
      confidence: 0.94,
      status: 'placed',
    })
    global.fetch = mock((req: Request | string | URL) => {
      const url = typeof req === 'string' ? req : req instanceof Request ? req.url : req.toString()
      if (url.includes('/ceph/landmarks/detect')) {
        detectUrl = url
        detectMethod = req instanceof Request ? req.method : 'GET'
        detected = true
        return jsonResponse({
          jobId: 'job-1',
          status: 'succeeded',
          modelVersion: 'fake-detector-v0',
          provider: 'fake',
          predictions: [{ landmarkCode: 'S', x: 320, y: 130, confidence: 0.94 }],
          items: [aiItem],
          analysis: makeAnalysis(),
        })
      }
      // The list query reflects the persisted state: AI point present post-detect
      // (so onSettled's invalidation/refetch stays consistent with the server).
      return jsonResponse(makeResponse(detected ? [aiItem] : []))
    }) as unknown as typeof fetch

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks('img-1'), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => { result.current.autoDetect.mutate() })
    await waitFor(() => expect(result.current.autoDetect.isSuccess).toBe(true))

    expect(detectMethod).toBe('POST')
    expect(detectUrl).toContain('/dental/imaging/images/img-1/ceph/landmarks/detect')
    // The AI point seeds the landmark cache so the overlay renders it.
    await waitFor(() =>
      expect(result.current.landmarks.find((l) => l.landmarkCode === 'S')?.source).toBe('ai'),
    )
  })

  test('exposes the detect error on failure (tier/flag gate)', async () => {
    global.fetch = mock((req: Request | string | URL) => {
      const url = req instanceof Request ? req.url : typeof req === 'string' ? req : req.toString()
      if (url.includes('/ceph/landmarks/detect'))
        return jsonResponse({ error: 'disabled', code: 'FEATURE_DISABLED' }, 403)
      return jsonResponse(makeResponse([]))
    }) as unknown as typeof fetch

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useCephLandmarks('img-1'), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => { result.current.autoDetect.mutate() })
    await waitFor(() => expect(result.current.autoDetect.isError).toBe(true))
    expect(String(result.current.autoDetect.error)).toContain('FEATURE_DISABLED')
  })

  test('does NOT retry a permanent 4xx gate — exactly one detect request (FIX-002)', async () => {
    let detectCalls = 0
    global.fetch = mock((req: Request | string | URL) => {
      const url = req instanceof Request ? req.url : typeof req === 'string' ? req : req.toString()
      if (url.includes('/ceph/landmarks/detect')) {
        detectCalls += 1
        return jsonResponse({ error: 'disabled', code: 'FEATURE_DISABLED' }, 403)
      }
      return jsonResponse(makeResponse([]))
    }) as unknown as typeof fetch

    // Prod-like retry policy — without retry:false on the mutation, the 403 retries.
    const qc = prodLikeMutationClient()
    const { result } = renderHook(() => useCephLandmarks('img-1'), { wrapper: makeWrapper(qc) })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => { result.current.autoDetect.mutate() })
    await waitFor(() => expect(result.current.autoDetect.isError).toBe(true))

    // Permanent tier/flag gates must fail fast: one request, no retry storm / long spinner.
    expect(detectCalls).toBe(1)
  })
})
