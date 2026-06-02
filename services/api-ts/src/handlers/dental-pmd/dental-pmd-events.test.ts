/**
 * dental-pmd domain-event audit-trace tests
 *
 * Per ADR-006, dental-pmd domain events are AUDIT-LOG-ONLY semantic markers — there is
 * no event bus. A "publish" is satisfied by the producer writing a synchronous
 * dental_audit_log row via logAuditEvent. A publisher test therefore:
 *   1. triggers the producing HTTP action (via app.request through the real handler), then
 *   2. asserts a dental_audit_log row exists with the expected action / targetType /
 *      targetId / actorId.
 *
 * Events covered (previously untraced — TRACE_REPORT TR-P1-04):
 *   DE-017 PMDGenerated → action 'pmd.generated' (metadata.event 'DE-017') / target pmd
 *
 * generatePMD writes two audit rows: 'pmd.generate' (mutation trail) and 'pmd.generated'
 * (the DE-017 domain-event marker). This suite asserts the DE-017 marker specifically.
 *
 * Consumer / idempotency tests are out of scope (no bus, per ADR-006).
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { generatePMD } from './generatePMD';
import { importPMD } from './importPMD';
import { exportPMD } from './exportPMD';
import { GeneratePMDBody, GeneratePMDParams, ImportPMDBody, ExportPMDParams } from '@/generated/openapi/validators';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique IDs (tag pde) to avoid cross-suite membership collisions.
const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'pmd-de@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000bde01';
const BRANCH_ID = '7b000000-0000-4000-8000-0000000bde04';
const DENTIST_MEMBER_ID = '7c000000-0000-4000-8000-0000000bde04';
const ORG_ID = 'ef000000-0000-1000-8000-0000000bde01';
const PERSON_ID = 'f1000000-0000-1000-8000-0000000bde01';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'PMD-DE Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: DENTIST_MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Dr. Test', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'PMD', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) { ctx.set('user', user); ctx.set('session', { id: 'test-session' }); }
    await next();
  });
  const ve = (r: any, c: any) => { if (!r.success) return c.json({ error: r.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400); };
  const GeneratePMDBodyOnly = GeneratePMDBody.omit({ visitId: true });
  app.post('/dental/visits/:visitId/pmd', zValidator('param', GeneratePMDParams, ve), zValidator('json', GeneratePMDBodyOnly, ve), generatePMD as any);
  app.post('/dental/pmd/import', zValidator('json', ImportPMDBody, ve), importPMD as any);
  app.get('/dental/visits/:visitId/pmd/export', zValidator('param', ExportPMDParams, ve), exportPMD as any);
  return app;
}

async function seedCompletedVisit() {
  const repo = new VisitRepository(db);
  const visit = await repo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID });
  return repo.complete(visit.id);
}

async function seedDraftVisit() {
  const repo = new VisitRepository(db);
  return repo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: DENTIST_MEMBER_ID });
}

async function auditRows(action: string, targetId: string) {
  return db.select().from(dentalAuditLog)
    .where(and(eq(dentalAuditLog.action, action), eq(dentalAuditLog.targetId, targetId)));
}

afterEach(async () => {
  // dental_audit_log is append-only (DB trigger denies row UPDATE/DELETE, V-AUD-IMM-001).
  // Reset via table-level TRUNCATE, which the BEFORE ROW trigger does not block.
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
  await db.execute(sql`TRUNCATE TABLE pmd_document, imported_pmd, dental_visit CASCADE`);
});

// ---------------------------------------------------------------------------
// DE-017 PMDGenerated
// ---------------------------------------------------------------------------

describe('DE-017 PMDGenerated — audit-row marker on PMD generation', () => {
  test('writes a dental_audit_log row (pmd.generated) referencing the new PMD', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedCompletedVisit();

    const res = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(201);
    const pmd = await res.json() as any;

    const rows = await auditRows('pmd.generated', pmd.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('pmd');
    expect(rows[0]?.actorId).toBe(TEST_USER.id);
    expect(rows[0]?.branchId).toBe(BRANCH_ID);
    expect((rows[0]?.metadata as any)?.event).toBe('DE-017');
  });

  test('does NOT write a pmd.generated row when generation fails (non-completed visit)', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedDraftVisit();

    const res = await app.request(`/dental/visits/${visit.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(res.status).toBe(422);

    const rows = await db.select().from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.action, 'pmd.generated'), eq(dentalAuditLog.branchId, BRANCH_ID)));
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// pmd.import — audit-row marker on PMD import (P1-BE-2 / V-PMD-007)
// ---------------------------------------------------------------------------

const VALID_PMD_CONTENT = JSON.stringify({ conditions: ['I10'], medications: ['Amoxicillin'], allergies: [] });

describe('pmd.import — audit-row marker on imported PMD', () => {
  test('writes a dental_audit_log row (pmd.import) referencing the imported PMD', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, sourceFacility: 'City Dental', sourceDescription: 'Open Dental v21.1', content: VALID_PMD_CONTENT }),
    });
    expect(res.status).toBe(201);
    const imported = await res.json() as any;

    const rows = await auditRows('pmd.import', imported.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('imported-pmd');
    expect(rows[0]?.actorId).toBe(TEST_USER.id);
    expect(rows[0]?.branchId).toBe(BRANCH_ID);
  });

  test('does NOT write a pmd.import row when the import fails (unknown patient)', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/pmd/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: 'a0000000-0000-1000-8000-0000000bdeff', sourceFacility: 'City Dental', sourceDescription: 'Open Dental', content: VALID_PMD_CONTENT }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const rows = await db.select().from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.action, 'pmd.import'), eq(dentalAuditLog.branchId, BRANCH_ID)));
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// pmd.export — audit-row marker on PMD export (P1-BE-2 / V-PMD-007)
// ---------------------------------------------------------------------------

describe('pmd.export — audit-row marker on exported PMD', () => {
  async function seedGeneratedPMD(app: ReturnType<typeof buildTestApp>) {
    const visit = await seedCompletedVisit();
    const gen = await app.request(`/dental/visits/${visit!.id}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID }),
    });
    expect(gen.status).toBe(201);
    const pmd = await gen.json() as any;
    return { visitId: visit!.id, pmd };
  }

  test('writes a dental_audit_log row (pmd.export) referencing the exported PMD', async () => {
    const app = buildTestApp(TEST_USER);
    const { visitId, pmd } = await seedGeneratedPMD(app);

    const res = await app.request(`/dental/visits/${visitId}/pmd/export`);
    expect(res.status).toBe(200);

    const rows = await auditRows('pmd.export', pmd.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetType).toBe('pmd');
    expect(rows[0]?.actorId).toBe(TEST_USER.id);
    expect(rows[0]?.branchId).toBe(BRANCH_ID);
  });

  test('does NOT write a pmd.export row when export fails (no PMD for visit)', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedDraftVisit();
    const res = await app.request(`/dental/visits/${visit.id}/pmd/export`);
    expect(res.status).toBe(404);
    const rows = await db.select().from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.action, 'pmd.export'), eq(dentalAuditLog.branchId, BRANCH_ID)));
    expect(rows).toHaveLength(0);
  });
});
