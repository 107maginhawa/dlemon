import { describe, test, expect, afterEach } from 'bun:test'
import { render, cleanup } from '@testing-library/react'
import React from 'react'
import { CephTracingOverlay } from './CephTracingOverlay'
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

function mk(code: CephLandmark['landmarkCode']): CephLandmark {
  return {
    id: `id-${code}`,
    imageId: 'img1',
    landmarkCode: code,
    x: 100,
    y: 100,
    source: 'manual',
    confidence: null,
    status: 'placed',
    createdAt: '',
    updatedAt: '',
  }
}

function renderOverlay(landmarks: CephLandmark[], visible = true) {
  return render(
    React.createElement(CephTracingOverlay, {
      landmarks,
      transform,
      visible,
      width: 800,
      height: 600,
    }),
  )
}

describe('CephTracingOverlay', () => {
  test('renders no lines when empty landmarks', () => {
    const { container } = renderOverlay([])
    expect(container.querySelectorAll('line').length).toBe(0)
  })

  test('renders a line when both SN endpoints (S, N) present', () => {
    const { container } = renderOverlay([mk('S'), mk('N')])
    expect(container.querySelectorAll('line').length).toBeGreaterThanOrEqual(1)
  })

  test('data-line-id="sn" present on that line', () => {
    const { container } = renderOverlay([mk('S'), mk('N')])
    expect(container.querySelector('[data-line-id="sn"]')).not.toBeNull()
  })

  test('does NOT render line when only one endpoint present', () => {
    const { container } = renderOverlay([mk('S')])
    expect(container.querySelector('[data-line-id="sn"]')).toBeNull()
  })

  test('renders null when visible=false', () => {
    const { container } = renderOverlay([mk('S'), mk('N')], false)
    expect(container.querySelector('svg')).toBeNull()
  })
})
