import { describe, expect, test } from 'bun:test'
import { summarizeBudget, type HarnessRun } from './journey-stability-budget'

// Helper: build a run from a terse verdict map. exitCode is derived to mirror the
// harness contract (computeExitCode) so the fixtures stay self-consistent.
function run(n: number, verdicts: Record<string, ['PASS' | 'BROKEN', 'PASS' | 'BROKEN' | 'ERROR' | 'SKIPPED']>): HarnessRun {
  const journeys = Object.entries(verdicts).map(([id, [expectedVerdict, actualVerdict]]) => ({
    id,
    expectedVerdict,
    actualVerdict,
  }))
  const regressed = journeys.some(
    (j) => j.expectedVerdict === 'PASS' && j.actualVerdict !== 'PASS' && j.actualVerdict !== 'SKIPPED',
  )
  return { run: n, exitCode: regressed ? 1 : 0, journeys }
}

describe('summarizeBudget — stability budget aggregation', () => {
  // AC-001: a perfect bank — every run cleanly passed.
  test('AC-001: all runs clean → banked, 100% pass rate, no flaky journeys', () => {
    const runs = [1, 2, 3].map((n) => run(n, { J01: ['PASS', 'PASS'], J03: ['PASS', 'PASS'] }))
    const s = summarizeBudget(runs)
    expect(s.totalRuns).toBe(3)
    expect(s.cleanRuns).toBe(3)
    expect(s.passRate).toBe(1)
    expect(s.banked).toBe(true)
    expect(s.failedRuns).toHaveLength(0)
    expect(s.flakyJourneys).toHaveLength(0)
  })

  // AC-002: one run regressed → not banked; the offending journey is named.
  test('AC-002: a single PASS→BROKEN run breaks the bank and is pinpointed', () => {
    const runs = [
      run(1, { J01: ['PASS', 'PASS'], J03: ['PASS', 'PASS'] }),
      run(2, { J01: ['PASS', 'PASS'], J03: ['PASS', 'BROKEN'] }),
      run(3, { J01: ['PASS', 'PASS'], J03: ['PASS', 'PASS'] }),
    ]
    const s = summarizeBudget(runs)
    expect(s.cleanRuns).toBe(2)
    expect(s.banked).toBe(false)
    expect(s.passRate).toBeCloseTo(2 / 3)
    expect(s.failedRuns).toEqual([{ run: 2, exitCode: 1, offenders: ['J03'] }])
    expect(s.flakyJourneys).toEqual([{ id: 'J03', nonPassRuns: 1, verdicts: ['BROKEN'] }])
  })

  // AC-003: SKIPPED is an honest environment skip — it never dirties a run.
  test('AC-003: a PASS-expected SKIPPED keeps the run clean', () => {
    const runs = [run(1, { J01: ['PASS', 'PASS'], B02: ['PASS', 'SKIPPED'] })]
    const s = summarizeBudget(runs)
    expect(s.cleanRuns).toBe(1)
    expect(s.banked).toBe(true)
    expect(s.flakyJourneys).toHaveLength(0)
  })

  // AC-004: a spec that crashed (ERROR) on a PASS-expected journey is an offender.
  test('AC-004: an ERROR on a PASS-expected journey breaks the run', () => {
    const runs = [run(1, { J01: ['PASS', 'ERROR'] })]
    const s = summarizeBudget(runs)
    expect(s.cleanRuns).toBe(0)
    expect(s.banked).toBe(false)
    expect(s.failedRuns[0]?.offenders).toEqual(['J01'])
    expect(s.flakyJourneys).toEqual([{ id: 'J01', nonPassRuns: 1, verdicts: ['ERROR'] }])
  })

  // AC-005: the same journey flaking across multiple runs is counted with each verdict.
  test('AC-005: a journey flaking in 2 of 3 runs is tallied with its verdict history', () => {
    const runs = [
      run(1, { J03: ['PASS', 'BROKEN'] }),
      run(2, { J03: ['PASS', 'PASS'] }),
      run(3, { J03: ['PASS', 'ERROR'] }),
    ]
    const s = summarizeBudget(runs)
    expect(s.cleanRuns).toBe(1)
    expect(s.passRate).toBeCloseTo(1 / 3)
    expect(s.flakyJourneys).toEqual([{ id: 'J03', nonPassRuns: 2, verdicts: ['BROKEN', 'ERROR'] }])
  })

  // AC-006: a BROKEN-expected journey returning BROKEN is the expected outcome — clean.
  test('AC-006: BROKEN-expected returning BROKEN does not dirty a run', () => {
    const runs = [run(1, { J01: ['PASS', 'PASS'], JX: ['BROKEN', 'BROKEN'] })]
    const s = summarizeBudget(runs)
    expect(s.banked).toBe(true)
    expect(s.flakyJourneys).toHaveLength(0)
  })

  // AC-007: zero runs is never a bank (guards an empty/aborted harness loop).
  test('AC-007: zero runs is not banked and reports a 0 pass rate', () => {
    const s = summarizeBudget([])
    expect(s.totalRuns).toBe(0)
    expect(s.banked).toBe(false)
    expect(s.passRate).toBe(0)
  })
})
