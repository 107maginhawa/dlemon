/**
 * useCasePresentations — P1-20 staff entry: list + mint case presentations for a patient.
 *
 * Used by the "Present to patient" action in the treatment-plans sheet. Minting stays
 * behind the staff bearerAuth session (Phase 1); no token is generated in this pass.
 *
 * API: GET  /dental/patients/:patientId/case-presentations
 *      POST /dental/patients/:patientId/case-presentations
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/lib/config';

export interface CasePresentationSummary {
  id: string;
  patientId: string;
  treatmentPlanId: string;
  status: string;
  decision: 'accepted' | 'rejected' | null;
  createdAt: string;
}

function listQueryKey(patientId: string) {
  return ['dental-case-presentations', patientId] as const;
}

export function useCasePresentations(patientId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: listQueryKey(patientId),
    queryFn: async (): Promise<CasePresentationSummary[]> => {
      const res = await fetch(`${apiBaseUrl}/dental/patients/${patientId}/case-presentations`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to list case presentations (${res.status})`);
      return res.json() as Promise<CasePresentationSummary[]>;
    },
    enabled: Boolean(patientId),
    staleTime: 15_000,
  });

  const create = useMutation({
    mutationFn: async (input: { treatmentPlanId: string; planVersionId?: string }) => {
      const res = await fetch(`${apiBaseUrl}/dental/patients/${patientId}/case-presentations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Failed to create case presentation (${res.status})`);
      return res.json() as Promise<CasePresentationSummary>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listQueryKey(patientId) });
    },
  });

  return {
    presentations: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    present: (treatmentPlanId: string) => create.mutateAsync({ treatmentPlanId }),
    isPresenting: create.isPending,
  };
}
