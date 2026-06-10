/**
 * useChartConflicts — P0-A offline conflict visibility & resolution.
 *
 * Queries open (unresolved) chart sync conflicts for a patient and exposes a
 * resolve mutation. The server rejects stale offline chart writes and persists
 * them (syncStatus='conflict'); this surfaces them so a clinician can accept
 * (the offline edit becomes truth, new clock) or dismiss (keep current, reason
 * required) them.
 *
 * API:
 *   GET  /dental/visits/chart-conflicts/{patientId}
 *   POST /dental/visits/{visitId}/chart/resolve-conflict
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listChartConflictsOptions,
  listChartConflictsQueryKey,
  resolveChartConflictMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type { ChartConflict, ChartConflictResolution } from '@monobase/sdk-ts/generated';
import { conflictedToothNumbers, totalRejectedTeeth } from '../components/chart-conflict.helpers';

export interface UseChartConflictsResult {
  conflicts: ChartConflict[];
  conflictedTeeth: Set<number>;
  rejectedCount: number;
  isLoading: boolean;
  resolve: (visitId: string, resolution: ChartConflictResolution, reason?: string) => Promise<void>;
  isResolving: boolean;
}

export function useChartConflicts(patientId: string | null): UseChartConflictsResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    ...listChartConflictsOptions({ path: { patientId: patientId as string } }),
    enabled: Boolean(patientId),
    staleTime: 15_000,
  });

  const mutation = useMutation({
    ...resolveChartConflictMutation(),
    onSuccess: () => {
      if (patientId) {
        queryClient.invalidateQueries({ queryKey: listChartConflictsQueryKey({ path: { patientId } }) });
      }
    },
  });

  const conflicts = (query.data ?? []) as ChartConflict[];

  async function resolve(visitId: string, resolution: ChartConflictResolution, reason?: string): Promise<void> {
    await mutation.mutateAsync({
      path: { visitId },
      body: reason ? { resolution, reason } : { resolution },
    });
  }

  return {
    conflicts,
    conflictedTeeth: conflictedToothNumbers(conflicts),
    rejectedCount: totalRejectedTeeth(conflicts),
    isLoading: query.isLoading,
    resolve,
    isResolving: mutation.isPending,
  };
}
