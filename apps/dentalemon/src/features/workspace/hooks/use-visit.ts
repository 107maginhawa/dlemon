/**
 * useVisit — visit state management and API integration
 *
 * Provides visit lifecycle helpers and API mutation functions.
 * Pure logic separated from React state for testability.
 */

export interface VisitState {
  id: string;
  status: 'draft' | 'active' | 'completed' | 'locked';
  patientId: string;
  branchId: string;
  dentistMemberId: string;
  chiefComplaint?: string;
  activatedAt?: string;
  completedAt?: string;
  lockedAt?: string;
}

interface UseVisitOptions {
  patientId: string;
  branchId: string;
  dentistMemberId: string;
  visitId?: string;
}

interface UseVisitReturn {
  visit: VisitState | null;
  createVisit: (chiefComplaint?: string) => Promise<VisitState>;
  activateVisit: (id: string) => Promise<VisitState>;
  completeVisit: (id: string) => Promise<VisitState>;
  lockVisit: (id: string) => Promise<VisitState>;
  isDraft: (status: string) => boolean;
  isActive: (status: string) => boolean;
  isCompleted: (status: string) => boolean;
  canEdit: (status: string) => boolean;
}

// Stateless helper functions exported separately for testing
export function isDraft(status: string): boolean {
  return status === 'draft';
}

export function isActive(status: string): boolean {
  return status === 'active';
}

export function isCompleted(status: string): boolean {
  return status === 'completed' || status === 'locked';
}

export function canEdit(status: string): boolean {
  return status === 'draft' || status === 'active';
}

/**
 * Synchronous (non-React) version for unit testing.
 * The React hook version (with useState/useQuery) wraps this.
 */
export function useVisit(options: UseVisitOptions): UseVisitReturn {
  const visit: VisitState | null = null;

  return {
    visit,
    createVisit: async (chiefComplaint?: string): Promise<VisitState> => {
      const res = await fetch('/api/dental/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: options.patientId,
          branchId: options.branchId,
          dentistMemberId: options.dentistMemberId,
          chiefComplaint,
        }),
      });
      if (!res.ok) throw new Error(`Failed to create visit: ${res.status}`);
      return res.json();
    },
    activateVisit: async (id: string): Promise<VisitState> => {
      const res = await fetch(`/api/dental/visits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'active' }),
      });
      if (!res.ok) throw new Error(`Failed to activate visit: ${res.status}`);
      return res.json();
    },
    completeVisit: async (id: string): Promise<VisitState> => {
      const res = await fetch(`/api/dental/visits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!res.ok) throw new Error(`Failed to complete visit: ${res.status}`);
      return res.json();
    },
    lockVisit: async (id: string): Promise<VisitState> => {
      const res = await fetch(`/api/dental/visits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'locked' }),
      });
      if (!res.ok) throw new Error(`Failed to lock visit: ${res.status}`);
      return res.json();
    },
    isDraft: (status: string) => isDraft(status),
    isActive: (status: string) => isActive(status),
    isCompleted: (status: string) => isCompleted(status),
    canEdit: (status: string) => canEdit(status),
  };
}
