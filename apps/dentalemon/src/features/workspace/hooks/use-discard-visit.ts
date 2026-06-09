/**
 * useDiscardVisit — owner "Discard visit" escape hatch.
 *
 *   POST /dental/visits/{visitId}/discard { reason }   (owner-only, reason required)
 *
 * Abandons an open visit that carries no durable clinical/financial/legal artifact
 * (active/draft → discarded), dismissing its pending treatments — so a patient
 * wedged behind the one-active-visit rule is freed ("…complete OR discard it
 * first"). Invalidates the visits query so the discarded visit drops out (filtered
 * in use-visits) and New Visit re-enables.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  discardVisitMutation,
  listDentalVisitsQueryKey,
} from '@monobase/sdk-ts/generated/react-query';
import { toastError } from '@/lib/error-toast';

export function useDiscardVisit(patientId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...discardVisitMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listDentalVisitsQueryKey({ query: { patientId } }),
      });
    },
    onError: (err) => {
      toastError(err, 'Failed to discard visit. Please try again.');
    },
  });

  return {
    discard: (visitId: string, reason: string) =>
      mutation.mutateAsync({ path: { visitId }, body: { reason } }),
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error as Error | null,
    reset: mutation.reset,
  };
}
