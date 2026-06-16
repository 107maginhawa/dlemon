import React, { useState } from 'react';
import { Skeleton } from '@monobase/ui';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import { useTreatmentReport } from '../hooks/use-treatment-report';

export interface TreatmentReportProps {
  branchId: string;
}

export function formatCents(cents: number): string {
  return `${CURRENCY_SYMBOL}${(cents / 100).toLocaleString(APP_LOCALE, { minimumFractionDigits: 2 })}`;
}

export function TreatmentReport({ branchId }: TreatmentReportProps) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);

  const { grouped, isLoading, isError, totalCount, totalBilledCents } = useTreatmentReport({
    branchId,
    startDate,
    endDate,
  });

  function handleExportCSV() {
    const header = 'CDT Code,Description,Count,Total Billed';
    const rows = grouped.map(
      (g) => `${g.cdtCode},"${g.description}",${g.count},${g.totalCents}`,
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `treatments-${startDate}-${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Treatment Report</h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Start date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 rounded-lg border border-border px-3 text-sm bg-background"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="date"
            aria-label="End date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 rounded-lg border border-border px-3 text-sm bg-background"
          />
          <button
            type="button"
            onClick={handleExportCSV}
            className="h-11 px-4 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Failed to load treatment report. Please try again.</p>
      ) : isLoading ? (
        <>
          {/* Summary cards skeleton — matches the 3-up card grid below */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-28 mt-2" />
              </div>
            ))}
          </div>
          {/* Table skeleton — header row + rows */}
          <div className="rounded-xl border border-border">
            <div className="px-4 py-3 border-b">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex flex-col gap-3 p-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Unique CDT Codes
              </p>
              <p className="text-2xl font-bold mt-1">{grouped.length}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Total Treatments
              </p>
              <p className="text-2xl font-bold mt-1">{totalCount}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Total Billed
              </p>
              <p className="text-2xl font-bold mt-1">{formatCents(totalBilledCents)}</p>
            </div>
          </div>

          {/* CDT grouping table */}
          <div className="rounded-xl border border-border">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Treatments by CDT Code</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-2">CDT Code</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Count</th>
                  <th className="px-4 py-2 text-right">Total Billed</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g) => (
                  <tr key={g.cdtCode} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-mono font-medium">{g.cdtCode}</td>
                    <td className="px-4 py-2.5">{g.description}</td>
                    <td className="px-4 py-2.5 text-right">{g.count}</td>
                    <td className="px-4 py-2.5 text-right">{formatCents(g.totalCents)}</td>
                  </tr>
                ))}
                {grouped.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No treatments for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
