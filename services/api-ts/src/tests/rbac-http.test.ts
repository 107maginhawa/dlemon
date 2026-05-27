/**
 * RBAC HTTP enforcement tests
 *
 * Proves that assertBranchRole blocks under-privileged roles at the API layer.
 * Three members in the SAME branch with different roles:
 *   - OWNER      (dentist_owner)     — can do everything tested here
 *   - ASSOCIATE  (dentist_associate) — clinical writes OK, void invoice blocked
 *   - SCHEDULER  (staff_scheduling)  — no clinical writes
 *
 * Routes covered:
 *   PATCH /dental/visits/:visitId/treatments/:treatmentId  (assertBranchRole: dentist_owner | dentist_associate)
 *   POST  /dental/visits/:visitId/treatments              (assertBranchRole: dentist_owner | dentist_associate)
 *   POST  /dental/billing/invoices/:invoiceId/void        (assertBranchRole: dentist_owner only)
 *
 * Pattern: business-rules.test.ts (real DB, real Hono, afterEach TRUNCATE).
 * UUID prefix rb to avoid collisions.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { ConsentFormRepository } from '@/handlers/dental-clinical/repos/consent-form.repo';
import { DentalInvoiceRepository } from '@/handlers/dental-billing/repos/dental-invoice.repo';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

import { updateDentalTreatment } from './dental-visit/updateDentalTreatment';
import { createDentalTreatment } from './dental-visit/createDentalTreatment';
import { voidDentalInvoice } from './dental-billing/voidDentalInvoice';
import {
  UpdateDentalTreatmentParams,
  UpdateDentalTreatmentBody,
  CreateDentalTreatmentParams,
  CreateDentalTreatmentBody,
  VoidDentalInvoiceParams,
} from '@/generated/openapi/validators';

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// ---------------------------------------------------------------------------
// Fixed identities
// ---------------------------------------------------------------------------

const USER_OWNER     = { id: 'ec100000-0000-0000-0000-000000000001', email: 'owner@rbac.com' };
const USER_ASSOCIATE = { id: 'ec100000-0000-0000-0000-000000000002', email: 'associate@rbac.com' };
const USER_SCHEDULER = { id: 'ec100000-0000-0000-0000-000000000003', email: 'scheduler@rbac.com' };

const PERSON_OWNER     = 'ec200000-0000-1000-8000-000000000001';
const PERSON_ASSOCIATE = 'ec200000-0000-1000-8000-000000000002';
const PERSON_SCHEDULER = 'ec200000-0000-1000-8000-000000000003';
const PERSON_PATIENT   = 'ec200000-0000-1000-8000-000000000004';

const PATIENT_ID   = 'ec300000-0000-1000-8000-000000000001';
const BRANCH_ID    = 'ec400000-0000-1000-8000-000000000001';
const ORG_ID       = 'ec500000-0000-1000-8000-000000000001';
const MEMBER_OWNER = 'ec600000-0000-1000-8000-000000000001';
const MEMBER_ASSOC = 'ec600000-0000-1000-8000-000000000002';
const MEMBER_SCHED = 'ec600000-0000-1000-8000-000000000003';

// ---------------------------------------------------------------------------
// Hono app factory
// ---------------------------------------------------------------------------

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
};

function makeApp(user: { id: string; email: string }) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: 'Internal server error' }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', user);
    ctx.set('session', { id: 'rbac-session', userId: user.id });
    await next();
  });
  app.patch(
    '/dental/visits/:visitId/treatments/:treatmentId',
    zValidator('param', UpdateDentalTreatmentParams, validationErrorHandler),
    zValidator('json', UpdateDentalTreatmentBody, validationErrorHandler),
    updateDentalTreatment as any,
  );
  app.post(
    '/dental/visits/:visitId/treatments',
    zValidator('param', CreateDentalTreatmentParams, validationErrorHandler),
    zValidator('json', CreateDentalTreatmentBody, validationErrorHandler),
    createDentalTreatment as any,
  );
  app.post(
    '/dental/billing/invoices/:invoiceId/void',
    zValidator('param', VoidDentalInvoiceParams, validationErrorHandler),
    voidDentalInvoice as any,
  );
  return app;
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      dental_invoice_line_item,
      dental_invoice,
      consent_form,
      dental_treatment,
      dental_chart,
      visit_notes,
      dental_visit,
      patient,
      person,
      dental_membership,
      dental_branch,
      dental_organization
    CASCADE
  `);
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'RBAC Test Clinic', ownerPersonId: USER_OWNER.id,
    tier: 'solo', countryCode: 'PH', createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
  }).onConflictDoNothing();
  // Three members, three roles, same branch
  for (const [userId, personId, memberId, role] of [
    [USER_OWNER.id,     PERSON_OWNER,     MEMBER_OWNER, 'dentist_owner'],
    [USER_ASSOCIATE.id, PERSON_ASSOCIATE, MEMBER_ASSOC, 'dentist_associate'],
    [USER_SCHEDULER.id, PERSON_SCHEDULER, MEMBER_SCHED, 'staff_scheduling'],
  ] as const) {
    await db.insert(persons).values({
      id: personId, firstName: 'RBAC', lastName: role,
      createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
    }).onConflictDoNothing();
    await db.insert(dentalMemberships).values({
      id: memberId, branchId: BRANCH_ID, personId: userId,
      displayName: `RBAC ${role}`, role, status: 'active',
      createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
    }).onConflictDoNothing();
  }
  // Patient
  await db.insert(persons).values({
    id: PERSON_PATIENT, firstName: 'RBAC', lastName: 'Patient',
    createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_PATIENT, preferredBranchId: BRANCH_ID,
    createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
  }).onConflictDoNothing();
}

async function seedActiveVisit() {
  await ensureOrg();
  const repo = new VisitRepository(db);
  const visit = await repo.createOne({
    patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_OWNER,
  });
  return repo.activate(visit.id) as Promise<NonNullable<Awaited<ReturnType<VisitRepository['activate']>>>>;
}

async function seedTreatment(visitId: string, status?: string) {
  const repo = new TreatmentRepository(db);
  return repo.createOne({
    visitId, patientId: PATIENT_ID, cdtCode: 'D0120',
    description: 'Periodic oral evaluation', priceCents: 5000, carriedOver: false,
    ...(status ? { status: status as any } : {}),
  });
}

async function seedSignedConsent(visitId: string) {
  const repo = new ConsentFormRepository(db);
  const form = await repo.createOne({
    visitId, patientId: PATIENT_ID, templateId: 'tmpl-001', templateName: 'General Consent',
  });
  await repo.sign(form.id, 'data:image/png;base64,test-sig');
}

async function seedInvoice(visitId: string) {
  const repo = new DentalInvoiceRepository(db);
  const invoiceNumber = await repo.generateInvoiceNumber();
  return repo.createOne({
    id: 'ec700000-0000-1000-8000-000000000001',
    visitId, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_OWNER, invoiceNumber, status: 'draft',
    subtotalCents: 5000, discountCents: 0, taxCents: 0,
    taxRate: '0', totalCents: 5000, paidCents: 0, balanceCents: 5000,
    createdBy: USER_OWNER.id, updatedBy: USER_OWNER.id,
  });
}

// ---------------------------------------------------------------------------
// RBAC: treatment update (dentist_owner | dentist_associate only)
// ---------------------------------------------------------------------------

describe('RBAC — PATCH treatment: staff_scheduling blocked', () => {
  test('staff_scheduling PATCH treatment status → 403 [RBAC]', async () => {
    const visit = await seedActiveVisit();
    const treatment = await seedTreatment(visit.id);
    const app = makeApp(USER_SCHEDULER);
    const res = await app.request(
      `/dental/visits/${visit.id}/treatments/${treatment.id}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'planned' }) },
    );
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toMatch(/access/i);
  });

  test('dentist_owner PATCH treatment WITH consent → 200 (role gate passes) [RBAC]', async () => {
    const visit = await seedActiveVisit();
    await seedSignedConsent(visit.id);
    const treatment = await seedTreatment(visit.id, 'planned');
    const app = makeApp(USER_OWNER);
    const res = await app.request(
      `/dental/visits/${visit.id}/treatments/${treatment.id}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'performed' }) },
    );
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(403);
  });

  test('dentist_associate PATCH treatment → not 403 (role is allowed) [RBAC]', async () => {
    const visit = await seedActiveVisit();
    const treatment = await seedTreatment(visit.id);
    const app = makeApp(USER_ASSOCIATE);
    const res = await app.request(
      `/dental/visits/${visit.id}/treatments/${treatment.id}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'planned' }) },
    );
    // Associate is allowed through the role gate; 200 or business-logic error, never 403
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// RBAC: create treatment (dentist_owner | dentist_associate only)
// ---------------------------------------------------------------------------

describe('RBAC — POST treatment: staff_scheduling blocked', () => {
  test('staff_scheduling POST new treatment → 403 [RBAC]', async () => {
    const visit = await seedActiveVisit();
    const app = makeApp(USER_SCHEDULER);
    const res = await app.request(
      `/dental/visits/${visit.id}/treatments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitId: visit.id,
          patientId: PATIENT_ID,
          cdtCode: 'D0120',
          description: 'Periodic oral evaluation',
          priceCents: 5000,
          carriedOver: false,
        }),
      },
    );
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toMatch(/access/i);
  });

  test('dentist_owner POST new treatment → not 403 (role gate passes) [RBAC]', async () => {
    const visit = await seedActiveVisit();
    const app = makeApp(USER_OWNER);
    const res = await app.request(
      `/dental/visits/${visit.id}/treatments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitId: visit.id,
          patientId: PATIENT_ID,
          cdtCode: 'D0120',
          description: 'Periodic oral evaluation',
          priceCents: 5000,
          carriedOver: false,
        }),
      },
    );
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// RBAC: void invoice (dentist_owner only)
// ---------------------------------------------------------------------------

describe('RBAC — POST invoice/void: dentist_associate and staff_scheduling blocked', () => {
  test('dentist_associate void invoice → 403 [RBAC]', async () => {
    const visit = await seedActiveVisit();
    const invoice = await seedInvoice(visit.id);
    const app = makeApp(USER_ASSOCIATE);
    const res = await app.request(
      `/dental/billing/invoices/${invoice.id}/void`,
      { method: 'POST' },
    );
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toMatch(/access/i);
  });

  test('staff_scheduling void invoice → 403 [RBAC]', async () => {
    const visit = await seedActiveVisit();
    const invoice = await seedInvoice(visit.id);
    const app = makeApp(USER_SCHEDULER);
    const res = await app.request(
      `/dental/billing/invoices/${invoice.id}/void`,
      { method: 'POST' },
    );
    expect(res.status).toBe(403);
  });

  test('dentist_owner void invoice → 200 (only allowed role) [RBAC]', async () => {
    const visit = await seedActiveVisit();
    const invoice = await seedInvoice(visit.id);
    const app = makeApp(USER_OWNER);
    const res = await app.request(
      `/dental/billing/invoices/${invoice.id}/void`,
      { method: 'POST' },
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('voided');
  });
});
