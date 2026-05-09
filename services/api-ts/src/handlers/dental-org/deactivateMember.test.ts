/**
 * deactivateMember handler tests
 *
 * Path: DELETE /dental/org/members/:memberId
 * Tests: 401 unauthenticated, 404 not found, 204 success.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { deactivateMember } from './deactivateMember';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const ORG_ID    = 'a2000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b2000000-0000-1000-8000-000000000001';
const PERSON_ID = 'c2000000-0000-1000-8000-000000000001';
const NONEXISTENT_ID = 'd2000000-0000-1000-8000-000000000099';

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

  app.delete('/dental/org/members/:memberId', deactivateMember);

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
  return new MembershipRepository(db);
}

describe('deactivateMember handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Not found
  // --------------------------------------------------------------------------

  test('returns 404 when member does not exist', async () => {
    await seedAll();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // Success
  // --------------------------------------------------------------------------

  test('returns 204 and deactivates the member', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Staff Bob',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(204);

    // Verify member is now inactive
    const updated = await membershipRepo.findOneById(member.id);
    expect(updated?.status).toBe('inactive');
  });
});
