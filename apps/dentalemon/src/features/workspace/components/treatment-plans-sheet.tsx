/**
 * TreatmentPlansSheet — bottom sheet for plan-level treatment plan documents
 *
 * B4: List plans with FSM status badges and transition buttons.
 * FSM: draft → presented → approved → partially_completed → completed | cancelled
 */
import React from 'react';
import { X, ClipboardList } from 'lucide-react';
import {
  useTreatmentPlans,
  type TreatmentPlanStatus,
  type TreatmentPlanDoc,
} from '../hooks/use-treatment-plans';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TreatmentPlansSheetProps {
  patientId: string;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// FSM config
// ---------------------------------------------------------------------------

const FSM: Record<TreatmentPlanStatus, TreatmentPlanStatus[]> = {
  draft: ['presented', 'cancelled'],
  presented: ['approved', 'cancelled'],
  approved: ['partially_completed', 'cancelled'],
  partially_completed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const TRANSITION_LABELS: Record<TreatmentPlanStatus, string> = {
  draft: 'Draft',
  presented: 'Present',
  approved: 'Approve',
  partially_completed: 'Start',
  completed: 'Complete',
  cancelled: 'Cancel',
};

const STATUS_DISPLAY: Record<TreatmentPlanStatus, string> = {
  draft: 'Draft',
  presented: 'Presented',
  approved: 'Approved',
  partially_completed: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_BADGE_CLASS: Record<TreatmentPlanStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  presented: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  partially_completed: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-50 text-green-500',
  cancelled: 'bg-red-50 text-red-400',
};

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

interface PlanRowProps {
  plan: TreatmentPlanDoc;
  onUpdate: (planId: string, body: { status: TreatmentPlanStatus }) => void;
  isUpdating: boolean;
}

function PlanRow({ plan, onUpdate, isUpdating }: PlanRowProps) {
  const transitions = FSM[plan.status];

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">
            Plan — {new Date(plan.createdAt).toLocaleDateString()}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE_CLASS[plan.status]}`}
          >
            {STATUS_DISPLAY[plan.status]}
          </span>
        </div>
        {plan.totalEstimateCents !== undefined && plan.totalEstimateCents > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Estimate: {(plan.totalEstimateCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </p>
        )}
        {plan.notes && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{plan.notes}</p>
        )}
      </div>

      {transitions.length > 0 && (
        <div className="flex flex-col gap-1 shrink-0">
          {transitions.map((next) => (
            <button
              key={next}
              type="button"
              disabled={isUpdating}
              onClick={() => onUpdate(plan.id, { status: next })}
              className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                next === 'cancelled'
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              }`}
            >
              {TRANSITION_LABELS[next]}
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

export function TreatmentPlansSheet({ patientId, open, onClose }: TreatmentPlansSheetProps) {
  const { plans, isLoading, isError, updatePlan, isUpdating } = useTreatmentPlans(patientId);

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
        aria-label="Treatment Plans"
        data-testid="treatment-plans-sheet"
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl bg-background shadow-2xl"
      >
        {/* Handle */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Treatment Plans</h2>
            {plans.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {plans.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close treatment plans"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Plan list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Loading plans…</p>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <ClipboardList className="h-8 w-8 text-destructive/50" />
              <p className="text-sm text-destructive">Couldn’t load treatment plans. Please try again.</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No treatment plans. Create one to track approved treatment sequences.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {plans.map((plan) => (
                <PlanRow
                  key={plan.id}
                  plan={plan}
                  onUpdate={(id, body) => updatePlan(id, body)}
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
