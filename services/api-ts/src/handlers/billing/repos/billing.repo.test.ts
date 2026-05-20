/**
 * Billing repository integration tests
 *
 * Tests InvoiceRepository and MerchantAccountRepository against a real
 * Postgres test database. Follows the same pattern as dental-invoice.test.ts.
 *
 * Requires: postgres://postgres:password@localhost:5432/monobase
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { InvoiceRepository, MerchantAccountRepository } from './billing.repo';
import { persons } from '../../person/repos/person.schema';
import { openTestTx } from '@/core/test-tx';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// Set per-describe in beforeEach to the current transaction db
let db: NodePgDatabase;

// Fixed UUIDs for test persons (v4 format, unique prefix)
const CUSTOMER_1 = 'f1000000-0000-4000-8000-000000000001';
const CUSTOMER_2 = 'f1000000-0000-4000-8000-000000000002';
const MERCHANT_1 = 'f1000000-0000-4000-8000-000000000003';

describe('InvoiceRepository', () => {
  let repo: InvoiceRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    repo = new InvoiceRepository(db);
    // Insert persons needed for FK constraints
    await db.insert(persons).values([
      { id: CUSTOMER_1, firstName: 'Test' },
      { id: CUSTOMER_2, firstName: 'Other' },
      { id: MERCHANT_1, firstName: 'Merchant' },
    ]).onConflictDoNothing();
    teardown = rollback;
  });

  afterEach(() => teardown());

  // --------------------------------------------------------------------------
  // Invoice number generation
  // --------------------------------------------------------------------------

  describe('generateInvoiceNumber', () => {
    test('returns INV-YYYY-000001 when no invoices exist', async () => {
      const num = await repo.generateInvoiceNumber();
      const year = new Date().getFullYear();
      expect(num).toBe(`INV-${year}-000001`);
    });

    test('increments from the last invoice number for this year', async () => {
      const year = new Date().getFullYear();
      await repo.createOne({
        customer: CUSTOMER_1,
        merchant: MERCHANT_1,
        invoiceNumber: `INV-${year}-000005`,
        subtotal: 10000,
        total: 10000,
      });
      const num = await repo.generateInvoiceNumber();
      expect(num).toBe(`INV-${year}-000006`);
    });
  });

  // --------------------------------------------------------------------------
  // Status transitions
  // --------------------------------------------------------------------------

  describe('updateStatus', () => {
    test('sets status to paid and stamps paidAt', async () => {
      const invoice = await repo.createOne({
        customer: CUSTOMER_1,
        merchant: MERCHANT_1,
        invoiceNumber: `INV-${new Date().getFullYear()}-000001`,
        subtotal: 10000,
        total: 10000,
      });

      const updated = await repo.updateStatus(invoice.id, 'paid');
      expect(updated.status).toBe('paid');
      expect(updated.paidAt).not.toBeNull();
    });

    test('sets status to void and stamps voidedAt', async () => {
      const invoice = await repo.createOne({
        customer: CUSTOMER_1,
        merchant: MERCHANT_1,
        invoiceNumber: `INV-${new Date().getFullYear()}-000001`,
        subtotal: 10000,
        total: 10000,
      });

      const updated = await repo.updateStatus(invoice.id, 'void');
      expect(updated.status).toBe('void');
      expect(updated.voidedAt).not.toBeNull();
    });

    test('sets status to open without setting paidAt or voidedAt', async () => {
      const invoice = await repo.createOne({
        customer: CUSTOMER_1,
        merchant: MERCHANT_1,
        invoiceNumber: `INV-${new Date().getFullYear()}-000001`,
        subtotal: 10000,
        total: 10000,
      });

      const updated = await repo.updateStatus(invoice.id, 'open');
      expect(updated.status).toBe('open');
      expect(updated.paidAt).toBeNull();
      expect(updated.voidedAt).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Payment status
  // --------------------------------------------------------------------------

  describe('updatePaymentStatus', () => {
    test('sets paymentStatus to succeeded', async () => {
      const invoice = await repo.createOne({
        customer: CUSTOMER_1,
        merchant: MERCHANT_1,
        invoiceNumber: `INV-${new Date().getFullYear()}-000001`,
        subtotal: 10000,
        total: 10000,
      });

      const updated = await repo.updatePaymentStatus(invoice.id, 'succeeded');
      expect(updated.paymentStatus).toBe('succeeded');
    });

    test('sets paymentStatus to failed', async () => {
      const invoice = await repo.createOne({
        customer: CUSTOMER_1,
        merchant: MERCHANT_1,
        invoiceNumber: `INV-${new Date().getFullYear()}-000001`,
        subtotal: 10000,
        total: 10000,
      });

      const updated = await repo.updatePaymentStatus(invoice.id, 'failed');
      expect(updated.paymentStatus).toBe('failed');
    });
  });

  // --------------------------------------------------------------------------
  // findOneWithLineItems
  // --------------------------------------------------------------------------

  describe('findOneWithLineItems', () => {
    test('returns null for unknown invoice id', async () => {
      const result = await repo.findOneWithLineItems('00000000-0000-4000-8000-000000000000');
      expect(result).toBeNull();
    });

    test('returns invoice with attached line items', async () => {
      const created = await repo.createWithLineItems(
        {
          customer: CUSTOMER_1,
          merchant: MERCHANT_1,
          subtotal: 25000,
          total: 25000,
        },
        [
          { description: 'Crown',   quantity: 1, unitPrice: 15000, amount: 15000 },
          { description: 'Filling', quantity: 1, unitPrice: 10000, amount: 10000 },
        ]
      );

      const result = await repo.findOneWithLineItems(created.id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
      expect(result!.lineItems).toHaveLength(2);
      expect(result!.lineItems.map((l) => l.description).sort()).toEqual(['Crown', 'Filling']);
    });
  });

  // --------------------------------------------------------------------------
  // createWithLineItems
  // --------------------------------------------------------------------------

  describe('createWithLineItems', () => {
    test('creates invoice and line items atomically', async () => {
      const year = new Date().getFullYear();
      const created = await repo.createWithLineItems(
        {
          customer: CUSTOMER_1,
          merchant: MERCHANT_1,
          subtotal: 20000,
          total: 20000,
        },
        [
          { description: 'Exam', quantity: 1, unitPrice: 20000, amount: 20000 },
        ]
      );

      expect(created.id).not.toBeNull();
      expect(created.invoiceNumber).toMatch(new RegExp(`^INV-${year}-`));
      expect(created.status).toBe('draft');
      expect(created.lineItems).toHaveLength(1);
      expect(created.lineItems[0]!.description).toBe('Exam');
    });

    test('sequential calls generate consecutive invoice numbers', async () => {
      const inv1 = await repo.createWithLineItems(
        { customer: CUSTOMER_1, merchant: MERCHANT_1, subtotal: 0, total: 0 },
        []
      );
      const inv2 = await repo.createWithLineItems(
        { customer: CUSTOMER_2, merchant: MERCHANT_1, subtotal: 0, total: 0 },
        []
      );

      const n1 = parseInt(inv1.invoiceNumber.split('-')[2]!);
      const n2 = parseInt(inv2.invoiceNumber.split('-')[2]!);
      expect(n2).toBe(n1 + 1);
    });
  });

  // --------------------------------------------------------------------------
  // findMany filters
  // --------------------------------------------------------------------------

  describe('findMany', () => {
    test('filters by customer', async () => {
      await repo.createOne({
        customer: CUSTOMER_1, merchant: MERCHANT_1,
        invoiceNumber: `INV-${new Date().getFullYear()}-000001`,
        subtotal: 5000, total: 5000,
      });
      await repo.createOne({
        customer: CUSTOMER_2, merchant: MERCHANT_1,
        invoiceNumber: `INV-${new Date().getFullYear()}-000002`,
        subtotal: 5000, total: 5000,
      });

      const results = await repo.findMany({ customer: CUSTOMER_1 });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every((r) => r.customer === CUSTOMER_1)).toBe(true);
    });

    test('filters by status', async () => {
      const inv = await repo.createOne({
        customer: CUSTOMER_1, merchant: MERCHANT_1,
        invoiceNumber: `INV-${new Date().getFullYear()}-000001`,
        subtotal: 5000, total: 5000,
      });
      await repo.updateStatus(inv.id, 'open');

      await repo.createOne({
        customer: CUSTOMER_1, merchant: MERCHANT_1,
        invoiceNumber: `INV-${new Date().getFullYear()}-000002`,
        subtotal: 5000, total: 5000,
      });

      const results = await repo.findMany({ status: 'open' });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every((r) => r.status === 'open')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------

describe('MerchantAccountRepository', () => {
  let repo: MerchantAccountRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    repo = new MerchantAccountRepository(db);
    await db.insert(persons).values([
      { id: CUSTOMER_1, firstName: 'Test' },
      { id: CUSTOMER_2, firstName: 'Other' },
    ]).onConflictDoNothing();
    teardown = rollback;
  });

  afterEach(() => teardown());

  // --------------------------------------------------------------------------
  // findByPerson
  // --------------------------------------------------------------------------

  describe('findByPerson', () => {
    test('returns null when person has no merchant account', async () => {
      const result = await repo.findByPerson(CUSTOMER_1);
      expect(result).toBeNull();
    });

    test('returns merchant account for a known person', async () => {
      await repo.createOne({
        person: CUSTOMER_1,
        metadata: { stripeAccountId: 'acct_test001' },
      });

      const result = await repo.findByPerson(CUSTOMER_1);
      expect(result).not.toBeNull();
      expect(result!.person).toBe(CUSTOMER_1);
    });
  });

  // --------------------------------------------------------------------------
  // findByStripeAccountId
  // --------------------------------------------------------------------------

  describe('findByStripeAccountId', () => {
    test('returns null for unknown stripe account id', async () => {
      const result = await repo.findByStripeAccountId('acct_nonexistent');
      expect(result).toBeNull();
    });

    test('queries the metadata JSONB field and returns matching account', async () => {
      await repo.createOne({
        person: CUSTOMER_1,
        metadata: { stripeAccountId: 'acct_live_abc123' },
      });

      const result = await repo.findByStripeAccountId('acct_live_abc123');
      expect(result).not.toBeNull();
      expect((result!.metadata as any).stripeAccountId).toBe('acct_live_abc123');
    });
  });

  // --------------------------------------------------------------------------
  // findOneWithPerson
  // --------------------------------------------------------------------------

  describe('findOneWithPerson', () => {
    test('returns null for unknown id', async () => {
      const result = await repo.findOneWithPerson('00000000-0000-4000-8000-000000000000');
      expect(result).toBeNull();
    });

    test('joins person data onto the merchant account', async () => {
      const account = await repo.createOne({
        person: CUSTOMER_1,
        metadata: { stripeAccountId: 'acct_xyz' },
      });

      const result = await repo.findOneWithPerson(account.id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(account.id);
      expect(result!.person).not.toBeNull();
      expect(result!.person!.id).toBe(CUSTOMER_1);
    });
  });

  // --------------------------------------------------------------------------
  // updateMetadata
  // --------------------------------------------------------------------------

  describe('updateMetadata', () => {
    test('replaces metadata with new values', async () => {
      const account = await repo.createOne({
        person: CUSTOMER_1,
        metadata: { stripeAccountId: 'acct_old', onboardingComplete: false },
      });

      const updated = await repo.updateMetadata(account.id, {
        stripeAccountId: 'acct_old',
        onboardingComplete: true,
      });

      expect((updated.metadata as any).onboardingComplete).toBe(true);
    });

    test('toggles active flag via updateOneById', async () => {
      const account = await repo.createOne({
        person: CUSTOMER_1,
        metadata: {},
      });
      expect(account.active).toBe(true);

      const updated = await repo.updateOneById(account.id, { active: false });
      expect(updated.active).toBe(false);
    });
  });
});
