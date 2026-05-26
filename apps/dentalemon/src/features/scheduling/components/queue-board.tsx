/**
 * QueueBoard — Kanban-style board for the patient queue
 *
 * P2-010: Shows patients in columns by queue status with FSM action buttons.
 * FSM: waiting → called → in_progress → completed | cancelled
 */
import React from 'react';
import { Users } from 'lucide-react';
import {
  useQueueBoard,
  type QueueItem,
  type QueueItemStatus,
} from '../hooks/use-queue-board';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueBoardProps {
  branchId: string;
}

// ---------------------------------------------------------------------------
// FSM config
// ---------------------------------------------------------------------------

const COLUMNS: { status: QueueItemStatus; label: string }[] = [
  { status: 'waiting', label: 'Waiting' },
  { status: 'called', label: 'Called' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'completed', label: 'Completed' },
];

const COLUMN_HEADER_CLASS: Record<string, string> = {
  waiting: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  called: 'bg-blue-50 text-blue-800 border-blue-200',
  in_progress: 'bg-[#FFF8D6] text-[#4A4018] border-[#FFE97D]',
  completed: 'bg-green-50 text-green-800 border-green-200',
};

// Primary action per status (forward transition)
const PRIMARY_ACTION: Partial<Record<QueueItemStatus, { label: string; next: QueueItemStatus }>> = {
  waiting: { label: 'Call', next: 'called' },
  called: { label: 'Start', next: 'in_progress' },
  in_progress: { label: 'Done', next: 'completed' },
};

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function timeWaiting(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `${hours}h ${mins}m`;
}

interface QueueCardProps {
  item: QueueItem;
  onUpdateStatus: (itemId: string, status: QueueItemStatus) => void;
  isUpdating: boolean;
}

function QueueCard({ item, onUpdateStatus, isUpdating }: QueueCardProps) {
  const primaryAction = PRIMARY_ACTION[item.status];
  const displayName = item.patientName ?? `#${item.patientId.slice(0, 6)}`;

  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-sm flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{displayName}</p>
          <p className="text-[11px] text-muted-foreground">{timeWaiting(item.createdAt)}</p>
        </div>
      </div>

      {item.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2">{item.notes}</p>
      )}

      <div className="flex gap-1 flex-wrap">
        {primaryAction && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onUpdateStatus(item.id, primaryAction.next)}
            className="rounded px-2.5 py-1 text-xs font-semibold bg-[#FFE97D] text-[#4A4018] hover:bg-[#f5df6a] disabled:opacity-50 transition-colors"
          >
            {primaryAction.label}
          </button>
        )}
        {item.status !== 'completed' && item.status !== 'cancelled' && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onUpdateStatus(item.id, 'cancelled')}
            className="rounded px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

interface ColumnProps {
  status: QueueItemStatus;
  label: string;
  items: QueueItem[];
  onUpdateStatus: (itemId: string, status: QueueItemStatus) => void;
  isUpdating: boolean;
}

function QueueColumn({ status, label, items, onUpdateStatus, isUpdating }: ColumnProps) {
  return (
    <div className="flex flex-col min-w-[200px] flex-1">
      <div
        className={`rounded-t-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${COLUMN_HEADER_CLASS[status] ?? 'bg-muted text-muted-foreground border-border'}`}
      >
        {label}
        {items.length > 0 && (
          <span className="ml-2 rounded-full bg-white/60 px-1.5 py-0.5 text-[10px]">
            {items.length}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 rounded-b-lg border border-t-0 border-border bg-muted/20 p-2 flex-1 min-h-[120px]">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No patients</p>
        ) : (
          items.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              onUpdateStatus={onUpdateStatus}
              isUpdating={isUpdating}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function QueueBoard({ branchId }: QueueBoardProps) {
  const { items, isLoading, isError, updateStatus, isUpdating } = useQueueBoard(branchId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading queue…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-destructive">Failed to load queue board.</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-4">
        <Users className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No patients in the queue.</p>
      </div>
    );
  }

  const byStatus = (status: QueueItemStatus) => items.filter((i) => i.status === status);

  return (
    <div className="flex gap-3 overflow-x-auto p-4 h-full">
      {COLUMNS.map(({ status, label }) => (
        <QueueColumn
          key={status}
          status={status}
          label={label}
          items={byStatus(status)}
          onUpdateStatus={updateStatus}
          isUpdating={isUpdating}
        />
      ))}
    </div>
  );
}
