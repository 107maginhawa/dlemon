/**
 * Module 7: Auth — FR9.7 PIN Recovery via Security Question
 *
 * Tests:
 * - Set security question (POST .../security-question)
 * - 400 if question or answer missing
 * - Recover PIN with correct answer → 200, PIN updated
 * - Recover PIN with wrong answer → 401 (normalized, increments attempts)
 * - Recover PIN with no security question set → 401 (same shape, no info leak)
 * - 400 if newPin invalid format
 * - After recovery, new PIN works (verifyPin)
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { ZodError } from 'zod';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { setSecurityQuestion, recoverPin } from './pinRecovery';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000055', email: 'test@clinic.com' };
const ORG_ID = 'eeeeeeee-0000-1000-8000-000000000055';
const BRANCH_ID = 'bbbbbbbb-0000-1000-8000-000000000055';
const MEMBER_ID = 'dddddddd-0000-1000-8000-000000000055';
const INITIAL_PIN = '1234';

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    if (err instanceof ZodError) return c.json({ error: err.issues.map(i => i.message).join('; ') }, 400);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    if (user) ctx.set('user', user);
    await next();
  });
  app.post('/dental/org/members/:memberId/security-question', setSecurityQuestion);
  app.post('/dental/org/members/:memberId/recover-pin', recoverPin);
  return app;
}

async function seedData() {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Test Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  const pinHash = await Bun.password.hash(INITIAL_PIN, { algorithm: 'bcrypt', cost: 4 });

  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Dr. Test', role: 'dentist_owner',
    pinHash,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
}

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE dental_membership, dental_branch, dental_organization
    RESTART IDENTITY CASCADE
  `);
});

// ---------------------------------------------------------------------------
// FR9.7: Security question setup
// ---------------------------------------------------------------------------

describe('POST .../security-question', () => {
  test('sets security question successfully', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/org/members/${MEMBER_ID}/security-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: "What is your mother's maiden name?", answer: 'Smith' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.question).toBe("What is your mother's maiden name?");
  });

  test('400 when question missing', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/org/members/${MEMBER_ID}/security-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'Smith' }),
    });
    expect(res.status).toBe(400);
  });

  test('400 when answer missing', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/org/members/${MEMBER_ID}/security-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What city?' }),
    });
    expect(res.status).toBe(400);
  });

  test('401 without auth', async () => {
    await seedData();
    const app = buildTestApp(); // no user
    const res = await app.request(`/dental/org/members/${MEMBER_ID}/security-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What city?', answer: 'Manila' }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// FR9.7: PIN recovery
// ---------------------------------------------------------------------------

describe('POST .../recover-pin (FR9.7)', () => {
  async function setupSecurityQuestion() {
    await seedData();
    const repo = new MembershipRepository(db);
    const answerHash = await Bun.password.hash('smith', { algorithm: 'bcrypt', cost: 4 });
    const { dentalMemberships: table } = await import('./repos/membership.schema');
    const { eq } = await import('drizzle-orm');
    await db.update(table).set({
      securityQuestion: "What is your mother's maiden name?",
      securityAnswerHash: answerHash,
    }).where(eq(table.id, MEMBER_ID));
  }

  test('recovers PIN with correct answer', async () => {
    await setupSecurityQuestion();
    const app = buildTestApp();
    const res = await app.request(`/dental/org/members/${MEMBER_ID}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'smith', newPin: '9999' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);

    // Verify new PIN works
    const repo = new MembershipRepository(db);
    const member = await repo.findOneById(MEMBER_ID);
    const pinValid = await Bun.password.verify('9999', member!.pinHash!);
    expect(pinValid).toBe(true);
  });

  test('401 with wrong answer (normalized response)', async () => {
    await setupSecurityQuestion();
    const app = buildTestApp();
    const res = await app.request(`/dental/org/members/${MEMBER_ID}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'jones', newPin: '9999' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
  });

  test('no security question returns same shape as wrong answer (no info leak)', async () => {
    await seedData(); // no security question
    const app = buildTestApp();
    const res = await app.request(`/dental/org/members/${MEMBER_ID}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'anything', newPin: '9999' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    // Must NOT leak that no security question is set
    expect(body.code).toBeUndefined();
  });

  test('wrong answer increments failed attempts', async () => {
    await setupSecurityQuestion();
    const app = buildTestApp();
    // First wrong attempt
    await app.request(`/dental/org/members/${MEMBER_ID}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'wrong', newPin: '9999' }),
    });
    const repo = new MembershipRepository(db);
    const member = await repo.findOneById(MEMBER_ID);
    expect(member!.pinFailedAttempts).toBe(1);
  });

  test('returns 429 after too many wrong answers', async () => {
    await setupSecurityQuestion();
    const app = buildTestApp();
    const repo = new MembershipRepository(db);
    // Exhaust attempts (threshold is 5 by default)
    for (let i = 0; i < 5; i++) {
      await app.request(`/dental/org/members/${MEMBER_ID}/recover-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: 'wrong', newPin: '9999' }),
      });
    }
    // Next attempt should be locked
    const res = await app.request(`/dental/org/members/${MEMBER_ID}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'smith', newPin: '9999' }),
    });
    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.message).toBe('Too many failed attempts');
    expect(body.lockedUntil).not.toBeNull();
  });

  test('successful recovery resets attempt counter', async () => {
    await setupSecurityQuestion();
    const app = buildTestApp();
    // Make a couple wrong attempts first
    for (let i = 0; i < 2; i++) {
      await app.request(`/dental/org/members/${MEMBER_ID}/recover-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: 'wrong', newPin: '9999' }),
      });
    }
    const repo = new MembershipRepository(db);
    let member = await repo.findOneById(MEMBER_ID);
    expect(member!.pinFailedAttempts).toBe(2);

    // Now succeed
    const res = await app.request(`/dental/org/members/${MEMBER_ID}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'smith', newPin: '9999' }),
    });
    expect(res.status).toBe(200);

    member = await repo.findOneById(MEMBER_ID);
    expect(member!.pinFailedAttempts).toBe(0);
  });

  test('400 when newPin invalid format', async () => {
    await setupSecurityQuestion();
    const app = buildTestApp();
    const res = await app.request(`/dental/org/members/${MEMBER_ID}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'smith', newPin: 'abc' }), // non-digits
    });
    expect(res.status).toBe(400);
  });

  test('case-insensitive answer matching', async () => {
    await setupSecurityQuestion();
    const app = buildTestApp();
    const res = await app.request(`/dental/org/members/${MEMBER_ID}/recover-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'SMITH', newPin: '7777' }), // uppercase
    });
    expect(res.status).toBe(200);
  });
});
