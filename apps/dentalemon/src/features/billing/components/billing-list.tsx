/**
 * BillingList -- invoice list page with filter tabs and summary cards
 *
 * Features: status filter tabs, summary cards (outstanding/collected/overdue),
 *           invoice table with clickable rows
 *
 * Wireframe: docs/prd/context/wireframes/billing-list.html
 */

import React, { useState, useEffect } from 'react';

const API = 'http://localhost:7213';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName?: string;
  visitDate?: string;
  dueDate?: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: string;
  createdAt: string;
}

export interface BillingListProps {
  branchId?: string;
  onInvoiceClick?: (invoice: Invoice) => void;
}

// ---------------------------------------------------------------------------
// Pure logic helpers (exported for testing)
// ---------------------------------------------------------------------------

export function formatInvoiceStatus(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    issued: 'Issued',
    partial: 'Partial',
    paid: 'Paid',
    overdue: 'Overdue',
    voided: 'Voided',
  };
  return map[status] ?? status;
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-500';
    case 'issued':
      return 'bg-blue-100 text-blue-700';
    case 'partial':
      return 'bg-orange-100 text-orange-700';
    case 'paid':
      return 'bg-green-100 text-green-700';
    case 'overdue':
      return 'bg-red-100 text-red-700';
    case 'voided':
      return 'bg-gray-100 text-gray-400 line-through';
    default:
      return 'bg-gray-100 text-gray-500';
  }
}

export function formatCents(cents: number): string {
  const pesos = cents / 100;
  return `\u20B1${pesos.toFixed(2)}`;
}

export function getBalanceClass(balanceCents: number): string {
  return balanceCents > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold';
}

export function summarizeInvoices(invoices: Invoice[]): {
  totalOutstanding: number;
  collectedThisMonth: number;
  overdueAmount: number;
} {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalOutstanding = 0;
  let collectedThisMonth = 0;
  let overdueAmount = 0;

  for (const inv of invoices) {
    if (inv.status !== 'voided' && inv.status !== 'paid') {
      totalOutstanding += inv.balanceCents;
    }
    if (inv.status === 'overdue') {
      overdueAmount += inv.balanceCents;
    }
    const created = new Date(inv.createdAt);
    if (created.getMonth() === currentMonth && created.getFullYear() === currentYear) {
      collectedThisMonth += inv.paidCents;
    }
  }

  return { totalOutstanding, collectedThisMonth, overdueAmount };
}

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

const FILTER_TABS = ['all', 'paid', 'partial', 'issued', 'overdue', 'voided'] as const;
type FilterTab = (typeof FILTER_TABS)[number];

const FILTER_LABELS: Record<FilterTab, string> = {
  all: 'All',
  paid: 'Paid',
  partial: 'Partial',
  issued: 'Outstanding',
  overdue: 'Overdue',
  voided: 'Voided',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingList({ branchId, onInvoiceClick }: BillingListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  useEffect(() => {
    loadInvoices();
  }, [activeTab, branchId]);

  async function loadInvoices() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('status', activeTab);
      if (branchId) params.set('branchId', branchId);
      const qs = params.toString();
      const url = `${API}/dental/billing/invoices${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load invoices');
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : data.invoices ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const summary = summarizeInvoices(invoices);

  return (
    <div className="flex flex-col gap-4" data-testid="billing-list">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-background rounded-2xl shadow-sm p-5 flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
            Total Outstanding
          </span>
          <span className="text-3xl font-bold tracking-tight tabular-nums text-red-500">
            {formatCents(summary.totalOutstanding)}
          </span>
        </div>

        <div className="bg-background rounded-2xl shadow-sm p-5 flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
            Collected This Month
          </span>
          <span className="text-3xl font-bold tracking-tight tabular-nums">
            {formatCents(summary.collectedThisMonth)}
          </span>
        </div>

        <div className="bg-background rounded-2xl shadow-sm p-5 flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
            Overdue
          </span>
          <span className="text-3xl font-bold tracking-tight tabular-nums text-amber-600">
            {formatCents(summary.overdueAmount)}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        className="flex items-center gap-0.5 bg-secondary/50 rounded-xl p-0.5 w-fit"
        role="tablist"
        aria-label="Invoice status filter"
      >
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`h-[30px] px-3.5 rounded-lg text-[13px] font-medium tracking-tight transition-colors ${
              activeTab === tab
                ? 'bg-background shadow-sm font-semibold text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {FILTER_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Invoice Table */}
      <div className="bg-background rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border pl-5">
                  Invoice #
                </th>
                <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">
                  Patient
                </th>
                <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">
                  Visit Date
                </th>
                <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">
                  Amount
                </th>
                <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">
                  Balance
                </th>
                <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">
                  Status
                </th>
                <th className="text-right text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border pr-5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Loading invoices...
                  </td>
                </tr>
              )}
              {!loading && invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No invoices found.
                  </td>
                </tr>
              )}
              {!loading &&
                invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => onInvoiceClick?.(inv)}
                    className="cursor-pointer hover:bg-[rgba(255,233,125,0.15)] transition-colors border-t border-border first:border-t-0"
                  >
                    <td className="px-4 py-0 h-12 align-middle pl-5">
                      <span className="text-xs font-semibold text-[#4A4018]">{inv.invoiceNumber}</span>
                    </td>
                    <td className="px-4 py-0 h-12 align-middle text-[13px] font-medium">
                      {inv.patientName ?? inv.patientId}
                    </td>
                    <td className="px-4 py-0 h-12 align-middle text-[13px] tabular-nums">
                      {inv.visitDate ?? '--'}
                    </td>
                    <td className="px-4 py-0 h-12 align-middle text-[13px] font-semibold tabular-nums">
                      {formatCents(inv.totalCents)}
                    </td>
                    <td className={`px-4 py-0 h-12 align-middle text-[13px] tabular-nums ${getBalanceClass(inv.balanceCents)}`}>
                      {formatCents(inv.balanceCents)}
                    </td>
                    <td className="px-4 py-0 h-12 align-middle">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${getStatusBadgeClass(inv.status)}`}>
                        {formatInvoiceStatus(inv.status)}
                      </span>
                    </td>
                    <td className="px-4 py-0 h-12 align-middle text-right pr-5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInvoiceClick?.(inv);
                        }}
                        className="text-xs font-medium text-[#4A4018] hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!loading && invoices.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
