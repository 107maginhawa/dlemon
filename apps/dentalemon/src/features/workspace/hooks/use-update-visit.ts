/**
 * useUpdateVisit — TanStack Query mutation for updating a dental visit
 *
 * Wraps updateDentalVisitMutation from the SDK.
 * On success: invalidates listDentalVisits so the timeline carousel refreshes.
 *
 * API: PATCH /dental/visits/:visitId
 *
 * Call site example:
 *   mutation.mutate({
 *     path: { visitId },
 *     body: { status: 'completed' },
 *   });
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateDentalVisitMutation,
  listDentalVisitsQueryKey,
} from '@monobase/sdk-ts/generated/react-query';
import { toastError } from '@/lib/error-toast';

export function useUpdateVisit(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    ...updateDentalVisitMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listDentalVisitsQueryKey({ query: { patientId } }),
      });
    },
    // V-FE-ERR-001: surface failures (e.g. lock conflict) instead of swallowing
    // them silently. Call sites such as TimelineCarousel's lock action have no
    // per-call .catch, so the hook-level handler is the safety net.
    onError: (err) => {
      toastError(err, 'Failed to update visit. Please try again.');
    },
  });
}
