/**
 * useMarkTreatmentDone
 *
 * Marks a treatment as performed via:
 *   PATCH /dental/visits/:visitId/treatments/:treatmentId
 *   body: { status: 'performed' }
 *
 * On success invalidates listDentalTreatments so TreatmentTable refreshes.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDentalTreatment } from '@monobase/sdk-ts/generated';
import { listDentalTreatmentsQueryKey } from '@monobase/sdk-ts/generated/react-query';

interface MarkDoneVariables {
  treatmentId: string;
}

export function useMarkTreatmentDone(visitId: string | null) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ treatmentId }: MarkDoneVariables) => {
      if (!visitId) throw new Error('visitId is required');
      const { data } = await updateDentalTreatment({
        path: { visitId, treatmentId },
        body: { status: 'performed' },
      });
      if (!data) throw new Error('No data returned');
      return data;
    },
    onSuccess: () => {
      if (visitId) {
        queryClient.invalidateQueries({
          queryKey: listDentalTreatmentsQueryKey({ path: { visitId } }),
        });
      }
    },
  });

  return {
    markDone: (treatmentId: string) => mutation.mutate({ treatmentId }),
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
  };
}
