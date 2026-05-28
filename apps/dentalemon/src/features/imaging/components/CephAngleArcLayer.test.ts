import { describe, test, expect, afterEach } from 'bun:test'
import { render, cleanup } from '@testing-library/react'
import React from 'react'
import { CephAngleArcLayer } from './CephAngleArcLayer'
import type { CephTransformState } from '@monobase/ceph-math'
import type { CephLandmark } from '../hooks/use-ceph-landmarks'

afterEach(cleanup)

const transform: CephTransformState = {
  canvasWidth: 800,
  canvasHeight: 600,
  imgWidth: 800,
  imgHeight: 600,
  scale: 1,
  flip: false,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
}

function mk(code: CephLandmark['landmarkCode'], x = 100, y = 100): CephLandmark {
  return {
    id: `id-${code}`,
    imageId: 'img1',
    landmarkCode: code,
    x,
    y,
    source: 'manual',
    confidence: null,
    status: 'placed',
    createdAt: '',
    updatedAt: '',
  }
}

function renderLayer(
  landmarks: CephLandmark[],
  measurements: Record<string, number | null> = {},
  visible = true,
) {
  return render(
    React.createElement(CephAngleArcLayer, {
      landmarks,
      transform,
      measurements,
      visible,
      width: 800,
      height: 600,
    }),
  )
}

describe('CephAngleArcLayer', () => {
  test('renders no arcs when empty landmarks', () => {
    const { container } = renderLayer([])
    expect(container.querySelectorAll('[data-arc-id]').length).toBe(0)
  })

  test('renders arc when SNA landmarks placed (S, N, A)', () => {
    const { container } = renderLayer([mk('S', 50, 50), mk('N', 100, 100), mk('A', 80, 150)])
    expect(container.querySelector('[data-arc-id="sna"]')).not.toBeNull()
  })

  test('does NOT render arc when vertex (N) missing', () => {
    const { container } = renderLayer([mk('S', 50, 50), mk('A', 80, 150)])
    expect(container.querySelector('[data-arc-id="sna"]')).toBeNull()
  })

  test('shows measurement value text when provided', () => {
    const { container } = renderLayer(
      [mk('S', 50, 50), mk('N', 100, 100), mk('A', 80, 150)],
      { sna: 82 },
    )
    const text = container.querySelector('[data-arc-label="sna"]')
    expect(text?.textContent).toBe('82.00°')
  })

  test('shows "--" when measurement is null', () => {
    const { container } = renderLayer(
      [mk('S', 50, 50), mk('N', 100, 100), mk('A', 80, 150)],
      { sna: null },
    )
    const text = container.querySelector('[data-arc-label="sna"]')
    expect(text?.textContent).toBe('--')
  })

  test('renders null when visible=false', () => {
    const { container } = renderLayer(
      [mk('S', 50, 50), mk('N', 100, 100), mk('A', 80, 150)],
      { sna: 82 },
      false,
    )
    expect(container.querySelector('svg')).toBeNull()
  })
})
