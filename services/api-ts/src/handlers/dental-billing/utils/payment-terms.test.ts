/**
 * resolvePaymentTermsDays — precedence + bounds for BR-048.
 *
 * dueDate at issue derives from payment terms with precedence:
 * invoice override → max of line-item service terms → clinic default → 0.
 * Terms are bounded 0–365 days (Net-0 = due on receipt).
 */
import { describe, test, expect } from 'bun:test';
import { resolvePaymentTermsDays } from './payment-terms';

describe('resolvePaymentTermsDays', () => {
  test('invoice override wins over service terms and clinic default', () => {
    expect(resolvePaymentTermsDays({ invoiceOverrideDays: 30, serviceTermsDays: [60], clinicDefaultDays: 15 })).toBe(30);
  });

  test('an explicit override of 0 (due on receipt) wins, not treated as absent', () => {
    expect(resolvePaymentTermsDays({ invoiceOverrideDays: 0, serviceTermsDays: [60], clinicDefaultDays: 15 })).toBe(0);
  });

  test('without an override, the MAX of service terms applies', () => {
    expect(resolvePaymentTermsDays({ serviceTermsDays: [30, 60, 15] })).toBe(60);
  });

  test('service-term nulls/undefined are ignored', () => {
    expect(resolvePaymentTermsDays({ serviceTermsDays: [null, 45, undefined] })).toBe(45);
  });

  test('falls back to clinic default when no override and no service terms', () => {
    expect(resolvePaymentTermsDays({ serviceTermsDays: [], clinicDefaultDays: 15 })).toBe(15);
  });

  test('defaults to 0 (due on receipt) when nothing is configured', () => {
    expect(resolvePaymentTermsDays({})).toBe(0);
  });

  test('clamps above the 365-day ceiling', () => {
    expect(resolvePaymentTermsDays({ invoiceOverrideDays: 400 })).toBe(365);
  });

  test('clamps negative terms to 0', () => {
    expect(resolvePaymentTermsDays({ clinicDefaultDays: -5 })).toBe(0);
  });

  test('non-integer terms are floored', () => {
    expect(resolvePaymentTermsDays({ invoiceOverrideDays: 30.9 })).toBe(30);
  });
});
