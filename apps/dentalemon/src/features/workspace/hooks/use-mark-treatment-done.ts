/**
 * useMarkTreatmentDone
 *
 * Status-aware two-step Mark-Done (FIX-01):
 *   diagnosed → PATCH {status:'planned'} then PATCH {status:'performed'}
 *   planned   → PATCH {status:'performed'} (single step)
 *   performed/verified → no-op
 *
 * Partial-failure is self-healing: if PATCH#1 succeeds and PATCH#2 fails,
 * treatment lands in 'planned' — re-clicking Mark-Done completes it.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDentalTreatment } from '@monobase/sdk-ts/generated';
import { listDentalTreatmentsQueryKey } from '@monobase/sdk-ts/generated/react-query';

type TreatmentStatus = 'diagnosed' | 'planned' | 'performed' | 'verified' | 'dismissed';

interface MarkDoneVariables {
  treatmentId: string;
  visitId: string;
  currentStatus: TreatmentStatus;
}

export function useMarkTreatmentDone() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ treatmentId, visitId, currentStatus }: MarkDoneVariables) => {
      if (!visitId) throw new Error('visitId is required');
      if (currentStatus === 'performed' || currentStatus === 'verified') return null;

      if (currentStatus === 'diagnosed') {
        await updateDentalTreatment({
          path: { visitId, treatmentId },
          body: { status: 'planned' },
          throwOnError: true,
        });
      }

      const { data } = await updateDentalTreatment({
        path: { visitId, treatmentId },
        body: { status: 'performed' },
        throwOnError: true,
      });
      return data ?? null;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: listDentalTreatmentsQueryKey({ path: { visitId: variables.visitId } }),
      });
    },
  });

  return {
    markDone: (treatmentId: string, visitId: string, currentStatus: TreatmentStatus) =>
      mutation.mutate({ treatmentId, visitId, currentStatus }),
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
  };
}
