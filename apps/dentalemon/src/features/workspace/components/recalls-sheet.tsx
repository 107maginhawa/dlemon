/**
 * RecallsSheet — bottom sheet for managing patient recalls
 *
 * B3: List recalls, create new recall, update status via FSM buttons.
 */
import React, { useState } from 'react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { X, CalendarClock, Plus } from 'lucide-react';
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
  pending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

const RECALL_TYPES: RecallType[] = ['cleaning', 'checkup', 'treatment', 'other'];

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
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Due: {new Date(recall.dueDate).toLocaleDateString()}
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
  // WCAG 2.4.3: Escape closes the sheet; focus returns to the opener on close.
  useSheetA11y({ open, onClose });

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

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recalls"
        data-testid="recalls-sheet"
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl bg-background shadow-2xl"
      >
        {/* Handle */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Recalls</h2>
            {recalls.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {recalls.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              aria-label="New recall"
              className="flex h-8 items-center gap-1 rounded-lg bg-muted px-3 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Recall
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close recalls"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

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
                className="rounded px-3 py-1.5 text-xs font-semibold bg-lemon text-lemon-foreground hover:bg-[#f5df6a] disabled:opacity-50"
              >
                {isCreating ? 'Saving…' : 'Save Recall'}
              </button>
            </div>
          </form>
        )}

        {/* Recall list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Loading recalls…</p>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <CalendarClock className="h-8 w-8 text-destructive/50" />
              <p className="text-sm text-destructive">Couldn’t load recalls. Please try again.</p>
            </div>
          ) : recalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <CalendarClock className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No recalls yet. Schedule a cleaning or follow-up.
              </p>
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
    </>
  );
}
