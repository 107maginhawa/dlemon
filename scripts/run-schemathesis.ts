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
const args = [
  'run',
  '--url',
  apiUrl,
  '--exclude-path-regex',
  '^/billing/webhooks/',
  specPath,
]

const child = spawn(bin, args, { stdio: 'inherit' })
child.on('exit', (code) => {
  process.exit(code ?? 1)
})
