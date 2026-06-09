/**
 * dental-patient-sync-isolation.test.ts — G1 (P0) cross-tenant sync-log leak
 *
 * Regression pins for the master-gap-matrix Batch 1 dental-patient G1 fix:
 *   - listSyncLogs MUST be scoped to a branch the caller has access to.
 *   - A user reads ONLY their own branch's sync logs, never another org's.
 *   - listSyncLogs without a branchId is rejected (no implicit all-tenant read).
 *   - createSyncLog without a branchId is rejected (no branchless authz bypass).
 *   - SyncLogRepository.findAll(scope) filters by branch.
 *
 * Two-org fixture (the prior dental-patient-sync.test.ts is single-org and
 * therefore could not catch the leak).
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  SyncLogIdParams,
  CreateSyncLogBody,
  UpdateSyncLogBody,
} from './utils/sync-log-validators';
import { createSyncLog } from './sync/createSyncLog';
import { listSyncLogs } from './sync/listSyncLogs';
import { updateSyncLog } from './sync/updateSyncLog';
import { SyncLogRepository } from './repos/sync-log.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// --- Org A ---
const USER_A = { id: 'a0000000-0000-1000-8000-0000000000a1', email: 'a@clinic.com' };
const BRANCH_A = 'b0000000-0000-1000-8000-0000000000a1';
const ORG_A = 'c0000000-0000-1000-8000-0000000000a1';
// --- Org B (separate tenant) ---
const USER_B = { id: 'a0000000-0000-1000-8000-0000000000b2', email: 'b@clinic.com' };
const BRANCH_B = 'b0000000-0000-1000-8000-0000000000b2';
const ORG_B = 'c0000000-0000-1000-8000-0000000000b2';

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { dentalSyncLogs } = await import('./repos/sync-log.schema');

  // Org A
  await db.insert(dentalOrganizations).values({
    id: ORG_A, name: 'Clinic A', tier: 'solo', ownerPersonId: USER_A.id, countryCode: 'PH',
    createdBy: USER_A.id, updatedBy: USER_A.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_A, organizationId: ORG_A, name: 'Branch A', timezone: 'Asia/Manila',
    createdBy: USER_A.id, updatedBy: USER_A.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-0000000000a1', branchId: BRANCH_A, personId: USER_A.id,
    displayName: 'User A', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: USER_A.id, updatedBy: USER_A.id,
  }).onConflictDoNothing();

  // Org B
  await db.insert(dentalOrganizations).values({
    id: ORG_B, name: 'Clinic B', tier: 'solo', ownerPersonId: USER_B.id, countryCode: 'PH',
    createdBy: USER_B.id, updatedBy: USER_B.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_B, organizationId: ORG_B, name: 'Branch B', timezone: 'Asia/Manila',
    createdBy: USER_B.id, updatedBy: USER_B.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-0000000000b2', branchId: BRANCH_B, personId: USER_B.id,
    displayName: 'User B', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: USER_B.id, updatedBy: USER_B.id,
  }).onConflictDoNothing();

  // Seed one sync log in each branch.
  await db.insert(dentalSyncLogs).values([
    {
      localId: 'a-local-1', entityType: 'dental_recall', entityId: 'aaaa0000-0000-1000-8000-0000000000a1',
      branchId: BRANCH_A, syncStatus: 'pending', createdBy: USER_A.id, updatedBy: USER_A.id,
    },
    {
      localId: 'b-local-1', entityType: 'dental_recall', entityId: 'bbbb0000-0000-1000-8000-0000000000b2',
      branchId: BRANCH_B, syncStatus: 'pending', createdBy: USER_B.id, updatedBy: USER_B.id,
    },
  ]).onConflictDoNothing();
});

function buildTestApp(user?: typeof USER_A) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) ctx.set('user', user);
    await next();
  });
  app.post('/dental/sync-logs', zValidator('json', CreateSyncLogBody, ve), createSyncLog as any);
  app.get('/dental/sync-logs', listSyncLogs as any);
  app.patch('/dental/sync-logs/:logId', zValidator('param', SyncLogIdParams, ve), zValidator('json', UpdateSyncLogBody, ve), updateSyncLog as any);
  return app;
}

describe('G1: listSyncLogs cross-tenant isolation', () => {
  test('User A sees only Branch A sync logs (0 of Branch B)', async () => {
    const app = buildTestApp(USER_A);
    const res = await app.request(`/dental/sync-logs?branchId=${BRANCH_A}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body.every((l) => l.branchId === BRANCH_A)).toBe(true);
    expect(body.some((l) => l.branchId === BRANCH_B)).toBe(false);
  });

  test("User A cannot read another org's branch (403)", async () => {
    const app = buildTestApp(USER_A);
    const res = await app.request(`/dental/sync-logs?branchId=${BRANCH_B}`);
    expect(res.status).toBe(403);
  });

  test('listSyncLogs without branchId is rejected (400) — no implicit all-tenant read', async () => {
    const app = buildTestApp(USER_A);
    const res = await app.request('/dental/sync-logs');
    expect(res.status).toBe(400);
  });

  test('User B sees only Branch B sync logs (0 of Branch A)', async () => {
    const app = buildTestApp(USER_B);
    const res = await app.request(`/dental/sync-logs?branchId=${BRANCH_B}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.length).toBe(1);
    expect(body.every((l) => l.branchId === BRANCH_B)).toBe(true);
  });
});

describe('G1: createSyncLog requires branchId (no branchless authz bypass)', () => {
  test('createSyncLog without branchId is rejected (400)', async () => {
    const app = buildTestApp(USER_A);
    const res = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: 'no-branch', entityType: 'dental_recall', entityId: 'cccc0000-0000-1000-8000-0000000000a1' }),
    });
    expect(res.status).toBe(400);
  });

  test('createSyncLog to a branch the caller lacks access to is rejected (403)', async () => {
    const app = buildTestApp(USER_A);
    const res = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: 'x-branch', entityType: 'dental_recall', entityId: 'cccc0000-0000-1000-8000-0000000000a2', branchId: BRANCH_B }),
    });
    expect(res.status).toBe(403);
  });
});

describe('G1: SyncLogRepository.findAll(scope) filters by branch', () => {
  test('findAll([BRANCH_A]) returns only Branch A rows', async () => {
    const repo = new SyncLogRepository(db);
    const rows = await repo.findAll([BRANCH_A]);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.branchId === BRANCH_A)).toBe(true);
  });

  test('findAll([]) returns nothing (no scope → no rows)', async () => {
    const repo = new SyncLogRepository(db);
    const rows = await repo.findAll([]);
    expect(rows.length).toBe(0);
  });
});
