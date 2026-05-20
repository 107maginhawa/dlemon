/**
 * useSaveTreatment -- TanStack Query mutation for adding a treatment to a visit
 *
 * Replaces the second (conditional) fetch in handleSaveToothData() in $patientId.tsx.
 * API: POST /dental/visits/:visitId/treatments
 * On success: invalidates listDentalTreatments query so the treatment table refreshes.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDentalTreatment, type ToothSurfaceCode } from '@monobase/sdk-ts/generated';
import { listDentalTreatmentsQueryKey } from '@monobase/sdk-ts/generated/react-query';

interface SaveTreatmentInput {
  visitId: string;
  patientId: string;
  cdtCode: string;
  description: string;
  toothNumber: number;
  surfaces: ToothSurfaceCode[];
  conditionCode?: string;
  priceAmount: number;
  currency: string;
  clinicalNotes?: string;
}

export function useSaveTreatment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveTreatmentInput): Promise<unknown> => {
      const { visitId, patientId, priceAmount, currency: _currency, clinicalNotes, ...rest } = input;
      const { data } = await createDentalTreatment({
        path: { visitId },
        body: {
          visitId,
          patientId,
          priceCents: Math.round(priceAmount * 100), // dollars → cents (int32, matches DB integer type)
          clinicalNotes,
          ...rest,
        },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: listDentalTreatmentsQueryKey({ path: { visitId: input.visitId } }),
      });
      // Also invalidate the patient-level treatment plan so the Treatment Plan
      // sheet shows fresh data immediately after save (avoids stale-cache empty state).
      queryClient.invalidateQueries({
        queryKey: ['dental-treatment-plan', input.patientId],
      });
    },
  });
}
