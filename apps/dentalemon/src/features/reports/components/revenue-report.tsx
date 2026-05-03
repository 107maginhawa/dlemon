import React, { useState, useEffect } from 'react';
import { apiBaseUrl } from '@/utils/config';

const API = apiBaseUrl;

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: string;
  createdAt: string;
}

export interface RevenueReportProps {
  branchId: string;
}

function formatCents(cents: number): string {
  return `₱${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

export function RevenueReport({ branchId }: RevenueReportProps) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/dental/billing/invoices?branchId=${branchId}`, { credentials: 'include' })
      .then(r => r.json())
      .then((data: Invoice[]) => {
        const filtered = data.filter(i => {
          const d = i.createdAt.slice(0, 10);
          return d >= startDate && d <= endDate;
        });
        setInvoices(filtered);
      })
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, [branchId, startDate, endDate]);

  const totalBilled = invoices.reduce((s, i) => s + i.totalCents, 0);
  const totalCollected = invoices.reduce((s, i) => s + i.paidCents, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.balanceCents, 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // Group by day
  const dayMap = new Map<string, { billed: number; collected: number }>();
  for (const inv of invoices) {
    const date = inv.createdAt.slice(0, 10);
    const existing = dayMap.get(date) ?? { billed: 0, collected: 0 };
    existing.billed += inv.totalCents;
    existing.collected += inv.paidCents;
    dayMap.set(date, existing);
  }
  const dailyData = Array.from(dayMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  function handleExportCSV() {
    const header = 'Date,Billed,Collected,Outstanding';
    const rows = dailyData.map(d => `${d.date},${d.billed},${d.collected},${d.billed - d.collected}`);
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Revenue Report</h2>
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="h-9 rounded-lg border border-border px-3 text-sm bg-background" />
          <span className="text-sm text-muted-foreground">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="h-9 rounded-lg border border-border px-3 text-sm bg-background" />
          <button onClick={handleExportCSV}
            className="h-9 px-4 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Billed</p>
              <p className="text-2xl font-bold mt-1">{formatCents(totalBilled)}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Collected</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{formatCents(totalCollected)}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Outstanding</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{formatCents(totalOutstanding)}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Collection Rate</p>
              <p className="text-2xl font-bold mt-1">{collectionRate}%</p>
            </div>
          </div>

          <div className="rounded-xl border border-border">
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
                    <td className="px-4 py-2.5 text-right text-green-600">{formatCents(d.collected)}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{formatCents(d.billed - d.collected)}</td>
                  </tr>
                ))}
                {dailyData.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No data for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
