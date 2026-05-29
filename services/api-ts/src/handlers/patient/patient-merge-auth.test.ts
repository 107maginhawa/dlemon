/**
 * Patient merge/unmerge admin-role guard tests
 *
 * Security finding: OpenAPI declares x-security-required-roles: ["admin"]
 * for POST /patients/merge and POST /patients/unmerge, but the handlers only
 * checked authentication, not the admin role.
 *
 * These tests assert:
 *   - authenticated NON-admin caller → 403 (ForbiddenError) for both routes
 *   - admin caller → passes the guard (reaches the stub: 501 merge / 500 unmerge,
 *     NOT 403)
 *
 * The merge/unmerge business logic is intentionally NOT implemented; we only
 * verify the authorization guard.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { mergePatients } from './mergePatients';
import { unmergePatients } from './unmergePatients';
import {
  MergePatientsBody,
  UnmergePatientsBody,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const SOURCE_ID = 'a0000000-0000-1000-8000-000000000001';
const TARGET_ID = 'a0000000-0000-1000-8000-000000000002';

type TestUser = { id: string; email: string; name: string; role: string };

const nonAdminUser: TestUser = { id: SOURCE_ID, email: 'staff@test.com', name: 'Staff', role: 'user' };
const adminUser: TestUser = { id: SOURCE_ID, email: 'admin@test.com', name: 'Admin', role: 'admin' };

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
  }
};

function buildTestApp(user?: TestUser) {
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
    } else {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }
    return await next();
  });

  app.post(
    '/patients/merge',
    zValidator('json', MergePatientsBody, validationErrorHandler),
    mergePatients as any,
  );
  app.post(
    '/patients/unmerge',
    zValidator('json', UnmergePatientsBody, validationErrorHandler),
    unmergePatients as any,
  );

  return app;
}

const mergeBody = JSON.stringify({
  sourcePatientId: SOURCE_ID,
  targetPatientId: TARGET_ID,
  reason: 'duplicate record',
});
const unmergeBody = JSON.stringify({
  sourcePatientId: SOURCE_ID,
  targetPatientId: TARGET_ID,
  reason: 'undo merge',
});

describe('mergePatients admin guard', () => {
  test('returns 403 for authenticated non-admin caller', async () => {
    const app = buildTestApp(nonAdminUser);
    const res = await app.request('/patients/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: mergeBody,
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('admin caller passes guard and reaches the 501 stub (not 403)', async () => {
    const app = buildTestApp(adminUser);
    const res = await app.request('/patients/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: mergeBody,
    });
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(501);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_IMPLEMENTED');
  });
});

describe('unmergePatients admin guard', () => {
  test('returns 403 for authenticated non-admin caller', async () => {
    const app = buildTestApp(nonAdminUser);
    const res = await app.request('/patients/unmerge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: unmergeBody,
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('admin caller passes guard and reaches the stub (not 403)', async () => {
    const app = buildTestApp(adminUser);
    const res = await app.request('/patients/unmerge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: unmergeBody,
    });
    // unmergePatients is an unimplemented stub that throws → 500, NOT 403.
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(500);
  });
});
