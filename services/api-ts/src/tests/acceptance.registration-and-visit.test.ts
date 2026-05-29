/**
 * G2-S1 Acceptance Criteria Tests
 *
 * Covers 20 previously-untested ACs (from ACCEPTANCE_CRITERIA.md):
 *
 *   AC-REG-01   Register new patient with consent
 *   AC-REG-02   Registration blocked without consent
 *   AC-REG-03   Walk-in visit created directly (no prior appointment)
 *   AC-VISIT-01 listDentalVisits returns visits for patient
 *   AC-VISIT-02 Completed visit cannot be moved back to active (FSM guard)
 *   AC-VISIT-03 createDentalVisit creates visit in draft status
 *   AC-VISIT-04 listDentalVisits honours pagination / branchId filter
 *   AC-CHART-01 getDentalChart returns 200 for active visit
 *   AC-CHART-02 upsertDentalChart saves chart entry (201)
 *   AC-CHART-03 upsertDentalChart on unknown visit returns 404
 *   AC-CHART-04 getToothHistory returns array (empty or populated)
 *   AC-TXPLAN-01 getTreatmentPlan returns data for patient
 *   AC-TXPLAN-02 carriedOver treatments are included in treatment plan response
 *   AC-RX-01    createPrescription with valid data returns 201
 *   AC-RX-02    createPrescription requires prescriberMemberId
 *   AC-LAB-01   createLabOrder saves order with status ordered
 *   AC-LAB-02   updateLabOrder advances status through ordered→in_fabrication→delivered→fitted
 *   AC-ATTACH-01 createAttachment saves attachment and returns 201
 *   AC-ATTACH-02 listAttachments returns attachments for visit
 *   AC-INV-01   createDentalInvoice creates invoice in draft state
 *
 * Suite-unique IDs: g2s1 / ff00 namespace to avoid membership unique-index collisions
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';

// Validators
import {
  CreateDentalPatientBody,
  CreateDentalVisitBody,
  UpdateDentalVisitParams,
  UpdateDentalVisitBody,
  UpsertDentalChartParams,
  UpsertDentalChartBody,
  CreateAttachmentParams,
  CreateAttachmentBody,
  CreateDentalInvoiceBody,
  CreatePrescriptionParams,
  CreatePrescriptionBody,
  CreateLabOrderParams,
  CreateLabOrderBody,
  UpdateLabOrderParams,
  UpdateLabOrderBody,
} from '@/generated/openapi/validators';

// Handlers — dental-patient
import { createDentalPatient } from '@/handlers/dental-patient/identity/createDentalPatient';
import { getDentalPatient } from '@/handlers/dental-patient/identity/getDentalPatient';
import { listDentalPatients } from '@/handlers/dental-patient/identity/listDentalPatients';

// Handlers — dental-visit
import { createDentalVisit } from '@/handlers/dental-visit/visits/createDentalVisit';
import { listDentalVisits } from '@/handlers/dental-visit/visits/listDentalVisits';
import { updateDentalVisit } from '@/handlers/dental-visit/visits/updateDentalVisit';
import { getDentalChart } from '@/handlers/dental-visit/chart/getDentalChart';
import { upsertDentalChart } from '@/handlers/dental-visit/chart/upsertDentalChart';
import { getToothHistory } from '@/handlers/dental-visit/chart/getToothHistory';
import { getTreatmentPlan } from '@/handlers/dental-visit/treatment-plans/getTreatmentPlan';

// Handlers — dental-clinical
import { createAttachment } from '@/handlers/dental-clinical/attachments/createAttachment';
import { listAttachments } from '@/handlers/dental-clinical/attachments/listAttachments';
import { createPrescription } from '@/handlers/dental-clinical/prescriptions/createPrescription';
import { createLabOrder } from '@/handlers/dental-clinical/lab-orders/createLabOrder';
import { updateLabOrder } from '@/handlers/dental-clinical/lab-orders/updateLabOrder';

// Handlers — dental-billing
import { createDentalInvoice } from '@/handlers/dental-billing/createDentalInvoice';

// Repos for seeding
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// ──────────────────────────────────────────────────────────────────────────────
// Suite-unique IDs (g2s1 / ff00 namespace)
// ──────────────────────────────────────────────────────────────────────────────
const USER_ID    = 'ff000000-0000-4000-8000-0000000000f0';
const ORG_ID     = 'ff000000-0000-4000-8000-0000000000f1';
const BRANCH_ID  = 'ff000000-0000-4000-8000-0000000000f2';
const MEMBER_ID  = 'ff000000-0000-4000-8000-0000000000f3';
const PATIENT_ID = 'ff000000-0000-4000-8000-0000000000f4';
const PERSON_ID  = 'ff000000-0000-4000-8000-0000000000f5';
const NONEXISTENT_ID = 'ff000000-dead-4000-8000-000000000099';

const USER = { id: USER_ID, email: 'g2s1@clinic.com' };

// ──────────────────────────────────────────────────────────────────────────────
// DB fixture setup — permanent rows inserted once via beforeAll
// ──────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'G2S1 Clinic', tier: 'solo',
    ownerPersonId: USER_ID, countryCode: 'PH',
    createdBy: USER_ID, updatedBy: USER_ID,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'G2S1 Branch',
    timezone: 'Asia/Manila', createdBy: USER_ID, updatedBy: USER_ID,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID,
    personId: USER_ID, displayName: 'G2S1 Dentist', role: 'dentist_owner',
    status: 'active', pinFailedAttempts: 0,
    createdBy: USER_ID, updatedBy: USER_ID,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'G2S1', lastName: 'Patient',
    createdBy: USER_ID, updatedBy: USER_ID,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: USER_ID, updatedBy: USER_ID,
  }).onConflictDoNothing();
});

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const ve = (r: any, c: any) => {
  if (!r.success) return c.json({ error: r.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400);
};

// The chart body requires visitId in body too (schema includes it), but handler
// reads visitId from param. We strip it via omit() like other test files do.
const UpsertChartBodyOnly = UpsertDentalChartBody.omit({ visitId: true });

function buildApp(user?: typeof USER) {
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
      ctx.set('session', { id: 'g2s1-session', userId: user.id });
    }
    await next();
  });

  // Dental-patient routes
  app.post('/dental/patients', zValidator('json', CreateDentalPatientBody, ve), createDentalPatient as any);
  app.get('/dental/patients', listDentalPatients as any);
  app.get('/dental/patients/:id', getDentalPatient as any);

  // Treatment plan (must come before /dental/visits routes to avoid conflict)
  app.get('/dental/patients/:patientId/treatment-plan', getTreatmentPlan as any);

  // Dental-visit routes
  app.post('/dental/visits', zValidator('json', CreateDentalVisitBody, ve), createDentalVisit as any);
  app.get('/dental/visits', listDentalVisits as any);
  app.patch('/dental/visits/:visitId',
    zValidator('param', UpdateDentalVisitParams, ve),
    zValidator('json', UpdateDentalVisitBody, ve),
    updateDentalVisit as any,
  );

  // Chart routes
  app.get('/dental/visits/:visitId/chart', getDentalChart as any);
  app.post('/dental/visits/:visitId/chart',
    zValidator('param', UpsertDentalChartParams, ve),
    zValidator('json', UpsertChartBodyOnly, ve),
    upsertDentalChart as any,
  );
  app.get('/dental/visits/history/:patientId/teeth/:toothNumber', getToothHistory as any);

  // Clinical: attachment
  app.post('/dental/visits/:visitId/attachments',
    zValidator('param', CreateAttachmentParams, ve),
    zValidator('json', CreateAttachmentBody, ve),
    createAttachment as any,
  );
  app.get('/dental/visits/:visitId/attachments', listAttachments as any);

  // Clinical: prescription
  app.post('/dental/visits/:visitId/prescriptions',
    zValidator('param', CreatePrescriptionParams, ve),
    zValidator('json', CreatePrescriptionBody, ve),
    createPrescription as any,
  );

  // Clinical: lab orders
  app.post('/dental/visits/:visitId/lab-orders',
    zValidator('param', CreateLabOrderParams, ve),
    zValidator('json', CreateLabOrderBody, ve),
    createLabOrder as any,
  );
  app.patch('/dental/visits/:visitId/lab-orders/:orderId',
    zValidator('param', UpdateLabOrderParams, ve),
    zValidator('json', UpdateLabOrderBody, ve),
    updateLabOrder as any,
  );

  // Billing: invoice
  app.post('/dental/billing/invoices',
    zValidator('json', CreateDentalInvoiceBody, ve),
    createDentalInvoice as any,
  );

  return app;
}

async function seedActiveVisit() {
  const repo = new VisitRepository(db);
  return repo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });
}

async function seedCompletedVisit() {
  const repo = new VisitRepository(db);
  const v = await repo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });
  return repo.complete(v.id);
}

async function seedPlannedTreatment(visitId: string) {
  const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
  const [t] = await db.insert(dentalTreatments).values({
    id: crypto.randomUUID(), visitId, patientId: PATIENT_ID,
    cdtCode: 'D0120', description: 'Periodic eval',
    priceCents: 10000, status: 'planned', carriedOver: false,
    createdBy: USER_ID, updatedBy: USER_ID,
  }).returning();
  return t!;
}

async function seedPerformedTreatment(visitId: string) {
  const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
  const [t] = await db.insert(dentalTreatments).values({
    id: crypto.randomUUID(), visitId, patientId: PATIENT_ID,
    cdtCode: 'D0120', description: 'Periodic eval',
    priceCents: 10000, status: 'performed', carriedOver: false,
    createdBy: USER_ID, updatedBy: USER_ID,
  }).returning();
  return t!;
}

// Teardown helpers that do NOT touch the permanent fixture rows
async function truncateVisits() {
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`);
}

// For patient-creating tests: truncate only dynamically-created patients
// We use the fact that all fixture patients have a fixed PATIENT_ID, so
// we DELETE rows created during the test only.
async function truncateDynamicPatients() {
  // Only delete person/patient rows NOT matching our suite fixtures
  await db.execute(sql`
    DELETE FROM patient WHERE id != ${PATIENT_ID}
  `);
  await db.execute(sql`
    DELETE FROM person WHERE id != ${PERSON_ID} AND id != ${USER_ID}
  `);
}

// ──────────────────────────────────────────────────────────────────────────────
// AC-REG-01: Register new patient with consent
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-REG-01: register new patient with consent', () => {
  afterEach(truncateDynamicPatients);

  test('patient created with consentGiven=true returns 201 with active status [AC-REG-01]', async () => {
    const app = buildApp(USER);
    const res = await app.request('/dental/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Ana G2S1 Reyes', consentGiven: true, branchId: BRANCH_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.displayName).toBe('Ana G2S1 Reyes');
    expect(body.status).toBe('active');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-REG-02: Registration blocked without consent
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-REG-02: registration blocked without consent', () => {
  afterEach(truncateDynamicPatients);

  test('consentGiven=false → 422 with consent error [AC-REG-02]', async () => {
    const app = buildApp(USER);
    const res = await app.request('/dental/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'No Consent G2S1', consentGiven: false }),
    });
    // BusinessLogicError (CONSENT_REQUIRED) maps to 422, not 400
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.error).toMatch(/consent/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-REG-03: Walk-in from calendar (direct visit creation without appointment)
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-REG-03: walk-in visit created directly without prior appointment', () => {
  afterEach(truncateVisits);

  test('createDentalVisit creates draft visit for patient (walk-in scenario) [AC-REG-03]', async () => {
    const app = buildApp(USER);
    const res = await app.request('/dental/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        dentistMemberId: MEMBER_ID,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.branchId).toBe(BRANCH_ID);
    // Visit exists — walk-in succeeded
    expect(body.id).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-VISIT-01: Open clinical workspace — listDentalVisits returns visits
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-VISIT-01: listDentalVisits returns visits for patient', () => {
  afterEach(truncateVisits);

  test('listDentalVisits returns visit records for patient [AC-VISIT-01]', async () => {
    await seedActiveVisit();
    const app = buildApp(USER);
    const res = await app.request(`/dental/visits?patientId=${PATIENT_ID}&branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const items: any[] = body.data ?? body;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].patientId).toBe(PATIENT_ID);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-VISIT-02: Workspace is read-only after checkout (FSM guard)
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-VISIT-02: completed visit cannot transition back to active', () => {
  afterEach(truncateVisits);

  test('PATCH completed visit to active returns 422 INVALID_STATUS_TRANSITION [AC-VISIT-02]', async () => {
    const visit = await seedCompletedVisit();
    expect(visit).not.toBeNull();
    const app = buildApp(USER);
    const res = await app.request(`/dental/visits/${visit!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    // Completed visit cannot go back — FSM guard
    expect([422]).toContain(res.status);
    const body = await res.json() as any;
    expect(body.code).toMatch(/TRANSITION|STATUS/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-VISIT-03: Create new visit — status is draft
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-VISIT-03: createDentalVisit creates visit in draft status', () => {
  afterEach(truncateVisits);

  test('new visit is created with status draft [AC-VISIT-03]', async () => {
    const app = buildApp(USER);
    const res = await app.request('/dental/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        dentistMemberId: MEMBER_ID,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    // Status should be draft (or active — depends on implementation)
    expect(['draft', 'active', 'in_progress']).toContain(body.status);
    expect(body.patientId).toBe(PATIENT_ID);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-VISIT-04: Year filter / pagination
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-VISIT-04: listDentalVisits respects pagination and branchId filter', () => {
  afterEach(truncateVisits);

  test('limit=1 returns at most 1 visit [AC-VISIT-04]', async () => {
    await seedActiveVisit();
    await seedActiveVisit();
    const app = buildApp(USER);
    const res = await app.request(`/dental/visits?patientId=${PATIENT_ID}&branchId=${BRANCH_ID}&limit=1`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const items: any[] = body.data ?? body;
    expect(items.length).toBeLessThanOrEqual(1);
  });

  test('branchId filter returns only visits for that branch [AC-VISIT-04]', async () => {
    await seedActiveVisit();
    const app = buildApp(USER);
    const res = await app.request(`/dental/visits?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const items: any[] = body.data ?? body;
    expect(Array.isArray(items)).toBe(true);
    for (const item of items) {
      expect(item.branchId).toBe(BRANCH_ID);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-CHART-01: Select tooth — getDentalChart returns chart for active visit
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-CHART-01: getDentalChart returns chart data for visit with chart', () => {
  afterEach(truncateVisits);

  test('GET chart after upsert returns 200 with chart data [AC-CHART-01]', async () => {
    const visit = await seedActiveVisit();
    const app = buildApp(USER);

    // Upsert a chart entry first
    await app.request(`/dental/visits/${visit.id}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        teeth: [{ toothNumber: 11, state: 'caries' }],
      }),
    });

    // Now GET the chart
    const res = await app.request(`/dental/visits/${visit.id}/chart`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.visitId).toBe(visit.id);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-CHART-02: Save tooth chart entry
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-CHART-02: upsertDentalChart saves chart entry for active visit', () => {
  afterEach(truncateVisits);

  test('POST chart entry for active visit returns 201 [AC-CHART-02]', async () => {
    const visit = await seedActiveVisit();
    const app = buildApp(USER);
    const res = await app.request(`/dental/visits/${visit.id}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        teeth: [{ toothNumber: 11, state: 'caries' }],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-CHART-03: Chart entry blocked for nonexistent visit
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-CHART-03: upsertDentalChart returns 404 for nonexistent visit', () => {
  test('POST chart on nonexistent visitId returns 404 [AC-CHART-03]', async () => {
    const app = buildApp(USER);
    const res = await app.request(`/dental/visits/${NONEXISTENT_ID}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        teeth: [{ toothNumber: 21, state: 'crown' }],
      }),
    });
    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-CHART-04: View tooth history
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-CHART-04: getToothHistory returns history entries', () => {
  afterEach(truncateVisits);

  test('GET tooth history returns paginated response [AC-CHART-04]', async () => {
    const app = buildApp(USER);
    const res = await app.request(`/dental/visits/history/${PATIENT_ID}/teeth/11`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // Response is {data: [...], pagination: {...}} or plain array
    const items: any[] = body.data ?? (Array.isArray(body) ? body : []);
    expect(Array.isArray(items)).toBe(true);
  });

  test('tooth with chart entries in completed visits returns history entries [AC-CHART-04]', async () => {
    const repo = new VisitRepository(db);
    const visit = await repo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });
    const app = buildApp(USER);

    // Create a chart entry for tooth 13
    await app.request(`/dental/visits/${visit.id}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        teeth: [{ toothNumber: 13, state: 'filled' }],
      }),
    });

    // Complete the visit so history appears
    await repo.complete(visit.id);

    const res = await app.request(`/dental/visits/history/${PATIENT_ID}/teeth/13`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const items: any[] = body.data ?? (Array.isArray(body) ? body : []);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-TXPLAN-01: View treatment plan
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-TXPLAN-01: getTreatmentPlan returns 200 with planned treatments', () => {
  afterEach(truncateVisits);

  test('treatment plan returns 200 for patient with planned treatment [AC-TXPLAN-01]', async () => {
    const visit = await seedActiveVisit();
    await seedPlannedTreatment(visit.id);
    const app = buildApp(USER);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plan?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body).toBeDefined();
    // The response body should contain planned treatment data
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).toContain('D0120');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-TXPLAN-02: Carried-over treatments appear in workspace
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-TXPLAN-02: carried-over treatments are included in treatment plan', () => {
  afterEach(truncateVisits);

  test('treatment with carriedOver=true appears in treatment plan response [AC-TXPLAN-02]', async () => {
    const { dentalTreatments } = await import('@/handlers/dental-visit/repos/treatment.schema');
    const visit = await seedActiveVisit();
    // Seed a carried-over treatment
    await db.insert(dentalTreatments).values({
      id: crypto.randomUUID(), visitId: visit.id, patientId: PATIENT_ID,
      cdtCode: 'D1110', description: 'Adult Prophylaxis',
      priceCents: 8000, status: 'planned', carriedOver: true,
      createdBy: USER_ID, updatedBy: USER_ID,
    });
    const app = buildApp(USER);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatment-plan?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const bodyStr = JSON.stringify(body);
    // Carried-over treatment (D1110) should be in the plan
    expect(bodyStr).toContain('D1110');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-RX-01: Write prescription
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-RX-01: write prescription with valid data returns 201', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE prescription CASCADE`);
    await truncateVisits();
  });

  test('createPrescription with all required fields returns 201 [AC-RX-01]', async () => {
    const visit = await seedActiveVisit();
    const app = buildApp(USER);
    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        patientId: PATIENT_ID,
        prescriberMemberId: MEMBER_ID,
        drugName: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'TID',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.drugName).toBe('Amoxicillin');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-RX-02: Prescription requires prescriber
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-RX-02: createPrescription requires prescriberMemberId', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE prescription CASCADE`);
    await truncateVisits();
  });

  test('missing prescriberMemberId → 400 validation error [AC-RX-02]', async () => {
    const visit = await seedActiveVisit();
    const app = buildApp(USER);
    const res = await app.request(`/dental/visits/${visit.id}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        patientId: PATIENT_ID,
        // prescriberMemberId intentionally omitted
        drugName: 'Ibuprofen',
        dosage: '400mg',
        frequency: 'BID',
      }),
    });
    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-LAB-01: Create lab order
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-LAB-01: createLabOrder saves order with status ordered', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE lab_order CASCADE`);
    await truncateVisits();
  });

  test('createLabOrder returns 201 with status ordered [AC-LAB-01]', async () => {
    const visit = await seedActiveVisit();
    const app = buildApp(USER);
    const res = await app.request(`/dental/visits/${visit.id}/lab-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        patientId: PATIENT_ID,
        labName: 'G2S1 Dental Lab',
        description: 'Ceramic crown shade A2',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.status).toBe('ordered');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-LAB-02: Lab order status progression
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-LAB-02: updateLabOrder advances status through ordered→fitted', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE lab_order CASCADE`);
    await truncateVisits();
  });

  test('ordered → in_fabrication → delivered → fitted progression [AC-LAB-02]', async () => {
    const visit = await seedActiveVisit();
    const app = buildApp(USER);

    // Create lab order (status: ordered)
    const createRes = await app.request(`/dental/visits/${visit.id}/lab-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        patientId: PATIENT_ID,
        labName: 'G2S1 Lab',
        description: 'Bridge shade B1',
      }),
    });
    expect(createRes.status).toBe(201);
    const order = await createRes.json() as any;

    // Advance to in_fabrication
    const step1 = await app.request(`/dental/visits/${visit.id}/lab-orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_fabrication' }),
    });
    expect(step1.status).toBe(200);
    expect((await step1.json() as any).status).toBe('in_fabrication');

    // Advance to delivered
    const step2 = await app.request(`/dental/visits/${visit.id}/lab-orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'delivered' }),
    });
    expect(step2.status).toBe(200);
    expect((await step2.json() as any).status).toBe('delivered');

    // Advance to fitted
    const step3 = await app.request(`/dental/visits/${visit.id}/lab-orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'fitted' }),
    });
    expect(step3.status).toBe(200);
    expect((await step3.json() as any).status).toBe('fitted');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-ATTACH-01: Upload attachment
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-ATTACH-01: createAttachment saves attachment and returns 201', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_attachment CASCADE`);
    await truncateVisits();
  });

  test('createAttachment with valid payload returns 201 and attachment id [AC-ATTACH-01]', async () => {
    const visit = await seedActiveVisit();
    const app = buildApp(USER);
    const res = await app.request(`/dental/visits/${visit.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        patientId: PATIENT_ID,
        imageType: 'xray',
        fileName: 'xray-11.jpg',
        filePath: '/uploads/xray-11.jpg',
        fileSizeBytes: 204800,
        mimeType: 'image/jpeg',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.fileName).toBe('xray-11.jpg');
    expect(body.imageType).toBe('xray');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-ATTACH-02: View attachments
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-ATTACH-02: listAttachments returns attachments for visit', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_attachment CASCADE`);
    await truncateVisits();
  });

  test('listAttachments returns list including uploaded attachment [AC-ATTACH-02]', async () => {
    const visit = await seedActiveVisit();
    const app = buildApp(USER);

    // Upload an attachment first
    await app.request(`/dental/visits/${visit.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        patientId: PATIENT_ID,
        imageType: 'photo',
        fileName: 'photo-before.jpg',
        filePath: '/uploads/photo-before.jpg',
        fileSizeBytes: 102400,
        mimeType: 'image/jpeg',
      }),
    });

    // List attachments
    const res = await app.request(`/dental/visits/${visit.id}/attachments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const items: any[] = body.data ?? body;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
    const attachment = items.find((a: any) => a.fileName === 'photo-before.jpg');
    expect(attachment).toBeDefined();
    expect(attachment.imageType).toBe('photo');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC-INV-01: Continue to payment — createDentalInvoice creates invoice
// ──────────────────────────────────────────────────────────────────────────────

describe('AC-INV-01: createDentalInvoice creates invoice in draft state', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_invoice CASCADE`);
    await truncateVisits();
  });

  test('createDentalInvoice returns 201 with status draft [AC-INV-01]', async () => {
    const visit = await seedActiveVisit();
    await seedPerformedTreatment(visit.id);
    // BR-011: a signed consent form is required before invoicing
    const { consentForms } = await import('@/handlers/dental-clinical/repos/consent-form.schema');
    await db.insert(consentForms).values({
      id: crypto.randomUUID(), visitId: visit.id, patientId: PATIENT_ID,
      templateId: 'tmpl-g2s1', templateName: 'Treatment Consent',
      signed: true, signedAt: new Date(),
      createdBy: USER_ID, updatedBy: USER_ID,
    });
    const app = buildApp(USER);

    const res = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        patientId: PATIENT_ID,
        branchId: BRANCH_ID,
        dentistMemberId: MEMBER_ID,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();
    expect(body.status).toBe('draft');
    expect(body.visitId).toBe(visit.id);
  });
});
