/**
 * useInitializeDentition — TanStack Query mutation for dentition auto-population (TR-P1-07)
 *
 * API: POST /dental/patients/:patientId/dentition
 * Backend picks deciduous / mixed / permanent from the patient's date of birth and
 * seeds the visit's dental chart. On success: invalidates ['getDentalChart', visitId]
 * so the freshly-populated chart re-renders.
 *
 * Used by the workspace chart empty-state action — see TimelineCarousel.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { initializeDentition } from '@monobase/sdk-ts/generated';
import { getDentalChartQueryKey } from '@monobase/sdk-ts/generated/react-query';
import { toast } from 'sonner';
import { toastError } from '@/lib/error-toast';

interface InitializeDentitionInput {
  patientId: string;
  visitId: string;
  /** ISO date string — backend derives dentition type by age. */
  dateOfBirth: string;
}

export function useInitializeDentition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InitializeDentitionInput): Promise<unknown> => {
      const { data } = await initializeDentition({
        path: { patientId: input.patientId },
        body: { dateOfBirth: input.dateOfBirth, visitId: input.visitId },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: getDentalChartQueryKey({ path: { visitId: input.visitId } }),
      });
      toast.success('Dental chart initialized.');
    },
    onError: (err) => {
      toastError(err, 'Failed to initialize dentition. Please try again.');
    },
  });
}
