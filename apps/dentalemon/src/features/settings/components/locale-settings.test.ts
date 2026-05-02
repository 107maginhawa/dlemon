import { describe, test, expect } from 'bun:test';

interface LocaleOption {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  taxLabel: string;
}

function getAvailableLocales(): LocaleOption[] {
  return [
    { code: 'PH', name: 'Philippines', currency: 'PHP', currencySymbol: '₱', taxRate: 0.12, taxLabel: 'VAT 12%' },
    { code: 'AU', name: 'Australia', currency: 'AUD', currencySymbol: 'A$', taxRate: 0.10, taxLabel: 'GST 10%' },
    { code: 'US', name: 'United States', currency: 'USD', currencySymbol: '$', taxRate: 0, taxLabel: 'N/A' },
  ];
}

function getDefaultLocale(countryCode: string): LocaleOption {
  const locales = getAvailableLocales();
  return locales.find(l => l.code === countryCode) ?? { code: countryCode, name: 'Unknown', currency: 'USD', currencySymbol: '$', taxRate: 0, taxLabel: 'N/A' };
}

function formatCurrency(cents: number, countryCode: string): string {
  const locale = getDefaultLocale(countryCode);
  return `${locale.currencySymbol}${(cents / 100).toFixed(2)}`;
}

function getTaxLabel(countryCode: string): string {
  return getDefaultLocale(countryCode).taxLabel;
}

describe('Locale Settings — getAvailableLocales', () => {
  test('includes PH', () => {
    expect(getAvailableLocales().some(l => l.code === 'PH')).toBe(true);
  });
  test('has at least 3 entries', () => {
    expect(getAvailableLocales().length).toBeGreaterThanOrEqual(3);
  });
});

describe('Locale Settings — getDefaultLocale', () => {
  test('PH → PHP, 0.12', () => {
    const l = getDefaultLocale('PH');
    expect(l.currency).toBe('PHP');
    expect(l.taxRate).toBe(0.12);
  });
  test('AU → AUD, 0.10', () => {
    const l = getDefaultLocale('AU');
    expect(l.currency).toBe('AUD');
    expect(l.taxRate).toBe(0.10);
  });
  test('unknown → safe defaults', () => {
    const l = getDefaultLocale('ZZ');
    expect(l.currency).toBe('USD');
  });
});

describe('Locale Settings — formatCurrency', () => {
  test('PH format', () => expect(formatCurrency(15000, 'PH')).toBe('₱150.00'));
});

describe('Locale Settings — getTaxLabel', () => {
  test('PH → VAT 12%', () => expect(getTaxLabel('PH')).toBe('VAT 12%'));
  test('AU → GST 10%', () => expect(getTaxLabel('AU')).toBe('GST 10%'));
});
