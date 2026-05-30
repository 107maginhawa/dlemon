/**
 * deriveTreatmentPlanStatus — TP-BR-005 derivation rule (TR-P1-08)
 *
 * Pure, DB-free unit tests for the item-status → plan-status derivation.
 */
import { describe, test, expect } from 'bun:test';
import { deriveTreatmentPlanStatus } from './treatment-plan.schema';

describe('deriveTreatmentPlanStatus (TP-BR-005)', () => {
  test('all items done → completed', () => {
    expect(deriveTreatmentPlanStatus('approved', ['performed', 'verified'])).toBe('completed');
  });

  test('TP-BR-005: completing ONE of several items does NOT complete the plan', () => {
    // one performed, one still planned → partially_completed, never completed
    expect(deriveTreatmentPlanStatus('approved', ['performed', 'planned'])).toBe('partially_completed');
  });

  test('no items done yet → stays approved', () => {
    expect(deriveTreatmentPlanStatus('approved', ['planned', 'diagnosed'])).toBe('approved');
  });

  test('dismissed/declined items are excluded from the denominator', () => {
    // the only non-excluded item is performed → completed
    expect(deriveTreatmentPlanStatus('approved', ['performed', 'dismissed', 'declined'])).toBe('completed');
  });

  test('a plan with only dismissed/declined items does not auto-complete', () => {
    expect(deriveTreatmentPlanStatus('approved', ['dismissed', 'declined'])).toBe('approved');
  });

  test('an empty plan (no items) does not auto-complete', () => {
    expect(deriveTreatmentPlanStatus('approved', [])).toBe('approved');
  });

  test('verified counts as done', () => {
    expect(deriveTreatmentPlanStatus('partially_completed', ['verified', 'verified'])).toBe('completed');
  });

  test('never touches a draft/presented/cancelled plan', () => {
    expect(deriveTreatmentPlanStatus('draft', ['performed'])).toBe('draft');
    expect(deriveTreatmentPlanStatus('presented', ['performed'])).toBe('presented');
    expect(deriveTreatmentPlanStatus('cancelled', ['performed'])).toBe('cancelled');
  });
});
