/**
 * updateMember handler tests
 *
 * Path: PATCH /dental/org/members/:memberId
 * Tests: 401 unauthenticated, 400 no valid fields, 400 invalid role,
 *        404 not found, 200 success with changed fields.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { ZodError } from 'zod';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { updateMember } from './updateMember';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ORG_ID    = 'a5000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b5000000-0000-1000-8000-000000000001';
const PERSON_ID = 'c5000000-0000-1000-8000-000000000001';
const NONEXISTENT_ID = 'd5000000-0000-1000-8000-000000000099';

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

  app.patch('/dental/org/members/:memberId', updateMember);

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

describe('updateMember handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Name' }),
    });

    expect(res.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Validation errors
  // --------------------------------------------------------------------------

  test('returns 400 when no valid fields are provided', async () => {
    await seedAll();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when role is invalid', async () => {
    await seedAll();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'superadmin' }),
    });

    expect(res.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // Not found
  // --------------------------------------------------------------------------

  test('returns 404 when member does not exist', async () => {
    await seedAll();
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Ghost' }),
    });

    expect(res.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // Success
  // --------------------------------------------------------------------------

  test('returns 200 with updated displayName', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Original Name',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Updated Name' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(member.id);
    expect(body.displayName).toBe('Updated Name');
    expect(body.pinHash).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // P2-17: Provider credentials
  // --------------------------------------------------------------------------

  test('returns 200 and persists provider credentials', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Dr. Provider',
      role: 'dentist_associate',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseNumber: 'LIC-12345',
        npi: '1234567890',
        credentialType: 'DDS',
        licenseExpiry: '2030-12-31T00:00:00Z',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.licenseNumber).toBe('LIC-12345');
    expect(body.npi).toBe('1234567890');
    expect(body.credentialType).toBe('DDS');
    expect(new Date(body.licenseExpiry).getUTCFullYear()).toBe(2030);
  });

  test('returns 400 when NPI is not 10 digits', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Dr. Bad NPI',
      role: 'dentist_associate',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi: '123' }),
    });

    expect(res.status).toBe(400);
  });

  test('allows clearing credentials with null', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Dr. Clearable',
      role: 'dentist_associate',
      status: 'active',
      pinFailedAttempts: 0,
      licenseNumber: 'LIC-OLD',
      npi: '9999999999',
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseNumber: null, npi: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.licenseNumber).toBeNull();
    expect(body.npi).toBeNull();
  });

  test('returns 200 with updated role', async () => {
    const membershipRepo = await seedAll();
    const member = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Staff Dave',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });
    const app = buildTestApp(authedUser);

    const res = await app.request(`/dental/org/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'staff_scheduling' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.role).toBe('staff_scheduling');
  });
});
