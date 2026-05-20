import { describe, expect, test } from 'bun:test'
import { computeAngleDeg, computePolygonArea, euclidean } from './geometry'

describe('euclidean', () => {
  test('same point returns 0', () => {
    expect(euclidean({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0)
  })

  test('horizontal distance (3,0)→(7,0) = 4', () => {
    expect(euclidean({ x: 3, y: 0 }, { x: 7, y: 0 })).toBe(4)
  })

  test('3-4-5 right triangle hypotenuse = 5', () => {
    expect(euclidean({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

describe('computeAngleDeg', () => {
  test('right angle = 90°', () => {
    // vertex at origin, arms along +x and +y
    const deg = computeAngleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })
    expect(deg).toBeCloseTo(90, 5)
  })

  test('straight line = 180°', () => {
    // vertex at origin, arms in opposite directions along x
    const deg = computeAngleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 0 })
    expect(deg).toBeCloseTo(180, 5)
  })

  test('degenerate zero-magnitude arm returns 0', () => {
    // p1 coincides with vertex → zero-length arm
    const deg = computeAngleDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })
    expect(deg).toBe(0)
  })
})

describe('computePolygonArea', () => {
  test('unit square = 1', () => {
    const area = computePolygonArea([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ])
    expect(area).toBeCloseTo(1, 5)
  })

  test('right triangle (0,0)→(4,0)→(0,3) = 6', () => {
    const area = computePolygonArea([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ])
    expect(area).toBeCloseTo(6, 5)
  })

  test('degenerate collinear points = 0', () => {
    const area = computePolygonArea([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ])
    expect(area).toBe(0)
  })
})
