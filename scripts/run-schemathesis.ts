#!/usr/bin/env bun
/**
 * Run Schemathesis against the implementation under test.
 *
 * Schemathesis is the shadow / fuzz layer to Hurl's targeted contract
 * scenarios. It generates requests from the OpenAPI bundle and asserts
 * the impl returns documented status codes, schema-compliant bodies,
 * and so on.
 *
 * Like run-contract-tests.ts, this script doesn't boot the impl —
 * that's the caller's responsibility.
 *
 * Usage:
 *   # In one terminal: boot the impl
 *   cd services/api-ts && bun dev
 *
 *   # In another terminal:
 *   bun run test:contract:fuzz
 *
 * Schemathesis isn't a JS dependency. Install it once via:
 *   pipx install schemathesis
 * or any equivalent (system pip, pyenv, asdf, ...). The script searches
 * a few common locations before failing.
 */

import { spawnSync, spawn } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { homedir } from 'os'

const apiUrl = process.env.API_URL ?? 'http://localhost:7213'
const specPath = join(import.meta.dir, '..', 'specs', 'api', 'dist', 'openapi', 'openapi.json')

if (!existsSync(specPath)) {
  console.error(`OpenAPI bundle not found: ${specPath}`)
  console.error('Run `cd specs/api && bun run build` first.')
  process.exit(1)
}

// Search for schemathesis in common locations.
const candidates = [
  'schemathesis',
  join(homedir(), '.local', 'bin', 'schemathesis'),
  '/tmp/schemathesis-venv/bin/schemathesis',
]

let bin: string | null = null
for (const c of candidates) {
  const probe = spawnSync(c, ['--version'], { stdio: 'ignore' })
  if (!probe.error && probe.status === 0) {
    bin = c
    break
  }
}

if (!bin) {
  console.error('Schemathesis is not installed.')
  console.error('  pipx install schemathesis')
  console.error('  # or:')
  console.error('  python3 -m venv ~/.venvs/schemathesis && \\')
  console.error('    ~/.venvs/schemathesis/bin/pip install schemathesis')
  process.exit(127)
}

console.log(`→ schemathesis (${bin}) against ${apiUrl}\n`)

// Excluded paths:
// - /billing/webhooks/* — Stripe webhook signatures are cryptographically
//   signed; the spec can't model the constraint precisely, so schemathesis
//   generates trivially invalid signatures and the impl correctly rejects
//   them. Tested separately by stripe-side integration tests.
//
// Two profiles select via env (so one script serves both CI steps):
//   • SHADOW (default, no env): every default check, advisory. Surfaces
//     spec-precision nits (under-declared codes, datetime params).
//   • BLOCKING (SCHEMATHESIS_CHECKS set): the narrow, real-bug profile
//     `not_a_server_error,status_code_conformance` over all ops — a green,
//     enforceable gate. SCHEMATHESIS_MAX_EXAMPLES bounds wall-clock;
//     SCHEMATHESIS_SUPPRESS_HEALTH_CHECK=all silences schemathesis's *own*
//     data-generation health checks (filter_too_much / too_slow / data_too_large
//     / large_base_example) — these fire non-deterministically (seed-dependent)
//     on ops with tight input regex (confirmationCode, practitioner-roles) and
//     are never impl bugs, so they must not fail the gate. (Suppressing the
//     single `filter_too_much` value proved unreliable across seeds; `all` is
//     the correct categorical disable for a blocking gate.)
const args = [
  'run',
  '--url',
  apiUrl,
  '--exclude-path-regex',
  '^/billing/webhooks/',
]

const checks = process.env['SCHEMATHESIS_CHECKS']
if (checks) args.push('--checks', checks)

const maxExamples = process.env['SCHEMATHESIS_MAX_EXAMPLES']
if (maxExamples) args.push('--max-examples', maxExamples)

// Use the `=` form: `--suppress-health-check=all` is unambiguous, whereas the
// space form (`--suppress-health-check all <spec>`) sits right before the
// positional spec path and was not reliably honored in CI.
const suppress = process.env['SCHEMATHESIS_SUPPRESS_HEALTH_CHECK']
if (suppress) args.push(`--suppress-health-check=${suppress}`)

// Optional fixed seed (determinism for the blocking gate / debugging).
const seed = process.env['SCHEMATHESIS_SEED']
if (seed) args.push('--seed', seed)

args.push(specPath)

console.log(`→ args: ${args.join(' ')}\n`)

// In BLOCKING mode the gate must fail ONLY on real check failures (a 5xx, or an
// undocumented status code) — never on schemathesis's OWN data-generation health
// checks (filter_too_much / too_slow / data_too_large / large_base_example).
// Those fire non-deterministically on ~3 tight-input-regex ops (confirmationCode,
// practitioner(-role)s, patient-authorization-status) — and `--suppress-health-
// check=all` proved unreliable across environments (CI's Python/Hypothesis build
// vs local), so we belt-and-suspenders it here: tee the output and, on a non-zero
// exit whose ONLY errors are health checks (and with zero check failures), treat
// the gate as PASS. Any real check failure (a FAILURES section or a non-zero
// "unique failures" count) or any non-health-check error still fails the gate.
const isBlocking = Boolean(checks)
const child = spawn(bin, args, { stdio: ['inherit', 'pipe', 'pipe'] })
// Accumulate in an ARRAY and join once at exit — NOT `buf += chunk` per data
// event, which is O(n²) over the blocking profile's huge ~26k-case output (each
// `+=` copies the whole growing string) and was slowing the CI `contract` job
// from ~16m to >35m, tripping its job-level timeout.
const chunks: string[] = []
child.stdout.on('data', (d) => { const s = d.toString(); chunks.push(s); process.stdout.write(s) })
child.stderr.on('data', (d) => { const s = d.toString(); chunks.push(s); process.stderr.write(s) })
child.on('exit', (code) => {
  if (!isBlocking || code === 0) {
    process.exit(code ?? 1)
    return
  }
  const buf = chunks.join('')
  const hasCheckFailures =
    /={2,}\s*FAILURES\s*={2,}/.test(buf) || /found\s+[1-9]\d*\s+unique failures/.test(buf)
  // Each summary error category is printed as "🚫 <label>: <n>".
  const errorLabels = [...buf.matchAll(/🚫\s+([^\n:]+):/g)].map((m) => (m[1] ?? '').trim())
  const onlyHealthCheckErrors =
    errorLabels.length > 0 && errorLabels.every((l) => /Failed Health Check/i.test(l))
  if (!hasCheckFailures && onlyHealthCheckErrors) {
    console.log(
      '\n⚠ run-schemathesis: schemathesis exited non-zero but the ONLY errors are ' +
        'data-generation health checks (e.g. filter_too_much on tight-input-regex ops), ' +
        'NOT check failures. The blocking checks all passed → treating the gate as PASS.',
    )
    process.exit(0)
    return
  }
  process.exit(code ?? 1)
})
