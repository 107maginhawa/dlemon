/**
 * CollectionsKpis — AR KPI dashboard (Phase 3.1).
 *
 * Read-only management metrics: outstanding AR, collection rate, DSO, write-offs,
 * plus the current AR aging breakdown as a simple CSS bar chart (no chart dep).
 */
import React from 'react';
import { useCollectionsKpis } from '../hooks/use-collections';
import { ListErrorState } from '@/components/list-error-state';
import { formatCents } from './collections-view.helpers';

const BUCKET_LABELS: Record<string, string> = {
  current: 'Current', days30: '31–60', days60: '61–90', days90Plus: '90+',
};

export interface CollectionsKpisProps {
  branchId?: string | null;
}

export function CollectionsKpis({ branchId }: CollectionsKpisProps) {
  const { kpis, isLoading, error, refetch } = useCollectionsKpis({ branchId });

  if (error) {
    return (
      <div className="bg-background rounded-2xl shadow-sm overflow-hidden" data-testid="kpis-error">
        <ListErrorState message={error.message || 'Failed to load metrics.'} onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !kpis) {
    return <div className="text-sm text-muted-foreground" data-testid="kpis-loading">Loading metrics…</div>;
  }

  const cards = [
    { key: 'ar', label: 'Outstanding AR', value: formatCents(kpis.outstandingArCents), accent: true },
    { key: 'rate', label: 'Collection rate', value: `${Math.round(kpis.collectionRate * 100)}%` },
    { key: 'dso', label: 'Days sales outstanding', value: `${kpis.dsoDays}d` },
    { key: 'writeoff', label: 'Write-offs', value: formatCents(kpis.writeOffCents) },
  ];

  const maxBucket = Math.max(1, ...kpis.agingSeries.map((b) => b.amountCents));

  return (
    <div className="flex flex-col gap-4" data-testid="collections-kpis">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.key}
            data-testid={`kpi-${c.key}`}
            className={`rounded-2xl shadow-sm p-5 flex flex-col gap-1 ${c.accent ? 'bg-lemon/30' : 'bg-background'}`}
          >
            <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">{c.label}</span>
            <span className="text-2xl font-bold tracking-tight tabular-nums">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-background rounded-2xl shadow-sm p-5">
        <h3 className="text-sm font-semibold mb-4">AR aging breakdown</h3>
        <div className="flex items-end gap-4 h-40" data-testid="kpi-aging-chart">
          {kpis.agingSeries.map((b) => (
            <div key={b.bucket} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
              <span className="text-xs tabular-nums text-muted-foreground">{formatCents(b.amountCents)}</span>
              <div
                className="w-full rounded-t-lg bg-lemon min-h-[2px] transition-all"
                style={{ height: `${(b.amountCents / maxBucket) * 100}%` }}
                data-testid={`kpi-bar-${b.bucket}`}
              />
              <span className="text-xs font-medium text-muted-foreground">{BUCKET_LABELS[b.bucket] ?? b.bucket}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
