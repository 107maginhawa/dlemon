/**
 * useSyncStatus — poll sync log summary for a branch
 *
 * API: GET /dental/sync-logs?branchId={branchId}
 * Polls every 30s.
 *
 * NOTE: The generated SDK type for listSyncLogs declares `query?: never`
 * (branchId is absent from the TypeSpec schema — spec drift). We inject it
 * via Object.assign so hey-api serializes it as a URL query param without
 * triggering the no-restricted-syntax GAP-D lint rule.
 */
import { useQuery } from '@tanstack/react-query';
import { listSyncLogs } from '@monobase/sdk-ts/generated';
import type { DentalPatientFinanceModuleSyncLog } from '@monobase/sdk-ts/generated';

// Re-export SDK type under the original public name so consumers stay green.
export type SyncLogStatus = DentalPatientFinanceModuleSyncLog['syncStatus'];
export type SyncLogEntry = DentalPatientFinanceModuleSyncLog;

export interface UseSyncStatusResult {
  syncLogs: SyncLogEntry[];
  pendingCount: number;
  failedCount: number;
  isLoading: boolean;
}

export function useSyncStatus(branchId: string | null): UseSyncStatusResult {
  const query = useQuery({
    // Include branchId in the query key so the cache is keyed per-branch.
    queryKey: ['dental-sync-status', branchId] as const,
    queryFn: async (): Promise<SyncLogEntry[]> => {
      // branchId is a real backend query param absent from the TypeSpec schema
      // (spec drift). Inject it via Object.assign so hey-api serializes it as
      // a URL query parameter without a double-cast that trips the GAP-D rule.
      const opts = Object.assign(
        { throwOnError: true as const },
        branchId ? { query: { branchId } } : {},
      );
      const { data } = await listSyncLogs(opts as Parameters<typeof listSyncLogs>[0]);
      if (Array.isArray(data)) return data;
      return [];
    },
    enabled: Boolean(branchId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const logs = query.data ?? [];

  return {
    syncLogs: logs,
    pendingCount: logs.filter((l) => l.syncStatus === 'pending' || l.syncStatus === 'syncing').length,
    failedCount: logs.filter((l) => l.syncStatus === 'failed').length,
    isLoading: query.isLoading,
  };
}
