/**
 * FIX-006 — patients.hasActivePaymentPlan flag-sync (cross-module invariant)
 *
 * The EC1 archive guard (patient.repo.ts archivePatient) blocks archiving a patient
 * with an active payment plan by reading patients.hasActivePaymentPlan. That flag was
 * NEVER written by the dental-billing plan lifecycle — so a patient with a live plan
 * could be WRONGLY ARCHIVED. The pre-existing EC1 tests hand-FORCED the flag, hiding
 * the gap (false green). These tests create a REAL plan via the repo and assert the
 * flag is maintained end-to-end across create + terminal transitions + the multi-plan
 * guard. RED before the fix (createWithInstallments never set the flag).
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentPlanRepository } from './repos/dental-payment-plan.repo';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalPaymentPlans, dentalPaymentPlanInstallments } from './repos/dental-payment-plan.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { PatientRepository } from '@/handlers/patient/repos/patient.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const USER = '00000000-0000-0000-0000-0000000000f6';
const ORG_ID = 'ec000000-0000-1000-8000-0000000000f6';
const BRANCH_ID = 'bb000000-0000-1000-8000-0000000000f6';
const MEMBER_ID = 'cc000000-0000-1000-8000-0000000000f6';
const PERSON_ID = 'ee000000-0000-1000-8000-0000000000f6';
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000000f6';
const VISIT_ID = 'dd000000-0000-1000-8000-0000000000f6';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'FlagSync Clinic', tier: 'solo', ownerPersonId: USER, countryCode: 'PH', createdBy: USER, updatedBy: USER }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: USER, updatedBy: USER }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: USER, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER, updatedBy: USER }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Flag', lastName: 'Sync', createdBy: USER, updatedBy: USER }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: USER, updatedBy: USER }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: USER, updatedBy: USER }).onConflictDoNothing();
});

afterEach(async () => {
  const plans = await db.select({ id: dentalPaymentPlans.id }).from(dentalPaymentPlans).where(eq(dentalPaymentPlans.patientId, PATIENT_ID));
  for (const p of plans) {
    await db.delete(dentalPaymentPlanInstallments).where(eq(dentalPaymentPlanInstallments.planId, p.id));
  }
  await db.delete(dentalPaymentPlans).where(eq(dentalPaymentPlans.patientId, PATIENT_ID));
  await db.update(patients).set({ status: 'active', hasActivePaymentPlan: false, archivedAt: null }).where(eq(patients.id, PATIENT_ID));
});

async function seedInvoice(balanceCents = 30000) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const [row] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(), visitId: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, invoiceNumber, status: 'issued' as const,
    subtotalCents: balanceCents, discountCents: 0, taxCents: 0, taxRate: '0',
    totalCents: balanceCents, paidCents: 0, balanceCents, issuedAt: new Date(),
    createdBy: USER, updatedBy: USER,
  }).returning();
  return row!;
}

async function flag(): Promise<boolean> {
  const [p] = await db.select({ f: patients.hasActivePaymentPlan }).from(patients).where(eq(patients.id, PATIENT_ID));
  return p!.f ?? false;
}

async function createPlan(invoiceId: string) {
  const planRepo = new DentalPaymentPlanRepository(db);
  const { plan } = await planRepo.createWithInstallments({
    invoiceId, patientId: PATIENT_ID, totalCents: 30000, numberOfInstallments: 3,
    frequency: 'monthly', startDate: new Date('2026-02-01T00:00:00Z'), amountPerInstallmentCents: 10000,
  });
  return plan;
}

describe('FIX-006 — hasActivePaymentPlan flag-sync (EC1 archive guard)', () => {
  test('creating a plan sets the flag + BLOCKS archive; completing it clears the flag + ALLOWS archive', async () => {
    const planRepo = new DentalPaymentPlanRepository(db);
    const patientRepo = new PatientRepository(db);
    const invoice = await seedInvoice();

    const plan = await createPlan(invoice.id);
    expect(await flag()).toBe(true);

    const blocked = await patientRepo.archivePatient(PATIENT_ID);
    expect(blocked.success).toBe(false);
    expect(blocked.reason).toContain('payment plan');

    await planRepo.setStatus(plan.id, 'completed');
    expect(await flag()).toBe(false);

    const allowed = await patientRepo.archivePatient(PATIENT_ID);
    expect(allowed.success).toBe(true);
  });

  test('a defaulted plan also clears the flag', async () => {
    const planRepo = new DentalPaymentPlanRepository(db);
    const invoice = await seedInvoice();
    const plan = await createPlan(invoice.id);
    expect(await flag()).toBe(true);

    await planRepo.setStatus(plan.id, 'defaulted');
    expect(await flag()).toBe(false);
  });

  test('multi-plan guard: completing ONE plan keeps the flag set while another stays active', async () => {
    const planRepo = new DentalPaymentPlanRepository(db);
    const inv1 = await seedInvoice();
    const inv2 = await seedInvoice();
    const plan1 = await createPlan(inv1.id);
    await createPlan(inv2.id);
    expect(await flag()).toBe(true);

    // Complete plan1 — the patient still holds plan2 (on_track) → flag MUST stay true.
    await planRepo.setStatus(plan1.id, 'completed');
    expect(await flag()).toBe(true);
  });
});
