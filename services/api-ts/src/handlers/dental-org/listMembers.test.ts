/**
 * listMembers handler tests
 *
 * Path: GET /dental/org/members?branchId=...
 * Tests: 401 unauthenticated, 400 missing branchId, 200 returns items array.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { listMembers } from './listMembers';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const ORG_ID    = 'a3000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b3000000-0000-1000-8000-000000000001';
const PERSON_ID = 'c3000000-0000-1000-8000-000000000001';

const authedUser = { id: PERSON_ID, email: 'owner@clinic.com' };

function buildTestApp(user?: typeof authedUser) {
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

  app.get('/dental/org/members', listMembers);

  return app;
}

async function seedAll() {
  const orgRepo = new OrganizationRepository(db);
  await orgRepo.createOne({
    id: ORG_ID,
    name: 'Test Clinic',
    tier: 'solo',
    ownerPersonId: PERSON_ID,
    countryCode: 'PH',
    active: true,
  });
  const branchRepo = new BranchRepository(db);
  await branchRepo.createOne({
    id: BRANCH_ID,
    organizationId: ORG_ID,
    name: 'Main Branch',
    timezone: 'Asia/Manila',
    active: true,
  });
  const membershipRepo = new MembershipRepository(db);
  // Seed membership for authedUser so assertBranchAccess passes
  await membershipRepo.createOne({
    branchId: BRANCH_ID,
    personId: PERSON_ID,
    displayName: 'Owner',
    role: 'dentist_owner',
    status: 'active',
  });
  return membershipRepo;
}

describe('listMembers handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`);

    expect(res.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Validation errors
  // --------------------------------------------------------------------------

  test('returns 400 when branchId query param is missing', async () => {
    await seedAll();
    const app = buildTestApp(authedUser);

    const res = await app.request('/dental/org/members');

    expect(res.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // Success
  // --------------------------------------------------------------------------

  test('returns 200 with empty items array when no members exist', async () => {
    await seedAll(); // seedAll seeds 1 owner membership for auth; expect 1 total
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    // Owner membership seeded for assertBranchAccess — count is 1
    expect(body.pagination.totalCount).toBe(1);
  });

  test('returns 200 with members array and strips pinHash', async () => {
    const membershipRepo = await seedAll();
    await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Staff Alice',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Staff Bob',
      role: 'staff_scheduling',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    // seedAll seeds 1 owner membership for auth + 2 staff = 3 total
    expect(body.data.length).toBe(3);
    expect(body.pagination.totalCount).toBe(3);
    // PIN hash must not be returned
    for (const item of body.data) {
      expect(item.pinHash).toBeUndefined();
    }
  });

  test('excludes inactive members by default', async () => {
    const membershipRepo = await seedAll();
    await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Active Staff',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Inactive Staff',
      role: 'staff_scheduling',
      status: 'inactive',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // seedAll seeds 1 owner (active) + 1 Active Staff (active) = 2; Inactive excluded
    expect(body.data.length).toBe(2);
    const names = body.data.map((m: any) => m.displayName);
    expect(names).toContain('Active Staff');
    expect(names).not.toContain('Inactive Staff');
  });
});
