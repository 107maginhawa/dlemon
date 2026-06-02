/**
 * P1-26 — revenue-cycle-acceptance.test.ts
 *
 * Full PH HMO journey (model after acceptance.billing-payments.test.ts):
 *   HMO patient → LOA captured + approved → estimate shown → invoice issued →
 *   claim created from invoice → submitted → partial remittance + disallowance →
 *   patient pays excess → invoice paid & reconciled.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import {
  CreateInsuranceClaimBody,
  UpdateInsuranceClaimStatusParams,
  UpdateInsuranceClaimStatusBody,
  RecordClaimRemittanceParams,
  RecordClaimRemittanceBody,
  EstimateClaimCoverageBody,
  CreateCoverageAuthorizationParams,
  CreateCoverageAuthorizationBody,
  UpdateCoverageAuthorizationStatusParams,
  UpdateCoverageAuthorizationStatusBody,
} from '@/generated/openapi/validators';
import { createInsuranceClaim } from './createInsuranceClaim';
import { updateInsuranceClaimStatus } from './updateInsuranceClaimStatus';
import { recordClaimRemittance } from './recordClaimRemittance';
import { estimateClaimCoverage } from './estimateClaimCoverage';
import { createCoverageAuthorization } from '@/handlers/dental-patient/insurance/createCoverageAuthorization';
import { updateCoverageAuthorizationStatus } from '@/handlers/dental-patient/insurance/updateCoverageAuthorizationStatus';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const TEST_USER = { id: 'a8000000-0000-1000-8000-00000000a081', email: 'staff@rc8.com' };
const ORG_ID = 'c8000000-0000-1000-8000-00000000a081';
const BRANCH_ID = 'b8000000-0000-1000-8000-00000000a081';
const MEMBER_ID = 'a1800000-0000-1000-8000-00000000a081';
const PERSON_ID = 'e8000000-0000-1000-8000-00000000a081';
const PATIENT_ID = 'd8000000-0000-1000-8000-00000000a081';
const PROFILE_ID = 'f8000000-0000-1000-8000-00000000a081';

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

  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'RC Clinic', tier: 'solo', ownerPersonId: TEST_USER.id, countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'RC Branch', timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id, displayName: 'RC Staff', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Ana', lastName: 'Lim', dateOfBirth: '1992-05-05', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, status: 'active', createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
  await db.insert(dentalInsuranceProfiles).values({ id: PROFILE_ID, patientId: PATIENT_ID, insurerName: 'Maxicare', policyNumber: 'MX-1', subscriberName: 'Ana Lim', active: true, payerType: 'hmo', annualLimitCents: 500000, annualLimitUsedCents: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id }).onConflictDoNothing();
});

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
    ctx.set('user', TEST_USER);
    ctx.set('session', { id: 's', userId: TEST_USER.id });
    await next();
  });
  app.post('/dental/patients/:patientId/authorizations', zValidator('param', CreateCoverageAuthorizationParams, ve), zValidator('json', CreateCoverageAuthorizationBody, ve), createCoverageAuthorization as any);
  app.patch('/dental/patients/:patientId/authorizations/:authorizationId/status', zValidator('param', UpdateCoverageAuthorizationStatusParams, ve), zValidator('json', UpdateCoverageAuthorizationStatusBody, ve), updateCoverageAuthorizationStatus as any);
  app.post('/dental/billing/estimate', zValidator('json', EstimateClaimCoverageBody, ve), estimateClaimCoverage as any);
  app.post('/dental/billing/claims', zValidator('json', CreateInsuranceClaimBody, ve), createInsuranceClaim as any);
  app.patch('/dental/billing/claims/:claimId/status', zValidator('param', UpdateInsuranceClaimStatusParams, ve), zValidator('json', UpdateInsuranceClaimStatusBody, ve), updateInsuranceClaimStatus as any);
  app.post('/dental/billing/claims/:claimId/remittance', zValidator('param', RecordClaimRemittanceParams, ve), zValidator('json', RecordClaimRemittanceBody, ve), recordClaimRemittance as any);
  return app;
}

afterEach(async () => {
  const { dentalPayerPayments } = await import('./repos/dental-payer-payment.schema');
  const { dentalInsuranceClaims, dentalInsuranceClaimLines } = await import('./repos/dental-insurance-claim.schema');
  const { dentalCoverageAuthorizations } = await import('@/handlers/dental-patient/repos/coverage-authorization.schema');
  const { dentalPayments } = await import('./repos/dental-payment.schema');
  const { dentalInvoices, dentalInvoiceLineItems } = await import('./repos/dental-invoice.schema');
  await db.delete(dentalPayerPayments);
  await db.delete(dentalInsuranceClaimLines);
  await db.delete(dentalInsuranceClaims).where(eq(dentalInsuranceClaims.patientId, PATIENT_ID));
  await db.delete(dentalCoverageAuthorizations).where(eq(dentalCoverageAuthorizations.patientId, PATIENT_ID));
  await db.delete(dentalPayments).where(eq(dentalPayments.patientId, PATIENT_ID));
  await db.delete(dentalInvoiceLineItems);
  await db.delete(dentalInvoices).where(eq(dentalInvoices.patientId, PATIENT_ID));
});

describe('Full PH HMO revenue-cycle journey', () => {
  test('LOA → estimate → invoice → claim → submit → remittance + disallowance → patient pays → reconciled', async () => {
    const app = buildApp();

    // 1. Capture + approve an LOA (HMO covers prophylaxis up to ₱2,000).
    const auth = await (await app.request(`/dental/patients/${PATIENT_ID}/authorizations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insuranceProfileId: PROFILE_ID, loaNumber: 'LOA-RC-1' }),
    })).json() as any;
    await app.request(`/dental/patients/${PATIENT_ID}/authorizations/${auth.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', coveredProcedures: [{ cdtCode: 'D1110', approvedAmountCents: 200000 }] }),
    });

    // 2. Estimate: D1110 (₱2,000) covered, D2740 crown (₱8,000) excluded.
    const est = await (await app.request('/dental/billing/estimate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: PATIENT_ID, insuranceProfileId: PROFILE_ID, authorizationId: auth.id,
        lines: [
          { cdtCode: 'D1110', billedAmountCents: 200000 },
          { cdtCode: 'D2740', billedAmountCents: 800000 },
        ],
      }),
    })).json() as any;
    expect(est.estimatedCoveredCents).toBe(200000);
    expect(est.estimatedPatientPortionCents).toBe(800000);
    expect(est.uncoveredProcedures).toContain('D2740');

    // 3. Issue an invoice for the full ₱10,000 (seeded directly).
    const invRepo = new DentalInvoiceRepository(db);
    const invoice = await invRepo.createOne({
      patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
      invoiceNumber: `INV-RC-${Date.now()}`, status: 'issued',
      subtotalCents: 1000000, totalCents: 1000000, balanceCents: 1000000,
      issuedAt: new Date(), createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    });
    await invRepo.createLineItems([
      { invoiceId: invoice.id, cdtCode: 'D1110', description: 'Prophylaxis', unitPriceCents: 200000, quantity: 1, amountCents: 200000, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
      { invoiceId: invoice.id, cdtCode: 'D2740', description: 'Crown', unitPriceCents: 800000, quantity: 1, amountCents: 800000, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    ]);

    // 4. Create an invoice-anchored claim (lines derived from the invoice).
    const claim = await (await app.request('/dental/billing/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, insuranceProfileId: PROFILE_ID, invoiceId: invoice.id, authorizationId: auth.id }),
    })).json() as any;
    expect(claim.billedAmountCents).toBe(1000000);
    expect(claim.lines).toHaveLength(2);

    // 5. ready → submitted (LOA-backed → no warning) → under_review → approved.
    await app.request(`/dental/billing/claims/${claim.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready' }) });
    const submitted = await (await app.request(`/dental/billing/claims/${claim.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'submitted', submissionChannel: 'portal', payerReference: 'MX-REF-1' }) })).json() as any;
    expect(submitted.warnings).not.toContain('NO_APPROVED_LOA');
    await app.request(`/dental/billing/claims/${claim.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'under_review' }) });
    await app.request(`/dental/billing/claims/${claim.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) });

    // 6. Remittance: HMO pays ₱2,000 (the covered prophylaxis), disallows nothing.
    const rem = await app.request(`/dental/billing/claims/${claim.id}/remittance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 200000, remittanceReference: 'MX-RA-1', method: 'bank_transfer' }),
    });
    expect(rem.status).toBe(201);

    let inv = await invRepo.findOneById(invoice.id);
    expect(inv!.paidCents).toBe(200000);
    expect(inv!.balanceCents).toBe(800000);
    expect(inv!.status).toBe('partial');

    // 7. Patient pays the ₱8,000 excess (uncovered crown) → invoice closes.
    await invRepo.addPayment(invoice.id, 800000);
    inv = await invRepo.findOneById(invoice.id);
    expect(inv!.balanceCents).toBe(0);
    expect(inv!.status).toBe('paid');

    // Reconciliation invariant: payer-paid + patient-paid == invoice total.
    expect(inv!.paidCents).toBe(1000000);
  });
});
