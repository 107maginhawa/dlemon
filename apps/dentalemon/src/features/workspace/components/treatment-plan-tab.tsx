/**
 * TreatmentPlanTab — TXPL-01, TXPL-02, TXPL-03
 *
 * Displays all pending treatments for a patient grouped by urgency:
 *   - "Diagnosed" (status === 'diagnosed') — conditions found, immediate attention
 *   - "Planned" (status === 'planned') — treatments scheduled for future visits
 *
 * Shows total cost summary at the bottom.
 *
 * Wireframe: docs/prd/context/wireframes/treatment-plan.html
 */
import React, { useState } from 'react';
import { BRAND_GOLD, BRAND_GOLD_TEXT, CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import { useTreatmentPlan, type TreatmentPlanItem, type TreatmentPhase } from '../hooks/use-treatment-plan';

/**
 * P1-18: clinical sequencing phases, in canonical clinical order, with the
 * human-facing labels a clinician uses to communicate the plan sequence.
 */
const PHASE_ORDER: TreatmentPhase[] = [
  'systemic',
  'disease_control',
  're_evaluation',
  'definitive',
  'maintenance',
];

const PHASE_LABELS: Record<TreatmentPhase, string> = {
  systemic: 'Phase 1 · Systemic / Urgent',
  disease_control: 'Phase 2 · Disease Control',
  re_evaluation: 'Phase 3 · Re-evaluation',
  definitive: 'Phase 4 · Definitive',
  maintenance: 'Phase 5 · Maintenance',
};

/** Short labels for the phase-assignment <select> (distinct from the grouped
 *  section headers above, which read "Phase N · …"). */
const PHASE_SHORT_LABELS: Record<TreatmentPhase, string> = {
  systemic: 'Systemic / Urgent',
  disease_control: 'Disease Control',
  re_evaluation: 'Re-evaluation',
  definitive: 'Definitive',
  maintenance: 'Maintenance',
};

const PHASE_ACCENTS: Record<TreatmentPhase, string> = {
  systemic: '#DC2626',
  disease_control: '#EA580C',
  re_evaluation: '#7C3AED',
  definitive: BRAND_GOLD_TEXT,
  maintenance: '#059669',
};

const PHASE_RANK = (p: TreatmentPhase | null | undefined): number =>
  p ? PHASE_ORDER.indexOf(p) : 99;

interface TreatmentPlanTabProps {
  patientId: string;
  branchId: string | null;
}

interface TreatmentRowProps {
  treatment: TreatmentPlanItem;
  onDecline: (treatmentId: string, visitId: string, reason: string) => void;
  onAssignPhase: (treatmentId: string, visitId: string, phase: TreatmentPhase) => void;
}

function TreatmentRow({ treatment, onDecline, onAssignPhase }: TreatmentRowProps) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  const price = (treatment.priceCents / 100).toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleSave = () => {
    onDecline(treatment.id, treatment.visitId, reason);
    setDeclining(false);
    setReason('');
  };

  if (treatment.status === 'declined') {
    return (
      <div
        data-testid="treatment-row"
        className="flex items-start gap-3 px-4 py-3 border-b border-border/40 bg-muted/20 opacity-60"
      >
        <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">
          {treatment.toothNumber ?? '—'}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-muted-foreground line-through">{treatment.description || '—'}</span>
          <p className="text-xs text-destructive mt-0.5">Declined{treatment.reason ? `: ${treatment.reason}` : ''}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="treatment-row"
      className="flex flex-col border-b border-border/40"
    >
      <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
        {/* Tooth indicator */}
        <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">
          {treatment.toothNumber ?? '—'}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {treatment.cdtCode && (
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-muted text-muted-foreground">
                {treatment.cdtCode}
              </span>
            )}
            <span
              className="text-sm font-medium text-foreground truncate"
              title={treatment.description || undefined}
            >
              {treatment.description || '—'}
            </span>
          </div>
          {treatment.surfaces && treatment.surfaces.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Surfaces: {treatment.surfaces.join(', ')}
            </p>
          )}
          {/* J06 / Gap #14: assign a clinical sequencing phase. */}
          <select
            data-testid="phase-select"
            aria-label={`Treatment phase for ${treatment.description || 'treatment'}`}
            value={treatment.phase ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v) onAssignPhase(treatment.id, treatment.visitId, v as TreatmentPhase);
            }}
            className="mt-1 text-xs border border-border rounded px-1.5 py-0.5 bg-background text-muted-foreground max-w-[15rem]"
          >
            <option value="" disabled>
              Assign phase…
            </option>
            {PHASE_ORDER.map((p) => (
              <option key={p} value={p}>
                {PHASE_SHORT_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        {/* Price + Decline */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums text-foreground">₱{price}</span>
          <button
            type="button"
            data-testid="decline-btn"
            onClick={() => setDeclining((v) => !v)}
            className="text-[10px] text-muted-foreground hover:text-destructive underline"
          >
            Decline
          </button>
        </div>
      </div>

      {declining && (
        <div className="px-4 pb-3 flex flex-col gap-2 bg-muted/10">
          <input
            type="text"
            aria-label="Refusal reason"
            placeholder="Enter refusal reason…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full text-sm border border-border rounded px-2 py-1 bg-background"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setDeclining(false); setReason(''); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="confirm-decline-btn"
              onClick={handleSave}
              className="text-xs bg-destructive text-destructive-foreground px-3 py-1 rounded hover:opacity-90"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupSection({
  title,
  treatments,
  testId,
  accentColor,
  onDecline,
  onAssignPhase,
}: {
  title: string;
  treatments: TreatmentPlanItem[];
  testId: string;
  accentColor: string;
  onDecline: (treatmentId: string, visitId: string, reason: string) => void;
  onAssignPhase: (treatmentId: string, visitId: string, phase: TreatmentPhase) => void;
}) {
  return (
    <section data-testid={testId} className="mb-2" aria-label={title}>
      <h3
        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide border-b border-border"
        style={{ color: accentColor }}
      >
        {title}
        <span className="ml-2 text-muted-foreground font-normal normal-case">
          ({treatments.length})
        </span>
      </h3>
      {treatments.map((t) => (
        <TreatmentRow key={t.id} treatment={t} onDecline={onDecline} onAssignPhase={onAssignPhase} />
      ))}
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4" data-testid="treatment-plan-loading">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 rounded bg-muted animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-2 text-center p-8"
      data-testid="treatment-plan-empty"
    >
      <p className="text-sm font-medium text-foreground">No pending treatments</p>
      <p className="text-xs text-muted-foreground">
        Treatments diagnosed during visits will appear here.
      </p>
    </div>
  );
}

export function TreatmentPlanTab({ patientId, branchId }: TreatmentPlanTabProps) {
  // Hook must be called unconditionally (Rules of Hooks)
  const { data, isLoading, error, acceptPlan, isAccepting, declineTreatment, assignPhase } = useTreatmentPlan({ patientId, branchId });

  // P1-A: Empty/null branchId — query is disabled; surface this explicitly
  // so clinicians don't see a misleading "No pending treatments" empty state
  if (!branchId) {
    return (
      <div className="flex h-full items-center justify-center p-8" data-testid="treatment-plan-no-branch">
        <p className="text-sm text-muted-foreground">Branch context unavailable. Please re-select your branch.</p>
      </div>
    );
  }

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8" data-testid="treatment-plan-error">
        <p className="text-sm text-destructive">Failed to load treatment plan. Please try again.</p>
      </div>
    );
  }

  if (!data || data.treatments.length === 0) {
    return <EmptyState />;
  }

  const diagnosed = data.treatments.filter((t) => t.status === 'diagnosed');
  const planned = data.treatments.filter((t) => t.status === 'planned');
  const declined = data.treatments.filter((t) => t.status === 'declined');

  // P1-B: All treatments may have non-pending statuses (e.g. in_progress, completed)
  if (diagnosed.length + planned.length + declined.length === 0) {
    return <EmptyState />;
  }

  // P1-18: when any pending item carries a clinical phase, group + sequence the
  // plan by phase (stabilise → control → re-eval → definitive → maintenance)
  // instead of by status. Items are pre-sorted by (phase, priority) on the server.
  const active = [...diagnosed, ...planned];
  const hasPhases = active.some((t) => !!t.phase);
  const phaseGroups: { phase: TreatmentPhase; items: TreatmentPlanItem[] }[] = hasPhases
    ? PHASE_ORDER
        .map((phase) => ({
          phase,
          items: active
            .filter((t) => t.phase === phase)
            .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)),
        }))
        .filter((g) => g.items.length > 0)
    : [];
  const unphased = hasPhases
    ? active.filter((t) => PHASE_RANK(t.phase) === 99)
    : [];

  const totalDisplay = (data.totalEstimateCents / 100).toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="treatment-plan-tab">
      {/* Scrollable treatment groups */}
      <div className="flex-1 overflow-y-auto">
        {hasPhases ? (
          <>
            {/* P1-18: clinical-phase sequencing view */}
            {phaseGroups.map((g) => (
              <GroupSection
                key={g.phase}
                title={PHASE_LABELS[g.phase]}
                treatments={g.items}
                testId={`group-phase-${g.phase}`}
                accentColor={PHASE_ACCENTS[g.phase]}
                onDecline={declineTreatment}
                onAssignPhase={assignPhase}
              />
            ))}
            {unphased.length > 0 && (
              <GroupSection
                title="Unphased"
                treatments={unphased}
                testId="group-unphased"
                accentColor="#6B7280"
                onDecline={declineTreatment}
                onAssignPhase={assignPhase}
              />
            )}
          </>
        ) : (
          <>
            {diagnosed.length > 0 && (
              <GroupSection
                title="Diagnosed"
                treatments={diagnosed}
                testId="group-diagnosed"
                accentColor="#DC2626"
                onDecline={declineTreatment}
                onAssignPhase={assignPhase}
              />
            )}
            {planned.length > 0 && (
              <GroupSection
                title="Planned"
                treatments={planned}
                testId="group-planned"
                accentColor={BRAND_GOLD_TEXT}
                onDecline={declineTreatment}
                onAssignPhase={assignPhase}
              />
            )}
          </>
        )}
        {declined.length > 0 && (
          <GroupSection
            title="Declined"
            treatments={declined}
            testId="group-declined"
            accentColor="#6B7280"
            onDecline={declineTreatment}
            onAssignPhase={assignPhase}
          />
        )}
      </div>

      {/* Cost summary + Accept — TXPL-03 / J09 */}
      <div
        data-testid="cost-summary"
        role="region"
        aria-label="Treatment cost summary"
        className="shrink-0 border-t bg-background px-4 py-3 flex items-center justify-between gap-3"
        style={{ borderTopColor: BRAND_GOLD }}
      >
        <div className="text-sm text-muted-foreground flex-1">
          <span className="font-medium text-foreground">{data.treatmentCount}</span>{' '}
          {data.treatmentCount === 1 ? 'treatment' : 'treatments'}
          {data.toothCount > 0 && (
            <>
              {' '}across{' '}
              <span className="font-medium text-foreground">{data.toothCount}</span>{' '}
              {data.toothCount === 1 ? 'tooth' : 'teeth'}
            </>
          )}
          <p className="text-xs mt-0.5">
            Total: <span className="font-semibold text-foreground">{CURRENCY_SYMBOL}{totalDisplay}</span>
          </p>
        </div>
        <button
          type="button"
          data-testid="accept-plan-btn"
          onClick={() => acceptPlan()}
          disabled={isAccepting}
          className="shrink-0 h-9 px-4 rounded-xl bg-lemon text-lemon-foreground text-xs font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
        >
          {isAccepting ? 'Accepting…' : 'Accept Plan'}
        </button>
      </div>
    </div>
  );
}
