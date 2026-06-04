import { describe, test, expect } from 'bun:test'
import { arrowDelta, nextUnplacedCode, decideCephKey } from './ceph-keyboard'
import { LANDMARK_CODES } from './ceph-geometry'

const placedLm = (code: string, status: 'placed' | 'confirmed' | 'locked' = 'placed') => ({
  landmarkCode: code,
  x: 100,
  y: 100,
  status,
})

describe('arrowDelta — 1px nudge mapping', () => {
  test('maps the four arrows to unit deltas (+y down)', () => {
    expect(arrowDelta('ArrowLeft')).toEqual({ dx: -1, dy: 0 })
    expect(arrowDelta('ArrowRight')).toEqual({ dx: 1, dy: 0 })
    expect(arrowDelta('ArrowUp')).toEqual({ dx: 0, dy: -1 })
    expect(arrowDelta('ArrowDown')).toEqual({ dx: 0, dy: 1 })
  })

  test('returns null for non-arrow keys', () => {
    expect(arrowDelta('Enter')).toBeNull()
    expect(arrowDelta('a')).toBeNull()
    expect(arrowDelta('Tab')).toBeNull()
  })
})

describe('nextUnplacedCode — Tab/Enter advance', () => {
  test('from null selection, returns the first unplaced code in canonical order', () => {
    // S is placed → first unplaced is N
    expect(nextUnplacedCode(new Set(['S']), null)).toBe('N')
  })

  test('advances to the next unplaced code after the current selection', () => {
    // nothing placed, current = S → next is N
    expect(nextUnplacedCode(new Set(), 'S')).toBe('N')
  })

  test('skips placed codes when advancing', () => {
    // current S, N already placed → next unplaced is A
    expect(nextUnplacedCode(new Set(['N']), 'S')).toBe('A')
  })

  test('wraps around to the start when current is the last code', () => {
    const last = LANDMARK_CODES[LANDMARK_CODES.length - 1]
    // only `last` and nothing else placed; from last → wraps to S
    expect(nextUnplacedCode(new Set(), last)).toBe('S')
  })

  test('returns null when every landmark is placed', () => {
    expect(nextUnplacedCode(new Set(LANDMARK_CODES), 'S')).toBeNull()
  })
})

describe('decideCephKey — keydown reducer (Tab/Enter advance, arrows nudge)', () => {
  test('Tab advances selection to the next unplaced code and traps focus', () => {
    const out = decideCephKey({ key: 'Tab', selectedCode: 'S', landmarks: [placedLm('S')] })
    expect(out.preventDefault).toBe(true)
    expect(out.action).toEqual({ type: 'select', code: 'N' })
  })

  test('Enter behaves like Tab (advance to next unplaced)', () => {
    const out = decideCephKey({ key: 'Enter', selectedCode: null, landmarks: [placedLm('S')] })
    expect(out.action).toEqual({ type: 'select', code: 'N' })
    expect(out.preventDefault).toBe(true)
  })

  test('arrow nudges the selected PLACED landmark by 1px and traps focus', () => {
    const out = decideCephKey({
      key: 'ArrowRight',
      selectedCode: 'A',
      landmarks: [placedLm('A')],
    })
    expect(out.preventDefault).toBe(true)
    expect(out.action).toEqual({ type: 'nudge', code: 'A', x: 101, y: 100 })
  })

  test('arrow nudges a CONFIRMED (not locked) landmark too', () => {
    const out = decideCephKey({
      key: 'ArrowUp',
      selectedCode: 'A',
      landmarks: [placedLm('A', 'confirmed')],
    })
    expect(out.action).toEqual({ type: 'nudge', code: 'A', x: 100, y: 99 })
  })

  test('arrow does NOT nudge a LOCKED landmark (immutable)', () => {
    const out = decideCephKey({
      key: 'ArrowDown',
      selectedCode: 'A',
      landmarks: [placedLm('A', 'locked')],
    })
    expect(out.action).toEqual({ type: 'none' })
    expect(out.preventDefault).toBe(false)
  })

  test('arrow with an unplaced selection does nothing (nothing to nudge)', () => {
    const out = decideCephKey({ key: 'ArrowLeft', selectedCode: 'A', landmarks: [] })
    expect(out.action).toEqual({ type: 'none' })
  })

  test('unrelated keys are ignored and do not trap focus', () => {
    const out = decideCephKey({ key: 'x', selectedCode: 'A', landmarks: [placedLm('A')] })
    expect(out.action).toEqual({ type: 'none' })
    expect(out.preventDefault).toBe(false)
  })
})
