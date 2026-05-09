/**
 * DentalPaymentPlanRepository tests
 *
 * Tests plan creation with auto-generated installments,
 * payment recording, and plan status evaluation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { DentalPaymentPlanRepository } from './dental-payment-plan.repo';
import { DentalInvoiceRepository } from './dental-invoice.repo';
import { createDatabase } from '@/core/database';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const PATIENT_1 = 'b0000000-0000-2000-8000-000000000001';
const PATIENT_2 = 'b0000000-0000-2000-8000-000000000002';
const VISIT_1 = 'e0000000-0000-2000-8000-000000000001';
const VISIT_2 = 'e0000000-0000-2000-8000-000000000002';
const BRANCH_1 = 'c0000000-0000-2000-8000-000000000001';
const DENTIST_1 = 'd0000000-0000-2000-8000-000000000001';
const PAYMENT_1 = 'a0000000-0000-2000-8000-000000000099';

describe('DentalPaymentPlanRepository', () => {
  let repo: DentalPaymentPlanRepository;
  let invoiceRepo: DentalInvoiceRepository;
  let testInvoiceId: string;
  let testInvoiceId2: string;

  beforeEach(async () => {
    repo = new DentalPaymentPlanRepository(db);
    invoiceRepo = new DentalInvoiceRepository(db);

    const invoice = await invoiceRepo.createOne({
      visitId: VISIT_1, patientId: PATIENT_1, branchId: BRANCH_1,
      dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-PP01',
      subtotalCents: 12000, totalCents: 12000, balanceCents: 12000,
    });
    testInvoiceId = invoice.id;

    const invoice2 = await invoiceRepo.createOne({
      visitId: VISIT_2, patientId: PATIENT_1, branchId: BRANCH_1,
      dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-PP02',
      subtotalCents: 6000, totalCents: 6000, balanceCents: 6000,
    });
    testInvoiceId2 = invoice2.id;
  });

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_payment_plan_installment CASCADE`);
    await db.execute(sql`TRUNCATE TABLE dental_payment_plan CASCADE`);
    await db.execute(sql`TRUNCATE TABLE dental_invoice CASCADE`);
  });

  // --------------------------------------------------------------------------
  // CREATE WITH INSTALLMENTS
  // --------------------------------------------------------------------------

  test('creates plan with monthly installments', async () => {
    const { plan, installments } = await repo.createWithInstallments({
      invoiceId: testInvoiceId,
      patientId: PATIENT_1,
      totalCents: 12000,
      numberOfInstallments: 3,
      frequency: 'monthly',
      startDate: new Date('2026-06-01T00:00:00Z'),
      amountPerInstallmentCents: 4000,
    });

    expect(plan.status).toBe('onTrack');
    expect(plan.numberOfInstallments).toBe(3);
    expect(plan.frequency).toBe('monthly');
    expect(installments).toHaveLength(3);
  });

  test('creates plan with weekly installments', async () => {
    const { plan, installments } = await repo.createWithInstallments({
      invoiceId: testInvoiceId,
      patientId: PATIENT_1,
      totalCents: 4000,
      numberOfInstallments: 4,
      frequency: 'weekly',
      startDate: new Date('2026-06-01T00:00:00Z'),
      amountPerInstallmentCents: 1000,
    });

    expect(plan.frequency).toBe('weekly');
    expect(installments).toHaveLength(4);
  });

  test('auto-generates correct number of installment records', async () => {
    const { installments } = await repo.createWithInstallments({
      invoiceId: testInvoiceId,
      patientId: PATIENT_1,
      totalCents: 10000,
      numberOfInstallments: 5,
      frequency: 'monthly',
      startDate: new Date('2026-06-01T00:00:00Z'),
      amountPerInstallmentCents: 2000,
    });

    expect(installments).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(installments[i]!.installmentNumber).toBe(i + 1);
      expect(installments[i]!.status).toBe('pending');
    }
  });

  test('installment due dates spaced by frequency', async () => {
    const startDate = new Date('2026-06-01T00:00:00Z');
    const { installments } = await repo.createWithInstallments({
      invoiceId: testInvoiceId,
      patientId: PATIENT_1,
      totalCents: 12000,
      numberOfInstallments: 3,
      frequency: 'monthly',
      startDate,
      amountPerInstallmentCents: 4000,
    });

    expect(new Date(installments[0]!.dueDate).toISOString()).toContain('2026-06-01');
    expect(new Date(installments[1]!.dueDate).toISOString()).toContain('2026-07-01');
    expect(new Date(installments[2]!.dueDate).toISOString()).toContain('2026-08-01');
  });

  test('installment amounts sum to plan total', async () => {
    // Use a total that doesn't divide evenly
    const { installments } = await repo.createWithInstallments({
      invoiceId: testInvoiceId,
      patientId: PATIENT_1,
      totalCents: 10000,
      numberOfInstallments: 3,
      frequency: 'monthly',
      startDate: new Date('2026-06-01T00:00:00Z'),
      amountPerInstallmentCents: 3334,
    });

    const totalFromInstallments = installments.reduce((sum, i) => sum + i.amountCents, 0);
    expect(totalFromInstallments).toBe(10000);
  });

  // --------------------------------------------------------------------------
  // RECORD PAYMENT
  // --------------------------------------------------------------------------

  test('recordInstallmentPayment marks installment paid', async () => {
    const { installments } = await repo.createWithInstallments({
      invoiceId: testInvoiceId,
      patientId: PATIENT_1,
      totalCents: 12000,
      numberOfInstallments: 3,
      frequency: 'monthly',
      startDate: new Date('2026-06-01T00:00:00Z'),
      amountPerInstallmentCents: 4000,
    });

    const updated = await repo.recordInstallmentPayment(
      installments[0]!.id,
      PAYMENT_1,
      4000,
      new Date('2026-06-01'),
    );

    expect(updated!.status).toBe('paid');
    expect(updated!.paidCents).toBe(4000);
    expect(updated!.paymentId).toBe(PAYMENT_1);
  });

  // --------------------------------------------------------------------------
  // PLAN STATUS
  // --------------------------------------------------------------------------

  test('updatePlanStatus: all paid -> completed', async () => {
    const { plan, installments } = await repo.createWithInstallments({
      invoiceId: testInvoiceId,
      patientId: PATIENT_1,
      totalCents: 6000,
      numberOfInstallments: 2,
      frequency: 'monthly',
      startDate: new Date('2026-01-01T00:00:00Z'),
      amountPerInstallmentCents: 3000,
    });

    // Pay both installments
    for (const inst of installments) {
      await repo.recordInstallmentPayment(inst.id, PAYMENT_1, inst.amountCents, new Date());
    }

    const updated = await repo.updatePlanStatus(plan.id);
    expect(updated!.status).toBe('completed');
  });

  test('updatePlanStatus: 7+ days overdue -> behind', async () => {
    // Create plan with a start date more than 7 days in the past
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);

    const { plan } = await repo.createWithInstallments({
      invoiceId: testInvoiceId,
      patientId: PATIENT_1,
      totalCents: 6000,
      numberOfInstallments: 2,
      frequency: 'monthly',
      startDate: pastDate,
      amountPerInstallmentCents: 3000,
    });

    // Don't pay anything — first installment is now 10 days overdue
    const updated = await repo.updatePlanStatus(plan.id);
    expect(updated!.status).toBe('behind');
  });

  // --------------------------------------------------------------------------
  // QUERIES
  // --------------------------------------------------------------------------

  test('findByPatient returns all patient plans', async () => {
    await repo.createWithInstallments({
      invoiceId: testInvoiceId,
      patientId: PATIENT_1,
      totalCents: 12000,
      numberOfInstallments: 3,
      frequency: 'monthly',
      startDate: new Date('2026-06-01T00:00:00Z'),
      amountPerInstallmentCents: 4000,
    });
    await repo.createWithInstallments({
      invoiceId: testInvoiceId2,
      patientId: PATIENT_1,
      totalCents: 6000,
      numberOfInstallments: 2,
      frequency: 'monthly',
      startDate: new Date('2026-06-01T00:00:00Z'),
      amountPerInstallmentCents: 3000,
    });

    const plans = await repo.findByPatient(PATIENT_1);
    expect(plans).toHaveLength(2);
  });
});
