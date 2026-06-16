/**
 * PerioComparison — multi-exam (longitudinal) periodontal comparison.
 *
 * Shows a patient's finalized perio exams side by side: headline trends (BOP%,
 * mean depth, deep-pocket count) with improve/worsen arrows, and a per-tooth
 * max-probing-depth grid that highlights worsening sites. For perio, lower is
 * better — a downward move is an improvement (green); an increase is red.
 *
 * `PerioComparisonView` is the pure presentational table (charts via props, easy
 * to unit-test). `PerioComparison` wires it to usePerioHistory(patientId).
 */

import React from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import type { PerioChart } from '@monobase/sdk-ts/generated';
import { usePerioHistory } from '@/features/workspace/hooks/use-perio-history';
import {
  buildSummaryRows,
  buildToothPdRows,
  buildStagingCells,
  formatStage,
  examDateLabel,
  type MetricDelta,
} from './perio-comparison.logic';

function fmtValue(key: 'bop' | 'meanDepth' | 'deepPockets', v: number | null): string {
  if (v === null) return '—';
  if (key === 'bop') return `${Math.round(v)}%`;
  if (key === 'meanDepth') return `${v.toFixed(1)}mm`;
  return String(v);
}

function DeltaBadge({ delta }: { delta: MetricDelta | null }) {
  if (!delta || delta.dir === 'flat') return null;
  const Icon = delta.dir === 'down' ? ChevronDown : ChevronUp;
  const cls = delta.better ? 'text-success-foreground' : 'text-destructive-emphasis';
  return (
    <span className={`ml-1 inline-flex items-center text-[11px] font-medium ${cls}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta.amount).toFixed(delta.amount % 1 === 0 ? 0 : 1)}
    </span>
  );
}

export function PerioComparisonView({ charts }: { charts: PerioChart[] }) {
  if (charts.length < 2) {
    return (
      <div
        data-testid="perio-comparison-insufficient"
        className="flex flex-col items-center justify-center gap-2 py-16 text-center"
      >
        <Activity className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          {charts.length === 0
            ? 'No completed perio exams yet.'
            : 'Only one completed exam — chart another to compare trends over time.'}
        </p>
      </div>
    );
  }

  const summary = buildSummaryRows(charts);
  const toothRows = buildToothPdRows(charts);
  const stagingCells = buildStagingCells(charts);

  return (
    <div data-testid="perio-comparison" className="flex flex-col gap-6">
      {/* Headline trends */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Trend (newest first · lower is better)
        </h3>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b px-2 py-1.5 text-left font-medium text-muted-foreground">Metric</th>
              {charts.map((c) => (
                <th key={c.id} className="border-b px-2 py-1.5 text-right font-medium">
                  {examDateLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* FIX-003: the persisted AAP/EFP staging trajectory (diagnosis of record)
                per exam. Legacy charts with no persisted stage show an em-dash. */}
            <tr data-testid="summary-row-stage">
              <td className="border-b px-2 py-1.5 text-left text-muted-foreground">AAP/EFP stage</td>
              {stagingCells.map((cell, i) => (
                <td key={i} className="border-b px-2 py-1.5 text-right">
                  {cell.stage ? (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {formatStage(cell.stage)}
                      {cell.grade ? <span className="ml-1 text-muted-foreground">· {cell.grade}</span> : null}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              ))}
            </tr>
            {summary.map((row) => (
              <tr key={row.key} data-testid={`summary-row-${row.key}`}>
                <td className="border-b px-2 py-1.5 text-left text-muted-foreground">{row.label}</td>
                {row.values.map((v, i) => (
                  <td key={i} className="border-b px-2 py-1.5 text-right tabular-nums">
                    {fmtValue(row.key, v)}
                    <DeltaBadge delta={row.deltas[i] ?? null} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Per-tooth max probing depth */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Max probing depth by tooth (worsening sites in red)
        </h3>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b px-2 py-1.5 text-left font-medium text-muted-foreground">Tooth</th>
                {charts.map((c) => (
                  <th key={c.id} className="border-b px-2 py-1.5 text-right font-medium">
                    {examDateLabel(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {toothRows.map((row) => (
                <tr key={row.toothNumber} data-testid={`tooth-row-${row.toothNumber}`}>
                  <td className="border-b px-2 py-1.5 text-left font-medium tabular-nums">{row.toothNumber}</td>
                  {row.maxPd.map((v, i) => (
                    <td
                      key={i}
                      data-worse={row.worse[i] ? 'true' : undefined}
                      className={`border-b px-2 py-1.5 text-right tabular-nums ${
                        row.worse[i] ? 'font-semibold text-destructive' : ''
                      }`}
                    >
                      {v === null ? '—' : `${v}mm`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function PerioComparison({ patientId, enabled = true }: { patientId: string; enabled?: boolean }) {
  const { charts, isLoading, isError } = usePerioHistory({ patientId, enabled });

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading perio history…</p>;
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Activity className="h-8 w-8 text-destructive/50" />
        <p className="text-sm text-destructive">Couldn’t load perio history. Please try again.</p>
      </div>
    );
  }
  return <PerioComparisonView charts={charts} />;
}
