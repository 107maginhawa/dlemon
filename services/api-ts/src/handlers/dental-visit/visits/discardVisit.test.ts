/**
 * discardVisit handler tests — the owner-initiated "Discard visit" escape hatch.
 *
 * Makes the error message's "…or discard it first" real: an open visit with no
 * durable clinical/financial/legal artifact can be abandoned (active → discarded),
 * which dismisses its pending treatments and frees the patient to start a new visit.
 *
 * Guards (safe-to-discard): rejects if any treatment is performed/verified or billed,
 * or the visit has a signed consent or attachments. Owner-only. Reason required.
 * Mounts the GENERATED validator so the wire contract is exercised.
 */
import { describe, test, expect, afterEach, beforeAll, afterAll } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { DiscardVisitBody, DiscardVisitParams } from '@/generated/openapi/validators';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { VisitRepository } from '../repos/visit.repo';
import { TreatmentRepository } from '../repos/treatment.repo';
import { discardVisit } from './discardVisit';
import { createApp } from '@/app';
import { parseConfig } from '@/core/config';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const OWNER = { id: '00000000-0000-0000-0000-00000d1ca5d1', email: 'discardowner@clinic.com' };
const ASSOC = { id: '00000000-0000-0000-0000-00000d1ca5d2', email: 'discardassoc@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000d1ca5';
const PERSON_ID = 'e0000000-0000-1000-8000-0000000d1ca5';
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000d1ca5';
const ORG_ID = 'db000000-0000-1000-8000-0000000d1ca5';
const OWNER_MEMBER = 'c0000000-0000-1000-8000-0000000d1c01';
const ASSOC_MEMBER = 'c0000000-0000-1000-8000-0000000d1c02';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Discard Clinic', tier: 'clinic', ownerPersonId: OWNER.id, countryCode: 'PH', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Discard Branch', timezone: 'Asia/Manila', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values([
    { id: OWNER_MEMBER, branchId: BRANCH_ID, personId: OWNER.id, displayName: 'Dr Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER.id, updatedBy: OWNER.id },
    { id: ASSOC_MEMBER, branchId: BRANCH_ID, personId: ASSOC.id, displayName: 'Dr Assoc', role: 'dentist_associate', status: 'active', pinFailedAttempts: 0, createdBy: OWNER.id, updatedBy: OWNER.id },
  ]).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Discard', lastName: 'Patient', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM dental_membership WHERE branch_id = ${BRANCH_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_branch WHERE id = ${BRANCH_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_organization WHERE id = ${ORG_ID}`).catch(() => {});
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_treatment, dental_chart, visit_notes, dental_visit CASCADE`);
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

function buildApp(user: typeof OWNER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    ctx.set('user', user);
    ctx.set('session', { id: 'sess', userId: user.id });
    await next();
  });
  app.post('/dental/visits/:visitId/discard', zValidator('param', DiscardVisitParams, ve), zValidator('json', DiscardVisitBody, ve), discardVisit as any);
  return app;
}

async function seedActiveVisit() {
  const repo = new VisitRepository(db);
  const v = await repo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: OWNER_MEMBER });
  await repo.activate(v.id);
  return v;
}

async function discard(user: typeof OWNER, visitId: string, body: unknown) {
  return buildApp(user).request(`/dental/visits/${visitId}/discard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Real-app route registration — a handler unit test can't catch an unwired route.
describe('POST /dental/visits/:id/discard is registered (real createApp)', () => {
  test('returns 401 (not 404) without auth — route is wired', async () => {
    const realApp = createApp(parseConfig());
    const res = await realApp.request(`/dental/visits/${'b0000000-0000-1000-8000-0000000d1ca5'}/discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'route registration probe' }),
    });
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });
});

describe('discardVisit', () => {
  test('owner discards an open visit with only pending treatments → 200, status discarded, treatments dismissed', async () => {
    const visit = await seedActiveVisit();
    const tRepo = new TreatmentRepository(db);
    const t = await tRepo.createOne({ visitId: visit.id, patientId: PATIENT_ID, cdtCode: 'D1110', description: 'Cleaning', priceCents: 5000, carriedOver: false });

    const res = await discard(OWNER, visit.id, { reason: 'Patient left without being seen' });
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('discarded');

    const reloaded = await new VisitRepository(db).findOneById(visit.id);
    expect(reloaded?.status).toBe('discarded');
    const dismissed = await tRepo.findOneById(t.id);
    expect(dismissed?.status).toBe('dismissed');
  });

  test('writes a visit.discard audit row with the reason', async () => {
    const visit = await seedActiveVisit();
    await discard(OWNER, visit.id, { reason: 'Created in error' });
    const { dentalAuditLog } = await import('@/handlers/dental-audit/repos/audit-log.schema');
    const rows = await db.select().from(dentalAuditLog).where(eq(dentalAuditLog.action, 'visit.discard'));
    expect(rows.length).toBe(1);
    expect(rows[0]!.reason).toBe('Created in error');
  });

  test('reason too short → 400 (validator)', async () => {
    const visit = await seedActiveVisit();
    const res = await discard(OWNER, visit.id, { reason: 'x' });
    expect(res.status).toBe(400);
  });

  test('non-owner (associate) → 403', async () => {
    const visit = await seedActiveVisit();
    const res = await discard(ASSOC, visit.id, { reason: 'should be denied' });
    expect(res.status).toBe(403);
  });

  test('blocked when a treatment is performed (durable clinical work)', async () => {
    const visit = await seedActiveVisit();
    const tRepo = new TreatmentRepository(db);
    const t = await tRepo.createOne({ visitId: visit.id, patientId: PATIENT_ID, cdtCode: 'D2391', description: 'Composite', priceCents: 40000, carriedOver: false });
    await tRepo.updateStatus(t.id, 'performed');

    const res = await discard(OWNER, visit.id, { reason: 'trying to discard performed work' });
    expect(res.status).toBeGreaterThanOrEqual(409);
    expect(res.status).toBeLessThan(500);
    expect((await res.json() as { code?: string }).code).toBe('VISIT_NOT_DISCARDABLE');
  });

  test('blocked when a treatment is already billed', async () => {
    const visit = await seedActiveVisit();
    const tRepo = new TreatmentRepository(db);
    const t = await tRepo.createOne({ visitId: visit.id, patientId: PATIENT_ID, cdtCode: 'D1110', description: 'Cleaning', priceCents: 5000, carriedOver: false });
    await tRepo.setBilledInvoiceId([t.id], 'f0000000-0000-1000-8000-0000000d1cb1');

    const res = await discard(OWNER, visit.id, { reason: 'trying to discard billed work' });
    // VISIT_NOT_DISCARDABLE is a BusinessLogicError (422), consistent with the
    // visit-completion gates (VISIT_HAS_OPEN_TREATMENTS).
    expect(res.status).toBe(422);
    expect((await res.json() as { code?: string }).code).toBe('VISIT_NOT_DISCARDABLE');
  });
});
