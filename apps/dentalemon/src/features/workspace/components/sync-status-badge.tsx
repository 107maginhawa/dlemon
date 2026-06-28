/**
 * SyncStatusBadge — inline badge showing branch sync status
 *
 * B5/P2-009: Shows failed / pending / synced states.
 * Returns null when branchId is absent or data is loading.
 */
import React from 'react';
import { useSyncStatus } from '../hooks/use-sync-status';

interface SyncStatusBadgeProps {
  branchId: string | null;
}

export function SyncStatusBadge({ branchId }: SyncStatusBadgeProps) {
  const { syncLogs, pendingCount, failedCount, isLoading } = useSyncStatus(branchId);

  if (!branchId || isLoading) return null;

  if (failedCount > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive-emphasis"
        title={`${failedCount} sync failure${failedCount > 1 ? 's' : ''}`}
      >
        ⚠ {failedCount} failed
      </span>
    );
  }

  if (pendingCount > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning-foreground"
        title={`${pendingCount} item${pendingCount > 1 ? 's' : ''} pending sync`}
      >
        ↑ {pendingCount} pending
      </span>
    );
  }

  if (syncLogs.length === 0) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success-foreground"
      title="All items synced"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
      Synced
    </span>
  );
}
