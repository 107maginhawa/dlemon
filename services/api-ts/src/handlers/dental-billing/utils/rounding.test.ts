/**
 * Rounding utility tests
 *
 * Tests banker's rounding, discount application, and tax calculation.
 */

import { describe, test, expect } from 'bun:test';
import { bankersRound, applyDiscountRate, applyTaxRate, centsToDisplay } from './rounding';

describe('bankersRound', () => {
  test('rounds 2.5 to 2 (round half to even)', () => {
    expect(bankersRound(2.5, 0)).toBe(2);
  });

  test('rounds 3.5 to 4 (round half to even)', () => {
    expect(bankersRound(3.5, 0)).toBe(4);
  });

  test('rounds 2.55 correctly with 1 decimal', () => {
    // 2.55 rounded to 1 decimal: shifted = 25.5, floor=25 (odd), so rounds to 26 -> 2.6
    expect(bankersRound(2.55, 1)).toBe(2.6);
  });

  test('rounds normal values up when > .5', () => {
    expect(bankersRound(2.6, 0)).toBe(3);
  });

  test('rounds normal values down when < .5', () => {
    expect(bankersRound(2.4, 0)).toBe(2);
  });

  test('handles zero', () => {
    expect(bankersRound(0, 0)).toBe(0);
  });
});

describe('applyDiscountRate', () => {
  test('10% of 10000 = 1000', () => {
    expect(applyDiscountRate(10000, 10)).toBe(1000);
  });

  test('20% of 15000 = 3000', () => {
    expect(applyDiscountRate(15000, 20)).toBe(3000);
  });

  test('12% of 8333 with rounding', () => {
    // 8333 * 12 / 100 = 999.96 -> rounds to 1000
    expect(applyDiscountRate(8333, 12)).toBe(1000);
  });

  test('0% discount returns 0', () => {
    expect(applyDiscountRate(10000, 0)).toBe(0);
  });

  test('100% discount returns full amount', () => {
    expect(applyDiscountRate(10000, 100)).toBe(10000);
  });
});

describe('applyTaxRate', () => {
  test('12% VAT on 10000 = 1200', () => {
    expect(applyTaxRate(10000, 0.12)).toBe(1200);
  });

  test('0% tax returns 0', () => {
    expect(applyTaxRate(10000, 0)).toBe(0);
  });

  test('12% VAT on 8500 = 1020', () => {
    expect(applyTaxRate(8500, 0.12)).toBe(1020);
  });
});

describe('centsToDisplay', () => {
  test('formats cents as Philippine Peso', () => {
    const result = centsToDisplay(10000);
    expect(result).toContain('100');
    expect(result).toContain('\u20B1');
  });
});
