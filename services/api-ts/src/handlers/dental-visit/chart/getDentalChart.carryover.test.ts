/**
 * getDentalChart — living-document carry-over integration test.
 *
 * A new visit with no chart row of its own inherits the patient's cumulative
 * existing dentition from the baseline (returning patient). A patient with no
 * baseline still 404s (first-ever → FE "Initialize Dentition").
 */
import { describe, test, expect, afterAll, beforeAll } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { VisitRepository } from '../repos/visit.repo';
import { getDentalChart } from './getDentalChart';
import { CARRYOVER_CHART_ID } from './chart-carryover';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const OWNER = { id: '00000000-0000-0000-0000-00000c8a5701', email: 'chartowner@clinic.com' };
const PATIENT_BL = 'a0000000-0000-1000-8000-00000c8a5701'; // has a baseline
const PATIENT_NEW = 'a0000000-0000-1000-8000-00000c8a5702'; // no baseline
const PERSON_BL = 'e0000000-0000-1000-8000-00000c8a5701';
const PERSON_NEW = 'e0000000-0000-1000-8000-00000c8a5702';
const BRANCH_ID = 'b0000000-0000-1000-8000-00000c8a5701';
const ORG_ID = 'db000000-0000-1000-8000-00000c8a5701';
const MEMBER_ID = 'c0000000-0000-1000-8000-00000c8a5701';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { dentalPatientChartBaselines } = await import('../repos/dental-chart-baseline.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Chart Clinic', tier: 'clinic', ownerPersonId: OWNER.id, countryCode: 'PH', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Chart Branch', timezone: 'Asia/Manila', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: OWNER.id, displayName: 'Dr Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(persons).values([
    { id: PERSON_BL, firstName: 'Returning', lastName: 'Patient', createdBy: OWNER.id, updatedBy: OWNER.id },
    { id: PERSON_NEW, firstName: 'New', lastName: 'Patient', createdBy: OWNER.id, updatedBy: OWNER.id },
  ]).onConflictDoNothing();
  await db.insert(patients).values([
    { id: PATIENT_BL, person: PERSON_BL, preferredBranchId: BRANCH_ID, createdBy: OWNER.id, updatedBy: OWNER.id },
    { id: PATIENT_NEW, person: PERSON_NEW, preferredBranchId: BRANCH_ID, createdBy: OWNER.id, updatedBy: OWNER.id },
  ]).onConflictDoNothing();
  // PATIENT_BL has a prior charted mouth: #19 crown (existing), #14 missing (existing).
  await db.insert(dentalPatientChartBaselines).values({
    patientId: PATIENT_BL,
    teeth: [
      { toothNumber: 19, state: 'crown', entryClassification: 'existing' },
      { toothNumber: 14, state: 'missing', entryClassification: 'existing' },
    ] as any,
    createdBy: OWNER.id, updatedBy: OWNER.id,
  }).onConflictDoNothing();
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM dental_patient_chart_baseline WHERE patient_id IN (${PATIENT_BL}, ${PATIENT_NEW})`).catch(() => {});
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_membership WHERE branch_id = ${BRANCH_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_patient WHERE id IN (${PATIENT_BL}, ${PATIENT_NEW})`).catch(() => {});
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

async function newVisit(patientId: string) {
  return new VisitRepository(db).createOne({ patientId, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });
}

describe('getDentalChart — baseline carry-over', () => {
  test('returning patient: a chartless new visit inherits the baseline dentition (200)', async () => {
    const visit = await newVisit(PATIENT_BL);
    const res = await app().request(`/dental/visits/${visit.id}/chart`);
    expect(res.status).toBe(200);
    const chart = await res.json() as { id: string; visitId: string; teeth: { toothNumber: number; state: string }[] };
    expect(chart.id).toBe(CARRYOVER_CHART_ID);
    expect(chart.visitId).toBe(visit.id);
    expect(chart.teeth.find((t) => t.toothNumber === 19)?.state).toBe('crown');
    expect(chart.teeth.find((t) => t.toothNumber === 14)?.state).toBe('missing');
  });

  test('first-ever patient: no baseline → 404 (FE shows Initialize Dentition)', async () => {
    const visit = await newVisit(PATIENT_NEW);
    const res = await app().request(`/dental/visits/${visit.id}/chart`);
    expect(res.status).toBe(404);
  });
});
