import { describe, test, expect } from 'bun:test';

interface FeeEntry {
  cdtCode: string;
  description: string;
  priceCents: number;
}

function parseFeeAmount(input: string): number {
  const num = parseFloat(input);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

function formatFeeCents(cents: number): string {
  return `₱${(cents / 100).toFixed(2)}`;
}

function validateFeeEntry(entry: FeeEntry): string[] {
  const errors: string[] = [];
  if (!entry.cdtCode.trim()) errors.push('CDT code is required');
  if (entry.priceCents < 0) errors.push('Price cannot be negative');
  return errors;
}

function sortFeesByCode(fees: FeeEntry[]): FeeEntry[] {
  return [...fees].sort((a, b) => a.cdtCode.localeCompare(b.cdtCode));
}

describe('Fee Schedule — parseFeeAmount', () => {
  test('parses "150.00" to 15000', () => expect(parseFeeAmount('150.00')).toBe(15000));
  test('parses "0" to 0', () => expect(parseFeeAmount('0')).toBe(0));
  test('parses "" to 0', () => expect(parseFeeAmount('')).toBe(0));
});

describe('Fee Schedule — formatFeeCents', () => {
  test('formats 15000 to ₱150.00', () => expect(formatFeeCents(15000)).toBe('₱150.00'));
});

describe('Fee Schedule — validateFeeEntry', () => {
  test('missing cdtCode → error', () => {
    expect(validateFeeEntry({ cdtCode: '', description: 'Test', priceCents: 1000 })).toContain('CDT code is required');
  });
  test('negative price → error', () => {
    expect(validateFeeEntry({ cdtCode: 'D0120', description: 'Test', priceCents: -100 })).toContain('Price cannot be negative');
  });
  test('valid entry → no errors', () => {
    expect(validateFeeEntry({ cdtCode: 'D0120', description: 'Exam', priceCents: 5000 })).toHaveLength(0);
  });
});

describe('Fee Schedule — sortFeesByCode', () => {
  test('sorts D0120 before D2391', () => {
    const sorted = sortFeesByCode([
      { cdtCode: 'D2391', description: 'Composite', priceCents: 5000 },
      { cdtCode: 'D0120', description: 'Exam', priceCents: 3000 },
    ]);
    expect(sorted[0].cdtCode).toBe('D0120');
    expect(sorted[1].cdtCode).toBe('D2391');
  });
});
