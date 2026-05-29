/**
 * Acceptance Criteria tests — dental-clinical
 *
 * AC-MED-01: Creating a medical history entry stores condition, code, and ICD-10 codeSystem
 * AC-MED-02: Updating a medical history entry to resolved sets resolvedDate and active=false
 * AC-MED-03: listMedicalHistory returns all entries for a patient, including active conditions
 * AC-MED-04: A consent form cannot be re-signed after signing (returns error)
 * AC-MED-05: Lab order advances through: ordered → in_fabrication → delivered → fitted
 *
 * AC-PRES-01: Creating a prescription requires prescriberMemberId (missing → 400)
 * AC-PRES-02: A prescription can be listed by visitId
 * AC-PRES-03: Updating a prescription changes the dosage field
 * AC-PRES-04: Creating a prescription without drugName returns validation error (400)
 * AC-PRES-05: Creating a prescription without medication name returns validation error (400)
 *
 * Note: AC-PRES-04 and AC-PRES-05 both cover the missing-drug-name guard (two different
 * assertion angles as specified: missing field → 400).
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
  CreateConsentFormBody, CreateConsentFormParams,
  SignConsentFormBody, SignConsentFormParams,
  CreateLabOrderBody, CreateLabOrderParams,
  UpdateLabOrderBody, UpdateLabOrderParams,
} from '@/generated/openapi/validators';
import { createPrescription } from './prescriptions/createPrescription';
import { listPrescriptions } from './prescriptions/listPrescriptions';
import { updatePrescription } from './prescriptions/updatePrescription';
import { createMedicalHistoryEntry } from './medical-history/createMedicalHistoryEntry';
import { listMedicalHistory } from './medical-history/listMedicalHistory';
import { updateMedicalHistoryEntry } from './medical-history/updateMedicalHistoryEntry';
import { createConsentForm } from './consent/createConsentForm';
import { signConsentForm } from './consent/signConsentForm';
import { createLabOrder } from './lab-orders/createLabOrder';
import { updateLabOrder } from './lab-orders/updateLabOrder';
import { MedicalHistoryRepository } from './repos/medical-history.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: ac2 — avoids membership unique-index collision with other clinical suites
const TEST_USER  = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID  = 'b0000000-0000-1000-8000-0000000000ac';
const ORG_ID     = 'd0000000-0000-1000-8000-0000000000ac';
const MEMBER_ID  = 'ee000000-0000-1000-8000-0000000000ac';
const PERSON_ID  = 'f0000000-0000-1000-8000-0000000000ac';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons }             = await import('@/handlers/person/repos/person.schema');
  const { patients }            = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'AC Clinical Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Test Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'AC', lastName: 'ClinicalPatient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE amendment, consent_form, dental_attachment, lab_order, medical_history_entry, prescription, dental_treatment, dental_visit CASCADE`,
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const PrescriptionBodyOnly = CreatePrescriptionBody.omit({ visitId: true });
const ConsentBodyOnly = CreateConsentFormBody.omit({ visitId: true });
const LabOrderBodyOnly = CreateLabOrderBody.omit({ visitId: true });

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

  // Medical history
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

  // Prescriptions
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

  // Consent
  app.post('/dental/visits/:visitId/consents',
    zValidator('param', CreateConsentFormParams, ve),
    zValidator('json', ConsentBodyOnly, ve),
    createConsentForm as any,
  );
  app.post('/dental/visits/:visitId/consents/:consentId/sign',
    zValidator('param', SignConsentFormParams, ve),
    zValidator('json', SignConsentFormBody, ve),
    signConsentForm as any,
  );

  // Lab orders
  app.post('/dental/visits/:visitId/lab-orders',
    zValidator('param', CreateLabOrderParams, ve),
    zValidator('json', LabOrderBodyOnly, ve),
    createLabOrder as any,
  );
  app.patch('/dental/visits/:visitId/lab-orders/:orderId',
    zValidator('param', UpdateLabOrderParams, ve),
    zValidator('json', UpdateLabOrderBody, ve),
    updateLabOrder as any,
  );

  return app;
}

async function seedActiveVisit() {
  const { VisitRepository } = await import('@/handlers/dental-visit/repos/visit.repo');
  const visitRepo = new VisitRepository(db);
  return visitRepo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
  });
}

// ===========================================================================
// AC-MED-01
// ===========================================================================

describe('AC-MED-01: creating medical history entry stores condition and ICD-10 code', () => {
  test('POST medical-history stores entryType, displayName, codeSystem, and code [AC-MED-01]', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        entryType: 'condition',
        displayName: 'Hypertension',
        codeSystem: 'ICD-10',
        code: 'I10',
        onsetDate: '2020-01-01',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.entryType).toBe('condition');
    expect(body.displayName).toBe('Hypertension');
    expect(body.codeSystem).toBe('ICD-10');
    expect(body.code).toBe('I10');
    expect(body.active).toBe(true);
  });
});

// ===========================================================================
// AC-MED-02
// ===========================================================================

describe('AC-MED-02: medical history entries are append-only (AC-CLI-005 supersedes in-place resolve)', () => {
  // EF-CLI-001 / AC-CLI-005: medical history is an append-only clinical record.
  // The earlier "resolve via PATCH" behavior is rejected — resolving a condition
  // is recorded by appending a new entry, never by mutating the original. A PATCH
  // returns 422 APPEND_ONLY_VIOLATION.
  test('PATCH medical-history entry is rejected 422 APPEND_ONLY_VIOLATION [AC-MED-02]', async () => {
    const app = buildTestApp(TEST_USER);

    // Create entry first
    const createRes = await app.request('/dental/clinical/medical-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        entryType: 'condition',
        displayName: 'Seasonal Allergy',
        codeSystem: 'ICD-10',
        code: 'J30',
      }),
    });
    expect(createRes.status).toBe(201);
    const entry = await createRes.json() as any;

    // Attempt to resolve in place — must be rejected (append-only)
    const updateRes = await app.request(`/dental/clinical/medical-history/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resolvedDate: '2026-01-15',
        active: false,
      }),
    });

    expect(updateRes.status).toBe(422);
    const updated = await updateRes.json() as any;
    expect(updated.error?.code ?? updated.code).toBe('APPEND_ONLY_VIOLATION');
  });
});

// ===========================================================================
// AC-MED-03
// ===========================================================================

describe('AC-MED-03: listMedicalHistory returns all entries for patient including active conditions', () => {
  test('GET medical-history?patientId returns entries with active conditions included [AC-MED-03]', async () => {
    // Seed two entries directly via repo
    const repo = new MedicalHistoryRepository(db);
    await repo.createOne({
      patientId: PATIENT_ID,
      entryType: 'condition',
      displayName: 'Diabetes Type 2',
      codeSystem: 'ICD-10',
      code: 'E11',
      active: true,
    });
    await repo.createOne({
      patientId: PATIENT_ID,
      entryType: 'allergy',
      displayName: 'Penicillin Allergy',
      codeSystem: 'RxNorm',
      code: '7980',
      active: true,
    });

    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/clinical/medical-history?patientId=${PATIENT_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const items = body.data ?? body;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(2);
    // Both active entries should be present
    const names = items.map((e: any) => e.displayName);
    expect(names).toContain('Diabetes Type 2');
    expect(names).toContain('Penicillin Allergy');
  });
});

// ===========================================================================
// AC-MED-04
// ===========================================================================

describe('AC-MED-04: consent form cannot be re-signed after signing', () => {
  test('signing an already-signed consent form returns 400 with appropriate error [AC-MED-04]', async () => {
    const visit = await seedActiveVisit();
    const app = buildTestApp(TEST_USER);

    // Create consent form
    const createRes = await app.request(`/dental/visits/${visit.id}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        templateId: 'tpl-ac-med-04',
        templateName: 'General Treatment Consent',
      }),
    });
    expect(createRes.status).toBe(201);
    const consent = await createRes.json() as any;

    // First sign — should succeed
    const signRes1 = await app.request(`/dental/visits/${visit.id}/consents/${consent.id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatureData: 'data:image/png;base64,abc123' }),
    });
    expect(signRes1.status).toBe(200);

    // Second sign — should fail
    const signRes2 = await app.request(`/dental/visits/${visit.id}/consents/${consent.id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatureData: 'data:image/png;base64,xyz456' }),
    });
    expect(signRes2.status).toBe(400);
    const body = await signRes2.json() as any;
    expect(body.error).toMatch(/already signed/i);
  });
});

// ===========================================================================
// AC-MED-05
// ===========================================================================

describe('AC-MED-05: lab order advances ordered → in_fabrication → delivered → fitted', () => {
  test('lab order transitions through full lifecycle [AC-MED-05]', async () => {
    const visit = await seedActiveVisit();
    const app = buildTestApp(TEST_USER);

    // Create order
    const createRes = await app.request(`/dental/visits/${visit.id}/lab-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        labName: 'DentalLab PH',
        description: 'Crown for tooth 16',
      }),
    });
    expect(createRes.status).toBe(201);
    const order = await createRes.json() as any;
    expect(order.status).toBe('ordered');

    // → in_fabrication
    const step1 = await app.request(`/dental/visits/${visit.id}/lab-orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_fabrication' }),
    });
    expect(step1.status).toBe(200);
    expect((await step1.json() as any).status).toBe('in_fabrication');

    // → delivered
    const step2 = await app.request(`/dental/visits/${visit.id}/lab-orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'delivered' }),
    });
    expect(step2.status).toBe(200);
    expect((await step2.json() as any).status).toBe('delivered');

    // → fitted
    const step3 = await app.request(`/dental/visits/${visit.id}/lab-orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'fitted' }),
    });
    expect(step3.status).toBe(200);
    expect((await step3.json() as any).status).toBe('fitted');
  });
});

// ===========================================================================
// AC-PRES-01
// ===========================================================================

describe('AC-PRES-01: creating a prescription requires prescriberMemberId', () => {
  test('missing prescriberMemberId returns 400 validation error [AC-PRES-01]', async () => {
    const visit = await seedActiveVisit();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        // prescriberMemberId intentionally omitted
        drugName: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'TID',
      }),
    });

    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// AC-PRES-02
// ===========================================================================

describe('AC-PRES-02: prescription can be listed by visitId', () => {
  test('GET /dental/visits/:visitId/prescriptions returns prescriptions for that visit [AC-PRES-02]', async () => {
    const visit = await seedActiveVisit();
    const app = buildTestApp(TEST_USER);

    // Create a prescription
    const createRes = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        prescriberMemberId: MEMBER_ID,
        drugName: 'Ibuprofen',
        dosage: '400mg',
        frequency: 'BID',
      }),
    });
    expect(createRes.status).toBe(201);
    const prescription = await createRes.json() as any;

    // List prescriptions — response is { data: [...], pagination: {...} }
    const listRes = await app.request(`/dental/visits/${visit.id}/prescriptions`);
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json() as any;
    const items: any[] = listBody.data ?? listBody;
    const ids = items.map((p: any) => p.id);
    expect(ids).toContain(prescription.id);
  });
});

// ===========================================================================
// AC-PRES-03
// ===========================================================================

describe('AC-PRES-03: updating a prescription changes the dosage field', () => {
  test('PATCH prescription updates dosage and reflects in response [AC-PRES-03]', async () => {
    const visit = await seedActiveVisit();
    const app = buildTestApp(TEST_USER);

    // Create prescription
    const createRes = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
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
    expect(createRes.status).toBe(201);
    const prescription = await createRes.json() as any;

    // Update dosage
    const updateRes = await app.request(
      `/dental/visits/${visit.id}/prescriptions/${prescription.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dosage: '500mg' }),
      },
    );

    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json() as any;
    expect(updated.dosage).toBe('500mg');
  });
});

// ===========================================================================
// AC-PRES-04
// ===========================================================================

describe('AC-PRES-04: prescription without drugName returns validation error', () => {
  test('missing drugName returns 400 [AC-PRES-04]', async () => {
    const visit = await seedActiveVisit();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        prescriberMemberId: MEMBER_ID,
        // drugName intentionally omitted
        dosage: '500mg',
        frequency: 'TID',
      }),
    });

    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// AC-PRES-05
// ===========================================================================

describe('AC-PRES-05: prescription without medication name (drugName) returns validation error', () => {
  test('drugName is required — omitting it returns 400 with validation error [AC-PRES-05]', async () => {
    const visit = await seedActiveVisit();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        prescriberMemberId: MEMBER_ID,
        dosage: '250mg',
        frequency: 'QD',
        // drugName / medication name omitted
      }),
    });

    expect(res.status).toBe(400);
    // Validation fired — body contains error key
    const body = await res.json() as any;
    expect(body.error).toBeTruthy();
  });
});
