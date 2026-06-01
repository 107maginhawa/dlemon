/**
 * GAP-001 — ENTITY CREATE accepts + persists an inbound `localId`.
 *
 * Offline-first clients generate a stable `localId` before they reach the server.
 * The create path for each syncable entity (dental_visit, dental_chart,
 * dental_treatment, dental_invoice) must accept that optional `localId`, persist
 * it, and echo it back. Omitting it must still succeed (localId NULL).
 *
 * syncStatus is born 'synced' (server-acknowledged write) per syncableEntityFields.
 *
 * DB-backed: hits the real handlers through Hono with zValidator, against the
 * test Postgres, so it catches both validator stripping and repo persistence.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateDentalVisitBody,
  UpsertDentalChartBody,
  UpsertDentalChartParams,
  CreateDentalTreatmentBody,
  CreateDentalTreatmentParams,
  CreateDentalInvoiceBody,
} from '@/generated/openapi/validators';
import { createDentalVisit } from './visits/createDentalVisit';
import { upsertDentalChart } from './chart/upsertDentalChart';
import { createDentalTreatment } from './treatments/createDentalTreatment';
import { createDentalInvoice } from '@/handlers/dental-billing/createDentalInvoice';
import { VisitRepository } from './repos/visit.repo';
import { TreatmentRepository } from './repos/treatment.repo';
import { dentalVisits } from './repos/visit.schema';
import { dentalCharts } from './repos/dental-chart.schema';
import { dentalTreatments } from './repos/treatment.schema';
import { dentalInvoices } from '@/handlers/dental-billing/repos/dental-invoice.schema';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique BRANCH/MEMBER tag (af1) to avoid the dental_membership
// (person_id, branch_id) cross-suite partial-unique collision.
const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const PERSON_ID = 'e0000000-0000-1000-8000-000000000001';
const BRANCH_ID = '7b000000-0000-4000-8000-000000000af1';
const MEMBER_ID = '7c000000-0000-4000-8000-000000000af1';
const ORG_ID = 'af100000-0000-1000-8000-000000000001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'GAP-001 Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Test Dentist', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Test', lastName: 'Patient', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

const ChartBodyOnly = UpsertDentalChartBody.omit({ visitId: true });

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
    ctx.set('session', { id: 'test-session', userId: TEST_USER.id });
    await next();
  });
  app.post('/dental/visits', zValidator('json', CreateDentalVisitBody, ve), createDentalVisit as any);
  app.post('/dental/visits/:visitId/chart', zValidator('param', UpsertDentalChartParams, ve), zValidator('json', ChartBodyOnly, ve), upsertDentalChart as any);
  app.post('/dental/visits/:visitId/treatments', zValidator('param', CreateDentalTreatmentParams, ve), zValidator('json', CreateDentalTreatmentBody, ve), createDentalTreatment as any);
  app.post('/dental/billing/invoices', zValidator('json', CreateDentalInvoiceBody, ve), createDentalInvoice as any);
  return app;
}

const post = (app: Hono, path: string, body: unknown) =>
  app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Each visit must be discarded after use so the next create isn't blocked by the
// "active visit already exists" guard — but createDentalVisit births in 'draft',
// so the active guard only triggers once a visit is activated. We use fresh
// patients-of-record by discarding any prior draft.
async function freshVisitId(localId?: string): Promise<string> {
  const repo = new VisitRepository(db);
  const existing = await repo.findInProgressByPatient(PATIENT_ID);
  if (existing) await repo.discard(existing.id);
  const v = await repo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, localId });
  return v.id;
}

// ---------------------------------------------------------------------------
describe('GAP-001: dental_visit create persists inbound localId', () => {
  test('POST /dental/visits stores + returns localId, syncStatus defaults to synced', async () => {
    const app = buildApp();
    // Clear any prior in-progress visit for this patient.
    const repo = new VisitRepository(db);
    const existing = await repo.findInProgressByPatient(PATIENT_ID);
    if (existing) await repo.discard(existing.id);

    const res = await post(app, '/dental/visits', {
      patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
      localId: 'gap001-visit-abc',
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.localId).toBe('gap001-visit-abc');
    expect(body.syncStatus).toBe('synced');

    const [row] = await db.select().from(dentalVisits).where(eq(dentalVisits.id, body.id));
    expect(row?.localId).toBe('gap001-visit-abc');
  });

  test('POST /dental/visits without localId still succeeds (localId NULL)', async () => {
    const app = buildApp();
    const repo = new VisitRepository(db);
    const existing = await repo.findInProgressByPatient(PATIENT_ID);
    if (existing) await repo.discard(existing.id);

    const res = await post(app, '/dental/visits', {
      patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.localId).toBeNull();
    expect(body.syncStatus).toBe('synced');
  });
});

describe('GAP-001: dental_chart create persists inbound localId', () => {
  test('POST /dental/visits/:id/chart stores localId on first insert', async () => {
    const app = buildApp();
    const visitId = await freshVisitId();
    const res = await post(app, `/dental/visits/${visitId}/chart`, {
      patientId: PATIENT_ID,
      teeth: [{ toothNumber: 11, state: 'healthy' }],
      localId: 'gap001-chart-xyz',
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    const [row] = await db.select().from(dentalCharts).where(eq(dentalCharts.id, body.id));
    expect(row?.localId).toBe('gap001-chart-xyz');
    expect(row?.syncStatus).toBe('synced');
  });

  test('POST chart without localId still succeeds (localId NULL)', async () => {
    const app = buildApp();
    const visitId = await freshVisitId();
    const res = await post(app, `/dental/visits/${visitId}/chart`, {
      patientId: PATIENT_ID,
      teeth: [{ toothNumber: 21, state: 'healthy' }],
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    const [row] = await db.select().from(dentalCharts).where(eq(dentalCharts.id, body.id));
    expect(row?.localId).toBeNull();
  });
});

describe('GAP-001: dental_treatment create persists inbound localId', () => {
  test('POST /dental/visits/:id/treatments stores + returns localId', async () => {
    const app = buildApp();
    const visitId = await freshVisitId();
    const res = await post(app, `/dental/visits/${visitId}/treatments`, {
      visitId, patientId: PATIENT_ID, cdtCode: 'D1110',
      description: 'Adult prophylaxis', priceCents: 5000,
      localId: 'gap001-tx-001',
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.localId).toBe('gap001-tx-001');
    const [row] = await db.select().from(dentalTreatments).where(eq(dentalTreatments.id, body.id));
    expect(row?.localId).toBe('gap001-tx-001');
    expect(row?.syncStatus).toBe('synced');
  });

  test('POST treatment without localId still succeeds (localId NULL)', async () => {
    const app = buildApp();
    const visitId = await freshVisitId();
    const res = await post(app, `/dental/visits/${visitId}/treatments`, {
      visitId, patientId: PATIENT_ID, cdtCode: 'D0120',
      description: 'Periodic exam', priceCents: 3000,
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.localId).toBeNull();
  });
});

describe('GAP-001: dental_invoice create persists inbound localId', () => {
  async function seedBillableVisit(): Promise<string> {
    const visitId = await freshVisitId();
    const treatmentRepo = new TreatmentRepository(db);
    await treatmentRepo.createOne({
      visitId, patientId: PATIENT_ID, cdtCode: 'D1110',
      description: 'Adult prophylaxis', priceCents: 5000, status: 'performed',
    });
    await db.insert(consentForms).values({
      id: crypto.randomUUID(), visitId, patientId: PATIENT_ID,
      templateId: 'general-consent-v1', templateName: 'General Treatment Consent',
      signed: true, signedAt: new Date(), signatureData: 'data:image/png;base64,test',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    });
    return visitId;
  }

  test('POST /dental/billing/invoices stores + returns localId', async () => {
    const app = buildApp();
    const visitId = await seedBillableVisit();
    const res = await post(app, '/dental/billing/invoices', {
      visitId, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
      localId: 'gap001-inv-001',
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.localId).toBe('gap001-inv-001');
    const [row] = await db.select().from(dentalInvoices).where(eq(dentalInvoices.id, body.id));
    expect(row?.localId).toBe('gap001-inv-001');
    expect(row?.syncStatus).toBe('synced');
  });

  test('POST invoice without localId still succeeds (localId NULL)', async () => {
    const app = buildApp();
    const visitId = await seedBillableVisit();
    const res = await post(app, '/dental/billing/invoices', {
      visitId, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.localId).toBeNull();
  });
});
