/**
 * ClaimsWorklist — P1-26 insurance claims worklist + AR-by-payer aging.
 *
 * Lists insurance claims (filter by status), shows the payer-AR aging summary,
 * and provides submit (mark submitted + attach payer reference) and record-
 * remittance actions on a selected claim. ₱ / en-PH throughout. Insurance is
 * opt-in: this surface only appears for branches that work with payers.
 */

import React, { useState } from 'react';
import { useInsuranceClaims, usePayerArAging, useClaimMutations } from '../hooks/use-insurance-claims';
import { ClaimCreate } from './claim-create';
import { ClaimDetail } from './claim-detail';
import { ListErrorState } from '@/components/list-error-state';
import {
  formatPeso,
  claimStatusClass,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_FILTERS,
  canSubmitClaim,
  canRecordRemittance,
  claimOutstandingCents,
  type InsuranceClaimRow,
  type InsuranceClaimStatus,
  type PayerArRow,
} from './insurance.helpers';

export interface ClaimsWorklistProps {
  branchId?: string | null;
  canWrite?: boolean;
}

const PAYER_AGING_COLS: Array<{ key: keyof PayerArRow; label: string }> = [
  { key: 'currentCents', label: 'Current' },
  { key: 'days30Cents', label: '31–60' },
  { key: 'days60Cents', label: '61–90' },
  { key: 'days90PlusCents', label: '90+' },
  { key: 'totalOutstandingCents', label: 'Total' },
];

export function ClaimsWorklist({ branchId, canWrite = false }: ClaimsWorklistProps) {
  const [statusFilter, setStatusFilter] = useState<InsuranceClaimStatus | 'all'>('all');
  const { claims, isLoading, error, refetch } = useInsuranceClaims({
    branchId,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const { aging } = usePayerArAging({ branchId });
  const { submit, remit, markReady, isSubmitting, isRemitting } = useClaimMutations({ branchId });

  const [showCreate, setShowCreate] = useState(false);
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [payerReference, setPayerReference] = useState('');
  const [remitAmount, setRemitAmount] = useState('');
  const [disallowAmount, setDisallowAmount] = useState('');

  async function handleSubmit(claim: InsuranceClaimRow) {
    if (claim.status === 'draft') await markReady(claim.id);
    await submit({ claimId: claim.id, payerReference: payerReference || undefined, submissionChannel: 'portal' });
    setActionFor(null);
    setPayerReference('');
  }

  async function handleRemit(claim: InsuranceClaimRow) {
    const amountCents = Math.round(Number(remitAmount) * 100) || 0;
    const disallowanceCents = Math.round(Number(disallowAmount) * 100) || 0;
    await remit({ claimId: claim.id, amountCents, disallowanceCents: disallowanceCents || undefined, remittanceReference: payerReference || undefined });
    setActionFor(null);
    setRemitAmount('');
    setDisallowAmount('');
    setPayerReference('');
  }

  return (
    <div className="flex flex-col gap-4" data-testid="claims-worklist">
      {/* Header: title + originate a new claim */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Insurance claims</h2>
        {canWrite && (
          <button
            type="button"
            data-testid="new-claim-btn"
            onClick={() => setShowCreate(true)}
            className="h-8 px-3 rounded-lg bg-lemon text-lemon-foreground text-xs font-semibold hover:bg-lemon-hover transition-colors"
          >
            New claim
          </button>
        )}
      </div>

      <ClaimCreate
        branchId={branchId}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); refetch(); }}
      />

      {detailFor && (
        <ClaimDetail claimId={detailFor} open onClose={() => setDetailFor(null)} />
      )}

      {/* Payer-AR aging summary */}
      {aging?.payers && aging.payers.length > 0 && (
        <div className="bg-background rounded-2xl shadow-sm overflow-hidden" data-testid="payer-aging">
          <div className="px-5 py-3 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground border-b border-border">
            AR by payer · {formatPeso(aging.summary.totalOutstandingCents)} outstanding across {aging.summary.payerCount} payer{aging.summary.payerCount !== 1 ? 's' : ''}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-2 pl-5">Payer</th>
                  {PAYER_AGING_COLS.map((c) => (
                    <th key={c.key} className="text-right text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-2">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aging.payers.map((p) => (
                  <tr key={p.insuranceProfileId} className="border-t border-border">
                    <td className="px-4 py-0 h-11 align-middle text-[13px] font-medium pl-5">{p.payerName}</td>
                    {PAYER_AGING_COLS.map((c) => (
                      <td key={c.key} className={`px-4 py-0 h-11 align-middle text-[13px] tabular-nums text-right ${c.key === 'days90PlusCents' ? 'text-red-700 font-semibold' : ''}`}>
                        {formatPeso(p[c.key] as number)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="Claim status filter">
        {CLAIM_STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={statusFilter === f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`h-7 px-3 rounded-lg text-[12px] font-medium transition-colors ${
              statusFilter === f.value ? 'bg-foreground text-background' : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="bg-background rounded-2xl shadow-sm overflow-hidden" data-testid="claims-error">
          <ListErrorState message={error.message || 'Failed to load claims.'} onRetry={() => refetch()} />
        </div>
      ) : (
        <div className="bg-background rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 pl-5 border-b border-border">Claim</th>
                  <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">Status</th>
                  <th className="text-right text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">Billed</th>
                  <th className="text-right text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">Payer paid</th>
                  <th className="text-right text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">Outstanding</th>
                  <th className="text-right text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 pr-5 border-b border-border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">Loading claims…</td></tr>
                )}
                {!isLoading && claims.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground" data-testid="claims-empty">No insurance claims yet.</td></tr>
                )}
                {!isLoading && claims.map((claim) => (
                  <React.Fragment key={claim.id}>
                    <tr className="border-t border-border first:border-t-0">
                      <td className="px-4 py-0 h-12 align-middle text-[13px] font-medium pl-5">
                        <button
                          type="button"
                          data-testid={`claim-open-${claim.id}`}
                          onClick={() => setDetailFor(claim.id)}
                          className="text-left hover:text-lemon hover:underline underline-offset-2 transition-colors"
                        >
                          {claim.claimNumber}
                        </button>
                      </td>
                      <td className="px-4 py-0 h-12 align-middle">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${claimStatusClass(claim.status)}`}>
                          {CLAIM_STATUS_LABELS[claim.status]}
                        </span>
                      </td>
                      <td className="px-4 py-0 h-12 align-middle text-[13px] tabular-nums text-right">{formatPeso(claim.billedAmountCents)}</td>
                      <td className="px-4 py-0 h-12 align-middle text-[13px] tabular-nums text-right">{formatPeso(claim.paidByPayerCents)}</td>
                      <td className="px-4 py-0 h-12 align-middle text-[13px] tabular-nums text-right font-semibold">{formatPeso(claimOutstandingCents(claim))}</td>
                      <td className="px-4 py-0 h-12 align-middle text-right pr-5">
                        {canWrite && (canSubmitClaim(claim.status) || canRecordRemittance(claim.status) || claim.status === 'draft') ? (
                          <button
                            type="button"
                            onClick={() => setActionFor(actionFor === claim.id ? null : claim.id)}
                            className="h-7 px-3 rounded-lg bg-secondary/60 text-[12px] font-medium hover:bg-secondary"
                            data-testid={`claim-action-${claim.id}`}
                          >
                            {actionFor === claim.id ? 'Close' : 'Manage'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {actionFor === claim.id && canWrite && (
                      <tr className="bg-secondary/20">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="flex flex-wrap items-end gap-3">
                            <label className="flex flex-col gap-1 text-[12px]">
                              <span className="text-muted-foreground">Payer reference</span>
                              <input
                                value={payerReference}
                                onChange={(e) => setPayerReference(e.target.value)}
                                className="h-8 px-2 rounded-lg border border-border text-[13px] w-44"
                                placeholder="HMO ref #"
                                data-testid="payer-reference-input"
                              />
                            </label>
                            {(claim.status === 'draft' || canSubmitClaim(claim.status)) && (
                              <button
                                type="button"
                                onClick={() => handleSubmit(claim)}
                                disabled={isSubmitting}
                                className="h-8 px-4 rounded-lg bg-lemon text-lemon-foreground text-[13px] font-semibold hover:bg-lemon-hover disabled:opacity-50"
                                data-testid="submit-claim-btn"
                              >
                                {isSubmitting ? 'Submitting…' : 'Mark submitted'}
                              </button>
                            )}
                            {canRecordRemittance(claim.status) && (
                              <>
                                <label className="flex flex-col gap-1 text-[12px]">
                                  <span className="text-muted-foreground">Payer paid (₱)</span>
                                  <input
                                    value={remitAmount}
                                    onChange={(e) => setRemitAmount(e.target.value)}
                                    inputMode="decimal"
                                    className="h-8 px-2 rounded-lg border border-border text-[13px] w-28 tabular-nums"
                                    placeholder="0.00"
                                    data-testid="remit-amount-input"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-[12px]">
                                  <span className="text-muted-foreground">Disallowed (₱)</span>
                                  <input
                                    value={disallowAmount}
                                    onChange={(e) => setDisallowAmount(e.target.value)}
                                    inputMode="decimal"
                                    className="h-8 px-2 rounded-lg border border-border text-[13px] w-28 tabular-nums"
                                    placeholder="0.00"
                                    data-testid="disallow-amount-input"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleRemit(claim)}
                                  disabled={isRemitting}
                                  className="h-8 px-4 rounded-lg bg-secondary text-[13px] font-semibold hover:bg-secondary/80 disabled:opacity-50"
                                  data-testid="record-remittance-btn"
                                >
                                  {isRemitting ? 'Posting…' : 'Post remittance'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
