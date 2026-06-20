import { describe, expect, test } from 'bun:test'
import { computeExitCode, computeCoreCoverageFailures } from './journey-harness-exit-code'

describe('computeExitCode — journey harness exit gate', () => {
  // AC-001: PASS-expected regresses to BROKEN → must fail CI
  test('AC-001: exits 1 when PASS-expected journey returns BROKEN', () => {
    const journeys = [{ expectedVerdict: 'PASS' as const, actualVerdict: 'BROKEN' as const }]
    expect(computeExitCode(journeys, 0)).toBe(1)
  })

  test('AC-001: exits 1 when PASS-expected journey returns ERROR', () => {
    const journeys = [{ expectedVerdict: 'PASS' as const, actualVerdict: 'ERROR' as const }]
    expect(computeExitCode(journeys, 0)).toBe(1)
  })

  // AC-002: error count > 0 (spec crashed) → must fail CI
  test('AC-002: exits 1 when error count > 0 even if no PASS regressions', () => {
    const journeys = [{ expectedVerdict: 'BROKEN' as const, actualVerdict: 'BROKEN' as const }]
    expect(computeExitCode(journeys, 1)).toBe(1)
  })

  // AC-003: clean run → exit 0
  test('AC-003: exits 0 when all PASS-expected journeys return PASS and no errors', () => {
    const journeys = [
      { expectedVerdict: 'PASS' as const, actualVerdict: 'PASS' as const },
      { expectedVerdict: 'BROKEN' as const, actualVerdict: 'BROKEN' as const },
    ]
    expect(computeExitCode(journeys, 0)).toBe(0)
  })

  test('AC-003: BROKEN-expected returning PASS (a fix) does not fail CI', () => {
    const journeys = [
      { expectedVerdict: 'PASS' as const, actualVerdict: 'PASS' as const },
      { expectedVerdict: 'BROKEN' as const, actualVerdict: 'PASS' as const },
    ]
    expect(computeExitCode(journeys, 0)).toBe(0)
  })

  // AC-004 (Plan C — armed lock): SKIPPED is an honest environment skip ONLY for
  // journeys that declare a legitimate environment precondition (the ceph journeys
  // need MinIO, absent in CI). For those, SKIPPED is tolerated.
  test('AC-004: a skip-allowed (ceph) journey returning SKIPPED does not fail CI', () => {
    const journeys = [
      { expectedVerdict: 'PASS' as const, actualVerdict: 'PASS' as const },
      { expectedVerdict: 'PASS' as const, actualVerdict: 'SKIPPED' as const, skipAllowed: true },
    ]
    expect(computeExitCode(journeys, 0)).toBe(0)
  })

  // AC-005 (Plan C): a CORE flow that silently SKIPs — the exact "broken for users
  // while green" class this effort targets — must FAIL the gate. SKIPPED is only
  // tolerated for journeys that opted in (skipAllowed); a core journey defaults off.
  test('AC-005: a core (non-skip-allowed) journey returning SKIPPED fails CI', () => {
    const journeys = [
      { expectedVerdict: 'PASS' as const, actualVerdict: 'PASS' as const },
      { expectedVerdict: 'PASS' as const, actualVerdict: 'SKIPPED' as const },
    ]
    expect(computeExitCode(journeys, 0)).toBe(1)
  })

  test('AC-005: skipAllowed:false is treated the same as a core flow (SKIP fails)', () => {
    const journeys = [
      { expectedVerdict: 'PASS' as const, actualVerdict: 'SKIPPED' as const, skipAllowed: false },
    ]
    expect(computeExitCode(journeys, 0)).toBe(1)
  })

  test('AC-004: a real regression alongside a tolerated ceph SKIP still fails CI', () => {
    const journeys = [
      { expectedVerdict: 'PASS' as const, actualVerdict: 'SKIPPED' as const, skipAllowed: true },
      { expectedVerdict: 'PASS' as const, actualVerdict: 'BROKEN' as const },
    ]
    expect(computeExitCode(journeys, 0)).toBe(1)
  })
})

describe('computeCoreCoverageFailures — JC-3 core doctor-visit WF gate', () => {
  const CORE = {
    'WF-045': { journeyId: 'J21', label: 'Start new visit' },
    'WF-009': { journeyId: 'J23', label: 'Chart entry' },
    'WF-012': { journeyId: 'J22', label: 'Complete visit' },
  }

  // Non-vacuity: the gate is GREEN only when every mapped core WF's journey PASSED.
  test('all core journeys PASS → no failures', () => {
    const verdicts = new Map<string, 'PASS' | 'BROKEN' | 'ERROR' | 'SKIPPED'>([
      ['J21', 'PASS'],
      ['J23', 'PASS'],
      ['J22', 'PASS'],
    ])
    expect(computeCoreCoverageFailures(verdicts, CORE)).toHaveLength(0)
  })

  // The teeth: a core journey regressing to BROKEN/ERROR/SKIPPED is caught.
  test('a core journey returning BROKEN is reported as a failure', () => {
    const verdicts = new Map<string, 'PASS' | 'BROKEN' | 'ERROR' | 'SKIPPED'>([
      ['J21', 'PASS'],
      ['J23', 'BROKEN'],
      ['J22', 'PASS'],
    ])
    const fails = computeCoreCoverageFailures(verdicts, CORE)
    expect(fails).toHaveLength(1)
    expect(fails[0]).toContain('WF-009')
  })

  // The exact "broken for users while green" class: a core journey that never ran.
  test('a core journey that never ran (NOT RUN) is a failure', () => {
    const verdicts = new Map<string, 'PASS' | 'BROKEN' | 'ERROR' | 'SKIPPED'>([
      ['J21', 'PASS'],
      ['J22', 'PASS'],
      // J23 absent entirely
    ])
    const fails = computeCoreCoverageFailures(verdicts, CORE)
    expect(fails).toHaveLength(1)
    expect(fails[0]).toContain('NOT RUN')
  })

  // A core journey silently SKIPPING does not count as proven.
  test('a core journey returning SKIPPED is a failure (not proven)', () => {
    const verdicts = new Map<string, 'PASS' | 'BROKEN' | 'ERROR' | 'SKIPPED'>([
      ['J21', 'PASS'],
      ['J23', 'SKIPPED'],
      ['J22', 'PASS'],
    ])
    expect(computeCoreCoverageFailures(verdicts, CORE)).toHaveLength(1)
  })
})
