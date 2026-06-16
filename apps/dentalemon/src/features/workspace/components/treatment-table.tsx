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

import React, { useState, useEffect } from 'react';
import { Check, ChevronRight, ChevronDown } from 'lucide-react';
import type { Treatment } from '@/features/workspace/hooks/use-treatments';
import type { TreatmentPlanItem } from '@/features/workspace/hooks/use-treatment-plan';
import type { VisitCard } from '@/features/workspace/components/timeline-carousel';
import { useUpdateTreatment } from '../hooks/use-update-treatment';
import { useMarkTreatmentDone } from '../hooks/use-mark-treatment-done';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import { DismissTreatmentPopover, DeclineTreatmentPopover } from './treatment-row-popovers';

interface TreatmentTableProps {
  visitId?: string;
  treatments: Treatment[];
  carriedOverItems?: TreatmentPlanItem[];
  visits?: VisitCard[];
  onSelectTreatment?: (id: string) => void;
  selectedTreatmentId?: string | null;
  onMarkDone?: (treatmentId: string, visitId: string, currentStatus: string) => void; // kept for API compat; component now uses useMarkTreatmentDone directly
  readOnly?: boolean;
  /** P0-D: when set, the table is scoped to this FDI tooth (body + counts + totals
   *  all reflect only that tooth — keeps the summary coherent with the rows). */
  selectedTooth?: number | null;
  /** P0-D: clear the tooth scope (show all teeth again). */
  onClearToothFilter?: () => void;
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
  treatments: treatmentsProp,
  carriedOverItems: carriedOverItemsProp = [],
  visits = [],
  onSelectTreatment,
  selectedTreatmentId,
  onMarkDone: _onMarkDone,
  readOnly: readOnlyProp = false,
  selectedTooth = null,
  onClearToothFilter,
}: TreatmentTableProps) {
  // P0-D: scope the whole table to the selected tooth. Every downstream
  // computation (body rows, completed count, subtotals, grand total) reads these
  // scoped arrays, so the summary a user sees always matches the rendered rows
  // (guards the "summary computed from a different source than the body" bug class).
  const treatments = selectedTooth == null
    ? treatmentsProp
    : treatmentsProp.filter((t) => t.toothNumber === selectedTooth);
  const carriedOverItems = selectedTooth == null
    ? carriedOverItemsProp
    : carriedOverItemsProp.filter((i) => i.toothNumber === selectedTooth);
  // FIX-002 coherence: once carry-over actually runs, the copied rows live in the
  // CURRENT visit (so they arrive in `treatments` with carriedOver=true) AND surface in
  // the plan-derived `carriedOverItems`. Drive the main "This Visit" list + subtotal from
  // the NON-carried rows only, so each carried row is displayed and totalled exactly once
  // (in the Carried-Over section) — never double-counted in the Grand Total.
  const nativeTreatments = treatments.filter((t) => !t.carriedOver);
  // WR-01: with no active visit, visitId is '' → inline mutations would hit
  // PATCH /dental/visits//treatments/:id (invalid). Force read-only so no edit,
  // dismiss, price, notes, or mark-done control can fire against an empty visitId.
  const readOnly = readOnlyProp || !visitId;
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

  // Mark Done error tracking — which row triggered the 422
  const [markDoneErrorId, setMarkDoneErrorId] = useState<string | null>(null);

  // TXTBL-02 + TXTBL-03: mutation hook
  const updateMutation = useUpdateTreatment(visitId);

  // Mark Done mutation — used directly so we can show inline consent error
  const {
    markDone,
    isPending: isMarkDonePending,
    isError: isMarkDoneError,
    error: _markDoneError,
  } = useMarkTreatmentDone();

  // Clear error tracking on success
  useEffect(() => {
    if (!isMarkDoneError) {
      setMarkDoneErrorId(null);
    }
  }, [isMarkDoneError]);

  // Reset the completed-toggle when switching visits. The component is reused (not
  // remounted) as the carousel changes visitId, so without this a "Hide/Show" choice
  // would leak from one visit to the next.
  useEffect(() => {
    setShowCompleted(false);
  }, [visitId]);

  const hasRows = nativeTreatments.length > 0 || carriedOverItems.length > 0;
  const completedCount = nativeTreatments.filter(
    (t) => t.status === 'performed' || t.status === 'verified',
  ).length;
  // A visit is "pending" if it has any not-yet-done work. When nothing is pending
  // (e.g. a finished/locked historical visit), there are no rows to focus on, so the
  // hide-completed default would leave the table empty under a real money total.
  const hasPending = nativeTreatments.some(
    (t) => t.status !== 'performed' && t.status !== 'verified',
  );

  // TXTBL-01: subtotal computations
  // price contract: priceCents (API) ÷ 100 → dollars (display); t.priceAmount already in dollars
  // NOTE: this sums ALL native (this-visit, non-carried) treatments, including
  // dismissed/declined-priced ones. Those rows also render (the filter below only hides
  // performed/verified), so visible rows still match this total. Carried-over rows are
  // summed separately below so the Grand Total never counts a carried row twice.
  const thisVisitTotal = nativeTreatments.reduce((sum, t) => sum + (t.priceAmount ?? 0), 0);
  const carriedOverTotal = carriedOverItems.reduce(
    (sum, i) => sum + (i.priceCents / 100), // price contract: priceCents (API) ÷ 100 → dollars (display)
    0,
  );
  const grandTotal = thisVisitTotal + carriedOverTotal;

  // TXTBL-05: filter displayed treatments.
  // Force-show completed rows when nothing is pending, so an all-completed visit never
  // renders an empty body beneath a non-zero Grand Total.
  const effectiveShowCompleted = showCompleted || !hasPending;
  const displayedTreatments = effectiveShowCompleted
    ? nativeTreatments
    : nativeTreatments.filter((t) => t.status !== 'performed' && t.status !== 'verified');

  if (!hasRows) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[80px] gap-2 text-sm text-muted-foreground">
        {selectedTooth != null ? (
          <>
            <span data-testid="tooth-filter-empty">No treatments for tooth #{selectedTooth}.</span>
            {onClearToothFilter && (
              <button
                type="button"
                data-testid="tooth-filter-clear"
                onClick={onClearToothFilter}
                className="text-xs font-medium text-primary hover:underline"
              >
                Show all teeth
              </button>
            )}
          </>
        ) : (
          'No treatments recorded for this visit.'
        )}
      </div>
    );
  }

  // P0-D: rows actually rendered for the active scope (main breakdown + carried).
  // The chip count is derived from this so it can never disagree with the body.
  const visibleRowCount = displayedTreatments.length + carriedOverItems.length;

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden bg-card mx-4 my-3">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border/50">
        <span className="flex items-center gap-2 text-sm font-semibold">
          Treatment Breakdown
          {selectedTooth != null && (
            <span
              data-testid="tooth-filter-chip"
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              Tooth #{selectedTooth}
              <span data-testid="tooth-filter-count" className="tabular-nums">({visibleRowCount})</span>
              {onClearToothFilter && (
                <button
                  type="button"
                  data-testid="tooth-filter-clear"
                  onClick={onClearToothFilter}
                  aria-label="Show all teeth"
                  className="ml-0.5 rounded-full px-1 text-primary/70 hover:text-primary"
                >
                  ×
                </button>
              )}
            </span>
          )}
        </span>
        {/* Only show the toggle when it has a job: there is completed work to hide AND
            pending work to fall back to. On an all-completed visit the rows are always
            shown (effectiveShowCompleted), so a no-op toggle is hidden. Edge: if the last
            pending item is marked done mid-session the toggle disappears and completed
            rows stay visible — acceptable, the table is never left empty. */}
        {hasPending && completedCount > 0 && (
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
                  data-testid={`treatment-row-${t.id}`}
                  onClick={() => onSelectTreatment?.(t.id)}
                  className={[
                    'border-t border-border/40 transition-colors',
                    isSelected ? 'bg-[#F2F2F7]' : 'hover:bg-lemon/10',
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
                    {t.description || '—'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {t.status === 'performed' || t.status === 'verified' ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : !readOnly ? (
                      <div className="flex flex-col items-center">
                        <button
                          type="button"
                          data-testid="mark-done-btn"
                          disabled={isMarkDonePending}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMarkDoneErrorId(t.id);
                            markDone(t.id, t.visitId, t.status as Parameters<typeof markDone>[2]);
                          }}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-xs text-primary hover:underline disabled:opacity-50"
                        >
                          Mark Done
                        </button>
                        {isMarkDoneError && markDoneErrorId === t.id && (
                          <p className="text-xs text-destructive mt-1">
                            Consent required — ask patient to sign before completing.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={t.status} />
                      {/* P1-21: scheduled-to-appointment indicator (proposed → scheduled → done). */}
                      {t.appointmentId ? (
                        <span
                          className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700"
                          title="Linked to a scheduled appointment"
                        >
                          Scheduled
                        </span>
                      ) : null}
                      {/* TXTBL-03: dismiss popover */}
                      {!readOnly && !isTerminal && (
                        <DismissTreatmentPopover
                          treatmentId={t.id}
                          open={openDismissId === t.id}
                          reason={dismissReason[t.id] ?? ''}
                          isPending={updateMutation.isPending}
                          onOpenChange={(o) => setOpenDismissId(o ? t.id : null)}
                          onReasonChange={(v) =>
                            setDismissReason((prev) => ({ ...prev, [t.id]: v }))
                          }
                          onConfirm={() => {
                            const reason = (dismissReason[t.id] ?? '').trim();
                            updateMutation.mutate(
                              {
                                path: { visitId, treatmentId: t.id },
                                body: { status: 'dismissed', dismissReason: reason },
                              },
                              { onSuccess: () => setOpenDismissId(null) },
                            );
                          }}
                        />
                      )}
                      {/* P1.4: informed refusal popover */}
                      {!readOnly && !isTerminal && (t.status === 'diagnosed' || t.status === 'planned') && (
                        <DeclineTreatmentPopover
                          treatmentId={t.id}
                          open={openDeclineId === t.id}
                          reason={refusalReason[t.id] ?? ''}
                          isPending={updateMutation.isPending}
                          onOpenChange={(o) => setOpenDeclineId(o ? t.id : null)}
                          onReasonChange={(v) =>
                            setRefusalReason((prev) => ({ ...prev, [t.id]: v }))
                          }
                          onConfirm={() => {
                            const reason = (refusalReason[t.id] ?? '').trim();
                            updateMutation.mutate(
                              {
                                path: { visitId, treatmentId: t.id },
                                body: { status: 'declined', refusalReason: reason },
                              },
                              { onSuccess: () => setOpenDeclineId(null) },
                            );
                          }}
                        />
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
                        className="w-20 text-right border border-border rounded px-1 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
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
                        className={`w-full text-sm border border-border rounded px-2 py-1.5 resize-none bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none ${readOnly ? 'opacity-70 cursor-default' : ''}`}
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
          {nativeTreatments.length > 0 && (
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
          {(nativeTreatments.length > 0 || carriedOverItems.length > 0) && (
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
