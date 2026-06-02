/**
 * P1-26 — dental-payer-payment.test.ts (Remittance Posting + reconciliation)
 *
 * Proves: remittance recomputes the invoice balance, a disallowance creates a
 * write-off, over-post is rejected, posting is idempotent on remittance
 * reference, and payer-paid + patient-paid + write-off close the invoice (the
 * reconciliation invariant).
 *
 * Seeds an issued invoice directly via the repo (no treatment/consent gate) so
 * the test focuses on the payer-payment pipeline.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import {
  RecordClaimRemittanceParams,
  RecordClaimRemittanceBody,
} from '@/generated/openapi/validators';
import { recordClaimRemittance } from './recordClaimRemittance';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite tag: rem7
const TEST_USER = { id: 'a7000000-0000-1000-8000-00000000a071', email: 'staff@rem7.com' };
const ORG_ID = 'c7000000-0000-1000-8000-00000000a071';
const BRANCH_ID = 'b7000000-0000-1000-8000-00000000a071';
const MEMBER_ID = 'a1700000-0000-1000-8000-00000000a071';
const PERSON_ID = 'e7000000-0000-1000-8000-00000000a071';
const PATIENT_ID = 'd7000000-0000-1000-8000-00000000a071';
const PROFILE_ID = 'f7000000-0000-1000-8000-00000000a071';

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalInsuranceProfiles } = await import('@/handlers/dental-patient/repos/insurance-profile.schema');

  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Rem Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Rem Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'Rem Staff', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Jose', lastName: 'Cruz', dateOfBirth: '1980-01-01', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalInsuranceProfiles).values({ id: PROFILE_ID, patientId: PATIENT_ID, insurerName: 'Intellicare', policyNumber: 'IC-1', subscriberName: 'Jose Cruz', active: true, payerType: 'hmo', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

function buildApp(user?: typeof TEST_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    if (user) { ctx.set('user', user); ctx.set('session', { id: 's', userId: user.id }); }
    await next();
  });
  app.post('/dental/billing/claims/:claimId/remittance',
    zValidator('param', RecordClaimRemittanceParams, ve),
    zValidator('json', RecordClaimRemittanceBody, ve), recordClaimRemittance as any);
  return app;
}

/** Seed an issued invoice + an approved claim anchored to it (billed = totalCents). */
async function seedIssuedInvoiceAndClaim(totalCents: number) {
  const invRepo = new DentalInvoiceRepository(db);
  const inv = await invRepo.createOne({
    patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
    invoiceNumber: `INV-REM-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    status: 'issued', subtotalCents: totalCents, totalCents, balanceCents: totalCents,
    issuedAt: new Date(), createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  });
  const claimRepo = new DentalInsuranceClaimRepository(db);
  const claim = await claimRepo.createOne({
    patientId: PATIENT_ID, insuranceProfileId: PROFILE_ID, branchId: BRANCH_ID,
    invoiceId: inv.id, claimNumber: claimRepo.generateClaimNumber(),
    status: 'approved', billedAmountCents: totalCents, paidByPayerCents: 0,
    patientPortionCents: totalCents, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  });
  return { invoiceId: inv.id, claimId: claim.id };
}

afterEach(async () => {
  const { dentalPayerPayments } = await import('./repos/dental-payer-payment.schema');
  const { dentalInsuranceClaims } = await import('./repos/dental-insurance-claim.schema');
  const { dentalPayments } = await import('./repos/dental-payment.schema');
  const { dentalInvoices } = await import('./repos/dental-invoice.schema');
  await db.delete(dentalPayerPayments);
  await db.delete(dentalInsuranceClaims).where(eq(dentalInsuranceClaims.patientId, PATIENT_ID));
  await db.delete(dentalPayments).where(eq(dentalPayments.patientId, PATIENT_ID));
  await db.delete(dentalInvoices).where(eq(dentalInvoices.patientId, PATIENT_ID));
});

describe('recordClaimRemittance', () => {
  test('full remittance pays the invoice and moves the claim to paid', async () => {
    const app = buildApp(TEST_USER);
    const { invoiceId, claimId } = await seedIssuedInvoiceAndClaim(100000);
    const res = await app.request(`/dental/billing/claims/${claimId}/remittance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 100000, remittanceReference: 'RA-1', method: 'bank_transfer' }),
    });
    expect(res.status).toBe(201);
    const invRepo = new DentalInvoiceRepository(db);
    const inv = await invRepo.findOneById(invoiceId);
    expect(inv!.paidCents).toBe(100000);
    expect(inv!.balanceCents).toBe(0);
    expect(inv!.status).toBe('paid');
    const claimRepo = new DentalInsuranceClaimRepository(db);
    const claim = await claimRepo.findOneById(claimId);
    expect(claim!.paidByPayerCents).toBe(100000);
    expect(claim!.status).toBe('paid');
  });

  test('partial remittance + disallowance write-off + patient pays excess closes the invoice', async () => {
    const app = buildApp(TEST_USER);
    const { invoiceId, claimId } = await seedIssuedInvoiceAndClaim(100000);
    // HMO pays 60k, disallows 10k (write-off). Patient owes the remaining 30k.
    const res = await app.request(`/dental/billing/claims/${claimId}/remittance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 60000, disallowanceCents: 10000, disallowanceReason: 'over-limit', remittanceReference: 'RA-2' }),
    });
    expect(res.status).toBe(201);

    const invRepo = new DentalInvoiceRepository(db);
    let inv = await invRepo.findOneById(invoiceId);
    // write-off reduced total to 90k, payer paid 60k → balance 30k.
    expect(inv!.discountCents).toBe(10000);
    expect(inv!.totalCents).toBe(90000);
    expect(inv!.paidCents).toBe(60000);
    expect(inv!.balanceCents).toBe(30000);
    expect(inv!.status).toBe('partial');

    const claimRepo = new DentalInsuranceClaimRepository(db);
    const claim = await claimRepo.findOneById(claimId);
    expect(claim!.patientPortionCents).toBe(30000); // billed 100k - paid 60k - disallowed 10k

    // Patient pays the 30k excess directly → invoice closes.
    await invRepo.addPayment(invoiceId, 30000);
    inv = await invRepo.findOneById(invoiceId);
    expect(inv!.balanceCents).toBe(0);
    expect(inv!.status).toBe('paid');
  });

  test('over-post is rejected (422 PAYER_OVERPOST)', async () => {
    const app = buildApp(TEST_USER);
    const { claimId } = await seedIssuedInvoiceAndClaim(100000);
    const res = await app.request(`/dental/billing/claims/${claimId}/remittance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 150000, remittanceReference: 'RA-3' }),
    });
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe('PAYER_OVERPOST');
  });

  test('idempotent on remittance reference (replay → 200, no double-post)', async () => {
    const app = buildApp(TEST_USER);
    const { invoiceId, claimId } = await seedIssuedInvoiceAndClaim(100000);
    const first = await app.request(`/dental/billing/claims/${claimId}/remittance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 40000, remittanceReference: 'RA-DUP' }),
    });
    expect(first.status).toBe(201);
    const replay = await app.request(`/dental/billing/claims/${claimId}/remittance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 40000, remittanceReference: 'RA-DUP' }),
    });
    expect(replay.status).toBe(200);
    const invRepo = new DentalInvoiceRepository(db);
    const inv = await invRepo.findOneById(invoiceId);
    expect(inv!.paidCents).toBe(40000); // not 80000
  });

  test('same reference with a different amount conflicts (409)', async () => {
    const app = buildApp(TEST_USER);
    const { claimId } = await seedIssuedInvoiceAndClaim(100000);
    await app.request(`/dental/billing/claims/${claimId}/remittance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 40000, remittanceReference: 'RA-X' }),
    });
    const res = await app.request(`/dental/billing/claims/${claimId}/remittance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 50000, remittanceReference: 'RA-X' }),
    });
    expect(res.status).toBe(409);
  });
});
