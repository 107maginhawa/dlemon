/**
 * DentalInvoiceRepository tests
 *
 * Tests invoice lifecycle: draft -> issued -> partial -> paid | voided
 * Invoice number generation, payment tracking, and discount application.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { DentalInvoiceRepository } from './dental-invoice.repo';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';

const VISIT_1   = CHAIN_IDS.VISIT_1;
const VISIT_2   = CHAIN_IDS.VISIT_2;
const PATIENT_1 = CHAIN_IDS.PATIENT_1;
const PATIENT_2 = CHAIN_IDS.PATIENT_2;
const BRANCH_1  = CHAIN_IDS.BRANCH_1;
const BRANCH_2  = CHAIN_IDS.BRANCH_2;
const DENTIST_1 = CHAIN_IDS.MEMBERSHIP_1;

describe('DentalInvoiceRepository', () => {
  let repo: DentalInvoiceRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db, rollback } = await openTestTx();
    repo = new DentalInvoiceRepository(db);
    await seedClinicalChain(db, { visits: 2 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------

  describe('create', () => {
    test('creates invoice with draft status', async () => {
      const invoice = await repo.createOne({
        visitId: VISIT_1,
        patientId: PATIENT_1,
        branchId: BRANCH_1,
        dentistMemberId: DENTIST_1,
        invoiceNumber: 'INV-2026-0001',
        subtotalCents: 10000,
        totalCents: 10000,
        balanceCents: 10000,
      });

      expect(invoice.id).toBeTruthy();
      expect(invoice.status).toBe('draft');
      expect(invoice.subtotalCents).toBe(10000);
      expect(invoice.paidCents).toBe(0);
      expect(invoice.balanceCents).toBe(10000);
    });
  });

  // --------------------------------------------------------------------------
  // INVOICE NUMBER GENERATION
  // --------------------------------------------------------------------------

  describe('invoice number generation', () => {
    test('generates unique invoice numbers with year prefix', async () => {
      const year = new Date().getFullYear();
      const num1 = await repo.generateInvoiceNumber();
      const num2 = await repo.generateInvoiceNumber();
      expect(num1).toMatch(new RegExp(`^INV-${year}-[A-F0-9]{8}$`));
      expect(num2).toMatch(new RegExp(`^INV-${year}-[A-F0-9]{8}$`));
      expect(num1).not.toBe(num2);
    });

    test('generates year-prefixed invoice numbers (INV-2026-ABCD1234)', async () => {
      const num = await repo.generateInvoiceNumber();
      const year = new Date().getFullYear();
      expect(num).toMatch(new RegExp(`^INV-${year}-[A-F0-9]{8}$`));
    });
  });

  // --------------------------------------------------------------------------
  // ISSUE / VOID
  // --------------------------------------------------------------------------

  describe('issue and void', () => {
    test('issues invoice: draft -> issued', async () => {
      const invoice = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1, branchId: BRANCH_1,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0001',
        subtotalCents: 10000, totalCents: 10000, balanceCents: 10000,
      });

      const issued = await repo.issue(invoice.id);
      expect(issued!.status).toBe('issued');
      expect(issued!.issuedAt).not.toBeNull();
    });

    test('voids invoice: sets voided status and voidedAt', async () => {
      const invoice = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1, branchId: BRANCH_1,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0001',
        subtotalCents: 10000, totalCents: 10000, balanceCents: 10000,
      });

      const voided = await repo.voidInvoice(invoice.id);
      expect(voided!.status).toBe('voided');
      expect(voided!.voidedAt).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // PAYMENTS
  // --------------------------------------------------------------------------

  describe('addPayment', () => {
    test('addPayment updates paidCents and sets partial status', async () => {
      const invoice = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1, branchId: BRANCH_1,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0001',
        subtotalCents: 10000, totalCents: 10000, balanceCents: 10000,
      });

      const updated = await repo.addPayment(invoice.id, 5000);
      expect(updated!.paidCents).toBe(5000);
      expect(updated!.status).toBe('partial');
    });

    test('addPayment sets paid status when balance reaches zero', async () => {
      const invoice = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1, branchId: BRANCH_1,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0001',
        subtotalCents: 10000, totalCents: 10000, balanceCents: 10000,
      });

      const updated = await repo.addPayment(invoice.id, 10000);
      expect(updated!.paidCents).toBe(10000);
      expect(updated!.status).toBe('paid');
      expect(updated!.paidAt).not.toBeNull();
    });

    test('addPayment correctly updates balanceCents', async () => {
      const invoice = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1, branchId: BRANCH_1,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0001',
        subtotalCents: 10000, totalCents: 10000, balanceCents: 10000,
      });

      const updated = await repo.addPayment(invoice.id, 3000);
      expect(updated!.balanceCents).toBe(7000);
    });
  });

  // --------------------------------------------------------------------------
  // FILTERS
  // --------------------------------------------------------------------------

  describe('findMany filters', () => {
    test('findMany filters by patientId', async () => {
      await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1, branchId: BRANCH_1,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0001',
        subtotalCents: 10000, totalCents: 10000, balanceCents: 10000,
      });
      await repo.createOne({
        visitId: VISIT_2, patientId: PATIENT_2, branchId: BRANCH_1,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0002',
        subtotalCents: 5000, totalCents: 5000, balanceCents: 5000,
      });

      const results = await repo.findMany({ patientId: PATIENT_1 });
      expect(results).toHaveLength(1);
      expect(results[0]!.patientId).toBe(PATIENT_1);
    });

    test('findMany filters by branchId', async () => {
      await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1, branchId: BRANCH_1,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0001',
        subtotalCents: 10000, totalCents: 10000, balanceCents: 10000,
      });
      await repo.createOne({
        visitId: VISIT_2, patientId: PATIENT_1, branchId: BRANCH_2,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0002',
        subtotalCents: 5000, totalCents: 5000, balanceCents: 5000,
      });

      const results = await repo.findMany({ branchId: BRANCH_2 });
      expect(results).toHaveLength(1);
      expect(results[0]!.branchId).toBe(BRANCH_2);
    });

    test('findMany filters by status', async () => {
      const inv = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1, branchId: BRANCH_1,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0001',
        subtotalCents: 10000, totalCents: 10000, balanceCents: 10000,
      });
      await repo.issue(inv.id);

      await repo.createOne({
        visitId: VISIT_2, patientId: PATIENT_1, branchId: BRANCH_1,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0002',
        subtotalCents: 5000, totalCents: 5000, balanceCents: 5000,
      });

      const results = await repo.findMany({ status: 'issued' });
      expect(results).toHaveLength(1);
      expect(results[0]!.status).toBe('issued');
    });
  });

  // --------------------------------------------------------------------------
  // DISCOUNT
  // --------------------------------------------------------------------------

  describe('applyDiscount', () => {
    test('applyDiscount reduces totalCents correctly', async () => {
      const invoice = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1, branchId: BRANCH_1,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0001',
        subtotalCents: 10000, totalCents: 10000, balanceCents: 10000,
        taxRate: '0',
      });

      const updated = await repo.applyDiscount(invoice.id, 2000, 0);
      expect(updated!.discountCents).toBe(2000);
      expect(updated!.totalCents).toBe(8000);
      expect(updated!.balanceCents).toBe(8000);
    });

    test('applyDiscount recalculates with tax', async () => {
      const invoice = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1, branchId: BRANCH_1,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0001',
        subtotalCents: 10000, totalCents: 11200, balanceCents: 11200,
        taxRate: '0.12',
      });

      // Discount 2000 off 10000 subtotal = 8000 after discount
      // Tax: 8000 * 0.12 = 960
      // Total: 8000 + 960 = 8960
      const updated = await repo.applyDiscount(invoice.id, 2000, 0.12);
      expect(updated!.discountCents).toBe(2000);
      expect(updated!.taxCents).toBe(960);
      expect(updated!.totalCents).toBe(8960);
      expect(updated!.balanceCents).toBe(8960);
    });
  });

  // --------------------------------------------------------------------------
  // LINE ITEMS
  // --------------------------------------------------------------------------

  describe('line items', () => {
    test('findWithLineItems returns invoice and its line items', async () => {
      const invoice = await repo.createOne({
        visitId: VISIT_1, patientId: PATIENT_1, branchId: BRANCH_1,
        dentistMemberId: DENTIST_1, invoiceNumber: 'INV-2026-0001',
        subtotalCents: 25000, totalCents: 25000, balanceCents: 25000,
      });

      await repo.createLineItem({
        invoiceId: invoice.id, description: 'Crown', unitPriceCents: 15000,
        quantity: 1, amountCents: 15000, cdtCode: 'D2740',
      });
      await repo.createLineItem({
        invoiceId: invoice.id, description: 'Filling', unitPriceCents: 10000,
        quantity: 1, amountCents: 10000, cdtCode: 'D2391',
      });

      const result = await repo.findWithLineItems(invoice.id);
      expect(result).not.toBeNull();
      expect(result!.invoice.id).toBe(invoice.id);
      expect(result!.lineItems).toHaveLength(2);
    });
  });
});
