/**
 * Tax computation (BR-054) — pure unit tests.
 *
 * PH model: tax is derived from the branch tax mode, NEVER from the caller.
 * - non_vat (default): no tax. total = subtotal.
 * - vat_registered: 12% VAT, VAT-INCLUSIVE — the listed prices already include
 *   VAT, so VAT is carved OUT of the gross subtotal (total stays = subtotal).
 */

import { describe, test, expect } from 'bun:test';
import { computeInvoiceTax } from './tax';

describe('computeInvoiceTax (BR-054)', () => {
  test('non_vat → zero tax, full subtotal is vatable-equivalent', () => {
    const r = computeInvoiceTax({ subtotalCents: 100000, taxMode: 'non_vat' });
    expect(r.taxCents).toBe(0);
    expect(r.taxRate).toBe(0);
    expect(r.vatCents).toBe(0);
    expect(r.vatableCents).toBe(100000);
    expect(r.vatExemptCents).toBe(0);
  });

  test('undefined taxMode defaults to non_vat (zero tax)', () => {
    const r = computeInvoiceTax({ subtotalCents: 100000, taxMode: undefined });
    expect(r.taxCents).toBe(0);
    expect(r.taxRate).toBe(0);
  });

  test('vat_registered → 12% VAT carved out of the gross (inclusive); total unchanged', () => {
    // ₱1,000.00 gross → VAT = 1000 * 12/112 = ₱107.14 ; vatable = ₱892.86
    const r = computeInvoiceTax({ subtotalCents: 100000, taxMode: 'vat_registered' });
    expect(r.vatCents).toBe(10714);
    expect(r.vatableCents).toBe(89286);
    expect(r.taxCents).toBe(10714); // taxCents mirrors the VAT portion
    expect(r.taxRate).toBe(0.12);
    expect(r.vatableCents + r.vatCents).toBe(100000); // carve-out, not add-on
  });

  test('vat_registered honours a custom vatRate', () => {
    const r = computeInvoiceTax({ subtotalCents: 100000, taxMode: 'vat_registered', vatRate: 10 });
    expect(r.vatCents).toBe(Math.round(100000 * 10 / 110));
    expect(r.taxRate).toBe(0.1);
    expect(r.vatableCents + r.vatCents).toBe(100000);
  });

  test('zero subtotal → all zero, no NaN', () => {
    const r = computeInvoiceTax({ subtotalCents: 0, taxMode: 'vat_registered' });
    expect(r.taxCents).toBe(0);
    expect(r.vatableCents).toBe(0);
    expect(r.vatCents).toBe(0);
  });
});
