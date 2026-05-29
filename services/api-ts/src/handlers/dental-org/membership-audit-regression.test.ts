/**
 * membership-audit-regression.test.ts
 *
 * AL-003 / AL-004 regression locks for the ROUTED membership handlers.
 *
 * The existing audit-persistence tests (createMember.test.ts / deactivateMember.test.ts)
 * exercise the NON-routed createMember.ts / deactivateMember.ts handlers. The endpoints
 * actually registered in the OpenAPI router are DentalMembershipManagement_create and
 * DentalMembershipManagement_deactivate (see src/generated/openapi/routes.ts +
 * registry.ts). Those routed handlers had NO regression lock on their audit writes — if
 * someone deleted the logAuditEvent call, no test would have caught it.
 *
 * Per [[feedback_test_verification]]: tests must exercise the REAL routed handler. We
 * register the routed handlers with the SAME validators/middleware shape as routes.ts and
 * assert audit rows land in dental_audit_log (the table the dental audit viewer reads)
 * after a successful create + deactivate.
 *
 * RED-proof: temporarily removing the logAuditEvent call from either routed handler turns
 * the corresponding test RED (verified manually during authoring, then restored).
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { validationErrorHandler } from '@/middleware/validation';
import * as validators from '@/generated/openapi/validators';
import { DentalMembershipManagement_create } from './DentalMembershipManagement_create';
import { DentalMembershipManagement_deactivate } from './DentalMembershipManagement_deactivate';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ORG_ID    = 'a9000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b9000000-0000-1000-8000-000000000001';
const PERSON_ID = 'c9000000-0000-1000-8000-000000000001';

const authedUser = { id: PERSON_ID, email: 'owner@clinic.com' };

/**
 * Build an app that registers the REAL routed handlers exactly as
 * src/generated/openapi/routes.ts does (same paths, same param/json validators,
 * same validationErrorHandler). authMiddleware is replaced with a test injector
 * that sets the same context the real middleware would.
 */
function buildTestApp(user?: typeof authedUser) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    if (err instanceof ZodError) {
      return c.json({ error: err.issues.map((i) => i.message).join('; ') }, 400);
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

  // Mirror routes.ts: DentalMembershipManagement_create
  app.post(
    '/dental/organizations/:orgId/branches/:branchId/members',
    zValidator('param', validators.DentalMembershipManagement_createParams, validationErrorHandler),
    zValidator('json', validators.DentalMembershipManagement_createBody, validationErrorHandler),
    DentalMembershipManagement_create as any,
  );

  // Mirror routes.ts: DentalMembershipManagement_deactivate
  app.post(
    '/dental/organizations/:orgId/branches/:branchId/members/:membershipId/deactivate',
    zValidator('param', validators.DentalMembershipManagement_deactivateParams, validationErrorHandler),
    zValidator('json', validators.DentalMembershipManagement_deactivateBody, validationErrorHandler),
    DentalMembershipManagement_deactivate as any,
  );

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
  // Seed dentist_owner membership for authedUser so assertBranchRole passes
  const membershipRepo = new MembershipRepository(db);
  await membershipRepo.createOne({
    branchId: BRANCH_ID,
    personId: PERSON_ID,
    displayName: 'Owner',
    role: 'dentist_owner',
    status: 'active',
    pinFailedAttempts: 0,
  });
  return membershipRepo;
}

describe('routed membership handlers — audit regression locks', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_audit_log, dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // AL-003: routed create-membership persists an audit row
  // --------------------------------------------------------------------------
  test('AL-003 (routed): DentalMembershipManagement_create persists audit record to DB', async () => {
    await seedOrgAndBranch();
    const app = buildTestApp(authedUser);

    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Audited Staff', role: 'staff_full' }),
      },
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.id).toBeTruthy();

    const rows = await db
      .select()
      .from(dentalAuditLog)
      .where(eq(dentalAuditLog.targetId, body.id));

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows[0]!;
    expect(row.action).toBe('membership.create');
    expect(row.targetType).toBe('dental_membership');
    expect(row.actorId).toBe(PERSON_ID);
    expect(row.eventType).toBe('data-modification');
  });

  // --------------------------------------------------------------------------
  // AL-004: routed deactivate-membership persists an audit row
  // --------------------------------------------------------------------------
  test('AL-004 (routed): DentalMembershipManagement_deactivate persists audit record to DB', async () => {
    const membershipRepo = await seedOrgAndBranch();
    const target = await membershipRepo.createOne({
      branchId: BRANCH_ID,
      displayName: 'Staff Eve',
      role: 'staff_full',
      status: 'active',
      pinFailedAttempts: 0,
    });

    const app = buildTestApp(authedUser);

    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${target.id}/deactivate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'left the clinic' }),
      },
    );

    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(dentalAuditLog)
      .where(eq(dentalAuditLog.targetId, target.id));

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows[0]!;
    expect(row.action).toBe('membership.deactivate');
    expect(row.targetType).toBe('dental_membership');
    expect(row.actorId).toBe(PERSON_ID);
    expect(row.eventType).toBe('data-modification');
  });
});
