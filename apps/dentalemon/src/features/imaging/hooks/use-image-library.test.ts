/**
 * useImageLibrary / useImageLinks — unit tests
 *
 * Covers the three library write mutations (updateMetadata, createLink,
 * deleteLink) and the per-image links query. Network fetch is mocked via the
 * global.fetch override — no MSW. Mirrors use-imaging-findings.test.ts.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test'
import { renderHook, waitFor, cleanup, act } from '@testing-library/react'
import { useImageLibrary, useImageLinks } from './use-image-library'
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils'

function reqUrl(req: Request | string | URL): string {
  return req instanceof Request ? req.url : String(req)
}
function reqMethod(req: Request | string | URL, init?: RequestInit): string {
  return req instanceof Request ? req.method : (init?.method ?? 'GET')
}
async function reqBody(req: Request | string | URL, init?: RequestInit): Promise<unknown> {
  if (req instanceof Request) {
    try { return await req.json() } catch { return null }
  }
  if (typeof init?.body === 'string') {
    try { return JSON.parse(init.body) } catch { return null }
  }
  return null
}

const originalFetch = global.fetch
afterEach(() => {
  global.fetch = originalFetch
  cleanup()
})

describe('useImageLibrary — updateMetadata', () => {
  test('PATCHes the metadata endpoint with the supplied body', async () => {
    const calls: { url: string; method: string; body: unknown }[] = []
    global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
      calls.push({ url: reqUrl(req), method: reqMethod(req, init), body: await reqBody(req, init) })
      return jsonResponse({ id: 'img-1', isDiagnostic: false })
    })

    const qc = freshClientWithMutations()
    const { result } = renderHook(
      () => useImageLibrary({ patientId: 'p1', branchId: 'b1' }),
      { wrapper: makeWrapper(qc) },
    )

    await act(async () => {
      await result.current.updateMetadata.mutateAsync({
        imageId: 'img-1',
        body: { isDiagnostic: false, qualityStatus: 'ok', retakeReason: null, tags: ['ortho'] },
      })
    })

    const patch = calls.find((c) => c.method === 'PATCH')
    expect(patch).toBeDefined()
    expect(patch!.url).toContain('/dental/imaging/images/img-1/metadata')
    expect(patch!.body).toMatchObject({ isDiagnostic: false, tags: ['ortho'] })
  })
})

describe('useImageLibrary — createLink', () => {
  test('POSTs the link endpoint with linkType + targetId', async () => {
    const calls: { url: string; method: string; body: unknown }[] = []
    global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
      calls.push({ url: reqUrl(req), method: reqMethod(req, init), body: await reqBody(req, init) })
      return jsonResponse({ id: 'l1', imageId: 'img-1', linkType: 'treatment_plan', targetId: 't1' }, 201)
    })

    const qc = freshClientWithMutations()
    const { result } = renderHook(
      () => useImageLibrary({ patientId: 'p1', branchId: 'b1' }),
      { wrapper: makeWrapper(qc) },
    )

    await act(async () => {
      await result.current.createLink.mutateAsync({
        imageId: 'img-1',
        linkType: 'treatment_plan',
        targetId: '11111111-2222-3333-4444-555555555555',
      })
    })

    const post = calls.find((c) => c.method === 'POST')
    expect(post).toBeDefined()
    expect(post!.url).toContain('/dental/imaging/images/img-1/links')
    expect(post!.body).toMatchObject({
      linkType: 'treatment_plan',
      targetId: '11111111-2222-3333-4444-555555555555',
    })
  })
})

describe('useImageLibrary — deleteLink', () => {
  test('DELETEs the link endpoint by linkId', async () => {
    const calls: { url: string; method: string }[] = []
    global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
      calls.push({ url: reqUrl(req), method: reqMethod(req, init) })
      return new Response(null, { status: 204 })
    })

    const qc = freshClientWithMutations()
    const { result } = renderHook(
      () => useImageLibrary({ patientId: 'p1', branchId: 'b1' }),
      { wrapper: makeWrapper(qc) },
    )

    await act(async () => {
      await result.current.deleteLink.mutateAsync({ linkId: 'l1' })
    })

    const del = calls.find((c) => c.method === 'DELETE')
    expect(del).toBeDefined()
    expect(del!.url).toContain('/dental/imaging/links/l1')
  })
})

describe('useImageLinks — query', () => {
  test('returns links for an image', async () => {
    global.fetch = mock(() =>
      jsonResponse({
        items: [
          { id: 'l1', imageId: 'img-1', linkType: 'report', targetId: 't1', createdAt: '2026-01-01T00:00:00.000Z' },
        ],
      }),
    )

    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useImageLinks('img-1'), { wrapper: makeWrapper(qc) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.links.map((l) => l.linkType)).toEqual(['report'])
  })

  test('is disabled when imageId is empty', () => {
    global.fetch = mock(() => jsonResponse({ items: [] }))
    const qc = freshClientWithMutations()
    const { result } = renderHook(() => useImageLinks(''), { wrapper: makeWrapper(qc) })
    expect(result.current.links).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
