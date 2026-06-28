/**
 * PaymentPlanView component tests -- pure logic helpers
 *
 * Tests: formatFrequency, getPlanStatusClass, calcProgress, isInstallmentOverdue
 */

import { describe, test, expect } from 'bun:test';
import {
  formatFrequency,
  getPlanStatusClass,
  calcProgress,
  isInstallmentOverdue,
} from './payment-plan-view';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentPlanView -- formatFrequency', () => {
  test('formatFrequency("monthly") === "Monthly"', () => {
    expect(formatFrequency('monthly')).toBe('Monthly');
  });

  test('formatFrequency("weekly") === "Weekly"', () => {
    expect(formatFrequency('weekly')).toBe('Weekly');
  });

  test('formatFrequency("biweekly") === "Bi-Weekly"', () => {
    expect(formatFrequency('biweekly')).toBe('Bi-Weekly');
  });
});

describe('PaymentPlanView -- getPlanStatusClass', () => {
  // Assert the semantic token role per status (not a raw palette name) so the
  // design system can re-point the token without breaking these tests.
  test('getPlanStatusClass("on_track") uses the done/success token', () => {
    expect(getPlanStatusClass('on_track')).toContain('status-done');
  });

  test('getPlanStatusClass("behind") uses the destructive token', () => {
    expect(getPlanStatusClass('behind')).toContain('destructive');
  });

  test('getPlanStatusClass("completed") uses the done/success token', () => {
    expect(getPlanStatusClass('completed')).toContain('status-done');
  });

  test('getPlanStatusClass("cancelled") uses the neutral muted token', () => {
    expect(getPlanStatusClass('cancelled')).toContain('muted-foreground');
  });
});

describe('PaymentPlanView -- calcProgress', () => {
  test('calcProgress(3000, 10000) === 30', () => {
    expect(calcProgress(3000, 10000)).toBe(30);
  });

  test('calcProgress(10000, 10000) === 100', () => {
    expect(calcProgress(10000, 10000)).toBe(100);
  });

  test('calcProgress(0, 10000) === 0', () => {
    expect(calcProgress(0, 10000)).toBe(0);
  });

  test('calcProgress(5000, 0) === 0 (division by zero)', () => {
    expect(calcProgress(5000, 0)).toBe(0);
  });
});

describe('PaymentPlanView -- isInstallmentOverdue', () => {
  test('isInstallmentOverdue({ status: "overdue" }) === true', () => {
    expect(isInstallmentOverdue({ status: 'overdue' })).toBe(true);
  });

  test('isInstallmentOverdue({ status: "paid" }) === false', () => {
    expect(isInstallmentOverdue({ status: 'paid' })).toBe(false);
  });

  test('isInstallmentOverdue({ status: "pending" }) === false', () => {
    expect(isInstallmentOverdue({ status: 'pending' })).toBe(false);
  });
});
