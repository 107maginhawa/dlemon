/**
 * getRetentionStatus handler tests (FR8.14 — retention enforcement read API).
 *
 * Proves the admin-only HTTP read surfaces the audit-derived enforcement status
 * (the `summarizeRetentionEnforcement` logic is unit-tested in retention-status.test.ts;
 * here we pin auth + wiring + the wire shape). RED before the handler is implemented.
 *
 * AC-RET-001..006: this is the read surface over retention enforcement state; the
 * enforcement-status API is platform-admin-only — a non-admin caller → 403 (the
 * engine-level enforcement invariants themselves are asserted in retention-engine.test.ts).
 */
import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';
import { GetRetentionStatusQuery } from '@/generated/openapi/validators';
import { getRetentionStatus } from './getRetentionStatus';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ADMIN = { id: 'a3000000-0000-4000-8000-000000000a01', email: 'admin@clinic.com', role: 'admin' };
const NON_ADMIN = { id: 'a3000000-0000-4000-8000-000000000a02', email: 'staff@clinic.com', role: 'user' };
const TENANT = 'aa000000-0000-4000-8000-0000000000c1';
const ACTOR = '00000000-0000-4000-8000-0000000000d7';

function makeApp(user?: typeof ADMIN) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session', userId: user.id });
    }
    await next();
  });
  app.get('/dental/retention-status', zValidator('query', GetRetentionStatusQuery), getRetentionStatus as any);
  return app;
}

async function seedRun(
  action: 'retention.dry_run' | 'retention.enforced',
  at: Date,
  meta: Record<string, unknown>,
  tenantId = TENANT,
) {
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

describe('getRetentionStatus handler (FR8.14)', () => {
  test('returns 401 when unauthenticated', async () => {
    const res = await makeApp(undefined).request('/dental/retention-status');
    expect(res.status).toBe(401);
  });

  test('AC-RET-001..006: returns 403 when caller is not an admin (enforcement-status read is admin-only)', async () => {
    const res = await makeApp(NON_ADMIN).request('/dental/retention-status');
    expect(res.status).toBe(403);
  });

  test('returns 200 with the never-run status for an admin', async () => {
    const res = await makeApp(ADMIN).request(`/dental/retention-status?tenantId=${TENANT}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.enforcementEnabled).toBe(false);
    expect(body.lastRunAt).toBeNull();
    expect(body.lastRunMode).toBeNull();
    expect(body.runsObserved).toBe(0);
    expect(body.lastActionedCount).toBe(0);
    expect(body.lastEligibleCount).toBe(0);
  });

  test('returns 200 reflecting the most recent enforced run for an admin', async () => {
    await seedRun('retention.dry_run', new Date('2026-06-01T03:30:00.000Z'), { eligibleCount: 5, actionedCount: 0 });
    await seedRun('retention.enforced', new Date('2026-06-09T03:30:00.000Z'), { eligibleCount: 5, actionedCount: 5 });

    const res = await makeApp(ADMIN).request(`/dental/retention-status?tenantId=${TENANT}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.lastRunMode).toBe('enforced');
    expect(body.lastRunAt).toBe('2026-06-09T03:30:00.000Z');
    expect(body.lastActionedCount).toBe(5);
    expect(body.runsObserved).toBe(2);
  });
});
