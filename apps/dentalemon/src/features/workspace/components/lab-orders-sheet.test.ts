/**
 * LabOrdersSheet component tests
 *
 * Tests: form validation, status display labels, valid/invalid transitions.
 */

import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Pure logic helpers
// ---------------------------------------------------------------------------

type LabOrderStatus = 'ordered' | 'inFabrication' | 'delivered' | 'fitted' | 'cancelled';

const STATUS_LABELS: Record<LabOrderStatus, string> = {
  ordered: 'Ordered',
  inFabrication: 'In Fabrication',
  delivered: 'Delivered',
  fitted: 'Fitted',
  cancelled: 'Cancelled',
};

const VALID_TRANSITIONS: Record<LabOrderStatus, LabOrderStatus[]> = {
  ordered: ['inFabrication', 'cancelled'],
  inFabrication: ['delivered', 'cancelled'],
  delivered: ['fitted', 'cancelled'],
  fitted: [],
  cancelled: [],
};

interface CreateLabOrderForm {
  labName: string;
  description: string;
  expectedDeliveryDate: string;
}

function validateCreateLabOrder(form: CreateLabOrderForm): string[] {
  const errors: string[] = [];
  if (!form.labName.trim()) errors.push('labName is required');
  if (!form.description.trim()) errors.push('description is required');
  return errors;
}

function canTransition(from: LabOrderStatus, to: LabOrderStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

function getStatusLabel(status: LabOrderStatus): string {
  return STATUS_LABELS[status];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LabOrdersSheet — create form validation', () => {
  const valid: CreateLabOrderForm = {
    labName: 'Precision Dental Lab',
    description: 'PFM Crown tooth 21',
    expectedDeliveryDate: '2025-12-01',
  };

  test('valid form produces no errors', () => {
    expect(validateCreateLabOrder(valid)).toHaveLength(0);
  });

  test('missing labName produces error', () => {
    const errors = validateCreateLabOrder({ ...valid, labName: '' });
    expect(errors).toContain('labName is required');
  });

  test('missing description produces error', () => {
    const errors = validateCreateLabOrder({ ...valid, description: '' });
    expect(errors).toContain('description is required');
  });

  test('expectedDeliveryDate is optional', () => {
    const errors = validateCreateLabOrder({ ...valid, expectedDeliveryDate: '' });
    expect(errors).toHaveLength(0);
  });
});

describe('LabOrdersSheet — status labels', () => {
  test('ordered displays correctly', () => {
    expect(getStatusLabel('ordered')).toBe('Ordered');
  });

  test('inFabrication displays with spaces', () => {
    expect(getStatusLabel('inFabrication')).toBe('In Fabrication');
  });

  test('delivered displays correctly', () => {
    expect(getStatusLabel('delivered')).toBe('Delivered');
  });

  test('fitted displays correctly', () => {
    expect(getStatusLabel('fitted')).toBe('Fitted');
  });

  test('cancelled displays correctly', () => {
    expect(getStatusLabel('cancelled')).toBe('Cancelled');
  });
});

describe('LabOrdersSheet — transition validation', () => {
  test('ordered → inFabrication allowed', () => {
    expect(canTransition('ordered', 'inFabrication')).toBe(true);
  });

  test('ordered → delivered not allowed (skip)', () => {
    expect(canTransition('ordered', 'delivered')).toBe(false);
  });

  test('inFabrication → delivered allowed', () => {
    expect(canTransition('inFabrication', 'delivered')).toBe(true);
  });

  test('delivered → fitted allowed', () => {
    expect(canTransition('delivered', 'fitted')).toBe(true);
  });

  test('fitted → cancelled not allowed (terminal)', () => {
    expect(canTransition('fitted', 'cancelled')).toBe(false);
  });

  test('cancelled → ordered not allowed (backward)', () => {
    expect(canTransition('cancelled', 'ordered')).toBe(false);
  });

  test('any status can go to cancelled except fitted', () => {
    expect(canTransition('ordered', 'cancelled')).toBe(true);
    expect(canTransition('inFabrication', 'cancelled')).toBe(true);
    expect(canTransition('delivered', 'cancelled')).toBe(true);
    expect(canTransition('fitted', 'cancelled')).toBe(false);
  });
});
