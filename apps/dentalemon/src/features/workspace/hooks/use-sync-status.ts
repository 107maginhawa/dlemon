/**
 * useSyncStatus — poll sync log summary for a branch
 *
 * API: GET /dental/sync-logs?branchId={branchId}
 * Polls every 30s.
 */
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/lib/config';

export type SyncLogStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncLogEntry {
  id: string;
  branchId: string;
  entityType?: string;
  entityId?: string;
  status: SyncLogStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UseSyncStatusResult {
  syncLogs: SyncLogEntry[];
  pendingCount: number;
  failedCount: number;
  isLoading: boolean;
}

export function useSyncStatus(branchId: string | null): UseSyncStatusResult {
  const query = useQuery({
    queryKey: ['dental-sync-status', branchId] as const,
    queryFn: async (): Promise<SyncLogEntry[]> => {
      const res = await fetch(
        `${apiBaseUrl}/dental/sync-logs?branchId=${encodeURIComponent(branchId!)}`,
      );
      if (!res.ok) throw new Error(`Failed to fetch sync logs (${res.status})`);
      const data: unknown = await res.json();
      if (Array.isArray(data)) return data as SyncLogEntry[];
      const obj = data as Record<string, unknown>;
      return (Array.isArray(obj.data) ? obj.data : (obj.logs ?? [])) as SyncLogEntry[];
    },
    enabled: Boolean(branchId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const logs = query.data ?? [];

  return {
    syncLogs: logs,
    pendingCount: logs.filter((l) => l.status === 'pending' || l.status === 'syncing').length,
    failedCount: logs.filter((l) => l.status === 'failed').length,
    isLoading: query.isLoading,
  };
}
