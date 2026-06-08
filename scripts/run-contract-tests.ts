#!/usr/bin/env bun
/**
 * Run Hurl contract tests against the implementation under test.
 *
 * The implementation is whatever HTTP server is running on $API_URL
 * (default http://localhost:7213). The runner does not boot the impl —
 * that's the caller's responsibility, on purpose, so the same script
 * works against the JS impl, a future Rust impl, a remote staging URL, etc.
 *
 * Usage:
 *   # In one terminal: boot the impl
 *   cd services/api-ts && bun dev
 *
 *   # In another terminal: run the contract tests
 *   bun run test:contract
 *
 *   # Or against a remote target
 *   API_URL=https://stg.example.com bun run test:contract
 *
 * Variables injected into every Hurl scenario:
 *   - {{api}}          $API_URL
 *   - {{suffix}}       per-run unique string (timestamp-rand) for fixture isolation
 *   - {{admin_token}}  session token captured in admin preflight (cookie value)
 *   - {{admin_email}}  email of the admin user (signed up by preflight)
 *   - {{admin_password}}  password of the admin user (so scenarios can sign in
 *                         when they need to switch the cookie jar to admin)
 *   - {{mailpit_api}}  Mailpit HTTP API base, default http://localhost:8025
 */

import { spawnSync, spawn } from 'child_process'
import { readdirSync, existsSync } from 'fs'
import { join } from 'path'

const apiUrl = process.env.API_URL ?? 'http://localhost:7213'
const mailpitApi = process.env.MAILPIT_API ?? 'http://localhost:8025'
const adminEmail = process.env.CONTRACT_ADMIN_EMAIL ?? 'admin@contract-tests.local'
const adminPassword = process.env.CONTRACT_ADMIN_PASSWORD ?? 'AdminContractTest!1'

const contractDir = join(import.meta.dir, '..', 'specs', 'api', 'tests', 'contract')

if (!existsSync(contractDir)) {
  console.error(`Contract test dir not found: ${contractDir}`)
  process.exit(1)
}

// Suffix lets each run use unique fixture identifiers (emails, etc.)
const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

// Discover .hurl files. CONTRACT_ONLY=<substr>[,<substr>...] runs just the
// matching files (e.g. CONTRACT_ONLY=dental-patient) — used by the per-module
// verification sweep so a single module's gate doesn't pay for the whole suite
// (incl. the storage/mail files that fail when Docker deps are down). Unset = all.
const onlyFilters = (process.env.CONTRACT_ONLY ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const files = readdirSync(contractDir)
  .filter((f) => f.endsWith('.hurl'))
  .filter((f) => onlyFilters.length === 0 || onlyFilters.some((sub) => f.includes(sub)))
  .sort()
  .map((f) => join(contractDir, f))

if (files.length === 0) {
  console.error(
    onlyFilters.length > 0
      ? `No .hurl files match CONTRACT_ONLY=${process.env.CONTRACT_ONLY} in ${contractDir}`
      : `No .hurl files found in ${contractDir}`,
  )
  process.exit(1)
}

// Sanity-check hurl is installed
const probe = spawnSync('hurl', ['--version'], { stdio: 'ignore' })
if (probe.error || probe.status !== 0) {
  console.error('Hurl is not installed. Install it from https://hurl.dev/docs/installation.html')
  console.error('  macOS:  brew install hurl')
  console.error('  Linux:  see hurl.dev install instructions')
  process.exit(127)
}

/**
 * Admin preflight: ensure an admin user exists and capture its session.
 *
 * The impl auto-promotes any sign-up whose email is in AUTH_ADMIN_EMAILS to
 * the admin role. We sign up the configured admin email on the first run;
 * on subsequent runs (with a persistent test DB) sign-up returns 4xx and
 * we fall back to sign-in. Either way we end up with a session_token cookie
 * scoped to an admin role, which we inject as {{admin_token}}.
 */
async function ensureAdminSession(): Promise<string | null> {
  const signUp = await fetch(`${apiUrl}/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword, name: 'Contract Admin' }),
  })

  if (signUp.ok) {
    return extractSessionCookie(signUp.headers.get('set-cookie'))
  }

  const signIn = await fetch(`${apiUrl}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  })

  if (!signIn.ok) {
    return null
  }
  return extractSessionCookie(signIn.headers.get('set-cookie'))
}

function extractSessionCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null
  const match = setCookieHeader.match(/better-auth\.session_token=([^;]+)/)
  return match?.[1] ?? null
}

/**
 * Env preflight: warn (not fail) if the env vars contract scenarios depend on
 * look misconfigured. The runner doesn't try to fix anything — it just tells
 * the caller what's expected.
 */
function envPreflightWarnings(adminTokenAvailable: boolean): string[] {
  const warnings: string[] = []

  if (!adminTokenAvailable) {
    warnings.push(
      `admin preflight failed: could not sign up or sign in as "${adminEmail}". ` +
        `Make sure AUTH_ADMIN_EMAILS on the impl includes "${adminEmail}" and that the email password ` +
        `has not been changed underneath the runner. {{admin_token}} will be unavailable; ` +
        `admin-gated scenarios will not pass.`,
    )
  }

  // Mailpit reachability — only matters for auth-* scenarios.
  return warnings
}

const adminToken = await ensureAdminSession()
const warnings = envPreflightWarnings(adminToken != null)

// Clear stale active dental visits so unique partial index doesn't block re-runs.
// The dental-visit.hurl and dental-billing.hurl tests use fixed patient UUIDs;
// if a prior run left an active visit for those patients, activation will fail with 500.
await clearStaleDentalVisits()

async function clearStaleDentalVisits(): Promise<void> {
  try {
    const { spawnSync: runPsql } = await import('child_process')
    const sql = "UPDATE dental_visit SET status='completed', completed_at=now() WHERE status='active';"
    const dbUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/monobase'
    const result = runPsql('psql', [dbUrl, '-c', sql], { stdio: 'pipe' })
    if (result.error || result.status !== 0) {
      console.warn('  ⚠ Could not clear stale dental visits (psql not available or DB unreachable). Contract tests may fail if active visits exist.')
    } else {
      console.log('  ✓ Stale active dental visits cleared')
    }
  } catch {
    console.warn('  ⚠ Could not clear stale dental visits (psql not available). Contract tests may fail if active visits exist.')
  }
}

console.log(`→ ${files.length} contract scenario(s) against ${apiUrl}`)
console.log(`  suffix=${suffix}`)
console.log(`  admin_token=${adminToken ? `(captured for ${adminEmail})` : '(unavailable)'}`)
console.log(`  mailpit_api=${mailpitApi}`)
if (warnings.length > 0) {
  for (const w of warnings) console.warn(`  ⚠ ${w}`)
}
console.log()

const variables = [
  '--variable', `api=${apiUrl}`,
  '--variable', `suffix=${suffix}`,
  '--variable', `mailpit_api=${mailpitApi}`,
  '--variable', `admin_email=${adminEmail}`,
  '--variable', `admin_password=${adminPassword}`,
  ...(adminToken ? ['--variable', `admin_token=${adminToken}`] : []),
]

const child = spawn(
  'hurl',
  ['--test', ...variables, ...files],
  { stdio: 'inherit' },
)

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
