/**
 * Queue Board Route — /_workspace/queue-board
 *
 * P2-010: Live patient queue board for the active branch.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { QueueBoard } from '@/features/scheduling/components/queue-board';
import { useOrgContextStore } from '@/stores/org-context.store';

export const Route = createFileRoute('/_workspace/queue-board')({
  component: QueueBoardPage,
});

function QueueBoardPage() {
  const navigate = useNavigate();
  const branchId = useOrgContextStore((s) => s.branchId);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-background/80 backdrop-blur px-4 py-3 shrink-0">
        <button
          type="button"
          onClick={() => navigate({ to: '/' })}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-semibold">Queue Board</h1>
        {branchId && (
          <span className="ml-auto text-xs text-muted-foreground">
            Auto-refreshes every 15s
          </span>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden">
        {branchId ? (
          <QueueBoard branchId={branchId} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-muted-foreground">
              No branch selected. Please set your branch context.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
