import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, cleanup } from '@testing-library/react'
import React from 'react'
import { CephLandmarkLayer } from './CephLandmarkLayer'
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

function mk(
  code: CephLandmark['landmarkCode'],
  status: CephLandmark['status'],
  overrides: Partial<CephLandmark> = {},
): CephLandmark {
  return {
    id: `id-${code}`,
    imageId: 'img1',
    landmarkCode: code,
    x: 100,
    y: 100,
    source: 'manual',
    confidence: null,
    status,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function renderLayer(landmarks: CephLandmark[]) {
  return render(
    React.createElement(CephLandmarkLayer, {
      landmarks,
      selectedCode: null,
      transform,
      onPlace: mock(() => {}),
      onDrag: mock(() => {}),
      onCommit: mock(() => {}),
      width: 800,
      height: 600,
    }),
  )
}

describe('CephLandmarkLayer', () => {
  test('renders an SVG element', () => {
    const { container } = renderLayer([])
    expect(container.querySelector('svg')).not.toBeNull()
  })

  test('renders one circle per landmark', () => {
    const { container } = renderLayer([mk('S', 'placed'), mk('N', 'placed')])
    expect(container.querySelectorAll('circle').length).toBe(2)
  })

  test('locked landmark circle has pointerEvents none', () => {
    const { container } = renderLayer([mk('S', 'locked')])
    const c = container.querySelector('circle') as SVGCircleElement
    expect(c.style.pointerEvents).toBe('none')
  })

  test('non-locked landmark circle does not have pointerEvents none', () => {
    const { container } = renderLayer([mk('S', 'placed')])
    const c = container.querySelector('circle') as SVGCircleElement
    expect(c.style.pointerEvents).not.toBe('none')
  })

  test('each circle has aria-label "{code} landmark"', () => {
    const { container } = renderLayer([mk('A', 'placed')])
    const c = container.querySelector('circle') as SVGCircleElement
    expect(c.getAttribute('aria-label')).toBe('A landmark')
  })

  // P1-10: AI overlay state
  test('AI-unconfirmed point renders a distinct hollow dashed ring (not lemon fill)', () => {
    const { container } = renderLayer([
      mk('S', 'placed', { source: 'ai', confidence: 0.9 }),
    ])
    const ring = container.querySelector('[data-ai-unconfirmed="true"]') as SVGCircleElement
    expect(ring).not.toBeNull()
    expect(ring.getAttribute('fill')).toBe('none')
    expect(ring.getAttribute('stroke-dasharray')).not.toBeNull()
    // must NOT use the lemon accent for the AI state
    expect(ring.getAttribute('stroke')).not.toBe('#FFE97D')
  })

  test('low-confidence AI point is flagged via data-low-confidence + amber stroke', () => {
    const { container } = renderLayer([
      mk('Go', 'placed', { source: 'ai', confidence: 0.4 }),
    ])
    const ring = container.querySelector('[data-low-confidence="true"]') as SVGCircleElement
    expect(ring).not.toBeNull()
    expect(ring.getAttribute('stroke')).toBe('#fbbf24')
    expect(ring.getAttribute('aria-label')).toContain('low confidence')
  })

  test('a confirmed AI point renders as a normal filled circle (no AI ring)', () => {
    const { container } = renderLayer([
      mk('A', 'confirmed', { source: 'ai_corrected', confidence: 0.9 }),
    ])
    expect(container.querySelector('[data-ai-unconfirmed="true"]')).toBeNull()
    const c = container.querySelector('circle') as SVGCircleElement
    expect(c.getAttribute('fill')).not.toBe('none')
  })

  test('AI point carries data-source attribute for provenance', () => {
    const { container } = renderLayer([mk('S', 'placed', { source: 'ai', confidence: 0.9 })])
    const ring = container.querySelector('[data-ai-unconfirmed="true"]') as SVGCircleElement
    expect(ring.getAttribute('data-source')).toBe('ai')
  })
})
