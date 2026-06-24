/**
 * TreatmentPlansSheet — bottom sheet for plan-level treatment plan documents
 *
 * B4: List plans with FSM status badges and transition buttons.
 * FSM: draft → presented → approved → partially_completed → completed | cancelled
 */
import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@monobase/ui';
import { ClipboardList, Plus } from 'lucide-react';
import {
  useTreatmentPlans,
  type TreatmentPlanStatus,
  type TreatmentPlanDoc,
} from '../hooks/use-treatment-plans';
import { useTreatmentOptions } from '../hooks/use-treatment-options';
import { useCasePresentations } from '@/features/case-presentation/use-case-presentations';
import { formatCents } from '@/lib/format-currency';
import { useOrgContextStore } from '@/stores/org-context.store';
import { canPresentCase, type DentalRole } from '@/lib/rbac';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TreatmentPlansSheetProps {
  patientId: string;
  open: boolean;
  onClose: () => void;
  /**
   * P1-19: alternate-case option groups (e.g. implant vs bridge) to present for
   * acceptance. Optional — when omitted the alternate-cases section is hidden.
   */
  optionGroupIds?: string[];
}

// ---------------------------------------------------------------------------
// FSM config
// ---------------------------------------------------------------------------

// P2-8: lifecycle mirrors TREATMENT_PLAN_FSM in treatment-plan.schema.ts —
// presented can be approved or rejected; approved can be scheduled to the calendar.
const FSM: Record<TreatmentPlanStatus, TreatmentPlanStatus[]> = {
  draft: ['presented', 'cancelled'],
  presented: ['approved', 'rejected', 'cancelled'],
  approved: ['scheduled', 'partially_completed', 'cancelled'],
  scheduled: ['partially_completed', 'cancelled'],
  rejected: [],
  partially_completed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const TRANSITION_LABELS: Record<TreatmentPlanStatus, string> = {
  draft: 'Draft',
  // N2: distinct from the "Present to patient" action below — this is the FSM
  // transition that marks the plan presented (draft → presented).
  presented: 'Mark presented',
  approved: 'Approve',
  rejected: 'Reject',
  scheduled: 'Schedule',
  partially_completed: 'Start',
  completed: 'Complete',
  cancelled: 'Cancel',
};

const STATUS_DISPLAY: Record<TreatmentPlanStatus, string> = {
  draft: 'Draft',
  presented: 'Presented',
  approved: 'Approved',
  rejected: 'Rejected',
  scheduled: 'Scheduled',
  partially_completed: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_BADGE_CLASS: Record<TreatmentPlanStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  presented: 'bg-warning/15 text-warning-foreground',
  approved: 'bg-success/15 text-success-foreground',
  rejected: 'bg-destructive/15 text-destructive-emphasis',
  scheduled: 'bg-info/15 text-info-foreground',
  partially_completed: 'bg-info/15 text-info-foreground',
  completed: 'bg-success/15 text-success-foreground',
  cancelled: 'bg-destructive/15 text-destructive-emphasis',
};

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

interface PlanRowProps {
  plan: TreatmentPlanDoc;
  onUpdate: (planId: string, body: { status: TreatmentPlanStatus }) => void;
  isUpdating: boolean;
  /** P1-20: mint a patient-facing case presentation for a presented plan. */
  onPresent?: (planId: string) => void;
  isPresenting?: boolean;
  /** E1/N4: whether the current role may hand a plan to the patient. */
  canPresent?: boolean;
}

function PlanRow({ plan, onUpdate, isUpdating, onPresent, isPresenting, canPresent }: PlanRowProps) {
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
            Estimate: {formatCents(plan.totalEstimateCents)}
          </p>
        )}
        {/* P2-10: CDT code-set year stamp */}
        {plan.cdtCodeSetYear !== undefined && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">CDT {plan.cdtCodeSetYear}</p>
        )}
        {plan.notes && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{plan.notes}</p>
        )}
      </div>

      {(transitions.length > 0 || plan.status === 'presented') && (
        <div className="flex flex-col gap-1 shrink-0">
          {/* P1-20: a presented plan can be handed to the patient as a case
              presentation. N4: render it disabled (not hidden) for roles that
              can't present, so the gate is explained rather than silent. */}
          {plan.status === 'presented' && (
            <button
              type="button"
              data-testid="present-to-patient-btn"
              disabled={!canPresent || isPresenting}
              title={!canPresent ? 'Requires treatment-coordinator role' : undefined}
              onClick={() => { if (canPresent) onPresent?.(plan.id); }}
              className="rounded px-2 py-1 text-[11px] font-semibold text-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed bg-lemon"
            >
              {isPresenting ? 'Presenting…' : 'Present to patient'}
            </button>
          )}
          {transitions.map((next) => (
            <button
              key={next}
              type="button"
              disabled={isUpdating}
              onClick={() => onUpdate(plan.id, { status: next })}
              className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                next === 'cancelled' || next === 'rejected'
                  ? 'bg-destructive/10 text-destructive-emphasis hover:bg-destructive/15'
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
// P1-19 — Alternate cases (implant vs bridge, …)
// ---------------------------------------------------------------------------

function OptionGroupCard({ patientId, optionGroupId }: { patientId: string; optionGroupId: string }) {
  const { optionGroup, isLoading, acceptOption, isAccepting } = useTreatmentOptions(
    patientId,
    optionGroupId,
  );

  if (isLoading || !optionGroup || optionGroup.options.length === 0) return null;

  const accepted = optionGroup.options.find((o) => o.status === 'planned');

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">Alternate options</p>
      <div className="flex flex-col gap-2">
        {optionGroup.options.map((opt) => {
          const isAccepted = opt.status === 'planned';
          const isDeclined = opt.status === 'declined';
          return (
            <div key={opt.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="truncate text-sm">Option {opt.id.slice(0, 8)}</span>
                {opt.recommended && (
                  <span className="inline-flex items-center rounded-full bg-lemon px-2 py-0.5 text-[10px] font-semibold text-foreground">
                    Recommended
                  </span>
                )}
                {isAccepted && (
                  <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success-foreground">
                    Accepted
                  </span>
                )}
                {isDeclined && (
                  <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive-emphasis">
                    Declined
                  </span>
                )}
              </div>
              {!accepted && !isDeclined && (
                <button
                  type="button"
                  disabled={isAccepting}
                  onClick={() => acceptOption(opt.id)}
                  className="shrink-0 rounded bg-muted px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
                >
                  Accept
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TreatmentPlansSheet({ patientId, open, onClose, optionGroupIds }: TreatmentPlansSheetProps) {
  // Centered modal — a focused plan-list surface. Radix Dialog handles Escape,
  // click-outside, focus trap + restore.
  const navigate = useNavigate();

  const { plans, isLoading, isError, createPlan, updatePlan, isCreating, isUpdating } =
    useTreatmentPlans(patientId);
  // P1-20: mint a patient-facing case presentation from a presented plan.
  const { present, isPresenting } = useCasePresentations(patientId);
  // E1: only the treatment-presentation roles (clinicians + treatment coordinator)
  // may hand a plan to the patient. Mirrors the backend createCasePresentation gate.
  const role = useOrgContextStore((s) => s.role) as DentalRole | null;
  const canPresent = role ? canPresentCase(role) : false;
  // 1.1: createTreatmentPlan requires the authoring provider. Resolve it from the
  // active org-context member (the same identity the Rx/consent flows use) — no
  // provider picker. Without it we can't author a plan, so the action is disabled.
  const providerId = useOrgContextStore((s) => s.memberId);
  const handleCreatePlan = () => {
    if (!providerId) return;
    createPlan({ providerId });
  };

  // After minting, navigate to the patient-facing surface so staff can hand the
  // operatory iPad to the patient to review + accept/decline the plan.
  const presentAndOpen = async (planId: string) => {
    const created = await present(planId);
    onClose();
    void navigate({
      to: '/$patientId/case-presentation/$presentationId',
      params: { patientId, presentationId: created.id },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        aria-describedby={undefined}
        className="flex flex-col gap-0 overflow-hidden p-0 w-[calc(100%-2rem)] max-w-lg max-h-[85dvh]"
      >
        {/* Radix supplies role=dialog on DialogContent; the test/E2E handle lives
            on this inner wrapper (the harness stubs Radix Content + drops props). */}
        <div data-testid="treatment-plans-sheet" className="flex flex-1 flex-col min-h-0">
        {/* Header (pr-10 clears the dialog's built-in close button) */}
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 border-b shrink-0 pr-10 text-left">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <DialogTitle className="text-sm font-semibold">Treatment Plans</DialogTitle>
            {plans.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {plans.length}
              </span>
            )}
          </div>
          {/* 1.1: author a new draft plan. Disabled until provider context resolves. */}
          <button
            type="button"
            onClick={handleCreatePlan}
            disabled={!providerId || isCreating}
            aria-label="New plan"
            className="flex h-8 items-center gap-1 rounded-lg bg-muted px-3 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />
            New plan
          </button>
        </DialogHeader>

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
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No treatment plans. Create one to track approved treatment sequences.
              </p>
              {/* 1.1 + L6: co-locate the primary create action with the empty state. */}
              <button
                type="button"
                onClick={handleCreatePlan}
                disabled={!providerId || isCreating}
                data-testid="treatment-plans-empty-new-btn"
                className="flex items-center gap-1 rounded-lg bg-lemon px-3 py-2 text-xs font-semibold text-lemon-foreground hover:bg-lemon-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-3.5 w-3.5" />
                {isCreating ? 'Creating…' : 'New plan'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {plans.map((plan) => (
                <PlanRow
                  key={plan.id}
                  plan={plan}
                  onUpdate={(id, body) => updatePlan(id, body)}
                  isUpdating={isUpdating}
                  onPresent={(id) => { void presentAndOpen(id); }}
                  isPresenting={isPresenting}
                  canPresent={canPresent}
                />
              ))}
            </div>
          )}

          {/* P1-19: alternate-case option groups */}
          {optionGroupIds && optionGroupIds.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {optionGroupIds.map((gid) => (
                <OptionGroupCard key={gid} patientId={patientId} optionGroupId={gid} />
              ))}
            </div>
          )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
