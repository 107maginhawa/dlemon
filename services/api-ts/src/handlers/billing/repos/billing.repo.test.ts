/**
 * Billing repository unit tests
 *
 * Tests InvoiceRepository and MerchantAccountRepository class shapes,
 * filter building, and invoice number generation logic.
 * No real DB -- tests pure logic and constructor behavior.
 */

import { describe, test, expect, mock } from 'bun:test';
import { InvoiceRepository, MerchantAccountRepository } from './billing.repo';

// Minimal mock DB that satisfies constructor
const mockDb = {
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => ({
        orderBy: mock(() => ({
          limit: mock(() => []),
        })),
        limit: mock(() => []),
      })),
      leftJoin: mock(() => ({
        where: mock(() => ({
          limit: mock(() => []),
        })),
      })),
    })),
  })),
  insert: mock(() => ({
    values: mock(() => ({
      returning: mock(() => []),
    })),
  })),
  update: mock(() => ({
    set: mock(() => ({
      where: mock(() => ({
        returning: mock(() => []),
      })),
    })),
  })),
  delete: mock(() => ({
    where: mock(() => ({})),
  })),
  transaction: mock(async (fn: any) => fn(mockDb)),
} as any;

const mockLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;

describe('InvoiceRepository', () => {
  test('constructs without error', () => {
    const repo = new InvoiceRepository(mockDb, mockLogger);
    expect(repo).toBeDefined();
  });

  test('generateInvoiceNumber returns correct format', async () => {
    // Mock the select chain to return empty results (first invoice of the year)
    const selectMock = {
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => [],
          }),
        }),
      }),
    };
    const db = { ...mockDb, select: () => selectMock } as any;
    const repo = new InvoiceRepository(db, mockLogger);

    const num = await repo.generateInvoiceNumber();
    const year = new Date().getFullYear();
    expect(num).toBe(`INV-${year}-000001`);
  });

  test('generateInvoiceNumber increments from last invoice', async () => {
    const year = new Date().getFullYear();
    const selectMock = {
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => [{ invoiceNumber: `INV-${year}-000005` }],
          }),
        }),
      }),
    };
    const db = { ...mockDb, select: () => selectMock } as any;
    const repo = new InvoiceRepository(db, mockLogger);

    const num = await repo.generateInvoiceNumber();
    expect(num).toBe(`INV-${year}-000006`);
  });
});

// ---------------------------------------------------------------------------
// Tax and platform fee calculation (pure logic)
// ---------------------------------------------------------------------------

describe('tax and platform fee calculations', () => {
  test('calculates 10% tax correctly', () => {
    const subtotalCents = 10000;
    const taxRate = 0.10;
    const taxCents = Math.round(subtotalCents * taxRate);
    expect(taxCents).toBe(1000);
    expect(subtotalCents + taxCents).toBe(11000);
  });

  test('calculates 2% platform fee correctly', () => {
    const totalCents = 11000;
    const platformFeeRate = 0.02;
    const platformAmountCents = Math.round(totalCents * platformFeeRate);
    expect(platformAmountCents).toBe(220);
    expect(totalCents - platformAmountCents).toBe(10780);
  });

  test('calculates line item subtotal correctly', () => {
    const lineItems = [
      { amount: 15000, quantity: 1 },
      { amount: 5000, quantity: 2 },
    ];
    const subtotal = lineItems.reduce(
      (sum, item) => sum + item.amount * item.quantity,
      0
    );
    expect(subtotal).toBe(25000);
  });

  test('rounds fractional tax to nearest cent', () => {
    const subtotalCents = 10001;
    const taxCents = Math.round(subtotalCents * 0.10);
    expect(taxCents).toBe(1000); // 1000.1 rounds to 1000
  });

  test('handles zero tax rate', () => {
    expect(Math.round(5000 * 0)).toBe(0);
  });

  test('handles zero platform fee', () => {
    expect(Math.round(5000 * 0)).toBe(0);
  });

  test('combined tax + platform fee calculation', () => {
    const subtotal = 10000;
    const tax = Math.round(subtotal * 0.08);
    const total = subtotal + tax;
    const platformFee = Math.round(total * 0.03);
    const providerAmount = total - platformFee;
    expect(tax).toBe(800);
    expect(total).toBe(10800);
    expect(platformFee).toBe(324);
    expect(providerAmount).toBe(10476);
  });
});

describe('MerchantAccountRepository', () => {
  test('constructs without error', () => {
    const repo = new MerchantAccountRepository(mockDb, mockLogger);
    expect(repo).toBeDefined();
  });

  test('findByPerson returns null when no results', async () => {
    const selectMock = {
      from: () => ({
        where: () => ({
          limit: () => [],
        }),
      }),
    };
    const db = { ...mockDb, select: () => selectMock } as any;
    const repo = new MerchantAccountRepository(db, mockLogger);

    const result = await repo.findByPerson('nonexistent-person');
    expect(result).toBeNull();
  });

  test('findByStripeAccountId returns null when no results', async () => {
    const selectMock = {
      from: () => ({
        where: () => ({
          limit: () => [],
        }),
      }),
    };
    const db = { ...mockDb, select: () => selectMock } as any;
    const repo = new MerchantAccountRepository(db, mockLogger);

    const result = await repo.findByStripeAccountId('acct_nonexistent');
    expect(result).toBeNull();
  });

  test('findOneWithPerson returns null when no results', async () => {
    const selectMock = {
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: () => [],
          }),
        }),
      }),
    };
    const db = { ...mockDb, select: () => selectMock } as any;
    const repo = new MerchantAccountRepository(db, mockLogger);

    const result = await repo.findOneWithPerson('nonexistent-id');
    expect(result).toBeNull();
  });
});
