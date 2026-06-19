/**
 * CollectionsView -- AR aging worklist + batch statement run (P2-14).
 *
 * Surfaces accounts-receivable aging (current / 30 / 60 / 90+ buckets) per
 * patient with a practice-wide summary, and a "Generate statements" action
 * that triggers a batch statement run for the active branch.
 */

import React, { useState } from 'react';
import { useArAging, useStatementBatch, useSendStatement } from '../hooks/use-collections';
import { CollectionsWorklist } from './collections-worklist';
import { CollectionsKpis } from './collections-kpis';
import { ListErrorState } from '@/components/list-error-state';
import {
  formatCents,
  agingRisk,
  agingRiskClass,
  bucketPct,
  summarizeBatch,
  AGING_BUCKETS,
  type AgingRow,
} from './collections-view.helpers';

export interface CollectionsViewProps {
  branchId?: string | null;
}

export function CollectionsView({ branchId }: CollectionsViewProps) {
  const [tab, setTab] = useState<'aging' | 'worklist' | 'metrics'>('aging');
  const { aging, isLoading, error, refetch } = useArAging({ branchId });
  const { generate, isGenerating, result } = useStatementBatch({ branchId });
  const { send, sendingPatientId, lastSent } = useSendStatement({ branchId });

  const summary = aging?.summary;
  const patients = aging?.patients ?? [];

  async function handleGenerate() {
    try {
      await generate(undefined);
    } catch {
      // Surfaced via mutation error; cache invalidation only runs onSuccess.
    }
  }

  async function handleSend(patientId: string) {
    try {
      await send(patientId);
    } catch {
      // Surfaced via mutation error.
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="collections-view">
      {/* Aging ↔ Worklist tabs */}
      <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl w-fit" role="tablist">
        {(['aging', 'worklist', 'metrics'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            data-testid={`collections-tab-${t}`}
            className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none ${tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'aging' ? 'Aging' : t === 'worklist' ? 'Worklist' : 'Metrics'}
          </button>
        ))}
      </div>

      {tab === 'worklist' ? (
        <CollectionsWorklist branchId={branchId} />
      ) : tab === 'metrics' ? (
        <CollectionsKpis branchId={branchId} />
      ) : (
      <>
      {/* Summary cards: one per aging bucket + total */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {AGING_BUCKETS.map((b) => {
          const cents = summary?.[b.key] ?? 0;
          const pct = bucketPct(cents, summary?.totalOutstandingCents ?? 0);
          return (
            <div key={b.key} className="bg-background rounded-2xl shadow-sm p-5 flex flex-col gap-1">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                {b.label}
              </span>
              <span className="text-2xl font-bold tracking-tight tabular-nums">{formatCents(cents)}</span>
              <span className="text-[11px] text-muted-foreground">{pct}% · {b.sublabel}</span>
            </div>
          );
        })}
        <div className="bg-lemon/30 rounded-2xl shadow-sm p-5 flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-lemon-foreground/70">
            Total AR
          </span>
          <span className="text-2xl font-bold tracking-tight tabular-nums text-lemon-foreground">
            {formatCents(summary?.totalOutstandingCents ?? 0)}
          </span>
          <span className="text-[11px] text-lemon-foreground/70">
            {summary?.patientCount ?? 0} patient{(summary?.patientCount ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Batch statements action */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {result ? summarizeBatch(result.statementCount, result.totalBalanceCents) : 'Accounts receivable aging'}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !branchId}
          className="h-10 px-4 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
          data-testid="generate-statements-btn"
        >
          {isGenerating ? 'Generating…' : 'Generate statements'}
        </button>
      </div>

      {error ? (
        <div className="bg-background rounded-2xl shadow-sm overflow-hidden" data-testid="collections-error">
          <ListErrorState message={error.message || 'Failed to load aging.'} onRetry={() => refetch()} />
        </div>
      ) : (
        <div className="bg-background rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border pl-5">Patient</th>
                  <th className="text-right text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">Current</th>
                  <th className="text-right text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">31–60</th>
                  <th className="text-right text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">61–90</th>
                  <th className="text-right text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">90+</th>
                  <th className="text-right text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">Total</th>
                  <th className="text-right text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">Oldest</th>
                  <th className="text-right text-xs font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border pr-5">Statement</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-sm text-muted-foreground">Loading aging…</td>
                  </tr>
                )}
                {!isLoading && patients.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-sm text-muted-foreground">
                      No outstanding balances.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  patients.map((p: AgingRow) => (
                    <tr key={p.patientId} className="border-t border-border first:border-t-0">
                      <td className="px-4 py-0 h-12 align-middle text-[13px] font-medium pl-5">{p.patientName}</td>
                      <td className="px-4 py-0 h-12 align-middle text-[13px] tabular-nums text-right">{formatCents(p.currentCents)}</td>
                      <td className="px-4 py-0 h-12 align-middle text-[13px] tabular-nums text-right">{formatCents(p.days30Cents)}</td>
                      <td className="px-4 py-0 h-12 align-middle text-[13px] tabular-nums text-right">{formatCents(p.days60Cents)}</td>
                      <td className="px-4 py-0 h-12 align-middle text-[13px] tabular-nums text-right font-semibold text-red-700">{formatCents(p.days90PlusCents)}</td>
                      <td className="px-4 py-0 h-12 align-middle text-[13px] tabular-nums text-right font-bold">{formatCents(p.totalOutstandingCents)}</td>
                      <td className={`px-4 py-0 h-12 align-middle text-[13px] tabular-nums text-right ${agingRiskClass(agingRisk(p.oldestInvoiceDays))}`}>
                        {p.oldestInvoiceDays}d
                      </td>
                      <td className="px-4 py-0 h-12 align-middle text-right pr-5">
                        <button
                          type="button"
                          onClick={() => handleSend(p.patientId)}
                          disabled={sendingPatientId === p.patientId}
                          className="h-8 px-3 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none"
                          data-testid={`send-statement-${p.patientId}`}
                        >
                          {sendingPatientId === p.patientId
                            ? 'Sending…'
                            : lastSent?.patientId === p.patientId
                              ? 'Sent ✓'
                              : 'Send'}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
