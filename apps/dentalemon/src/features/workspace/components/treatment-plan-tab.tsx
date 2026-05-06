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
import React from 'react';
import { BRAND_GOLD, BRAND_GOLD_TEXT, CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import { useTreatmentPlan, type TreatmentPlanItem } from '../hooks/use-treatment-plan';

interface TreatmentPlanTabProps {
  patientId: string;
  branchId: string | null;
}

interface TreatmentRowProps {
  treatment: TreatmentPlanItem;
}

function TreatmentRow({ treatment }: TreatmentRowProps) {
  const price = (treatment.priceCents / 100).toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      data-testid="treatment-row"
      className="flex items-start gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors"
    >
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
      </div>

      {/* Price */}
      <div className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        ₱{price}
      </div>
    </div>
  );
}

function GroupSection({
  title,
  treatments,
  testId,
  accentColor,
}: {
  title: string;
  treatments: TreatmentPlanItem[];
  testId: string;
  accentColor: string;
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
        <TreatmentRow key={t.id} treatment={t} />
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
  const { data, isLoading, error } = useTreatmentPlan({ patientId, branchId });

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

  // P1-B: All treatments may have non-pending statuses (e.g. in_progress, completed)
  if (diagnosed.length + planned.length === 0) {
    return <EmptyState />;
  }

  const totalDisplay = (data.totalEstimateCents / 100).toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable treatment groups */}
      <div className="flex-1 overflow-y-auto">
        {diagnosed.length > 0 && (
          <GroupSection
            title="Diagnosed"
            treatments={diagnosed}
            testId="group-diagnosed"
            accentColor="#DC2626"
          />
        )}
        {planned.length > 0 && (
          <GroupSection
            title="Planned"
            treatments={planned}
            testId="group-planned"
            accentColor={BRAND_GOLD_TEXT}
          />
        )}
      </div>

      {/* Cost summary — TXPL-03 */}
      <div
        data-testid="cost-summary"
        role="region"
        aria-label="Treatment cost summary"
        className="shrink-0 border-t bg-background px-4 py-3 flex items-center justify-between"
        style={{ borderTopColor: BRAND_GOLD }}
      >
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{data.treatmentCount}</span>{' '}
          {data.treatmentCount === 1 ? 'treatment' : 'treatments'}
          {data.toothCount > 0 && (
            <>
              {' '}across{' '}
              <span className="font-medium text-foreground">{data.toothCount}</span>{' '}
              {data.toothCount === 1 ? 'tooth' : 'teeth'}
            </>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total estimate</p>
          <p className="text-base font-bold text-foreground tabular-nums">
            {CURRENCY_SYMBOL}{totalDisplay}
          </p>
        </div>
      </div>
    </div>
  );
}
