/**
 * TreatmentTable — wireframe-aligned treatment list
 *
 * Columns: Tooth | Surface | Condition | Treatment Plan | Done | Status | Total
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React from 'react';
import { Check } from 'lucide-react';
import type { Treatment } from '@/features/workspace/hooks/use-treatments';
import type { TreatmentPlanItem } from '@/features/workspace/hooks/use-treatment-plan';
import type { VisitCard } from '@/features/workspace/components/timeline-carousel';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';

interface TreatmentTableProps {
  treatments: Treatment[];
  carriedOverItems?: TreatmentPlanItem[];
  visits?: VisitCard[];
  onSelectTreatment?: (id: string) => void;
  selectedTreatmentId?: string | null;
  onMarkDone?: (treatmentId: string, visitId: string) => void;
  readOnly?: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: Treatment['status'] }) {
  const classes =
    status === 'completed'
      ? 'bg-green-100 text-green-700'
      : status === 'diagnosed' || status === 'planned'
      ? 'bg-blue-100 text-blue-700'
      : status === 'in_progress'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-gray-100 text-gray-500';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${classes}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

export function TreatmentTable({
  treatments,
  carriedOverItems = [],
  visits = [],
  onSelectTreatment,
  selectedTreatmentId,
  onMarkDone,
  readOnly = false,
}: TreatmentTableProps) {
  const hasRows = treatments.length > 0 || carriedOverItems.length > 0;
  const completedCount = treatments.filter((t) => t.status === 'completed').length;
  const grandTotal = treatments.reduce((sum, t) => sum + (t.priceAmount ?? 0), 0);

  if (!hasRows) {
    return (
      <div className="flex items-center justify-center h-full min-h-[80px] text-sm text-muted-foreground">
        No treatments recorded for this visit.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-sm font-semibold">Treatment Breakdown</span>
        {completedCount > 0 && (
          <button
            type="button"
            data-testid="view-completed-btn"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View Completed ({completedCount})
          </button>
        )}
      </div>
    <table className="w-full text-sm" aria-label="Treatments">
      <thead className="sticky top-0 bg-muted/60 z-10">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Tooth</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Surface</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Condition</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Treatment Plan</th>
          <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">Done</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
        </tr>
      </thead>
      <tbody>
        {/* Current-visit treatments */}
        {treatments.map((t) => {
          const isSelected = t.id === selectedTreatmentId;
          return (
            <tr
              key={t.id}
              onClick={() => onSelectTreatment?.(t.id)}
              className={[
                'border-t border-border/40 transition-colors',
                isSelected ? 'bg-[#F2F2F7]' : 'hover:bg-[#FFE97D]/10',
                onSelectTreatment ? 'cursor-pointer' : '',
              ].join(' ')}
            >
              <td className="px-4 py-2 font-medium tabular-nums">
                {t.toothNumber ?? '—'}
              </td>
              <td className="px-4 py-2 text-muted-foreground text-xs">
                {t.surfaces?.join(', ') || '—'}
              </td>
              <td className="px-4 py-2 text-muted-foreground text-xs truncate max-w-[120px]">
                {t.conditionCode ?? '—'}
              </td>
              <td className="px-4 py-2 text-muted-foreground truncate max-w-[200px]">
                {t.description ?? t.procedureName ?? '—'}
              </td>
              <td className="px-4 py-2 text-center">
                {t.status === 'completed' ? (
                  <Check className="h-4 w-4 text-green-600 mx-auto" />
                ) : !readOnly ? (
                  <button
                    type="button"
                    data-testid="mark-done-btn"
                    onClick={() => onMarkDone?.(t.id, t.visitId)}
                    className="text-xs text-primary hover:underline"
                  >
                    Mark Done
                  </button>
                ) : null}
              </td>
              <td className="px-4 py-2">
                <StatusBadge status={t.status} />
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {CURRENCY_SYMBOL}
                {(t.priceAmount ?? 0).toLocaleString(APP_LOCALE)}
              </td>
            </tr>
          );
        })}

        {/* Carried-over separator + rows */}
        {carriedOverItems.length > 0 && (
          <>
            <tr>
              <td
                colSpan={7}
                className="px-4 py-1.5 bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border"
              >
                Carried Over from Previous Visits
              </td>
            </tr>
            {carriedOverItems.map((item) => {
              const sourceVisit = visits.find((v) => v.id === item.visitId);
              const fromLabel = sourceVisit
                ? `from ${formatDate(sourceVisit.createdAt)}`
                : 'from prior visit';
              return (
                <tr
                  key={item.id}
                  className="border-t border-border/40 opacity-60 hover:opacity-80 bg-muted/20"
                >
                  <td className="px-4 py-2 font-medium tabular-nums">
                    {item.toothNumber ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {item.surfaces?.join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs truncate max-w-[120px]">
                    {item.conditionCode ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground truncate max-w-[200px]">
                    <span>{item.description ?? '—'}</span>
                    <span className="ml-2 text-[10px] italic text-muted-foreground/60">{fromLabel}</span>
                  </td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold capitalize bg-gray-100 text-gray-500">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {CURRENCY_SYMBOL}
                    {(item.priceCents / 100).toLocaleString(APP_LOCALE)}
                  </td>
                </tr>
              );
            })}
          </>
        )}
        {/* Grand Total row */}
        {treatments.length > 0 && (
          <tr data-testid="grand-total-row" className="border-t-2 border-border font-semibold">
            <td colSpan={6} className="px-4 py-2 text-right text-sm">
              Grand Total
            </td>
            <td className="px-4 py-2 text-right tabular-nums text-sm">
              {CURRENCY_SYMBOL}
              {grandTotal.toLocaleString(APP_LOCALE)}
            </td>
          </tr>
        )}
      </tbody>
    </table>
    </div>
  );
}
