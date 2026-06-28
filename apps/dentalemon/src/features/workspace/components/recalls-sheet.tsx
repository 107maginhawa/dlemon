/**
 * RecallsSheet — bottom sheet for managing patient recalls
 *
 * B3: List recalls, create new recall, update status via FSM buttons.
 */
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Skeleton } from '@monobase/ui';
import { ArrowLeft, CalendarClock, Plus } from 'lucide-react';
import {
  useRecalls,
  type RecallType,
  type RecallStatus,
  type DentalRecall,
  type CreateRecallBody,
} from '../hooks/use-recalls';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecallsSheetProps {
  patientId: string;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// FSM: valid next statuses per current status
// ---------------------------------------------------------------------------

const RECALL_TRANSITIONS: Record<RecallStatus, RecallStatus[]> = {
  pending: ['sent', 'cancelled'],
  sent: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const STATUS_LABELS: Record<RecallStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const TRANSITION_BUTTON_LABELS: Record<RecallStatus, string> = {
  pending: 'Mark Sent',
  sent: 'Complete',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_BADGE_CLASS: Record<RecallStatus, string> = {
  pending: 'bg-warning/15 text-warning-foreground',
  sent: 'bg-blue-100 text-blue-800',
  completed: 'bg-success/15 text-success-foreground',
  cancelled: 'bg-muted text-muted-foreground',
};

const RECALL_TYPES: RecallType[] = ['cleaning', 'checkup', 'treatment', 'other'];

// 1.3: quick-fill chips. Pre-fill dueDate only — the SDK request type does not
// expose intervalMonths, so recurrence is out of scope (plan scope guard).
const INTERVAL_CHIPS = [3, 6, 12] as const;

/** today + n months as a YYYY-MM-DD date-input value, clamping day-of-month
 *  (e.g. Aug 31 + 6mo -> Feb 28). */
function addMonths(base: Date, n: number): string {
  const target = new Date(base.getFullYear(), base.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(base.getDate(), lastDay));
  const p = (x: number) => String(x).padStart(2, '0');
  return `${target.getFullYear()}-${p(target.getMonth() + 1)}-${p(target.getDate())}`;
}

/** Whole-day difference (target − today), ignoring time-of-day. */
function dayDiff(target: Date, now: Date): number {
  const startOf = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOf(target) - startOf(now)) / (24 * 60 * 60 * 1000));
}

/** Human relative due text: "in 3 mo", "in 2 weeks", "tomorrow", "today",
 *  "2 weeks overdue", "3 mo overdue". Pure FE date math. */
function relativeDue(due: Date, now: Date): string {
  const days = dayDiff(due, now);
  const abs = Math.abs(days);
  let phrase: string;
  if (abs === 0) return 'today';
  if (abs < 7) {
    phrase = abs === 1 ? '1 day' : `${abs} days`;
  } else if (abs < 30) {
    const w = Math.round(abs / 7);
    phrase = w === 1 ? '1 week' : `${w} weeks`;
  } else {
    const m = Math.round(abs / 30);
    phrase = `${m} mo`;
  }
  if (days > 0) return abs === 1 ? 'tomorrow' : `in ${phrase}`;
  return abs === 1 ? 'yesterday' : `${phrase} overdue`;
}

const RECALL_TYPE_LABELS: Record<RecallType, string> = {
  cleaning: 'Cleaning',
  checkup: 'Check-up',
  treatment: 'Treatment',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

interface RecallRowProps {
  recall: DentalRecall;
  onUpdateStatus: (recallId: string, body: { status: RecallStatus }) => void;
  isUpdating: boolean;
}

function RecallRow({ recall, onUpdateStatus, isUpdating }: RecallRowProps) {
  const transitions = RECALL_TRANSITIONS[recall.status];

  // Overdue only applies to still-actionable recalls; completed/cancelled
  // are settled and never flagged.
  const dueDate = new Date(recall.dueDate);
  const isActionable = recall.status === 'pending' || recall.status === 'sent';
  const isOverdue = isActionable && dayDiff(dueDate, new Date()) < 0;
  const relative = relativeDue(dueDate, new Date());

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{RECALL_TYPE_LABELS[recall.type]}</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE_CLASS[recall.status]}`}
          >
            {STATUS_LABELS[recall.status]}
          </span>
          {isOverdue && (
            <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
              Overdue
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Due: {dueDate.toLocaleDateString()}{' '}
          <span className={isOverdue ? 'text-destructive font-medium' : undefined}>
            ({relative})
          </span>
        </p>
        {recall.notes && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{recall.notes}</p>
        )}
      </div>

      {transitions.length > 0 && (
        <div className="flex flex-col gap-1 shrink-0">
          {transitions.map((next) => (
            <button
              key={next}
              type="button"
              disabled={isUpdating}
              onClick={() => onUpdateStatus(recall.id, { status: next })}
              className="rounded px-2 py-1 text-[11px] font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50"
            >
              {next === 'cancelled' ? 'Cancel' : TRANSITION_BUTTON_LABELS[recall.status]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RecallsSheet({ patientId, open, onClose }: RecallsSheetProps) {
  // Centered modal — a focused record/list surface. Radix Dialog handles Escape,
  // click-outside, focus trap + restore.
  const { recalls, isLoading, isError, createRecall, updateRecall, isCreating, isUpdating } =
    useRecalls(patientId);

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<RecallType>('cleaning');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formDueDate) return;
    const body: CreateRecallBody = {
      type: formType,
      dueDate: formDueDate,
      ...(formNotes.trim() ? { notes: formNotes.trim() } : {}),
    };
    createRecall(body);
    setShowForm(false);
    setFormDueDate('');
    setFormNotes('');
    setFormType('cleaning');
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        aria-describedby="recalls-desc"
        className="flex flex-col gap-0 overflow-hidden p-0 w-[calc(100%-2rem)] max-w-4xl max-h-[85dvh]"
      >
        {/* The accessible dialog role comes from Radix on DialogContent; the
            stable test/E2E handle lives on this inner wrapper (the test harness
            stubs Radix Content and drops its props, so the testid must be here). */}
        <div data-testid="recalls-sheet" className="flex flex-1 flex-col min-h-0">
        {/* Header (pr-10 clears the dialog's built-in close button) */}
        <DialogHeader className="flex flex-col gap-2 space-y-0 px-4 py-3 border-b shrink-0 pr-10 text-left">
          <button
            type="button"
            onClick={onClose}
            data-testid="recalls-back-btn"
            className="flex items-center gap-1.5 self-start rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to workspace
          </button>
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <DialogTitle className="text-sm font-semibold">Recalls</DialogTitle>
              {recalls.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {recalls.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              aria-label="New recall"
              className="flex h-8 items-center gap-1 rounded-lg bg-muted px-3 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Recall
            </button>
          </div>
          <p id="recalls-desc" className="text-xs text-muted-foreground">
            Schedule and track recare visits — cleanings, check-ups, and follow-ups.
          </p>
        </DialogHeader>

        {/* New recall form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="shrink-0 border-b bg-muted/30 px-4 py-3 flex flex-col gap-2"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              New Recall
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground" htmlFor="recall-type">
                  Type
                </label>
                <select
                  id="recall-type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as RecallType)}
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                  required
                >
                  {RECALL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {RECALL_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground" htmlFor="recall-due">
                  Due Date
                </label>
                {/* 1.3: interval chips pre-fill the date; the field stays editable. */}
                <div className="flex gap-1">
                  {INTERVAL_CHIPS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFormDueDate(addMonths(new Date(), n))}
                      className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:border-lemon hover:text-foreground transition-colors"
                    >
                      {n} mo
                    </button>
                  ))}
                </div>
                <input
                  id="recall-due"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="recall-notes">
                Notes (optional)
              </label>
              <textarea
                id="recall-notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
                placeholder="Add a note…"
                className="rounded border border-border bg-background px-2 py-1.5 text-sm resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded px-3 py-1.5 text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !formDueDate}
                className="rounded px-3 py-1.5 text-xs font-semibold bg-lemon text-lemon-foreground hover:bg-lemon-hover disabled:opacity-50"
              >
                {isCreating ? 'Saving…' : 'Save Recall'}
              </button>
            </div>
          </form>
        )}

        {/* Recall list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div data-testid="recalls-loading" className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <CalendarClock className="h-8 w-8 text-destructive/50" />
              <p className="text-sm text-destructive">Couldn’t load recalls. Please try again.</p>
            </div>
          ) : recalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <CalendarClock className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No recalls yet. Schedule a cleaning or follow-up.
              </p>
              {/* L6: co-locate the primary action with the empty state. */}
              <button
                type="button"
                onClick={() => setShowForm(true)}
                data-testid="recalls-empty-new-btn"
                className="flex items-center gap-1 rounded-lg bg-lemon px-3 py-2 text-xs font-semibold text-lemon-foreground hover:bg-lemon-hover transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Recall
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recalls.map((recall) => (
                <RecallRow
                  key={recall.id}
                  recall={recall}
                  onUpdateStatus={(id, body) => updateRecall(id, body)}
                  isUpdating={isUpdating}
                />
              ))}
            </div>
          )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
