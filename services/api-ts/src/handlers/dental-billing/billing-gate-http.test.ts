/**
 * BR-009 — Billing gate HTTP enforcement
 *
 * business-rules.test.ts already tests: diagnosed treatment → invoice fails (4xx).
 * This file explicitly proves the same gate for `planned` status (T6 Task-3 scope).
 *
 * STOP CONDITION REPORTED — BR-011 (invoice requires signed consent):
 * createDentalInvoice does NOT check for a signed consent form before creating
 * an invoice. The handler only validates that performed/verified treatments exist.
 * A test for "invoice blocked without consent" cannot be written because the
 * production code does not enforce this rule.
 * → Do not add that test here until the handler is updated to enforce BR-011.
 *
 * Pattern follows business-rules.test.ts exactly.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { createDentalInvoice } from './createDentalInvoice';
import { CreateDentalInvoiceBody } from '@/generated/openapi/validators';

// ---------------------------------------------------------------------------
// DB + constants — unique IDs avoid collisions with business-rules.test.ts
// ---------------------------------------------------------------------------

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER  = { id: 'b0000000-0000-0000-0000-000000000001', email: 'billing-gate-test@clinic.com' };
const PERSON_ID  = 'b2000000-0000-1000-8000-000000000001';
const PATIENT_ID = 'b1000000-0000-1000-8000-000000000001';
const BRANCH_ID  = 'b3000000-0000-1000-8000-000000000002';
const ORG_ID     = 'b4000000-0000-1000-8000-000000000004';
const MEMBER_ID  = 'b5000000-0000-1000-8000-000000000003';

// ---------------------------------------------------------------------------
// Hono app wiring
// ---------------------------------------------------------------------------

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
  }
};

function makeApp(user?: typeof TEST_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: 'Internal server error' }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'billing-gate-session', userId: user.id });
    }
    await next();
  });
  app.post(
    '/dental/billing/invoices',
    zValidator('json', CreateDentalInvoiceBody, validationErrorHandler),
    createDentalInvoice as any,
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
      dental_treatment,
      dental_chart,
      visit_notes,
      consent_form,
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

async function ensureMembership() {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Billing Gate Test Clinic', ownerPersonId: TEST_USER.id,
    tier: 'solo', countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Billing Gate Test Dentist', role: 'dentist_owner', status: 'active',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Billing', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
}

async function seedActiveVisit() {
  await ensureMembership();
  const repo = new VisitRepository(db);
  const visit = await repo.createOne({
    patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
  });
  return repo.activate(visit.id) as Promise<NonNullable<Awaited<ReturnType<VisitRepository['activate']>>>>;
}

async function seedTreatment(visitId: string, status: string) {
  const repo = new TreatmentRepository(db);
  return repo.createOne({
    visitId, patientId: PATIENT_ID, cdtCode: 'D0120',
    description: 'Periodic oral evaluation', priceCents: 5000,
    carriedOver: false, status: status as any,
  });
}

function invoiceBody(visitId: string) {
  return {
    visitId,
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
  };
}

async function seedSignedConsent(visitId: string) {
  const [cf] = await db.insert(consentForms).values({
    id: crypto.randomUUID(), visitId, patientId: PATIENT_ID,
    templateId: 'general-consent-v1', templateName: 'General Treatment Consent',
    signed: true, signedAt: new Date(), signatureData: 'data:image/png;base64,test',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  return cf!;
}

// ---------------------------------------------------------------------------
// BR-009: invoice blocked when no performed/verified treatments
// ---------------------------------------------------------------------------

describe('BR-009 billing gate — planned treatment not billable (HTTP enforcement)', () => {
  test('POST invoice with only planned treatment → 422 NO_BILLABLE_TREATMENTS [BR-009]', async () => {
    const visit = await seedActiveVisit();
    await seedTreatment(visit.id, 'planned');
    await seedSignedConsent(visit.id);
    const app = makeApp(TEST_USER);
    const res = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceBody(visit.id)),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('NO_BILLABLE_TREATMENTS');
    expect(body.error).toMatch(/billable/i);
  });

  test('POST invoice with performed treatment → 201 [BR-009]', async () => {
    const visit = await seedActiveVisit();
    await seedTreatment(visit.id, 'performed');
    await seedSignedConsent(visit.id);
    const app = makeApp(TEST_USER);
    const res = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceBody(visit.id)),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(Array.isArray(body.lineItems)).toBe(true);
    expect(body.lineItems.length).toBe(1);
  });

  test('POST invoice with mix of planned and performed → 201 (performed treatment is billable) [BR-009]', async () => {
    const visit = await seedActiveVisit();
    await seedTreatment(visit.id, 'planned');
    await seedTreatment(visit.id, 'performed');
    await seedSignedConsent(visit.id);
    const app = makeApp(TEST_USER);
    const res = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceBody(visit.id)),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    // Only the performed treatment is billed
    expect(body.lineItems.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// BR-011: invoice blocked when patient has no signed consent
// ---------------------------------------------------------------------------

describe('BR-011 consent gate — invoice requires signed consent form', () => {
  test('AC-001: createDentalInvoice blocked when no signed consent form exists [BR-011]', async () => {
    const visit = await seedActiveVisit();
    await seedTreatment(visit.id, 'performed');
    // NO consent form seeded
    const app = makeApp(TEST_USER);
    const res = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceBody(visit.id)),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('CONSENT_REQUIRED');
  });

  test('AC-002: createDentalInvoice succeeds when signed consent form exists [BR-011]', async () => {
    const visit = await seedActiveVisit();
    await seedTreatment(visit.id, 'performed');
    await seedSignedConsent(visit.id);
    const app = makeApp(TEST_USER);
    const res = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceBody(visit.id)),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(Array.isArray(body.lineItems)).toBe(true);
    expect(body.lineItems.length).toBe(1);
  });

  test('AC-001: unsigned consent form does not satisfy the gate [BR-011]', async () => {
    const visit = await seedActiveVisit();
    await seedTreatment(visit.id, 'performed');
    // Insert an unsigned consent form
    await db.insert(consentForms).values({
      id: crypto.randomUUID(), visitId: visit.id, patientId: PATIENT_ID,
      templateId: 'general-consent-v1', templateName: 'General Treatment Consent',
      signed: false,
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    });
    const app = makeApp(TEST_USER);
    const res = await app.request('/dental/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceBody(visit.id)),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('CONSENT_REQUIRED');
  });
});
