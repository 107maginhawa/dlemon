/**
 * Auth Security Hardening — Slice H
 *
 * Closes CF-37, CF-38, CF-39, CF-44, CF-46, CF-89
 *
 * Test groups:
 *   CF-38 / AUTH-02 — verifyPin cross-org → 403 (not 200)
 *   CF-38 / AUTH-02 — setPin cross-org → 403 (not 200)
 *   CF-39 / AUTH-03 — recoverPin with no auth header → 401 (not 200/500)
 *   CF-46 / AUTH-07 — verifyPin success writes audit log entry
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { auditLogEntries } from '@/handlers/audit/repos/audit.schema';
import { DentalMembershipManagement_verifyPin } from './DentalMembershipManagement_verifyPin';
import { DentalMembershipManagement_setPin } from './DentalMembershipManagement_setPin';
import { recoverPin } from './pinRecovery';
import {
  DentalMembershipManagement_verifyPinBody,
  DentalMembershipManagement_verifyPinParams,
  DentalMembershipManagement_setPinBody,
  DentalMembershipManagement_setPinParams,
} from '@/generated/openapi/validators';
import { zValidator } from '@hono/zod-validator';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// ---------------------------------------------------------------------------
// Org A — target org
// ---------------------------------------------------------------------------
const USER_A = { id: 'aa000000-0000-1000-8000-000000000001', email: 'user-a@org-a.com' };
const ORG_A = 'aaaa0000-0000-1000-8000-000000000001';
const BRANCH_A = 'aaab0000-0000-1000-8000-000000000001';
const MEMBER_A = 'aaac0000-0000-1000-8000-000000000001';

// ---------------------------------------------------------------------------
// Org B — attacker
// ---------------------------------------------------------------------------
const USER_B = { id: 'bb000000-0000-1000-8000-000000000002', email: 'user-b@org-b.com' };
const ORG_B = 'bbbb0000-0000-1000-8000-000000000002';
const BRANCH_B = 'bbbc0000-0000-1000-8000-000000000002';
const MEMBER_B = 'bbbd0000-0000-1000-8000-000000000002';

const PIN = '1234';

function validationErrorHandler(result: any, c: any) {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
}

function makeVerifyPinApp(user: { id: string; email: string } | null) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    if (err instanceof ZodError) return c.json({ error: err.issues.map(i => i.message).join('; ') }, 400);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) ctx.set('user', user);
    await next();
  });
  app.post(
    '/dental/organizations/:orgId/branches/:branchId/members/:membershipId/verify-pin',
    zValidator('param', DentalMembershipManagement_verifyPinParams, validationErrorHandler),
    zValidator('json', DentalMembershipManagement_verifyPinBody, validationErrorHandler),
    DentalMembershipManagement_verifyPin as any,
  );
  return app;
}

function makeSetPinApp(user: { id: string; email: string } | null) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    if (err instanceof ZodError) return c.json({ error: err.issues.map(i => i.message).join('; ') }, 400);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) ctx.set('user', user);
    await next();
  });
  app.post(
    '/dental/organizations/:orgId/branches/:branchId/members/:membershipId/set-pin',
    zValidator('param', DentalMembershipManagement_setPinParams, validationErrorHandler),
    zValidator('json', DentalMembershipManagement_setPinBody, validationErrorHandler),
    DentalMembershipManagement_setPin as any,
  );
  return app;
}

function makeRecoverPinApp(user: { id: string; email: string } | null) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    if (err instanceof ZodError) return c.json({ error: err.issues.map(i => i.message).join('; ') }, 400);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) ctx.set('user', user);
    await next();
  });
  app.post('/dental/org/members/:memberId/recover-pin', recoverPin);
  return app;
}

async function seedOrgWithMember(
  orgId: string,
  branchId: string,
  memberId: string,
  userId: string,
) {
  await db.insert(dentalOrganizations).values({
    id: orgId, name: `Clinic ${orgId.slice(0, 4)}`, tier: 'solo',
    ownerPersonId: userId, countryCode: 'PH',
    createdBy: userId, updatedBy: userId,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: branchId, organizationId: orgId, name: 'Main',
    timezone: 'Asia/Manila', createdBy: userId, updatedBy: userId,
  }).onConflictDoNothing();

  const pinHash = await Bun.password.hash(PIN, { algorithm: 'bcrypt', cost: 4 });

  await db.insert(dentalMemberships).values({
    id: memberId, branchId, personId: userId,
    displayName: 'Dr. Test', role: 'dentist_owner',
    pinHash,
    createdBy: userId, updatedBy: userId,
  }).onConflictDoNothing();
}

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE dental_membership, dental_branch, dental_organization
    RESTART IDENTITY CASCADE
  `);
  // Clean up any audit log entries created during tests
  await db.delete(auditLogEntries).execute();
});

// ---------------------------------------------------------------------------
// CF-38 / AUTH-02: verifyPin — cross-org must be 403
// ---------------------------------------------------------------------------

describe('CF-38 / AUTH-02 — verifyPin cross-org isolation', () => {
  test('Org-B user calling verifyPin on Org-A member → 403 [CF-38]', async () => {
    await seedOrgWithMember(ORG_A, BRANCH_A, MEMBER_A, USER_A.id);
    await seedOrgWithMember(ORG_B, BRANCH_B, MEMBER_B, USER_B.id);

    const app = makeVerifyPinApp(USER_B); // Org-B attacker
    const res = await app.request(
      `/dental/organizations/${ORG_A}/branches/${BRANCH_A}/members/${MEMBER_A}/verify-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: PIN }),
      }
    );
    expect(res.status).toBe(403);
  });

  test('Org-A user calling verifyPin on own member → 200/success [CF-38 baseline]', async () => {
    await seedOrgWithMember(ORG_A, BRANCH_A, MEMBER_A, USER_A.id);

    const app = makeVerifyPinApp(USER_A);
    const res = await app.request(
      `/dental/organizations/${ORG_A}/branches/${BRANCH_A}/members/${MEMBER_A}/verify-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: PIN }),
      }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
  });

  test('unauthenticated verifyPin → 401 [CF-38 auth baseline]', async () => {
    await seedOrgWithMember(ORG_A, BRANCH_A, MEMBER_A, USER_A.id);

    const app = makeVerifyPinApp(null);
    const res = await app.request(
      `/dental/organizations/${ORG_A}/branches/${BRANCH_A}/members/${MEMBER_A}/verify-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: PIN }),
      }
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// CF-38 / AUTH-02: setPin — cross-org must be 403
// ---------------------------------------------------------------------------

describe('CF-38 / AUTH-02 — setPin cross-org isolation', () => {
  test('Org-B user calling setPin on Org-A member → 403 [CF-38]', async () => {
    await seedOrgWithMember(ORG_A, BRANCH_A, MEMBER_A, USER_A.id);
    await seedOrgWithMember(ORG_B, BRANCH_B, MEMBER_B, USER_B.id);

    const app = makeSetPinApp(USER_B); // Org-B attacker
    const res = await app.request(
      `/dental/organizations/${ORG_A}/branches/${BRANCH_A}/members/${MEMBER_A}/set-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '9999' }),
      }
    );
    expect(res.status).toBe(403);
  });

  test('Org-A user calling setPin on own member → 200 [CF-38 baseline]', async () => {
    await seedOrgWithMember(ORG_A, BRANCH_A, MEMBER_A, USER_A.id);

    const app = makeSetPinApp(USER_A);
    const res = await app.request(
      `/dental/organizations/${ORG_A}/branches/${BRANCH_A}/members/${MEMBER_A}/set-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '9999' }),
      }
    );
    expect(res.status).toBe(200);
  });

  test('unauthenticated setPin → 401 [CF-38 auth baseline]', async () => {
    await seedOrgWithMember(ORG_A, BRANCH_A, MEMBER_A, USER_A.id);

    const app = makeSetPinApp(null);
    const res = await app.request(
      `/dental/organizations/${ORG_A}/branches/${BRANCH_A}/members/${MEMBER_A}/set-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '9999' }),
      }
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// CF-39 / AUTH-03: recoverPin — must require auth header
// ---------------------------------------------------------------------------

describe('CF-39 / AUTH-03 — recoverPin requires authentication', () => {
  async function setupSecurityQuestion(memberId: string) {
    const answerHash = await Bun.password.hash('smith', { algorithm: 'bcrypt', cost: 4 });
    await db.update(dentalMemberships)
      .set({
        securityQuestion: "What is your mother's maiden name?",
        securityAnswerHash: answerHash,
      })
      .where(eq(dentalMemberships.id, memberId));
  }

  test('recoverPin with no auth (no user) → 401 [CF-39]', async () => {
    await seedOrgWithMember(ORG_A, BRANCH_A, MEMBER_A, USER_A.id);
    await setupSecurityQuestion(MEMBER_A);

    const app = makeRecoverPinApp(null); // no user — unauthenticated
    const res = await app.request(`/dental/org/members/${MEMBER_A}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'smith', newPin: '9999' }),
    });
    expect(res.status).toBe(401);
  });

  test('recoverPin with valid auth → still works [CF-39 baseline]', async () => {
    await seedOrgWithMember(ORG_A, BRANCH_A, MEMBER_A, USER_A.id);
    await setupSecurityQuestion(MEMBER_A);

    const app = makeRecoverPinApp(USER_A); // authenticated as Org-A user
    const res = await app.request(`/dental/org/members/${MEMBER_A}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'smith', newPin: '9999' }),
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// EM-AUD-005: setPin success → audit log entry written
// ---------------------------------------------------------------------------

describe('EM-AUD-005 — setPin creates audit log entry on success', () => {
  test('successful setPin writes audit log entry [EM-AUD-005]', async () => {
    await seedOrgWithMember(ORG_A, BRANCH_A, MEMBER_A, USER_A.id);

    const app = makeSetPinApp(USER_A);
    const res = await app.request(
      `/dental/organizations/${ORG_A}/branches/${BRANCH_A}/members/${MEMBER_A}/set-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '9999' }),
      }
    );
    expect(res.status).toBe(200);

    // Audit log entry must exist for this member with action=update
    const entries = await db.select().from(auditLogEntries)
      .where(eq(auditLogEntries.resource, MEMBER_A));
    const pinEntries = entries.filter((e: any) => e.action === 'update' && e.resourceType === 'dental_membership');
    expect(pinEntries.length).toBeGreaterThan(0);
    const entry = pinEntries[0]!;
    expect(entry.outcome).toBe('success');
    expect(entry.category).toBe('security');
  });

  test('failed setPin (cross-org) does NOT write success audit entry [EM-AUD-005 negative]', async () => {
    await seedOrgWithMember(ORG_A, BRANCH_A, MEMBER_A, USER_A.id);
    await seedOrgWithMember(ORG_B, BRANCH_B, MEMBER_B, USER_B.id);

    const app = makeSetPinApp(USER_B); // attacker from Org B
    await app.request(
      `/dental/organizations/${ORG_A}/branches/${BRANCH_A}/members/${MEMBER_A}/set-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '9999' }),
      }
    );

    const entries = await db.select().from(auditLogEntries)
      .where(eq(auditLogEntries.resource, MEMBER_A));
    const successEntries = entries.filter((e: any) => e.outcome === 'success' && e.action === 'update');
    expect(successEntries.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CF-46 / AUTH-07: verifyPin success → audit log entry written
// ---------------------------------------------------------------------------

describe('CF-46 / AUTH-07 — verifyPin creates audit log entry on success', () => {
  test('successful verifyPin writes audit log entry [CF-46]', async () => {
    await seedOrgWithMember(ORG_A, BRANCH_A, MEMBER_A, USER_A.id);

    const app = makeVerifyPinApp(USER_A);
    const res = await app.request(
      `/dental/organizations/${ORG_A}/branches/${BRANCH_A}/members/${MEMBER_A}/verify-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: PIN }),
      }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);

    // Audit log entry must exist for this member
    const entries = await db.select().from(auditLogEntries)
      .where(eq(auditLogEntries.resource, MEMBER_A));
    expect(entries.length).toBeGreaterThan(0);
    const entry = entries[0]!;
    expect(entry.action).toBe('login');
    expect(entry.outcome).toBe('success');
  });

  test('failed verifyPin does NOT write a success audit log entry [CF-46 negative]', async () => {
    await seedOrgWithMember(ORG_A, BRANCH_A, MEMBER_A, USER_A.id);

    const app = makeVerifyPinApp(USER_A);
    await app.request(
      `/dental/organizations/${ORG_A}/branches/${BRANCH_A}/members/${MEMBER_A}/verify-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '0000' }), // wrong PIN
      }
    );

    const entries = await db.select().from(auditLogEntries)
      .where(eq(auditLogEntries.resource, MEMBER_A));
    const successEntries = entries.filter(e => e.outcome === 'success');
    expect(successEntries.length).toBe(0);
  });
});
