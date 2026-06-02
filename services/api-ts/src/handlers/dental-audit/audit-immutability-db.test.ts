/**
 * V-AUD-IMM-001 (F4): DB-level append-only enforcement on `dental_audit_log`.
 *
 * The HTTP route guards (see audit-append-only.test.ts) reject mutating verbs at
 * the API layer, but a direct SQL UPDATE/DELETE (compromised credential, errant
 * migration, manual psql) bypasses the app entirely. Migration
 * 0080_audit_log_append_only installs a BEFORE UPDATE OR DELETE FOR EACH ROW
 * trigger that RAISEs, so the storage layer itself refuses to rewrite or erase
 * audit history (defense-in-depth).
 *
 * This suite proves, against the real Postgres schema:
 *   - INSERT still succeeds (append is allowed),
 *   - a row-level UPDATE raises,
 *   - a row-level DELETE raises.
 *
 * Reset is via table-level TRUNCATE, which a BEFORE ROW trigger does NOT fire on.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { AuditLogRepository } from './repos/audit-log.repo';

/**
 * Drizzle wraps driver errors as `Failed query: …` and attaches the original
 * Postgres error (carrying the RAISE EXCEPTION text) on `.cause`. Walk the cause
 * chain so the assertion sees the trigger's `append-only` message regardless of
 * how many wrappers sit on top.
 */
function errorChainText(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let i = 0; i < 5 && current; i++) {
    const e = current as { message?: unknown; cause?: unknown };
    if (e.message != null) parts.push(String(e.message));
    current = e.cause;
  }
  return parts.join(' | ');
}

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

const TENANT_ID = 'a4d17001-0000-0000-0000-000000000030';
const BRANCH_ID = 'a4d17001-0000-0000-0000-000000000020';
const ACTOR_ID = 'a4d17001-0000-0000-0000-000000000001';
const TARGET_ID = 'a4d17001-0000-0000-0000-000000000099';

async function seedAuditRow() {
  const repo = new AuditLogRepository(db);
  return repo.insert({
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    actorId: ACTOR_ID,
    eventType: 'data-modification',
    action: 'immutability.probe',
    targetType: 'probe',
    targetId: TARGET_ID,
  });
}

afterEach(async () => {
  // dental_audit_log is append-only: row DELETE is blocked by the trigger, so
  // reset state with a table-level TRUNCATE (not fired by a BEFORE ROW trigger).
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
});

describe('V-AUD-IMM-001 — dental_audit_log DB-level append-only trigger', () => {
  test('INSERT into the audit log succeeds (append is allowed)', async () => {
    const row = await seedAuditRow();
    expect(row.id).toBeTruthy();
    expect(row.action).toBe('immutability.probe');
  });

  test('row-level UPDATE on the audit log is rejected by the DB trigger', async () => {
    const row = await seedAuditRow();
    let raised = false;
    try {
      await db.execute(
        sql`UPDATE dental_audit_log SET action = 'tampered' WHERE id = ${row.id}`,
      );
    } catch (err) {
      raised = true;
      expect(errorChainText(err)).toContain('append-only');
    }
    expect(raised).toBe(true);

    // The original value must be intact — the UPDATE never took effect.
    const after = await db.execute(
      sql`SELECT action FROM dental_audit_log WHERE id = ${row.id}`,
    );
    const rows = (after as unknown as { rows: Array<{ action: string }> }).rows;
    expect(rows[0]?.action).toBe('immutability.probe');
  });

  test('row-level DELETE on the audit log is rejected by the DB trigger', async () => {
    const row = await seedAuditRow();
    let raised = false;
    try {
      await db.execute(sql`DELETE FROM dental_audit_log WHERE id = ${row.id}`);
    } catch (err) {
      raised = true;
      expect(errorChainText(err)).toContain('append-only');
    }
    expect(raised).toBe(true);

    // The row must still be present — the DELETE never took effect.
    const after = await db.execute(
      sql`SELECT id FROM dental_audit_log WHERE id = ${row.id}`,
    );
    const rows = (after as unknown as { rows: Array<{ id: string }> }).rows;
    expect(rows.length).toBe(1);
  });
});
