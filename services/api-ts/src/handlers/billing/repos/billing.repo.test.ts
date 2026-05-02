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
