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
 * These predate the shared harness. Shrink this list as files migrate to
 * `buildTestApp`; never add to it — new raw mounts must use the harness.
 */
const ALLOWLIST: ReadonlySet<string> = new Set([
  'src/core/health.test.ts',
  'src/handlers/billing/createInvoice.test.ts',
  'src/handlers/billing/finalizeInvoice.notif.test.ts',
  'src/handlers/billing/getInvoice.test.ts',
  'src/handlers/billing/handleStripeWebhook.test.ts',
  'src/handlers/billing/payInvoice.test.ts',
  'src/handlers/booking/booking-coverage.test.ts',
  'src/handlers/booking/confirmBooking.test.ts',
  'src/handlers/booking/createBooking.test.ts',
  'src/handlers/comms/joinVideoCall.test.ts',
  'src/handlers/dental-audit/getAuditEvents.test.ts',
  'src/handlers/dental-billing/dental-billing.invoice-lifecycle.test.ts',
  'src/handlers/dental-billing/dental-billing.patient-balance-coherence.test.ts',
  'src/handlers/dental-imaging/ceph-calibration-record.test.ts',
  'src/handlers/dental-imaging/ceph-revision-lineage.test.ts',
  'src/handlers/dental-imaging/ceph-signoff-split.test.ts',
  'src/handlers/dental-imaging/dental-imaging-events.test.ts',
  'src/handlers/dental-imaging/imaging-integration.test.ts',
  'src/handlers/dental-imaging/imaging-links.test.ts',
  'src/handlers/dental-imaging/imaging-metadata.test.ts',
  'src/handlers/dental-org/activateOrganization.test.ts',
  // createMember.test.ts + deactivateMember.test.ts + updateMember.test.ts migrated to buildTestApp (ratchet tightened).
  'src/handlers/dental-org/dental-org-events.test.ts',
  'src/handlers/dental-org/dental-org.clinic-settings.test.ts',
  'src/handlers/dental-org/dental-org.dashboard-summary-extended.test.ts',
  'src/handlers/dental-org/dental-org.fee-schedule.test.ts',
  'src/handlers/dental-org/dental-org.pin-recovery.test.ts',
  // getBranchesByUser.test.ts + getOrgContext.test.ts + listMembers.test.ts + permissions.test.ts migrated to buildTestApp (ratchet tightened).
  // org-member-role-active.test.ts migrated to buildTestApp (ratchet tightened).
  'src/handlers/dental-org/resetMemberPin.test.ts',
  'src/handlers/dental-patient/dental-patient.bulk-import.test.ts',
  'src/handlers/dental-portal/dental-portal.test.ts',
  'src/handlers/dental-visit/dental-visit.cross-tenant-rbac.test.ts',
  'src/handlers/dental-visit/dental-visit.treatment-plan-versioning.test.ts',
  'src/handlers/emr/getConsultation.expand.test.ts',
  'src/handlers/notifs/markNotificationAsRead.test.ts',
  'src/handlers/person/createPerson.test.ts',
  'src/handlers/provider/getPractitioner.test.ts',
  'src/handlers/reviews/createReview.test.ts',
  'src/handlers/storage/storage-coverage.test.ts',
  'src/handlers/storage/uploadFile.test.ts',
  'src/middleware/auth.test.ts',
  'src/middleware/security.test.ts',
  'src/tests/error-envelope.error-classes.test.ts',
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
