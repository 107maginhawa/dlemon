/**
 * DentalPaymentRepository tests
 *
 * Tests payment creation, retrieval, and void workflow.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { DentalPaymentRepository } from './dental-payment.repo';
import { DentalInvoiceRepository } from './dental-invoice.repo';
import { createDatabase } from '@/core/database';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const INVOICE_ID = 'f0000000-0000-2000-8000-000000000001';
const PATIENT_1 = 'b0000000-0000-2000-8000-000000000001';
const BRANCH_1 = 'c0000000-0000-2000-8000-000000000001';
const VISIT_1 = 'e0000000-0000-2000-8000-000000000001';
const DENTIST_1 = 'd0000000-0000-2000-8000-000000000001';
const MEMBER_1 = 'a0000000-0000-2000-8000-000000000001';

describe('DentalPaymentRepository', () => {
  let repo: DentalPaymentRepository;
  let invoiceRepo: DentalInvoiceRepository;
  let testInvoiceId: string;

  beforeEach(async () => {
    repo = new DentalPaymentRepository(db);
    invoiceRepo = new DentalInvoiceRepository(db);

    // Create a test invoice first
    const invoice = await invoiceRepo.createOne({
      visitId: VISIT_1, patientId: PATIENT_1, branchId: BRANCH_1,
      dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-P001',
      subtotalCents: 10000, totalCents: 10000, balanceCents: 10000,
    });
    testInvoiceId = invoice.id;
  });

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_payment CASCADE`);
    await db.execute(sql`TRUNCATE TABLE dental_invoice CASCADE`);
  });

  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------

  test('creates payment with correct fields', async () => {
    const payment = await repo.createOne({
      invoiceId: testInvoiceId,
      patientId: PATIENT_1,
      branchId: BRANCH_1,
      amountCents: 5000,
      method: 'cash',
      receiptNumber: 'REC-001',
      recordedByMemberId: MEMBER_1,
      notes: 'Partial payment',
    });

    expect(payment.id).toBeTruthy();
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
      invoiceId: testInvoiceId, patientId: PATIENT_1, branchId: BRANCH_1,
      amountCents: 3000, method: 'cash', receiptNumber: 'REC-001',
      recordedByMemberId: MEMBER_1,
    });
    await repo.createOne({
      invoiceId: testInvoiceId, patientId: PATIENT_1, branchId: BRANCH_1,
      amountCents: 2000, method: 'card', receiptNumber: 'REC-002',
      recordedByMemberId: MEMBER_1,
    });

    // Void the first one
    await repo.voidPayment(p1.id, 'Duplicate entry', MEMBER_1);

    const payments = await repo.findByInvoice(testInvoiceId);
    expect(payments).toHaveLength(1);
    expect(payments[0]!.receiptNumber).toBe('REC-002');
  });

  // --------------------------------------------------------------------------
  // VOID
  // --------------------------------------------------------------------------

  test('voidPayment sets isVoid and voidedAt', async () => {
    const payment = await repo.createOne({
      invoiceId: testInvoiceId, patientId: PATIENT_1, branchId: BRANCH_1,
      amountCents: 5000, method: 'cash', receiptNumber: 'REC-001',
      recordedByMemberId: MEMBER_1,
    });

    const voided = await repo.voidPayment(payment.id, 'Entry error', MEMBER_1);
    expect(voided!.isVoid).toBe(true);
    expect(voided!.voidedAt).toBeTruthy();
  });

  test('voidPayment stores void reason', async () => {
    const payment = await repo.createOne({
      invoiceId: testInvoiceId, patientId: PATIENT_1, branchId: BRANCH_1,
      amountCents: 5000, method: 'cash', receiptNumber: 'REC-001',
      recordedByMemberId: MEMBER_1,
    });

    const voided = await repo.voidPayment(payment.id, 'Wrong amount recorded', MEMBER_1);
    expect(voided!.voidReason).toBe('Wrong amount recorded');
  });

  test('voidPayment does not delete record (still retrievable)', async () => {
    const payment = await repo.createOne({
      invoiceId: testInvoiceId, patientId: PATIENT_1, branchId: BRANCH_1,
      amountCents: 5000, method: 'cash', receiptNumber: 'REC-001',
      recordedByMemberId: MEMBER_1,
    });

    await repo.voidPayment(payment.id, 'Void test', MEMBER_1);

    // The record still exists (findOneById returns it)
    const found = await repo.findOneById(payment.id);
    expect(found).toBeTruthy();
    expect(found!.isVoid).toBe(true);

    // But findByInvoice filters it out
    const active = await repo.findByInvoice(testInvoiceId);
    expect(active).toHaveLength(0);

    // findAllByInvoice still returns it
    const all = await repo.findAllByInvoice(testInvoiceId);
    expect(all).toHaveLength(1);
  });
});
