import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, cleanup } from '@testing-library/react'
import React from 'react'
import { CephLandmarkLayer } from './CephLandmarkLayer'
import type { CephTransformState } from '../../../lib/ceph-coords'
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

function mk(code: CephLandmark['landmarkCode'], status: CephLandmark['status']): CephLandmark {
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
})
