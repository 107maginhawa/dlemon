import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
    )
    const { container } = renderPanel({ isOpen: false })
    expect(container.firstChild).toBeNull()
  })

  test('renders header "Cephalometric" when open', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
    )
    renderPanel()
    expect(await screen.findByText('Cephalometric')).not.toBeNull()
  })

  test('shows steiner_hybrid_sn badge — D-G', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
    )
    const { container } = renderPanel()
    await screen.findByText('Cephalometric')
    expect(container.textContent).toContain('steiner_hybrid_sn')
  })

  test('shows close button with aria-label', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
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
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
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
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
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
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
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
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
    )
    renderPanel()
    await waitFor(async () => {
      const btn = (await screen.findByRole('button', {
        name: /Generate Report/i,
      })) as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })
  })

  test('controlled selection: clicking a palette item calls onSelectCode (lifted state)', async () => {
    const user = userEvent.setup()
    const onSelectCode = mock(() => {})
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
    )
    const { container } = renderPanel({ selectedCode: null, onSelectCode })
    await screen.findByText('Cephalometric')
    const sBtn = container.querySelector('[data-landmark-code="S"]') as HTMLButtonElement
    await user.click(sBtn)
    expect(onSelectCode).toHaveBeenCalledWith('S')
  })

  test('controlled selectedCode highlights the selected palette item', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
    )
    const { container } = renderPanel({ selectedCode: 'N', onSelectCode: mock(() => {}) })
    await screen.findByText('Cephalometric')
    const nBtn = container.querySelector('[data-landmark-code="N"]') as HTMLButtonElement
    expect(nBtn.className).toContain('border-[#FFE97D]')
  })

  test('#15 renders the analysis-protocol switcher defaulting to Steiner', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
    )
    renderPanel()
    const switcher = await screen.findByLabelText('Analysis protocol')
    expect(switcher).not.toBeNull()
    expect(switcher.textContent).toContain('Steiner')
  })

  test('P1-8 analysis switcher offers Downs, Tweed, McNamara, Jarabak', async () => {
    const user = userEvent.setup()
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
    )
    renderPanel()
    const switcher = await screen.findByLabelText('Analysis protocol')
    await user.click(switcher)
    // Radix Select renders options into a portal; assert the option labels exist.
    expect(await screen.findByText('Downs (FH)')).not.toBeNull()
    expect(screen.getByText('Tweed (FH)')).not.toBeNull()
    expect(screen.getByText('McNamara')).not.toBeNull()
    expect(screen.getByText('Jarabak')).not.toBeNull()
  })

  test('P2-6 renders a norm-population selector defaulting to classic literature', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
    )
    renderPanel()
    const popSelector = await screen.findByLabelText('Norm population')
    expect(popSelector).not.toBeNull()
    expect(popSelector.textContent).toContain('Default')
  })

  test('no "Class" / no norm verdict text — D-H', async () => {
    setFetch(
      () =>
        jsonResponse(
          okLandmarks([mk('A'), mk('B'), mk('Go'), mk('Po')]),
        ),
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
    )
    const { container } = renderPanel()
    await screen.findByText('Cephalometric')
    expect(container.textContent).not.toContain('Class')
  })
})

// ---------------------------------------------------------------------------
// P1-10 — Auto-detect landmarks
// ---------------------------------------------------------------------------

describe('CephWorkspacePanel — Auto-detect (P1-10)', () => {
  test('renders the Auto-detect landmarks button', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
    )
    renderPanel()
    expect(
      await screen.findByRole('button', { name: /Auto-detect landmarks/i }),
    ).not.toBeNull()
  })

  test('shows the honest AI disclosure note', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
    )
    const { container } = renderPanel()
    await screen.findByText('Cephalometric')
    const note = container.querySelector('[data-ai-disclosure]')
    expect(note?.textContent).toContain('confirm each before')
  })

  test('Auto-detect button uses the lemon token (no raw hex)', async () => {
    setFetch(
      () => jsonResponse(okLandmarks([])),
      () => jsonResponse({ items: [], analysis: mkAnalysis() }),
    )
    renderPanel()
    const btn = (await screen.findByRole('button', {
      name: /Auto-detect landmarks/i,
    })) as HTMLButtonElement
    expect(btn.className).toContain('bg-lemon')
    expect(btn.className).not.toContain('#FFE97D')
  })

  test('clicking Auto-detect POSTs to the detect endpoint and renders AI points', async () => {
    let detectCalled = false
    const aiItem: CephLandmark = {
      id: 'ai-s',
      imageId: 'img1',
      landmarkCode: 'S',
      x: 320,
      y: 130,
      source: 'ai',
      confidence: 0.94,
      status: 'placed',
      createdAt: '',
      updatedAt: '',
    }
    global.fetch = mock((url: string, init?: RequestInit) => {
      if (url.includes('/ceph/landmarks/detect')) {
        detectCalled = true
        return jsonResponse({
          jobId: 'job-1',
          status: 'succeeded',
          modelVersion: 'fake-detector-v0',
          provider: 'fake',
          predictions: [{ landmarkCode: 'S', x: 320, y: 130, confidence: 0.94 }],
          items: [aiItem],
          analysis: mkAnalysis(),
        })
      }
      if (url.includes('/ceph/analysis')) return jsonResponse({ items: [], analysis: mkAnalysis() })
      // List query reflects persisted state post-detect (AI point present), so the
      // onSettled invalidation/refetch keeps the AI overlay rendered.
      return jsonResponse(okLandmarks(detectCalled ? [aiItem] : []))
    }) as unknown as typeof fetch

    const { container } = renderPanel()
    const btn = (await screen.findByRole('button', {
      name: /Auto-detect landmarks/i,
    })) as HTMLButtonElement
    const user = userEvent.setup()
    await user.click(btn)
    await waitFor(() => expect(detectCalled).toBe(true))
    // The AI point lands in the palette as "AI · unconfirmed".
    await waitFor(() =>
      expect(container.querySelector('[data-ai-unconfirmed="S"]')).not.toBeNull(),
    )
  })

  test('surfaces FEATURE_DISABLED kill-switch error distinctly', async () => {
    global.fetch = mock((url: string) => {
      if (url.includes('/ceph/landmarks/detect'))
        return jsonResponse({ error: 'disabled', code: 'FEATURE_DISABLED' }, 403)
      if (url.includes('/ceph/analysis')) return jsonResponse({ items: [], analysis: mkAnalysis() })
      return jsonResponse(okLandmarks([]))
    }) as unknown as typeof fetch

    const { container } = renderPanel()
    const btn = (await screen.findByRole('button', {
      name: /Auto-detect landmarks/i,
    })) as HTMLButtonElement
    const user = userEvent.setup()
    await user.click(btn)
    await waitFor(() =>
      expect(container.querySelector('[data-ai-detect-error]')?.textContent).toContain(
        'disabled',
      ),
    )
  })
})
