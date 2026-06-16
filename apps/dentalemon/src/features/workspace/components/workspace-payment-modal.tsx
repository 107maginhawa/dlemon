/**
 * WorkspacePaymentModal — lightweight payment initiation modal in workspace
 *
 * PAY-01: User can initiate payment — shows treatments + "Create Invoice" CTA
 * PAY-02: User can view payment status — shows invoice status when found
 *
 * If an invoice already exists for this patient, shows it with a "View Full Invoice"
 * link that opens InvoiceDetail. Otherwise shows treatment line items + create flow.
 *
 * Wireframe: docs/prd/context/wireframes/ws-payment-modal.html
 */
import React, { useState } from 'react';
import { X, CreditCard, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { usePatientInvoices, useCreateInvoice } from '../hooks/use-workspace-payment';
import { InvoiceDetail } from '@/features/billing/components/invoice-detail';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';

// ---------------------------------------------------------------------------
// Types (local — sourced from useTreatments)
// ---------------------------------------------------------------------------

export interface PaymentLineItem {
  id: string;
  description: string;
  cdtCode?: string;
  toothNumber?: number;
  priceCents: number;
  status: string;
}

export interface WorkspacePaymentModalProps {
  patientId: string;
  visitId: string | null;
  patientName?: string;
  lineItems: PaymentLineItem[];
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// price contract: priceCents (API) ÷ 100 → dollars (display)
function formatCents(cents: number): string {
  return `${CURRENCY_SYMBOL}${(cents / 100).toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusConfig(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
    issued: { label: 'Issued', className: 'bg-info/15 text-info-foreground' },
    partial: { label: 'Partial', className: 'bg-warning/15 text-warning-foreground' },
    paid: { label: 'Paid', className: 'bg-success/15 text-success-foreground' },
    overdue: { label: 'Overdue', className: 'bg-destructive/15 text-destructive-emphasis' },
    voided: { label: 'Voided', className: 'bg-muted text-muted-foreground' },
  };
  return map[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
}

// ---------------------------------------------------------------------------
// Line item row
// ---------------------------------------------------------------------------

function LineItemRow({ item }: { item: PaymentLineItem }) {
  const isDone = item.status === 'done' || item.status === 'completed';
  return (
    <div
      data-testid={`line-item-${item.id}`}
      className="grid gap-1 border-b border-border py-2.5 last:border-0"
      style={{ gridTemplateColumns: '1fr 72px 64px 80px', alignItems: 'center' }}
    >
      <div>
        <p className="text-[13px] font-medium text-foreground truncate">{item.description}</p>
        <p className="text-[12px] text-muted-foreground">
          {item.cdtCode && <span className="mr-1">{item.cdtCode}</span>}
          {item.toothNumber && <span>T{item.toothNumber}</span>}
        </p>
      </div>
      <div className="text-right">
        {isDone ? (
          <CheckCircle2 className="ml-auto h-4 w-4 text-success" />
        ) : (
          <Clock className="ml-auto h-4 w-4 text-muted-foreground/50" />
        )}
      </div>
      <div className="text-right">
        <span className={`text-[11px] font-medium ${isDone ? 'text-success-foreground' : 'text-muted-foreground'}`}>
          {isDone ? 'Done' : 'Pending'}
        </span>
      </div>
      <div className="text-right">
        <span className={`text-[14px] font-medium tabular-nums ${item.priceCents === 0 ? 'text-muted-foreground' : ''}`}>
          {formatCents(item.priceCents)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoice status banner (PAY-02)
// ---------------------------------------------------------------------------

function InvoiceBanner({
  invoiceId,
  invoiceNumber,
  status,
  totalCents,
  paidCents,
  balanceCents,
  onViewDetail,
}: {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  onViewDetail: () => void;
}) {
  const cfg = statusConfig(status);
  return (
    <div
      data-testid="invoice-banner"
      className="mx-5 my-3 flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3"
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold">{invoiceNumber}</span>
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${cfg.className}`}>
            {cfg.label}
          </span>
        </div>
        <span className="text-[12px] text-muted-foreground">
          Balance: {formatCents(balanceCents)} / {formatCents(totalCents)}
        </span>
      </div>
      <button
        type="button"
        onClick={onViewDetail}
        data-testid="view-invoice-btn"
        className="flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
      >
        View Invoice
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WorkspacePaymentModal({
  patientId,
  visitId,
  patientName,
  lineItems,
  open,
  onClose,
}: WorkspacePaymentModalProps) {
  const [invoiceDetailId, setInvoiceDetailId] = useState<string | null>(null);

  const { data: invoices = [], isLoading: invoicesLoading } = usePatientInvoices(
    open ? patientId : null,
  );
  const createInvoice = useCreateInvoice(patientId);

  const subtotalCents = lineItems.reduce((sum, item) => sum + item.priceCents, 0);

  // Most recent non-voided invoice
  const latestInvoice = invoices
    .filter((inv) => inv.status !== 'voided')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  async function handleCreateInvoice() {
    // QA-008: the backend requires a visitId (plus branch + member, sourced from
    // org context inside the hook). Without a visit there is nothing to invoice.
    if (!visitId) return;
    try {
      const inv = await createInvoice.mutateAsync({ visitId });
      setInvoiceDetailId(inv.id);
    } catch {
      // error state surfaced via createInvoice.isError / createInvoice.error
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Payment"
        data-testid="workspace-payment-modal"
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
      >
        <div className="flex w-full max-w-[520px] max-h-[calc(100dvh-80px)] flex-col overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-border">
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight">Payment</h2>
              {patientName && (
                <p className="text-[13px] text-muted-foreground">{patientName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close payment modal"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body (scrollable) */}
          <div className="flex-1 overflow-y-auto">
            {/* Invoice status banner (PAY-02) */}
            {invoicesLoading ? (
              <div className="flex h-14 items-center justify-center">
                <span className="text-sm text-muted-foreground">Checking invoices…</span>
              </div>
            ) : latestInvoice ? (
              <InvoiceBanner
                invoiceId={latestInvoice.id}
                invoiceNumber={latestInvoice.invoiceNumber}
                status={latestInvoice.status}
                totalCents={latestInvoice.totalCents}
                paidCents={latestInvoice.paidCents}
                balanceCents={latestInvoice.balanceCents}
                onViewDetail={() => setInvoiceDetailId(latestInvoice.id)}
              />
            ) : null}

            {/* Line items */}
            {lineItems.length > 0 && (
              <div className="px-5">
                {/* Column headers */}
                <div
                  className="grid border-b border-border pb-1.5 pt-3"
                  style={{ gridTemplateColumns: '1fr 72px 64px 80px' }}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Treatment
                  </span>
                  <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" />
                  <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </span>
                  <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Amount
                  </span>
                </div>
                {lineItems.map((item) => (
                  <LineItemRow key={item.id} item={item} />
                ))}
              </div>
            )}

            {lineItems.length === 0 && !invoicesLoading && (
              <div className="flex h-24 flex-col items-center justify-center gap-1 px-5 text-center">
                <CreditCard className="h-6 w-6 text-muted-foreground/50" />
                <p className="text-[13px] text-muted-foreground">
                  No treatment items yet. Add treatments on the odontogram to generate a payment.
                </p>
              </div>
            )}

            {/* Subtotal */}
            {lineItems.length > 0 && (
              <div
                data-testid="subtotal-row"
                className="mx-0 flex items-center justify-between bg-lemon-soft px-5 py-3 border-y border-border"
              >
                <span className="text-[13px] font-semibold text-lemon-foreground">Subtotal</span>
                <span
                  data-testid="subtotal-amount"
                  className="text-[15px] font-bold tabular-nums text-lemon-foreground"
                >
                  {formatCents(subtotalCents)}
                </span>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="shrink-0 border-t border-border px-5 py-4">
            {latestInvoice ? (
              <button
                type="button"
                onClick={() => setInvoiceDetailId(latestInvoice.id)}
                data-testid="open-invoice-detail-btn"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-lemon py-3 text-[15px] font-semibold text-lemon-foreground hover:bg-lemon-hover transition-colors min-h-[44px]"
              >
                <CreditCard className="h-4 w-4" />
                Record Payment
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreateInvoice}
                disabled={createInvoice.isPending || lineItems.length === 0 || !visitId}
                data-testid="create-invoice-btn"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-lemon py-3 text-[15px] font-semibold text-lemon-foreground hover:bg-lemon-hover transition-colors min-h-[44px] disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" />
                {createInvoice.isPending ? 'Creating Invoice…' : 'Create Invoice & Pay'}
              </button>
            )}
            {createInvoice.isError && (
              <p className="mt-2 text-center text-xs text-destructive" role="alert">
                {(createInvoice.error as Error).message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* InvoiceDetail overlay (PAY-02) */}
      {invoiceDetailId && (
        <InvoiceDetail
          invoiceId={invoiceDetailId}
          open={Boolean(invoiceDetailId)}
          onClose={() => setInvoiceDetailId(null)}
          onUpdated={() => {/* query invalidation handled by InvoiceDetail */}}
        />
      )}
    </>
  );
}
