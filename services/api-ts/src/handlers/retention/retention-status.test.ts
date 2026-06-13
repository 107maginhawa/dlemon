/**
 * retention-status.test.ts — retention enforcement observability (G2).
 *
 * Pins that the operator-facing status summary is DERIVED FROM the audit trail:
 * the most recent retention run's mode + counts, the live/dry-run env posture,
 * and the never-run case. RED before retention-status.ts existed.
 */
import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';
import { summarizeRetentionEnforcement } from './retention-status';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TENANT = 'aa000000-0000-4000-8000-0000000000a1';
const OTHER_TENANT = 'aa000000-0000-4000-8000-0000000000a2';
const ACTOR = '00000000-0000-4000-8000-0000000000d6';

async function seedRun(action: 'retention.dry_run' | 'retention.enforced', at: Date, meta: Record<string, unknown>, tenantId = TENANT) {
  await db.insert(dentalAuditLog).values({
    tenantId,
    actorId: ACTOR,
    action,
    targetType: 'retention_policy',
    eventType: 'compliance',
    timestamp: at,
    metadata: meta,
  });
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
  delete process.env['RETENTION_ENFORCEMENT_ENABLED'];
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`).catch(() => {});
  delete process.env['RETENTION_ENFORCEMENT_ENABLED'];
});

describe('summarizeRetentionEnforcement (G2 observability)', () => {
  test('never-run: null last run, env posture reflected (dry-run by default)', async () => {
    const status = await summarizeRetentionEnforcement(db, TENANT);
    expect(status.lastRunAt).toBeNull();
    expect(status.lastRunMode).toBeNull();
    expect(status.runsObserved).toBe(0);
    expect(status.enforcementEnabled).toBe(false);
  });

  test('reflects the most recent run event (dry-run) and its counts', async () => {
    await seedRun('retention.dry_run', new Date('2026-06-01T03:30:00.000Z'), { eligibleCount: 7, actionedCount: 0 });
    await seedRun('retention.dry_run', new Date('2026-06-08T03:30:00.000Z'), { eligibleCount: 9, actionedCount: 0 });

    const status = await summarizeRetentionEnforcement(db, TENANT);
    expect(status.lastRunMode).toBe('dry-run');
    expect(status.lastRunAt).toBe('2026-06-08T03:30:00.000Z');
    expect(status.runsObserved).toBe(2);
    expect(status.lastEligibleCount).toBe(9);
    expect(status.lastActionedCount).toBe(0);
  });

  test('latest enforced run surfaces as live mode with actioned count', async () => {
    await seedRun('retention.dry_run', new Date('2026-06-01T03:30:00.000Z'), { eligibleCount: 5, actionedCount: 0 });
    await seedRun('retention.enforced', new Date('2026-06-09T03:30:00.000Z'), { eligibleCount: 5, actionedCount: 5 });

    const status = await summarizeRetentionEnforcement(db, TENANT);
    expect(status.lastRunMode).toBe('enforced');
    expect(status.lastRunAt).toBe('2026-06-09T03:30:00.000Z');
    expect(status.lastActionedCount).toBe(5);
  });

  test('enforcementEnabled reflects RETENTION_ENFORCEMENT_ENABLED=true', async () => {
    process.env['RETENTION_ENFORCEMENT_ENABLED'] = 'true';
    const status = await summarizeRetentionEnforcement(db, TENANT);
    expect(status.enforcementEnabled).toBe(true);
  });

  test('tenant-scoped: another tenant\'s runs are excluded', async () => {
    await seedRun('retention.enforced', new Date('2026-06-09T03:30:00.000Z'), { eligibleCount: 3, actionedCount: 3 }, OTHER_TENANT);
    const status = await summarizeRetentionEnforcement(db, TENANT);
    expect(status.runsObserved).toBe(0);
    expect(status.lastRunAt).toBeNull();
  });
});
