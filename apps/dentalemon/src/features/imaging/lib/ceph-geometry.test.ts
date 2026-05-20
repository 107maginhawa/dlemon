import { describe, it, expect } from 'bun:test'
import {
  LANDMARK_CODES,
  LANDMARK_LABELS,
  CEPH_LINES,
  CEPH_ANGLE_ARCS,
  activeLinesForLandmarks,
  activeArcsForLandmarks,
} from './ceph-geometry'

// The D5 landmark set — mirrors CephLandmarkCode enum in TypeSpec
const D5_CODES = ['S', 'N', 'A', 'B', 'ANS', 'PNS', 'Go', 'Po', 'Me', 'Or', 'Pog', 'Gn', 'U1T', 'U1A', 'L1T', 'L1A'] as const

describe('LANDMARK_CODES', () => {
  it('contains all 16 D5 codes', () => {
    expect(LANDMARK_CODES).toHaveLength(16)
    for (const code of D5_CODES) {
      expect(LANDMARK_CODES).toContain(code)
    }
  })

  it('matches @monobase/ceph-math LANDMARK_CODES exactly', async () => {
    const { LANDMARK_CODES: mathCodes } = await import('@monobase/ceph-math')
    expect([...LANDMARK_CODES]).toEqual([...mathCodes])
  })
})

describe('LANDMARK_LABELS', () => {
  it('has a non-empty string label for every code in LANDMARK_CODES', () => {
    for (const code of LANDMARK_CODES) {
      const label = LANDMARK_LABELS[code]
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('has no extra codes not in LANDMARK_CODES', () => {
    const extraKeys = Object.keys(LANDMARK_LABELS).filter(
      (k) => !(LANDMARK_CODES as readonly string[]).includes(k),
    )
    expect(extraKeys).toHaveLength(0)
  })
})

describe('CEPH_LINES', () => {
  it('has 7 line definitions', () => {
    expect(CEPH_LINES).toHaveLength(7)
  })

  it('each line has id, label, from, to with valid landmark codes', () => {
    for (const line of CEPH_LINES) {
      expect(typeof line.id).toBe('string')
      expect(typeof line.label).toBe('string')
      expect((LANDMARK_CODES as readonly string[]).includes(line.from)).toBe(true)
      expect((LANDMARK_CODES as readonly string[]).includes(line.to)).toBe(true)
    }
  })

  it('includes SN reference line', () => {
    const sn = CEPH_LINES.find((l) => l.from === 'S' && l.to === 'N')
    expect(sn).not.toBeUndefined()
    expect(sn!.id).toBe('sn')
  })

  it('includes mandibular plane Go-Me', () => {
    const gome = CEPH_LINES.find((l) => l.from === 'Go' && l.to === 'Me')
    expect(gome).not.toBeUndefined()
    expect(gome!.id).toBe('go-me')
  })

  it('includes NA, NB, N-Pog lines', () => {
    expect(CEPH_LINES.some((l) => l.from === 'N' && l.to === 'A')).toBe(true)
    expect(CEPH_LINES.some((l) => l.from === 'N' && l.to === 'B')).toBe(true)
    expect(CEPH_LINES.some((l) => l.from === 'N' && l.to === 'Pog')).toBe(true)
  })

  it('includes upper and lower incisor axes', () => {
    expect(CEPH_LINES.some((l) => l.from === 'U1A' && l.to === 'U1T')).toBe(true)
    expect(CEPH_LINES.some((l) => l.from === 'L1A' && l.to === 'L1T')).toBe(true)
  })

  it('has unique ids', () => {
    const ids = CEPH_LINES.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('activeLinesForLandmarks', () => {
  it('returns all lines when all landmarks are placed', () => {
    const placed = new Set(LANDMARK_CODES as unknown as string[])
    expect(activeLinesForLandmarks(placed)).toHaveLength(CEPH_LINES.length)
  })

  it('returns empty array when no landmarks placed', () => {
    expect(activeLinesForLandmarks(new Set())).toHaveLength(0)
  })

  it('returns only lines whose both endpoints are placed', () => {
    // Place S and N only → only SN line should be returned
    const placed = new Set(['S', 'N'])
    const active = activeLinesForLandmarks(placed)
    expect(active.every((l) => placed.has(l.from) && placed.has(l.to))).toBe(true)
    expect(active.some((l) => l.id === 'sn')).toBe(true)
    // Go-Me line requires Go and Me — absent
    expect(active.some((l) => l.id === 'go-me')).toBe(false)
  })

  it('skips line when only one endpoint is placed', () => {
    const placed = new Set(['S']) // N missing → SN inactive
    const active = activeLinesForLandmarks(placed)
    expect(active.some((l) => l.id === 'sn')).toBe(false)
  })
})

describe('CEPH_ANGLE_ARCS', () => {
  it('has at least one arc definition', () => {
    expect(CEPH_ANGLE_ARCS.length).toBeGreaterThan(0)
  })

  it('each arc has id, metricKey, label, vertex, ray1, ray2', () => {
    for (const arc of CEPH_ANGLE_ARCS) {
      expect(typeof arc.id).toBe('string')
      expect(typeof arc.metricKey).toBe('string')
      expect(typeof arc.label).toBe('string')
      expect((LANDMARK_CODES as readonly string[]).includes(arc.vertex)).toBe(true)
      expect((LANDMARK_CODES as readonly string[]).includes(arc.ray1)).toBe(true)
      expect((LANDMARK_CODES as readonly string[]).includes(arc.ray2)).toBe(true)
    }
  })

  it('has unique ids', () => {
    const ids = CEPH_ANGLE_ARCS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes SNA and SNB arcs', () => {
    expect(CEPH_ANGLE_ARCS.some((a) => a.id === 'sna')).toBe(true)
    expect(CEPH_ANGLE_ARCS.some((a) => a.id === 'snb')).toBe(true)
  })

  it('SNA arc has vertex=N with rays to S and A', () => {
    const sna = CEPH_ANGLE_ARCS.find((a) => a.id === 'sna')!
    expect(sna.vertex).toBe('N')
    const rays = new Set([sna.ray1, sna.ray2])
    expect(rays.has('S')).toBe(true)
    expect(rays.has('A')).toBe(true)
  })

  it('SNB arc has vertex=N with rays to S and B', () => {
    const snb = CEPH_ANGLE_ARCS.find((a) => a.id === 'snb')!
    expect(snb.vertex).toBe('N')
    const rays = new Set([snb.ray1, snb.ray2])
    expect(rays.has('S')).toBe(true)
    expect(rays.has('B')).toBe(true)
  })
})

describe('activeArcsForLandmarks', () => {
  it('returns all arcs when all landmarks are placed', () => {
    const placed = new Set(LANDMARK_CODES as unknown as string[])
    expect(activeArcsForLandmarks(placed)).toHaveLength(CEPH_ANGLE_ARCS.length)
  })

  it('returns empty array when no landmarks placed', () => {
    expect(activeArcsForLandmarks(new Set())).toHaveLength(0)
  })

  it('returns only arcs whose vertex and both rays are placed', () => {
    // Place S, N, A only → SNA arc should be returned (vertex=N, rays=S,A)
    const placed = new Set(['S', 'N', 'A'])
    const active = activeArcsForLandmarks(placed)
    expect(active.some((a) => a.id === 'sna')).toBe(true)
    // SNB needs B — absent
    expect(active.some((a) => a.id === 'snb')).toBe(false)
  })

  it('skips arc when vertex is missing', () => {
    // S and A present but N (vertex) missing → SNA inactive
    const placed = new Set(['S', 'A'])
    const active = activeArcsForLandmarks(placed)
    expect(active.some((a) => a.id === 'sna')).toBe(false)
  })
})
