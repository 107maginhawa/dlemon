/**
 * getOrgContext handler tests
 *
 * Tests the org/branch/member context bootstrap endpoint.
 * Covers the member fallback bug fix: must return null, not members[0],
 * when no membership matches the authenticated user's personId.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { getOrgContext } from './getOrgContext';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const orgRepo = new OrganizationRepository(db);
const branchRepo = new BranchRepository(db);
const memberRepo = new MembershipRepository(db);

function buildTestApp(user?: { id: string; email: string }) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: 'Internal error' }, 500);
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

  app.get('/dental/org/context', getOrgContext);

  return app;
}

const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000002';
const ownerUser = { id: OWNER_ID, email: 'owner@clinic.com' };

describe('getOrgContext handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(); // no user
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // No org
  // --------------------------------------------------------------------------

  test('returns all-null when user owns no org', async () => {
    const app = buildTestApp(ownerUser);
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.org).toBeNull();
    expect(body.branch).toBeNull();
    expect(body.member).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Happy path
  // --------------------------------------------------------------------------

  test('returns org, branch, and member when personId matches', async () => {
    // Seed: org owned by OWNER_ID, one branch, one member linked to OWNER_ID
    const org = await orgRepo.createOne({
      name: 'Test Clinic',
      tier: 'solo',
      ownerPersonId: OWNER_ID,
      countryCode: 'US',
      active: true,
    });
    const branch = await branchRepo.createOne({
      organizationId: org.id,
      name: 'Main Branch',
      timezone: 'America/New_York',
      active: true,
    });
    await memberRepo.createOne({
      branchId: branch.id,
      personId: OWNER_ID,
      displayName: 'Dr. Owner',
      role: 'dentist_owner',
      status: 'active',
      pinFailedAttempts: 0,
    });

    const app = buildTestApp(ownerUser);
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.org.id).toBe(org.id);
    expect(body.org.name).toBe('Test Clinic');
    expect(body.branch.id).toBe(branch.id);
    expect(body.member.role).toBe('dentist_owner');
    expect(body.member.displayName).toBe('Dr. Owner');
  });

  // --------------------------------------------------------------------------
  // Bug regression: no members[0] fallback
  // --------------------------------------------------------------------------

  test('returns member: null when branch has members but none match the authenticated user', async () => {
    // Seed: org + branch owned by OWNER_ID, but member is linked to a DIFFERENT personId
    const org = await orgRepo.createOne({
      name: 'Test Clinic',
      tier: 'solo',
      ownerPersonId: OWNER_ID,
      countryCode: 'US',
      active: true,
    });
    const branch = await branchRepo.createOne({
      organizationId: org.id,
      name: 'Main Branch',
      timezone: 'America/New_York',
      active: true,
    });
    // This member is linked to a DIFFERENT user — should NOT be returned
    await memberRepo.createOne({
      branchId: branch.id,
      personId: OTHER_USER_ID,
      displayName: 'Someone Else',
      role: 'dentist_associate',
      status: 'active',
      pinFailedAttempts: 0,
    });

    const app = buildTestApp(ownerUser);
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.org.id).toBe(org.id);
    expect(body.branch.id).toBe(branch.id);
    // CRITICAL: must be null, not "Someone Else"
    expect(body.member).toBeNull();
  });

  test('returns member: null when branch has only PIN-only members (personId null)', async () => {
    // Seed: org + branch + PIN-only staff (no personId) — seed-demo.ts scenario (Ana Santos)
    const org = await orgRepo.createOne({
      name: 'Test Clinic',
      tier: 'solo',
      ownerPersonId: OWNER_ID,
      countryCode: 'US',
      active: true,
    });
    const branch = await branchRepo.createOne({
      organizationId: org.id,
      name: 'Main Branch',
      timezone: 'America/New_York',
      active: true,
    });
    // PIN-only staff member — personId is null
    await memberRepo.createOne({
      branchId: branch.id,
      personId: null,
      displayName: 'Ana Santos',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });

    const app = buildTestApp(ownerUser);
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.org.id).toBe(org.id);
    expect(body.branch.id).toBe(branch.id);
    // CRITICAL: must not fall back to Ana Santos
    expect(body.member).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // V-ORG-004: default-branch resolved via scoped WHERE active=true LIMIT 1
  // (EF-ORG-P022 — an inactive branch must never be auto-selected).
  // --------------------------------------------------------------------------

  test('skips inactive branches and selects the active one', async () => {
    const org = await orgRepo.createOne({
      name: 'Test Clinic',
      tier: 'clinic',
      ownerPersonId: OWNER_ID,
      countryCode: 'US',
      active: true,
    });
    // Inactive branch must NOT be auto-selected.
    await branchRepo.createOne({
      organizationId: org.id,
      name: 'Closed Branch',
      timezone: 'America/New_York',
      active: false,
    });
    const activeBranch = await branchRepo.createOne({
      organizationId: org.id,
      name: 'Open Branch',
      timezone: 'America/New_York',
      active: true,
    });
    await memberRepo.createOne({
      branchId: activeBranch.id,
      personId: OWNER_ID,
      displayName: 'Dr. Owner',
      role: 'dentist_owner',
      status: 'active',
      pinFailedAttempts: 0,
    });

    const app = buildTestApp(ownerUser);
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.branch.id).toBe(activeBranch.id);
    expect(body.branch.name).toBe('Open Branch');
    expect(body.member.role).toBe('dentist_owner');
  });

  test('returns branch: null when org has no branches', async () => {
    await orgRepo.createOne({
      name: 'Test Clinic',
      tier: 'solo',
      ownerPersonId: OWNER_ID,
      countryCode: 'US',
      active: true,
    });

    const app = buildTestApp(ownerUser);
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.org).not.toBeNull();
    expect(body.branch).toBeNull();
    expect(body.member).toBeNull();
  });

  // --------------------------------------------------------------------------
  // P3 regression: NON-OWNER staff must resolve org context via their active
  // membership (membership → branch → org). Previously getOrgContext only looked
  // up orgs by ownership, so a staff_full member of SOMEONE ELSE'S org received
  // {org:null} and the dashboard guard bounced them to onboarding.
  // Revert the fix (owner-only lookup) → body.org is null → this test fails.
  // --------------------------------------------------------------------------

  test('resolves org context for a NON-OWNER staff member via their active membership', async () => {
    // Org owned by OWNER_ID. The caller (OTHER_USER_ID) owns NOTHING but is an
    // active staff_full member of the org's branch.
    const org = await orgRepo.createOne({
      name: 'Employer Clinic',
      tier: 'clinic',
      ownerPersonId: OWNER_ID,
      countryCode: 'US',
      active: true,
    });
    const branch = await branchRepo.createOne({
      organizationId: org.id,
      name: 'Main Branch',
      timezone: 'America/New_York',
      active: true,
    });
    await memberRepo.createOne({
      branchId: branch.id,
      personId: OTHER_USER_ID,
      displayName: 'Staff Member',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });

    // Call AS the non-owner staff member — NOT the owner.
    const app = buildTestApp({ id: OTHER_USER_ID, email: 'staff@clinic.com' });
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // CRITICAL: a non-owner staff member must resolve the EMPLOYER's org, not null.
    expect(body.org).not.toBeNull();
    expect(body.org.id).toBe(org.id);
    expect(body.branch.id).toBe(branch.id);
    expect(body.member).not.toBeNull();
    expect(body.member.displayName).toBe('Staff Member');
    expect(body.member.role).toBe('staff_full');
  });
});
