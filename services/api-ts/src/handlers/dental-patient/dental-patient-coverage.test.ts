/**
 * dental-patient-coverage.test.ts — G2.5-S5 coverage boost
 *
 * Covers handlers not yet exercised by dental-patient.test.ts:
 *   FR1.22  getTreatmentPlan  (GET /dental/patients/:patientId/treatment-plan)
 *   FR1.22  acceptTreatmentPlan (POST /dental/patients/:patientId/treatment-plan/accept)
 *           getTreatmentPlanVersion (GET /dental/patients/:patientId/treatment-plan/versions/:versionId)
 *   FR1.19  initializeDentition (POST /dental/patients/:patientId/dentition)
 *   J01     listPatientVisits (GET /dental/patients/:patientId/visits)
 *   J05     listPatientConditions (GET /dental/patients/:patientId/treatments)
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import {
  InitializeDentitionBody,
  InitializeDentitionParams,
} from '@/generated/openapi/validators';
import { getTreatmentPlan } from './treatment-plans/getTreatmentPlan';
import { acceptTreatmentPlan } from './treatment-plans/acceptTreatmentPlan';
import { getTreatmentPlanVersion } from './treatment-plans/getTreatmentPlanVersion';
import { initializeDentition } from './initializeDentition';
import { listPatientVisits } from './listPatientVisits';
import { listPatientConditions } from './listPatientConditions';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique IDs — d9 namespace
const TEST_USER      = { id: 'd9000000-0000-1000-8000-000000000001', email: 'dentist9@clinic.com' };
const PATIENT_ID     = 'd9000000-0000-1000-8000-000000000010';
const PERSON_ID      = 'd9000000-0000-1000-8000-000000000011';
const BRANCH_ID      = 'd9000000-0000-1000-8000-000000000020';
const ORG_ID         = 'd9000000-0000-1000-8000-000000000030';
const MEMBER_ID      = 'd9000000-0000-1000-8000-000000000040';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Coverage9 Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Coverage9 Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Coverage9 Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Coverage9', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

// ─── App builder helpers ──────────────────────────────────────────────────────

function makeApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });
  return app;
}

function addMiddleware(app: Hono, user?: typeof TEST_USER) {
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', logger);
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });
}

function buildTreatmentPlanApp(user?: typeof TEST_USER) {
  const app = makeApp();
  addMiddleware(app, user);
  app.get('/dental/patients/:patientId/treatment-plan', (c) => getTreatmentPlan(c as any));
  app.post(
    '/dental/patients/:patientId/treatment-plan/accept',
    (c) => acceptTreatmentPlan(c as any),
  );
  app.get(
    '/dental/patients/:patientId/treatment-plan/versions/:versionId',
    (c) => getTreatmentPlanVersion(c as any),
  );
  return app;
}

function buildDentitionApp(user?: typeof TEST_USER) {
  const app = makeApp();
  addMiddleware(app, user);
  app.post(
    '/dental/patients/:patientId/dentition',
    zValidator('param', InitializeDentitionParams, ve as any),
    zValidator('json', InitializeDentitionBody, ve as any),
    (c) => initializeDentition(c as any),
  );
  return app;
}

function buildListApp(user?: typeof TEST_USER) {
  const app = makeApp();
  addMiddleware(app, user);
  app.get('/dental/patients/:patientId/visits', (c) => listPatientVisits(c as any));
  app.get('/dental/patients/:patientId/treatments', (c) => listPatientConditions(c as any));
  return app;
}

async function seedVisit() {
  const repo = new VisitRepository(db);
  return repo.createOne({
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
  });
}

async function truncateVisitsAndVersions() {
  await db.execute(sql`TRUNCATE TABLE treatment_plan_version CASCADE`);
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`);
}

// =============================================================================
// FR1.22: getTreatmentPlan
// =============================================================================

describe('getTreatmentPlan handler', () => {
  afterEach(truncateVisitsAndVersions);

  test('returns 401 when unauthenticated', async () => {
    const app = buildTreatmentPlanApp(undefined);
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan?branchId=${BRANCH_ID}`,
    );
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty treatment plan for patient with no visits', async () => {
    const app = buildTreatmentPlanApp(TEST_USER);
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan?branchId=${BRANCH_ID}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.patientId).toBe(PATIENT_ID);
    expect(Array.isArray(body.treatments)).toBe(true);
    expect(body.treatments.length).toBe(0);
    expect(typeof body.version).toBe('number');
  });

  test('returns 200 with treatment plan after visit is created', async () => {
    await seedVisit();
    const app = buildTreatmentPlanApp(TEST_USER);
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan?branchId=${BRANCH_ID}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.patientId).toBe(PATIENT_ID);
    expect(typeof body.totalEstimateCents).toBe('number');
    expect(typeof body.version).toBe('number');
  });
});

// =============================================================================
// FR1.22: acceptTreatmentPlan
// =============================================================================

describe('acceptTreatmentPlan handler', () => {
  afterEach(truncateVisitsAndVersions);

  test('returns 401 when unauthenticated', async () => {
    const app = buildTreatmentPlanApp(undefined);
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept?branchId=${BRANCH_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
    );
    expect(res.status).toBe(401);
  });

  test('returns ≥400 when branchId query param is missing', async () => {
    const app = buildTreatmentPlanApp(TEST_USER);
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('creates a treatment plan version snapshot (version=1)', async () => {
    await seedVisit();
    const app = buildTreatmentPlanApp(TEST_USER);
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept?branchId=${BRANCH_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.version).toBe(1);
    expect(body.snapshot).toBeDefined();
  });

  test('increments version on second accept', async () => {
    await seedVisit();
    const app = buildTreatmentPlanApp(TEST_USER);
    await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept?branchId=${BRANCH_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
    );
    const res2 = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept?branchId=${BRANCH_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
    );
    expect(res2.status).toBe(201);
    const body = await res2.json() as any;
    expect(body.version).toBe(2);
  });
});

// =============================================================================
// getTreatmentPlanVersion
// =============================================================================

describe('getTreatmentPlanVersion handler', () => {
  afterEach(truncateVisitsAndVersions);

  test('returns 401 when unauthenticated', async () => {
    const app = buildTreatmentPlanApp(undefined);
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/versions/${NONEXISTENT_ID}?branchId=${BRANCH_ID}`,
    );
    expect(res.status).toBe(401);
  });

  test('returns ≥400 when branchId query param is missing', async () => {
    const app = buildTreatmentPlanApp(TEST_USER);
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/versions/${NONEXISTENT_ID}`,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('returns 404 for non-existent version', async () => {
    const app = buildTreatmentPlanApp(TEST_USER);
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/versions/${NONEXISTENT_ID}?branchId=${BRANCH_ID}`,
    );
    expect(res.status).toBe(404);
  });

  test('returns version after accept', async () => {
    await seedVisit();
    const app = buildTreatmentPlanApp(TEST_USER);

    const acceptRes = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/accept?branchId=${BRANCH_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
    );
    expect(acceptRes.status).toBe(201);
    const accepted = await acceptRes.json() as any;

    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/treatment-plan/versions/${accepted.id}?branchId=${BRANCH_ID}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(accepted.id);
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.version).toBe(1);
  });
});

// =============================================================================
// FR1.19: initializeDentition
// =============================================================================

describe('initializeDentition handler', () => {
  afterEach(() => db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`));

  test('returns 401 when unauthenticated', async () => {
    const app = buildDentitionApp(undefined);
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/dentition`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId: NONEXISTENT_ID, dateOfBirth: '2000-01-01' }),
      },
    );
    expect(res.status).toBe(401);
  });

  test('returns 404 when visit does not exist', async () => {
    const app = buildDentitionApp(TEST_USER);
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/dentition`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId: NONEXISTENT_ID, dateOfBirth: '2000-01-01' }),
      },
    );
    expect(res.status).toBe(404);
  });

  test('initializes permanent dentition for adult patient (age > 12)', async () => {
    const visit = await seedVisit();
    const app = buildDentitionApp(TEST_USER);
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/dentition`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId: visit.id, dateOfBirth: '1990-01-01' }),
      },
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.dentitionType).toBe('permanent');
    expect(body.toothCount).toBe(32);
    expect(Array.isArray(body.teeth)).toBe(true);
  });

  test('initializes deciduous dentition for young child (age <= 5)', async () => {
    const visit = await seedVisit();
    const app = buildDentitionApp(TEST_USER);
    const threeyearsago = new Date();
    threeyearsago.setFullYear(threeyearsago.getFullYear() - 3);
    const dob = threeyearsago.toISOString().slice(0, 10);

    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/dentition`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId: visit.id, dateOfBirth: dob }),
      },
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.dentitionType).toBe('deciduous');
    expect(body.toothCount).toBe(20);
  });

  test('initializes mixed dentition for child age 6-12', async () => {
    const visit = await seedVisit();
    const app = buildDentitionApp(TEST_USER);
    const nineyearsago = new Date();
    nineyearsago.setFullYear(nineyearsago.getFullYear() - 9);
    const dob = nineyearsago.toISOString().slice(0, 10);

    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/dentition`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId: visit.id, dateOfBirth: dob }),
      },
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.dentitionType).toBe('mixed');
    expect(body.toothCount).toBe(52); // 20 deciduous + 32 permanent
  });
});

// =============================================================================
// J01: listPatientVisits
// =============================================================================

describe('listPatientVisits handler', () => {
  afterEach(() => db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`));

  test('returns 401 when unauthenticated', async () => {
    const app = buildListApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/visits`);
    expect(res.status).toBe(401);
  });

  test('returns 200 with pagination shape', async () => {
    const app = buildListApp(TEST_USER);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/visits`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(typeof body.pagination.totalCount).toBe('number');
  });

  test('returns visits for patient', async () => {
    const visit = await seedVisit();
    const app = buildListApp(TEST_USER);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/visits`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBeGreaterThan(0);
    const found = body.data.find((v: any) => v.id === visit.id);
    expect(found).toBeDefined();
    expect(found.patientId).toBe(PATIENT_ID);
    expect(found.branchId).toBe(BRANCH_ID);
    expect(Array.isArray(found.teeth)).toBe(true);
  });

  test('filters by branchId when provided', async () => {
    await seedVisit();
    const app = buildListApp(TEST_USER);
    const res = await app.request(
      `/dental/patients/${PATIENT_ID}/visits?branchId=${BRANCH_ID}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// =============================================================================
// J05: listPatientConditions
// =============================================================================

describe('listPatientConditions handler', () => {
  afterEach(() => db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`));

  test('returns 401 when unauthenticated', async () => {
    const app = buildListApp(undefined);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatments`);
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty conditions when patient has no visits', async () => {
    const app = buildListApp(TEST_USER);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  test('returns conditions after visit with chart teeth', async () => {
    const visit = await seedVisit();
    const { dentalCharts } = await import('@/handlers/dental-visit/repos/dental-chart.schema');
    await db.insert(dentalCharts).values({
      visitId: visit.id,
      patientId: PATIENT_ID,
      teeth: [
        { toothNumber: 11, state: 'caries', entryClassification: 'existing' },
        { toothNumber: 12, state: 'healthy', entryClassification: 'condition' },
      ],
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    });

    const app = buildListApp(TEST_USER);
    const res = await app.request(`/dental/patients/${PATIENT_ID}/treatments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
