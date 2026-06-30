/**
 * createDentalDepositInvoice.concurrency.test.ts — concurrent over-deposit race.
 *
 * DQ1/F-03 caps cumulative deposits on a visit at the PLANNED estimate:
 *   existingDepositCents (SUM of non-voided deposits) + depositCents <= estimateCents.
 * That read-then-write of existingDepositCents races under READ COMMITTED — two
 * concurrent deposits could both read existingDepositCents=0, both pass the cap,
 * and both mint a deposit invoice, together collecting MORE than the planned
 * estimate and stranding un-appliable credit.
 *
 * The handler already guards this with a per-visit
 * `pg_advisory_xact_lock(1003, hashtext(visitId))` taken before the cap read, which
 * serializes deposit creation for the visit so the cumulative read + mint are
 * atomic. This test pins that protection.
 *
 * RED-proof: comment out ONLY the `pg_advisory_xact_lock(1003, ...)` line in
 * createDentalDepositInvoice.ts and a round races → both 201, two deposit invoices,
 * summed deposit total 10000 > estimate 6300.
 * GREEN: each round yields exactly one 201 + one 422 DEPOSIT_EXCEEDS_ESTIMATE and the
 * summed non-voided deposit total never exceeds the planned estimate.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
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
import { createDentalDepositInvoice } from './createDentalDepositInvoice';
import { CreateDentalDepositInvoiceBody } from '@/generated/openapi/validators';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: de91 (hex only).
const USER = { id: '00000000-0000-4000-8000-00000de91001', email: 'owner@deprace.com' };
const ORG = 'ea000000-0000-4000-8000-00000de91001';
const BRANCH = 'ba000000-0000-4000-8000-00000de91001';
const MEMBER = 'ca000000-0000-4000-8000-00000de91001';
const PERSON = 'fa000000-0000-4000-8000-00000de91001';
const PATIENT = 'aa000000-0000-4000-8000-00000de91001';

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'DepositRace Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER, branchId: BRANCH, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'Deposit', lastName: 'Race', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_invoice_line_item, dental_invoice, dental_treatment, dental_visit CASCADE`);
});

/** Active visit with a single PLANNED treatment summing to `estimate`. */
async function seedPlannedVisit(estimateCents = 6300): Promise<string> {
  const visitRepo = new VisitRepository(db);
  const v = await visitRepo.createOne({ patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER });
  const visit = await visitRepo.activate(v.id);
  const visitId = visit!.id;
  await new TreatmentRepository(db).createOne({
    visitId, patientId: PATIENT, cdtCode: 'D2740', description: 'Crown (planned)',
    priceCents: estimateCents, carriedOver: false, status: 'planned',
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
    ctx.set('requestId', 'test-req');
    await next();
  });
  app.post('/dental/billing/invoices/deposit', zValidator('json', CreateDentalDepositInvoiceBody, ve), createDentalDepositInvoice as any);
  return app;
}

function postDeposit(visitId: string, depositCents: number) {
  return buildApp().request('/dental/billing/invoices/deposit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId, patientId: PATIENT, branchId: BRANCH, dentistMemberId: MEMBER, depositCents }),
  });
}

/** Summed total of the visit's non-voided deposit invoices + how many exist. */
async function depositState(visitId: string): Promise<{ sum: number; count: number }> {
  const rows = await db.execute(sql`
    SELECT COALESCE(SUM(total_cents),0)::int AS s, COUNT(*)::int AS n
    FROM dental_invoice
    WHERE visit_id = ${visitId} AND kind = 'deposit' AND status <> 'voided'
  `);
  const r = (rows as any).rows?.[0] ?? (rows as any)[0];
  return { sum: Number(r.s), count: Number(r.n) };
}

describe('createDentalDepositInvoice — concurrent deposits cannot exceed the planned estimate', () => {
  test('two simultaneous deposits each <= estimate but summing > estimate → exactly one 201, one 422 DEPOSIT_EXCEEDS_ESTIMATE', async () => {
    const ROUNDS = 8;
    const ESTIMATE = 6300;
    const EACH = 5000; // each <= 6300, but 10000 together exceeds it
    for (let i = 0; i < ROUNDS; i++) {
      const visitId = await seedPlannedVisit(ESTIMATE);

      const [a, b] = await Promise.all([postDeposit(visitId, EACH), postDeposit(visitId, EACH)]);
      const statuses = [a.status, b.status];

      const { sum, count } = await depositState(visitId);

      // Money-integrity invariant: the 1003 lock must hold the cumulative cap —
      // the summed non-voided deposits may never exceed the planned estimate.
      expect(sum, `round ${i}: summed deposits must not exceed the ${ESTIMATE} estimate (sum=${sum} statuses=${statuses})`).toBeLessThanOrEqual(ESTIMATE);
      expect(sum, `round ${i}: exactly one 5000 deposit may mint`).toBe(EACH);
      expect(count, `round ${i}: exactly one deposit invoice may exist`).toBe(1);

      const winners = [a, b].filter((r) => r.status === 201);
      expect(winners.length, `round ${i}: exactly one deposit may succeed (statuses ${statuses})`).toBe(1);
      const loser = [a, b].find((r) => r.status !== 201)!;
      expect(loser.status, `round ${i}: the loser must be a clean 422`).toBe(422);
      const loserBody = (await loser.json()) as { code?: string };
      expect(loserBody.code, `round ${i}: loser must be DEPOSIT_EXCEEDS_ESTIMATE`).toBe('DEPOSIT_EXCEEDS_ESTIMATE');

      await db.execute(sql`TRUNCATE TABLE dental_invoice_line_item, dental_invoice, dental_treatment, dental_visit CASCADE`);
    }
  });
});
