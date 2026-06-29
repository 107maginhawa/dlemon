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

  // Failure mode #3: the original bug hid because the seed was all-pending, so no
  // test exercised the adversarial mixes. Cover every state explicitly + the whole
  // FSM space so billable/estimate are partitioned for ALL inputs, not one fixture.
  test.each([
    // status      isBillable  isEstimate
    ['diagnosed', false, true],
    ['planned', false, true],
    ['performed', true, false],
    ['verified', true, false],
    ['declined', false, false], // refused — neither billed nor estimated
    ['dismissed', false, false], // struck from the plan
    [undefined, false, false],
  ] as const)('status %p → billable=%p estimate=%p', (status, billable, estimate) => {
    expect(isBillableStatus(status)).toBe(billable);
    expect(isEstimateStatus(status)).toBe(estimate);
    // A status is never BOTH payable and an estimate.
    expect(isBillableStatus(status) && isEstimateStatus(status)).toBe(false);
  });

  test.each([
    { name: 'all-planned', statuses: ['diagnosed', 'planned'], billable: 0, estimate: 2 },
    { name: 'all-performed', statuses: ['performed', 'verified'], billable: 2, estimate: 0 },
    { name: 'mixed', statuses: ['performed', 'planned', 'diagnosed'], billable: 1, estimate: 2 },
    { name: 'declined-only', statuses: ['declined'], billable: 0, estimate: 0 },
    { name: 'empty', statuses: [] as string[], billable: 0, estimate: 0 },
  ])('splitBillable on a $name visit', ({ statuses, billable, estimate }) => {
    const { billable: b, estimate: e } = splitBillable(statuses.map((status, i) => ({ id: String(i), status })));
    expect(b.length).toBe(billable);
    expect(e.length).toBe(estimate);
  });
});
