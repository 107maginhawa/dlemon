/**
 * clinical-prescription-history handler tests
 *
 * Covers:
 *   - createPrescription          POST /dental/visits/:visitId/prescriptions
 *   - listPrescriptions           GET  /dental/visits/:visitId/prescriptions
 *   - updatePrescription          PATCH /dental/visits/:visitId/prescriptions/:prescriptionId
 *   - createMedicalHistoryEntry   POST /dental/clinical/medical-history
 *   - listMedicalHistory          GET  /dental/clinical/medical-history?patientId=...
 *   - updateMedicalHistoryEntry   PATCH /dental/clinical/medical-history/:entryId
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreatePrescriptionBody, CreatePrescriptionParams,
  UpdatePrescriptionBody, UpdatePrescriptionParams,
  CreateMedicalHistoryEntryBody,
  UpdateMedicalHistoryEntryBody, UpdateMedicalHistoryEntryParams,
} from '@/generated/openapi/validators';
import { createPrescription } from './prescriptions/createPrescription';
import { listPrescriptions } from './prescriptions/listPrescriptions';
import { updatePrescription } from './prescriptions/updatePrescription';
import { createMedicalHistoryEntry } from './medical-history/createMedicalHistoryEntry';
import { listMedicalHistory } from './medical-history/listMedicalHistory';
import { updateMedicalHistoryEntry } from './medical-history/updateMedicalHistoryEntry';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const STAFF_USER = { id: '00000000-0000-0000-0000-000000000099', email: 'staff@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000002';
const ORG_ID = 'd2000000-0000-1000-8000-000000000002';
const MEMBER_ID = 'c0000000-0000-1000-8000-000000000003';
const STAFF_MEMBER_ID = 'c0000000-0000-1000-8000-000000000099';
const SCHEDULING_USER = { id: '00000000-0000-0000-0000-000000000098', email: 'scheduling@clinic.com' };
const SCHEDULING_MEMBER_ID = 'c0000000-0000-1000-8000-000000000098';
const NONEXISTENT_ID = 'ffffffff-ffff-4000-8000-ffffffffffff';

const PERSON_ID = 'f2000000-0000-1000-8000-000000000002';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'PrescriptionHistory Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: 'ee200000-0000-1000-8000-000000000002', branchId: BRANCH_ID,
    personId: TEST_USER.id, displayName: 'Test Dentist', role: 'dentist_owner',
    status: 'active', pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: STAFF_MEMBER_ID, branchId: BRANCH_ID,
    personId: STAFF_USER.id, displayName: 'Test Staff', role: 'staff_full',
    status: 'active', pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: SCHEDULING_MEMBER_ID, branchId: BRANCH_ID,
    personId: SCHEDULING_USER.id, displayName: 'Scheduling Staff', role: 'staff_scheduling',
    status: 'active', pinFailedAttempts: 0,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  // Seed person + patient for medical history tests (handler checks patient exists + has preferredBranchId)
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Test', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const PrescriptionBodyOnly = CreatePrescriptionBody.omit({ visitId: true });

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
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post('/dental/visits/:visitId/prescriptions',
    zValidator('param', CreatePrescriptionParams, ve),
    zValidator('json', PrescriptionBodyOnly, ve),
    createPrescription as any,
  );
  app.get('/dental/visits/:visitId/prescriptions', listPrescriptions);
  app.patch('/dental/visits/:visitId/prescriptions/:prescriptionId',
    zValidator('param', UpdatePrescriptionParams, ve),
    zValidator('json', UpdatePrescriptionBody, ve),
    updatePrescription as any,
  );
  app.post('/dental/clinical/medical-history',
    zValidator('json', CreateMedicalHistoryEntryBody, ve),
    createMedicalHistoryEntry as any,
  );
  app.get('/dental/clinical/medical-history', listMedicalHistory);
  app.patch('/dental/clinical/medical-history/:entryId',
    zValidator('param', UpdateMedicalHistoryEntryParams, ve),
    zValidator('json', UpdateMedicalHistoryEntryBody, ve),
    updateMedicalHistoryEntry as any,
  );

  return app;
}

async function seedVisit() {
  const { VisitRepository } = await import('@/handlers/dental-visit/repos/visit.repo');
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
  });
  return visit;
}

afterEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE amendment, consent_form, dental_attachment, lab_order, medical_history_entry, prescription, dental_treatment, dental_visit CASCADE`,
  );
});

// ---------------------------------------------------------------------------
// createPrescription
// ---------------------------------------------------------------------------

describe('createPrescription handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        prescriberMemberId: MEMBER_ID,
        drugName: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'TID',
      }),
    });

    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prescriberMemberId: MEMBER_ID,
        drugName: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'TID',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when prescriberMemberId is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        drugName: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'TID',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when drugName is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        prescriberMemberId: MEMBER_ID,
        dosage: '500mg',
        frequency: 'TID',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when dosage is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        prescriberMemberId: MEMBER_ID,
        drugName: 'Amoxicillin',
        frequency: 'TID',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when frequency is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        prescriberMemberId: MEMBER_ID,
        drugName: 'Amoxicillin',
        dosage: '500mg',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 201 with created prescription on valid input', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        prescriberMemberId: MEMBER_ID,
        drugName: 'Ibuprofen',
        dosage: '400mg',
        frequency: 'BID',
        duration: '5 days',
        instructions: 'Take with food',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.visitId).toBe(visit.id);
    expect(body.drugName).toBe('Ibuprofen');
    expect(body.dosage).toBe('400mg');
    expect(body.frequency).toBe('BID');
    expect(body.instructions).toBe('Take with food');
  });
});

// ---------------------------------------------------------------------------
// listPrescriptions
// ---------------------------------------------------------------------------

describe('listPrescriptions handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`);

    expect(res.status).toBe(401);
  });

  test('returns 200 with empty items array for a new visit', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  test('returns 200 with seeded prescriptions', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        prescriberMemberId: MEMBER_ID,
        drugName: 'Metronidazole',
        dosage: '250mg',
        frequency: 'TID',
      }),
    });

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(1);
    expect(body.pagination.totalCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// updatePrescription
// ---------------------------------------------------------------------------

describe('updatePrescription handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const visit = await seedVisit();

    const res = await app.request(
      `/dental/visits/${visit.id}/prescriptions/${NONEXISTENT_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dosage: '250mg' }),
      },
    );

    expect(res.status).toBe(401);
  });

  test('returns 404 when prescription does not exist', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const res = await app.request(
      `/dental/visits/${visit.id}/prescriptions/${NONEXISTENT_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dosage: '250mg' }),
      },
    );

    expect(res.status).toBe(404);
  });

  test('returns 200 with updated prescription fields', async () => {
    const app = buildTestApp(TEST_USER);
    const visit = await seedVisit();

    const createRes = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        prescriberMemberId: MEMBER_ID,
        drugName: 'Clindamycin',
        dosage: '150mg',
        frequency: 'QID',
      }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(
      `/dental/visits/${visit.id}/prescriptions/${created.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dosage: '300mg', duration: '7 days' }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(created.id);
    expect(body.dosage).toBe('300mg');
    expect(body.duration).toBe('7 days');
  });
});

// ---------------------------------------------------------------------------
// createMedicalHistoryEntry
// ---------------------------------------------------------------------------

describe('createMedicalHistoryEntry handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        entryType: 'condition',
        displayName: 'Hypertension',
      }),
    });

    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId is missing', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryType: 'condition',
        displayName: 'Hypertension',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when entryType is invalid', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        entryType: 'diagnosis',
        displayName: 'Hypertension',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 400 when displayName is missing', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        entryType: 'condition',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 201 with created entry on valid input', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        entryType: 'allergy',
        displayName: 'Penicillin allergy',
        notes: 'Causes rash and hives',
        codeSystem: 'RxNorm',
        code: '7980',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.entryType).toBe('allergy');
    expect(body.displayName).toBe('Penicillin allergy');
    expect(body.active).toBe(true);
  });

  test('returns 201 for all valid entryType values', async () => {
    const app = buildTestApp(TEST_USER);
    const validTypes = ['condition', 'medication', 'allergy', 'procedure', 'vaccination', 'family_history'];

    for (const entryType of validTypes) {
      const res = await app.request('/dental/clinical/medical-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: PATIENT_ID,
          entryType,
          displayName: `Test ${entryType}`,
        }),
      });

      expect(res.status).toBe(201);
    }
  });
});

// ---------------------------------------------------------------------------
// listMedicalHistory
// ---------------------------------------------------------------------------

describe('listMedicalHistory handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request(`/dental/clinical/medical-history?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(401);
  });

  test('returns 400 when patientId query param is missing', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/clinical/medical-history');

    expect(res.status).toBe(400);
  });

  test('returns 200 with empty items for patient with no history', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/clinical/medical-history?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  test('returns 200 with seeded entries for patient', async () => {
    const app = buildTestApp(TEST_USER);

    await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        entryType: 'condition',
        displayName: 'Type 2 Diabetes',
      }),
    });

    await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        entryType: 'medication',
        displayName: 'Metformin 500mg',
      }),
    });

    const res = await app.request(`/dental/clinical/medical-history?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(2);
    expect(body.pagination.totalCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// updateMedicalHistoryEntry
// ---------------------------------------------------------------------------

describe('updateMedicalHistoryEntry handler (append-only — AC-CLI-005)', () => {
  // EF-CLI-001 / AC-CLI-005: medical history entries are append-only. A PATCH
  // must never overwrite a recorded clinical observation — the handler rejects
  // every update attempt with 422 APPEND_ONLY_VIOLATION. Corrections are made by
  // creating a new entry (or via the additive amendment flow, WF-038).

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);

    const res = await app.request(
      `/dental/clinical/medical-history/${NONEXISTENT_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Updated notes' }),
      },
    );

    expect(res.status).toBe(401);
  });

  test('returns 422 APPEND_ONLY_VIOLATION for any update attempt', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(
      `/dental/clinical/medical-history/${NONEXISTENT_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Updated notes' }),
      },
    );

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.error?.code ?? body.code).toBe('APPEND_ONLY_VIOLATION');
  });

  test('rejects update of an existing entry with 422 (does not overwrite)', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        entryType: 'condition',
        displayName: 'Asthma',
        notes: 'Mild intermittent',
      }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(
      `/dental/clinical/medical-history/${created.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: 'Mild intermittent — well controlled',
          resolvedDate: '2025-03-01',
        }),
      },
    );

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.error?.code ?? body.code).toBe('APPEND_ONLY_VIOLATION');
  });

  test('rejects marking an entry inactive with 422 (append-only)', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        entryType: 'medication',
        displayName: 'Aspirin 81mg',
      }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(
      `/dental/clinical/medical-history/${created.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      },
    );

    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.error?.code ?? body.code).toBe('APPEND_ONLY_VIOLATION');
  });
});

// ---------------------------------------------------------------------------
// Role gate — createPrescription (dentist_* only)
// ---------------------------------------------------------------------------

describe('createPrescription role gate', () => {
  const roleGateBody = { patientId: PATIENT_ID, prescriberMemberId: MEMBER_ID, drugName: 'Amoxicillin', dosage: '500mg', frequency: 'TID' };

  test('staff_full → 403', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(STAFF_USER);
    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roleGateBody),
    });
    expect(res.status).toBe(403);
  });

  test('staff_scheduling → 403', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(SCHEDULING_USER);
    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roleGateBody),
    });
    expect(res.status).toBe(403);
  });

  test('dentist_owner → passes role gate (not 403)', async () => {
    const visit = await seedVisit();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roleGateBody),
    });
    expect(res.status).not.toBe(403);
  });
});
