/**
 * createDentalInvoice.concurrency.test.ts — WFG-004 (concurrent double-billing)
 *
 * The already-billed guard (S1-T7) is a CHECK-THEN-ACT: it reads the visit's
 * treatments, finds none with a billedInvoiceId, then creates an invoice and marks
 * them billed. Under Postgres READ COMMITTED two concurrent createDentalInvoice for
 * the SAME visit each read billedInvoiceId=null (the other's write is invisible until
 * commit), both pass the guard, and each mints an invoice — double-billing. Only the
 * sequential case was tested.
 *
 * Fix: the invoice path now reads the treatments with a row-level FOR UPDATE lock
 * (getTreatmentsForInvoiceLocked → findByVisitForUpdate) inside its transaction, so the
 * two creates serialize on the treatment rows: the loser blocks until the winner commits
 * markTreatmentsAsBilled, then reads the billed rows and is rejected (422
 * TREATMENT_ALREADY_BILLED).
 *
 * RED-proof: with the FOR UPDATE lock removed, at least one of the rounds below races
 * past the guard (both 201 → two invoices for one visit) and the count assertion fails.
 * With the lock, every round deterministically yields exactly one 201 + one 422 + one
 * invoice. Multiple rounds make the regression guard robust against the inherently
 * probabilistic nature of the unlocked race.
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

// Suite-unique tag: 104.
const USER = { id: '00000000-0000-4000-8000-000000104001', email: 'owner@raceiv.com' };
const ORG = 'ea000000-0000-4000-8000-000000104001';
const BRANCH = 'ba000000-0000-4000-8000-000000104001';
const MEMBER = 'ca000000-0000-4000-8000-000000104001';

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      dental_invoice_line_item, dental_invoice, dental_treatment,
      consent_form, dental_visit
    CASCADE
  `);
});

async function ensureOrg() {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'RaceIv Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
}

/** Seed a fresh patient + active visit + performed treatment + signed consent. */
async function seedBillableVisit(): Promise<{ visitId: string; patientId: string }> {
  await ensureOrg();
  const personId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  await db.insert(persons).values({ id: personId, firstName: 'Race', lastName: 'Subject', createdBy: USER.id, updatedBy: USER.id });
  await db.insert(patients).values({ id: patientId, person: personId, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id });

  const visitRepo = new VisitRepository(db);
  const v = await visitRepo.createOne({ patientId, branchId: BRANCH, dentistMemberId: MEMBER });
  const visit = await visitRepo.activate(v.id);
  const visitId = visit!.id;
  await new TreatmentRepository(db).createOne({
    visitId, patientId, cdtCode: 'D2150', description: 'Amalgam',
    priceCents: 5000, carriedOver: false, status: 'performed',
  });
  await db.insert(consentForms).values({
    id: crypto.randomUUID(), visitId, patientId,
    templateId: 'general-consent-v1', templateName: 'General Treatment Consent',
    signed: true, signedAt: new Date(), signatureData: 'data:image/png;base64,test',
    createdBy: USER.id, updatedBy: USER.id,
  });
  return { visitId, patientId };
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

function createInvoice(visitId: string, patientId: string) {
  return buildApp().request('/dental/billing/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId, patientId, branchId: BRANCH, dentistMemberId: MEMBER }),
  });
}

async function countInvoicesForVisit(visitId: string): Promise<number> {
  const rows = await db.execute(sql`SELECT count(*)::int AS n FROM dental_invoice WHERE visit_id = ${visitId}`);
  const r = rows as unknown as { rows?: Array<{ n: number }> };
  return r.rows?.[0]?.n ?? (rows as unknown as Array<{ n: number }>)[0]?.n ?? 0;
}

describe('WFG-004 — concurrent createDentalInvoice for one visit cannot double-bill', () => {
  test('two simultaneous creates for the same visit → exactly one 201, one 422, one invoice', async () => {
    const ROUNDS = 8;
    for (let i = 0; i < ROUNDS; i++) {
      const { visitId, patientId } = await seedBillableVisit();

      const [a, b] = await Promise.all([
        createInvoice(visitId, patientId),
        createInvoice(visitId, patientId),
      ]);
      const statuses = [a.status, b.status];

      // The money-integrity invariant: at most ONE invoice may exist for the visit.
      const count = await countInvoicesForVisit(visitId);
      expect(count, `round ${i}: exactly one invoice may exist for the visit (statuses ${statuses})`).toBe(1);

      // Exactly one create succeeds; the loser is REJECTED (422 ALREADY_BILLED), not 500.
      const winners = [a, b].filter((r) => r.status === 201);
      expect(winners.length, `round ${i}: exactly one create may succeed (statuses ${statuses})`).toBe(1);
      const loser = [a, b].find((r) => r.status !== 201)!;
      expect(loser.status, `round ${i}: the loser must be a clean 422, not an error`).toBe(422);
      const loserBody = (await loser.json()) as { code?: string };
      expect(loserBody.code, `round ${i}: loser must be TREATMENT_ALREADY_BILLED`).toBe('TREATMENT_ALREADY_BILLED');

      // Truncate between rounds so countInvoicesForVisit stays clean and the next
      // round's fresh patient/visit is isolated.
      await db.execute(sql`TRUNCATE TABLE dental_invoice_line_item, dental_invoice, dental_treatment, consent_form, dental_visit CASCADE`);
    }
  });
});
