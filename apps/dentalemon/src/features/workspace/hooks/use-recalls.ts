/**
 * useRecalls — fetch/create/update patient recalls
 *
 * API: GET  /dental/patients/:patientId/recalls
 *      POST /dental/patients/:patientId/recalls
 *      PATCH /dental/patients/:patientId/recalls/:recallId
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

export type RecallStatus = 'pending' | 'sent' | 'completed' | 'cancelled';
export type RecallType = 'cleaning' | 'checkup' | 'treatment' | 'other';

export interface DentalRecall {
  id: string;
  patientId: string;
  type: RecallType;
  status: RecallStatus;
  dueDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecallBody {
  type: RecallType;
  dueDate: string;
  notes?: string;
}

export interface UpdateRecallBody {
  status?: RecallStatus;
  notes?: string;
  dueDate?: string;
}

function recallsQueryKey(patientId: string) {
  return ['dental-recalls', patientId] as const;
}

export function useRecalls(patientId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: recallsQueryKey(patientId),
    queryFn: async (): Promise<DentalRecall[]> => {
      const res = await fetch(`${apiBaseUrl}/dental/patients/${patientId}/recalls`);
      if (!res.ok) throw new Error(`Failed to fetch recalls (${res.status})`);
      const data: unknown = await res.json();
      if (Array.isArray(data)) return data as DentalRecall[];
      const obj = data as Record<string, unknown>;
      return (Array.isArray(obj.data) ? obj.data : (obj.recalls ?? [])) as DentalRecall[];
    },
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });

  const createRecall = useMutation({
    mutationFn: async (body: CreateRecallBody) => {
      const res = await fetch(`${apiBaseUrl}/dental/patients/${patientId}/recalls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to create recall (${res.status})`);
      return res.json() as Promise<DentalRecall>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recallsQueryKey(patientId) });
    },
  });

  const updateRecall = useMutation({
    mutationFn: async ({ recallId, body }: { recallId: string; body: UpdateRecallBody }) => {
      const res = await fetch(`${apiBaseUrl}/dental/patients/${patientId}/recalls/${recallId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to update recall (${res.status})`);
      return res.json() as Promise<DentalRecall>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recallsQueryKey(patientId) });
    },
  });

  return {
    recalls: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    createRecall: (body: CreateRecallBody) => createRecall.mutate(body),
    updateRecall: (recallId: string, body: UpdateRecallBody) =>
      updateRecall.mutate({ recallId, body }),
    isCreating: createRecall.isPending,
    isUpdating: updateRecall.isPending,
  };
}
