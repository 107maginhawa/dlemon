/**
 * getDentalChart — per-visit layers integration test.
 *
 * When a visit has a chart row AND treatments, the GET response must include
 * a `layers` field with the derived tooth-number sets for completed/proposed/declined.
 * Derived via deriveLayerSets (chart-export.ts), same precedence contract used by
 * the FE chart-layers.ts.
 */
import { describe, test, expect, afterAll, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { VisitRepository } from '../repos/visit.repo';
import { DentalChartRepository } from '../repos/dental-chart.repo';
import { TreatmentRepository } from '../repos/treatment.repo';
import { getDentalChart } from './getDentalChart';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/monobase_test' });

const OWNER = { id: '00000000-0000-0000-0000-0000c8b57001', email: 'layertest@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-0000c8b57001';
const PERSON_ID  = 'e0000000-0000-1000-8000-0000c8b57001';
const BRANCH_ID  = 'b0000000-0000-1000-8000-0000c8b57001';
const ORG_ID     = 'd0000000-0000-1000-8000-0000c8b57001';
const MEMBER_ID  = 'c0000000-0000-1000-8000-0000c8b57001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Layers Clinic', tier: 'clinic', ownerPersonId: OWNER.id,
    countryCode: 'PH', createdBy: OWNER.id, updatedBy: OWNER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Layers Branch',
    timezone: 'Asia/Manila', createdBy: OWNER.id, updatedBy: OWNER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: OWNER.id, displayName: 'Dr Layer',
    role: 'dentist_owner', status: 'active', pinFailedAttempts: 0,
    createdBy: OWNER.id, updatedBy: OWNER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Layer', lastName: 'Patient',
    createdBy: OWNER.id, updatedBy: OWNER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: OWNER.id, updatedBy: OWNER.id,
  }).onConflictDoNothing();
});

// Cumulative layers read patient-scoped treatments, so each test must start clean —
// truncate visits (cascades to treatments + charts) between tests.
afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`).catch(() => {});
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_membership WHERE branch_id = ${BRANCH_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_patient WHERE id = ${PATIENT_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM person WHERE id = ${PERSON_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_branch WHERE id = ${BRANCH_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_organization WHERE id = ${ORG_ID}`).catch(() => {});
});

function app() {
  const a = new Hono();
  a.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  a.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('user', OWNER);
    ctx.set('session', { id: 's', userId: OWNER.id });
    await next();
  });
  a.get('/dental/visits/:visitId/chart', getDentalChart as any);
  return a;
}

type LayersBody = {
  layers: { completed: number[]; proposed: number[]; declined: number[] };
  changedThisVisit?: number[];
  terminalTeeth?: number[];
};

describe('getDentalChart — cumulative as-of treatment layers', () => {
  test('returns layers.completed=[11], layers.proposed=[21], layers.declined=[46] for matching treatments', async () => {
    // Single completed visit: its as-of derivation matches the per-visit result.
    const visitRepo = new VisitRepository(db);
    const visit = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', completedAt: new Date('2026-02-01') });

    const chartRepo = new DentalChartRepository(db);
    await chartRepo.upsert({
      visitId: visit.id,
      patientId: PATIENT_ID,
      teeth: [
        { toothNumber: 11, state: 'filled' },
        { toothNumber: 21, state: 'caries' },
        { toothNumber: 46, state: 'caries' },
      ],
    });

    const treatRepo = new TreatmentRepository(db);
    // tooth 11: performed (completed) — performedAt on/before the as-of visit date
    await treatRepo.createOne({
      visitId: visit.id, patientId: PATIENT_ID, toothNumber: 11,
      cdtCode: 'D2390', description: 'Composite filling', status: 'performed',
      performedAt: new Date('2026-02-01'), priceCents: 12000,
      createdBy: OWNER.id, updatedBy: OWNER.id,
    });
    // tooth 21: planned (proposed)
    await treatRepo.createOne({
      visitId: visit.id, patientId: PATIENT_ID, toothNumber: 21,
      cdtCode: 'D2391', description: 'Composite Class I', status: 'planned',
      priceCents: 15000, createdBy: OWNER.id, updatedBy: OWNER.id,
    });
    // tooth 46: declined
    await treatRepo.createOne({
      visitId: visit.id, patientId: PATIENT_ID, toothNumber: 46,
      cdtCode: 'D2750', description: 'Full crown', status: 'declined',
      priceCents: 60000, createdBy: OWNER.id, updatedBy: OWNER.id,
    });

    const res = await app().request(`/dental/visits/${visit.id}/chart`);
    expect(res.status).toBe(200);
    const body = await res.json() as LayersBody;

    expect(body.layers.completed).toEqual([11]);
    expect(body.layers.proposed).toEqual([21]);
    expect(body.layers.declined).toEqual([46]);
  });

  test('visit with chart but no treatments returns empty layers', async () => {
    const visitRepo = new VisitRepository(db);
    const visit = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', completedAt: new Date('2026-02-02') });

    const chartRepo = new DentalChartRepository(db);
    await chartRepo.upsert({
      visitId: visit.id,
      patientId: PATIENT_ID,
      teeth: [{ toothNumber: 11, state: 'healthy' }],
    });

    const res = await app().request(`/dental/visits/${visit.id}/chart`);
    expect(res.status).toBe(200);
    const body = await res.json() as LayersBody;

    expect(body.layers.completed).toEqual([]);
    expect(body.layers.proposed).toEqual([]);
    expect(body.layers.declined).toEqual([]);
  });

  test('cumulative: tooth 36 is Treated as-of V2 and Planned (re-flagged) as-of V3; changedThisVisit reflects the delta', async () => {
    const visitRepo = new VisitRepository(db);
    const treatRepo = new TreatmentRepository(db);
    const chartRepo = new DentalChartRepository(db);

    const v1 = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', completedAt: new Date('2026-01-10') });
    const v2 = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', completedAt: new Date('2026-03-05') });
    const v3 = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', completedAt: new Date('2026-06-20') });

    await chartRepo.upsert({ visitId: v2.id, patientId: PATIENT_ID, teeth: [{ toothNumber: 36, state: 'filled' }] });
    await chartRepo.upsert({ visitId: v3.id, patientId: PATIENT_ID, teeth: [{ toothNumber: 36, state: 'caries' }] });

    // Filling performed (origin V1, completed by V2's date).
    await treatRepo.createOne({
      visitId: v1.id, patientId: PATIENT_ID, toothNumber: 36, cdtCode: 'D2392',
      description: 'Composite filling', status: 'performed', performedAt: new Date('2026-03-05'),
      priceCents: 12000, createdBy: OWNER.id, updatedBy: OWNER.id,
    });
    // New RCT planned at V3.
    await treatRepo.createOne({
      visitId: v3.id, patientId: PATIENT_ID, toothNumber: 36, cdtCode: 'D3330',
      description: 'Root canal', status: 'planned', priceCents: 80000,
      createdBy: OWNER.id, updatedBy: OWNER.id,
    });

    const atV2 = await (await app().request(`/dental/visits/${v2.id}/chart`)).json() as LayersBody;
    expect(atV2.layers.completed).toContain(36);
    expect(atV2.changedThisVisit).toContain(36);

    const atV3 = await (await app().request(`/dental/visits/${v3.id}/chart`)).json() as LayersBody;
    expect(atV3.layers.proposed).toContain(36);     // open RCT outranks completed filling
    expect(atV3.layers.completed).not.toContain(36);
    expect(atV3.changedThisVisit).toContain(36);
  });

  test('an extracted tooth appears in terminalTeeth and not in actionable layers', async () => {
    const visitRepo = new VisitRepository(db);
    const treatRepo = new TreatmentRepository(db);
    const chartRepo = new DentalChartRepository(db);

    const v = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', completedAt: new Date('2026-08-01') });
    await chartRepo.upsert({ visitId: v.id, patientId: PATIENT_ID, teeth: [{ toothNumber: 46, state: 'extracted' }] });
    // A stale plan on the extracted tooth must be stripped (no actionable lifecycle).
    await treatRepo.createOne({
      visitId: v.id, patientId: PATIENT_ID, toothNumber: 46, cdtCode: 'D2750',
      description: 'Crown', status: 'planned', priceCents: 60000,
      createdBy: OWNER.id, updatedBy: OWNER.id,
    });

    const body = await (await app().request(`/dental/visits/${v.id}/chart`)).json() as LayersBody;
    expect(body.terminalTeeth).toContain(46);
    expect(body.layers.proposed).not.toContain(46);
  });
});
