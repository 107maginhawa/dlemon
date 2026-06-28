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
import { usePatientInvoices, useCreateInvoice, useCreateDepositInvoice } from '../hooks/use-workspace-payment';
import { isBillableTreatment } from '../hooks/use-treatments';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
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
    // G10: the enum carries `uncollectible`; without this it fell through to the
    // raw-string default branch with neutral styling.
    uncollectible: { label: 'Uncollectible', className: 'bg-destructive/15 text-destructive-emphasis' },
  };
  return map[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
}

// Per-row treatment-status display. Only `performed`/`verified` are billable
// (server gate); everything else is context, rendered muted so the user can see
// their planned work without it reading as payable.
function treatmentRowStatus(status: string): { label: string; billable: boolean } {
  const map: Record<string, string> = {
    performed: 'Performed',
    verified: 'Verified',
    planned: 'Planned',
    diagnosed: 'Diagnosed',
    dismissed: 'Dismissed',
    declined: 'Declined',
  };
  return { label: map[status] ?? status, billable: isBillableTreatment(status) };
}

// ---------------------------------------------------------------------------
// Line item row
// ---------------------------------------------------------------------------

function LineItemRow({ item }: { item: PaymentLineItem }) {
  // G5/G8: the old check tested `'done'`/`'completed'` — neither is ever a real
  // treatment status, so even billable rows rendered "Pending". Map the real FSM.
  const { label, billable } = treatmentRowStatus(item.status);
  return (
    <div
      data-testid={`line-item-${item.id}`}
      className={`grid gap-1 border-b border-border py-2.5 last:border-0 ${billable ? '' : 'opacity-60'}`}
      style={{ gridTemplateColumns: '1fr 72px 64px 80px', alignItems: 'center' }}
    >
      <div>
        <p className="text-[13px] font-medium text-foreground truncate">{item.description}</p>
        <p className="text-[12px] text-muted-foreground">
          {item.cdtCode && <span className="mr-1">{item.cdtCode}</span>}
          {item.toothNumber && <span>T{item.toothNumber}</span>}
        </p>
      </div>
      <div className="text-right" role="img" aria-label={`Status: ${label.toLowerCase()}`}>
        {billable ? (
          <CheckCircle2 className="ml-auto h-5 w-5 text-success" />
        ) : (
          <Clock className="ml-auto h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="text-right">
        <span className={`text-[11px] font-medium ${billable ? 'text-success-foreground' : 'text-muted-foreground'}`}>
          {label}
        </span>
      </div>
      <div className="text-right">
        <span className={`text-[14px] font-medium tabular-nums ${billable && item.priceCents !== 0 ? '' : 'text-muted-foreground'}`}>
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
  // §g: deposit amount entry (DQ1 — free amount, capped at the estimate, with a
  // "Full estimate" shortcut). Empty input ⇒ default to the full estimate.
  const [depositInput, setDepositInput] = useState('');

  const { data: invoices = [], isLoading: invoicesLoading } = usePatientInvoices(
    open ? patientId : null,
  );
  const createInvoice = useCreateInvoice(patientId);
  const createDeposit = useCreateDepositInvoice(patientId);

  // ISSUE-010: hand-rolled overlay (not Radix) → wire Escape-to-dismiss + focus restore.
  useSheetA11y({ open, onClose });

  // Only billable (performed|verified) rows feed the payable subtotal — the modal
  // mirrors the server gate so the advertised total === what the server will mint
  // (billing-audit-2026-06-27 G3/G4). Non-billable rows still render as context.
  const billableItems = lineItems.filter((item) => isBillableTreatment(item.status));
  const hasBillable = billableItems.length > 0;
  const subtotalCents = billableItems.reduce((sum, item) => sum + item.priceCents, 0);

  // Estimate surface (Square/Stripe two-object model): planned work is presented
  // as a non-payable Estimate — distinct from the payable Subtotal, with no Pay
  // action. This is where non-billable money belongs (billing-audit D1=1a).
  // Excludes dismissed/declined (not part of the active plan).
  const estimateCents = lineItems
    .filter((item) => item.status === 'diagnosed' || item.status === 'planned')
    .reduce((sum, item) => sum + item.priceCents, 0);
  const hasEstimate = estimateCents > 0;

  // §g: planned-only visit (nothing billable yet) — this is the screen that used
  // to dead-end. The real action here is to collect a deposit against the
  // estimate. Empty input ⇒ pay-in-full (the whole estimate); capped at it.
  const estimateOnly = !hasBillable && hasEstimate;
  const depositCents =
    depositInput.trim() === '' ? estimateCents : Math.round(Number.parseFloat(depositInput) * 100);
  const depositValid =
    Number.isFinite(depositCents) && depositCents >= 1 && depositCents <= estimateCents;

  // THIS visit's invoice (one invoice per visit). Previously this took the patient's
  // most-recent non-voided invoice across ALL visits, so a prior visit's PAID invoice
  // surfaced on the current (unbilled) visit: the banner showed "Paid / balance 0"
  // while the body listed this visit's pending treatments (summary-vs-body mismatch),
  // and "Record Payment" re-opened that paid invoice — a dead-end with no way to bill
  // the current work (item 11). visitId is on the wire (DentalInvoice.visitId), so
  // scope to it: no invoice for this visit → the Create-Invoice path is offered.
  const visitInvoice = invoices
    .filter((inv) => inv.status !== 'voided' && inv.visitId === visitId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  async function handleCollectDeposit() {
    // §g: mint a finalized deposit invoice, then open it to record payment →
    // BIR receipt. The collected cash mirrors into the patient credit wallet and
    // is applied to the performed-work invoice later (existing apply-credit UI).
    if (!visitId || !depositValid) return;
    try {
      const inv = await createDeposit.mutateAsync({ visitId, depositCents });
      if (inv?.id) setInvoiceDetailId(inv.id);
    } catch {
      // surfaced via createDeposit.isError / createDeposit.error
    }
  }

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
            ) : visitInvoice ? (
              <InvoiceBanner
                invoiceId={visitInvoice.id}
                invoiceNumber={visitInvoice.invoiceNumber}
                status={visitInvoice.status}
                totalCents={visitInvoice.totalCents}
                paidCents={visitInvoice.paidCents}
                balanceCents={visitInvoice.balanceCents}
                onViewDetail={() => setInvoiceDetailId(visitInvoice.id)}
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

            {/* Subtotal — only when there is something billable to pay for. */}
            {hasBillable && (
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

            {/* Estimate (planned work) — non-payable, distinct from Subtotal. */}
            {hasEstimate && (
              <div
                data-testid="estimate-row"
                className="mx-0 flex items-center justify-between border-y border-border bg-muted/40 px-5 py-3"
              >
                <span className="text-sm font-medium text-muted-foreground">
                  Estimate (planned){' '}
                  <span className="font-normal">· not yet payable</span>
                </span>
                <span
                  data-testid="estimate-amount"
                  className="text-sm font-semibold tabular-nums text-muted-foreground"
                >
                  {formatCents(estimateCents)}
                </span>
              </div>
            )}

            {/* §g: planned-only visit — the real action is to collect a deposit
                against the estimate (the screen used to dead-end on a disabled
                CTA). Issues a receipt now; credited to the final bill when the
                work is performed. (DQ1: free amount, capped, Full-estimate shortcut.) */}
            {estimateOnly && !visitInvoice && (
              <div
                data-testid="deposit-panel"
                className="mx-5 my-3 rounded-xl border border-border bg-muted/40 px-4 py-3"
              >
                <p className="text-sm font-medium text-foreground">Collect a deposit on this estimate</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Issues a receipt now; it's credited to the final bill when the work is performed.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {CURRENCY_SYMBOL}
                    </span>
                    <input
                      data-testid="deposit-amount-input"
                      inputMode="decimal"
                      value={depositInput}
                      onChange={(e) => setDepositInput(e.target.value)}
                      placeholder={(estimateCents / 100).toFixed(2)}
                      aria-label="Deposit amount"
                      className="w-full rounded-lg border border-border bg-background py-2 pl-7 pr-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <button
                    type="button"
                    data-testid="deposit-full-estimate-btn"
                    onClick={() => setDepositInput((estimateCents / 100).toFixed(2))}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted min-h-[44px]"
                  >
                    Full estimate
                  </button>
                </div>
                {depositInput.trim() !== '' && !depositValid && (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    Enter an amount between {formatCents(1)} and {formatCents(estimateCents)}.
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  To bill the full treatment instead, mark it{' '}
                  <span className="font-medium text-foreground">performed</span> (and sign consent).
                </p>
              </div>
            )}

            {/* Truly nothing to act on (line items exist but no billable AND no
                estimate — e.g. all dismissed/declined). Explain, no dead CTA. */}
            {lineItems.length > 0 && !hasBillable && !hasEstimate && !visitInvoice && (
              <div
                data-testid="no-billable-notice"
                className="mx-5 my-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
              >
                No treatments are ready to bill on this visit yet. Mark a treatment as
                <span className="font-medium text-foreground"> performed</span> (and sign consent)
                to add it to an invoice.
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="shrink-0 border-t border-border px-5 py-4">
            {visitInvoice ? (
              <button
                type="button"
                onClick={() => setInvoiceDetailId(visitInvoice.id)}
                data-testid="open-invoice-detail-btn"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-lemon py-3 text-[15px] font-semibold text-lemon-foreground hover:bg-lemon-hover transition-colors min-h-[44px]"
              >
                <CreditCard className="h-4 w-4" />
                Record Payment
              </button>
            ) : hasBillable ? (
              <button
                type="button"
                onClick={handleCreateInvoice}
                disabled={createInvoice.isPending || !visitId}
                data-testid="create-invoice-btn"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-lemon py-3 text-[15px] font-semibold text-lemon-foreground hover:bg-lemon-hover transition-colors min-h-[44px] disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" />
                {createInvoice.isPending ? 'Creating Invoice…' : 'Create Invoice & Pay'}
              </button>
            ) : estimateOnly ? (
              // §g: the dead-end fix — a real, enabled action on the estimate screen.
              <button
                type="button"
                onClick={handleCollectDeposit}
                disabled={createDeposit.isPending || !visitId || !depositValid}
                data-testid="collect-deposit-btn"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-lemon py-3 text-sm font-semibold text-lemon-foreground hover:bg-lemon-hover transition-colors min-h-[44px] disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" />
                {createDeposit.isPending ? 'Collecting…' : `Collect Deposit · ${formatCents(depositCents)}`}
              </button>
            ) : (
              <button
                type="button"
                disabled
                data-testid="create-invoice-btn"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-lemon py-3 text-sm font-semibold text-lemon-foreground min-h-[44px] disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" />
                Create Invoice &amp; Pay
              </button>
            )}
            {createInvoice.isError && (
              <p className="mt-2 text-center text-xs text-destructive" role="alert">
                {(createInvoice.error as Error).message}
              </p>
            )}
            {createDeposit.isError && (
              <p className="mt-2 text-center text-xs text-destructive" role="alert">
                {(createDeposit.error as Error).message}
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
