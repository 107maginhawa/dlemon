/**
 * Legal-hold HTTP route tests — real route + zValidator + handler wiring.
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

  test('place → list → release lifecycle (admin)', async () => {
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

  test('non-admin forbidden (403)', async () => {
    const app = makeApp(db, STAFF);
    const res = await app.request('/dental/legal-holds', J(holdBody));
    expect(res.status).toBe(403);
  });

  test('missing name → 400', async () => {
    const app = makeApp(db, ADMIN);
    const res = await app.request('/dental/legal-holds', J({ tenantId: TENANT, subjectPersonId: PERSON, reason: 'x' }));
    expect(res.status).toBe(400);
  });
});
