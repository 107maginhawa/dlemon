/**
 * StaffList component tests -- pure logic helpers
 *
 * Tests: formatRole, getRoleBadgeClass, canDeactivate
 */

import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MemberRole = 'dentist_owner' | 'dentist_associate' | 'staff_full' | 'staff_scheduling';

// ---------------------------------------------------------------------------
// Pure logic helpers (mirrors what the component exports)
// ---------------------------------------------------------------------------

function formatRole(role: string): string {
  const map: Record<string, string> = {
    dentist_owner: 'Dentist-Owner',
    dentist_associate: 'Associate Dentist',
    staff_full: 'Staff - Full Operations',
    staff_scheduling: 'Staff - Scheduling',
  };
  return map[role] ?? role;
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'dentist_owner':
      return 'bg-amber-100 text-amber-800';
    case 'dentist_associate':
      return 'bg-blue-100 text-blue-700';
    case 'staff_full':
      return 'bg-green-100 text-green-700';
    case 'staff_scheduling':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-gray-100 text-gray-500';
  }
}

function canDeactivate(memberRole: MemberRole, currentUserRole: MemberRole): boolean {
  // Only dentist_owner can manage staff
  if (currentUserRole !== 'dentist_owner') return false;
  // Owner cannot deactivate themselves
  if (memberRole === 'dentist_owner') return false;
  return true;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StaffList -- formatRole', () => {
  test('formatRole("dentist_owner") === "Dentist-Owner"', () => {
    expect(formatRole('dentist_owner')).toBe('Dentist-Owner');
  });

  test('formatRole("dentist_associate") === "Associate Dentist"', () => {
    expect(formatRole('dentist_associate')).toBe('Associate Dentist');
  });

  test('formatRole("staff_full") === "Staff - Full Operations"', () => {
    expect(formatRole('staff_full')).toBe('Staff - Full Operations');
  });

  test('formatRole("staff_scheduling") === "Staff - Scheduling"', () => {
    expect(formatRole('staff_scheduling')).toBe('Staff - Scheduling');
  });
});

describe('StaffList -- getRoleBadgeClass', () => {
  test('getRoleBadgeClass("dentist_owner") includes "bg-amber"', () => {
    expect(getRoleBadgeClass('dentist_owner')).toContain('bg-amber');
  });

  test('getRoleBadgeClass("dentist_associate") includes "bg-blue"', () => {
    expect(getRoleBadgeClass('dentist_associate')).toContain('bg-blue');
  });

  test('getRoleBadgeClass("staff_full") includes "bg-green"', () => {
    expect(getRoleBadgeClass('staff_full')).toContain('bg-green');
  });

  test('getRoleBadgeClass("staff_scheduling") includes "bg-purple"', () => {
    expect(getRoleBadgeClass('staff_scheduling')).toContain('bg-purple');
  });
});

describe('StaffList -- canDeactivate', () => {
  test('canDeactivate("dentist_associate", "dentist_owner") === true', () => {
    expect(canDeactivate('dentist_associate', 'dentist_owner')).toBe(true);
  });

  test('canDeactivate("dentist_owner", "dentist_owner") === false (cannot deactivate owner)', () => {
    expect(canDeactivate('dentist_owner', 'dentist_owner')).toBe(false);
  });

  test('canDeactivate("staff_full", "dentist_associate") === false (only owner can manage)', () => {
    expect(canDeactivate('staff_full', 'dentist_associate')).toBe(false);
  });

  test('canDeactivate("staff_full", "dentist_owner") === true', () => {
    expect(canDeactivate('staff_full', 'dentist_owner')).toBe(true);
  });

  test('canDeactivate("staff_scheduling", "staff_full") === false', () => {
    expect(canDeactivate('staff_scheduling', 'staff_full')).toBe(false);
  });
});
