/**
 * ChartExportView — P0-B structured chart export (print-ready view).
 *
 * Renders a portable, structured snapshot of a visit's chart: a header
 * (patient/provider/branch/date), the odontogram tooth/surface table with each
 * tooth's derived layer, a treatment-plan summary (proposed/completed/declined),
 * the matching treatment table, and a legend. Designed for `window.print()`.
 *
 * The summary counts are rendered alongside the odontogram body they describe so
 * a reader can verify them against the rows (the summary ≠ body bug class).
 */
import React from 'react';
import type { ChartExport } from '@monobase/sdk-ts/generated';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';

export interface ChartExportViewProps {
  exportDoc: ChartExport;
}

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(APP_LOCALE);
}

function formatMoney(cents: number): string {
  return `${CURRENCY_SYMBOL}${(cents / 100).toLocaleString(APP_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ChartExportView({ exportDoc: data }: ChartExportViewProps) {
  return (
    <div data-testid="chart-export" className="mx-auto max-w-3xl bg-white p-6 text-sm text-gray-900 print:p-0">
      <header className="border-b pb-3">
        <h1 className="text-lg font-bold">Dental Chart Record</h1>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div>
            <dt className="inline font-semibold">Patient: </dt>
            <dd data-testid="export-patient" className="inline">{data.patientName}</dd>
            {data.patientDateOfBirth && <span className="ml-1 text-gray-500">(DOB {data.patientDateOfBirth})</span>}
          </div>
          <div>
            <dt className="inline font-semibold">Provider: </dt>
            <dd data-testid="export-provider" className="inline">{data.providerName ?? '—'}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Branch: </dt>
            <dd className="inline">{data.branchName ?? '—'}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Visit date: </dt>
            <dd className="inline">{formatDate(data.visitDate)}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Notation: </dt>
            <dd className="inline">{data.notation}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Generated: </dt>
            <dd data-testid="export-generated" className="inline">{formatDate(data.generatedAt)}</dd>
          </div>
        </dl>
      </header>

      {/* Treatment summary (counts shown next to the odontogram body that explains them). */}
      <section className="mt-4">
        <h2 className="text-sm font-semibold">Treatment summary</h2>
        <div className="mt-1 flex flex-wrap gap-4 text-xs">
          <span>Proposed: <strong data-testid="export-proposed-count">{data.summary.proposedCount}</strong></span>
          <span>Completed: <strong data-testid="export-completed-count">{data.summary.completedCount}</strong></span>
          <span>Declined: <strong data-testid="export-declined-count">{data.summary.declinedCount}</strong></span>
          <span>Proposed total: <strong>{formatMoney(data.summary.totalProposedCents)}</strong></span>
        </div>
      </section>

      {/* Odontogram tooth/surface table */}
      <section className="mt-4">
        <h2 className="text-sm font-semibold">Odontogram (tooth / surface)</h2>
        <table className="mt-1 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-1 pr-2">Tooth</th>
              <th className="py-1 pr-2">State</th>
              <th className="py-1 pr-2">Surfaces</th>
              <th className="py-1 pr-2">Condition</th>
              <th className="py-1 pr-2">Layer</th>
            </tr>
          </thead>
          <tbody>
            {data.teeth.map((t) => (
              <tr key={t.toothNumber} data-testid="export-tooth-row" data-layer={t.layer} className="border-b">
                <td className="py-1 pr-2 font-medium">#{t.toothNumber}</td>
                <td className="py-1 pr-2">{t.state}</td>
                <td className="py-1 pr-2">{(t.surfaces ?? []).join(', ') || '—'}</td>
                <td className="py-1 pr-2">{t.conditionCode ?? '—'}</td>
                <td className="py-1 pr-2 capitalize">{t.layer}</td>
              </tr>
            ))}
            {data.teeth.length === 0 && (
              <tr><td colSpan={5} className="py-2 text-gray-400">No charted teeth.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Treatment table */}
      <section className="mt-4">
        <h2 className="text-sm font-semibold">Treatments</h2>
        <table className="mt-1 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-1 pr-2">Tooth</th>
              <th className="py-1 pr-2">CDT</th>
              <th className="py-1 pr-2">Description</th>
              <th className="py-1 pr-2">Status</th>
              <th className="py-1 pr-2 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {data.treatments.map((t, i) => (
              <tr key={`${t.toothNumber ?? 'gen'}-${t.cdtCode}-${i}`} data-testid="export-treatment-row" data-status={t.status} className="border-b">
                <td className="py-1 pr-2">{t.toothNumber != null ? `#${t.toothNumber}` : '—'}</td>
                <td className="py-1 pr-2">{t.cdtCode}</td>
                <td className="py-1 pr-2">{t.description}</td>
                <td className="py-1 pr-2 capitalize">{t.status}</td>
                <td className="py-1 pr-2 text-right">{formatMoney(t.priceCents)}</td>
              </tr>
            ))}
            {data.treatments.length === 0 && (
              <tr><td colSpan={5} className="py-2 text-gray-400">No treatments.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Legend */}
      <section data-testid="export-legend" className="mt-4 flex flex-wrap gap-3 border-t pt-2 text-[11px] text-gray-600">
        {data.legend.map((l) => (
          <span key={l.key}>{l.label}</span>
        ))}
      </section>
    </div>
  );
}
