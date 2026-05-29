/**
 * dental-org-auth-p0.test.ts
 *
 * TDD proof for EF-ORG-001/002/003/004 + EM-ORG-001/006 — 6 P0 auth/IDOR fixes.
 *
 * RED: Written before implementation. Each test should FAIL against the unfixed
 * handlers. GREEN: All tests pass after the implementation changes below.
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
import { DentalBranchManagement_create } from './DentalBranchManagement_create';
import { DentalBranchManagement_list } from './DentalBranchManagement_list';
import { createMember } from './createMember';
import { DentalMembershipManagement_deactivate } from './DentalMembershipManagement_deactivate';
import { recoverPin } from './pinRecovery';
import { DentalOrganizationManagement_get } from './DentalOrganizationManagement_get';
import {
  DentalBranchManagement_createParams,
  DentalBranchManagement_createBody,
  DentalBranchManagement_listParams,
  DentalMembershipManagement_deactivateParams,
  DentalMembershipManagement_deactivateBody,
  DentalOrganizationManagement_getParams,
} from '@/generated/openapi/validators';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// ---------------------------------------------------------------------------
// Test personas
// ---------------------------------------------------------------------------
const OWNER_A = { id: 'e0010000-0000-1000-8000-000000000001', email: 'owner-a@test.com' };
const ATTACKER = { id: 'e0020000-0000-1000-8000-000000000002', email: 'attacker@test.com' };
const STAFF_FULL = { id: 'e0030000-0000-1000-8000-000000000003', email: 'staff@test.com' };
const READ_ONLY = { id: 'e0040000-0000-1000-8000-000000000004', email: 'readonly@test.com' };

const ORG_A_ID = 'e0010000-0000-1000-8000-000000000010';
const BRANCH_A_ID = 'e0010000-0000-1000-8000-000000000020';
const MEMBER_OWNER_ID = 'e0010000-0000-1000-8000-000000000030';
const MEMBER_STAFF_ID = 'e0010000-0000-1000-8000-000000000040';
const MEMBER_READONLY_ID = 'e0010000-0000-1000-8000-000000000050';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validationErrorHandler(result: any, c: any) {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
}

function makeErrorHandler() {
  return (err: any, c: any) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  };
}

function injectDeps(user: { id: string; email: string } | null) {
  return async (c: any, next: any) => {
    c.set('database', db);
    c.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) c.set('user', user);
    await next();
  };
}

async function seedOrg(orgId: string, ownerPersonId: string) {
  await db.insert(dentalOrganizations).values({
    id: orgId,
    name: `Clinic-${orgId.slice(-4)}`,
    tier: 'solo',
    ownerPersonId,
    countryCode: 'PH',
    active: true,
  }).onConflictDoNothing();
}

async function seedBranch(branchId: string, orgId: string, createdBy: string) {
  await db.insert(dentalBranches).values({
    id: branchId,
    organizationId: orgId,
    name: 'Main',
    timezone: 'Asia/Manila',
    active: true,
    createdBy,
    updatedBy: createdBy,
  }).onConflictDoNothing();
}

async function seedMembership(id: string, branchId: string, personId: string, role: 'dentist_owner' | 'staff_full' | 'read_only') {
  await db.insert(dentalMemberships).values({
    id,
    branchId,
    personId,
    displayName: `Member ${id.slice(-4)}`,
    role,
    status: 'active',
    createdBy: personId,
    updatedBy: personId,
  }).onConflictDoNothing();
}

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE dental_membership, dental_branch, dental_organization RESTART IDENTITY CASCADE
  `);
});

// ===========================================================================
// EF-ORG-001: DentalBranchManagement_create — org ownership check
// ===========================================================================

describe('EF-ORG-001 DentalBranchManagement_create — org ownership required', () => {
  function makeApp(user: { id: string; email: string } | null) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.post(
      '/dental/organizations/:orgId/branches',
      zValidator('param', DentalBranchManagement_createParams, validationErrorHandler),
      zValidator('json', DentalBranchManagement_createBody, validationErrorHandler),
      DentalBranchManagement_create as any,
    );
    return app;
  }

  test('non-owner cannot create branch in foreign org → 403 [EF-ORG-001]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);

    const app = makeApp(ATTACKER); // ATTACKER does not own ORG_A
    const res = await app.request(`/dental/organizations/${ORG_A_ID}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Evil Branch', timezone: 'Asia/Manila' }),
    });

    expect(res.status).toBe(403);
  });

  test('org owner can create branch in own org → 201 [EF-ORG-001 baseline]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);

    const app = makeApp(OWNER_A);
    const res = await app.request(`/dental/organizations/${ORG_A_ID}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Legit Branch', timezone: 'Asia/Manila' }),
    });

    expect(res.status).toBe(201);
  });

  test('unauthenticated create branch → 401 [EF-ORG-001 unauthed]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);

    const app = makeApp(null);
    const res = await app.request(`/dental/organizations/${ORG_A_ID}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Branch', timezone: 'Asia/Manila' }),
    });

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// EF-ORG-002: DentalBranchManagement_list — org membership/ownership check
// ===========================================================================

describe('EF-ORG-002 DentalBranchManagement_list — org scoping required', () => {
  function makeApp(user: { id: string; email: string } | null) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.get(
      '/dental/organizations/:orgId/branches',
      zValidator('param', DentalBranchManagement_listParams, validationErrorHandler),
      DentalBranchManagement_list as any,
    );
    return app;
  }

  test('non-member lists branches of foreign org → 403 [EF-ORG-002]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    // ATTACKER has no membership in ORG_A

    const app = makeApp(ATTACKER);
    const res = await app.request(`/dental/organizations/${ORG_A_ID}/branches`);

    expect(res.status).toBe(403);
  });

  test('org owner lists their own branches → 200 [EF-ORG-002 baseline]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);

    const app = makeApp(OWNER_A);
    const res = await app.request(`/dental/organizations/${ORG_A_ID}/branches`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items).toBeDefined();
  });

  test('org member lists org branches → 200 [EF-ORG-002 member baseline]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    await seedMembership(MEMBER_STAFF_ID, BRANCH_A_ID, STAFF_FULL.id, 'staff_full');

    const app = makeApp(STAFF_FULL);
    const res = await app.request(`/dental/organizations/${ORG_A_ID}/branches`);

    expect(res.status).toBe(200);
  });

  test('unauthenticated list branches → 401 [EF-ORG-002 unauthed]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);

    const app = makeApp(null);
    const res = await app.request(`/dental/organizations/${ORG_A_ID}/branches`);

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// EF-ORG-003: createMember — dentist_owner role required
// ===========================================================================

describe('EF-ORG-003 createMember — dentist_owner role required to invite staff', () => {
  function makeApp(user: { id: string; email: string } | null) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.post('/dental/org/members', createMember as any);
    return app;
  }

  test('read_only member cannot invite new staff → 403 [EF-ORG-003]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    await seedMembership(MEMBER_READONLY_ID, BRANCH_A_ID, READ_ONLY.id, 'read_only');

    const app = makeApp(READ_ONLY);
    const res = await app.request(`/dental/org/members?branchId=${BRANCH_A_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Staff', role: 'staff_full' }),
    });

    expect(res.status).toBe(403);
  });

  test('staff_full member cannot invite new staff → 403 [EF-ORG-003 staff]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    await seedMembership(MEMBER_STAFF_ID, BRANCH_A_ID, STAFF_FULL.id, 'staff_full');

    const app = makeApp(STAFF_FULL);
    const res = await app.request(`/dental/org/members?branchId=${BRANCH_A_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Staff', role: 'staff_full' }),
    });

    expect(res.status).toBe(403);
  });

  test('dentist_owner can invite new staff → 201 [EF-ORG-003 baseline]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    await seedMembership(MEMBER_OWNER_ID, BRANCH_A_ID, OWNER_A.id, 'dentist_owner');

    const app = makeApp(OWNER_A);
    const res = await app.request(`/dental/org/members?branchId=${BRANCH_A_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Staff', role: 'staff_full' }),
    });

    expect(res.status).toBe(201);
  });
});

// ===========================================================================
// EF-ORG-004: DentalMembershipManagement_deactivate — owner protection
// ===========================================================================

describe('EF-ORG-004 DentalMembershipManagement_deactivate — only dentist_owner can deactivate', () => {
  function makeApp(user: { id: string; email: string } | null) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.post(
      '/dental/organizations/:orgId/branches/:branchId/members/:membershipId/deactivate',
      zValidator('param', DentalMembershipManagement_deactivateParams, validationErrorHandler),
      zValidator('json', DentalMembershipManagement_deactivateBody, validationErrorHandler),
      DentalMembershipManagement_deactivate as any,
    );
    return app;
  }

  test('staff_full cannot deactivate any member → 403 [EF-ORG-004]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    await seedMembership(MEMBER_OWNER_ID, BRANCH_A_ID, OWNER_A.id, 'dentist_owner');
    await seedMembership(MEMBER_STAFF_ID, BRANCH_A_ID, STAFF_FULL.id, 'staff_full');

    const app = makeApp(STAFF_FULL);
    const res = await app.request(
      `/dental/organizations/${ORG_A_ID}/branches/${BRANCH_A_ID}/members/${MEMBER_OWNER_ID}/deactivate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );

    expect(res.status).toBe(403);
  });

  test('dentist_owner can deactivate staff_full member → 200 [EF-ORG-004 baseline]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    await seedMembership(MEMBER_OWNER_ID, BRANCH_A_ID, OWNER_A.id, 'dentist_owner');
    await seedMembership(MEMBER_STAFF_ID, BRANCH_A_ID, STAFF_FULL.id, 'staff_full');

    const app = makeApp(OWNER_A);
    const res = await app.request(
      `/dental/organizations/${ORG_A_ID}/branches/${BRANCH_A_ID}/members/${MEMBER_STAFF_ID}/deactivate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );

    expect(res.status).toBe(200);
  });

  test('org owner (via org-level bypass) can deactivate any membership → 200 [EF-ORG-004 org owner]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    // OWNER_A has no branch membership — exercises the org-level bypass path
    await seedMembership(MEMBER_STAFF_ID, BRANCH_A_ID, STAFF_FULL.id, 'staff_full');

    const app = makeApp(OWNER_A);
    const res = await app.request(
      `/dental/organizations/${ORG_A_ID}/branches/${BRANCH_A_ID}/members/${MEMBER_STAFF_ID}/deactivate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );

    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// EM-ORG-001: recoverPin — must reject unauthenticated requests
// ===========================================================================

describe('EM-ORG-001 recoverPin — authMiddleware required', () => {
  function makeApp(user: { id: string; email: string } | null) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    // Simulate the fixed route: authMiddleware check is embedded in the handler
    // (handler throws UnauthorizedError when user is absent)
    app.post('/dental/org/members/:memberId/recover-pin', recoverPin as any);
    return app;
  }

  test('unauthenticated recoverPin → 401 [EM-ORG-001]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    await seedMembership(MEMBER_OWNER_ID, BRANCH_A_ID, OWNER_A.id, 'dentist_owner');

    const answerHash = await Bun.password.hash('test', { algorithm: 'bcrypt', cost: 4 });
    await db.update(dentalMemberships)
      .set({ securityQuestion: 'What?', securityAnswerHash: answerHash })
      .where(sql`id = ${MEMBER_OWNER_ID}`);

    const app = makeApp(null); // no user
    const res = await app.request(`/dental/org/members/${MEMBER_OWNER_ID}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'test', newPin: '9999' }),
    });

    expect(res.status).toBe(401);
  });

  test('authenticated recoverPin with correct answer → 200 [EM-ORG-001 baseline]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    await seedMembership(MEMBER_OWNER_ID, BRANCH_A_ID, OWNER_A.id, 'dentist_owner');

    const answerHash = await Bun.password.hash('test', { algorithm: 'bcrypt', cost: 4 });
    await db.update(dentalMemberships)
      .set({ securityQuestion: 'What?', securityAnswerHash: answerHash })
      .where(sql`id = ${MEMBER_OWNER_ID}`);

    const app = makeApp(OWNER_A);
    const res = await app.request(`/dental/org/members/${MEMBER_OWNER_ID}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'test', newPin: '9999' }),
    });

    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// EF-ORG-P015: recoverPin — cross-branch PIN reset must be rejected
// ===========================================================================

describe('EF-ORG-P015 recoverPin — caller must belong to target member branch', () => {
  // Second org/branch for the cross-branch attacker
  const ORG_B_ID = 'e0050000-0000-1000-8000-000000000010';
  const BRANCH_B_ID = 'e0050000-0000-1000-8000-000000000020';
  const MEMBER_ATTACKER_ID = 'e0050000-0000-1000-8000-000000000040';

  function makeApp(user: { id: string; email: string } | null) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.post('/dental/org/members/:memberId/recover-pin', recoverPin as any);
    return app;
  }

  test('attacker in branch B cannot reset PIN of member in branch A → 403 [EF-ORG-P015]', async () => {
    // Target member lives in Branch A
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    await seedMembership(MEMBER_OWNER_ID, BRANCH_A_ID, OWNER_A.id, 'dentist_owner');

    // Attacker only has membership in Branch B (a different org)
    await seedOrg(ORG_B_ID, ATTACKER.id);
    await seedBranch(BRANCH_B_ID, ORG_B_ID, ATTACKER.id);
    await seedMembership(MEMBER_ATTACKER_ID, BRANCH_B_ID, ATTACKER.id, 'dentist_owner');

    // Target has a known security answer — attacker even knows the answer
    const answerHash = await Bun.password.hash('test', { algorithm: 'bcrypt', cost: 4 });
    await db.update(dentalMemberships)
      .set({ securityQuestion: 'What?', securityAnswerHash: answerHash })
      .where(sql`id = ${MEMBER_OWNER_ID}`);

    const app = makeApp(ATTACKER);
    const res = await app.request(`/dental/org/members/${MEMBER_OWNER_ID}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'test', newPin: '9999' }),
    });

    // assertBranchAccess must reject before the answer is ever checked
    expect(res.status).toBe(403);
  });

  test('member in same branch can reset PIN → 200 [EF-ORG-P015 baseline]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    await seedMembership(MEMBER_OWNER_ID, BRANCH_A_ID, OWNER_A.id, 'dentist_owner');

    const answerHash = await Bun.password.hash('test', { algorithm: 'bcrypt', cost: 4 });
    await db.update(dentalMemberships)
      .set({ securityQuestion: 'What?', securityAnswerHash: answerHash })
      .where(sql`id = ${MEMBER_OWNER_ID}`);

    const app = makeApp(OWNER_A);
    const res = await app.request(`/dental/org/members/${MEMBER_OWNER_ID}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'test', newPin: '9999' }),
    });

    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// EM-ORG-006: DentalOrganizationManagement_get — IDOR check
// ===========================================================================

describe('EM-ORG-006 DentalOrganizationManagement_get — ownership/membership check', () => {
  function makeApp(user: { id: string; email: string } | null) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', injectDeps(user));
    app.get(
      '/dental/organizations/:id',
      zValidator('param', DentalOrganizationManagement_getParams, validationErrorHandler),
      DentalOrganizationManagement_get as any,
    );
    return app;
  }

  test('non-member reads foreign org → 403 [EM-ORG-006]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    // ATTACKER is not owner and has no membership

    const app = makeApp(ATTACKER);
    const res = await app.request(`/dental/organizations/${ORG_A_ID}`);

    expect(res.status).toBe(403);
  });

  test('org owner reads own org → 200 [EM-ORG-006 baseline]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);

    const app = makeApp(OWNER_A);
    const res = await app.request(`/dental/organizations/${ORG_A_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(ORG_A_ID);
  });

  test('org member reads own org → 200 [EM-ORG-006 member baseline]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);
    await seedBranch(BRANCH_A_ID, ORG_A_ID, OWNER_A.id);
    await seedMembership(MEMBER_STAFF_ID, BRANCH_A_ID, STAFF_FULL.id, 'staff_full');

    const app = makeApp(STAFF_FULL);
    const res = await app.request(`/dental/organizations/${ORG_A_ID}`);

    expect(res.status).toBe(200);
  });

  test('unauthenticated read org → 401 [EM-ORG-006 unauthed]', async () => {
    await seedOrg(ORG_A_ID, OWNER_A.id);

    const app = makeApp(null);
    const res = await app.request(`/dental/organizations/${ORG_A_ID}`);

    expect(res.status).toBe(401);
  });
});
