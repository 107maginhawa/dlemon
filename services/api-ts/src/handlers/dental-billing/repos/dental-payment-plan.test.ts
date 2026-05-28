/**
 * DentalPaymentPlanRepository tests
 *
 * Tests plan creation with auto-generated installments,
 * payment recording, and plan status evaluation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { DentalPaymentPlanRepository } from './dental-payment-plan.repo';
import { DentalInvoiceRepository } from './dental-invoice.repo';
import { DentalPaymentRepository } from './dental-payment.repo';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('DentalPaymentPlanRepository', () => {
  let repo: DentalPaymentPlanRepository;
  let invoiceRepo: DentalInvoiceRepository;
  let paymentRepo: DentalPaymentRepository;
  let db: NodePgDatabase;
  let testInvoiceId: string;
  let testInvoiceId2: string;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    repo = new DentalPaymentPlanRepository(db);
    invoiceRepo = new DentalInvoiceRepository(db);
    paymentRepo = new DentalPaymentRepository(db);
    await seedClinicalChain(db, { visits: 2 });

    const invoice = await invoiceRepo.createOne({
      visitId: CHAIN_IDS.VISIT_1, patientId: CHAIN_IDS.PATIENT_1, branchId: CHAIN_IDS.BRANCH_1,
      dentistMemberId: CHAIN_IDS.MEMBERSHIP_1, invoiceNumber: 'INV-2026-PP01',
      subtotalCents: 12000, totalCents: 12000, balanceCents: 12000,
    });
    testInvoiceId = invoice.id;

    const invoice2 = await invoiceRepo.createOne({
      visitId: CHAIN_IDS.VISIT_2, patientId: CHAIN_IDS.PATIENT_1, branchId: CHAIN_IDS.BRANCH_1,
      dentistMemberId: CHAIN_IDS.MEMBERSHIP_1, invoiceNumber: 'INV-2026-PP02',
      subtotalCents: 6000, totalCents: 6000, balanceCents: 6000,
    });
    testInvoiceId2 = invoice2.id;
    teardown = rollback;
  });

  afterEach(() => teardown());

  // --------------------------------------------------------------------------
  // CREATE WITH INSTALLMENTS
  // --------------------------------------------------------------------------

  test('creates plan with monthly installments', async () => {
    const { plan, installments } = await repo.createWithInstallments({
      invoiceId: testInvoiceId,
      patientId: CHAIN_IDS.PATIENT_1,
      totalCents: 12000,
      numberOfInstallments: 3,
      frequency: 'monthly',
      startDate: new Date('2026-06-01T00:00:00Z'),
      amountPerInstallmentCents: 4000,
    });

    expect(plan.status).toBe('on_track');
    expect(plan.numberOfInstallments).toBe(3);
    expect(plan.frequency).toBe('monthly');
    expect(installments).toHaveLength(3);
  });

  test('creates plan with weekly installments', async () => {
    const { plan, installments } = await repo.createWithInstallments({
      invoiceId: testInvoiceId,
      patientId: CHAIN_IDS.PATIENT_1,
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
      patientId: CHAIN_IDS.PATIENT_1,
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
      patientId: CHAIN_IDS.PATIENT_1,
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
      patientId: CHAIN_IDS.PATIENT_1,
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
      patientId: CHAIN_IDS.PATIENT_1,
      totalCents: 12000,
      numberOfInstallments: 3,
      frequency: 'monthly',
      startDate: new Date('2026-06-01T00:00:00Z'),
      amountPerInstallmentCents: 4000,
    });

    const payment = await paymentRepo.createOne({
      invoiceId: testInvoiceId,
      patientId: CHAIN_IDS.PATIENT_1,
      branchId: CHAIN_IDS.BRANCH_1,
      amountCents: 4000,
      method: 'cash',
      receiptNumber: 'REC-PP001',
      recordedByMemberId: CHAIN_IDS.MEMBERSHIP_1,
    });

    const updated = await repo.recordInstallmentPayment(
      installments[0]!.id,
      payment.id,
      4000,
      new Date('2026-06-01'),
    );

    expect(updated!.status).toBe('paid');
    expect(updated!.paidCents).toBe(4000);
    expect(updated!.paymentId).toBe(payment.id);
  });

  // --------------------------------------------------------------------------
  // PLAN STATUS
  // --------------------------------------------------------------------------

  test('updatePlanStatus: all paid -> completed', async () => {
    const { plan, installments } = await repo.createWithInstallments({
      invoiceId: testInvoiceId,
      patientId: CHAIN_IDS.PATIENT_1,
      totalCents: 6000,
      numberOfInstallments: 2,
      frequency: 'monthly',
      startDate: new Date('2026-01-01T00:00:00Z'),
      amountPerInstallmentCents: 3000,
    });

    // Pay both installments with real payment records
    for (const [i, inst] of installments.entries()) {
      const payment = await paymentRepo.createOne({
        invoiceId: testInvoiceId,
        patientId: CHAIN_IDS.PATIENT_1,
        branchId: CHAIN_IDS.BRANCH_1,
        amountCents: inst.amountCents,
        method: 'cash',
        receiptNumber: `REC-COMPLETE-${i}`,
        recordedByMemberId: CHAIN_IDS.MEMBERSHIP_1,
      });
      await repo.recordInstallmentPayment(inst.id, payment.id, inst.amountCents, new Date());
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
      patientId: CHAIN_IDS.PATIENT_1,
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
      patientId: CHAIN_IDS.PATIENT_1,
      totalCents: 12000,
      numberOfInstallments: 3,
      frequency: 'monthly',
      startDate: new Date('2026-06-01T00:00:00Z'),
      amountPerInstallmentCents: 4000,
    });
    await repo.createWithInstallments({
      invoiceId: testInvoiceId2,
      patientId: CHAIN_IDS.PATIENT_1,
      totalCents: 6000,
      numberOfInstallments: 2,
      frequency: 'monthly',
      startDate: new Date('2026-06-01T00:00:00Z'),
      amountPerInstallmentCents: 3000,
    });

    const plans = await repo.findByPatient(CHAIN_IDS.PATIENT_1);
    expect(plans).toHaveLength(2);
  });
});
