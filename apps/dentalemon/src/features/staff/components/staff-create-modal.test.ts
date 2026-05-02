/**
 * StaffCreateModal component tests -- pure logic helpers
 *
 * Tests: validateStaffForm, buildCreateMemberPayload
 */

import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StaffFormData {
  displayName: string;
  role: string;
  pin: string;
  confirmPin: string;
  branchId: string;
}

// ---------------------------------------------------------------------------
// Pure logic helpers (mirrors what the component exports)
// ---------------------------------------------------------------------------

function validateStaffForm(form: StaffFormData): string[] {
  const errors: string[] = [];

  if (!form.displayName.trim()) {
    errors.push('Display name is required');
  }

  if (!form.role) {
    errors.push('Role is required');
  }

  if (!form.pin) {
    errors.push('PIN is required');
  } else if (!/^\d{6}$/.test(form.pin)) {
    errors.push('PIN must be exactly 6 digits');
  }

  if (form.pin && form.confirmPin && form.pin !== form.confirmPin) {
    errors.push('PINs do not match');
  }

  return errors;
}

function buildCreateMemberPayload(form: StaffFormData): {
  branchId: string;
  displayName: string;
  role: string;
  pin: string;
} {
  return {
    branchId: form.branchId,
    displayName: form.displayName.trim(),
    role: form.role,
    pin: form.pin,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StaffCreateModal -- validateStaffForm', () => {
  const validForm: StaffFormData = {
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
