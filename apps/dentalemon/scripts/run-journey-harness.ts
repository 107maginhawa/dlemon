#!/usr/bin/env bun
import { computeExitCode, computeCoreCoverageFailures } from './journey-harness-exit-code'
/**
 * Journey Harness Runner — Phase 3.
 *
 * Drives the clinical journey specs (the EXPECTED roster below) and emits a machine-readable
 * verdict report (`apps/dentalemon/journey-results.json`).
 *
 * What it does:
 *   1. `bun run db:reseed` — seed the demo DB (10 patients, mixed dentition,
 *      imaging + ceph present). Skip with --no-reseed.
 *   2. Ensure the api-ts server is reachable at :7213 (warns if not — the
 *      Playwright webServer boots the Vite app at :3003; api-ts must be up
 *      separately, as in normal dev).
 *   3. Run ONLY `tests/e2e/journeys/` via the Playwright CLI.
 *   4. Aggregate per-journey records (written by `expectJourneyBroken` /
 *      `recordJourneyPass` into `.journey-tmp/`) cross-referenced with the
 *      Playwright JSON reporter, into `journey-results.json`.
 *   5. Print a summary table to stdout.
 *
 * Verdict semantics (contract §Verdict Rubric):
 *   - A spec is GREEN in Playwright iff its EXPECTED outcome occurred (a
 *     known-BROKEN journey that confirms its break is a passing spec).
 *   - `actualVerdict` is read from the per-journey record, NOT from Playwright
 *     pass/fail — a green spec can legitimately carry actualVerdict=BROKEN.
 *   - actualVerdict=ERROR means the spec threw before reaching a verdict.
 *
 * Usage:
 *   bun apps/dentalemon/scripts/run-journey-harness.ts [--no-reseed]
 */

import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const APP_DIR = path.resolve(import.meta.dir, '..')
const REPO_ROOT = path.resolve(APP_DIR, '../..')
const TMP_DIR = path.join(APP_DIR, '.journey-tmp')
const RESULTS_FILE = path.join(APP_DIR, 'journey-results.json')
const PW_JSON = path.join(APP_DIR, 'test-results.json')
const BRANCH =
  spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .stdout.trim() || 'unknown'
const API_URL = 'http://localhost:7213'

const args = new Set(process.argv.slice(2))
const noReseed = args.has('--no-reseed')

// Full expected roster (contract §Journey → File Mapping).
// `skipAllowed` (Plan C — armed lock): the ONLY journeys permitted to record
// SKIPPED without failing the gate. Reserved for genuine environment-absence —
// the ceph journeys (B01–B04) need a seeded ceph image, which requires MinIO,
// not provisioned in the journey CI job. Every other (core) journey defaults to
// skipAllowed:false, so a silent core-flow skip fails the build.
const EXPECTED: Record<
  string,
  { name: string; set: 'A' | 'B'; expected: 'PASS' | 'BROKEN'; rubricIds: string[]; skipAllowed?: boolean }
> = {
  J01: { name: 'New-patient comprehensive oral evaluation', set: 'A', expected: 'PASS', rubricIds: ['Q6', 'Q7', 'Q8', 'Q9', 'Q10'] },
  J02: { name: 'Periodic recall exam (D0120)', set: 'A', expected: 'PASS', rubricIds: ['Q9', 'Q10', 'Q25'] },
  J03: { name: 'Periodontal charting linked to odontogram', set: 'A', expected: 'PASS', rubricIds: ['Q11', 'Q12', 'Q13', 'Q14', 'Q16'] },
  J04: { name: 'Revenue chain (flagship)', set: 'A', expected: 'PASS', rubricIds: ['Q17', 'Q18', 'Q19', 'Q20', 'Q22', 'Q23'] },
  J05: { name: 'Status integrity on the odontogram', set: 'A', expected: 'PASS', rubricIds: ['Q8', 'Q24', 'Q25'] },
  J06: { name: 'Multi-visit / phased treatment plan sequencing', set: 'A', expected: 'PASS', rubricIds: ['Q26', 'Q27', 'Q28'] },
  J07: { name: 'Charting granularity & mixed dentition', set: 'A', expected: 'PASS', rubricIds: ['Q29', 'Q30', 'Q31', 'Q32', 'Q33'] },
  J08: { name: 'Informed refusal', set: 'A', expected: 'PASS', rubricIds: ['Q20'] },
  J09: { name: 'Treatment-plan versioning', set: 'A', expected: 'PASS', rubricIds: ['Q34', 'Q35'] },
  J10: { name: 'Void / amend a signed entry', set: 'A', expected: 'PASS', rubricIds: ['Q36', 'Q37', 'Q38', 'Q39'] },
  // J21 — the curated "must-never-break" New-Visit create flow (the incident).
  // Hard-asserts POST /dental/visits → 201 on Diego (the clean-state seed patient);
  // closes the silent-skip J01 carried. Listed after J10 to keep Set A grouped.
  J21: { name: 'Start a new clinical visit (New Visit → 201)', set: 'A', expected: 'PASS', rubricIds: ['WF-045'] },
  // J22 — the closing half of the encounter (UA_KG_UPGRADE triage gap): completing a
  // visit gates billing, yet had no journey while J21 covered only starting one.
  // Drives active → pre-completion checklist → PATCH completed; asserts the goal state
  // (completed) via an independent read. Consent + notes are seeded as the real
  // backend completion preconditions (VISIT_CONSENT_REQUIRED / WF-012, BR-002).
  J22: { name: 'Complete a clinical visit (active → checklist → completed)', set: 'A', expected: 'PASS', rubricIds: ['WF-012'] },
  // J23 — JC-1 keystone: the continuous day-in-the-life visit (WF-074). Drives the two
  // previously-unproven clinical AUTHORING acts through the real UI with an independent
  // read-back each: charting a tooth condition + treatment (WF-009) and typing a fresh
  // SOAP note (WF-011), then mark-performed → invoice → complete. This is the test that
  // finally proves the chart-save / SOAP-save React paths persist (not just untested).
  J23: { name: 'Dentist visit day-in-the-life (chart entry + SOAP note authored through UI → performed → invoice → complete → PMD)', set: 'A', expected: 'PASS', rubricIds: ['WF-074', 'WF-009', 'WF-011', 'WF-021'] },
  // J25–J28 — JC-4: money/destructive flows driven through the REAL billing/settings UI
  // with an independent read of the durable status (highest blast radius — money + GDPR).
  J25: { name: 'Record payment on an invoice via the billing UI → paid', set: 'A', expected: 'PASS', rubricIds: ['WF-014'] },
  J26: { name: 'Void + mark-uncollectible an invoice via the billing UI → terminal status', set: 'A', expected: 'PASS', rubricIds: ['WF-041'] },
  J27: { name: 'Refund a payment via the billing UI → invoice reopened', set: 'A', expected: 'PASS', rubricIds: ['WF-BIL-REFUND'] },
  J28: { name: 'Platform admin approves a patient erasure request → anonymized', set: 'A', expected: 'PASS', rubricIds: ['WF-088'] },
  J19: { name: 'Case presentation — present → e-sign → accept / reject', set: 'A', expected: 'PASS', rubricIds: ['Q19', 'Q20'] },
  J16: { name: 'Medical alert (allergy) visible before/during clinical encounter', set: 'A', expected: 'PASS', rubricIds: ['ENC-BR-004', 'PAT-BR-003'] },
  J17: { name: 'Front-desk books an appointment via the calendar UI', set: 'A', expected: 'PASS', rubricIds: ['WF-SCH-001'] },
  J18: { name: 'New clinic owner self-onboards via the setup wizard', set: 'A', expected: 'PASS', rubricIds: ['WF-ORG-001'] },
  J20: { name: 'Imported external PMD merges its safety floor into the patient record', set: 'A', expected: 'PASS', rubricIds: ['FR12.5', 'BR-022'] },
  // B01/B02 PASS where a ceph image is seeded (local, MinIO present). In CI there
  // is no MinIO → no seeded ceph image → these journeys record SKIPPED (honest
  // environment skip, tolerated by the gate via skipAllowed), not a fake BROKEN.
  B01: { name: 'Free-tier ceph gate', set: 'B', expected: 'PASS', rubricIds: ['CIMG-001', 'CIMG-002', 'CIMG-007'], skipAllowed: true },
  B02: { name: 'Landmark placement → SNA/SNB numeric', set: 'B', expected: 'PASS', rubricIds: ['CIMG-003'], skipAllowed: true },
  B03: { name: 'Locked landmark immutability', set: 'B', expected: 'PASS', rubricIds: ['CIMG-004'], skipAllowed: true },
  B04: { name: 'Report gate + immutable versioned snapshot', set: 'B', expected: 'PASS', rubricIds: ['CIMG-006', 'CIMG-008'], skipAllowed: true },
  // J24 — JC-2: patient magic-link sign-in (WF-003, the sole patient login path).
  // Drives the better-auth-ui magic-link flow through the DOM, consumes the emailed
  // link via Mailpit, and independent-reads the durable session. Set B / skipAllowed:
  // needs Mailpit (email transport), which the journey CI job lacks → honest SKIP
  // there, like the ceph/MinIO journeys; runs to PASS where Mailpit is up.
  J24: { name: 'Patient magic-link sign-in (request via UI → consume emailed link → session)', set: 'B', expected: 'PASS', rubricIds: ['WF-003'], skipAllowed: true },
  // J15 is Set B (sync-log lifecycle). It needs a seeded branch + a P10+ patient
  // but not MinIO; with the demo seed present it runs to PASS.
  J15: { name: 'Offline sync metadata — sync-log lifecycle + server-default syncStatus', set: 'B', expected: 'PASS', rubricIds: ['LF-BR-001', 'LF-BR-002', 'LF-BR-003', 'LF-BR-004'] },
}

// ── JC-3: core doctor-visit WF coverage gate ──────────────────────────────────
// The audit's premise: a 22/22 green overstated reality because the core clinical
// authoring WFs had no PROVEN journey. This gate ties the green to the core set:
// each core doctor-visit WF must map to a journey that PASSED this run, else the
// build fails (a core journey silently regressing/skip is no longer invisible).
//
// `journeyId` is the harness id whose live verdict proves the WF. Keep this in sync
// with docs/testing/coverage/workflow-test-map.json (the broader documentation map).
const CORE_DOCTOR_WFS: Record<string, { journeyId: string; label: string }> = {
  'WF-045': { journeyId: 'J21', label: 'Start new visit' },
  'WF-009': { journeyId: 'J23', label: 'Dental chart entry (persist)' },
  'WF-011': { journeyId: 'J23', label: 'SOAP note authoring (persist)' },
  'WF-010': { journeyId: 'J04', label: 'Mark treatment performed' },
  'WF-013': { journeyId: 'J04', label: 'Create invoice from visit' },
  'WF-012': { journeyId: 'J22', label: 'Complete visit' },
  'WF-018': { journeyId: 'J19', label: 'Consent e-signature' },
  'WF-021': { journeyId: 'J23', label: 'PMD auto-generation' },
}

// Documented, tracked gaps — core WFs that genuinely lack a live journey yet. Listed
// EXPLICITLY (mirroring skipAllowed) so the green never silently hides them: the gate
// prints each as a tracked gap rather than failing, and removing one from here is the
// signal that its journey now exists. Keep the reason current.
const KNOWN_CORE_GAPS: Record<string, string> = {
  'WF-007':
    'Appointment check-in → visit. No live journey yet (the Check-In control is a calendar-card hover action); covered today only by patient-checkin.spec.ts (not in this harness). Tracked follow-up.',
}

interface JourneyResult {
  id: string
  name: string
  set: 'A' | 'B'
  expectedVerdict: 'PASS' | 'BROKEN'
  actualVerdict: 'PASS' | 'BROKEN' | 'ERROR' | 'SKIPPED'
  duration_ms: number
  failedStep: string | null
  screenshotPath: string | null
  rubricIds: string[]
  skipAllowed: boolean
}

function sh(cmd: string, cmdArgs: string[], cwd: string): number {
  console.log(`\n$ ${cmd} ${cmdArgs.join(' ')}  (cwd: ${cwd})`)
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', env: process.env })
  return r.status ?? 1
}

async function checkApi(): Promise<boolean> {
  try {
    const r = await fetch(`${API_URL}/config`, { signal: AbortSignal.timeout(3000) })
    return r.ok || r.status < 500
  } catch {
    return false
  }
}

function readPwDurations(): Record<string, number> {
  const out: Record<string, number> = {}
  if (!fs.existsSync(PW_JSON)) return out
  try {
    const j = JSON.parse(fs.readFileSync(PW_JSON, 'utf8'))
    const walk = (suite: any) => {
      for (const s of suite.suites ?? []) walk(s)
      for (const spec of suite.specs ?? []) {
        const title: string = spec.title ?? ''
        const idMatch = title.match(/\b([JB]\d{2})\b/)
        if (!idMatch || !idMatch[1]) continue
        const dur = (spec.tests ?? [])
          .flatMap((t: any) => t.results ?? [])
          .reduce((acc: number, res: any) => acc + (res.duration ?? 0), 0)
        out[idMatch[1]] = dur
      }
    }
    for (const s of j.suites ?? []) walk(s)
  } catch {
    /* best-effort */
  }
  return out
}

async function main() {
  console.log('═'.repeat(70))
  console.log(' Journey Harness Runner — Phase 3')
  console.log('═'.repeat(70))

  // 1. Reseed.
  if (!noReseed) {
    const code = sh('bun', ['run', 'db:reseed'], REPO_ROOT)
    if (code !== 0) {
      console.error('✗ db:reseed failed — aborting (independent reads need the seed).')
      process.exit(1)
    }
  } else {
    console.log('→ --no-reseed: skipping db:reseed')
  }

  // 2. API reachability.
  const apiUp = await checkApi()
  if (!apiUp) {
    console.warn(
      `\n⚠ api-ts not reachable at ${API_URL}. The Playwright webServer boots ` +
        `the Vite app (:3003) but NOT api-ts. Start it first:\n` +
        `    cd services/api-ts && bun dev\n` +
        `Continuing — specs will surface the failure honestly.`,
    )
  } else {
    console.log(`✓ api-ts reachable at ${API_URL}`)
  }

  // Clean prior per-journey records.
  if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true })
  fs.mkdirSync(TMP_DIR, { recursive: true })

  // 3. Run ONLY the journeys subdirectory.
  const pwCode = sh(
    'bunx',
    ['playwright', 'test', 'tests/e2e/journeys', '--reporter=json,line'],
    APP_DIR,
  )
  console.log(`\nPlaywright exit code: ${pwCode}`)

  // 4. Aggregate.
  const durations = readPwDurations()
  const journeys: JourneyResult[] = []

  for (const id of Object.keys(EXPECTED)) {
    const meta = EXPECTED[id]!
    const recPath = path.join(TMP_DIR, `${id}.json`)
    let actualVerdict: JourneyResult['actualVerdict'] = 'ERROR'
    let failedStep: string | null = 'No per-journey record emitted (spec did not run or crashed before verdict).'
    let screenshotPath: string | null = null

    if (fs.existsSync(recPath)) {
      try {
        const rec = JSON.parse(fs.readFileSync(recPath, 'utf8'))
        actualVerdict = rec.actualVerdict ?? 'ERROR'
        failedStep = rec.failedStep ?? null
        screenshotPath = rec.screenshotPath ?? null
      } catch {
        failedStep = 'Per-journey record unparseable.'
      }
    }

    journeys.push({
      id,
      name: meta.name,
      set: meta.set,
      expectedVerdict: meta.expected,
      actualVerdict,
      duration_ms: Math.round(durations[id] ?? 0),
      failedStep,
      screenshotPath,
      rubricIds: meta.rubricIds,
      skipAllowed: meta.skipAllowed === true,
    })
  }

  // JC-3 honest tally: distinguish journeys that prove a workflow WORKS from any
  // designed-broken/inverted proof that "passes" by confirming a LIMITATION. A green
  // count must not let an inverted proof read as feature health. (Currently every
  // journey is expectedVerdict:PASS, so provenBroken is 0 — but the split is now
  // structural, so a future inverted journey is categorised, never miscounted.)
  const provenWorking = journeys.filter(
    (j) => j.expectedVerdict === 'PASS' && j.actualVerdict === 'PASS',
  ).length
  const provenBroken = journeys.filter(
    (j) => j.expectedVerdict === 'BROKEN' && j.actualVerdict === 'BROKEN',
  ).length

  const summary = {
    total: journeys.length,
    pass: journeys.filter((j) => j.actualVerdict === 'PASS').length,
    broken: journeys.filter((j) => j.actualVerdict === 'BROKEN').length,
    error: journeys.filter((j) => j.actualVerdict === 'ERROR').length,
    skipped: journeys.filter((j) => j.actualVerdict === 'SKIPPED').length,
    provenWorking,
    provenBroken,
    setA: {
      pass: journeys.filter((j) => j.set === 'A' && j.actualVerdict === 'PASS').length,
      broken: journeys.filter((j) => j.set === 'A' && j.actualVerdict === 'BROKEN').length,
    },
    setB: {
      pass: journeys.filter((j) => j.set === 'B' && j.actualVerdict === 'PASS').length,
      broken: journeys.filter((j) => j.set === 'B' && j.actualVerdict === 'BROKEN').length,
    },
  }

  const report = {
    runAt: new Date().toISOString(),
    branch: BRANCH,
    seed: 'mixed',
    journeys,
    summary,
  }

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(report, null, 2))
  console.log(`\n✓ Wrote ${path.relative(REPO_ROOT, RESULTS_FILE)}`)

  // 5. Summary table.
  console.log('\n' + '═'.repeat(70))
  console.log(' JOURNEY VERDICTS')
  console.log('═'.repeat(70))
  console.log(
    'ID   Set Expected  Actual   Δ   Name',
  )
  console.log('─'.repeat(70))
  for (const j of journeys) {
    const drift = j.expectedVerdict === j.actualVerdict ? ' ' : '!'
    console.log(
      `${j.id.padEnd(4)} ${j.set}   ${j.expectedVerdict.padEnd(8)} ` +
        `${j.actualVerdict.padEnd(7)}  ${drift}  ${j.name}`,
    )
  }
  console.log('─'.repeat(70))
  console.log(
    `Total ${summary.total} | PASS ${summary.pass} | BROKEN ${summary.broken} | ERROR ${summary.error} | SKIPPED ${summary.skipped}`,
  )
  console.log(
    `Set A: PASS ${summary.setA.pass} BROKEN ${summary.setA.broken} | ` +
      `Set B: PASS ${summary.setB.pass} BROKEN ${summary.setB.broken}`,
  )
  // JC-3 honest tally: PROVEN-WORKING vs PROVEN-BROKEN, so a green count is never
  // read as feature health when it includes designed-broken/inverted proofs.
  console.log(
    `PROVEN-WORKING ${summary.provenWorking} | PROVEN-BROKEN ${summary.provenBroken} ` +
      `(designed-broken confirmations are NOT feature coverage)`,
  )
  console.log('═'.repeat(70))

  // JC-3 core doctor-visit WF coverage gate: each core WF must map to a journey that
  // PASSED this run, else the gate fails. Documented gaps (KNOWN_CORE_GAPS) are
  // printed as tracked, not failed — so the green never silently hides them.
  const verdictById = new Map(journeys.map((j) => [j.id, j.actualVerdict]))
  const coreFailures = computeCoreCoverageFailures(verdictById, CORE_DOCTOR_WFS)
  console.log('\n CORE doctor-visit WF coverage (each must be proven by a passing journey):')
  for (const [wf, { journeyId, label }] of Object.entries(CORE_DOCTOR_WFS)) {
    const verdict = verdictById.get(journeyId)
    console.log(
      `  ${verdict === 'PASS' ? '✓' : '✗'} ${wf} (${label}) → ${journeyId} [${verdict ?? 'NOT RUN'}]`,
    )
  }
  for (const [wf, reason] of Object.entries(KNOWN_CORE_GAPS)) {
    console.log(`  ⚠ ${wf} — TRACKED GAP (no live journey yet): ${reason}`)
  }
  if (coreFailures.length) {
    console.log('\n✗ CORE coverage gate FAILED — a core doctor-visit WF lost its proven journey:')
    for (const f of coreFailures) console.log(`  ${f}`)
  } else {
    console.log(
      `\n✓ CORE coverage gate: all ${Object.keys(CORE_DOCTOR_WFS).length} mapped core WFs proven ` +
        `(${Object.keys(KNOWN_CORE_GAPS).length} tracked gap(s) listed above).`,
    )
  }
  console.log('═'.repeat(70))

  // A SKIPPED is an honest environment skip ONLY for a skip-allowed journey (ceph
  // needs MinIO). A SKIPPED on any other (core) journey is a silent core-flow skip
  // and IS verdict drift — Plan C's armed lock fails on it.
  const drifts = journeys.filter(
    (j) =>
      j.expectedVerdict !== j.actualVerdict &&
      !(j.actualVerdict === 'SKIPPED' && j.skipAllowed),
  )
  const skips = journeys.filter((j) => j.actualVerdict === 'SKIPPED' && j.skipAllowed)
  if (skips.length) {
    console.log('\nℹ Environment skips (precondition absent — not run here, not a failure):')
    for (const s of skips) console.log(`  ${s.id}: ${s.failedStep ?? ''}`)
  }
  if (drifts.length) {
    console.log('\n⚠ Verdict drift (expected ≠ actual) — needs human review:')
    for (const d of drifts) {
      console.log(`  ${d.id}: expected ${d.expectedVerdict}, got ${d.actualVerdict} — ${d.failedStep ?? ''}`)
    }
    console.log(
      '\nNOTE: a P0-touching journey that came back PASS may mean the harness ' +
        'is cheating OR a P0 was fixed. Re-audit against the Anti-Cheating Rules.',
    )
  }

  // Exit 1 if any spec crashed (ERROR) OR any PASS-expected journey regressed
  // (verdict) OR a CORE doctor-visit WF lost its proven journey (JC-3 gate).
  const verdictExit = computeExitCode(journeys, summary.error)
  process.exit(verdictExit || coreFailures.length > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('Runner crashed:', e)
  process.exit(1)
})
