/**
 * getDentalChart — per-visit layers integration test.
 *
 * When a visit has a chart row AND treatments, the GET response must include
 * a `layers` field with the derived tooth-number sets for completed/proposed/declined.
 * Derived via deriveLayerSets (chart-export.ts), same precedence contract used by
 * the FE chart-layers.ts.
 */
import { describe, test, expect, afterAll, beforeAll } from 'bun:test';
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

describe('getDentalChart — per-visit treatment layers', () => {
  test('returns layers.completed=[11], layers.proposed=[21], layers.declined=[46] for matching treatments', async () => {
    // Seed a visit
    const visitRepo = new VisitRepository(db);
    const visit = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });

    // Seed a chart for the visit with teeth 11, 21, 46
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

    // Seed treatments — insert at target status directly
    const treatRepo = new TreatmentRepository(db);
    // tooth 11: performed (completed)
    await treatRepo.createOne({
      visitId: visit.id,
      patientId: PATIENT_ID,
      toothNumber: 11,
      cdtCode: 'D2390',
      description: 'Composite filling',
      status: 'performed',
      priceCents: 12000,
      createdBy: OWNER.id,
      updatedBy: OWNER.id,
    });
    // tooth 21: planned (proposed)
    await treatRepo.createOne({
      visitId: visit.id,
      patientId: PATIENT_ID,
      toothNumber: 21,
      cdtCode: 'D2391',
      description: 'Composite Class I',
      status: 'planned',
      priceCents: 15000,
      createdBy: OWNER.id,
      updatedBy: OWNER.id,
    });
    // tooth 46: declined
    await treatRepo.createOne({
      visitId: visit.id,
      patientId: PATIENT_ID,
      toothNumber: 46,
      cdtCode: 'D2750',
      description: 'Full crown',
      status: 'declined',
      priceCents: 60000,
      createdBy: OWNER.id,
      updatedBy: OWNER.id,
    });

    const res = await app().request(`/dental/visits/${visit.id}/chart`);
    expect(res.status).toBe(200);
    const body = await res.json() as { layers: { completed: number[]; proposed: number[]; declined: number[] } };

    expect(body.layers.completed).toEqual([11]);
    expect(body.layers.proposed).toEqual([21]);
    expect(body.layers.declined).toEqual([46]);
  });

  test('visit with chart but no treatments returns empty layers', async () => {
    const visitRepo = new VisitRepository(db);
    const visit = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });

    const chartRepo = new DentalChartRepository(db);
    await chartRepo.upsert({
      visitId: visit.id,
      patientId: PATIENT_ID,
      teeth: [{ toothNumber: 11, state: 'healthy' }],
    });

    const res = await app().request(`/dental/visits/${visit.id}/chart`);
    expect(res.status).toBe(200);
    const body = await res.json() as { layers: { completed: number[]; proposed: number[]; declined: number[] } };

    expect(body.layers.completed).toEqual([]);
    expect(body.layers.proposed).toEqual([]);
    expect(body.layers.declined).toEqual([]);
  });
});
