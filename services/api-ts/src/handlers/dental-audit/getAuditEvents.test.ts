/**
 * getAuditEvents handler tests
 *
 * Path: GET /dental/admin/audit
 * Auth: dentist_owner only.
 *
 * EM-AUD-002: branchId is a REQUIRED query param per AUDIT_CONTRACTS.md §5
 * (branch_id = YES) and rule AC-AUD-003 ("Returns only events for requesting
 * user's branch"). Without it, AuditLogRepository.list applies no branch/tenant
 * condition and returns rows across ALL tenants — a cross-tenant leak. This suite
 * locks the 400 guard so the endpoint can never run unscoped.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { getAuditEvents } from './getAuditEvents';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const OWNER_ID = 'da090001-0000-0000-0000-000000000001';

function buildTestApp(user?: { id: string; role?: string }) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.get('/dental/admin/audit', getAuditEvents);
  return app;
}

describe('getAuditEvents handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/admin/audit');
    expect(res.status).toBe(401);
  });

  test('returns 403 when caller lacks dentist_owner role', async () => {
    const app = buildTestApp({ id: OWNER_ID, role: 'staff_full' });
    const res = await app.request('/dental/admin/audit?branchId=da090001-0000-0000-0000-000000000020');
    expect(res.status).toBe(403);
  });

  // --------------------------------------------------------------------------
  // EM-AUD-002: branchId is required (prevents cross-tenant leak)
  // --------------------------------------------------------------------------
  test('EM-AUD-002: returns 400 when branchId is omitted', async () => {
    const app = buildTestApp({ id: OWNER_ID, role: 'dentist_owner' });
    const res = await app.request('/dental/admin/audit');
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});
