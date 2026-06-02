/**
 * RecallDueList — front-desk recare (continuing-care) due-list view (P1-24, P3).
 *
 * Renders the branch's due recalls (GET /dental/recalls/due) with two actions:
 *   - "Reach out"  → manual outreach override (flips the recall to 'sent' via
 *                    updateRecall; the recallDispatch job is the automated path)
 *   - "Schedule"   → callback so the host route can open the appointment modal
 *                    prefilled with the patient.
 *
 * shadcn + TanStack Query only. Lemon tokens for the primary action.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@monobase/ui';
import { updateRecall } from '@monobase/sdk-ts/generated';
import { useRecallDueList, type RecallDueItem } from '../hooks/use-recall-due-list';

export interface RecallDueListProps {
  branchId?: string;
  /** Called when the user clicks "Schedule" for a due recall. */
  onSchedule?: (recall: RecallDueItem) => void;
}

const TYPE_LABEL: Record<RecallDueItem['type'], string> = {
  cleaning: 'Cleaning',
  checkup: 'Checkup',
  treatment: 'Treatment',
  other: 'Other',
};

export function formatDueDate(dueDate: string): string {
  // dueDate is YYYY-MM-DD; render as a locale date without TZ drift.
  const [y, m, d] = dueDate.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return dueDate;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

export function RecallDueList({ branchId, onSchedule }: RecallDueListProps) {
  const { recalls, isLoading, isError, refetch } = useRecallDueList({ branchId });
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function handleReachOut(recall: RecallDueItem) {
    setBusyId(recall.id);
    try {
      await updateRecall({
        path: { patientId: recall.patientId, recallId: recall.id },
        body: { status: 'sent' } as unknown as Parameters<typeof updateRecall>[0]['body'],
      });
      await refetch();
    } catch {
      // Network error — leave the row as-is.
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card data-testid="recall-due-list">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">Recare due</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground py-6 text-center" role="status">Loading recare list…</p>
        )}

        {isError && (
          <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            Couldn’t load the recare list.{' '}
            <button type="button" onClick={() => void refetch()} className="underline font-medium">Retry</button>
          </div>
        )}

        {!isLoading && !isError && recalls.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">No recalls are due. 🎉</p>
        )}

        {!isLoading && !isError && recalls.map((recall) => (
          <div
            key={recall.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
            data-testid="recall-due-row"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{recall.patientName || 'Unknown patient'}</div>
              <div className="text-[12px] text-muted-foreground">
                {TYPE_LABEL[recall.type]} · due {formatDueDate(recall.dueDate)}
                {recall.sendAttempts > 0 && ` · ${recall.sendAttempts} reminder${recall.sendAttempts > 1 ? 's' : ''} sent`}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge
                variant="secondary"
                className={recall.status === 'sent' ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}
              >
                {recall.status === 'sent' ? 'Reminded' : 'Due'}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleReachOut(recall)}
                disabled={busyId === recall.id}
                className="h-8 px-3 rounded-lg border border-border text-[13px] font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                aria-label={`Reach out to ${recall.patientName}`}
              >
                {busyId === recall.id ? '…' : 'Reach out'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onSchedule?.(recall)}
                className="h-8 px-3 rounded-lg bg-lemon hover:bg-lemon-hover text-lemon-foreground text-[13px] font-semibold transition-colors"
                aria-label={`Schedule ${recall.patientName}`}
              >
                Schedule
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
