import { describe, test, expect, afterEach } from 'bun:test'
import { render, cleanup } from '@testing-library/react'
import React from 'react'
import { imageToScreen, type CephTransformState } from '@monobase/ceph-math'
import {
  MeasurementShape,
  AnnotationShape,
  DrawingPreview,
  AnnotationActionBar,
} from './canvas-overlays'
import type { ImagingAnnotation } from '../hooks/use-measurements'

afterEach(cleanup)

// Non-identity transform: zoom 2×, panned (30,40). Under this transform an overlay
// rendered at raw image coords slides off the film — the drift bug. Overlays must
// map every geometry point image→screen via imageToScreen (mirroring the ceph
// layers) so they stay glued to the image.
const T: CephTransformState = {
  canvasWidth: 800,
  canvasHeight: 600,
  imgWidth: 400,
  imgHeight: 300,
  scale: 2,
  flip: false,
  rotation: 0,
  offsetX: 30,
  offsetY: 40,
}

function ann(partial: Partial<ImagingAnnotation> & Pick<ImagingAnnotation, 'type' | 'geometry'>): ImagingAnnotation {
  return {
    id: 'a1',
    imageId: 'img1',
    measurementValue: null,
    measurementUnit: null,
    visible: true,
    createdAt: '',
    ...partial,
  }
}

function svg(node: React.ReactNode) {
  return render(React.createElement('svg', null, node)).container
}

describe('canvas-overlays — apply canvas transform (drift fix)', () => {
  test('MeasurementShape line maps both endpoints image→screen', () => {
    const a = ann({ type: 'line', geometry: { points: [{ x: 100, y: 100 }, { x: 200, y: 200 }] } })
    const c = svg(React.createElement(MeasurementShape, { annotation: a, pixelSpacingMm: null, transform: T }))
    const line = c.querySelector('line')!
    const e1 = imageToScreen(100, 100, T)
    const e2 = imageToScreen(200, 200, T)
    expect(Number(line.getAttribute('x1'))).toBeCloseTo(e1.x, 3)
    expect(Number(line.getAttribute('y1'))).toBeCloseTo(e1.y, 3)
    expect(Number(line.getAttribute('x2'))).toBeCloseTo(e2.x, 3)
    expect(Number(line.getAttribute('y2'))).toBeCloseTo(e2.y, 3)
  })

  test('AnnotationShape label maps its anchor point image→screen', () => {
    const a = ann({ type: 'label', geometry: { point: { x: 100, y: 100 }, text: 'PA' } })
    const c = svg(React.createElement(AnnotationShape, { annotation: a, pixelSpacingMm: null, transform: T }))
    const text = c.querySelector('text')!
    const e = imageToScreen(100, 100, T)
    expect(Number(text.getAttribute('x'))).toBeCloseTo(e.x, 3)
    expect(Number(text.getAttribute('y'))).toBeCloseTo(e.y, 3)
  })

  test('DrawingPreview maps in-progress points image→screen', () => {
    const c = svg(
      React.createElement(DrawingPreview, {
        toolMode: 'distance' as const,
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        transform: T,
      }),
    )
    const line = c.querySelector('line')!
    const e1 = imageToScreen(100, 100, T)
    const e2 = imageToScreen(200, 200, T)
    expect(Number(line.getAttribute('x1'))).toBeCloseTo(e1.x, 3)
    expect(Number(line.getAttribute('y1'))).toBeCloseTo(e1.y, 3)
    expect(Number(line.getAttribute('x2'))).toBeCloseTo(e2.x, 3)
    expect(Number(line.getAttribute('y2'))).toBeCloseTo(e2.y, 3)
  })

  test('AnnotationActionBar anchors to the screen-mapped point (stays glued on zoom/pan)', () => {
    const a = ann({ type: 'label', geometry: { point: { x: 100, y: 100 }, text: 'PA' } })
    const c = svg(React.createElement(AnnotationActionBar, { annotation: a, onDelete: () => {}, transform: T }))
    const fo = c.querySelector('foreignObject')!
    const e = imageToScreen(100, 100, T)
    // action bar sits +6px right of the anchor (see AnnotationActionBar)
    expect(Number(fo.getAttribute('x'))).toBeCloseTo(e.x + 6, 3)
  })
})
