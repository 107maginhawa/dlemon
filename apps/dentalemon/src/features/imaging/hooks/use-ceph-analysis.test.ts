/**
 * use-ceph-analysis — unit tests
 *
 * Read-only query: server-authoritative analysis for a ceph image.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import { useCephAnalysis, type CephAnalysis } from './use-ceph-analysis'
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils'

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

describe('useCephAnalysis — query', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch; cleanup() })

  test('returns analysis on successful fetch', async () => {
    const analysis = makeAnalysis({ measurements: { sna: 82, snb: 80, anb: 2 } })
    global.fetch = mock(() => jsonResponse(analysis))

    const qc = freshClient()
    const { result } = renderHook(() => useCephAnalysis('img-1'), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.analysis?.analysisType).toBe('steiner_hybrid_sn')
    expect(result.current.analysis?.measurements.sna).toBe(82)
  })

  test('hits correct URL', async () => {
    let capturedUrl = ''
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req)
      return jsonResponse(makeAnalysis())
    })

    const qc = freshClient()
    const { result } = renderHook(() => useCephAnalysis('img-42'), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(capturedUrl).toContain('/dental/imaging/images/img-42/ceph/analysis')
  })

  test('is disabled when imageId is empty', async () => {
    const fetchSpy = mock(() => jsonResponse(makeAnalysis()))
    global.fetch = fetchSpy

    const qc = freshClient()
    const { result } = renderHook(() => useCephAnalysis(''), { wrapper: makeWrapper(qc) })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.analysis).toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('surfaces uncalibrated state from response', async () => {
    const analysis = makeAnalysis({ uncalibrated: true, measurements: { sna: null, snb: null, anb: null } })
    global.fetch = mock(() => jsonResponse(analysis))

    const qc = freshClient()
    const { result } = renderHook(() => useCephAnalysis('img-1'), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.analysis?.uncalibrated).toBe(true)
  })

  test('surfaces missing landmarks from response', async () => {
    const analysis = makeAnalysis({ missing: ['A', 'B', 'Go', 'Po'], measurements: {} })
    global.fetch = mock(() => jsonResponse(analysis))

    const qc = freshClient()
    const { result } = renderHook(() => useCephAnalysis('img-1'), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.analysis?.missing).toContain('A')
    expect(result.current.analysis?.missing).toContain('Go')
  })
})
