import { describe, test, expect } from 'bun:test';
import { getLocaleConfig, validatePRCLicense, getApplicableDiscounts, formatAmount } from './locale';

describe('Locale — getLocaleConfig', () => {
  test('PH config', () => {
    const c = getLocaleConfig('PH');
    expect(c.currency).toBe('PHP');
    expect(c.currencySymbol).toBe('₱');
    expect(c.taxRate).toBe(0.12);
    expect(c.retentionYears).toBe(15);
  });

  test('AU config', () => {
    const c = getLocaleConfig('AU');
    expect(c.currency).toBe('AUD');
    expect(c.currencySymbol).toBe('A$');
    expect(c.taxRate).toBe(0.10);
  });

  test('US config', () => {
    const c = getLocaleConfig('US');
    expect(c.currency).toBe('USD');
    expect(c.currencySymbol).toBe('$');
    expect(c.taxRate).toBe(0);
  });

  test('unknown country returns safe defaults', () => {
    const c = getLocaleConfig('ZZ');
    expect(c.currency).toBe('USD');
    expect(c.taxRate).toBe(0);
    expect(c.retentionYears).toBe(7);
  });
});

describe('Locale — validatePRCLicense', () => {
  test('valid 7-digit license', () => expect(validatePRCLicense('1234567')).toBe(true));
  test('too short', () => expect(validatePRCLicense('123')).toBe(false));
  test('empty string', () => expect(validatePRCLicense('')).toBe(false));
});

describe('Locale — getApplicableDiscounts', () => {
  test('PH pwd tag → PWD discount', () => {
    const result = getApplicableDiscounts('PH', ['pwd']);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('PWD Discount');
    expect(result[0]!.rate).toBe(20);
  });

  test('PH senior tag → Senior discount', () => {
    const result = getApplicableDiscounts('PH', ['senior']);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Senior Citizen Discount');
  });

  test('PH both tags → both discounts', () => {
    const result = getApplicableDiscounts('PH', ['pwd', 'senior']);
    expect(result).toHaveLength(2);
  });

  test('US returns empty', () => {
    expect(getApplicableDiscounts('US', [])).toHaveLength(0);
  });
});

describe('Locale — formatAmount', () => {
  test('PH format', () => expect(formatAmount(15000, 'PH')).toBe('₱150.00'));
});
