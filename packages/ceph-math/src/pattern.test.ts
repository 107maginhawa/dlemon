import { describe, it, expect } from 'bun:test'
import { classifySkeletalPattern } from './pattern'

describe('classifySkeletalPattern — informational read-out (not a diagnosis)', () => {
  it('calls ANB ~2 Class I, >4 Class II, <0 Class III', () => {
    expect(classifySkeletalPattern({ anb: 2 }).sagittal).toBe('Class I')
    expect(classifySkeletalPattern({ anb: 6 }).sagittal).toBe('Class II')
    expect(classifySkeletalPattern({ anb: -2 }).sagittal).toBe('Class III')
  })

  it('classifies vertical pattern from SN-GoMe', () => {
    expect(classifySkeletalPattern({ sn_gome: 32 }).vertical).toBe('Normodivergent')
    expect(classifySkeletalPattern({ sn_gome: 42 }).vertical).toBe('Hyperdivergent')
    expect(classifySkeletalPattern({ sn_gome: 22 }).vertical).toBe('Hypodivergent')
  })

  it('classifies upper-incisor inclination from U1-SN', () => {
    expect(classifySkeletalPattern({ u1_sn: 103 }).dental).toBe('Normal incisor inclination')
    expect(classifySkeletalPattern({ u1_sn: 112 }).dental).toBe('Proclined upper incisors')
    expect(classifySkeletalPattern({ u1_sn: 94 }).dental).toBe('Retroclined upper incisors')
  })

  it('returns null for a dimension when its source measurement is missing', () => {
    const p = classifySkeletalPattern({})
    expect(p.sagittal).toBeNull()
    expect(p.vertical).toBeNull()
    expect(p.dental).toBeNull()
  })

  it('exposes a hasAny flag that is false when nothing is classifiable', () => {
    expect(classifySkeletalPattern({}).hasAny).toBe(false)
    expect(classifySkeletalPattern({ anb: 2 }).hasAny).toBe(true)
  })
})
