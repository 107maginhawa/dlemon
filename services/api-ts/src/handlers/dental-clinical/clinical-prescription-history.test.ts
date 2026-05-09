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

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { createPrescription } from './createPrescription';
import { listPrescriptions } from './listPrescriptions';
import { updatePrescription } from './updatePrescription';
import { createMedicalHistoryEntry } from './createMedicalHistoryEntry';
import { listMedicalHistory } from './listMedicalHistory';
import { updateMedicalHistoryEntry } from './updateMedicalHistoryEntry';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000002';
const MEMBER_ID = 'c0000000-0000-1000-8000-000000000003';
const NONEXISTENT_ID = 'ffffffff-ffff-4000-8000-ffffffffffff';

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

  app.post('/dental/visits/:visitId/prescriptions', createPrescription);
  app.get('/dental/visits/:visitId/prescriptions', listPrescriptions);
  app.patch('/dental/visits/:visitId/prescriptions/:prescriptionId', updatePrescription);
  app.post('/dental/clinical/medical-history', createMedicalHistoryEntry);
  app.get('/dental/clinical/medical-history', listMedicalHistory);
  app.patch('/dental/clinical/medical-history/:entryId', updateMedicalHistoryEntry);

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
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(0);
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
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
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
    const validTypes = ['condition', 'medication', 'allergy', 'procedure', 'vaccination', 'familyHistory'];

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
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(0);
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
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// updateMedicalHistoryEntry
// ---------------------------------------------------------------------------

describe('updateMedicalHistoryEntry handler', () => {
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

  test('returns 404 when entry does not exist', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(
      `/dental/clinical/medical-history/${NONEXISTENT_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Updated notes' }),
      },
    );

    expect(res.status).toBe(404);
  });

  test('returns 200 with updated entry fields', async () => {
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

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(created.id);
    expect(body.notes).toBe('Mild intermittent — well controlled');
    expect(body.resolvedDate).toBe('2025-03-01');
  });

  test('returns 200 when marking entry as inactive', async () => {
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

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.active).toBe(false);
  });
});
