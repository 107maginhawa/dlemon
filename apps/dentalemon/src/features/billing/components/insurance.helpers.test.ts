/**
 * P1-26 insurance helper tests (pure, no DOM/network).
 */

import { describe, test, expect } from 'bun:test';
import {
  formatPeso,
  claimStatusClass,
  canSubmitClaim,
  canRecordRemittance,
  claimOutstandingCents,
  coverageSplitLabel,
  CLAIM_FSM,
  CLAIM_STATUS_FILTERS,
  type InsuranceClaimStatus,
} from './insurance.helpers';

describe('formatPeso', () => {
  test('renders ₱ with en-PH grouping + two decimals', () => {
    expect(formatPeso(123456)).toBe('₱1,234.56');
    expect(formatPeso(0)).toBe('₱0.00');
    expect(formatPeso(1000000)).toBe('₱10,000.00');
  });
});

describe('FSM gates', () => {
  test('canSubmitClaim only true from ready', () => {
    expect(canSubmitClaim('ready')).toBe(true);
    expect(canSubmitClaim('draft')).toBe(false);
    expect(canSubmitClaim('paid')).toBe(false);
  });

  test('canRecordRemittance true once decided/in-flight', () => {
    expect(canRecordRemittance('approved')).toBe(true);
    expect(canRecordRemittance('submitted')).toBe(true);
    expect(canRecordRemittance('draft')).toBe(false);
    expect(canRecordRemittance('paid')).toBe(false);
  });

  test('FE FSM map matches backend transition shape', () => {
    expect(CLAIM_FSM.draft).toEqual(['ready']);
    expect(CLAIM_FSM.paid).toEqual([]);
    expect(CLAIM_FSM.denied).toContain('appealed');
  });
});

describe('claimOutstandingCents', () => {
  test('billed − payer-paid − disallowed, clamped at 0', () => {
    expect(claimOutstandingCents({ billedAmountCents: 100000, paidByPayerCents: 60000, disallowedCents: 10000 })).toBe(30000);
    expect(claimOutstandingCents({ billedAmountCents: 100000, paidByPayerCents: 100000, disallowedCents: null })).toBe(0);
    expect(claimOutstandingCents({ billedAmountCents: 100000, paidByPayerCents: 120000, disallowedCents: null })).toBe(0);
  });
});

describe('coverageSplitLabel', () => {
  test('HMO covers / you pay phrasing', () => {
    expect(coverageSplitLabel(200000, 800000)).toBe('HMO covers ₱2,000.00 · You pay ₱8,000.00');
  });
});

describe('claimStatusClass', () => {
  test('maps each status to a non-empty class', () => {
    (Object.keys(CLAIM_FSM) as InsuranceClaimStatus[]).forEach((s) => {
      expect(claimStatusClass(s).length).toBeGreaterThan(0);
    });
  });
});

describe('CLAIM_STATUS_FILTERS', () => {
  test('starts with an "all" sentinel and includes every status', () => {
    expect(CLAIM_STATUS_FILTERS[0]).toEqual({ value: 'all', label: 'All' });
    expect(CLAIM_STATUS_FILTERS).toHaveLength(11); // all + 10 statuses
  });
});
