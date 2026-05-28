/**
 * useQueueBoard — fetch + update patient queue for a branch
 *
 * API: GET  /dental/branches/:branchId/queue-board
 *      PATCH /dental/queue-items/:itemId/status
 * Polls every 15s.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/lib/config';

export type QueueItemStatus = 'waiting' | 'called' | 'in_progress' | 'completed' | 'cancelled';

export interface QueueItem {
  id: string;
  branchId: string;
  patientId: string;
  patientName?: string;
  status: QueueItemStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

function queueBoardQueryKey(branchId: string) {
  return ['dental-queue-board', branchId] as const;
}

export function useQueueBoard(branchId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queueBoardQueryKey(branchId),
    queryFn: async (): Promise<QueueItem[]> => {
      const res = await fetch(`${apiBaseUrl}/dental/branches/${branchId}/queue-board`);
      if (!res.ok) throw new Error(`Failed to fetch queue board (${res.status})`);
      const data: unknown = await res.json();
      if (Array.isArray(data)) return data as QueueItem[];
      const obj = data as Record<string, unknown>;
      return (Array.isArray(obj.data) ? obj.data : (obj.items ?? [])) as QueueItem[];
    },
    enabled: Boolean(branchId),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: QueueItemStatus }) => {
      const res = await fetch(`${apiBaseUrl}/dental/queue-items/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`Failed to update queue item status (${res.status})`);
      return res.json() as Promise<QueueItem>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queueBoardQueryKey(branchId) });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    updateStatus: (itemId: string, status: QueueItemStatus) =>
      updateStatus.mutate({ itemId, status }),
    isUpdating: updateStatus.isPending,
  };
}
