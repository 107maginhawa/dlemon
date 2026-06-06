export function computeExitCode(
  journeys: Array<{
    expectedVerdict: 'PASS' | 'BROKEN'
    actualVerdict: 'PASS' | 'BROKEN' | 'ERROR' | 'SKIPPED'
  }>,
  errorCount: number,
): number {
  // A PASS-expected journey that did not PASS is a regression — EXCEPT SKIPPED,
  // which means an environment precondition was genuinely absent (e.g. no seeded
  // ceph image because CI has no storage). SKIPPED is honest "did not run here",
  // not a failure, so it never trips the gate.
  const regressions = journeys.filter(
    (j) =>
      j.expectedVerdict === 'PASS' &&
      j.actualVerdict !== 'PASS' &&
      j.actualVerdict !== 'SKIPPED',
  )
  return errorCount > 0 || regressions.length > 0 ? 1 : 0
}
