import React, { useState } from 'react';
import { Skeleton } from '@monobase/ui';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import { useInvoices } from '@/features/billing/hooks/use-invoices';
import { InvoiceDetailSheet } from './invoice-detail-sheet';
import { csvAmount } from '../lib/csv';

export interface RevenueReportProps {
  branchId: string;
}

export function formatCents(cents: number): string {
  return `${CURRENCY_SYMBOL}${(cents / 100).toLocaleString(APP_LOCALE, { minimumFractionDigits: 2 })}`;
}

// The SDK response transformer hands back `createdAt` as a Date (raw fetch gave a
// string). Normalize to a UTC `YYYY-MM-DD` key so date-range comparisons keep the
// pre-migration semantics regardless of which shape arrives.
export function toDateKey(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString().slice(0, 10);
}

export function RevenueReport({ branchId }: RevenueReportProps) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // SDK-only data access: listDentalInvoices via the canonical billing hook (it
  // unwraps the { data, pagination } envelope and gates on branchId). Date-range
  // narrowing stays client-side, matching the prior behaviour.
  const { invoices: allInvoices, isLoading: loading } = useInvoices({ branchId });
  const invoices = allInvoices.filter((i) => {
    const d = toDateKey(i.createdAt);
    return d >= startDate && d <= endDate;
  });

  const totalBilled = invoices.reduce((s, i) => s + i.totalCents, 0);
  const totalCollected = invoices.reduce((s, i) => s + i.paidCents, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.balanceCents, 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // Group by day
  const dayMap = new Map<string, { billed: number; collected: number }>();
  for (const inv of invoices) {
    const date = toDateKey(inv.createdAt);
    const existing = dayMap.get(date) ?? { billed: 0, collected: 0 };
    existing.billed += inv.totalCents;
    existing.collected += inv.paidCents;
    dayMap.set(date, existing);
  }
  const dailyData = Array.from(dayMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  function handleExportCSV() {
    // ISSUE-021: money columns are decimal pesos (centavos/100), NOT raw centavos —
    // a raw-cents export read 100× too large when opened in a spreadsheet.
    const header = 'Date,Billed,Collected,Outstanding';
    const rows = dailyData.map(d => `${d.date},${csvAmount(d.billed)},${csvAmount(d.collected)},${csvAmount(d.billed - d.collected)}`);
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-${startDate}-${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Revenue Report</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" aria-label="Start date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="h-11 rounded-lg border border-border px-3 text-sm bg-background" />
          <span className="text-sm text-muted-foreground">to</span>
          <input type="date" aria-label="End date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="h-11 rounded-lg border border-border px-3 text-sm bg-background" />
          <button type="button" onClick={handleExportCSV}
            className="h-11 px-4 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <>
          {/* Summary cards skeleton — matches the 4-up card grid below */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-32 mt-2" />
              </div>
            ))}
          </div>
          {/* Table skeleton — header row + rows */}
          <div className="rounded-xl border border-border">
            <div className="px-4 py-3 border-b">
              <Skeleton className="h-4 w-32" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Billed</p>
              <p className="text-2xl font-bold mt-1">{formatCents(totalBilled)}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Collected</p>
              <p className="text-2xl font-bold mt-1 text-success-foreground">{formatCents(totalCollected)}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Outstanding</p>
              <p className="text-2xl font-bold mt-1 text-destructive-emphasis">{formatCents(totalOutstanding)}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Collection Rate</p>
              <p className="text-2xl font-bold mt-1">{collectionRate}%</p>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-x-auto">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Daily Revenue</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2 text-right">Billed</th>
                  <th className="px-4 py-2 text-right">Collected</th>
                  <th className="px-4 py-2 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.map(d => (
                  <tr key={d.date} className="border-b last:border-0">
                    <td className="px-4 py-2.5">{d.date}</td>
                    <td className="px-4 py-2.5 text-right">{formatCents(d.billed)}</td>
                    <td className="px-4 py-2.5 text-right text-success-foreground">{formatCents(d.collected)}</td>
                    <td className="px-4 py-2.5 text-right text-destructive-emphasis">{formatCents(d.billed - d.collected)}</td>
                  </tr>
                ))}
                {dailyData.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No data for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* RPT-01: individual invoices table — click a row to drilldown */}
          <div className="rounded-xl border border-border overflow-x-auto">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Invoices</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-2">Invoice #</th>
                  <th className="px-4 py-2 hidden sm:table-cell">Date</th>
                  <th className="px-4 py-2 hidden sm:table-cell">Status</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right hidden sm:table-cell">Paid</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr
                    key={inv.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open invoice ${inv.invoiceNumber}`}
                    className="border-b last:border-0 cursor-pointer hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedInvoiceId(inv.id)
                      }
                    }}
                  >
                    <td className="px-4 py-2.5 font-medium text-primary" data-testid="revenue-invoice-number">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell text-muted-foreground">
                      {toDateKey(inv.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell capitalize">
                      {inv.status}
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatCents(inv.totalCents)}</td>
                    <td className="px-4 py-2.5 text-right text-success-foreground hidden sm:table-cell">
                      {formatCents(inv.paidCents)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-destructive-emphasis">
                      {formatCents(inv.balanceCents)}
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No invoices for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* RPT-01/RPT-02: invoice detail sheet */}
      <InvoiceDetailSheet
        invoiceId={selectedInvoiceId}
        open={selectedInvoiceId !== null}
        onClose={() => setSelectedInvoiceId(null)}
      />
    </div>
  );
}
