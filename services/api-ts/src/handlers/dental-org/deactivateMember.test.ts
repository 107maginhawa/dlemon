/**
 * deactivateMember handler tests
 *
 * Path: DELETE /dental/org/members/:memberId
 * Tests: 401 unauthenticated, 404 not found, 204 success.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { deactivateMember } from './deactivateMember';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';
import { auditLogEntries } from '@/handlers/audit/repos/audit.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

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
  const membershipRepo = new MembershipRepository(db);
  // Seed membership for authedUser so assertBranchAccess passes
  await membershipRepo.createOne({
    branchId: BRANCH_ID,
    personId: PERSON_ID,
    displayName: 'Owner',
    role: 'dentist_owner',
    status: 'active',
    pinFailedAttempts: 0,
  });
  return membershipRepo;
}

describe('deactivateMember handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
    await db.execute(sql`DELETE FROM audit_log_entry WHERE resource_type = 'dental_membership'`);
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
  // EF-ORG-013: Non-owner deactivation must be rejected
  // --------------------------------------------------------------------------

  test('returns 403 when caller is not dentist_owner (staff_full role)', async () => {
    const membershipRepo = await seedAll();
    // Create target member
    const target = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Target Member',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    // Downgrade caller to staff_full
    await db.execute(sql`UPDATE dental_membership SET role = 'staff_full' WHERE person_id = ${PERSON_ID}`);

    const app = buildTestApp(authedUser);
    const res = await app.request(`/dental/org/members/${target.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(403);
  });

  test('returns 403 when caller has no membership in the branch', async () => {
    const membershipRepo = await seedAll();
    const target = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Target Member',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });

    // Use a user with no membership at all
    const strangerUser = { id: 'd2000000-0000-1000-8000-000000000010', email: 'stranger@clinic.com' };
    const app = buildTestApp(strangerUser);
    const res = await app.request(`/dental/org/members/${target.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(403);
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

  // --------------------------------------------------------------------------
  // AL-004: HIPAA audit trail
  // --------------------------------------------------------------------------

  test('AL-004: revokeMembership persists audit record to DB', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Staff Eve',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(204);

    // Verify audit record persisted to DB (not just logger.info)
    const rows = await db
      .select()
      .from(auditLogEntries)
      .where(eq(auditLogEntries.resource, member.id));

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows[0]!;
    expect(row.action).toBe('delete');
    expect(row.resourceType).toBe('dental_membership');
    expect(row.user).toBe(PERSON_ID);
    expect(row.outcome).toBe('success');
  });
});
