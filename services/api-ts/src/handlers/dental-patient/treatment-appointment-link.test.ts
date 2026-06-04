/**
 * treatment-appointment-link.test.ts — P1-21 plan → appointment linkage
 *
 * P1-21-AC1  POST attaches an appointment to a treatment (200, appointmentId set)
 * P1-21-AC2  DELETE detaches the appointment (200, appointmentId null)
 * P1-21-AC3  attaching a non-existent appointment → 400
 * P1-21-AC4  attaching to a non-existent treatment → 404
 * P1-21-AC5  appointment belonging to another patient → 400 (not found for patient)
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { attachTreatmentAppointment } from './treatment-plans/attachTreatmentAppointment';
import { detachTreatmentAppointment } from './treatment-plans/detachTreatmentAppointment';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a0000000-0000-1000-8000-0000000000ab', email: 'staff@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000ab';
const ORG_ID = 'c0000000-0000-1000-8000-0000000000ab';
const PATIENT_ID = 'd0000000-0000-1000-8000-0000000000ab';
const OTHER_PATIENT_ID = 'd0000000-0000-1000-8000-0000000000ac';
const PERSON_ID = 'e0000000-0000-1000-8000-0000000000ab';
const OTHER_PERSON_ID = 'e0000000-0000-1000-8000-0000000000ac';
const MEMBER_ID = 'a1000000-0000-1000-8000-0000000000ab';
const VISIT_ID = 'f0000000-0000-1000-8000-0000000000ab';
const TREATMENT_ID = 'f1000000-0000-1000-8000-0000000000ab';
const APPOINTMENT_ID = 'f2000000-0000-1000-8000-0000000000ab';
const OTHER_APPOINTMENT_ID = 'f2000000-0000-1000-8000-0000000000ac';
const MISSING_APPT_ID = 'f9000000-0000-1000-8000-0000000000ab';
const MISSING_TREATMENT_ID = 'f9000000-0000-1000-8000-0000000000ac';

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};
const Params = z.object({ patientId: z.string().uuid(), treatmentId: z.string().uuid() });
const AttachBody = z.object({ appointmentId: z.string().uuid() });

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');
  const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
  const { dentalAppointments } = await import('@/handlers/dental-scheduling/repos/dental-appointment.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Link Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Dentist',
    role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values([
    { id: PERSON_ID, firstName: 'Link', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: OTHER_PERSON_ID, firstName: 'Other', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
  ]).onConflictDoNothing();
  await db.insert(patients).values([
    { id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: OTHER_PATIENT_ID, person: OTHER_PERSON_ID, preferredBranchId: BRANCH_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
  ]).onConflictDoNothing();
  await db.insert(dentalVisits).values({
    id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
    status: 'draft', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  } as any).onConflictDoNothing();
  await db.insert(dentalTreatments).values({
    id: TREATMENT_ID, visitId: VISIT_ID, patientId: PATIENT_ID, cdtCode: 'D2740',
    description: 'Crown', status: 'planned', priceCents: 50000, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  } as any).onConflictDoNothing();
  await db.insert(dentalAppointments).values([
    { id: APPOINTMENT_ID, patientId: PATIENT_ID, dentistMemberId: MEMBER_ID, branchId: BRANCH_ID,
      scheduledAt: new Date(), serviceType: 'crown', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    { id: OTHER_APPOINTMENT_ID, patientId: OTHER_PATIENT_ID, dentistMemberId: MEMBER_ID, branchId: BRANCH_ID,
      scheduledAt: new Date(), serviceType: 'crown', createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
  ]).onConflictDoNothing();
});

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', TEST_USER);
    await next();
  });
  app.post('/dental/patients/:patientId/treatments/:treatmentId/appointment',
    zValidator('param', Params, ve), zValidator('json', AttachBody, ve), attachTreatmentAppointment as any);
  app.delete('/dental/patients/:patientId/treatments/:treatmentId/appointment',
    zValidator('param', Params, ve), detachTreatmentAppointment as any);
  return app;
}

afterEach(async () => {
  const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
  await db.update(dentalTreatments).set({ appointmentId: null }).where(eq(dentalTreatments.id, TREATMENT_ID));
});

describe('P1-21 — plan → appointment linkage', () => {
  test('P1-21-AC1: attach sets appointmentId', async () => {
    const app = buildApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatments/${TREATMENT_ID}/appointment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: APPOINTMENT_ID }),
    });
    expect(res.status).toBe(200);
    expect((await res.json() as any).appointmentId).toBe(APPOINTMENT_ID);
  });

  test('P1-21-AC2: detach clears appointmentId', async () => {
    const app = buildApp();
    await app.request(`/dental/patients/${PATIENT_ID}/treatments/${TREATMENT_ID}/appointment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: APPOINTMENT_ID }),
    });
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatments/${TREATMENT_ID}/appointment`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect((await res.json() as any).appointmentId).toBeNull();
  });

  test('P1-21-AC3: missing appointment → 400', async () => {
    const app = buildApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatments/${TREATMENT_ID}/appointment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: MISSING_APPT_ID }),
    });
    expect(res.status).toBe(400);
  });

  test('P1-21-AC4: missing treatment → 404', async () => {
    const app = buildApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatments/${MISSING_TREATMENT_ID}/appointment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: APPOINTMENT_ID }),
    });
    expect(res.status).toBe(404);
  });

  test('P1-21-AC5: appointment of another patient → 400', async () => {
    const app = buildApp();
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatments/${TREATMENT_ID}/appointment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: OTHER_APPOINTMENT_ID }),
    });
    expect(res.status).toBe(400);
  });
});
