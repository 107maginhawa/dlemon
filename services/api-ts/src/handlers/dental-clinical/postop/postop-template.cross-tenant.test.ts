/**
 * dental-clinical postop-template cross-tenant / branch-role pins.
 *
 * createPostopTemplate + updatePostopTemplate ship a handler + SDK with no FE
 * consumer (sensitive mutating orphans). Both gate on assertBranchRole — a
 * caller without a dentist_owner/dentist_associate membership in the target
 * branch must be DENIED (403). This pins that deny path so a refactor can't
 * silently drop it. DB-backed (the guard resolves branch membership).
 *
 * Discharges the two postop entries of endpoint-sensitive-orphan.allowlist.json.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { createPostopTemplate } from './createPostopTemplate';
import { updatePostopTemplate } from './updatePostopTemplate';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

const OWNER_A = { id: 'cc010000-0000-1000-8000-000000000001', email: 'owner-a@test.com' };
const ATTACKER = { id: 'cc020000-0000-1000-8000-000000000002', email: 'attacker@test.com' };
const ORG_A_ID = 'cc010000-0000-1000-8000-000000000010';
const BRANCH_A_ID = 'cc010000-0000-1000-8000-000000000020';
const TEMPLATE_ID = 'cc010000-0000-1000-8000-000000000040';

function veh(result: any, c: any) { if (!result.success) return c.json({ error: 'validation' }, 400); }
function makeErrorHandler() {
  return (err: any, c: any) =>
    err instanceof AppError ? c.json({ error: err.message }, err.statusCode as any) : c.json({ error: String(err?.message) }, 500);
}
function injectDeps(user: { id: string; email: string } | null) {
  return async (c: any, next: any) => {
    c.set('database', db);
    c.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    if (user) c.set('user', user);
    await next();
  };
}
async function seedBranch() {
  await db.insert(dentalOrganizations).values({
    id: ORG_A_ID, name: 'Clinic A', tier: 'solo', ownerPersonId: OWNER_A.id, countryCode: 'PH', active: true,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_A_ID, organizationId: ORG_A_ID, name: 'Main', timezone: 'Asia/Manila', active: true, createdBy: OWNER_A.id, updatedBy: OWNER_A.id,
  }).onConflictDoNothing();
}
async function seedOwnerMembership() {
  await db.insert(dentalMemberships).values({
    id: 'cc010000-0000-1000-8000-000000000030', branchId: BRANCH_A_ID, personId: OWNER_A.id,
    displayName: 'Owner A', role: 'dentist_owner', status: 'active', createdBy: OWNER_A.id, updatedBy: OWNER_A.id,
  }).onConflictDoNothing();
}

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE dental_postop_template, dental_membership, dental_branch, dental_organization RESTART IDENTITY CASCADE
  `);
});

const J = { 'Content-Type': 'application/json' };
const category = z.enum(['extraction', 'implant', 'root_canal', 'filling', 'crown', 'cleaning', 'surgery', 'orthodontic', 'other']);

describe('createPostopTemplate — branch-role gate (cross-tenant deny)', () => {
  function makeApp(user: any) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.post('/dental/branches/:branchId/postop-templates',
      zValidator('param', z.object({ branchId: z.string() }), veh),
      zValidator('json', z.object({ category, title: z.string(), content: z.string() }), veh),
      createPostopTemplate as any);
    return app;
  }
  const body = JSON.stringify({ category: 'other', title: 'Post-op care', content: 'Rinse twice daily.' });
  const url = `/dental/branches/${BRANCH_A_ID}/postop-templates`;

  test('a non-member of the branch cannot create a postop template → 403', async () => {
    await seedBranch();
    const res = await makeApp(ATTACKER).request(url, { method: 'POST', headers: J, body });
    expect(res.status).toBe(403);
  });
  test('a dentist_owner member is allowed past the gate (baseline, not 403)', async () => {
    await seedBranch();
    await seedOwnerMembership();
    const res = await makeApp(OWNER_A).request(url, { method: 'POST', headers: J, body });
    expect(res.status).not.toBe(403);
  });
});

describe('updatePostopTemplate — branch-role gate (cross-tenant deny)', () => {
  function makeApp(user: any) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.patch('/dental/branches/:branchId/postop-templates/:templateId',
      zValidator('param', z.object({ branchId: z.string(), templateId: z.string() }), veh),
      zValidator('json', z.object({ title: z.string().optional(), content: z.string().optional(), active: z.boolean().optional() }), veh),
      updatePostopTemplate as any);
    return app;
  }
  const body = JSON.stringify({ title: 'Updated' });
  const url = `/dental/branches/${BRANCH_A_ID}/postop-templates/${TEMPLATE_ID}`;

  test('a non-member of the branch cannot update a postop template → 403', async () => {
    await seedBranch();
    const res = await makeApp(ATTACKER).request(url, { method: 'PATCH', headers: J, body });
    expect(res.status).toBe(403);
  });
  test('a dentist_owner member is allowed past the gate (baseline, not 403)', async () => {
    await seedBranch();
    await seedOwnerMembership();
    const res = await makeApp(OWNER_A).request(url, { method: 'PATCH', headers: J, body });
    expect(res.status).not.toBe(403);
  });
});
