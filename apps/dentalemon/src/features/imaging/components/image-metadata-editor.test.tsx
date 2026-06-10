/**
 * ImageMetadataEditor — component tests
 *
 * Drives the G5 write UI: metadata save (PATCH) + context-link add/remove
 * (POST/DELETE). Real hooks; network is the global.fetch mock so the wiring
 * (URL/method/body) is exercised end-to-end through the SDK.
 */
import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { freshClientWithMutations, makeWrapper as makeWrapperBase, jsonResponse } from '@/test-utils'
import { ImageMetadataEditor } from './image-metadata-editor'
import type { PatientImageItem } from '@/features/imaging/hooks/use-imaging-studies'

const originalFetch = global.fetch

function makeWrapper() {
  return makeWrapperBase(freshClientWithMutations())
}

function makeItem(over: Partial<PatientImageItem> = {}): PatientImageItem {
  return {
    id: 'img-1', source: 'imaging', modality: 'periapical', fileName: 'pa.jpg',
    mimeType: 'image/jpeg', fileSizeBytes: 2048, studyId: 's1', visitId: null,
    toothNumbers: [], createdAt: '2026-01-01T00:00:00Z', downloadUrl: null,
    isDiagnostic: true, qualityStatus: 'ok', retakeReason: null, tags: [], links: [],
    ...over,
  }
}

const PROPS = { patientId: 'pat-1', branchId: 'br-1' }
const UUID = '11111111-2222-3333-4444-555555555555'

interface Call { url: string; method: string; body: unknown }
function trackingFetch(calls: Call[], linkItems: unknown[] = []) {
  return mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req)
    const method = req instanceof Request ? req.method : (init?.method ?? 'GET')
    let body: unknown = null
    if (req instanceof Request) { try { body = await req.json() } catch { /* none */ } }
    else if (typeof init?.body === 'string') { try { body = JSON.parse(init.body) } catch { /* none */ } }
    calls.push({ url, method, body })
    if (method === 'GET' && url.includes('/links')) return jsonResponse({ items: linkItems })
    if (method === 'DELETE') return new Response(null, { status: 204 })
    if (method === 'POST') return jsonResponse({ id: 'new-link', imageId: 'img-1', linkType: 'treatment_plan', targetId: UUID, createdAt: '2026-01-01T00:00:00.000Z' }, 201)
    return jsonResponse({ id: 'img-1', isDiagnostic: false })
  })
}

beforeEach(() => {
  global.fetch = mock(() => jsonResponse({ items: [] }))
})
afterEach(() => {
  global.fetch = originalFetch
  cleanup()
})

describe('ImageMetadataEditor — metadata', () => {
  test('saving with diagnostic toggled off PATCHes metadata with isDiagnostic false', async () => {
    const calls: Call[] = []
    global.fetch = trackingFetch(calls)
    const user = userEvent.setup()
    render(
      React.createElement(ImageMetadataEditor, { item: makeItem(), ...PROPS }),
      { wrapper: makeWrapper() },
    )

    await user.click(screen.getByTestId('meta-diagnostic'))
    await user.click(screen.getByTestId('meta-save'))

    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true))
    const patch = calls.find((c) => c.method === 'PATCH')!
    expect(patch.url).toContain('/dental/imaging/images/img-1/metadata')
    expect(patch.body).toMatchObject({ isDiagnostic: false })
  })

  test('choosing retake reveals the reason field and sends it', async () => {
    const calls: Call[] = []
    global.fetch = trackingFetch(calls)
    const user = userEvent.setup()
    render(
      React.createElement(ImageMetadataEditor, { item: makeItem(), ...PROPS }),
      { wrapper: makeWrapper() },
    )

    expect(screen.queryByTestId('meta-retake-reason')).toBeNull()
    await user.selectOptions(screen.getByTestId('meta-quality'), 'retake')
    await user.type(screen.getByTestId('meta-retake-reason'), 'blurred')
    await user.click(screen.getByTestId('meta-save'))

    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true))
    const patch = calls.find((c) => c.method === 'PATCH')!
    expect(patch.body).toMatchObject({ qualityStatus: 'retake', retakeReason: 'blurred' })
  })
})

describe('ImageMetadataEditor — links', () => {
  test('Add is disabled until the target is a valid uuid, then POSTs the link', async () => {
    const calls: Call[] = []
    global.fetch = trackingFetch(calls)
    const user = userEvent.setup()
    render(
      React.createElement(ImageMetadataEditor, { item: makeItem(), ...PROPS }),
      { wrapper: makeWrapper() },
    )

    const add = screen.getByTestId('link-add') as HTMLButtonElement
    expect(add.disabled).toBe(true)

    await user.type(screen.getByTestId('link-target'), 'not-a-uuid')
    expect((screen.getByTestId('link-add') as HTMLButtonElement).disabled).toBe(true)

    await user.clear(screen.getByTestId('link-target'))
    await user.type(screen.getByTestId('link-target'), UUID)
    expect((screen.getByTestId('link-add') as HTMLButtonElement).disabled).toBe(false)

    await user.click(screen.getByTestId('link-add'))
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true))
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url).toContain('/dental/imaging/images/img-1/links')
    expect(post.body).toMatchObject({ targetId: UUID })
  })

  test('removing an existing link DELETEs it', async () => {
    const calls: Call[] = []
    global.fetch = trackingFetch(calls, [
      { id: 'lk-1', imageId: 'img-1', linkType: 'report', targetId: UUID, createdAt: '2026-01-01T00:00:00.000Z' },
    ])
    const user = userEvent.setup()
    render(
      React.createElement(ImageMetadataEditor, { item: makeItem(), ...PROPS }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(screen.getByTestId('link-remove-lk-1')).not.toBeNull())
    await user.click(screen.getByTestId('link-remove-lk-1'))

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true))
    expect(calls.find((c) => c.method === 'DELETE')!.url).toContain('/dental/imaging/links/lk-1')
  })
})
