/**
 * dental-org cross-tenant / object-ownership pins for the orphan write ops.
 *
 * Five mutating dental-org endpoints ship a handler + SDK but have NO FE
 * consumer, so they are reachable over the wire and were tracked as sensitive
 * mutating orphans (the class that once swallowed the P0 updatePatientContact
 * IDOR). Each already enforces an ownership/role gate; this PINS the deny path
 * so a refactor can't silently drop it. Polarity: a foreign / non-owner caller
 * must be DENIED (403). DB-backed because the guards resolve org ownership and
 * branch membership against the database.
 *
 * Discharges the dental-org entries of endpoint-sensitive-orphan.allowlist.json.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { DentalOrganizationManagement_create } from './DentalOrganizationManagement_create';
import { DentalOrganizationManagement_update } from './DentalOrganizationManagement_update';
import { DentalMembershipManagement_create } from './DentalMembershipManagement_create';
import { setSecurityQuestion } from './setSecurityQuestion';
import { updatePermissions } from './updatePermissions';
import {
  DentalOrganizationManagement_createBody,
  DentalOrganizationManagement_updateParams,
  DentalOrganizationManagement_updateBody,
  DentalMembershipManagement_createParams,
  DentalMembershipManagement_createBody,
} from '@/generated/openapi/validators';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// Personas — 'g'-prefixed UUIDs to avoid collision with sibling org suites.
const OWNER_A = { id: 'd0010000-0000-1000-8000-000000000001', email: 'owner-a@test.com' };
const ATTACKER = { id: 'd0020000-0000-1000-8000-000000000002', email: 'attacker@test.com' };
const ADMIN = { id: 'd0030000-0000-1000-8000-000000000003', email: 'admin@test.com', role: 'admin' };

const ORG_A_ID = 'd0010000-0000-1000-8000-000000000010';
const BRANCH_A_ID = 'd0010000-0000-1000-8000-000000000020';
const MEMBER_A_ID = 'd0010000-0000-1000-8000-000000000030';

function validationErrorHandler(result: any, c: any) {
  if (!result.success) return c.json({ error: 'validation' }, 400);
}
function makeErrorHandler() {
  return (err: any, c: any) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err?.message) }, 500);
  };
}
function injectDeps(user: { id: string; email: string; role?: string } | null) {
  return async (c: any, next: any) => {
    c.set('database', db);
    c.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    if (user) c.set('user', user);
    await next();
  };
}

async function seedOrg(orgId: string, ownerPersonId: string) {
  await db.insert(dentalOrganizations).values({
    id: orgId, name: `Clinic-${orgId.slice(-4)}`, tier: 'solo', ownerPersonId, countryCode: 'PH', active: true,
  }).onConflictDoNothing();
}
async function seedBranch(branchId: string, orgId: string, createdBy: string) {
  await db.insert(dentalBranches).values({
    id: branchId, organizationId: orgId, name: 'Main', timezone: 'Asia/Manila', active: true, createdBy, updatedBy: createdBy,
  }).onConflictDoNothing();
}
async function seedMembership(id: string, branchId: string, personId: string, role: 'dentist_owner' | 'staff_full') {
  await db.insert(dentalMemberships).values({
    id, branchId, personId, displayName: `Member ${id.slice(-4)}`, role, status: 'active', createdBy: personId, updatedBy: personId,
  }).onConflictDoNothing();
}

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE dental_feature_permission, dental_membership, dental_branch, dental_organization RESTART IDENTITY CASCADE
  `);
});

const J = { 'Content-Type': 'application/json' };

describe('DentalOrganizationManagement_create — admin-only (cross-tenant / privilege escalation)', () => {
  function makeApp(user: any) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.post('/dental/organizations',
      zValidator('json', DentalOrganizationManagement_createBody, validationErrorHandler),
      DentalOrganizationManagement_create as any);
    return app;
  }
  const body = JSON.stringify({ name: 'New Clinic', tier: 'solo', countryCode: 'PH' });

  test('a non-admin caller cannot create an organization → 403', async () => {
    const res = await makeApp(ATTACKER).request('/dental/organizations', { method: 'POST', headers: J, body });
    expect(res.status).toBe(403);
  });
  test('an admin caller is allowed past the gate (baseline, not 403)', async () => {
    const res = await makeApp(ADMIN).request('/dental/organizations', { method: 'POST', headers: J, body });
    expect(res.status).not.toBe(403);
  });
});

describe('DentalOrganizationManagement_update — owner-only (foreign-org IDOR)', () => {
  function makeApp(user: any) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.patch('/dental/organizations/:id',
      zValidator('param', DentalOrganizationManagement_updateParams, validationErrorHandler),
      zValidator('json', DentalOrganizationManagement_updateBody, validationErrorHandler),
      DentalOrganizationManagement_update as any);
    return app;
  }
  const body = JSON.stringify({ name: 'Renamed' });

  test('a non-owner cannot update another org → 403', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    const res = await makeApp(ATTACKER).request(`/dental/organizations/${ORG_A_ID}`, { method: 'PATCH', headers: J, body });
    expect(res.status).toBe(403);
  });
  test('the org owner can update their own org (baseline, not 403)', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    const res = await makeApp(OWNER_A).request(`/dental/organizations/${ORG_A_ID}`, { method: 'PATCH', headers: J, body });
    expect(res.status).not.toBe(403);
  });
});

describe('DentalMembershipManagement_create — branch owner-role required (foreign-branch IDOR)', () => {
  function makeApp(user: any) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.post('/dental/organizations/:orgId/branches/:branchId/members',
      zValidator('param', DentalMembershipManagement_createParams, validationErrorHandler),
      zValidator('json', DentalMembershipManagement_createBody, validationErrorHandler),
      DentalMembershipManagement_create as any);
    return app;
  }
  const body = JSON.stringify({ displayName: 'New Staff', role: 'staff_full' });
  const url = `/dental/organizations/${ORG_A_ID}/branches/${BRANCH_A_ID}/members`;

  test('a non-member of the branch cannot create a membership there → 403', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    const res = await makeApp(ATTACKER).request(url, { method: 'POST', headers: J, body });
    expect(res.status).toBe(403);
  });
  test('the org owner can create a membership in their branch (baseline, not 403)', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    const res = await makeApp(OWNER_A).request(url, { method: 'POST', headers: J, body });
    expect(res.status).not.toBe(403);
  });
});

describe('setSecurityQuestion — caller must belong to the member’s branch (cross-tenant)', () => {
  function makeApp(user: any) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.post('/dental/org/members/:memberId/security-question', setSecurityQuestion as any);
    return app;
  }
  const body = JSON.stringify({ question: 'Pet name?', answer: 'rex' });

  test('a caller outside the member’s branch cannot set their security question → 403', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    await seedMembership(MEMBER_A_ID, BRANCH_A_ID, OWNER_A.id, 'dentist_owner');
    const res = await makeApp(ATTACKER).request(`/dental/org/members/${MEMBER_A_ID}/security-question`, { method: 'POST', headers: J, body });
    expect(res.status).toBe(403);
  });
  test('the member themselves can set their own security question (baseline, not 403)', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    await seedMembership(MEMBER_A_ID, BRANCH_A_ID, OWNER_A.id, 'dentist_owner');
    const res = await makeApp(OWNER_A).request(`/dental/org/members/${MEMBER_A_ID}/security-question`, { method: 'POST', headers: J, body });
    expect(res.status).not.toBe(403);
  });
});

describe('updatePermissions — org owner-only (foreign-org privilege escalation)', () => {
  function makeApp(user: any) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.put('/dental/org/permissions', updatePermissions as any);
    return app;
  }
  const body = JSON.stringify({ overrides: [{ role: 'staff_full', feature: 'staff.manage', allowed: true }] });

  test('a non-owner cannot change another org’s permission grid → 403', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    const res = await makeApp(ATTACKER).request(`/dental/org/permissions?organizationId=${ORG_A_ID}`, { method: 'PUT', headers: J, body });
    expect(res.status).toBe(403);
  });
  test('the org owner can change their own permission grid (baseline, not 403)', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    const res = await makeApp(OWNER_A).request(`/dental/org/permissions?organizationId=${ORG_A_ID}`, { method: 'PUT', headers: J, body });
    expect(res.status).not.toBe(403);
  });
});
