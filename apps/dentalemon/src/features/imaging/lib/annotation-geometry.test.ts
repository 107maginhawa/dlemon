import { describe, test, expect } from 'bun:test'
import { translateGeometry, resizeShapeGeometry } from './annotation-geometry'

describe('translateGeometry', () => {
  test('shifts point-array types (distance/angle/area/freehand)', () => {
    const geo = { type: 'distance', points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }
    expect(translateGeometry('line', geo, 10, 20)).toEqual({
      type: 'distance',
      points: [{ x: 11, y: 22 }, { x: 13, y: 24 }],
    })
  })

  test('shifts label anchor and preserves text', () => {
    const geo = { type: 'label', point: { x: 5, y: 5 }, text: 'PA' }
    expect(translateGeometry('label', geo, -2, 3)).toEqual({
      type: 'label',
      point: { x: 3, y: 8 },
      text: 'PA',
    })
  })

  test('shifts tooth anchor and preserves toothNumber', () => {
    const geo = { type: 'tooth', point: { x: 0, y: 0 }, toothNumber: 14 }
    expect(translateGeometry('tooth', geo, 4, 4)).toEqual({
      type: 'tooth',
      point: { x: 4, y: 4 },
      toothNumber: 14,
    })
  })

  test('shifts arrow from + to', () => {
    const geo = { type: 'arrow', from: { x: 0, y: 0 }, to: { x: 10, y: 10 } }
    expect(translateGeometry('arrow', geo, 1, 1)).toEqual({
      type: 'arrow',
      from: { x: 1, y: 1 },
      to: { x: 11, y: 11 },
    })
  })

  test('shifts shape origin but keeps size + shapeType', () => {
    const geo = { type: 'shape', shapeType: 'rect', x: 10, y: 10, width: 40, height: 20 }
    expect(translateGeometry('shape', geo, 5, -5)).toEqual({
      type: 'shape', shapeType: 'rect', x: 15, y: 5, width: 40, height: 20,
    })
  })

  test('zero delta returns the same object (no-op)', () => {
    const geo = { type: 'label', point: { x: 1, y: 1 }, text: 'x' }
    expect(translateGeometry('label', geo, 0, 0)).toBe(geo)
  })

  test('malformed geometry is a defensive no-op', () => {
    const geo = { type: 'shape', shapeType: 'rect' }
    expect(translateGeometry('shape', geo, 5, 5)).toBe(geo)
  })
})

describe('resizeShapeGeometry', () => {
  test('se handle grows width/height, opposite corner fixed', () => {
    const geo = { type: 'shape', shapeType: 'rect', x: 0, y: 0, width: 10, height: 10 }
    expect(resizeShapeGeometry(geo, 'se', 5, 8)).toEqual({
      type: 'shape', shapeType: 'rect', x: 0, y: 0, width: 15, height: 18,
    })
  })

  test('nw handle moves origin, keeps se corner fixed', () => {
    const geo = { type: 'shape', shapeType: 'rect', x: 10, y: 10, width: 20, height: 20 }
    // se corner is (30,30); move nw by (+4,+4) → x=14,y=14,w=16,h=16
    expect(resizeShapeGeometry(geo, 'nw', 4, 4)).toEqual({
      type: 'shape', shapeType: 'rect', x: 14, y: 14, width: 16, height: 16,
    })
  })

  test('dragging a handle past its opposite flips to a normalized (positive) box', () => {
    const geo = { type: 'shape', shapeType: 'rect', x: 0, y: 0, width: 10, height: 10 }
    // se corner starts at (10,10); drag by (-15,-15) → right/bottom = -5, past nw(0,0).
    expect(resizeShapeGeometry(geo, 'se', -15, -15)).toEqual({
      type: 'shape', shapeType: 'rect', x: -5, y: -5, width: 5, height: 5,
    })
  })

  test('non-shape geometry is a no-op', () => {
    const geo = { type: 'label', point: { x: 1, y: 1 }, text: 'x' }
    expect(resizeShapeGeometry(geo, 'se', 5, 5)).toBe(geo)
  })
})
