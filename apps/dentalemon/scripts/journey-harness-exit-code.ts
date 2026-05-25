export function computeExitCode(
  journeys: Array<{ expectedVerdict: 'PASS' | 'BROKEN'; actualVerdict: 'PASS' | 'BROKEN' | 'ERROR' }>,
  errorCount: number,
): number {
  const regressions = journeys.filter(
    (j) => j.expectedVerdict === 'PASS' && j.actualVerdict !== 'PASS',
  )
  return errorCount > 0 || regressions.length > 0 ? 1 : 0
}
