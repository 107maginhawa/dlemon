import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { getBranchesByUser } from './getBranchesByUser';

const DB_URL = 'postgres://postgres:password@localhost:5432/monobase';
const db = createDatabase({ url: DB_URL });

// ff-prefix namespace — no collision with ee (perio), dd (module6), etc.
const USER_A      = { id: 'ff000000-0000-1000-8000-000000000001', email: 'a@test.com' };
const USER_B      = { id: 'ff000000-0000-1000-8000-000000000002', email: 'b@test.com' };
const ORG_ID      = 'ff000000-0000-1000-8000-000000000010';
const BRANCH_A    = 'ff000000-0000-1000-8000-000000000011';
const BRANCH_B    = 'ff000000-0000-1000-8000-000000000012';
const MEMBER_A1   = 'ff000000-0000-1000-8000-000000000020';
const MEMBER_A2   = 'ff000000-0000-1000-8000-000000000021';
const MEMBER_A_INACTIVE = 'ff000000-0000-1000-8000-000000000022';

function buildApp(user?: { id: string; email: string }) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    (c as any).set('database', db);
    if (user) (c as any).set('user', user);
    await next();
  });
  app.get('/dental/branches', getBranchesByUser as any);
  return app;
}

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'GetBranches Clinic', tier: 'solo',
    ownerPersonId: USER_A.id, countryCode: 'PH',
    createdBy: USER_A.id, updatedBy: USER_A.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values([
    { id: BRANCH_A, organizationId: ORG_ID, name: 'Branch A', timezone: 'Asia/Manila', createdBy: USER_A.id, updatedBy: USER_A.id },
    { id: BRANCH_B, organizationId: ORG_ID, name: 'Branch B', timezone: 'Asia/Manila', createdBy: USER_A.id, updatedBy: USER_A.id },
  ]).onConflictDoNothing();

  await db.insert(dentalMemberships).values([
    // USER_A has active memberships in both branches
    { id: MEMBER_A1, branchId: BRANCH_A, personId: USER_A.id, displayName: 'Dr A', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER_A.id, updatedBy: USER_A.id },
    { id: MEMBER_A2, branchId: BRANCH_B, personId: USER_A.id, displayName: 'Dr A2', role: 'dentist_associate', status: 'active', pinFailedAttempts: 0, createdBy: USER_A.id, updatedBy: USER_A.id },
    // Inactive membership for USER_A — must NOT appear in results
    { id: MEMBER_A_INACTIVE, branchId: BRANCH_A, personId: USER_B.id, displayName: 'Inactive', role: 'staff_scheduling', status: 'inactive', pinFailedAttempts: 0, createdBy: USER_A.id, updatedBy: USER_A.id },
  ]).onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(dentalMemberships).execute().catch(() => {});
  await db.delete(dentalBranches).execute().catch(() => {});
  await db.delete(dentalOrganizations).execute().catch(() => {});
});

describe('GET /dental/branches', () => {
  test('returns 401 when no user in context', async () => {
    const app = buildApp();
    const res = await app.request('/dental/branches');
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty list when user has no active membership', async () => {
    const ghost = { id: 'ff000000-0000-1000-8000-000000000099', email: 'ghost@test.com' };
    const app = buildApp(ghost);
    const res = await app.request('/dental/branches');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  test('returns all active-membership branches for the user', async () => {
    const app = buildApp(USER_A);
    const res = await app.request('/dental/branches');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total).toBe(2);
    const ids = body.items.map((b: any) => b.id).sort();
    expect(ids).toEqual([BRANCH_A, BRANCH_B].sort());
  });

  test('inactive memberships are excluded', async () => {
    const app = buildApp(USER_B);
    const res = await app.request('/dental/branches');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total).toBe(0);
    expect(body.items).toEqual([]);
  });
});
