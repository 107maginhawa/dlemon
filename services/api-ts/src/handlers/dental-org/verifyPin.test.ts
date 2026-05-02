/**
 * verifyPin + setPin handler tests
 *
 * Tests PIN verification flow: correct PIN returns success, wrong PIN returns failure,
 * lockout after 5 and 10 attempts, and PIN setting/changing.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { MembershipRepository } from './repos/membership.repo';
import { BranchRepository } from './repos/branch.repo';
import { OrganizationRepository } from './repos/organization.repo';
import { DentalMembershipManagement_verifyPin } from '@/handlers/dental-org/verifyPin';
import { DentalMembershipManagement_setPin } from '@/handlers/dental-org/setPin';
import { zValidator } from '@hono/zod-validator';
import {
  DentalMembershipManagement_verifyPinParams,
  DentalMembershipManagement_verifyPinBody,
  DentalMembershipManagement_setPinBody,
} from '@/generated/openapi/validators';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const ORG_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000001';
const PERSON_ID = 'c0000000-0000-1000-8000-000000000001';
const NONEXISTENT_ID = 'd0000000-0000-1000-8000-000000000099';

const authedUser = { id: PERSON_ID, email: 'owner@clinic.com' };

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed' }, 400);
  }
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

  const paramSchema = DentalMembershipManagement_verifyPinParams;
  const bodySchema = DentalMembershipManagement_verifyPinBody;
  const setPinBodySchema = DentalMembershipManagement_setPinBody;

  app.post(
    '/dental/organizations/:orgId/branches/:branchId/members/:membershipId/verify-pin',
    zValidator('param', paramSchema, validationErrorHandler),
    zValidator('json', bodySchema, validationErrorHandler),
    DentalMembershipManagement_verifyPin as any,
  );

  app.post(
    '/dental/organizations/:orgId/branches/:branchId/members/:membershipId/set-pin',
    zValidator('param', paramSchema, validationErrorHandler),
    zValidator('json', setPinBodySchema, validationErrorHandler),
    DentalMembershipManagement_setPin as any,
  );

  return app;
}

async function seedMember(membershipRepo: MembershipRepository) {
  return membershipRepo.createOne({
    branchId: BRANCH_ID,
    displayName: 'Staff Ana',
    role: 'staff_full',
    status: 'active',
    pinFailedAttempts: 0,
  });
}

describe('verifyPin handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  async function seedAll() {
    const orgRepo = new OrganizationRepository(db);
    await orgRepo.createOne({ id: ORG_ID, name: 'Test Clinic', tier: 'solo', ownerPersonId: PERSON_ID, countryCode: 'PH', active: true });
    const branchRepo = new BranchRepository(db);
    await branchRepo.createOne({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', active: true });
    return new MembershipRepository(db);
  }

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/e0000000-0000-1000-8000-000000000001/verify-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) },
    );
    expect(res.status).toBe(401);
  });

  test('returns 404 when member not found', async () => {
    await seedAll();
    const app = buildTestApp(authedUser);
    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/d0000000-0000-1000-8000-000000000099/verify-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) },
    );
    expect(res.status).toBe(404);
  });

  test('returns 200 with success=false when no PIN set', async () => {
    const membershipRepo = await seedAll();
    const member = await seedMember(membershipRepo);
    const app = buildTestApp(authedUser);

    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${member.id}/verify-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
  });

  test('returns 200 with success=true when correct PIN provided', async () => {
    const membershipRepo = await seedAll();
    const member = await seedMember(membershipRepo);
    // Set a PIN first
    const pinHash = await Bun.password.hash('123456');
    await membershipRepo.updatePin(member.id, pinHash);
    const app = buildTestApp(authedUser);

    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${member.id}/verify-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.failedAttempts).toBe(0);
  });

  test('returns 200 with success=false and incremented failedAttempts on wrong PIN', async () => {
    const membershipRepo = await seedAll();
    const member = await seedMember(membershipRepo);
    const pinHash = await Bun.password.hash('123456');
    await membershipRepo.updatePin(member.id, pinHash);
    const app = buildTestApp(authedUser);

    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${member.id}/verify-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '999999' }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.failedAttempts).toBe(1);
  });

  test('returns 429 when member is locked out', async () => {
    const membershipRepo = await seedAll();
    const member = await seedMember(membershipRepo);
    const pinHash = await Bun.password.hash('123456');
    await membershipRepo.updatePin(member.id, pinHash);

    // Trigger lockout: 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await membershipRepo.recordFailedPinAttempt(member.id);
    }

    const app = buildTestApp(authedUser);
    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${member.id}/verify-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) },
    );

    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.lockedUntil).toBeTruthy();
  });

  test('FR9.3: returns 429 with 5-minute lockout after 10 failed attempts', async () => {
    const membershipRepo = await seedAll();
    const member = await seedMember(membershipRepo);
    const pinHash = await Bun.password.hash('123456');
    await membershipRepo.updatePin(member.id, pinHash);

    // Trigger 10 failed attempts (escalates from 30s to 5-minute lockout)
    for (let i = 0; i < 10; i++) {
      await membershipRepo.recordFailedPinAttempt(member.id);
    }

    const app = buildTestApp(authedUser);
    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${member.id}/verify-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) },
    );

    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.lockedUntil).toBeTruthy();
    // Lockout at 10 attempts should be at least 4 minutes in the future (5-min lockout)
    const lockedUntilTime = new Date(body.lockedUntil).getTime();
    expect(lockedUntilTime).toBeGreaterThan(Date.now() + 4 * 60 * 1000);
  });

  test('resets failed attempts on successful PIN verification', async () => {
    const membershipRepo = await seedAll();
    const member = await seedMember(membershipRepo);
    const pinHash = await Bun.password.hash('654321');
    await membershipRepo.updatePin(member.id, pinHash);

    // Record some failed attempts
    await membershipRepo.recordFailedPinAttempt(member.id);
    await membershipRepo.recordFailedPinAttempt(member.id);

    const app = buildTestApp(authedUser);
    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${member.id}/verify-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '654321' }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.failedAttempts).toBe(0);
  });
});

describe('setPin handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  async function seedAll() {
    const orgRepo = new OrganizationRepository(db);
    await orgRepo.createOne({ id: ORG_ID, name: 'Test Clinic', tier: 'solo', ownerPersonId: PERSON_ID, countryCode: 'PH', active: true });
    const branchRepo = new BranchRepository(db);
    await branchRepo.createOne({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', active: true });
    return new MembershipRepository(db);
  }

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/e0000000-0000-1000-8000-000000000001/set-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) },
    );
    expect(res.status).toBe(401);
  });

  test('returns 404 when member not found', async () => {
    await seedAll();
    const app = buildTestApp(authedUser);
    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/d0000000-0000-1000-8000-000000000099/set-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) },
    );
    expect(res.status).toBe(404);
  });

  test('sets PIN and returns updated membership', async () => {
    const membershipRepo = await seedAll();
    const member = await seedMember(membershipRepo);
    const app = buildTestApp(authedUser);

    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${member.id}/set-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(member.id);
    // pinHash should not be returned (security — strip it)
    expect(body.pinHash).toBeUndefined();
  });

  test('allows PIN verification after setPin', async () => {
    const membershipRepo = await seedAll();
    const member = await seedMember(membershipRepo);
    const app = buildTestApp(authedUser);

    // Set PIN
    await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${member.id}/set-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '777777' }) },
    );

    // Verify PIN
    const verifyRes = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${member.id}/verify-pin`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '777777' }) },
    );
    expect(verifyRes.status).toBe(200);
    const body = await verifyRes.json() as any;
    expect(body.success).toBe(true);
  });
});
