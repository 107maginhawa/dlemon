/**
 * dental-org-audit-convergence.test.ts
 *
 * EM-AUD-005/008/009, EF-AUD-001..005 — Audit-table convergence.
 *
 * The dental audit VIEWER (getAuditEvents → GET /dental/audit-events) reads the
 * `dental_audit_log` table. Before this fix the dental-org handlers wrote audit
 * rows ONLY to the platform `audit_log_entry` table (via @/handlers/audit/repos/
 * audit.facade), so membership/PIN/org/branch changes were INVISIBLE in the
 * dental audit viewer.
 *
 * These tests assert the dental-org handlers now route through
 * @/core/audit-logger (which writes dental_audit + dental_audit_log) so the
 * events land in dental_audit_log AND are returned by the viewer endpoint.
 *
 * Per [[feedback_test_verification]]: the viewer assertion exercises the REAL
 * getAuditEvents handler end-to-end, not just a table read.
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
import { createMember } from './createMember';
import { DentalMembershipManagement_setPin } from './DentalMembershipManagement_setPin';
import { DentalBranchManagement_create } from './DentalBranchManagement_create';
import { DentalOrganizationManagement_create } from './DentalOrganizationManagement_create';
import { getAuditEvents } from '@/handlers/dental-audit/getAuditEvents';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ORG_ID    = 'ad000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'bd000000-0000-1000-8000-000000000001';
const OWNER_ID  = 'cd000000-0000-1000-8000-000000000001';

const owner = { id: OWNER_ID, email: 'owner@clinic.com', role: 'dentist_owner' };

function buildApp(user?: { id: string; email?: string; role?: string }) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    if (err instanceof ZodError) return c.json({ error: err.issues.map((i) => i.message).join('; ') }, 400);
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

  app.post('/dental/org/members', createMember);
  app.post(
    '/dental/organizations/:orgId/branches/:branchId/members/:membershipId/set-pin',
    zValidator('param', validators.DentalMembershipManagement_setPinParams, validationErrorHandler),
    zValidator('json', validators.DentalMembershipManagement_setPinBody, validationErrorHandler),
    DentalMembershipManagement_setPin as any,
  );
  app.post(
    '/dental/organizations/:orgId/branches',
    zValidator('param', validators.DentalBranchManagement_createParams, validationErrorHandler),
    zValidator('json', validators.DentalBranchManagement_createBody, validationErrorHandler),
    DentalBranchManagement_create as any,
  );
  app.post(
    '/dental/organizations',
    zValidator('json', validators.DentalOrganizationManagement_createBody, validationErrorHandler),
    DentalOrganizationManagement_create as any,
  );
  app.get('/dental/audit-events', getAuditEvents);
  return app;
}

async function seedOrgBranchOwner() {
  const orgRepo = new OrganizationRepository(db);
  await orgRepo.createOne({
    id: ORG_ID, name: 'Convergence Clinic', tier: 'clinic',
    ownerPersonId: OWNER_ID, countryCode: 'PH', active: true,
  });
  const branchRepo = new BranchRepository(db);
  await branchRepo.createOne({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', active: true,
  });
  const memberRepo = new MembershipRepository(db);
  await memberRepo.createOne({
    branchId: BRANCH_ID, personId: OWNER_ID, displayName: 'Owner',
    role: 'dentist_owner', status: 'active', pinFailedAttempts: 0,
  });
}

describe('dental-org audit convergence (dental_audit_log + viewer)', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_audit_log, dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // --------------------------------------------------------------------------
  // EM-AUD-008: membership create lands in dental_audit_log
  // --------------------------------------------------------------------------
  test('createMember writes a membership.create row to dental_audit_log', async () => {
    await seedOrgBranchOwner();
    const app = buildApp(owner);

    const res = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Audited Staff', role: 'staff_full' }),
    });
    expect(res.status).toBe(201);
    const member = (await res.json()) as any;

    const rows = await db.select().from(dentalAuditLog).where(eq(dentalAuditLog.targetId, member.id));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows[0]!;
    expect(row.action).toBe('membership.create');
    expect(row.targetType).toBe('dental_membership');
    expect(row.actorId).toBe(OWNER_ID);
    expect(row.branchId).toBe(BRANCH_ID);
    expect(row.eventType).toBe('data-modification');
  });

  // --------------------------------------------------------------------------
  // EM-AUD-009: membership create is VISIBLE in the dental audit VIEWER
  // --------------------------------------------------------------------------
  test('getAuditEvents returns the membership.create event (viewer is no longer blind)', async () => {
    await seedOrgBranchOwner();
    const app = buildApp(owner);

    const createRes = await app.request(`/dental/org/members?branchId=${BRANCH_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Visible Staff', role: 'staff_full' }),
    });
    expect(createRes.status).toBe(201);
    const member = (await createRes.json()) as any;

    const viewRes = await app.request(`/dental/audit-events?branchId=${BRANCH_ID}`);
    expect(viewRes.status).toBe(200);
    const body = (await viewRes.json()) as any;
    const events = body.data as any[];
    // V-AUD-003: getAuditEvents now maps DB rows to the contract DTO —
    // targetId→resourceId, targetType→resourceType (snapshots dropped).
    const membershipEvent = events.find(
      (e) => e.resourceId === member.id && e.action === 'membership.create',
    );
    expect(membershipEvent).toBeDefined();
    expect(membershipEvent.resourceType).toBe('dental_membership');
  });

  // --------------------------------------------------------------------------
  // EM-AUD-005: setPin (security event) lands in dental_audit_log + viewer
  // --------------------------------------------------------------------------
  test('setPin writes a security membership.set_pin row visible in the viewer', async () => {
    await seedOrgBranchOwner();
    // The owner's own membership id is needed as the set-pin target.
    const memberRepo = new MembershipRepository(db);
    const ownerMembership = await memberRepo.findByPersonAndBranch(OWNER_ID, BRANCH_ID);
    expect(ownerMembership).toBeTruthy();
    const app = buildApp(owner);

    const res = await app.request(
      `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${ownerMembership!.id}/set-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '123456' }),
      },
    );
    expect(res.status).toBe(200);

    const rows = await db.select().from(dentalAuditLog).where(eq(dentalAuditLog.targetId, ownerMembership!.id));
    const pinRow = rows.find((r) => r.action === 'membership.set_pin');
    expect(pinRow).toBeDefined();
    expect(pinRow!.eventType).toBe('security');
    expect(pinRow!.branchId).toBe(BRANCH_ID);

    // Visible in viewer too
    const viewRes = await app.request(`/dental/audit-events?branchId=${BRANCH_ID}&action=membership.set_pin`);
    expect(viewRes.status).toBe(200);
    const body = (await viewRes.json()) as any;
    expect((body.data as any[]).some((e) => e.action === 'membership.set_pin')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // EM-AUD-008: org + branch create land in dental_audit_log
  // --------------------------------------------------------------------------
  test('org and branch creation write rows to dental_audit_log', async () => {
    const adminApp = buildApp({ id: OWNER_ID, email: 'admin@clinic.com', role: 'admin' });

    const orgRes = await adminApp.request('/dental/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Audited Org', tier: 'solo', countryCode: 'PH' }),
    });
    expect(orgRes.status).toBe(201);
    const org = (await orgRes.json()) as any;

    const orgRows = await db.select().from(dentalAuditLog).where(eq(dentalAuditLog.targetId, org.id));
    expect(orgRows.some((r) => r.action === 'org.create' && r.targetType === 'dental_organization')).toBe(true);

    // Branch create (owner of the new org)
    const ownerApp = buildApp({ id: org.ownerPersonId, email: 'owner2@clinic.com', role: 'dentist_owner' });
    const branchRes = await ownerApp.request(`/dental/organizations/${org.id}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Branch', timezone: 'Asia/Manila' }),
    });
    expect(branchRes.status).toBe(201);
    const branch = (await branchRes.json()) as any;

    const branchRows = await db.select().from(dentalAuditLog).where(eq(dentalAuditLog.targetId, branch.id));
    expect(branchRows.some((r) => r.action === 'branch.create' && r.targetType === 'dental_branch')).toBe(true);
  });
});
