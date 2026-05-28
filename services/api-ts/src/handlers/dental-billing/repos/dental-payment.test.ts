/**
 * DentalPaymentRepository tests
 *
 * Tests payment creation, retrieval, and void workflow.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { DentalPaymentRepository } from './dental-payment.repo';
import { DentalInvoiceRepository } from './dental-invoice.repo';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';

describe('DentalPaymentRepository', () => {
  let repo: DentalPaymentRepository;
  let invoiceRepo: DentalInvoiceRepository;
  let testInvoiceId: string;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db, rollback } = await openTestTx();
    repo = new DentalPaymentRepository(db);
    invoiceRepo = new DentalInvoiceRepository(db);
    await seedClinicalChain(db, { visits: 1 });

    const invoice = await invoiceRepo.createOne({
      visitId: CHAIN_IDS.VISIT_1, patientId: CHAIN_IDS.PATIENT_1, branchId: CHAIN_IDS.BRANCH_1,
      dentistMemberId: CHAIN_IDS.MEMBERSHIP_1, invoiceNumber: 'INV-2026-P001',
      subtotalCents: 10000, totalCents: 10000, balanceCents: 10000,
    });
    testInvoiceId = invoice.id;
    teardown = rollback;
  });

  afterEach(() => teardown());

  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------

  test('creates payment with correct fields', async () => {
    const payment = await repo.createOne({
      invoiceId: testInvoiceId,
      patientId: CHAIN_IDS.PATIENT_1,
      branchId: CHAIN_IDS.BRANCH_1,
      amountCents: 5000,
      method: 'cash',
      receiptNumber: 'REC-001',
      recordedByMemberId: CHAIN_IDS.MEMBERSHIP_1,
      notes: 'Partial payment',
    });

    expect(payment.id).not.toBeNull();
    expect(payment.amountCents).toBe(5000);
    expect(payment.method).toBe('cash');
    expect(payment.receiptNumber).toBe('REC-001');
    expect(payment.isVoid).toBe(false);
    expect(payment.notes).toBe('Partial payment');
  });

  // --------------------------------------------------------------------------
  // QUERIES
  // --------------------------------------------------------------------------

  test('findByInvoice returns non-voided payments', async () => {
    const p1 = await repo.createOne({
      invoiceId: testInvoiceId, patientId: CHAIN_IDS.PATIENT_1, branchId: CHAIN_IDS.BRANCH_1,
      amountCents: 3000, method: 'cash', receiptNumber: 'REC-001',
      recordedByMemberId: CHAIN_IDS.MEMBERSHIP_1,
    });
    await repo.createOne({
      invoiceId: testInvoiceId, patientId: CHAIN_IDS.PATIENT_1, branchId: CHAIN_IDS.BRANCH_1,
      amountCents: 2000, method: 'card', receiptNumber: 'REC-002',
      recordedByMemberId: CHAIN_IDS.MEMBERSHIP_1,
    });

    // Void the first one
    await repo.voidPayment(p1.id, 'Duplicate entry', CHAIN_IDS.MEMBERSHIP_1);

    const payments = await repo.findByInvoice(testInvoiceId);
    expect(payments).toHaveLength(1);
    expect(payments[0]!.receiptNumber).toBe('REC-002');
  });

  // --------------------------------------------------------------------------
  // VOID
  // --------------------------------------------------------------------------

  test('voidPayment sets isVoid and voidedAt', async () => {
    const payment = await repo.createOne({
      invoiceId: testInvoiceId, patientId: CHAIN_IDS.PATIENT_1, branchId: CHAIN_IDS.BRANCH_1,
      amountCents: 5000, method: 'cash', receiptNumber: 'REC-001',
      recordedByMemberId: CHAIN_IDS.MEMBERSHIP_1,
    });

    const voided = await repo.voidPayment(payment.id, 'Entry error', CHAIN_IDS.MEMBERSHIP_1);
    expect(voided!.isVoid).toBe(true);
    expect(voided!.voidedAt).not.toBeNull();
  });

  test('voidPayment stores void reason', async () => {
    const payment = await repo.createOne({
      invoiceId: testInvoiceId, patientId: CHAIN_IDS.PATIENT_1, branchId: CHAIN_IDS.BRANCH_1,
      amountCents: 5000, method: 'cash', receiptNumber: 'REC-001',
      recordedByMemberId: CHAIN_IDS.MEMBERSHIP_1,
    });

    const voided = await repo.voidPayment(payment.id, 'Wrong amount recorded', CHAIN_IDS.MEMBERSHIP_1);
    expect(voided!.voidReason).toBe('Wrong amount recorded');
  });

  test('voidPayment does not delete record (still retrievable)', async () => {
    const payment = await repo.createOne({
      invoiceId: testInvoiceId, patientId: CHAIN_IDS.PATIENT_1, branchId: CHAIN_IDS.BRANCH_1,
      amountCents: 5000, method: 'cash', receiptNumber: 'REC-001',
      recordedByMemberId: CHAIN_IDS.MEMBERSHIP_1,
    });

    await repo.voidPayment(payment.id, 'Void test', CHAIN_IDS.MEMBERSHIP_1);

    // The record still exists (findOneById returns it)
    const found = await repo.findOneById(payment.id);
    expect(found).not.toBeNull();
    expect(found!.isVoid).toBe(true);

    // But findByInvoice filters it out
    const active = await repo.findByInvoice(testInvoiceId);
    expect(active).toHaveLength(0);

    // findAllByInvoice still returns it
    const all = await repo.findAllByInvoice(testInvoiceId);
    expect(all).toHaveLength(1);
  });
});
