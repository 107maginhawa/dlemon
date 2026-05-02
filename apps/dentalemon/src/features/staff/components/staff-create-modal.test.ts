/**
 * StaffCreateModal component tests -- pure logic helpers
 *
 * Tests: validateStaffForm, buildCreateMemberPayload
 */

import { describe, test, expect } from 'bun:test';
import { validateStaffForm, buildCreateMemberPayload } from './staff-create-modal';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StaffCreateModal -- validateStaffForm', () => {
  const validForm = {
    displayName: 'Dr. Test',
    role: 'staff_full',
    pin: '123456',
    confirmPin: '123456',
    branchId: '00000000-0000-4000-8000-000000000001',
  };

  test('missing displayName produces error', () => {
    const errors = validateStaffForm({ ...validForm, displayName: '' });
    expect(errors).toContain('Display name is required');
  });

  test('whitespace-only displayName produces error', () => {
    const errors = validateStaffForm({ ...validForm, displayName: '   ' });
    expect(errors).toContain('Display name is required');
  });

  test('missing role produces error', () => {
    const errors = validateStaffForm({ ...validForm, role: '' });
    expect(errors).toContain('Role is required');
  });

  test('missing PIN produces error', () => {
    const errors = validateStaffForm({ ...validForm, pin: '' });
    expect(errors).toContain('PIN is required');
  });

  test('PIN not 6 digits produces error', () => {
    const errors = validateStaffForm({ ...validForm, pin: '1234' });
    expect(errors).toContain('PIN must be exactly 6 digits');
  });

  test('non-numeric PIN produces error', () => {
    const errors = validateStaffForm({ ...validForm, pin: 'abcdef' });
    expect(errors).toContain('PIN must be exactly 6 digits');
  });

  test('PIN mismatch produces error', () => {
    const errors = validateStaffForm({ ...validForm, pin: '123456', confirmPin: '654321' });
    expect(errors).toContain('PINs do not match');
  });

  test('valid form produces no errors', () => {
    const errors = validateStaffForm(validForm);
    expect(errors.length).toBe(0);
  });
});

describe('StaffCreateModal -- buildCreateMemberPayload', () => {
  test('trims displayName', () => {
    const payload = buildCreateMemberPayload({
      displayName: '  Dr. Spaces  ',
      role: 'staff_full',
      pin: '123456',
      confirmPin: '123456',
      branchId: 'branch-1',
    });
    expect(payload.displayName).toBe('Dr. Spaces');
  });

  test('includes role and branchId', () => {
    const payload = buildCreateMemberPayload({
      displayName: 'Staff Member',
      role: 'dentist_associate',
      pin: '654321',
      confirmPin: '654321',
      branchId: 'branch-abc',
    });
    expect(payload.role).toBe('dentist_associate');
    expect(payload.branchId).toBe('branch-abc');
    expect(payload.pin).toBe('654321');
  });
});
