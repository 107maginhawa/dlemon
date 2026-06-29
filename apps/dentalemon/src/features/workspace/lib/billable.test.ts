import { describe, test, expect } from 'bun:test';
import { isBillable, isBillableStatus, isEstimateStatus, splitBillable } from './billable';

describe('billable SoT (mirrors server BR-009)', () => {
  test('only performed|verified are billable', () => {
    expect(isBillableStatus('performed')).toBe(true);
    expect(isBillableStatus('verified')).toBe(true);
    expect(isBillableStatus('planned')).toBe(false);
    expect(isBillableStatus('diagnosed')).toBe(false);
    expect(isBillableStatus('declined')).toBe(false);
    expect(isBillableStatus(null)).toBe(false);
  });

  test('only diagnosed|planned are estimate', () => {
    expect(isEstimateStatus('diagnosed')).toBe(true);
    expect(isEstimateStatus('planned')).toBe(true);
    expect(isEstimateStatus('performed')).toBe(false);
    expect(isEstimateStatus('declined')).toBe(false);
  });

  test('splitBillable partitions and drops non-billable/non-estimate', () => {
    const items = [
      { id: 'a', status: 'performed' },
      { id: 'b', status: 'planned' },
      { id: 'c', status: 'diagnosed' },
      { id: 'd', status: 'verified' },
      { id: 'e', status: 'declined' }, // dropped from both
    ];
    const { billable, estimate } = splitBillable(items);
    expect(billable.map((t) => t.id)).toEqual(['a', 'd']);
    expect(estimate.map((t) => t.id)).toEqual(['b', 'c']);
  });

  test('isBillable works on a treatment-like object', () => {
    expect(isBillable({ status: 'performed' })).toBe(true);
    expect(isBillable({ status: 'planned' })).toBe(false);
  });
});
