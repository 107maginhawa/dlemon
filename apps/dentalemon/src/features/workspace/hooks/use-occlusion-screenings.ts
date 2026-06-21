/**
 * useOcclusionScreenings — fetch/create patient occlusion screenings
 * (PP-7 sub-slice 3 / ISSUE-044).
 *
 * Patient-scoped orthodontic screening (Angle class, overjet/overbite, crossbite,
 * crowding, spacing, midline). Create + list only — no HTTP update/delete is
 * exposed. Create invalidates the list; failures are surfaced via toast.
 *
 * API: GET  /dental/patients/:patientId/occlusion-screenings  ({data,pagination})
 *      POST /dental/patients/:patientId/occlusion-screenings
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listOcclusionScreeningsOptions,
  listOcclusionScreeningsQueryKey,
  createOcclusionScreeningMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type {
  DentalClinicalOpsModuleOcclusionScreening,
  DentalClinicalOpsModuleCreateOcclusionScreeningRequest,
  DentalClinicalOpsModuleOcclusionClass,
} from '@monobase/sdk-ts/generated';
import { toastError } from '@/lib/error-toast';

export type OcclusionScreening = DentalClinicalOpsModuleOcclusionScreening;
export type OcclusionClass = DentalClinicalOpsModuleOcclusionClass;
export type CreateOcclusionScreeningBody = DentalClinicalOpsModuleCreateOcclusionScreeningRequest;

export const OCCLUSION_CLASSES: OcclusionClass[] = [
  'class_i',
  'class_ii_div1',
  'class_ii_div2',
  'class_iii',
  'edge_to_edge',
];

export const OCCLUSION_CLASS_LABELS: Record<OcclusionClass, string> = {
  class_i: 'Class I',
  class_ii_div1: 'Class II div 1',
  class_ii_div2: 'Class II div 2',
  class_iii: 'Class III',
  edge_to_edge: 'Edge-to-edge',
};

export function useOcclusionScreenings(patientId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    ...listOcclusionScreeningsOptions({ path: { patientId } }),
    enabled: Boolean(patientId),
    staleTime: 30_000,
    select: (data): OcclusionScreening[] => {
      // List returns a { data, pagination } envelope; tolerate a bare array too.
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) {
        return (data as { data: OcclusionScreening[] }).data;
      }
      return [];
    },
  });

  const create = useMutation({
    ...createOcclusionScreeningMutation(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listOcclusionScreeningsQueryKey({ path: { patientId } }) });
    },
    onError: (err) => toastError(err, 'Could not save the screening.'),
  });

  return {
    screenings: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    createScreening: (body: CreateOcclusionScreeningBody) => create.mutate({ path: { patientId }, body }),
    isCreating: create.isPending,
  };
}
