/**
 * useQueueBoard — fetch + update patient queue for a branch
 *
 * API: GET  /dental/branches/:branchId/queue-board
 *      PATCH /dental/queue-items/:itemId/status
 * Polls every 15s.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listQueueBoardOptions,
  listQueueBoardQueryKey,
  updateQueueItemStatusMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type { DentalQueueModuleQueueItem } from '@monobase/sdk-ts/generated';

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

function toQueueItem(raw: DentalQueueModuleQueueItem): QueueItem {
  return {
    id: raw.id,
    branchId: raw.branchId,
    patientId: raw.patientId,
    patientName: (raw as DentalQueueModuleQueueItem & { patientName?: string }).patientName,
    status: raw.status as QueueItemStatus,
    notes: raw.notes ?? undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : (raw.createdAt as Date).toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : (raw.updatedAt as Date).toISOString(),
  };
}

function queueBoardKey(branchId: string) {
  return listQueueBoardQueryKey({ path: { branchId } });
}

export function useQueueBoard(branchId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    ...listQueueBoardOptions({ path: { branchId } }),
    enabled: Boolean(branchId),
    staleTime: 10_000,
    refetchInterval: 15_000,
    select: (data): QueueItem[] => {
      // Response is Array<QueueItem> | ErrorResponse union — narrow to array
      const arr = Array.isArray(data) ? data : ((data as { data?: DentalQueueModuleQueueItem[] })?.data ?? []);
      return (arr as DentalQueueModuleQueueItem[]).map(toQueueItem);
    },
  });

  const updateStatus = useMutation({
    ...updateQueueItemStatusMutation(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queueBoardKey(branchId) });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    updateStatus: (itemId: string, status: QueueItemStatus) =>
      updateStatus.mutate({ path: { itemId }, body: { status } }),
    isUpdating: updateStatus.isPending,
  };
}
