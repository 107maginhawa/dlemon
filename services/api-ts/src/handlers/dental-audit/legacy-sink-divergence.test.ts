/**
 * FIX-004 (dental-audit Batch C) — legacy dual-write divergence canary.
 *
 * `logAuditEvent` (core/audit-logger.ts) dual-writes EVERY event to two sinks,
 * inline/synchronously (ADR-005):
 *   1. dental_audit_log  — the authoritative, spec-compliant table the viewer
 *      (getAuditEvents) reads. Written FIRST; fail-closed for security/opt-in.
 *   2. dental_audit      — the legacy table, kept for existing wiring. Written
 *      SECOND and FIRE-AND-FORGET: its failure is logged and swallowed.
 *
 * Because the legacy write is fire-and-forget, it can silently drop while the
 * authoritative write succeeds — and nothing today would notice. Q3 (legacy
 * sunset) needs to know whether the two sinks actually stay in lockstep before
 * anyone removes the dual-write. This canary is that baseline: after N mixed
 * `logAuditEvent` calls, the two tables must hold the SAME rows (count + per
 * action). It fails loudly the day the legacy write starts diverging.
 *
 * Scope (per fix-ready plan §11): this is a READ-ONLY observation of the existing
 * dual-write. It must NOT change `logAuditEvent` (98 callers, frozen). It covers
 * sinks #1/#2 only — the base `handlers/audit/` retention sink (#3) is documented
 * in MODULE_SPEC "Sink boundary", not dual-written here.
 *
 * Harness: run via `scripts/test-with-db.ts` (real Postgres, per-file clone) —
 * same pattern as audit-immutability-db.test.ts. logAuditEvent uses its own repos
 * (not openTestTx-friendly), so this drives the real DB and TRUNCATEs to reset.
 */

import { describe, test, expect, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { logAuditEvent, type AuditEvent } from '@/core/audit-logger';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// Unique tenant for this canary so the counts are isolated from any other rows
// in the (cloned) DB — the assertions never depend on a pristine table.
const TENANT_ID = 'a4d17001-0000-0000-0000-0000000000c4';
const BRANCH_ID = 'a4d17001-0000-0000-0000-0000000000b4';
const ACTOR_ID = 'a4d17001-0000-0000-0000-0000000000a4';
const TARGET_ID = 'a4d17001-0000-0000-0000-0000000000d4';

/**
 * Mixed event types — exercises every classification through the SAME dual-write
 * path (the legacy write is type-agnostic). Includes a 'security' event: in the
 * happy path its fail-closed authoritative write succeeds, so the legacy write
 * still runs and parity holds.
 */
const EVENTS: Array<Pick<AuditEvent, 'eventType' | 'action'>> = [
  { eventType: 'data-modification', action: 'invoice.voided' },
  { eventType: 'data-access', action: 'patient.viewed' },
  { eventType: 'compliance', action: 'consent.signed' },
  { eventType: 'system-config', action: 'fee_schedule.updated' },
  { eventType: 'authentication', action: 'session.started' },
  { eventType: 'security', action: 'role.changed' },
];

async function countByTenant(table: 'dental_audit_log' | 'dental_audit'): Promise<number> {
  const ident = table === 'dental_audit_log' ? sql`dental_audit_log` : sql`dental_audit`;
  const res = await db.execute(
    sql`SELECT count(*)::int AS n FROM ${ident} WHERE tenant_id = ${TENANT_ID}`,
  );
  const rows = (res as unknown as { rows: Array<{ n: number }> }).rows;
  return Number(rows[0]?.n ?? 0);
}

async function actionCountsByTenant(
  table: 'dental_audit_log' | 'dental_audit',
): Promise<Record<string, number>> {
  const ident = table === 'dental_audit_log' ? sql`dental_audit_log` : sql`dental_audit`;
  const res = await db.execute(
    sql`SELECT action, count(*)::int AS n FROM ${ident} WHERE tenant_id = ${TENANT_ID} GROUP BY action`,
  );
  const rows = (res as unknown as { rows: Array<{ action: string; n: number }> }).rows;
  return Object.fromEntries(rows.map((r) => [r.action, Number(r.n)]));
}

afterAll(async () => {
  // Both audit tables are append-only at the row level (dental_audit_log has a
  // BEFORE DELETE trigger), so reset with table-level TRUNCATE, not DELETE.
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
  await db.execute(sql`TRUNCATE TABLE dental_audit`);
});

describe('FIX-004 — legacy dual-write divergence canary (dental_audit_log vs dental_audit)', () => {
  test('every logAuditEvent dual-writes both sinks in lockstep (count + per action)', async () => {
    for (const e of EVENTS) {
      await logAuditEvent(db, null, {
        personId: ACTOR_ID,
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        eventType: e.eventType,
        actorRole: 'dentist_owner',
        action: e.action,
        resourceType: 'canary_target',
        resourceId: TARGET_ID,
        reason: 'divergence-canary',
        metadata: { canary: true },
      });
    }

    const authoritative = await countByTenant('dental_audit_log');
    const legacy = await countByTenant('dental_audit');

    // Each call writes exactly one row to each sink — no more, no less.
    expect(authoritative).toBe(EVENTS.length);
    // The load-bearing assertion: the fire-and-forget legacy write did NOT
    // silently drop. If it ever does, legacy < authoritative and this fails.
    expect(legacy).toBe(authoritative);

    // Stronger than a bare count: the SAME actions landed in both sinks. Catches
    // a divergence that happens to preserve the total but mis-routes a row.
    const authoritativeByAction = await actionCountsByTenant('dental_audit_log');
    const legacyByAction = await actionCountsByTenant('dental_audit');
    expect(legacyByAction).toEqual(authoritativeByAction);
  });
});
