/**
 * useRecalls — fetch/create/update patient recalls
 *
 * API: GET  /dental/patients/:patientId/recalls
 *      POST /dental/patients/:patientId/recalls
 *      PATCH /dental/patients/:patientId/recalls/:recallId
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listPatientRecallsOptions,
  listPatientRecallsQueryKey,
  createRecallMutation,
  updateRecallMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type {
  DentalPatientEngagementModuleRecall,
  DentalPatientEngagementModuleCreateRecallRequest,
  DentalPatientEngagementModuleUpdateRecallRequest,
} from '@monobase/sdk-ts/generated';

// Re-export SDK types under the original public names so consumers stay green.
export type RecallStatus = DentalPatientEngagementModuleRecall['status'];
export type RecallType = DentalPatientEngagementModuleRecall['type'];
export type DentalRecall = DentalPatientEngagementModuleRecall;
export type CreateRecallBody = DentalPatientEngagementModuleCreateRecallRequest;
export type UpdateRecallBody = DentalPatientEngagementModuleUpdateRecallRequest;

export function useRecalls(patientId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    ...listPatientRecallsOptions({ path: { patientId } }),
    enabled: Boolean(patientId),
    staleTime: 30_000,
    select: (data): DentalRecall[] => {
      // SDK response is Array<DentalPatientEngagementModuleRecall> | ErrorResponse.
      // Narrow to the array branch; ErrorResponse is a non-array object.
      // Also handle paginated wrapper { data: [...] } from the server.
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) {
        return (data as { data: DentalRecall[] }).data;
      }
      return [];
    },
  });

  const createRecall = useMutation({
    ...createRecallMutation(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listPatientRecallsQueryKey({ path: { patientId } }) });
    },
  });

  const updateRecall = useMutation({
    ...updateRecallMutation(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listPatientRecallsQueryKey({ path: { patientId } }) });
    },
  });

  return {
    recalls: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    createRecall: (body: CreateRecallBody) =>
      createRecall.mutate({ path: { patientId }, body }),
    updateRecall: (recallId: string, body: UpdateRecallBody) =>
      updateRecall.mutate({ path: { patientId, recallId }, body }),
    isCreating: createRecall.isPending,
    isUpdating: updateRecall.isPending,
  };
}
