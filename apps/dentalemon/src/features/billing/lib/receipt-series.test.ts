import { describe, test, expect } from 'bun:test';
import { incrementReceiptNumber } from './receipt-series';

describe('incrementReceiptNumber — advance an OR number in place', () => {
  test('preserves prefix and zero-pad width', () => {
    expect(incrementReceiptNumber('OR-000042')).toBe('OR-000043');
    expect(incrementReceiptNumber('0009')).toBe('0010');
    expect(incrementReceiptNumber('R-A-7')).toBe('R-A-8');
  });

  test('only the trailing digit run advances (a date prefix stays put)', () => {
    expect(incrementReceiptNumber('2026-00001')).toBe('2026-00002');
  });

  test('width grows when the counter overflows its padding', () => {
    expect(incrementReceiptNumber('099')).toBe('100');
  });

  test('returns null when there is no trailing number to advance', () => {
    expect(incrementReceiptNumber('INV')).toBeNull();
    expect(incrementReceiptNumber('')).toBeNull();
  });
});
