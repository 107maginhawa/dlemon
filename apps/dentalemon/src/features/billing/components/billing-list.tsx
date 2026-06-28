/**
 * BillingList -- invoice list page with filter tabs and summary cards
 *
 * Features: status filter tabs, summary cards (outstanding/collected/overdue),
 *           invoice table with clickable rows
 *
 * Wireframe: docs/prd/context/wireframes/billing-list.html
 */

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useInvoices, type Invoice } from '../hooks/use-invoices';
import { ListErrorState } from '@/components/list-error-state';
import { formatCents } from '@/lib/format-currency';
import { showRecordButton } from './invoice-detail.helpers';

// ---------------------------------------------------------------------------
// Types — Invoice is the single SDK-derived type (see use-invoices); no local
// re-declaration that can silently drift from the API.
// ---------------------------------------------------------------------------

export interface BillingListProps {
  branchId?: string;
  onInvoiceClick?: (invoice: Invoice) => void;
  /** Quick-pay: jump straight to the payment form for a recordable invoice. */
  onRecordPayment?: (invoice: Invoice) => void;
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
      return 'bg-muted text-muted-foreground';
    case 'issued':
      return 'bg-info/15 text-info-foreground';
    case 'partial':
      return 'bg-warning/15 text-warning-foreground';
    case 'paid':
      return 'bg-success/15 text-success-foreground';
    case 'overdue':
      return 'bg-destructive/15 text-destructive-emphasis';
    case 'voided':
      return 'bg-muted text-muted-foreground line-through';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// Re-exported for existing importers; grouped \u20B1 / en-PH via the shared formatter.
export { formatCents };

export function getBalanceClass(balanceCents: number): string {
  // A normal owed balance is neutral ink, not alarm-red — the red "Overdue" status
  // badge carries the at-risk signal. Zero/credit balances read green (settled).
  return balanceCents > 0 ? 'text-foreground font-bold' : 'text-success-foreground font-bold';
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

export function BillingList({ branchId, onInvoiceClick, onRecordPayment }: BillingListProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const { invoices, isLoading: loading, error, refetch } = useInvoices({
    branchId,
    status: activeTab !== 'all' ? activeTab : undefined,
  });

  function handleTabChange(tab: FilterTab) {
    setActiveTab(tab);
    // Invalidate so switching tabs always fetches fresh data. The list query is
    // the generated SDK's (key [{ _id: 'listDentalInvoices', … }]); the literal
    // ['invoices'] key never matched it. Match by _id.
    queryClient.invalidateQueries({
      predicate: (q) => (q.queryKey[0] as { _id?: string })?._id === 'listDentalInvoices',
    });
  }

  const summary = summarizeInvoices(invoices);

  return (
    <div className="flex flex-col gap-4" data-testid="billing-list">
      {/* Summary Cards — stack on phones, 2-up on tablet (the wide peso totals
          don't fit 3-across once the sidebar is present at ~768px), 3-up at lg.
          Keeps the page from overflowing at iPad-portrait (PP-9 / ISSUE-045). */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-background rounded-2xl shadow-sm p-5 flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
            Total Outstanding
          </span>
          <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
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
          <span className="text-3xl font-bold tracking-tight tabular-nums text-warning-foreground">
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
            onClick={() => handleTabChange(tab)}
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

      {/* Error state — distinct from the empty "no invoices" state */}
      {error ? (
        <div className="bg-background rounded-2xl shadow-sm overflow-hidden" data-testid="billing-list-error">
          <ListErrorState message={error.message || 'Failed to load invoices.'} onRetry={() => refetch()} />
        </div>
      ) : (
      /* Invoice Table */
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
                    data-testid={`invoice-row-${inv.id}`}
                    onClick={() => onInvoiceClick?.(inv)}
                    className="cursor-pointer hover:bg-lemon-soft transition-colors border-t border-border first:border-t-0"
                  >
                    <td className="px-4 py-0 h-12 align-middle pl-5">
                      <span className="text-xs font-semibold text-lemon-foreground">{inv.invoiceNumber}</span>
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
                      <div className="flex items-center justify-end gap-3">
                        {onRecordPayment && showRecordButton(inv.status) && (
                          <button
                            type="button"
                            data-testid={`record-payment-${inv.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRecordPayment(inv);
                            }}
                            className="text-xs font-semibold text-lemon-foreground hover:underline"
                          >
                            Record payment
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInvoiceClick?.(inv);
                          }}
                          className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                        >
                          View
                        </button>
                      </div>
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
      )}
    </div>
  );
}
