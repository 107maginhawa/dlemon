/**
 * useCreateVisit -- TanStack Query mutation for creating a new dental visit
 *
 * Replaces the inline fetch in handleNewVisit() in $patientId.tsx.
 * API: POST /dental/visits
 * On success: invalidates listDentalVisits query so the timeline refreshes.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDentalVisit, type CreateDentalVisitRequest } from '@monobase/sdk-ts/generated';
import { listDentalVisitsQueryKey } from '@monobase/sdk-ts/generated/react-query';
import { toastError } from '@/lib/error-toast';

// Cause-fix (oli QA_ESCAPES §6): consume the SDK request type (the FE input is a
// subset — patientId/branchId/dentistMemberId are all required) and let the SDK
// response (DentalVisit) flow through. The previous `as Parameters<…>['body']` +
// `as unknown as CreatedVisit` casts disabled tsc at both ends.
type CreateVisitInput = Pick<CreateDentalVisitRequest, 'patientId' | 'branchId' | 'dentistMemberId'>;

export function useCreateVisit(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVisitInput) => {
      const { data } = await createDentalVisit({ body: input, throwOnError: true });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listDentalVisitsQueryKey({ query: { patientId } }),
      });
    },
    // V-FE-ERR-001: hook-level error surface so a failed create isn't swallowed
    // when a call site forgets its own .catch.
    onError: (err) => {
      toastError(err, 'Failed to create visit. Please try again.');
    },
  });
}
