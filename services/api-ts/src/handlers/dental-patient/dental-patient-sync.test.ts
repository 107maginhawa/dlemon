/**
 * dental-patient-sync.test.ts — Local-First Sync Metadata Foundation (P0-D)
 *
 * AC-001  POST /dental/sync-logs returns 201 with sync log entry
 * AC-002  GET /dental/sync-logs returns 200 with list (filterable by entityType)
 * AC-003  PATCH /dental/sync-logs/:logId returns 200 — transition syncStatus
 * AC-004  401 without auth
 * AC-005  400 for missing required fields (localId, entityType, entityId)
 * AC-006  syncStatus defaults to 'pending' on create
 * AC-007  localId + entityType + entityId stored and returned
 * BR-001  LF-BR-001: localId must be provided (stable client-assigned ID)
 * BR-002  LF-BR-003: syncStatus transitions: pending→syncing→synced|failed; pending→failed allowed
 * BR-003  LF-BR-004: synced is terminal — cannot transition back
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  SyncLogParams,
  SyncLogIdParams,
  CreateSyncLogBody,
  UpdateSyncLogBody,
} from './utils/sync-log-validators';
import { createSyncLog } from './sync/createSyncLog';
import { listSyncLogs } from './sync/listSyncLogs';
import { updateSyncLog } from './sync/updateSyncLog';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-000000000001', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000044';
const ORG_ID = 'c0000000-0000-1000-8000-000000000044';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Sync Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID,
    name: 'Sync Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: 'a1000000-0000-1000-8000-000000000044',
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Sync User', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

function buildTestApp(user?: typeof TEST_USER) {
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
    if (user) ctx.set('user', user);
    await next();
  });

  app.post(
    '/dental/sync-logs',
    zValidator('json', CreateSyncLogBody, ve),
    createSyncLog as any,
  );
  app.get(
    '/dental/sync-logs',
    listSyncLogs as any,
  );
  app.patch(
    '/dental/sync-logs/:logId',
    zValidator('param', SyncLogIdParams, ve),
    zValidator('json', UpdateSyncLogBody, ve),
    updateSyncLog as any,
  );

  return app;
}

async function truncateSyncLogs() {
  const { dentalSyncLogs } = await import('./repos/sync-log.schema');
  await db.delete(dentalSyncLogs).where(eq(dentalSyncLogs.createdBy, TEST_USER.id));
}

afterEach(async () => {
  await truncateSyncLogs();
});

// =============================================================================
// AC-001: POST creates sync log
// =============================================================================

describe('POST /dental/sync-logs (AC-001, AC-006, AC-007, BR-001)', () => {
  test('AC-001: creates sync log and returns 201', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localId: 'local-abc-123',
        entityType: 'dental_recall',
        entityId: 'd0000000-0000-1000-8000-000000000001',
        branchId: BRANCH_ID,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.localId).toBe('local-abc-123');
    expect(body.entityType).toBe('dental_recall');
    expect(body.entityId).toBe('d0000000-0000-1000-8000-000000000001');
    expect(body.syncStatus).toBe('pending');
    expect(body.serverId).toBeNull();
    expect(body.lastSyncAt).toBeNull();
  });

  test('AC-006: syncStatus defaults to pending', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localId: 'local-def-456',
        entityType: 'dental_treatment_plan',
        entityId: 'd0000000-0000-1000-8000-000000000002',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.syncStatus).toBe('pending');
  });

  test('AC-007: localId + entityType + entityId stored correctly', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localId: 'clinic-tablet-uuid-789',
        entityType: 'dental_patient_contact',
        entityId: 'd0000000-0000-1000-8000-000000000003',
        serverId: 'd0000000-0000-1000-8000-000000000003',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.localId).toBe('clinic-tablet-uuid-789');
    expect(body.entityType).toBe('dental_patient_contact');
    expect(body.serverId).toBe('d0000000-0000-1000-8000-000000000003');
  });
});

// =============================================================================
// AC-002: GET list
// =============================================================================

describe('GET /dental/sync-logs (AC-002)', () => {
  test('AC-002: returns empty array when no logs', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/sync-logs');

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
  });

  test('AC-002: returns created logs', async () => {
    const app = buildTestApp(TEST_USER);

    await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: 'l1', entityType: 'dental_recall', entityId: 'd0000000-0000-1000-8000-000000000001' }),
    });
    await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: 'l2', entityType: 'dental_treatment_plan', entityId: 'd0000000-0000-1000-8000-000000000002' }),
    });

    const res = await app.request('/dental/sync-logs');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// AC-003: PATCH transitions syncStatus
// =============================================================================

describe('PATCH /dental/sync-logs/:logId (AC-003, BR-002, BR-003)', () => {
  test('AC-003: pending → syncing succeeds', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: 'l-patch-1', entityType: 'dental_recall', entityId: 'd0000000-0000-1000-8000-000000000001' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/sync-logs/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncStatus: 'syncing' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.syncStatus).toBe('syncing');
  });

  test('AC-003: syncing → synced succeeds, sets lastSyncAt', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: 'l-patch-2', entityType: 'dental_recall', entityId: 'd0000000-0000-1000-8000-000000000001' }),
    });
    const created = await createRes.json() as any;

    await app.request(`/dental/sync-logs/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncStatus: 'syncing' }),
    });

    const res = await app.request(`/dental/sync-logs/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncStatus: 'synced', serverId: 'srv-abc-123' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.syncStatus).toBe('synced');
    expect(body.lastSyncAt).toBeTruthy();
  });

  test('BR-002: pending → failed is allowed', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: 'l-patch-3', entityType: 'dental_recall', entityId: 'd0000000-0000-1000-8000-000000000001' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/sync-logs/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncStatus: 'failed', error: 'Network timeout' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.syncStatus).toBe('failed');
    expect(body.error).toBe('Network timeout');
  });

  test('BR-003: synced → syncing rejected 422', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: 'l-patch-4', entityType: 'dental_recall', entityId: 'd0000000-0000-1000-8000-000000000001' }),
    });
    const created = await createRes.json() as any;

    await app.request(`/dental/sync-logs/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncStatus: 'syncing' }),
    });
    await app.request(`/dental/sync-logs/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncStatus: 'synced' }),
    });

    const res = await app.request(`/dental/sync-logs/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncStatus: 'syncing' }),
    });
    expect(res.status).toBe(422);
  });
});

// =============================================================================
// AC-004: 401 without auth
// =============================================================================

describe('Auth (AC-004)', () => {
  test('POST returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: 'l1', entityType: 'dental_recall', entityId: 'd0000000-0000-1000-8000-000000000001' }),
    });
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// AC-005: 400 for missing required fields
// =============================================================================

describe('Validation (AC-005)', () => {
  test('AC-005: POST returns 400 when localId missing', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'dental_recall', entityId: 'd0000000-0000-1000-8000-000000000001' }),
    });

    expect(res.status).toBe(400);
  });

  test('AC-005: POST returns 400 when entityType missing', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: 'l1', entityId: 'd0000000-0000-1000-8000-000000000001' }),
    });

    expect(res.status).toBe(400);
  });

  test('AC-005: POST returns 400 when entityId missing', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: 'l1', entityType: 'dental_recall' }),
    });

    expect(res.status).toBe(400);
  });
});

// ── GAP-006: LF-BR-004 stale-write conflict detection ─────────────────────────

describe('GAP-006: LF-BR-004 — stale-write conflict returns 409', () => {
  test('AC-008: PATCH with stale version → 409 with conflictPayload', async () => {
    const app = buildTestApp(TEST_USER);

    // Create sync log (version = 1)
    const createRes = await app.request('/dental/sync-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: 'conflict-test-001', entityType: 'dental_visit', entityId: 'visit-001' }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const logId = created.id;
    expect(created.version).toBe(1);

    // Valid update → version bumps to 2
    const updateRes = await app.request(`/dental/sync-logs/${logId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncStatus: 'syncing' }),
    });
    expect(updateRes.status).toBe(200);

    // Stale push: client still thinks version is 1
    const conflictRes = await app.request(`/dental/sync-logs/${logId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncStatus: 'synced', version: 1 }),
    });
    expect(conflictRes.status).toBe(409);
    const body = await conflictRes.json();
    expect(body.code).toBe('CONFLICT');
    expect(body.conflictPayload.current.version).toBe(2);
    expect(body.conflictPayload.incoming.version).toBe(1);
  });
});
