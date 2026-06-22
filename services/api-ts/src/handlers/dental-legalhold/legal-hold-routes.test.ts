/**
 * Legal-hold HTTP route tests — real route + zValidator + handler wiring.
 *
 * BR coverage (negative paths in-file: 403 non-admin, 400 missing name):
 *   - AC-LH-001..004: place/list/release workflow; created 'active'; release terminal.
 *   - EM-DG-RBAC: place/list/release are platform-admin-only; a non-admin caller → 403.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { openTestTx } from '@/core/test-tx';
import { AppError } from '@/core/errors';
import { placeLegalHoldHandler } from './placeLegalHoldHandler';
import { releaseLegalHoldHandler } from './releaseLegalHoldHandler';
import { listLegalHoldsHandler } from './listLegalHoldsHandler';
import { PlaceLegalHoldBody, LegalHoldIdParams, ListLegalHoldQuery } from './utils/legal-hold-validators';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const TENANT = 'd6000000-0000-4000-8000-000000000001';
const PERSON = 'e6000000-0000-4000-8000-000000000001';
const ADMIN = { id: 'a6000000-0000-4000-8000-000000000001', email: 'admin@clinic.com', role: 'admin' };
const STAFF = { id: 'a6000000-0000-4000-8000-000000000002', email: 'staff@clinic.com', role: 'user' };

const veh = (result: any, c: any) => (!result.success ? c.json({ error: 'Validation failed' }, 400) : undefined);

function makeApp(db: NodePgDatabase, user: { id: string; email: string; role: string }) {
  const app = new Hono();
  app.onError((err, c) => (err instanceof AppError ? c.json({ error: err.message, code: err.code }, err.statusCode as any) : c.json({ error: 'err' }, 500)));
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    ctx.set('user', user);
    await next();
  });
  app.post('/dental/legal-holds', zValidator('json', PlaceLegalHoldBody, veh), placeLegalHoldHandler as any);
  app.get('/dental/legal-holds', zValidator('query', ListLegalHoldQuery, veh), listLegalHoldsHandler as any);
  app.post('/dental/legal-holds/:id/release', zValidator('param', LegalHoldIdParams, veh), releaseLegalHoldHandler as any);
  return app;
}

const J = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const holdBody = { tenantId: TENANT, subjectPersonId: PERSON, name: 'hold', reason: 'litigation' };

describe('legal-hold HTTP routes', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
  });

  afterEach(() => teardown());

  test('AC-LH-001..004: place → list → release lifecycle (admin)', async () => {
    const app = makeApp(db, ADMIN);
    const placed = await app.request('/dental/legal-holds', J(holdBody));
    expect(placed.status).toBe(201);
    const hold = (await placed.json()) as { id: string; status: string };
    expect(hold.status).toBe('active');

    const list = await app.request('/dental/legal-holds');
    expect(list.status).toBe(200);
    expect(((await list.json()) as any[]).length).toBe(1);

    const released = await app.request(`/dental/legal-holds/${hold.id}/release`, J({}));
    expect(released.status).toBe(200);
    expect(((await released.json()) as any).status).toBe('released');
  });

  test('EM-DG-RBAC: non-admin forbidden (403)', async () => {
    const app = makeApp(db, STAFF);
    const res = await app.request('/dental/legal-holds', J(holdBody));
    expect(res.status).toBe(403);
  });

  test('missing name → 400', async () => {
    const app = makeApp(db, ADMIN);
    const res = await app.request('/dental/legal-holds', J({ tenantId: TENANT, subjectPersonId: PERSON, reason: 'x' }));
    expect(res.status).toBe(400);
  });

  // Pins the INTENTIONAL platform-admin global scope: listLegalHolds returns
  // holds across ALL tenants (tenantId is only an optional filter) and release
  // is by-id with no tenant scoping. A future accidental org-filter on list, or
  // a tenant-ownership check on release, would break this — exactly what the
  // backlog gap `legalhold-crosstenant-admin-scope-unpinned` warns about.
  test('cross-tenant admin scope: a platform admin lists + releases holds across DIFFERENT tenants', async () => {
    const TENANT_B = 'd6000000-0000-4000-8000-0000000000b2';
    const PERSON_B = 'e6000000-0000-4000-8000-0000000000b2';
    const app = makeApp(db, ADMIN);

    const a = (await (await app.request('/dental/legal-holds', J(holdBody))).json()) as { id: string };
    const b = (await (await app.request('/dental/legal-holds',
      J({ tenantId: TENANT_B, subjectPersonId: PERSON_B, name: 'hold-b', reason: 'audit' }))).json()) as { id: string };

    // List with NO tenant filter → the admin sees BOTH tenants' holds.
    const list = (await (await app.request('/dental/legal-holds')).json()) as Array<{ id: string }>;
    const ids = new Set(list.map((h) => h.id));
    expect(ids.has(a.id)).toBe(true);
    expect(ids.has(b.id)).toBe(true);

    // The admin can release the OTHER tenant's hold (no tenant-ownership gate).
    const rel = await app.request(`/dental/legal-holds/${b.id}/release`, J({}));
    expect(rel.status).toBe(200);
    expect(((await rel.json()) as { status: string }).status).toBe('released');
  });
});
