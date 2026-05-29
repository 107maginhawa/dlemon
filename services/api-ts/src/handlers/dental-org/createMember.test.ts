/**
 * createMember handler tests
 *
 * Path: POST /dental/org/members?branchId=...
 * Tests: 401 unauthenticated, 400 missing branchId, 400 missing displayName,
 *        400 invalid role, 201 success.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { createMember } from './createMember';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';
import { auditLogEntries } from '@/handlers/audit/repos/audit.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ORG_ID   = 'a1000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b1000000-0000-1000-8000-000000000001';
const PERSON_ID = 'c1000000-0000-1000-8000-000000000001';

const authedUser = { id: PERSON_ID, email: 'owner@clinic.com' };

function buildTestApp(user?: typeof authedUser) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    if (err instanceof ZodError) {
      return c.json({ error: err.issues.map(i => i.message).join('; ') }, 400);
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

  app.post('/dental/org/members', createMember);

  return app;
}

async function seedOrgAndBranch() {
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
  // Seed membership for authedUser so assertBranchAccess passes
  const membershipRepo = new MembershipRepository(db);
  await membershipRepo.createOne({
    branchId: BRANCH_ID,
    personId: PERSON_ID,
    displayName: 'Owner',
    role: 'dentist_owner',
    status: 'active',
  });
}

describe('createMember handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
    await db.execute(sql`DELETE FROM audit_log_entry WHERE resource_type = 'dental_membership'`);
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  test('returns 401 when user is not authenticated', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(undefined);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Staff Ana', role: 'staff_full' }),
    });

    expect(res.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Validation errors
  // --------------------------------------------------------------------------

  test('returns 400 when branchId is missing', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(authedUser);

    const res = await app.request('/dental/org/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Staff Ana', role: 'staff_full' }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when displayName is missing', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'staff_full' }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when role is invalid', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Staff Ana', role: 'superuser' }),
    });

    expect(res.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // Success
  // --------------------------------------------------------------------------

  test('returns 201 with created member on valid input', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Staff Ana', role: 'staff_full' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.displayName).toBe('Staff Ana');
    expect(body.role).toBe('staff_full');
    expect(body.branchId).toBe(BRANCH_ID);
    expect(body.status).toBe('active');
    // PIN hash must not be returned
    expect(body.pinHash).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // EF-ORG-011: dentist_owner role enforcement
  // --------------------------------------------------------------------------

  test('returns 403 when caller is not dentist_owner (staff_full role)', async () => {
    await seedOrgAndBranch();
    // Override the membership seeded in seedOrgAndBranch: re-seed as staff_full
    const membershipRepo = new MembershipRepository(db);
    // Deactivate the dentist_owner seed membership and re-add as staff_full
    await db.execute(sql`UPDATE dental_membership SET role = 'staff_full' WHERE person_id = ${PERSON_ID}`);

    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Staff', role: 'staff_full' }),
    });

    expect(res.status).toBe(403);
  });

  test('returns 403 when caller is dentist_associate (not owner)', async () => {
    await seedOrgAndBranch();
    await db.execute(sql`UPDATE dental_membership SET role = 'dentist_associate' WHERE person_id = ${PERSON_ID}`);

    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Staff', role: 'staff_full' }),
    });

    expect(res.status).toBe(403);
  });

  // --------------------------------------------------------------------------
  // AL-003: HIPAA audit trail
  // --------------------------------------------------------------------------

  test('AL-003: createMembership persists audit record to DB', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Audited Staff', role: 'staff_full' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;

    // Verify audit record persisted to DB (not just logger.info)
    const rows = await db
      .select()
      .from(auditLogEntries)
      .where(eq(auditLogEntries.resource, body.id));

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows[0]!;
    expect(row.action).toBe('create');
    expect(row.resourceType).toBe('dental_membership');
    expect(row.user).toBe(PERSON_ID);
    expect(row.outcome).toBe('success');
  });
});
