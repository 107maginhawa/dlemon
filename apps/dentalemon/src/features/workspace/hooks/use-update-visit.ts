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

export function useUpdateVisit(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    ...updateDentalVisitMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listDentalVisitsQueryKey({ query: { patientId } }),
      });
    },
  });
}
