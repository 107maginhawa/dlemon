/**
 * appointment-completion-on-visit.test.ts — G-12 (prod-readiness audit)
 *
 * Bug: completing a visit never advanced the linked appointment. checkInAppointment
 * creates+links a visit and moves the appointment to 'checked_in', but the only
 * code path reaching appointment 'completed' was revertNoShow. APPOINTMENT_TRANSITIONS
 * allows checked_in→completed, yet a normally-checked-in appointment whose visit is
 * completed stayed 'checked_in' forever. Visit completion must advance its linked
 * appointment checked_in → completed.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { dentalAppointments } from './repos/dental-appointment.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { dentalTreatments } from '@/handlers/dental-visit/repos/treatment.schema';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { VisitNotesRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const USER = { id: '00000000-0000-0000-0000-0000000000c1', email: 'appt-owner@clinic.com' };
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000000c1';
const PERSON_ID = 'ee000000-0000-1000-8000-0000000000c1';
const BRANCH_ID = 'bb000000-0000-1000-8000-0000000000c2';
const MEMBER_ID = 'cc000000-0000-1000-8000-0000000000c3';
const VISIT_ID = 'dd000000-0000-1000-8000-0000000000c4';
const APPT_ID = 'ff000000-0000-1000-8000-0000000000c5';
const ORG_ID = 'ec000000-0000-1000-8000-0000000000c1';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Appt Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'App', lastName: 'Tee', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_treatment WHERE visit_id = ${VISIT_ID}`);
  await db.execute(sql`DELETE FROM visit_notes WHERE visit_id = ${VISIT_ID}`);
  await db.execute(sql`DELETE FROM consent_form WHERE visit_id = ${VISIT_ID}`);
  await db.execute(sql`DELETE FROM dental_appointment WHERE id = ${APPT_ID}`);
  await db.execute(sql`DELETE FROM dental_visit WHERE id = ${VISIT_ID}`);
});

async function seedCompletableVisitWithCheckedInAppointment(opts: { apptStatus?: string } = {}) {
  await db.insert(dentalVisits).values({
    id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
    status: 'active', createdBy: USER.id, updatedBy: USER.id,
  });
  await db.insert(dentalAppointments).values({
    id: APPT_ID, patientId: PATIENT_ID, dentistMemberId: MEMBER_ID, branchId: BRANCH_ID,
    scheduledAt: new Date(), durationMinutes: 30, serviceType: 'checkup',
    status: (opts.apptStatus ?? 'checked_in') as any, visitId: VISIT_ID,
    createdBy: USER.id, updatedBy: USER.id,
  });
  // completion guards: performed treatment + signed consent + notes
  await db.insert(dentalTreatments).values({
    id: crypto.randomUUID(), visitId: VISIT_ID, patientId: PATIENT_ID,
    cdtCode: 'D0120', description: 'Periodic eval', priceCents: 10000, status: 'performed',
    carriedOver: false, createdBy: USER.id, updatedBy: USER.id,
  });
  await db.insert(consentForms).values({
    visitId: VISIT_ID, patientId: PATIENT_ID, templateId: 'template-standard', templateName: 'Standard Consent',
    signed: true, signedAt: new Date(), signatureData: 'sig', createdBy: USER.id, updatedBy: USER.id,
  });
  await new VisitNotesRepository(db).upsert({
    visitId: VISIT_ID, authorMemberId: MEMBER_ID, subjective: 'pain', plan: 'extract',
    createdBy: USER.id, updatedBy: USER.id,
  });
}

describe('G-12: completing a visit advances its linked appointment to completed', () => {
  test('checked_in appointment → completed when its visit is completed', async () => {
    await seedCompletableVisitWithCheckedInAppointment();
    const app = buildTestApp({ db, user: USER });
    const res = await app.request(`/dental/visits/${VISIT_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(200);

    const [appt] = await db.select().from(dentalAppointments).where(eq(dentalAppointments.id, APPT_ID));
    expect(appt!.status).toBe('completed');
  });

  test('a cancelled appointment is NOT resurrected by visit completion (guarded)', async () => {
    await seedCompletableVisitWithCheckedInAppointment({ apptStatus: 'cancelled' });
    const app = buildTestApp({ db, user: USER });
    const res = await app.request(`/dental/visits/${VISIT_ID}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(200);
    const [appt] = await db.select().from(dentalAppointments).where(eq(dentalAppointments.id, APPT_ID));
    expect(appt!.status).toBe('cancelled'); // unchanged — only checked_in advances
  });
});
