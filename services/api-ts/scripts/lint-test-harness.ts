#!/usr/bin/env bun
/**
 * lint-test-harness.ts — guards against NEW raw-handler test mounts.
 *
 * THE PROBLEM (raw-handler-test-blindspot)
 * ----------------------------------------
 * A backend integration test that mounts an API handler on a bespoke `new Hono()`
 * with NO `zValidator` in front of it skips the generated validator the route
 * runs in production. A request body that violates the contract then reaches the
 * handler directly — it crashes (500) or silently accepts garbage — so FE↔BE
 * contract drift ships green and only the out-of-process Hurl suite ever catches
 * it. This was the mechanism behind nearly every contract drift the AHA pipeline
 * fixed (BUG-IMG-001 et al).
 *
 * THE FIX
 * -------
 * `src/tests/helpers/test-app.ts` exposes `buildTestApp`, which assembles the app
 * from the EXACT production route table (generated `registerRoutes`) so every
 * request traverses the real authMiddleware → generated zValidator → handler
 * chain. New handler integration tests should drive requests through it.
 *
 * THIS GUARD (a ratchet)
 * ----------------------
 * Flags every `*.test.ts` that constructs `new Hono()`, mounts a route
 * (`app.post('/...', ...)`), uses NO `zValidator`, and does NOT import
 * `buildTestApp`. The current offenders are grandfathered in ALLOWLIST below;
 * CI fails only when a NEW file matches the anti-pattern. Migrate an allowlisted
 * file to `buildTestApp` (or add a hand-mounted `zValidator`) and remove it from
 * the list — the ratchet only tightens.
 *
 * Exit 1 on a new offender. Stale allowlist entries (migrated since) are reported
 * as a non-fatal nudge to trim the list.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const API_TS_ROOT = join(import.meta.dir, '..');
const SRC_DIR = join(API_TS_ROOT, 'src');

/**
 * Grandfathered raw-mount test files (paths relative to services/api-ts).
 * Shrink this list as files migrate to `buildTestApp`; never add to it — new
 * raw mounts must use the harness.
 *
 * The bulk of the original list has been migrated. The entries that REMAIN are
 * the ones that CANNOT (or SHOULD NOT) go through `buildTestApp`, grouped by
 * reason below. They are intentional, not "not yet done" — keep them raw.
 *
 * (Already migrated, removed from this list: activateOrganization, createMember,
 * deactivateMember, updateMember, getBranchesByUser, getOrgContext, listMembers,
 * permissions, org-member-role-active, then a 27-file sweep across billing,
 * booking, comms, dental-billing, dental-imaging, dental-org, dental-portal,
 * dental-visit, emr, notifs, person, reviews.)
 */
const ALLOWLIST: ReadonlySet<string> = new Set([
  // ── Cross-cutting unit tests: mount SYNTHETIC routes, not real generated
  //    endpoints, so the generated route table can't host them. ──
  'src/core/health.test.ts',                          // synthetic /livez,/readyz + module-local registerRoutes
  'src/middleware/auth.test.ts',                       // authMiddleware in isolation on a synthetic /protected/resource
  'src/middleware/security.test.ts',                   // CSRF / CORS / security-header middleware (harness omits these guards)
  'src/tests/error-envelope.error-classes.test.ts',    // synthetic /throw/* routes, one per error class

  // ── Documented harness divergences (test-app.ts "KNOWN DIVERGENCES"): the
  //    harness omits the hand-mount, so migrating would change behavior. ──
  'src/handlers/dental-org/dental-org.pin-recovery.test.ts', // recover-pin: prod shadows with authMiddleware; generated route has none
  'src/handlers/storage/uploadFile.test.ts',                 // harness injects parseConfig() → application/dicom gets the 2GB DICOM cap, not the test's flat 100MB

  // ── Mock-DB / monkey-patched unit tests: no real Drizzle instance (or they
  //    bypass the validator deliberately), so buildTestApp's real repos + real
  //    validator chain can't run them without rewriting their assertions. ──
  'src/handlers/billing/finalizeInvoice.notif.test.ts',      // mock.module repo stubs, database:{}, synthetic route
  'src/handlers/billing/getInvoice.test.ts',                 // synthetic re-implementation route over in-test fake repos
  'src/handlers/booking/booking-coverage.test.ts',           // monkey-patches ctx.req.valid() to inject invalid params; asserts raw 500s
  'src/handlers/dental-audit/getAuditEvents.test.ts',        // fakes dental role as the Better-Auth SESSION role; real authMiddleware({roles:['user']}) would 403
  // (dental-patient.bulk-import.test.ts migrated: now drives the contract { patients }/{ csv }
  //  paths through the shared harness; the bare-array + text/csv raw mounts it retains are
  //  legacy/internal-only and no longer the file's sole coverage.)
  'src/handlers/provider/getPractitioner.test.ts',           // hand-rolled select-chain mock, no real DB; non-UUID ids would 400 at the param validator
  'src/handlers/storage/storage-coverage.test.ts',           // asserts handler-internal 500 reachable only without authMiddleware (harness returns 401 first)
]);

const ROUTE_MOUNT = /\bapp\.(get|post|put|patch|delete)\(/;
// Matches both `new Hono()` and the generic form `new Hono<{ Variables }>()`.
const NEW_HONO = /\bnew Hono\s*[<(]/;
// The escape hatch must be a real IMPORT of the shared harness — a file with its
// own local `function buildTestApp` (106 of them exist) does NOT count, otherwise
// the magic substring would hide every bespoke validator-free helper.
const IMPORTS_SHARED_HARNESS = /import[^;]*\bbuildTestApp\b[^;]*from\s*['"][^'"]*test-app['"]/;

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'generated') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.test.ts')) out.push(full);
  }
}

/** A file is a "raw handler mount" if it builds a Hono app and mounts a route
 *  without any zValidator and without using the shared harness. */
function isRawHandlerMount(content: string): boolean {
  if (!NEW_HONO.test(content)) return false;
  if (!ROUTE_MOUNT.test(content)) return false;
  if (content.includes('zValidator')) return false;
  if (IMPORTS_SHARED_HARNESS.test(content)) return false;
  return true;
}

const testFiles: string[] = [];
walk(SRC_DIR, testFiles);
testFiles.sort();

const newOffenders: string[] = [];
const matched = new Set<string>();

for (const file of testFiles) {
  const rel = relative(API_TS_ROOT, file);
  if (!isRawHandlerMount(readFileSync(file, 'utf8'))) continue;
  matched.add(rel);
  if (!ALLOWLIST.has(rel)) newOffenders.push(rel);
}

const staleAllowlist = [...ALLOWLIST].filter((p) => !matched.has(p)).sort();

if (newOffenders.length > 0) {
  console.error(`\n❌ ${newOffenders.length} new raw-handler test mount(s) found (no zValidator, no buildTestApp):`);
  for (const f of newOffenders) console.error(`   ${f}`);
  console.error(
    `\nDrive handler integration tests through the shared harness instead:\n` +
      `   import { buildTestApp } from '@/tests/helpers/test-app';\n` +
      `   const app = buildTestApp({ db, user });\n` +
      `It mounts the generated validators (the same ones production runs), so\n` +
      `contract drift surfaces in-process instead of only in the Hurl suite.`,
  );
}

if (staleAllowlist.length > 0) {
  console.info(`\nℹ️  ${staleAllowlist.length} allowlisted file(s) no longer raw-mount — remove from ALLOWLIST to tighten the ratchet:`);
  for (const f of staleAllowlist) console.info(`   ${f}`);
}

if (newOffenders.length === 0) {
  console.info(`✅ ${testFiles.length} test file(s) checked — no new raw-handler mounts (${ALLOWLIST.size} grandfathered).`);
  process.exit(0);
}

process.exit(1);
