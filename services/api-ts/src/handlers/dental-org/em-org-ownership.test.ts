/**
 * EM-ORG ownership guard tests
 *
 * Covers:
 *   EM-ORG-002 — setPin must reject non-owner, non-self callers (only the
 *                target member or a dentist_owner may set a PIN).
 *   EM-ORG-004 — DentalOrganizationManagement_update must reject non-owner
 *                callers (only ownerPersonId may PATCH the org).
 *   EM-ORG-020 — DentalMembershipManagement_verifyPin facade must call
 *                trackLastLogin on successful verification.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { MembershipRepository } from './repos/membership.repo';
import { BranchRepository } from './repos/branch.repo';
import { OrganizationRepository } from './repos/organization.repo';
import { DentalMembershipManagement_setPin } from './DentalMembershipManagement_setPin';
import { DentalMembershipManagement_verifyPin } from './DentalMembershipManagement_verifyPin';
import { DentalOrganizationManagement_update } from './DentalOrganizationManagement_update';
import {
  DentalMembershipManagement_setPinParams,
  DentalMembershipManagement_setPinBody,
  DentalMembershipManagement_verifyPinParams,
  DentalMembershipManagement_verifyPinBody,
  DentalOrganizationManagement_updateParams,
  DentalOrganizationManagement_updateBody,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const ORG_ID = 'a0000000-0000-1000-8000-00000000ee01';
const BRANCH_ID = 'b0000000-0000-1000-8000-00000000ee01';
const OWNER_PERSON_ID = 'c0000000-0000-1000-8000-00000000ee01';
const STAFF_PERSON_ID = 'c0000000-0000-1000-8000-00000000ee02';
const OUTSIDER_PERSON_ID = 'c0000000-0000-1000-8000-00000000ee03';

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

  app.post(
    '/dental/organizations/:orgId/branches/:branchId/members/:membershipId/set-pin',
    zValidator('param', DentalMembershipManagement_setPinParams, validationErrorHandler),
    zValidator('json', DentalMembershipManagement_setPinBody, validationErrorHandler),
    DentalMembershipManagement_setPin as any,
  );

  app.post(
    '/dental/organizations/:orgId/branches/:branchId/members/:membershipId/verify-pin',
    zValidator('param', DentalMembershipManagement_verifyPinParams, validationErrorHandler),
    zValidator('json', DentalMembershipManagement_verifyPinBody, validationErrorHandler),
    DentalMembershipManagement_verifyPin as any,
  );

  app.patch(
    '/dental/organizations/:id',
    zValidator('param', DentalOrganizationManagement_updateParams, validationErrorHandler),
    zValidator('json', DentalOrganizationManagement_updateBody, validationErrorHandler),
    DentalOrganizationManagement_update as any,
  );

  return app;
}

async function seedOrgAndBranch() {
  const orgRepo = new OrganizationRepository(db);
  await orgRepo.createOne({
    id: ORG_ID,
    name: 'Test Clinic',
    tier: 'solo',
    ownerPersonId: OWNER_PERSON_ID,
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

async function seedMembership(
  personId: string,
  role: 'dentist_owner' | 'staff_full' = 'staff_full',
) {
  const repo = new MembershipRepository(db);
  return repo.createOne({
    branchId: BRANCH_ID,
    personId,
    displayName: role === 'dentist_owner' ? 'Owner Dr.' : 'Staff Person',
    role,
    status: 'active',
    pinFailedAttempts: 0,
  });
}

describe('EM-ORG-002 setPin ownership guard', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  test('dentist_owner can set another member PIN → 200', async () => {
    await seedOrgAndBranch();
    await seedMembership(OWNER_PERSON_ID, 'dentist_owner');
    const target = await seedMembership(STAFF_PERSON_ID, 'staff_full');

    const app = buildTestApp({ id: OWNER_PERSON_ID, email: 'owner@clinic.com' });
    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${target.id}/set-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) },
    );

    expect(res.status).toBe(200);
  });

  test('staff_full can set their OWN PIN → 200', async () => {
    await seedOrgAndBranch();
    const self = await seedMembership(STAFF_PERSON_ID, 'staff_full');

    const app = buildTestApp({ id: STAFF_PERSON_ID, email: 'staff@clinic.com' });
    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${self.id}/set-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) },
    );

    expect(res.status).toBe(200);
  });

  test('staff_full CANNOT set another member PIN → 403 [EM-ORG-002]', async () => {
    await seedOrgAndBranch();
    await seedMembership(STAFF_PERSON_ID, 'staff_full');
    const target = await seedMembership(OUTSIDER_PERSON_ID, 'staff_full');

    const app = buildTestApp({ id: STAFF_PERSON_ID, email: 'staff@clinic.com' });
    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${target.id}/set-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) },
    );

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toContain('dentist_owner');
  });
});

describe('EM-ORG-004 org update ownership guard', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  test('owner can PATCH their org → 200', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp({ id: OWNER_PERSON_ID, email: 'owner@clinic.com' });

    const res = await app.request(`/dental/organizations/${ORG_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed Clinic' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.name).toBe('Renamed Clinic');
  });

  test('non-owner CANNOT PATCH the org → 403 [EM-ORG-004]', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp({ id: OUTSIDER_PERSON_ID, email: 'outsider@clinic.com' });

    const res = await app.request(`/dental/organizations/${ORG_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hijacked Name' }),
    });

    expect(res.status).toBe(403);
  });

  test('PATCH on unknown org id → 404', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp({ id: OWNER_PERSON_ID, email: 'owner@clinic.com' });

    const res = await app.request('/dental/organizations/a0000000-0000-1000-8000-00000000ffff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ghost' }),
    });

    expect(res.status).toBe(404);
  });
});

describe('EM-ORG-020 verifyPin facade tracks last login', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  test('successful PIN sets lastLoginAt on the membership row', async () => {
    await seedOrgAndBranch();
    await seedMembership(OWNER_PERSON_ID, 'dentist_owner');
    const target = await seedMembership(STAFF_PERSON_ID, 'staff_full');

    const repo = new MembershipRepository(db);
    const pinHash = await Bun.password.hash('123456');
    await repo.updatePin(target.id, pinHash);

    const before = await repo.findOneById(target.id);
    expect(before?.lastLoginAt).toBeNull();

    const app = buildTestApp({ id: OWNER_PERSON_ID, email: 'owner@clinic.com' });
    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${target.id}/verify-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) },
    );

    expect(res.status).toBe(200);
    const after = await repo.findOneById(target.id);
    expect(after?.lastLoginAt).not.toBeNull();
  });
});
