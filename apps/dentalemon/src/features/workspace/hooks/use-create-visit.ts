/**
 * useCreateVisit -- TanStack Query mutation for creating a new dental visit
 *
 * Replaces the inline fetch in handleNewVisit() in $patientId.tsx.
 * API: POST /dental/visits
 * On success: invalidates ['dental-visits', patientId] so the timeline refreshes.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

interface CreateVisitInput {
  patientId: string;
  branchId: string;
  dentistMemberId: string;
}

interface CreatedVisit {
  id: string;
  patientId: string;
  status: 'draft' | 'active' | 'completed' | 'locked';
  createdAt: string;
}

export function useCreateVisit(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVisitInput): Promise<CreatedVisit> => {
      const res = await fetch(`${apiBaseUrl}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Failed to create visit: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dental-visits', patientId] });
    },
  });
}
