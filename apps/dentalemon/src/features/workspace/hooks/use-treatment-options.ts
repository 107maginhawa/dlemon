/**
 * useTreatmentOptions — P1-19 alternate-case option groups
 *
 * Presents mutually-exclusive treatment options (e.g. implant vs bridge), one
 * markable as recommended, and lets the user accept one — which declines its
 * linked alternates server-side.
 *
 * API: GET  /dental/patients/:patientId/treatment-options/:optionGroupId
 *      POST /dental/patients/:patientId/treatment-options/:optionGroupId/accept
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listTreatmentOptionGroupOptions,
  listTreatmentOptionGroupQueryKey,
  acceptTreatmentOptionMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type {
  DentalPatientFinanceModuleTreatmentOptionGroup,
  DentalPatientFinanceModuleTreatmentOption,
} from '@monobase/sdk-ts/generated';

// Re-export SDK types under the original public names so consumers stay green.
export type TreatmentOption = DentalPatientFinanceModuleTreatmentOption;
export type TreatmentOptionGroup = DentalPatientFinanceModuleTreatmentOptionGroup;

export function useTreatmentOptions(patientId: string, optionGroupId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    ...listTreatmentOptionGroupOptions({ path: { patientId, optionGroupId } }),
    enabled: Boolean(patientId && optionGroupId),
    staleTime: 30_000,
    select: (data): TreatmentOptionGroup | undefined => {
      // SDK response is DentalPatientFinanceModuleTreatmentOptionGroup | ErrorResponse.
      // Narrow to the group branch; ErrorResponse lacks an 'optionGroupId' field.
      if (data && typeof data === 'object' && 'optionGroupId' in data) {
        return data as TreatmentOptionGroup;
      }
      return undefined;
    },
  });

  const accept = useMutation({
    ...acceptTreatmentOptionMutation(),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: listTreatmentOptionGroupQueryKey({ path: { patientId, optionGroupId } }),
      });
    },
  });

  return {
    optionGroup: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    acceptOption: (chosenTreatmentId: string) =>
      accept.mutate({ path: { patientId, optionGroupId }, body: { chosenTreatmentId } }),
    isAccepting: accept.isPending,
  };
}
