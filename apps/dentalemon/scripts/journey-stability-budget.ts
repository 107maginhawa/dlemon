/**
 * journey-stability-budget — pure aggregation for the stability-budget banking run.
 *
 * The banking workflow runs the Journey Harness N consecutive times against a
 * from-zero-reseeded stack and asks one question: did the curated real-stack
 * smoke pass *every* time? A single flake breaks the bank. This module turns the
 * per-run harness verdicts into that answer plus an actionable flake map, with no
 * I/O so it can be unit-tested.
 *
 * A run is "clean" iff no PASS-expected journey came back as anything other than
 * PASS or SKIPPED — the exact contract the harness exit code encodes
 * (see journey-harness-exit-code.ts). SKIPPED is an honest environment skip
 * (e.g. a ceph journey with no MinIO) and never dirties a run.
 */

export interface JourneyRunRecord {
  id: string
  expectedVerdict: 'PASS' | 'BROKEN'
  actualVerdict: 'PASS' | 'BROKEN' | 'ERROR' | 'SKIPPED'
}

export interface HarnessRun {
  run: number
  exitCode: number
  journeys: JourneyRunRecord[]
}

export interface StabilitySummary {
  totalRuns: number
  cleanRuns: number
  /** cleanRuns / totalRuns, in [0,1]; 0 when there are no runs. */
  passRate: number
  /** true iff every run was clean (and at least one run happened). */
  banked: boolean
  /** Runs that were not clean, with the journeys that broke them. */
  failedRuns: Array<{ run: number; exitCode: number; offenders: string[] }>
  /** Journeys that regressed in ≥1 run, with how often and to what verdict. */
  flakyJourneys: Array<{ id: string; nonPassRuns: number; verdicts: string[] }>
}

/** A PASS-expected journey that did not PASS (and was not an honest SKIPPED). */
function isOffender(j: JourneyRunRecord): boolean {
  return j.expectedVerdict === 'PASS' && j.actualVerdict !== 'PASS' && j.actualVerdict !== 'SKIPPED'
}

export function summarizeBudget(runs: HarnessRun[]): StabilitySummary {
  const failedRuns: StabilitySummary['failedRuns'] = []
  // id → ordered list of the verdicts it regressed to across runs.
  const flakeMap = new Map<string, string[]>()

  let cleanRuns = 0
  for (const r of runs) {
    const offenders = r.journeys.filter(isOffender)
    if (offenders.length === 0 && r.exitCode === 0) {
      cleanRuns++
      continue
    }
    failedRuns.push({ run: r.run, exitCode: r.exitCode, offenders: offenders.map((o) => o.id) })
    for (const o of offenders) {
      const verdicts = flakeMap.get(o.id) ?? []
      verdicts.push(o.actualVerdict)
      flakeMap.set(o.id, verdicts)
    }
  }

  const flakyJourneys = [...flakeMap.entries()].map(([id, verdicts]) => ({
    id,
    nonPassRuns: verdicts.length,
    verdicts,
  }))

  return {
    totalRuns: runs.length,
    cleanRuns,
    passRate: runs.length === 0 ? 0 : cleanRuns / runs.length,
    banked: runs.length > 0 && cleanRuns === runs.length,
    failedRuns,
    flakyJourneys,
  }
}
