/**
 * ClaimDetail — claim header + per-line breakdown + line editor (Phase 1b · B/C).
 *
 * Read-only view of a single insurance claim and its derived lines, plus an
 * inline line editor (add line / edit billed + description) that is gated on
 * canWrite AND an editable claim status (draft / ready — mirrors the backend
 * addInsuranceClaimLine gate). Shares the sheet idiom (useSheetA11y, 44px close
 * target, rem type scale).
 */

import React, { useState } from 'react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { useClaimDetail, useClaimLineMutations, useCoverageEstimate } from '../hooks/use-insurance-claims';
import {
  formatPeso,
  claimStatusClass,
  CLAIM_STATUS_LABELS,
  claimOutstandingCents,
  coverageSplitLabel,
  isClaimEditable,
} from './insurance.helpers';

export interface ClaimDetailProps {
  claimId: string;
  open: boolean;
  onClose: () => void;
  canWrite?: boolean;
  branchId?: string | null;
}

const LINE_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  covered: 'Covered',
  partial: 'Partial',
  disallowed: 'Disallowed',
};

/** Parse a peso string ("30.00") to integer centavos. */
function pesoToCents(v: string): number {
  return Math.round(Number(v) * 100) || 0;
}

export function ClaimDetail({ claimId, open, onClose, canWrite = false, branchId }: ClaimDetailProps) {
  const { containerRef } = useSheetA11y({ open, onClose });
  const { claim, isLoading } = useClaimDetail(open ? claimId : null);
  const { addLine, updateLine, isMutating } = useClaimLineMutations(claimId, branchId);
  const { estimate, result: estimateResult, isEstimating } = useCoverageEstimate();

  // Add-line form
  const [newCdt, setNewCdt] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newBilled, setNewBilled] = useState('');
  // Per-line edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBilled, setEditBilled] = useState('');
  const [editDescription, setEditDescription] = useState('');

  if (!open) return null;

  const editable = canWrite && claim != null && isClaimEditable(claim.status);

  async function handleAddLine() {
    if (!newCdt.trim() || !newBilled.trim()) return;
    await addLine({ cdtCode: newCdt.trim(), description: newDescription.trim(), billedAmountCents: pesoToCents(newBilled) });
    setNewCdt('');
    setNewDescription('');
    setNewBilled('');
  }

  function startEdit(lineId: string, billedCents: number, description: string) {
    setEditingId(lineId);
    setEditBilled((billedCents / 100).toFixed(2));
    setEditDescription(description);
  }

  async function handleSaveLine(lineId: string) {
    await updateLine({ lineId, billedAmountCents: pesoToCents(editBilled), description: editDescription });
    setEditingId(null);
  }

  async function handleEstimate() {
    if (!claim) return;
    await estimate({
      patientId: claim.patientId,
      insuranceProfileId: claim.insuranceProfileId,
      authorizationId: claim.authorizationId ?? undefined,
      lines: claim.lines.map((l) => ({ cdtCode: l.cdtCode, description: l.description, billedAmountCents: l.billedAmountCents })),
    });
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Insurance Claim Detail">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div data-testid="claim-detail" className="relative w-full max-w-[640px] max-h-[88vh] bg-background rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-[52px] border-b flex-shrink-0">
          <h2 className="text-base font-semibold tracking-tight">
            {claim ? claim.claimNumber : 'Claim'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm">✕</button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-5 overflow-y-auto">
          {isLoading || !claim ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}
            </div>
          ) : (
            <>
              {/* Status + money rollup */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${claimStatusClass(claim.status)}`}>
                  {CLAIM_STATUS_LABELS[claim.status]}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Billed', value: claim.billedAmountCents },
                  { label: 'Payer paid', value: claim.paidByPayerCents },
                  { label: 'Outstanding', value: claimOutstandingCents(claim) },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-border px-3 py-2.5">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</div>
                    <div className="text-sm font-semibold tabular-nums mt-0.5">{formatPeso(c.value)}</div>
                  </div>
                ))}
              </div>

              {/* Line breakdown */}
              <section className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lines</span>
                {claim.lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-xl border border-border px-3 py-2.5">No lines on this claim.</p>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-secondary/30">
                          <th className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 py-2">CDT</th>
                          <th className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 py-2">Description</th>
                          <th className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 py-2">Billed</th>
                          <th className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 py-2">Approved</th>
                          <th className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 py-2">Paid</th>
                          <th className={`text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 py-2 ${editable ? 'text-right' : 'text-left'}`}>{editable ? 'Action' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {claim.lines.map((l) => (
                          editable && editingId === l.id ? (
                            <tr key={l.id} className="border-t border-border bg-secondary/20" data-testid={`claim-line-${l.id}`}>
                              <td className="px-3 py-2 text-sm font-medium">{l.cdtCode}</td>
                              <td className="px-3 py-2">
                                <input
                                  value={editDescription}
                                  onChange={(e) => setEditDescription(e.target.value)}
                                  data-testid={`edit-line-description-${l.id}`}
                                  className="h-8 px-2 w-full rounded-lg border border-border text-sm"
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  value={editBilled}
                                  onChange={(e) => setEditBilled(e.target.value)}
                                  inputMode="decimal"
                                  data-testid={`edit-line-billed-${l.id}`}
                                  className="h-8 px-2 w-24 rounded-lg border border-border text-sm tabular-nums text-right"
                                />
                              </td>
                              <td className="px-3 py-2 text-sm tabular-nums text-right text-muted-foreground">—</td>
                              <td className="px-3 py-2 text-sm tabular-nums text-right text-muted-foreground">—</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <button type="button" onClick={() => handleSaveLine(l.id)} disabled={isMutating} data-testid={`save-line-${l.id}`} className="h-9 px-3 rounded-lg bg-lemon text-lemon-foreground text-xs font-semibold hover:bg-lemon-hover disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none">Save</button>
                                  <button type="button" onClick={() => setEditingId(null)} className="h-9 px-3 min-w-[4rem] rounded-lg border border-border text-xs hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring outline-none">Cancel</button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr key={l.id} className="border-t border-border" data-testid={`claim-line-${l.id}`}>
                              <td className="px-3 py-2 text-sm font-medium">{l.cdtCode}</td>
                              <td className="px-3 py-2 text-sm">{l.description}</td>
                              <td className="px-3 py-2 text-sm tabular-nums text-right">{formatPeso(l.billedAmountCents)}</td>
                              <td className="px-3 py-2 text-sm tabular-nums text-right">{formatPeso(l.approvedAmountCents ?? 0)}</td>
                              <td className="px-3 py-2 text-sm tabular-nums text-right">{formatPeso(l.paidAmountCents)}</td>
                              <td className="px-3 py-2 text-xs text-right">
                                {editable ? (
                                  <button type="button" onClick={() => startEdit(l.id, l.billedAmountCents, l.description)} data-testid={`edit-line-${l.id}`} className="h-9 px-3 rounded-lg bg-secondary/60 text-xs font-medium hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring outline-none">Edit</button>
                                ) : (
                                  <span className="text-muted-foreground">{LINE_STATUS_LABEL[l.status] ?? l.status}</span>
                                )}
                              </td>
                            </tr>
                          )
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add-line form (editable claims only) */}
                {editable && (
                  <div className="rounded-xl border border-dashed border-border px-3 py-3 flex flex-wrap items-end gap-2" data-testid="add-line-form">
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">CDT</span>
                      <input value={newCdt} onChange={(e) => setNewCdt(e.target.value)} data-testid="add-line-cdt" placeholder="D0220" className="h-9 px-2 w-24 rounded-lg border border-border text-sm" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs flex-1 min-w-[8rem]">
                      <span className="text-muted-foreground">Description</span>
                      <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} data-testid="add-line-description" placeholder="Procedure" className="h-9 px-2 w-full rounded-lg border border-border text-sm" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Billed (₱)</span>
                      <input value={newBilled} onChange={(e) => setNewBilled(e.target.value)} inputMode="decimal" data-testid="add-line-billed" placeholder="0.00" className="h-9 px-2 w-28 rounded-lg border border-border text-sm tabular-nums text-right" />
                    </label>
                    <button type="button" onClick={handleAddLine} disabled={isMutating || !newCdt.trim() || !newBilled.trim()} data-testid="add-line-submit" className="h-9 px-4 rounded-lg bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none">
                      {isMutating ? 'Adding…' : 'Add line'}
                    </button>
                  </div>
                )}
              </section>

              {/* Coverage estimate (read-only; HMO-covered vs patient split) */}
              {claim.lines.length > 0 && (
                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Coverage estimate</span>
                    <button type="button" onClick={handleEstimate} disabled={isEstimating} data-testid="estimate-coverage-btn" className="h-9 px-3 rounded-lg bg-secondary/60 text-xs font-medium hover:bg-secondary disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none">
                      {isEstimating ? 'Estimating…' : estimateResult ? 'Re-estimate' : 'Estimate coverage'}
                    </button>
                  </div>
                  {estimateResult && (
                    <div className="rounded-xl border border-border px-3 py-2.5 flex flex-col gap-1" data-testid="coverage-estimate">
                      <div className="text-sm font-medium">
                        {coverageSplitLabel(estimateResult.estimatedCoveredCents, estimateResult.estimatedPatientPortionCents)}
                      </div>
                      {estimateResult.cappedByAnnualLimit && (
                        <div className="text-xs text-amber-700">Capped by remaining annual limit.</div>
                      )}
                      {estimateResult.uncoveredProcedures.length > 0 && (
                        <div className="text-xs text-muted-foreground">No coverage: {estimateResult.uncoveredProcedures.join(', ')}</div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 px-5 h-16 border-t flex-shrink-0">
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}
