/**
 * ClaimDetail — claim header + per-line breakdown (Phase 1b · B).
 *
 * Read-only view of a single insurance claim and its derived lines. Shares the
 * sheet idiom (useSheetA11y, 44px close target, rem type scale). Sub-slices C
 * (line editor) and D (coverage estimate) extend this surface.
 */

import React from 'react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { useClaimDetail } from '../hooks/use-insurance-claims';
import {
  formatPeso,
  claimStatusClass,
  CLAIM_STATUS_LABELS,
  claimOutstandingCents,
} from './insurance.helpers';

export interface ClaimDetailProps {
  claimId: string;
  open: boolean;
  onClose: () => void;
}

const LINE_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  covered: 'Covered',
  partial: 'Partial',
  disallowed: 'Disallowed',
};

export function ClaimDetail({ claimId, open, onClose }: ClaimDetailProps) {
  useSheetA11y({ open, onClose });
  const { claim, isLoading } = useClaimDetail(open ? claimId : null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Insurance Claim Detail">
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
                          <th className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {claim.lines.map((l) => (
                          <tr key={l.id} className="border-t border-border" data-testid={`claim-line-${l.id}`}>
                            <td className="px-3 py-2 text-sm font-medium">{l.cdtCode}</td>
                            <td className="px-3 py-2 text-sm">{l.description}</td>
                            <td className="px-3 py-2 text-sm tabular-nums text-right">{formatPeso(l.billedAmountCents)}</td>
                            <td className="px-3 py-2 text-sm tabular-nums text-right">{formatPeso(l.approvedAmountCents ?? 0)}</td>
                            <td className="px-3 py-2 text-sm tabular-nums text-right">{formatPeso(l.paidAmountCents)}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{LINE_STATUS_LABEL[l.status] ?? l.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
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
