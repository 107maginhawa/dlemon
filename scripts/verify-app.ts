#!/usr/bin/env bun
/**
 * verify-app — the single re-runnable "does the app work end-to-end?" button.
 *
 * It AGGREGATES the verify-app program's gates into one verdict (it does NOT
 * replace the 16 CI gates — it runs the locally-runnable subset on demand and
 * proves "works for users" by running the real-stack Tier-1 proof, not by
 * reporting green unit numbers).
 *
 *   Tier 0 — Computed gates (seconds, no server): typecheck, lint, the coverage
 *            engine unit tests + the 6 computed matrices (coverage:all:ci),
 *            module-boundary isolation, and BR traceability.
 *   Tier 1 — Functional proof (minutes): the FE unit + coherence-oracle suite,
 *            and — when the api-ts stack is reachable on :7213 — the core Hurl
 *            contract suite and the clinical journey harness (real reseeded DB).
 *   Tier 2 — Adversarial deep sweep — RESERVED for Phase 3 (--deep prints a note).
 *
 * Usage:
 *   bun run verify:app            # Tier 0 + Tier 1, report mode (always exit 0)
 *   bun run verify:app:ci         # same, but exit non-zero on any blocking failure
 *   bun scripts/verify-app.ts --tier0   # only the computed gates
 *   bun scripts/verify-app.ts --tier1   # only the functional proof
 *   bun scripts/verify-app.ts --deep    # (reserved) Tier 2 adversarial sweep
 *
 * Tier-1 steps that need a running stack are SKIPPED (not failed) when api-ts is
 * not reachable on :7213 — boot it first (`cd services/api-ts && bun dev`) to
 * include them. The verdict is written to docs/testing/coverage/VERDICT.md.
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const VERDICT = join(ROOT, 'docs', 'testing', 'coverage', 'VERDICT.md')
const API_URL = process.env['API_URL'] ?? 'http://localhost:7213'

const argv = new Set(process.argv.slice(2))
const ci = argv.has('--ci')
const deep = argv.has('--deep')
const only0 = argv.has('--tier0')
const only1 = argv.has('--tier1')
const runTier0 = only0 || (!only1)
const runTier1 = only1 || (!only0)

type Status = 'PASS' | 'FAIL' | 'SKIP'

interface Step {
  id: string
  tier: 0 | 1
  /** Shell command, run via `bash -lc` from `cwd`. */
  cmd: string
  cwd?: string
  /** A non-zero exit fails the overall run in --ci mode. */
  blocking: boolean
  /** Requires the api-ts stack reachable on :7213 → SKIP when it is not. */
  needsStack?: boolean
  /** One-line purpose for the verdict. */
  what: string
}

const STEPS: Step[] = [
  // ── Tier 0 — computed gates (no server) ───────────────────────────────────
  { id: 'typecheck', tier: 0, blocking: true, what: 'TypeScript across dentalemon + api-ts',
    cmd: 'bun run typecheck' },
  { id: 'lint', tier: 0, blocking: true, what: 'ESLint (0 errors) + FSM-token drift guard',
    cmd: 'bun run lint' },
  { id: 'coverage-engine-tests', tier: 0, blocking: true, what: 'the computed-coverage engine unit tests',
    cmd: 'bun test ./scripts/coverage/' },
  { id: 'coverage-matrices', tier: 0, blocking: true,
    what: 'regenerate + ratchet the 6 coverage matrices (role-op drift HARD; br report-only)',
    // Mirror the CI coverage job: build spec + codegen → regenerate the (gitignored)
    // contract spine offline → run every matrix with the gates enforced.
    cmd: 'cd specs/api && bun run build >/dev/null && cd ../../services/api-ts && bun run generate >/dev/null && cd ../.. && bun scripts/build-contract-spine.ts >/dev/null && bun run coverage:all:ci' },
  { id: 'module-boundaries', tier: 0, blocking: true, what: 'cross-module repository-import isolation',
    cmd: 'cd services/api-ts && bun run check:boundaries:error' },
  { id: 'secret-logging', tier: 0, blocking: true,
    what: 'no secret reaches a log under an un-redacted key + no committed secret literal',
    cmd: 'bun run check:secret-logging' },
  { id: 'br-traceability', tier: 0, blocking: true,
    what: 'the LEGACY fixed-subset P0-BR traceability gate (audit:trace:ci) — NOT all 48 computed P0 BRs (26 untraced; see br-matrix.md)',
    cmd: 'bun run audit:trace:ci' },

  // ── Tier 1 — functional proof ─────────────────────────────────────────────
  { id: 'fe-unit-coherence', tier: 1, blocking: true,
    what: 'the dentalemon unit + cross-element coherence-oracle suite (mocked, no stack)',
    cmd: 'cd apps/dentalemon && bun test src/' },
  { id: 'contract-core', tier: 1, blocking: true, needsStack: true,
    what: 'the core Hurl contract suite against the live api-ts (wire-level contract)',
    cmd: 'CONTRACT_SKIP=storage,dental-imaging,dental-assistant,auth-verification,auth-password-reset,billing-lifecycle bun run test:contract' },
  { id: 'journey-harness', tier: 1, blocking: true, needsStack: true,
    what: 'the clinical journey harness on a reseeded real DB (proves flows work for users)',
    cmd: 'bun apps/dentalemon/scripts/run-journey-harness.ts' },
]

function stackReachable(): boolean {
  // Probe a cheap unauthenticated endpoint; <500 (or any response) means up.
  const r = spawnSync('bash', ['-lc', `curl -fsS -o /dev/null -w '%{http_code}' --max-time 3 ${API_URL}/livez`], {
    encoding: 'utf8',
  })
  return r.status === 0 && (r.stdout ?? '').trim() === 'ok' || /^[2-4]/.test((r.stdout ?? '').trim())
}

interface Result {
  step: Step
  status: Status
  ms: number
  detail: string
}

function lastMeaningful(out: string): string {
  const lines = out.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim() !== '')
  return lines.slice(-1)[0]?.slice(0, 200) ?? ''
}

function run(step: Step, stackUp: boolean): Result {
  if (step.needsStack && !stackUp) {
    return { step, status: 'SKIP', ms: 0, detail: `api-ts not reachable at ${API_URL} — boot it (cd services/api-ts && bun dev) to include this proof` }
  }
  const started = performance.now()
  process.stdout.write(`\n▶ [Tier ${step.tier}] ${step.id} — ${step.what}\n`)
  const r = spawnSync('bash', ['-lc', step.cmd], { cwd: join(ROOT, step.cwd ?? '.'), encoding: 'utf8' })
  const ms = Math.round(performance.now() - started)
  const out = (r.stdout ?? '') + (r.stderr ?? '')
  process.stdout.write(out)
  const status: Status = r.status === 0 ? 'PASS' : 'FAIL'
  const detail = status === 'PASS' ? lastMeaningful(out) : lastMeaningful(out) || `exit ${r.status}`
  process.stdout.write(`   → ${status} (${(ms / 1000).toFixed(1)}s)\n`)
  return { step, status, ms, detail }
}

/**
 * The honest ceiling. verify-app proves the WIRED/SHIPPED surface works and
 * RATCHETS the computed gaps — it is not an adversarial audit. Spelling this out
 * stops a green verdict from being read as "nobody can break this" (the P0
 * patient-contact IDOR fixed in #38 was invisible to every Tier-0/1 gate here).
 */
const DOES_NOT_PROVE = `## What this verdict does NOT prove
A green verdict means the wired surface works and the computed gaps are ratcheted.
It is **not** an adversarial audit. It does **not** detect:

- **Object-level IDOR · cross-tenant LIST leaks · secrets-in-logs · "inert" authz**
  (a permission the code computes but never enforces). These are Tier-2 probes
  (Phase 3) — e.g. the P0 cross-tenant patient-contact IDOR (fixed in #38) passed
  every Tier-0/1 gate.
- **All P0 business rules.** \`br-traceability\` runs the LEGACY fixed-subset gate
  (\`audit:trace:ci\`), not the 48 computed P0 BRs — **26 of 48 are untraced**
  (IDOR / erasure / legal-hold among them; see \`br-matrix.md\`). \`br\` is report-only.
- **Full role coverage.** role-op "0 drift" is true-but-narrow: only ~28 of ~110
  role-gated ops are expressible in the spec matrix tables, so "0 drift" means "no
  contradiction among the joinable subset", not "all 110 verified".
- **Per-endpoint test breadth.** The endpoint matrix's *integration* + *journey*
  columns read a \`COVERAGE_RECORD\` sink that is gitignored / not populated in this
  pass — only the *contract* column is authoritative, so a "tested" disposition can
  rest on contract coverage alone.
- **The ~180 orphan endpoints** (built, no FE consumer — incl. payments / erasure /
  legal-hold) or product-decision-gated gaps; those are tracked in
  \`orphan-disposition.md\`, not exercised.`

function writeVerdict(results: Result[], stackUp: boolean, overall: Status) {
  const icon = (s: Status) => (s === 'PASS' ? '✅' : s === 'FAIL' ? '❌' : '⏭️')
  const rows = results
    .map((r) => `| ${icon(r.status)} ${r.status} | ${r.step.tier} | \`${r.step.id}\` | ${(r.ms / 1000).toFixed(1)}s | ${r.step.what}${r.status !== 'PASS' ? ` — ${r.detail.replace(/\|/g, '\\|')}` : ''} |`)
    .join('\n')
  const failed = results.filter((r) => r.status === 'FAIL')
  const skipped = results.filter((r) => r.status === 'SKIP')
  const md = `# verify:app — VERDICT

> Generated by \`bun run verify:app\`${ci ? ' --ci' : ''}. One re-runnable proof that the wired/shipped
> surface works end-to-end + every computed gap is ratcheted. This AGGREGATES the
> verify-app gates; the full 16 CI gates still run in CI.

**Overall: ${icon(overall)} ${overall}**  ·  stack ${stackUp ? 'reachable' : `NOT reachable at ${API_URL}`}  ·  ${results.length} steps, ${failed.length} failed, ${skipped.length} skipped

| Status | Tier | Step | Time | What |
|--------|------|------|------|------|
${rows}

${failed.length ? `## Failures\n${failed.map((r) => `- \`${r.step.id}\`: ${r.detail.replace(/\|/g, '\\|')}`).join('\n')}\n` : ''}${skipped.length ? `## Skipped (stack not up)\n${skipped.map((r) => `- \`${r.step.id}\`: ${r.detail.replace(/\|/g, '\\|')}`).join('\n')}\n` : ''}
## Computed-gap artifacts (Tier 0)
The 6 coverage matrices + their gap reports are committed under \`docs/testing/coverage/\`:
\`role-op-matrix.md\`, \`endpoint-matrix.md\` (+ \`orphan-disposition.md\`), \`br-matrix.md\`,
\`fsm-matrix.md\`, \`workflow-matrix.md\`, \`fe-route-matrix.md\`. Each is a deterministic
set-diff over a machine-readable source; new gaps must be allowlisted with a reason.

${DOES_NOT_PROVE}

## Tier 2 (deep sweep)
Reserved for Phase 3 (mutation + 26-module skeptic fan-out + persona walks). Run with \`--deep\` once it lands.
`
  mkdirSync(join(ROOT, 'docs', 'testing', 'coverage'), { recursive: true })
  writeFileSync(VERDICT, md)
}

// ── main ──────────────────────────────────────────────────────────────────
console.log('═'.repeat(72))
console.log(' verify:app — end-to-end verification' + (ci ? ' (--ci)' : ''))
console.log('═'.repeat(72))

if (deep) {
  console.log('\n⏭️  Tier 2 (--deep) adversarial sweep is Phase 3 — not yet implemented.')
  console.log('   Running Tier 0 + Tier 1 below; the deep sweep lands with Phase 3.\n')
}

const stackUp = runTier1 ? stackReachable() : false
console.log(`\nStack on ${API_URL}: ${stackUp ? 'reachable ✓' : 'not reachable (Tier-1 stack steps will be skipped)'}`)

const selected = STEPS.filter((s) => (s.tier === 0 ? runTier0 : runTier1))
const results: Result[] = []
for (const step of selected) results.push(run(step, stackUp))

const anyBlockingFail = results.some((r) => r.status === 'FAIL' && r.step.blocking)
const overall: Status = anyBlockingFail ? 'FAIL' : results.some((r) => r.status === 'SKIP') ? 'PASS' : 'PASS'

writeVerdict(results, stackUp, overall)

console.log('\n' + '═'.repeat(72))
console.log(' VERDICT')
console.log('═'.repeat(72))
for (const r of results) {
  const tag = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️ '
  console.log(`${tag} [T${r.step.tier}] ${r.step.id.padEnd(22)} ${(r.ms / 1000).toFixed(1).padStart(6)}s`)
}
console.log('─'.repeat(72))
const fails = results.filter((r) => r.status === 'FAIL')
const skips = results.filter((r) => r.status === 'SKIP')
console.log(`Overall: ${overall}  |  ${results.length} steps, ${fails.length} failed, ${skips.length} skipped`)
console.log(`Wrote ${VERDICT.replace(ROOT + '/', '')}`)
if (skips.length) console.log(`(${skips.length} Tier-1 stack step(s) skipped — boot api-ts on :7213 to include them.)`)
console.log('═'.repeat(72))

// In --ci mode a blocking failure is fatal; report mode always exits 0.
process.exit(ci && anyBlockingFail ? 1 : 0)
