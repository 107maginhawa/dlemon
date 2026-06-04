/**
 * InvoiceDetail component tests -- pure logic helpers
 *
 * Tests: canIssue, canVoid, canRecord, buildPaymentPayload,
 *        validatePaymentForm, calcChangeAmount
 */

import { describe, test, expect } from 'bun:test';
import {
  canIssue,
  canVoid,
  canRecord,
  showIssueButton,
  showVoidButton,
  showRecordButton,
  validatePaymentForm,
  buildPaymentPayload,
  calcChangeAmount,
} from './invoice-detail';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvoiceDetail -- canIssue', () => {
  test('canIssue("draft") === true', () => {
    expect(canIssue('draft')).toBe(true);
  });

  test('canIssue("issued") === false', () => {
    expect(canIssue('issued')).toBe(false);
  });

  test('canIssue("paid") === false', () => {
    expect(canIssue('paid')).toBe(false);
  });
});

describe('InvoiceDetail -- canVoid', () => {
  test('canVoid("issued") === true', () => {
    expect(canVoid('issued')).toBe(true);
  });

  test('canVoid("paid") === false', () => {
    expect(canVoid('paid')).toBe(false);
  });

  test('canVoid("draft") === false', () => {
    expect(canVoid('draft')).toBe(false);
  });

  test('canVoid("partial") === true', () => {
    expect(canVoid('partial')).toBe(true);
  });
});

describe('InvoiceDetail -- canRecord', () => {
  test('canRecord("issued") === true', () => {
    expect(canRecord('issued')).toBe(true);
  });

  test('canRecord("draft") === false', () => {
    expect(canRecord('draft')).toBe(false);
  });

  test('canRecord("partial") === true', () => {
    expect(canRecord('partial')).toBe(true);
  });

  test('canRecord("paid") === false', () => {
    expect(canRecord('paid')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// J-RBAC-001: role-gated action button visibility
// ---------------------------------------------------------------------------

describe('InvoiceDetail -- showIssueButton (status x canWrite)', () => {
  test('draft + canWrite -> true', () => {
    expect(showIssueButton('draft', true)).toBe(true);
  });
  test('draft + NO write (staff_full) -> false', () => {
    expect(showIssueButton('draft', false)).toBe(false);
  });
  test('issued + canWrite -> false (status gate)', () => {
    expect(showIssueButton('issued', true)).toBe(false);
  });
});

describe('InvoiceDetail -- showVoidButton (status x canWrite)', () => {
  test('issued + canWrite -> true', () => {
    expect(showVoidButton('issued', true)).toBe(true);
  });
  test('issued + NO write (staff_full) -> false', () => {
    expect(showVoidButton('issued', false)).toBe(false);
  });
  test('draft + canWrite -> false (status gate)', () => {
    expect(showVoidButton('draft', true)).toBe(false);
  });
});

describe('InvoiceDetail -- showRecordButton (status only, role-independent)', () => {
  test('issued -> true regardless of write permission', () => {
    expect(showRecordButton('issued')).toBe(true);
  });
  test('partial -> true', () => {
    expect(showRecordButton('partial')).toBe(true);
  });
  test('draft -> false', () => {
    expect(showRecordButton('draft')).toBe(false);
  });
  test('paid -> false', () => {
    expect(showRecordButton('paid')).toBe(false);
  });
});

describe('InvoiceDetail -- validatePaymentForm', () => {
  test('missing amount produces error', () => {
    const errors = validatePaymentForm({
      amountCents: 0,
      method: 'cash',
      receiptNumber: 'R-001',
    });
    expect(errors).toContain('Amount must be greater than zero');
  });

  test('amount=0 produces error', () => {
    const errors = validatePaymentForm({
      amountCents: 0,
      method: 'cash',
      receiptNumber: 'R-001',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  test('missing method produces error', () => {
    const errors = validatePaymentForm({
      amountCents: 5000,
      method: '',
      receiptNumber: 'R-001',
    });
    expect(errors).toContain('Payment method is required');
  });

  test('missing receiptNumber produces error', () => {
    const errors = validatePaymentForm({
      amountCents: 5000,
      method: 'cash',
      receiptNumber: '',
    });
    expect(errors).toContain('Receipt number is required');
  });

  test('valid form has no errors', () => {
    const errors = validatePaymentForm({
      amountCents: 5000,
      method: 'cash',
      receiptNumber: 'R-001',
    });
    expect(errors.length).toBe(0);
  });
});

describe('InvoiceDetail -- buildPaymentPayload', () => {
  test('buildPaymentPayload trims whitespace', () => {
    const payload = buildPaymentPayload({
      amountCents: 5000,
      method: '  cash  ',
      receiptNumber: '  R-001  ',
      recordedByMemberId: '  m-1  ',
    });
    expect(payload.method).toBe('cash');
    expect(payload.receiptNumber).toBe('R-001');
    expect(payload.recordedByMemberId).toBe('m-1');
    expect(payload.amountCents).toBe(5000);
  });
});

describe('InvoiceDetail -- calcChangeAmount', () => {
  test('calcChangeAmount(20000, 15000) === 5000', () => {
    expect(calcChangeAmount(20000, 15000)).toBe(5000);
  });

  test('calcChangeAmount(15000, 15000) === 0', () => {
    expect(calcChangeAmount(15000, 15000)).toBe(0);
  });

  test('calcChangeAmount(10000, 15000) === 0 (no negative change)', () => {
    expect(calcChangeAmount(10000, 15000)).toBe(0);
  });
});
