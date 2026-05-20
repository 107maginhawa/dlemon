import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import React from 'react'
import { CephWorkspacePanel } from './CephWorkspacePanel'
import {
  freshClientWithMutations,
  makeWrapper,
  jsonResponse,
} from '@/test-utils'
import type { CephLandmark, CephLandmarksResponse } from '../hooks/use-ceph-landmarks'
import type { CephAnalysis } from '../hooks/use-ceph-analysis'

afterEach(cleanup)

function mkAnalysis(): CephAnalysis {
  return {
    imageId: 'img1',
    analysisType: 'steiner_hybrid_sn',
    measurements: { sna: 82 },
    missing: [],
    uncalibrated: false,
    calibrationValue: null,
    calibrationMethod: 'none',
    calibratedAt: null,
    calibratedBy: null,
    updatedAt: '',
  }
}

function mk(
  code: CephLandmark['landmarkCode'],
  status: CephLandmark['status'] = 'confirmed',
): CephLandmark {
  return {
    id: `id-${code}`,
    imageId: 'img1',
    landmarkCode: code,
    x: 10,
    y: 10,
    source: 'manual',
    confidence: null,
    status,
    createdAt: '',
    updatedAt: '',
  }
}

function setFetch(landmarksResp: () => Promise<Response>, analysisResp: () => Promise<Response>) {
  global.fetch = mock((url: string) => {
    if (url.includes('/ceph/analysis')) return analysisResp()
    return landmarksResp()
  }) as unknown as typeof fetch
}

function renderPanel(
  props: Partial<React.ComponentProps<typeof CephWorkspacePanel>> = {},
) {
  const merged = {
    imageId: 'img1',
    isOpen: true,
    onClose: mock(() => {}),
    ...props,
  }
  const qc = freshClientWithMutations()
  const Wrapper = makeWrapper(qc)
  return render(
    React.createElement(Wrapper, null, React.createElement(CephWorkspacePanel, merged)),
  )
}

const okLandmarks = (items: CephLandmark[]): CephLandmarksResponse => ({
  items,
  analysis: mkAnalysis(),
})

describe('CephWorkspacePanel', () => {
  test('renders null when isOpen=false', () => {
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse(mkAnalysis()),
    )
    const { container } = renderPanel({ isOpen: false })
    expect(container.firstChild).toBeNull()
  })

  test('renders header "Cephalometric" when open', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse(mkAnalysis()),
    )
    renderPanel()
    expect(await screen.findByText('Cephalometric')).not.toBeNull()
  })

  test('shows steiner_hybrid_sn badge — D-G', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse(mkAnalysis()),
    )
    const { container } = renderPanel()
    await screen.findByText('Cephalometric')
    expect(container.textContent).toContain('steiner_hybrid_sn')
  })

  test('shows close button with aria-label', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse(mkAnalysis()),
    )
    renderPanel()
    expect(
      await screen.findByRole('button', { name: 'Close ceph panel' }),
    ).not.toBeNull()
  })

  test('shows Addon banner when fetch returns 403 for landmarks', async () => {
    setFetch(
      () => jsonResponse({ error: 'forbidden' }, 403),
      () => jsonResponse({ error: 'forbidden' }, 403),
    )
    const { container } = renderPanel()
    await waitFor(() =>
      expect(container.textContent).toContain('requires the Addon tier'),
    )
  })

  test('shows D-L gate message when A, B, Go, Po not all confirmed', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([mk('A'), mk('B')])),
      () => jsonResponse(mkAnalysis()),
    )
    const { container } = renderPanel()
    await waitFor(() =>
      expect(container.textContent).toContain(
        'Report requires A, B, Go, Po confirmed',
      ),
    )
  })

  test('does NOT show gate message when all 4 confirmed', async () => {
    setFetch(
      () =>
        jsonResponse(
          okLandmarks([mk('A'), mk('B'), mk('Go'), mk('Po')]),
        ),
      () => jsonResponse(mkAnalysis()),
    )
    const { container } = renderPanel()
    await waitFor(() => expect(container.textContent).toContain('Cephalometric'))
    await waitFor(() =>
      expect(container.textContent).not.toContain(
        'Report requires A, B, Go, Po confirmed',
      ),
    )
  })

  test('Generate Report button disabled when gate landmarks not confirmed', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([mk('A')])),
      () => jsonResponse(mkAnalysis()),
    )
    renderPanel()
    const btn = (await screen.findByRole('button', {
      name: /Generate Report/i,
    })) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  test('Generate Report button enabled when A, B, Go, Po all confirmed', async () => {
    setFetch(
      () =>
        jsonResponse(
          okLandmarks([mk('A'), mk('B'), mk('Go'), mk('Po')]),
        ),
      () => jsonResponse(mkAnalysis()),
    )
    renderPanel()
    await waitFor(async () => {
      const btn = (await screen.findByRole('button', {
        name: /Generate Report/i,
      })) as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })
  })

  test('no "Class" / no norm verdict text — D-H', async () => {
    setFetch(
      () =>
        jsonResponse(
          okLandmarks([mk('A'), mk('B'), mk('Go'), mk('Po')]),
        ),
      () => jsonResponse(mkAnalysis()),
    )
    const { container } = renderPanel()
    await screen.findByText('Cephalometric')
    expect(container.textContent).not.toContain('Class')
  })
})
