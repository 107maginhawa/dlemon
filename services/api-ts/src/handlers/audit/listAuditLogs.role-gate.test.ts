/**
 * GET /audit/logs role-gate alignment (audit-role-gate-support-vs-compliance).
 *
 * The endpoint has a two-layer AND gate whose role sets DISAGREED:
 *   - route middleware (generated, = TypeSpec source of truth): roles [admin, support]
 *   - handler check (listAuditLogs.ts): roles [admin, compliance]
 * → the only role that could actually read audit logs was `admin`; the
 * spec-required `support` reader was locked out by the handler, and `compliance`
 * was a stale over-grant the handler still honoured (blocked only by the route).
 *
 * These tests run through buildTestApp, which mounts the EXACT generated route
 * table (registerRoutes) so a request traverses the real authMiddleware → handler
 * AND-gate end-to-end — the bespoke makeCtx in listAuditLogs.test.ts bypasses the
 * middleware and cannot see the disagreement.
 */

import { describe, test, expect } from 'bun:test';
import { createDatabase, type DatabaseInstance } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';

const db: DatabaseInstance = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

const userWithRole = (role: string) => ({
  id: '00000000-0000-4000-8000-0000000000a0',
  email: `${role}@audit.test`,
  role,
});

describe('GET /audit/logs role gate aligns to the TypeSpec set {admin, support}', () => {
  test('support (spec-allowed) can read audit logs → 200', async () => {
    const app = buildTestApp({ db, user: userWithRole('support') });
    const res = await app.request('/audit/logs');
    expect(res.status).toBe(200);
  });

  test('admin (spec-allowed superuser) can read audit logs → 200', async () => {
    const app = buildTestApp({ db, user: userWithRole('admin') });
    const res = await app.request('/audit/logs');
    expect(res.status).toBe(200);
  });

  test('compliance (NOT in the spec set) is denied → 403 (gate must not widen)', async () => {
    const app = buildTestApp({ db, user: userWithRole('compliance') });
    const res = await app.request('/audit/logs');
    expect(res.status).toBe(403);
  });

  test('a plain user is denied → 403', async () => {
    const app = buildTestApp({ db, user: userWithRole('user') });
    const res = await app.request('/audit/logs');
    expect(res.status).toBe(403);
  });
});
