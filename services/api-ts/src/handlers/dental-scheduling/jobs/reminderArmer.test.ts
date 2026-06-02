/**
 * reminderArmer + reminderCanceller integration tests (P1-24, plan §4 Slice A).
 *
 * Hits a REAL database with a REAL NotificationRepository (no buildTestApp-only
 * stubs) so we verify the actual notification rows are written/expired:
 *   - armer writes N scheduled notification rows for an upcoming appointment
 *   - armer is IDEMPOTENT (second run writes 0 duplicates)
 *   - consent gate: sms suppressed when not consented; in-app always written
 *   - canceller expires queued reminder rows for an appointment
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { NotificationRepository } from '@/handlers/notifs/repos/notification.repo';
import { PersonRepository } from '@/handlers/person/repos/person.repo';
import { reminderArmerJob } from './reminderArmer';
import { DentalAppointmentRepository } from '../repos/dental-appointment.repo';
import { notifications } from '@/handlers/notifs/repos/notification.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ACTOR = '00000000-0000-1000-8000-0000000000d1';
const PERSON_ID = 'a0000000-0000-1000-8000-0000000000d1';
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000000d2';
const ORG_ID = 'f0000000-0000-1000-8000-0000000000d1';
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000d1';
const MEMBER_ID = 'c0000000-0000-1000-8000-0000000000d1';

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };

function buildNotifsRepo() {
  const personRepo = new PersonRepository(db, noopLogger as any);
  return new NotificationRepository(db, personRepo, noopLogger);
}

// Minimal NotificationService surface the armer needs, backed by the real repo.
function buildNotifsService() {
  const repo = buildNotifsRepo();
  return {
    enqueueScheduledIfAbsent: repo.enqueueScheduledIfAbsent.bind(repo),
    expireQueuedByEntity: repo.expireQueuedByEntity.bind(repo),
  } as any;
}

function jobContext(notificationService: any) {
  return { db, logger: noopLogger, jobId: 'test', notificationService } as any;
}

async function seedConsent(channels: Record<string, boolean>, policyChannels: string[]) {
  await db.update(persons)
    .set({ consent: { registrationConsent: true, capturedAt: new Date().toISOString(), channels } as any })
    .where(eq(persons.id, PERSON_ID));
  await db.update(dentalBranches)
    .set({ settings: { reminderPolicy: { leadHours: [72, 24, 2], channels: policyChannels } } as any })
    .where(eq(dentalBranches.id, BRANCH_ID));
}

async function seedAppointment(hoursAhead = 80) {
  const repo = new DentalAppointmentRepository(db);
  return repo.createOne({
    patientId: PATIENT_ID,
    dentistMemberId: MEMBER_ID,
    branchId: BRANCH_ID,
    scheduledAt: new Date(Date.now() + hoursAhead * 3_600_000),
    durationMinutes: 30,
    serviceType: 'Cleaning',
  });
}

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Armer Test Clinic', tier: 'solo', ownerPersonId: ACTOR,
    countryCode: 'PH', createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Armer Branch', timezone: 'Asia/Manila',
    createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: ACTOR, displayName: 'Armer Dentist',
    role: 'dentist_owner', status: 'active', createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Armer', lastName: 'Patient', createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM notification WHERE related_entity_type = 'appointment'`);
  await db.execute(sql`DELETE FROM dental_appointment WHERE branch_id = ${BRANCH_ID}`);
});

async function reminderRowsFor(apptId: string) {
  return db.select().from(notifications)
    .where(and(eq(notifications.relatedEntity, apptId), eq(notifications.type, 'appointment.reminder')));
}

describe('reminderArmer (P1-24)', () => {
  test('writes scheduled reminder rows for an upcoming appointment, one per lead × consented channel', async () => {
    // email + in-app consented; policy = [email, in-app] → 2 channels × 3 leads = 6 rows.
    await seedConsent({ email: true }, ['email', 'in-app']);
    const appt = await seedAppointment(80); // 80h ahead → all of [72,24,2] are in the future

    await reminderArmerJob(jobContext(buildNotifsService()));

    const rows = await reminderRowsFor(appt.id);
    expect(rows.length).toBe(6);
    // All scheduled in the future, status queued, related to the appointment.
    for (const r of rows) {
      expect(r.status).toBe('queued');
      expect(r.scheduledAt).toBeTruthy();
    }
    const channels = new Set(rows.map((r) => r.channel));
    expect(channels.has('email')).toBe(true);
    expect(channels.has('in-app')).toBe(true);
  });

  test('is idempotent — a second run writes zero duplicates', async () => {
    await seedConsent({ email: true }, ['email', 'in-app']);
    const appt = await seedAppointment(80);

    const svc = buildNotifsService();
    await reminderArmerJob(jobContext(svc));
    const first = (await reminderRowsFor(appt.id)).length;
    await reminderArmerJob(jobContext(svc));
    const second = (await reminderRowsFor(appt.id)).length;

    expect(first).toBe(6);
    expect(second).toBe(6); // no duplicates
  });

  test('consent gate: SMS suppressed when not consented; in-app still written', async () => {
    // policy includes sms but patient has NOT consented to sms → sms rows suppressed.
    await seedConsent({ email: true }, ['email', 'sms', 'in-app']);
    const appt = await seedAppointment(80);

    await reminderArmerJob(jobContext(buildNotifsService()));

    const rows = await reminderRowsFor(appt.id);
    const channels = new Set(rows.map((r) => r.channel));
    expect(channels.has('sms')).toBe(false);
    expect(channels.has('email')).toBe(true);
    expect(channels.has('in-app')).toBe(true);
  });

  test('canceller: expireQueuedByEntity expires queued reminder rows', async () => {
    await seedConsent({ email: true }, ['email', 'in-app']);
    const appt = await seedAppointment(80);
    const svc = buildNotifsService();
    await reminderArmerJob(jobContext(svc));

    const expired = await svc.expireQueuedByEntity(appt.id, ['appointment.reminder', 'appointment.confirmation-request']);
    expect(expired).toBeGreaterThan(0);

    const rows = await reminderRowsFor(appt.id);
    expect(rows.every((r) => r.status === 'expired')).toBe(true);
  });

  test('lead times already in the past are skipped', async () => {
    await seedConsent({ email: true }, ['in-app']);
    // 1h ahead → 72h and 24h leads are in the past; only the 2h lead is... also past (1h<2h).
    const appt = await seedAppointment(1);
    await reminderArmerJob(jobContext(buildNotifsService()));
    const rows = await reminderRowsFor(appt.id);
    expect(rows.length).toBe(0);
  });
});
