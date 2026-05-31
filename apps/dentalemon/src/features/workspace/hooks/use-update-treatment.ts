/**
 * useUpdateTreatment — TanStack Query mutation for updating a dental treatment
 *
 * Wraps updateDentalTreatmentMutation from the SDK.
 * On success: invalidates listDentalTreatments so the treatment table refreshes.
 *
 * API: PATCH /dental/visits/:visitId/treatments/:treatmentId
 *
 * Call site example:
 *   mutation.mutate({
 *     path: { visitId, treatmentId },
 *     body: { status: 'dismissed', dismissReason: reason },
 *   });
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateDentalTreatmentMutation,
  listDentalTreatmentsQueryKey,
} from '@monobase/sdk-ts/generated/react-query';
import { toastError } from '@/lib/error-toast';

export function useUpdateTreatment(visitId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    ...updateDentalTreatmentMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listDentalTreatmentsQueryKey({ path: { visitId } }),
      });
    },
    onError: (err) => {
      toastError(err, 'Failed to update treatment. Please try again.');
    },
  });
}
