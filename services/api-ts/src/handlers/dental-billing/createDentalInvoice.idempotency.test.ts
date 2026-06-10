/**
 * createDentalInvoice.idempotency.test.ts — SL-01 / E-NEW-05 (invoice installment)
 *
 * `localId` is the client-generated, offline-stable id for a create. It was
 * persisted + echoed on invoice creates but was NOT an idempotency key. Worse than
 * a duplicate row: because the first successful create marks its treatments billed
 * (S1-T7), a retried offline create (same localId, dropped ACK) hits the
 * already-billed guard and returns a confusing 422 TREATMENT_ALREADY_BILLED instead
 * of the original invoice. Mirrors the visit/treatment installments: a create
 * carrying a previously-seen localId MUST return the existing row, idempotently.
 *
 * Invoice localId is scoped to the branch, so dedup is on (branchId, localId).
 *
 * RED-proof: the second POST with the same localId returns 422 (ALREADY_BILLED)
 * before the fix, and a 201 echoing the SAME invoice id after.
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

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 103.
const USER = { id: '00000000-0000-4000-8000-000000103001', email: 'owner@idemiv.com' };
const ORG = 'ea000000-0000-4000-8000-000000103001';
const BRANCH = 'ba000000-0000-4000-8000-000000103001';
const MEMBER = 'ca000000-0000-4000-8000-000000103001';
const PERSON = 'fa000000-0000-4000-8000-000000103001';
const PATIENT = 'aa000000-0000-4000-8000-000000103001';
const PERSON2 = 'fa000000-0000-4000-8000-000000103002';
const PATIENT2 = 'aa000000-0000-4000-8000-000000103002';

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      dental_invoice_line_item, dental_invoice, dental_treatment,
      consent_form, dental_visit
    CASCADE
  `);
});

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'IdemIv Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'IdemIv', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON2, firstName: 'IdemIv', lastName: 'Patient2', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT2, person: PERSON2, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
}

/** Seed an active visit with a performed (billable) treatment + signed consent. */
async function seedBillableVisit(): Promise<string> {
  await ensureOrg();
  const visitRepo = new VisitRepository(db);
  const v = await visitRepo.createOne({ patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER });
  const visit = await visitRepo.activate(v.id);
  const visitId = visit!.id;
  await new TreatmentRepository(db).createOne({
    visitId, patientId: PATIENT, cdtCode: 'D2150', description: 'Amalgam',
    priceCents: 5000, carriedOver: false, status: 'performed',
  });
  await db.insert(consentForms).values({
    id: crypto.randomUUID(), visitId, patientId: PATIENT,
    templateId: 'general-consent-v1', templateName: 'General Treatment Consent',
    signed: true, signedAt: new Date(), signatureData: 'data:image/png;base64,test',
    createdBy: USER.id, updatedBy: USER.id,
  });
  return visitId;
}

const ve = (r: any, c: any) => { if (!r.success) return c.json({ error: 'Validation failed', issues: r.error.issues }, 400); };

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    ctx.set('user', USER);
    ctx.set('session', { id: 'sess', userId: USER.id });
    await next();
  });
  app.post('/dental/billing/invoices', zValidator('json', CreateDentalInvoiceBody, ve), createDentalInvoice as any);
  return app;
}

async function createInvoice(visitId: string, localId?: string, patientId: string = PATIENT) {
  const body: Record<string, unknown> = { visitId, patientId, branchId: BRANCH, dentistMemberId: MEMBER };
  if (localId !== undefined) body['localId'] = localId;
  return buildApp().request('/dental/billing/invoices', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

async function countInvoices(): Promise<number> {
  const rows = await db.execute(sql`SELECT count(*)::int AS n FROM dental_invoice WHERE branch_id = ${BRANCH}`);
  return ((rows as unknown as { rows?: Array<{ n: number }> }).rows?.[0]?.n) ?? (rows as unknown as Array<{ n: number }>)[0]?.n ?? 0;
}

describe('SL-01 / E-NEW-05 — createDentalInvoice is idempotent on localId', () => {
  test('a retried create with the same localId returns the SAME invoice (not 422 ALREADY_BILLED)', async () => {
    const visitId = await seedBillableVisit();
    const localId = 'local-inv-aaaa-1111';

    const first = await createInvoice(visitId, localId);
    expect(first.status).toBe(201);
    const i1 = await first.json() as { id: string; lineItems: unknown[] };

    const second = await createInvoice(visitId, localId);
    expect([200, 201]).toContain(second.status); // RED before: 422 TREATMENT_ALREADY_BILLED
    const i2 = await second.json() as { id: string; lineItems: unknown[] };

    expect(i2.id).toBe(i1.id);                 // same invoice echoed
    expect(Array.isArray(i2.lineItems)).toBe(true);
    expect(await countInvoices()).toBe(1);     // no duplicate row
  });

  test('distinct localIds on distinct visits create distinct invoices (no false dedup)', async () => {
    const visitA = await seedBillableVisit();
    const a = await createInvoice(visitA, 'local-inv-bbbb-1');
    expect(a.status).toBe(201);
    const ia = await a.json() as { id: string };

    // A second billable visit for a DIFFERENT patient (one-active-visit-per-patient).
    const visitRepo = new VisitRepository(db);
    const v2 = await visitRepo.createOne({ patientId: PATIENT2, branchId: BRANCH, dentistMemberId: MEMBER });
    const visit2 = await visitRepo.activate(v2.id);
    await new TreatmentRepository(db).createOne({ visitId: visit2!.id, patientId: PATIENT2, cdtCode: 'D2160', description: 'Amalgam 2srf', priceCents: 6000, carriedOver: false, status: 'performed' });
    await db.insert(consentForms).values({ id: crypto.randomUUID(), visitId: visit2!.id, patientId: PATIENT2, templateId: 'general-consent-v1', templateName: 'General Treatment Consent', signed: true, signedAt: new Date(), signatureData: 'x', createdBy: USER.id, updatedBy: USER.id });

    const b = await createInvoice(visit2!.id, 'local-inv-bbbb-2', PATIENT2);
    expect(b.status).toBe(201);
    const ib = await b.json() as { id: string };

    expect(ib.id).not.toBe(ia.id);
    expect(await countInvoices()).toBe(2);
  });
});
