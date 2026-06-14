import { describe, expect, test } from 'bun:test'
import { computeExitCode } from './journey-harness-exit-code'

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
