/**
 * useCreateVisit -- TanStack Query mutation for creating a new dental visit
 *
 * Replaces the inline fetch in handleNewVisit() in $patientId.tsx.
 * API: POST /dental/visits
 * On success: invalidates listDentalVisits query so the timeline refreshes.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDentalVisit } from '@monobase/sdk-ts/generated';
import { listDentalVisitsQueryKey } from '@monobase/sdk-ts/generated/react-query';
import { toast } from 'sonner';

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
      const { data } = await createDentalVisit({
        body: input as Parameters<typeof createDentalVisit>[0]['body'],
        throwOnError: true,
      });
      return data as unknown as CreatedVisit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listDentalVisitsQueryKey({ query: { patientId } }),
      });
    },
    // V-FE-ERR-001: hook-level error surface so a failed create isn't swallowed
    // when a call site forgets its own .catch.
    onError: () => {
      toast.error('Failed to create visit. Please try again.');
    },
  });
}
