/**
 * WorkspaceContextStrip — the consolidated, sticky visit-context band that sits
 * directly above the treatment table (Items 3 + 4).
 *
 * Consolidates three previously-stacked bands into ONE compact strip:
 *   - ChartConflictBanner (gated: renders only when there are conflicts)
 *   - the "visit in progress" indicator
 *   - the Compare trigger
 *
 * It is also the visit-date anchor: the visit date + status + read-only state
 * stay visible while the treatment rows scroll, so a multi-visit patient can't be
 * charted on the wrong visit.
 *
 * Finally it HOSTS the passive guided next-step (deriveNextStep): one
 * state-aware line + at most two action buttons. No new API calls; everything is
 * derived from props the route already computed.
 */

import { CalendarDays, CircleDot, CheckCircle2, Lock, FileText, Pencil } from 'lucide-react';
import { ChartConflictBanner } from './chart-conflict-banner';
import { deriveNextStep, type NextStepAction, type VisitStatus } from '../lib/next-step';
import type { VisitLike } from '../lib/visit-status';

export interface WorkspaceContextStripProps {
  patientId: string;
  /** Formatted visit date (e.g. "Jun 24, 2026"); undefined when no visit. */
  visitDate?: string;
  currentVisitStatus?: VisitStatus;
  openVisit?: VisitLike | null;
  currentIsOpen: boolean;
  treatmentCount: number;
  performedCount: number;
  /** Number of open offline chart conflicts (gates the conflict banner). */
  conflictCount: number;
  /** Whether the Compare affordance should be shown (2+ visits). */
  canCompare: boolean;
  onCompare: () => void;
  /** Next-step action handlers (Item 4 / Item 5 parity). */
  onStartVisit: () => void;
  onComplete: () => void;
  onDiscard: () => void;
  /** Whether the current role may discard (dentist_owner). */
  canDiscard: boolean;
}

/** Non-color status cue + label so status is never communicated by color alone. */
function StatusPill({ status }: { status: VisitStatus }) {
  const map: Record<
    VisitStatus,
    { label: string; cls: string; Icon: typeof CircleDot }
  > = {
    active: { label: 'Active', cls: 'bg-success/15 text-success-foreground', Icon: CircleDot },
    draft: { label: 'Draft', cls: 'bg-muted text-muted-foreground', Icon: Pencil },
    completed: { label: 'Completed', cls: 'bg-blue-100 text-blue-700', Icon: CheckCircle2 },
    locked: { label: 'Locked', cls: 'bg-purple-100 text-purple-700', Icon: Lock },
    discarded: { label: 'Discarded', cls: 'bg-muted text-muted-foreground', Icon: FileText },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span
      data-testid="context-strip-status"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

export function WorkspaceContextStrip({
  patientId,
  visitDate,
  currentVisitStatus,
  openVisit,
  currentIsOpen,
  treatmentCount,
  performedCount,
  conflictCount,
  canCompare,
  onCompare,
  onStartVisit,
  onComplete,
  onDiscard,
  canDiscard,
}: WorkspaceContextStripProps) {
  const next = deriveNextStep({
    currentVisitStatus,
    openVisit,
    currentIsOpen,
    treatmentCount,
    performedCount,
  });

  const isReadOnly =
    currentVisitStatus === 'completed' || currentVisitStatus === 'locked';

  // The currently-viewed visit IS the open (in-progress) one — surface the
  // in-progress indicator + an owner discard escape hatch right here, so the
  // lifecycle controls live with the visit context (parity with Item 5's
  // open-visit guidance, and keeps the established discard affordance available).
  const viewingOpenVisit =
    currentIsOpen &&
    (currentVisitStatus === 'active' || currentVisitStatus === 'draft');

  function runAction(action: NextStepAction) {
    switch (action) {
      case 'start-visit':
        onStartVisit();
        break;
      case 'complete':
        onComplete();
        break;
      case 'discard':
        onDiscard();
        break;
      // 'chart' / 'mark-done' are informational only — no button is rendered.
    }
  }

  return (
    <div
      data-testid="workspace-context-strip"
      className="sticky top-0 z-20 shrink-0 border-b bg-background/95 backdrop-blur"
    >
      {/* Conflict banner — gated: only when there are conflicts (Item 3). */}
      {conflictCount > 0 && <ChartConflictBanner patientId={patientId} />}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2">
        {/* Visit-date anchor + status (Item 3). */}
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          {visitDate ? (
            <span data-testid="context-strip-date" className="text-sm font-semibold text-foreground">
              {visitDate}
            </span>
          ) : (
            <span data-testid="context-strip-date" className="text-sm font-medium text-muted-foreground">
              No visit
            </span>
          )}
          {currentVisitStatus && <StatusPill status={currentVisitStatus} />}
          {isReadOnly && (
            <span
              data-testid="context-strip-readonly"
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              <Lock className="h-3 w-3" aria-hidden />
              Read-only
            </span>
          )}
          {viewingOpenVisit && (
            <span
              data-testid="visit-in-progress-indicator"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-success-foreground"
            >
              <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
              In progress
            </span>
          )}
          {viewingOpenVisit && canDiscard && (
            <button
              type="button"
              data-testid="discard-visit-btn"
              onClick={onDiscard}
              className="inline-flex min-h-[44px] items-center rounded-md border border-destructive/40 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            >
              Discard visit
            </button>
          )}
        </div>

        {/* Guided next step (Item 4) — single line + at most two actions. */}
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 min-w-0">
          <span
            data-testid="next-step-message"
            data-next-step-kind={next.kind}
            className="text-xs text-muted-foreground"
          >
            {next.message}
          </span>
          {next.buttons.map((b) => {
            // Discard is owner-gated to keep parity with the strip's lifecycle rules.
            if (b.action === 'discard' && !canDiscard) return null;
            return (
              <button
                key={b.action}
                type="button"
                data-testid={`next-step-${b.action}-btn`}
                onClick={() => runAction(b.action)}
                className={
                  b.primary
                    ? 'min-h-[44px] rounded-lg bg-lemon px-4 text-sm font-semibold text-lemon-foreground hover:bg-lemon-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors'
                    : 'min-h-[44px] rounded-lg border border-destructive/40 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors'
                }
              >
                {b.label}
              </button>
            );
          })}
          {canCompare && (
            <button
              type="button"
              data-testid="compare-btn"
              onClick={onCompare}
              aria-label="Compare visit charts"
              className="min-h-[44px] rounded-lg border border-lemon-hover bg-lemon/20 px-3 text-xs font-medium text-lemon-foreground hover:bg-lemon/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            >
              Compare
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
