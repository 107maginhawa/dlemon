import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'
import { SuperimpositionPanel } from './SuperimpositionPanel'
import type { CephSuperimposition } from '../hooks/use-ceph-superimposition'

afterEach(cleanup)

const V1_LABEL =
  'Cranial-base (S–N) point registration — a simplified superimposition, not ' +
  'ABO-grade structural superimposition. Informational measurement of change, ' +
  'not a diagnosis. Ceph magnification (~7–13%) applies.'

function mkResult(overrides: Partial<CephSuperimposition> = {}): CephSuperimposition {
  return {
    id: null,
    patientId: 'p1',
    reportFromId: 'rf',
    reportToId: 'rt',
    reference: 'cranial_base',
    transform: { scale: 1, rotationRad: 0, tx: 0, ty: 0, basis: ['S', 'N'] },
    landmarkDeltas: [
      {
        landmarkCode: 'A',
        dxPx: 3,
        dyPx: 4,
        magnitudePx: 5,
        dxMm: 0.3,
        dyMm: 0.4,
        magnitudeMm: 0.5,
        directionDeg: 53.13,
      },
    ],
    metricDeltas: [{ metric: 'anb', from: 4.1, to: 2.3, delta: -1.8 }],
    uncalibrated: false,
    calibrationBasis: {},
    label: V1_LABEL,
    createdAt: null,
    ...overrides,
  }
}

function renderPanel(props: Partial<React.ComponentProps<typeof SuperimpositionPanel>> = {}) {
  const merged: React.ComponentProps<typeof SuperimpositionPanel> = {
    result: mkResult(),
    reference: 'cranial_base',
    onReferenceChange: () => {},
    opacityPct: 50,
    onOpacityChange: () => {},
    onionSkin: false,
    onOnionSkinChange: () => {},
    fromLabel: 'v1 · 2026-01-01',
    toLabel: 'v2 · 2026-06-01',
    ...props,
  }
  return render(React.createElement(SuperimpositionPanel, merged))
}

describe('SuperimpositionPanel', () => {
  test('surfaces the v1 honesty label verbatim', () => {
    renderPanel()
    const label = screen.getByTestId('superimposition-label')
    expect(label.textContent).toContain('simplified superimposition')
    expect(label.textContent).toContain('not a diagnosis')
  })

  test('non-v1 reference options are visible but disabled', () => {
    renderPanel()
    const maxillary = screen.getByRole('radio', { name: /Maxillary.*v2/i })
    expect((maxillary as HTMLButtonElement).disabled).toBe(true)
    const cranial = screen.getByRole('radio', { name: /Cranial base/i })
    expect((cranial as HTMLButtonElement).disabled).toBe(false)
  })

  test('opacity slider drives the value and calls back', () => {
    let pct = 50
    renderPanel({ opacityPct: pct, onOpacityChange: (v) => (pct = v) })
    const slider = screen.getByTestId('superimposition-opacity') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '20' } })
    expect(pct).toBe(20)
  })

  test('renders signed metric Δ and no green styling', () => {
    const { container } = renderPanel()
    const table = screen.getByTestId('metric-deltas-table')
    expect(table.textContent).toContain('anb')
    expect(table.textContent).toContain('-1.8')
    // No green "normal" colour anywhere (honesty posture)
    expect(container.querySelector('.text-green-600, .bg-green-500, .text-emerald-600')).toBeNull()
  })

  test('mm shown only when calibrated; px-only with disclosure when uncalibrated', () => {
    const { rerender } = renderPanel()
    expect(screen.getByTestId('landmark-deltas-table').textContent).toContain('0.5 mm')

    rerender(
      React.createElement(SuperimpositionPanel, {
        result: mkResult({
          uncalibrated: true,
          landmarkDeltas: [
            { landmarkCode: 'A', dxPx: 3, dyPx: 4, magnitudePx: 5, dxMm: null, dyMm: null, magnitudeMm: null, directionDeg: 53.13 },
          ],
        }),
        reference: 'cranial_base',
        onReferenceChange: () => {},
        opacityPct: 50,
        onOpacityChange: () => {},
        onionSkin: false,
        onOnionSkinChange: () => {},
        fromLabel: 'a',
        toLabel: 'b',
      }),
    )
    expect(screen.getByTestId('superimposition-uncalibrated')).toBeTruthy()
    expect(screen.getByTestId('landmark-deltas-table').textContent).toContain('5 px')
    expect(screen.getByTestId('landmark-deltas-table').textContent).not.toContain('mm')
  })

  test('each tracing carries a date/vN label (never color-only)', () => {
    renderPanel({ fromLabel: 'v1 · 2026-01-01', toLabel: 'v2 · 2026-06-01' })
    expect(screen.getByTestId('superimposition-from-label').textContent).toContain('2026-01-01')
    expect(screen.getByTestId('superimposition-to-label').textContent).toContain('2026-06-01')
  })

  test('shows error state', () => {
    renderPanel({ result: null, error: 'Cannot superimpose: landmarks missing.' })
    expect(screen.getByTestId('superimposition-error').textContent).toContain('landmarks missing')
  })
})
