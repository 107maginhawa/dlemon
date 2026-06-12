/**
 * EF-ORG-P020 / EF-ORG-P022 regression tests
 *
 * EF-ORG-P020 (security — auth bypass):
 *   getMemberRole() in branchSettings.ts and consentTemplates.ts must only
 *   return a role for an *active* membership. A revoked/inactive/invited
 *   member must NOT retain role-based privileges (e.g. dentist_owner write
 *   access to settings / consent templates).
 *
 * EF-ORG-P022 (low impact):
 *   getOrgContext() must not auto-select an inactive (soft-deleted) branch as
 *   the default context branch.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { dentalOrganizations } from './repos/organization.schema';
import { dentalBranches } from './repos/branch.schema';
import { dentalMemberships } from './repos/membership.schema';
import { getMemberRole as getMemberRoleSettings } from './branchSettings';
import { getMemberRole as getMemberRoleConsent } from './consentTemplates';

// EF-ORG-P022 / P020 handler tests now drive requests through the shared
// validator-mounting harness (the real generated route table: authMiddleware →
// zValidator → handler) instead of a bespoke raw mount, so they exercise the
// same chain production runs. Migrated off the raw-handler pattern (Track 4).

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const OWNER_USER = { id: '00000000-0000-0000-0000-0000000000a0', email: 'owner@p020.com' };
const ORG_ID = 'eeeeeeee-0000-1000-8000-0000000000a0';
const BRANCH_ID = 'bbbbbbbb-0000-1000-8000-0000000000a0';
const MEMBER_ID = 'dddddddd-0000-1000-8000-0000000000a0';

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE dental_membership, dental_branch, dental_organization
    RESTART IDENTITY CASCADE
  `);
});

async function seedOrgBranch() {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'P020 Clinic', tier: 'solo',
    ownerPersonId: OWNER_USER.id, countryCode: 'PH',
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', active: true,
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();
}

async function seedMember(status: 'active' | 'inactive' | 'invited' | 'revoked') {
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: OWNER_USER.id,
    displayName: 'Dr. Owner', role: 'dentist_owner', status,
    createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
  }).onConflictDoNothing();
}

// ---------------------------------------------------------------------------
// EF-ORG-P020 — getMemberRole direct unit tests (auth bypass)
// ---------------------------------------------------------------------------

describe('EF-ORG-P020: getMemberRole returns role only for active members', () => {
  test('branchSettings.getMemberRole returns role for ACTIVE member', async () => {
    await seedOrgBranch();
    await seedMember('active');
    const role = await getMemberRoleSettings(db, OWNER_USER.id, BRANCH_ID);
    expect(role).toBe('dentist_owner');
  });

  test('branchSettings.getMemberRole returns null for REVOKED member (no auth bypass)', async () => {
    await seedOrgBranch();
    await seedMember('revoked');
    const role = await getMemberRoleSettings(db, OWNER_USER.id, BRANCH_ID);
    expect(role).toBeNull();
  });

  test('branchSettings.getMemberRole returns null for INACTIVE member', async () => {
    await seedOrgBranch();
    await seedMember('inactive');
    const role = await getMemberRoleSettings(db, OWNER_USER.id, BRANCH_ID);
    expect(role).toBeNull();
  });

  test('branchSettings.getMemberRole returns null for INVITED (not yet active) member', async () => {
    await seedOrgBranch();
    await seedMember('invited');
    const role = await getMemberRoleSettings(db, OWNER_USER.id, BRANCH_ID);
    expect(role).toBeNull();
  });

  test('consentTemplates.getMemberRole returns null for REVOKED member (no auth bypass)', async () => {
    await seedOrgBranch();
    await seedMember('revoked');
    const role = await getMemberRoleConsent(db, OWNER_USER.id, BRANCH_ID);
    expect(role).toBeNull();
  });

  test('consentTemplates.getMemberRole returns role for ACTIVE member', async () => {
    await seedOrgBranch();
    await seedMember('active');
    const role = await getMemberRoleConsent(db, OWNER_USER.id, BRANCH_ID);
    expect(role).toBe('dentist_owner');
  });
});

// ---------------------------------------------------------------------------
// EF-ORG-P022 — getOrgContext skips inactive branches
// ---------------------------------------------------------------------------

describe('EF-ORG-P022: getOrgContext skips inactive branches', () => {
  test('selects the active branch, not the inactive one', async () => {
    await db.insert(dentalOrganizations).values({
      id: ORG_ID, name: 'P022 Clinic', tier: 'solo',
      ownerPersonId: OWNER_USER.id, countryCode: 'PH',
      createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
    }).onConflictDoNothing();
    // Inactive branch inserted first so it is branches[0] without filtering.
    const INACTIVE_BRANCH = 'bbbbbbbb-0000-1000-8000-0000000000a1';
    const ACTIVE_BRANCH = 'bbbbbbbb-0000-1000-8000-0000000000a2';
    await db.insert(dentalBranches).values([
      {
        id: INACTIVE_BRANCH, organizationId: ORG_ID, name: 'Closed Branch',
        timezone: 'Asia/Manila', active: false,
        createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
      },
      {
        id: ACTIVE_BRANCH, organizationId: ORG_ID, name: 'Open Branch',
        timezone: 'Asia/Manila', active: true,
        createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
      },
    ]).onConflictDoNothing();

    const app = buildTestApp({ db, user: OWNER_USER });
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.branch).not.toBeNull();
    expect(body.branch.id).toBe(ACTIVE_BRANCH);
    expect(body.branch.name).toBe('Open Branch');
  });

  test('returns branch: null when org has only inactive branches', async () => {
    await db.insert(dentalOrganizations).values({
      id: ORG_ID, name: 'P022 Clinic', tier: 'solo',
      ownerPersonId: OWNER_USER.id, countryCode: 'PH',
      createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
    }).onConflictDoNothing();
    await db.insert(dentalBranches).values({
      id: BRANCH_ID, organizationId: ORG_ID, name: 'Closed Branch',
      timezone: 'Asia/Manila', active: false,
      createdBy: OWNER_USER.id, updatedBy: OWNER_USER.id,
    }).onConflictDoNothing();

    const app = buildTestApp({ db, user: OWNER_USER });
    const res = await app.request('/dental/org/context');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.org).not.toBeNull();
    expect(body.branch).toBeNull();
    expect(body.member).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EF-ORG-P020 — handler-level defense in depth
// (assertBranchAccess already blocks revoked members; this confirms the
//  role check is also revoked-safe so the two layers stay consistent.)
// ---------------------------------------------------------------------------

describe('EF-ORG-P020: revoked owner cannot update branch settings', () => {
  test('revoked dentist_owner is denied (403) when updating settings', async () => {
    await seedOrgBranch();
    await seedMember('revoked');
    const app = buildTestApp({ db, user: OWNER_USER });
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { clinicName: 'Hacked' } }),
    });
    expect(res.status).toBe(403);
  });

  test('active dentist_owner can update settings (200)', async () => {
    await seedOrgBranch();
    await seedMember('active');
    const app = buildTestApp({ db, user: OWNER_USER });
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { clinicName: 'Legit Clinic' } }),
    });
    expect(res.status).toBe(200);
  });
});
