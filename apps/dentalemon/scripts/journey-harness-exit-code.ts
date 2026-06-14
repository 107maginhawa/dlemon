export function computeExitCode(
  journeys: Array<{
    expectedVerdict: 'PASS' | 'BROKEN'
    actualVerdict: 'PASS' | 'BROKEN' | 'ERROR' | 'SKIPPED'
    // Plan C (armed lock): SKIPPED is tolerated ONLY for journeys that declare a
    // legitimate environment precondition (skipAllowed). The ceph journeys need
    // MinIO, absent in CI, so they opt in. A CORE flow that returns SKIPPED — the
    // "silently skipped while green" class this effort exists to kill — does NOT
    // opt in and therefore fails the gate.
    skipAllowed?: boolean
  }>,
  errorCount: number,
): number {
  // A PASS-expected journey that did not PASS is a regression — EXCEPT a SKIPPED
  // on a skip-allowed journey, which means an opted-in environment precondition was
  // genuinely absent (e.g. no seeded ceph image because CI has no storage). That is
  // honest "did not run here", not a failure. A SKIPPED on any other journey is a
  // silent core-flow skip and trips the gate.
  const regressions = journeys.filter(
    (j) =>
      j.expectedVerdict === 'PASS' &&
      j.actualVerdict !== 'PASS' &&
      !(j.actualVerdict === 'SKIPPED' && j.skipAllowed === true),
  )
  return errorCount > 0 || regressions.length > 0 ? 1 : 0
}
