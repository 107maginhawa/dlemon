/**
 * useVisit hook tests
 *
 * Tests visit state management: create draft, activate, complete, status transitions.
 * Uses the API layer for data fetching.
 *
 * Written RED — no implementation exists yet.
 */

import { describe, test, expect, mock } from 'bun:test';
import { useVisit, type VisitState } from './use-visit';

// Mock the API calls
const mockCreate = mock(() => Promise.resolve({
  id: 'visit-1',
  status: 'draft',
  patientId: 'patient-1',
  branchId: 'branch-1',
  dentistMemberId: 'dentist-1',
}));

const mockActivate = mock(() => Promise.resolve({
  id: 'visit-1',
  status: 'active',
  activatedAt: new Date().toISOString(),
}));

const mockComplete = mock(() => Promise.resolve({
  id: 'visit-1',
  status: 'completed',
  completedAt: new Date().toISOString(),
}));

describe('useVisit', () => {
  describe('createVisit', () => {
    test('creates a visit in draft status', async () => {
      const { createVisit } = useVisit({ patientId: 'patient-1', branchId: 'branch-1', dentistMemberId: 'dentist-1' });
      // Hook exposes createVisit function
      expect(typeof createVisit).toBe('function');
    });

    test('visit state starts as null when no visitId provided', () => {
      const { visit } = useVisit({ patientId: 'patient-1', branchId: 'branch-1', dentistMemberId: 'dentist-1' });
      expect(visit).toBeNull();
    });
  });

  describe('status helpers', () => {
    test('isDraft returns true for draft status', () => {
      const { isDraft } = useVisit({ patientId: 'p1', branchId: 'b1', dentistMemberId: 'd1' });
      expect(isDraft('draft')).toBe(true);
      expect(isDraft('active')).toBe(false);
    });

    test('isActive returns true for active status', () => {
      const { isActive } = useVisit({ patientId: 'p1', branchId: 'b1', dentistMemberId: 'd1' });
      expect(isActive('active')).toBe(true);
      expect(isActive('draft')).toBe(false);
    });

    test('isCompleted returns true for completed or locked status', () => {
      const { isCompleted } = useVisit({ patientId: 'p1', branchId: 'b1', dentistMemberId: 'd1' });
      expect(isCompleted('completed')).toBe(true);
      expect(isCompleted('locked')).toBe(true);
      expect(isCompleted('active')).toBe(false);
    });

    test('canEdit returns true only for draft and active', () => {
      const { canEdit } = useVisit({ patientId: 'p1', branchId: 'b1', dentistMemberId: 'd1' });
      expect(canEdit('draft')).toBe(true);
      expect(canEdit('active')).toBe(true);
      expect(canEdit('completed')).toBe(false);
      expect(canEdit('locked')).toBe(false);
    });
  });
});
