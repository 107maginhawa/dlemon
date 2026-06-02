import { describe, test, expect } from 'bun:test'
import {
  getNorm,
  NORM_POPULATIONS,
  DEFAULT_POPULATION,
  getPopulationLabel,
} from './norms'

describe('population-selectable ceph norms (P2-6)', () => {
  test('NORM_POPULATIONS lists at least the default + one ethnic population', () => {
    expect(NORM_POPULATIONS).toContain(DEFAULT_POPULATION)
    expect(NORM_POPULATIONS.length).toBeGreaterThan(1)
  })

  test('every listed population has a human-readable label', () => {
    for (const pop of NORM_POPULATIONS) {
      const label = getPopulationLabel(pop)
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    }
  })

  test('omitting population is identical to the default population (backwards compatible)', () => {
    const implicit = getNorm('steiner_hybrid_sn', 'sna')
    const explicit = getNorm('steiner_hybrid_sn', 'sna', DEFAULT_POPULATION)
    expect(implicit).toEqual(explicit)
  })

  test('a non-default population can override the mean for a metric', () => {
    // At least one population must provide a distinct SNA mean, else the selector is cosmetic.
    const overrides = NORM_POPULATIONS.filter((p) => p !== DEFAULT_POPULATION)
      .map((p) => getNorm('steiner_hybrid_sn', 'sna', p))
      .filter((n): n is NonNullable<typeof n> => n != null)
    expect(overrides.length).toBeGreaterThan(0)
    const defaultMean = getNorm('steiner_hybrid_sn', 'sna', DEFAULT_POPULATION)!.mean
    expect(overrides.some((n) => n.mean !== defaultMean)).toBe(true)
  })

  test('a population that does not override a metric falls back to the default norm', () => {
    // interincisal is unlikely to be overridden in every population → falls back.
    const nonDefault = NORM_POPULATIONS.find((p) => p !== DEFAULT_POPULATION)!
    const fallback = getNorm('steiner_hybrid_sn', 'interincisal', nonDefault)
    const base = getNorm('steiner_hybrid_sn', 'interincisal', DEFAULT_POPULATION)
    expect(fallback).toEqual(base)
  })

  test('unknown population falls back to the default set (no crash, no null bleed)', () => {
    const n = getNorm('steiner_hybrid_sn', 'sna', 'not_a_population')
    expect(n).not.toBeNull()
    expect(n!.mean).toBe(getNorm('steiner_hybrid_sn', 'sna', DEFAULT_POPULATION)!.mean)
  })
})
