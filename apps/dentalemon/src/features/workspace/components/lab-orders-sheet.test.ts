/**
 * LabOrdersSheet — pure-logic unit tests
 *
 * Tests: form validation, status labels, and NEXT_STATUS transitions
 * against real production exports (not local reimplementations).
 */

import { describe, test, expect } from 'bun:test';
import {
  validateLabOrderForm,
  STATUS_LABELS,
  NEXT_STATUS,
  labOrderDueState,
} from './lab-orders-sheet';

describe('validateLabOrderForm', () => {
  const valid = { labName: 'Precision Dental Lab', description: 'PFM Crown tooth 21' };

  test('valid form produces no errors', () => {
    expect(validateLabOrderForm(valid)).toHaveLength(0);
  });

  test('missing labName — exact production error message', () => {
    const errors = validateLabOrderForm({ ...valid, labName: '' });
    expect(errors).toContain('Lab name is required');
  });

  test('whitespace-only labName is rejected', () => {
    expect(validateLabOrderForm({ ...valid, labName: '   ' })).toContain('Lab name is required');
  });

  test('missing description — exact production error message', () => {
    const errors = validateLabOrderForm({ ...valid, description: '' });
    expect(errors).toContain('Description is required');
  });

  test('both missing returns two errors', () => {
    expect(validateLabOrderForm({ labName: '', description: '' })).toHaveLength(2);
  });
});

describe('STATUS_LABELS', () => {
  test('all five statuses have labels', () => {
    const statuses = ['ordered', 'in_fabrication', 'delivered', 'fitted', 'cancelled'] as const;
    for (const s of statuses) {
      expect(STATUS_LABELS[s]!.length, `STATUS_LABELS["${s}"] should be a non-empty string`).toBeGreaterThan(0);
    }
  });

  test('in_fabrication (not inFabrication) maps to readable label', () => {
    expect(STATUS_LABELS['in_fabrication']).toBe('In Fabrication');
  });

  test('fitted maps to Fitted', () => {
    expect(STATUS_LABELS['fitted']).toBe('Fitted');
  });
});

describe('NEXT_STATUS (linear advance chain)', () => {
  test('ordered advances to in_fabrication', () => {
    expect(NEXT_STATUS['ordered']).toBe('in_fabrication');
  });

  test('in_fabrication advances to delivered', () => {
    expect(NEXT_STATUS['in_fabrication']).toBe('delivered');
  });

  test('delivered advances to fitted', () => {
    expect(NEXT_STATUS['delivered']).toBe('fitted');
  });

  test('fitted is terminal (null)', () => {
    expect(NEXT_STATUS['fitted']).toBeNull();
  });

  test('cancelled is terminal (null)', () => {
    expect(NEXT_STATUS['cancelled']).toBeNull();
  });

  test('no status advances to cancelled via NEXT_STATUS (cancellation is a separate action)', () => {
    const values = Object.values(NEXT_STATUS);
    expect(values).not.toContain('cancelled');
  });
});

describe('labOrderDueState (P2-12 due-date indicator)', () => {
  const now = new Date('2026-06-01T00:00:00Z');

  test('returns null when no due date', () => {
    expect(labOrderDueState(undefined, 'ordered', now)).toBeNull();
    expect(labOrderDueState(null, 'ordered', now)).toBeNull();
  });

  test('flags a past due date on an active order as overdue', () => {
    const state = labOrderDueState('2026-05-01T00:00:00Z', 'in_fabrication', now);
    expect(state!.overdue).toBe(true);
  });

  test('a future due date is not overdue', () => {
    const state = labOrderDueState('2026-07-01T00:00:00Z', 'ordered', now);
    expect(state!.overdue).toBe(false);
  });

  test('a past due date on a terminal order is not flagged overdue', () => {
    expect(labOrderDueState('2026-05-01T00:00:00Z', 'fitted', now)!.overdue).toBe(false);
    expect(labOrderDueState('2026-05-01T00:00:00Z', 'cancelled', now)!.overdue).toBe(false);
  });

  test('returns null for an unparseable date', () => {
    expect(labOrderDueState('not-a-date', 'ordered', now)).toBeNull();
  });
});
