/**
 * InvoiceDetailSheet — bottom sheet drilldown from a revenue report row
 *
 * RPT-01: opened when user clicks an invoice row in the revenue report
 * RPT-02: shows line items and payment history
 *
 * Wireframe: docs/prd/context/wireframes/reports.html
 */
import React from 'react';
import { X } from 'lucide-react';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { useInvoiceDetail } from '@/features/billing/hooks/use-invoice-detail';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InvoiceDetailSheetProps {
  invoiceId: string | null;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCents(cents: number): string {
  return `${CURRENCY_SYMBOL}${(cents / 100).toLocaleString(APP_LOCALE, { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(APP_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  issued: 'Issued',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
  voided: 'Voided',
};

const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  issued: 'bg-blue-100 text-blue-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  voided: 'bg-secondary text-muted-foreground',
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  gcash: 'GCash',
  maya: 'Maya',
  bank_transfer: 'Bank Transfer',
  insurance: 'Insurance',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceDetailSheet({ invoiceId, open, onClose }: InvoiceDetailSheetProps) {
  const { invoice, isLoading, error } = useInvoiceDetail(open ? invoiceId : null);
  const { containerRef } = useSheetA11y({ open, onClose });

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Invoice Detail"
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl bg-background shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">
              {invoice ? `Invoice ${invoice.invoiceNumber}` : 'Invoice Detail'}
            </p>
            {invoice?.patientName && (
              <p className="text-xs text-muted-foreground">{invoice.patientName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-secondary transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {isLoading && (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          )}

          {error && (
            <p className="text-sm text-destructive py-8 text-center">
              Failed to load invoice details.
            </p>
          )}

          {invoice && (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[invoice.status] ?? 'bg-secondary text-secondary-foreground'}`}>
                    {STATUS_LABELS[invoice.status] ?? invoice.status}
                  </span>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
                  <p className="mt-1 text-base font-bold">{formatCents(invoice.totalCents)}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid</p>
                  <p className="mt-1 text-base font-bold text-green-600">{formatCents(invoice.paidCents)}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Balance</p>
                  <p className="mt-1 text-base font-bold text-red-600">{formatCents(invoice.balanceCents)}</p>
                </div>
              </div>

              {invoice.visitDate && (
                <p className="text-xs text-muted-foreground">
                  Visit date: {formatDate(invoice.visitDate)}
                </p>
              )}

              {/* Line items */}
              <div className="rounded-xl border border-border">
                <div className="border-b px-4 py-2.5">
                  <h3 className="text-sm font-semibold">Line Items</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                      <th scope="col" className="px-4 py-2">Treatment</th>
                      <th scope="col" className="px-4 py-2 hidden sm:table-cell">CDT</th>
                      <th scope="col" className="px-4 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems.map(item => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-4 py-2.5">{item.description}</td>
                        <td className="px-4 py-2.5 hidden sm:table-cell text-muted-foreground text-xs">
                          {item.cdtCode ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">{formatCents(item.amountCents)}</td>
                      </tr>
                    ))}
                    {invoice.lineItems.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-xs">
                          No line items
                        </td>
                      </tr>
                    )}
                    {/* Subtotal / discount / total */}
                    {invoice.lineItems.length > 0 && (
                      <>
                        {invoice.discountCents != null && invoice.discountCents > 0 && (
                          <tr className="border-t bg-secondary/30">
                            <td colSpan={2} className="px-4 py-2 text-right text-xs text-muted-foreground">Discount</td>
                            <td className="px-4 py-2 text-right text-xs text-green-600">−{formatCents(invoice.discountCents)}</td>
                          </tr>
                        )}
                        <tr className="border-t bg-secondary/30">
                          <td colSpan={2} className="px-4 py-2 text-right text-xs font-semibold">Total</td>
                          <td className="px-4 py-2 text-right text-sm font-bold">{formatCents(invoice.totalCents)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Payment history */}
              <div className="rounded-xl border border-border">
                <div className="border-b px-4 py-2.5">
                  <h3 className="text-sm font-semibold">Payment History</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                      <th scope="col" className="px-4 py-2">Date</th>
                      <th scope="col" className="px-4 py-2">Method</th>
                      <th scope="col" className="px-4 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map(payment => (
                      <tr key={payment.id} className="border-b last:border-0">
                        <td className="px-4 py-2.5">{formatDate(payment.createdAt)}</td>
                        <td className="px-4 py-2.5 capitalize">
                          {METHOD_LABELS[payment.method] ?? payment.method}
                        </td>
                        <td className="px-4 py-2.5 text-right text-green-600">
                          {formatCents(payment.amountCents)}
                        </td>
                      </tr>
                    ))}
                    {invoice.payments.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-xs">
                          No payments recorded
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
