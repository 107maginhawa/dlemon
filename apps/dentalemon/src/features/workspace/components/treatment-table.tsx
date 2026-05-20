/**
 * TreatmentTable — wireframe-aligned treatment list
 *
 * Columns: Chevron | Tooth | Surface | Condition | Treatment Plan | Done | Status | Total
 *
 * TXTBL-01: Dual subtotals — "This Visit" / "Carried Over" rows above grand total
 * TXTBL-02: Inline price edit — click cell → input; blur saves via useUpdateTreatment
 * TXTBL-03: Dismiss popover — Radix Popover with reason input; confirm calls useUpdateTreatment
 * TXTBL-04: Chevron notes sub-row — local-only expand/collapse
 * TXTBL-05: View Completed / Hide Completed toggle — filters performed|verified rows
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React, { useState } from 'react';
import { Check, ChevronRight, ChevronDown } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@radix-ui/react-popover';
import type { Treatment } from '@/features/workspace/hooks/use-treatments';
import type { TreatmentPlanItem } from '@/features/workspace/hooks/use-treatment-plan';
import type { VisitCard } from '@/features/workspace/components/timeline-carousel';
import { useUpdateTreatment } from '../hooks/use-update-treatment';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';

interface TreatmentTableProps {
  visitId?: string;
  treatments: Treatment[];
  carriedOverItems?: TreatmentPlanItem[];
  visits?: VisitCard[];
  onSelectTreatment?: (id: string) => void;
  selectedTreatmentId?: string | null;
  onMarkDone?: (treatmentId: string, visitId: string, currentStatus: string) => void;
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
    status === 'performed'
      ? 'bg-green-100 text-green-700'
      : status === 'verified'
      ? 'bg-teal-100 text-teal-700'
      : status === 'dismissed'
      ? 'bg-gray-100 text-gray-400'
      : status === 'declined'
      ? 'bg-orange-100 text-orange-700'
      : status === 'diagnosed'
      ? 'bg-amber-100 text-amber-700'
      : status === 'planned'
      ? 'bg-blue-100 text-blue-700'
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
  visitId = '',
  treatments,
  carriedOverItems = [],
  visits = [],
  onSelectTreatment,
  selectedTreatmentId,
  onMarkDone,
  readOnly = false,
}: TreatmentTableProps) {
  // TXTBL-02: inline price edit state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState('');
  // TXTBL-04: notes sub-row state
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  // TXTBL-05: completed toggle
  const [showCompleted, setShowCompleted] = useState(false);
  // TXTBL-03: dismiss popover state
  const [dismissReason, setDismissReason] = useState<Record<string, string>>({});
  const [openDismissId, setOpenDismissId] = useState<string | null>(null);
  // P1.4: informed refusal popover state
  const [refusalReason, setRefusalReason] = useState<Record<string, string>>({});
  const [openDeclineId, setOpenDeclineId] = useState<string | null>(null);

  // TXTBL-02 + TXTBL-03: mutation hook
  const updateMutation = useUpdateTreatment(visitId);

  const hasRows = treatments.length > 0 || carriedOverItems.length > 0;
  const completedCount = treatments.filter(
    (t) => t.status === 'performed' || t.status === 'verified',
  ).length;

  // TXTBL-01: subtotal computations
  // price contract: priceCents (API) ÷ 100 → dollars (display); t.priceAmount already in dollars
  const thisVisitTotal = treatments.reduce((sum, t) => sum + (t.priceAmount ?? 0), 0);
  const carriedOverTotal = carriedOverItems.reduce(
    (sum, i) => sum + (i.priceCents / 100), // price contract: priceCents (API) ÷ 100 → dollars (display)
    0,
  );
  const grandTotal = thisVisitTotal + carriedOverTotal;

  // TXTBL-05: filter displayed treatments
  const displayedTreatments = showCompleted
    ? treatments
    : treatments.filter((t) => t.status !== 'performed' && t.status !== 'verified');

  if (!hasRows) {
    return (
      <div className="flex items-center justify-center h-full min-h-[80px] text-sm text-muted-foreground">
        No treatments recorded for this visit.
      </div>
    );
  }

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden bg-card mx-4 my-3">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border/50">
        <span className="text-sm font-semibold">Treatment Breakdown</span>
        {completedCount > 0 && (
          <button
            type="button"
            data-testid="view-completed-btn"
            onClick={() => setShowCompleted((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showCompleted
              ? `Hide Completed (${completedCount})`
              : `View Completed (${completedCount})`}
          </button>
        )}
      </div>
      <div className="overflow-auto max-h-[450px]">
      <table className="w-full text-sm" aria-label="Treatments">
        <thead className="sticky top-0 bg-muted/30 z-10">
          <tr>
            {/* TXTBL-04: chevron column */}
            <th className="px-2 py-2 w-6" />
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
          {displayedTreatments.map((t) => {
            const isSelected = t.id === selectedTreatmentId;
            const isExpanded = expandedNotesId === t.id;
            const isDismissed = t.status === 'dismissed';
            const isDeclined = t.status === 'declined';
            const isTerminal = isDismissed || isDeclined || t.status === 'verified';
            return (
              <React.Fragment key={t.id}>
                <tr
                  onClick={() => onSelectTreatment?.(t.id)}
                  className={[
                    'border-t border-border/40 transition-colors',
                    isSelected ? 'bg-[#F2F2F7]' : 'hover:bg-[#FFE97D]/10',
                    onSelectTreatment ? 'cursor-pointer' : '',
                  ].join(' ')}
                >
                  {/* TXTBL-04: chevron toggle */}
                  <td className="px-2 py-2 w-6">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedNotesId(isExpanded ? null : t.id);
                      }}
                      aria-label={isExpanded ? 'Collapse notes' : 'Expand notes'}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
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
                    {t.status === 'performed' || t.status === 'verified' ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : !readOnly ? (
                      <button
                        type="button"
                        data-testid="mark-done-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkDone?.(t.id, t.visitId, t.status);
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        Mark Done
                      </button>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={t.status} />
                      {/* TXTBL-03: dismiss popover */}
                      {!readOnly && !isTerminal && (
                        <Popover
                          open={openDismissId === t.id}
                          onOpenChange={(o) => {
                            if (!o) setOpenDismissId(null);
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setOpenDismissId(t.id); }}
                              className="text-[10px] text-destructive hover:underline"
                              aria-label="Dismiss treatment"
                            >
                              Dismiss
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="left"
                            className="w-64 p-4 bg-background border border-border rounded-xl shadow-lg z-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                              Reason (required)
                            </label>
                            <input
                              type="text"
                              value={dismissReason[t.id] ?? ''}
                              onChange={(e) =>
                                setDismissReason((prev) => ({
                                  ...prev,
                                  [t.id]: e.target.value,
                                }))
                              }
                              minLength={3}
                              placeholder="e.g. Patient declined"
                              className="w-full border border-border rounded-xl px-2 py-1.5 text-sm bg-background focus:border-[#FFE97D] outline-none"
                            />
                            <button
                              type="button"
                              disabled={
                                (dismissReason[t.id]?.trim().length ?? 0) < 3 ||
                                updateMutation.isPending
                              }
                              onClick={() => {
                                const reason = dismissReason[t.id]?.trim() ?? '';
                                if (reason.length >= 3) {
                                  updateMutation.mutate(
                                    {
                                      path: { visitId, treatmentId: t.id },
                                      body: { status: 'dismissed', dismissReason: reason },
                                    },
                                    { onSuccess: () => setOpenDismissId(null) },
                                  );
                                }
                              }}
                              aria-label="Confirm dismiss treatment"
                              className="mt-2 w-full rounded-xl bg-destructive/10 text-destructive text-sm py-1.5 font-medium disabled:opacity-50 hover:bg-destructive/20 transition-colors"
                            >
                              Confirm Dismiss
                            </button>
                          </PopoverContent>
                        </Popover>
                      )}
                      {/* P1.4: informed refusal popover */}
                      {!readOnly && !isTerminal && (t.status === 'diagnosed' || t.status === 'planned') && (
                        <Popover
                          open={openDeclineId === t.id}
                          onOpenChange={(o) => { if (!o) setOpenDeclineId(null); }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              data-testid="decline-btn"
                              onClick={(e) => { e.stopPropagation(); setOpenDeclineId(t.id); }}
                              className="text-[10px] text-orange-600 hover:underline"
                              aria-label="Record informed refusal"
                            >
                              Decline
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="left"
                            className="w-64 p-4 bg-background border border-border rounded-xl shadow-lg z-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                              Informed Refusal
                            </p>
                            <p className="text-[10px] text-muted-foreground mb-2">Patient has declined this treatment. Document reason below.</p>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                              Refusal Reason (required)
                            </label>
                            <input
                              type="text"
                              data-testid="refusal-reason-input"
                              value={refusalReason[t.id] ?? ''}
                              onChange={(e) => setRefusalReason((prev) => ({ ...prev, [t.id]: e.target.value }))}
                              minLength={3}
                              placeholder="e.g. Cannot afford, prefers alternative"
                              className="w-full border border-border rounded-xl px-2 py-1.5 text-sm bg-background focus:border-[#FFE97D] outline-none"
                            />
                            <button
                              type="button"
                              data-testid="confirm-decline-btn"
                              disabled={(refusalReason[t.id]?.trim().length ?? 0) < 3 || updateMutation.isPending}
                              onClick={() => {
                                const reason = refusalReason[t.id]?.trim() ?? '';
                                if (reason.length >= 3) {
                                  updateMutation.mutate(
                                    { path: { visitId, treatmentId: t.id }, body: { status: 'declined', refusalReason: reason } },
                                    { onSuccess: () => setOpenDeclineId(null) },
                                  );
                                }
                              }}
                              aria-label="Confirm informed refusal"
                              className="mt-2 w-full rounded-xl bg-orange-50 text-orange-700 text-sm py-1.5 font-medium disabled:opacity-50 hover:bg-orange-100 transition-colors"
                            >
                              Confirm Refusal
                            </button>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </td>
                  {/* TXTBL-02: inline price edit */}
                  <td className="px-4 py-2 text-right tabular-nums">
                    {!readOnly && editingPriceId === t.id ? (
                      <input
                        type="number"
                        autoFocus
                        value={draftPrice}
                        onChange={(e) => setDraftPrice(e.target.value)}
                        onBlur={() => {
                          if (editingPriceId && draftPrice !== '') {
                            const parsed = parseFloat(draftPrice);
                            if (!isNaN(parsed) && parsed >= 0) {
                              const cents = Math.round(parsed * 100);
                              updateMutation.mutate({
                                path: { visitId, treatmentId: t.id },
                                body: { priceCents: cents },
                              });
                            }
                          }
                          setEditingPriceId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingPriceId(null);
                        }}
                        aria-label={`Edit price for treatment ${t.description ?? ''}`}
                        className="w-20 text-right border border-border rounded px-1 text-sm bg-background focus:border-[#FFE97D] outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPriceId(t.id);
                          setDraftPrice(String(t.priceAmount ?? 0));
                        }}
                        className="tabular-nums hover:underline disabled:cursor-default"
                      >
                        {CURRENCY_SYMBOL}
                        {(t.priceAmount ?? 0).toLocaleString(APP_LOCALE)}
                      </button>
                    )}
                  </td>
                </tr>
                {/* TXTBL-04: notes sub-row */}
                {isExpanded && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-2 bg-muted/30"
                    >
                      <textarea
                        rows={2}
                        readOnly={readOnly}
                        value={localNotes[t.id] ?? t.clinicalNotes ?? ''}
                        onChange={(e) =>
                          setLocalNotes((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                        onBlur={() => {
                          const notes = localNotes[t.id];
                          if (!readOnly && notes !== undefined && notes !== (t.clinicalNotes ?? '')) {
                            updateMutation.mutate({
                              path: { visitId, treatmentId: t.id },
                              body: { clinicalNotes: notes },
                            });
                          }
                        }}
                        placeholder="Add notes…"
                        className={`w-full text-sm border border-border rounded px-2 py-1.5 resize-none bg-background focus:border-[#FFE97D] outline-none ${readOnly ? 'opacity-70 cursor-default' : ''}`}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}

          {/* Carried-over separator + rows */}
          {carriedOverItems.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={8}
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
                    <td className="px-2 py-2 w-6" />
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
                      <span className="ml-2 text-[10px] italic text-muted-foreground/60">
                        {fromLabel}
                      </span>
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

          {/* TXTBL-01: dual subtotal rows above grand total */}
          {/* thisVisitTotal is always the grand total of ALL visit treatments (financial total), */}
          {/* regardless of the showCompleted filter — this is intentional for complete billing visibility */}
          {treatments.length > 0 && (
            <tr data-testid="subtotal-this-visit-row" className="border-t border-border/40">
              <td colSpan={7} className="px-4 py-1.5 text-right text-xs text-muted-foreground">
                This Visit (all)
              </td>
              <td className="px-4 py-1.5 text-right tabular-nums text-xs text-muted-foreground">
                {CURRENCY_SYMBOL}
                {thisVisitTotal.toLocaleString(APP_LOCALE)}
              </td>
            </tr>
          )}
          {carriedOverItems.length > 0 && (
            <tr data-testid="subtotal-carried-over-row">
              <td colSpan={7} className="px-4 py-1.5 text-right text-xs text-muted-foreground">
                Carried Over
              </td>
              <td className="px-4 py-1.5 text-right tabular-nums text-xs text-muted-foreground">
                {CURRENCY_SYMBOL}
                {carriedOverTotal.toLocaleString(APP_LOCALE)}
              </td>
            </tr>
          )}

          {/* Grand Total row */}
          {(treatments.length > 0 || carriedOverItems.length > 0) && (
            <tr data-testid="grand-total-row" className="border-t-2 border-border font-semibold">
              <td colSpan={7} className="px-4 py-2 text-right text-sm">
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
    </div>
  );
}
