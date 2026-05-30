import { describe, it, expect } from 'bun:test'
import { getNorm, classifyDeviation, CEPH_NORMS, type CephNorm } from './norms'

describe('ceph norms — lookup keyed by analysis type', () => {
  it('returns the Steiner SNA norm (82 ± 2)', () => {
    const n = getNorm('steiner_hybrid_sn', 'sna')
    expect(n).not.toBeNull()
    expect(n!.mean).toBe(82)
    expect(n!.sd).toBe(2)
    expect(typeof n!.source).toBe('string')
    expect(n!.source.length).toBeGreaterThan(0)
  })

  it('returns null for a metric with no established norm (facial_angle_sn)', () => {
    expect(getNorm('steiner_hybrid_sn', 'facial_angle_sn')).toBeNull()
  })

  it('returns null for an unknown analysis type (no cross-analysis bleed)', () => {
    expect(getNorm('ricketts', 'sna')).toBeNull()
    expect(getNorm('not_a_type', 'sna')).toBeNull()
  })

  it('exposes ANB and overjet norms in the Steiner table', () => {
    expect(CEPH_NORMS['steiner_hybrid_sn']!['anb']!.mean).toBe(2)
    expect(CEPH_NORMS['steiner_hybrid_sn']!['overjet']).toBeDefined()
  })
})

describe('ceph norms — deviation classification', () => {
  const sna: CephNorm = { mean: 82, sd: 2, source: 'Steiner' }

  it('classifies a value at the mean as normal with zero delta', () => {
    const d = classifyDeviation(82, sna)!
    expect(d.severity).toBe('normal')
    expect(d.delta).toBe(0)
    expect(d.sdAway).toBe(0)
  })

  it('classifies within 1 SD as normal (no color)', () => {
    expect(classifyDeviation(83.5, sna)!.severity).toBe('normal') // 0.75 SD
  })

  it('classifies 1–2 SD as mild (amber) and reports signed delta', () => {
    const d = classifyDeviation(85, sna)! // +3 → 1.5 SD
    expect(d.severity).toBe('mild')
    expect(d.delta).toBe(3)
    expect(d.sdAway).toBeCloseTo(1.5, 5)
  })

  it('classifies >2 SD as severe (red), negative direction', () => {
    const d = classifyDeviation(77, sna)! // -5 → 2.5 SD
    expect(d.severity).toBe('severe')
    expect(d.delta).toBe(-5)
  })

  it('is null-safe for a missing measured value', () => {
    expect(classifyDeviation(null, sna)).toBeNull()
  })

  it('does not divide by zero when sd is 0', () => {
    const d = classifyDeviation(50, { mean: 50, sd: 0, source: 'x' })!
    expect(d.severity).toBe('normal')
  })
})
