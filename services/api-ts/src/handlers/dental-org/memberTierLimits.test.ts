/**
 * FR6.3: Tier-based member limit tests
 *
 * Business rule: Solo plan allows max 2 active members; Clinic plan allows max 5.
 * Deactivated members do NOT count toward the limit.
 *
 * Uses the nested endpoint: POST /dental/organizations/:orgId/branches/:branchId/members/
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { DentalMembershipManagement_create } from '@/handlers/dental-org/DentalMembershipManagement_create';
import { DentalMembershipManagement_deactivate } from '@/handlers/dental-org/DentalMembershipManagement_deactivate';
import {
  DentalMembershipManagement_createParams,
  DentalMembershipManagement_createBody,
  DentalMembershipManagement_deactivateParams,
} from '@/generated/openapi/validators';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const PERSON_ID = 'c2000000-0000-1000-8000-000000000001';
const authedUser = { id: PERSON_ID, email: 'owner@clinic.com' };

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed' }, 400);
};

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

  app.post(
    '/dental/organizations/:orgId/branches/:branchId/members/',
    zValidator('param', DentalMembershipManagement_createParams, validationErrorHandler),
    zValidator('json', DentalMembershipManagement_createBody, validationErrorHandler),
    DentalMembershipManagement_create as any,
  );

  app.post(
    '/dental/organizations/:orgId/branches/:branchId/members/:membershipId/deactivate',
    zValidator('param', DentalMembershipManagement_deactivateParams, validationErrorHandler),
    DentalMembershipManagement_deactivate as any,
  );

  return app;
}

async function seedSoloOrgAndBranch(orgId: string, branchId: string) {
  const orgRepo = new OrganizationRepository(db);
  await orgRepo.createOne({ id: orgId, name: 'Solo Clinic', tier: 'solo', ownerPersonId: PERSON_ID, countryCode: 'PH', active: true });
  const branchRepo = new BranchRepository(db);
  await branchRepo.createOne({ id: branchId, organizationId: orgId, name: 'Main Branch', timezone: 'Asia/Manila', active: true });
  // EF-ORG-011: the acting owner must hold an active dentist_owner branch
  // membership to pass assertBranchRole. dentist_owner is excluded from the
  // FR6.3 "active staff members" tier count, so it does not consume a slot.
  const memberRepo = new MembershipRepository(db);
  await memberRepo.createOne({ branchId, personId: PERSON_ID, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0 });
}

async function seedClinicOrgAndBranch(orgId: string, branchId: string) {
  const orgRepo = new OrganizationRepository(db);
  await orgRepo.createOne({ id: orgId, name: 'Clinic Practice', tier: 'clinic', ownerPersonId: PERSON_ID, countryCode: 'PH', active: true });
  const branchRepo = new BranchRepository(db);
  await branchRepo.createOne({ id: branchId, organizationId: orgId, name: 'Main Branch', timezone: 'Asia/Manila', active: true });
  // EF-ORG-011: owner needs an active dentist_owner membership; excluded from
  // the FR6.3 tier count (see seedSoloOrgAndBranch).
  const memberRepo = new MembershipRepository(db);
  await memberRepo.createOne({ branchId, personId: PERSON_ID, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0 });
}

async function createMember(app: Hono, orgId: string, branchId: string, displayName: string, role = 'staff_full') {
  const res = await app.request(
    `/dental/organizations/${orgId}/branches/${branchId}/members/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, role }),
    },
  );
  return res;
}

describe('FR6.3: Tier-based member limits', () => {
  const ORG_ID = 'a2000000-0000-1000-8000-000000000001';
  const BRANCH_ID = 'b2000000-0000-1000-8000-000000000001';

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  test('solo plan: allows up to 2 active members', async () => {
    await seedSoloOrgAndBranch(ORG_ID, BRANCH_ID);
    const app = buildTestApp(authedUser);

    // First member — OK
    const res1 = await createMember(app, ORG_ID, BRANCH_ID, 'Staff One');
    expect(res1.status).toBe(201);

    // Second member — OK
    const res2 = await createMember(app, ORG_ID, BRANCH_ID, 'Staff Two');
    expect(res2.status).toBe(201);
  });

  test('solo plan: rejects 3rd member with 409 TIER_LIMIT_REACHED', async () => {
    await seedSoloOrgAndBranch(ORG_ID, BRANCH_ID);
    const app = buildTestApp(authedUser);

    await createMember(app, ORG_ID, BRANCH_ID, 'Staff One');
    await createMember(app, ORG_ID, BRANCH_ID, 'Staff Two');

    // Third member — should fail
    const res3 = await createMember(app, ORG_ID, BRANCH_ID, 'Staff Three');
    expect(res3.status).toBe(409);
    const body = await res3.json() as any;
    expect(body.code).toBe('TIER_LIMIT_REACHED');
  });

  test('solo plan: deactivated member frees a slot (does not count toward limit)', async () => {
    await seedSoloOrgAndBranch(ORG_ID, BRANCH_ID);
    const app = buildTestApp(authedUser);

    // Fill to limit
    const res1 = await createMember(app, ORG_ID, BRANCH_ID, 'Staff One');
    const member1 = await res1.json() as any;
    await createMember(app, ORG_ID, BRANCH_ID, 'Staff Two');

    // Deactivate first member
    const deactivateRes = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${member1.id}/deactivate`,
      { method: 'POST' },
    );
    expect(deactivateRes.status).toBe(200);

    // Now third member should succeed (slot freed by deactivation)
    const res3 = await createMember(app, ORG_ID, BRANCH_ID, 'Staff Three');
    expect(res3.status).toBe(201);
  });

  test('clinic plan: allows up to 5 active members', async () => {
    await seedClinicOrgAndBranch(ORG_ID, BRANCH_ID);
    const app = buildTestApp(authedUser);

    for (let i = 1; i <= 5; i++) {
      const res = await createMember(app, ORG_ID, BRANCH_ID, `Staff ${i}`);
      expect(res.status).toBe(201);
    }
  });

  test('clinic plan: rejects 6th member with 409 TIER_LIMIT_REACHED', async () => {
    await seedClinicOrgAndBranch(ORG_ID, BRANCH_ID);
    const app = buildTestApp(authedUser);

    for (let i = 1; i <= 5; i++) {
      await createMember(app, ORG_ID, BRANCH_ID, `Staff ${i}`);
    }

    const res6 = await createMember(app, ORG_ID, BRANCH_ID, 'Staff Six');
    expect(res6.status).toBe(409);
    const body = await res6.json() as any;
    expect(body.code).toBe('TIER_LIMIT_REACHED');
  });
});
