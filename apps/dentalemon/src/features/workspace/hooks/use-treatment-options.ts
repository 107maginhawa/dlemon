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
import { apiBaseUrl } from '@/lib/config';

export interface TreatmentOption {
  id: string;
  status: string;
  recommended: boolean;
}

export interface TreatmentOptionGroup {
  optionGroupId: string;
  options: TreatmentOption[];
}

function optionGroupQueryKey(patientId: string, optionGroupId: string) {
  return ['dental-treatment-option-group', patientId, optionGroupId] as const;
}

export function useTreatmentOptions(patientId: string, optionGroupId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: optionGroupQueryKey(patientId, optionGroupId),
    queryFn: async (): Promise<TreatmentOptionGroup> => {
      const res = await fetch(
        `${apiBaseUrl}/dental/patients/${patientId}/treatment-options/${optionGroupId}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Failed to fetch treatment options (${res.status})`);
      return res.json() as Promise<TreatmentOptionGroup>;
    },
    enabled: Boolean(patientId && optionGroupId),
    staleTime: 30_000,
  });

  const accept = useMutation({
    mutationFn: async (chosenTreatmentId: string) => {
      const res = await fetch(
        `${apiBaseUrl}/dental/patients/${patientId}/treatment-options/${optionGroupId}/accept`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chosenTreatmentId }),
        },
      );
      if (!res.ok) throw new Error(`Failed to accept treatment option (${res.status})`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: optionGroupQueryKey(patientId, optionGroupId) });
    },
  });

  return {
    optionGroup: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    acceptOption: (chosenTreatmentId: string) => accept.mutate(chosenTreatmentId),
    isAccepting: accept.isPending,
  };
}
