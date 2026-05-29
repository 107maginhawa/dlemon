/**
 * DentalBranchManagement_list handler tests
 *
 * Path: GET /dental/organizations/:orgId/branches
 * Tests: 401 unauthenticated, 403 non-member non-owner, 404 missing org,
 *        200 for owner, 200 for branch member, cross-org isolation.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { DentalBranchManagement_list } from './DentalBranchManagement_list';
import { DentalBranchManagement_listParams } from '@/generated/openapi/validators';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// UUID namespace: e4-prefix — no collision with other test files
const OWNER_ID   = 'e4000000-0000-1000-8000-000000000001';
const MEMBER_ID  = 'e4000000-0000-1000-8000-000000000002';
const STRANGER_ID = 'e4000000-0000-1000-8000-000000000003';
const ORG_ID     = 'e4000000-0000-1000-8000-000000000010';
const ORG2_ID    = 'e4000000-0000-1000-8000-000000000011';
const BRANCH_ID  = 'e4000000-0000-1000-8000-000000000020';

const ownerUser   = { id: OWNER_ID,    email: 'owner@clinic.com' };
const memberUser  = { id: MEMBER_ID,   email: 'member@clinic.com' };
const strangerUser = { id: STRANGER_ID, email: 'stranger@clinic.com' };

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed' }, 400);
};

function buildTestApp(user?: { id: string; email: string }) {
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

  app.get(
    '/dental/organizations/:orgId/branches',
    zValidator('param', DentalBranchManagement_listParams, validationErrorHandler),
    DentalBranchManagement_list as any,
  );

  return app;
}

async function seedOrgWithBranch() {
  const orgRepo = new OrganizationRepository(db);
  await orgRepo.createOne({
    id: ORG_ID,
    name: 'Test Clinic',
    tier: 'clinic',
    ownerPersonId: OWNER_ID,
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
}

async function seedMembership(personId: string, role: string = 'staff_full') {
  const membershipRepo = new MembershipRepository(db);
  await membershipRepo.createOne({
    branchId: BRANCH_ID,
    personId,
    displayName: `Member ${personId.slice(-4)}`,
    role: role as any,
    status: 'active',
  });
}

describe('DentalBranchManagement_list handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  test('returns 401 when user is not authenticated', async () => {
    await seedOrgWithBranch();
    const app = buildTestApp(undefined);

    const res = await app.request(`/dental/organizations/${ORG_ID}/branches`);
    expect(res.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Not found
  // --------------------------------------------------------------------------

  test('returns 404 when org does not exist', async () => {
    const app = buildTestApp(ownerUser);
    const nonexistentOrgId = 'e4000000-0000-1000-8000-000000000099';

    const res = await app.request(`/dental/organizations/${nonexistentOrgId}/branches`);
    expect(res.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // Authorization
  // --------------------------------------------------------------------------

  test('returns 403 when caller has no membership and is not the owner', async () => {
    await seedOrgWithBranch();
    const app = buildTestApp(strangerUser);

    const res = await app.request(`/dental/organizations/${ORG_ID}/branches`);
    expect(res.status).toBe(403);
  });

  test('returns 403 when caller has inactive membership only', async () => {
    await seedOrgWithBranch();
    const membershipRepo = new MembershipRepository(db);
    await membershipRepo.createOne({
      branchId: BRANCH_ID,
      personId: STRANGER_ID,
      displayName: 'Ex-Staff',
      role: 'staff_full',
      status: 'inactive',
    });
    const app = buildTestApp(strangerUser);

    const res = await app.request(`/dental/organizations/${ORG_ID}/branches`);
    expect(res.status).toBe(403);
  });

  // --------------------------------------------------------------------------
  // Success — owner
  // --------------------------------------------------------------------------

  test('returns 200 with branch list when caller is org owner', async () => {
    await seedOrgWithBranch();
    const app = buildTestApp(ownerUser);

    const res = await app.request(`/dental/organizations/${ORG_ID}/branches`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(BRANCH_ID);
    expect(body.items[0].organizationId).toBe(ORG_ID);
  });

  // --------------------------------------------------------------------------
  // Success — branch member (EF-ORG-002)
  // --------------------------------------------------------------------------

  test('returns 200 when caller is an active branch member (EF-ORG-002)', async () => {
    await seedOrgWithBranch();
    await seedMembership(MEMBER_ID, 'staff_full');
    const app = buildTestApp(memberUser);

    const res = await app.request(`/dental/organizations/${ORG_ID}/branches`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total).toBe(1);
    expect(body.items[0].id).toBe(BRANCH_ID);
  });

  // --------------------------------------------------------------------------
  // Cross-org isolation
  // --------------------------------------------------------------------------

  test('only returns branches belonging to the requested org', async () => {
    await seedOrgWithBranch();

    // Seed a second org with its own branch
    const orgRepo = new OrganizationRepository(db);
    await orgRepo.createOne({
      id: ORG2_ID,
      name: 'Second Clinic',
      tier: 'solo',
      ownerPersonId: OWNER_ID,
      countryCode: 'PH',
      active: true,
    });
    const branchRepo = new BranchRepository(db);
    await branchRepo.createOne({
      organizationId: ORG2_ID,
      name: 'Org2 Branch',
      timezone: 'Asia/Manila',
      active: true,
    });

    const app = buildTestApp(ownerUser);

    // List branches for ORG_ID — should return only 1 (not org2's branch)
    const res = await app.request(`/dental/organizations/${ORG_ID}/branches`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total).toBe(1);
    expect(body.items.every((b: any) => b.organizationId === ORG_ID)).toBe(true);
  });
});
