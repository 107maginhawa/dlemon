#!/usr/bin/env bun
/**
 * run-stability-budget — bank the Journey Harness stability budget.
 *
 * Runs the full Journey Harness N consecutive times (default 20), each against a
 * freshly reseeded stack, and reports the pass-rate. The bank is earned only when
 * every run is clean (no PASS-expected journey regressed). A single flake breaks
 * it and is pinpointed by journey id, so we PROVE 20/20 on demand instead of
 * waiting for ~20 organic merges to accumulate the signal.
 *
 * Prereq: api-ts must already be running on :7213 (the harness reseeds over HTTP
 * and the Playwright webServer only boots the Vite frontend). In CI the
 * `journey-stability` workflow boots it once and loops here.
 *
 * Usage:
 *   bun apps/dentalemon/scripts/run-stability-budget.ts [--runs=20]
 *   STABILITY_RUNS=5 bun apps/dentalemon/scripts/run-stability-budget.ts
 *
 * Exit code: 0 iff all N runs were clean (budget banked); 1 otherwise.
 */

import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { summarizeBudget, type HarnessRun, type JourneyRunRecord } from './journey-stability-budget'

const APP_DIR = path.resolve(import.meta.dir, '..')
const REPO_ROOT = path.resolve(APP_DIR, '../..')
const HARNESS = path.join(APP_DIR, 'scripts/run-journey-harness.ts')
const RESULTS_FILE = path.join(APP_DIR, 'journey-results.json')
const BUDGET_FILE = path.join(APP_DIR, 'stability-budget-results.json')

function parseRuns(): number {
  const flag = process.argv.slice(2).find((a) => a.startsWith('--runs='))
  const raw = flag ? flag.slice('--runs='.length) : process.env.STABILITY_RUNS
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : 20
}

function readJourneys(): JourneyRunRecord[] | null {
  if (!fs.existsSync(RESULTS_FILE)) return null
  try {
    const j = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'))
    if (!Array.isArray(j.journeys)) return null
    return j.journeys.map((r: any) => ({
      id: r.id,
      expectedVerdict: r.expectedVerdict,
      actualVerdict: r.actualVerdict,
    }))
  } catch {
    return null
  }
}

function main() {
  const runsTarget = parseRuns()
  console.log('═'.repeat(70))
  console.log(` STABILITY BUDGET — banking ${runsTarget} consecutive Journey Harness runs`)
  console.log('═'.repeat(70))

  const runs: HarnessRun[] = []
  for (let i = 1; i <= runsTarget; i++) {
    console.log(`\n${'━'.repeat(70)}\n▶ Stability run ${i}/${runsTarget}\n${'━'.repeat(70)}`)
    // Each run reseeds (no --no-reseed) → a clean, deterministic from-zero state,
    // so the budget measures the real reseed→smoke path, not a drifting DB.
    const r = spawnSync('bun', [HARNESS], { cwd: REPO_ROOT, stdio: 'inherit', env: process.env })
    const exitCode = r.status ?? 1

    const journeys = readJourneys()
    if (journeys === null) {
      // Harness crashed before writing a report — count it as a hard failure.
      console.error(`✗ run ${i}: no journey-results.json produced (harness crashed)`)
      runs.push({
        run: i,
        exitCode,
        journeys: [{ id: 'HARNESS', expectedVerdict: 'PASS', actualVerdict: 'ERROR' }],
      })
      continue
    }
    runs.push({ run: i, exitCode, journeys })
    const offenders = journeys.filter(
      (j) => j.expectedVerdict === 'PASS' && j.actualVerdict !== 'PASS' && j.actualVerdict !== 'SKIPPED',
    )
    console.log(
      offenders.length === 0 && exitCode === 0
        ? `✓ run ${i}/${runsTarget}: clean`
        : `✗ run ${i}/${runsTarget}: DIRTY (exit ${exitCode}; offenders: ${offenders.map((o) => `${o.id}=${o.actualVerdict}`).join(', ') || 'none'})`,
    )
  }

  const summary = summarizeBudget(runs)

  fs.writeFileSync(
    BUDGET_FILE,
    JSON.stringify({ runAt: new Date().toISOString(), runsTarget, summary, runs }, null, 2),
  )

  console.log(`\n${'═'.repeat(70)}\n STABILITY BUDGET RESULT\n${'═'.repeat(70)}`)
  console.log(
    `Runs: ${summary.cleanRuns}/${summary.totalRuns} clean  |  pass-rate ${(summary.passRate * 100).toFixed(1)}%`,
  )
  if (summary.failedRuns.length) {
    console.log('\nDirty runs:')
    for (const f of summary.failedRuns) {
      console.log(`  run ${f.run} (exit ${f.exitCode}): ${f.offenders.join(', ') || '(no offender recorded)'}`)
    }
  }
  if (summary.flakyJourneys.length) {
    console.log('\nFlaky journeys (regressed in ≥1 run):')
    for (const fj of summary.flakyJourneys) {
      console.log(`  ${fj.id}: ${fj.nonPassRuns}/${summary.totalRuns} runs → [${fj.verdicts.join(', ')}]`)
    }
  }
  console.log('─'.repeat(70))
  console.log(
    summary.banked
      ? `✅ BUDGET BANKED — ${summary.totalRuns}/${summary.totalRuns} clean. The curated smoke is stable.`
      : `❌ BUDGET NOT BANKED — ${summary.totalRuns - summary.cleanRuns} of ${summary.totalRuns} runs flaked. Stabilize the journeys above before arming Plan C.`,
  )
  console.log(`✓ Wrote ${path.relative(REPO_ROOT, BUDGET_FILE)}`)
  console.log('═'.repeat(70))

  process.exit(summary.banked ? 0 : 1)
}

main()
