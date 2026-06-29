/**
 * WorkspacePaymentModal — payment initiation modal in the workspace.
 *
 * PAY-01: initiate payment — bills the visit's BILLABLE treatments.
 * PAY-02: view payment status — shows this visit's invoice when one exists.
 *
 * Coherence (PRODUCT.md principle #4 — "no payable that can't be paid"): the server
 * invoices ONLY performed|verified treatments (BR-009). So the modal splits the line
 * items via the shared `splitBillable` SoT into:
 *   • Ready to bill (performed|verified) — summed into the payable Subtotal; the
 *     "Create Invoice & Pay" CTA is gated on this being non-empty.
 *   • Estimate (diagnosed|planned) — shown as a clearly NON-payable plan, never
 *     summed into the payable total.
 * An all-planned visit therefore never presents an enabled Pay button that 422s with
 * NO_BILLABLE_TREATMENTS — it shows the estimate plus the correct next action.
 *
 * Wireframe: docs/prd/context/wireframes/ws-payment-modal.html
 */
import React, { useState, useEffect } from 'react';
import { X, CreditCard, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { usePatientInvoices, useCreateInvoice } from '../hooks/use-workspace-payment';
import { useMarkTreatmentDone } from '../hooks/use-mark-treatment-done';
import { splitBillable, isBillableStatus } from '../lib/billable';
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

// minmax(0,1fr) — NOT '1fr' (= minmax(auto,1fr)): a long treatment name would
// otherwise expand the track to its min-content width and push the Amount column
// off the 520px card (the `truncate` below is defeated without a 0 min). Pair with
// `min-w-0` on the treatment cell so the ellipsis actually engages.
const GRID = 'minmax(0,1fr) 72px 64px 80px';

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

function LineItemRow({
  item,
  onMarkPerformed,
  marking,
  errored,
}: {
  item: PaymentLineItem;
  /** Present only for estimate (planned) rows on an editable visit — advances the
   *  treatment to performed so it becomes billable in place (no leaving the modal). */
  onMarkPerformed?: () => void;
  marking?: boolean;
  errored?: boolean;
}) {
  // "Done" == billable (the server invoices these). Real statuses are
  // performed|verified; the SoT keeps this row honest (a performed item never
  // shows "Pending").
  const isDone = isBillableStatus(item.status);
  const showAction = !isDone && !!onMarkPerformed;
  return (
    <div
      data-testid={`line-item-${item.id}`}
      className="grid gap-1 border-b border-border py-2.5 last:border-0"
      style={{ gridTemplateColumns: GRID, alignItems: 'center' }}
    >
      {/* min-w-0 lets the treatment name truncate instead of expanding the track */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
        <p className="text-xs text-muted-foreground">
          {item.cdtCode && <span className="mr-1">{item.cdtCode}</span>}
          {item.toothNumber && <span>T{item.toothNumber}</span>}
        </p>
      </div>
      {showAction ? (
        // Forward action: mark this planned treatment performed → it becomes billable
        // and the modal flips to "Create Invoice & Pay" (no dead-end "Done").
        <div className="text-right" style={{ gridColumn: 'span 2' }}>
          <button
            type="button"
            data-testid={`mark-performed-${item.id}`}
            disabled={marking}
            onClick={onMarkPerformed}
            className="ml-auto inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-primary hover:bg-muted disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {marking ? 'Marking…' : 'Mark done'}
          </button>
        </div>
      ) : (
        <>
          <div
            className="text-right"
            role="img"
            aria-label={isDone ? 'Status: performed' : 'Status: planned'}
          >
            {isDone ? (
              <CheckCircle2 className="ml-auto h-5 w-5 text-success" />
            ) : (
              <Clock className="ml-auto h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="text-right">
            <span className={`text-xs font-medium ${isDone ? 'text-success-foreground' : 'text-muted-foreground'}`}>
              {isDone ? 'Done' : 'Planned'}
            </span>
          </div>
        </>
      )}
      <div className="text-right">
        <span className={`text-sm font-medium tabular-nums ${item.priceCents === 0 ? 'text-muted-foreground' : ''}`}>
          {formatCents(item.priceCents)}
        </span>
      </div>
      {errored && (
        <p
          data-testid={`mark-performed-error-${item.id}`}
          className="col-span-full mt-1 text-right text-xs text-destructive"
          role="alert"
        >
          Couldn’t mark performed — a signed consent may be required first.
        </p>
      )}
    </div>
  );
}

/** Section heading + column headers shared by the billable + estimate groups. */
function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="pt-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="grid border-b border-border pb-1.5 pt-2" style={{ gridTemplateColumns: GRID }}>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
          Treatment
        </span>
        <span />
        <span className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
          Status
        </span>
        <span className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
          Amount
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoice status banner (PAY-02)
// ---------------------------------------------------------------------------

function InvoiceBanner({
  invoiceNumber,
  status,
  totalCents,
  balanceCents,
  onViewDetail,
}: {
  invoiceNumber: string;
  status: string;
  totalCents: number;
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
          <span className="text-sm font-semibold">{invoiceNumber}</span>
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${cfg.className}`}>
            {cfg.label}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          Balance: {formatCents(balanceCents)} / {formatCents(totalCents)}
        </span>
      </div>
      <button
        type="button"
        onClick={onViewDetail}
        data-testid="view-invoice-btn"
        className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
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

  // ISSUE-010: hand-rolled overlay (not Radix) → wire Escape-to-dismiss + focus restore.
  const { containerRef } = useSheetA11y({ open, onClose });

  // Forward action for the estimate state: advance a planned treatment to performed
  // in place (same hook + 2-step FSM as the treatment table), so the modal is never a
  // dead-end. Success invalidates the treatments query → the parent re-feeds lineItems
  // → the row moves estimate→billable and the CTA flips to "Create Invoice & Pay".
  const { markDone, isPending: isMarkDonePending, isError: isMarkDoneError } = useMarkTreatmentDone();
  const [markActingId, setMarkActingId] = useState<string | null>(null);
  useEffect(() => {
    if (!isMarkDoneError) setMarkActingId(null);
  }, [isMarkDoneError]);

  // Split into payable (performed|verified) vs estimate (diagnosed|planned) — the SoT
  // the footer summary also consumes, so the two never disagree.
  const { billable, estimate } = splitBillable(lineItems);
  const billableCents = billable.reduce((sum, item) => sum + item.priceCents, 0);
  const estimateCents = estimate.reduce((sum, item) => sum + item.priceCents, 0);
  const hasBillable = billable.length > 0;
  const hasEstimate = estimate.length > 0;

  // THIS visit's invoice (one invoice per visit) — scoped to props.visitId so a prior
  // visit's PAID invoice never surfaces on the current unbilled visit (item 11).
  const visitInvoice = invoices
    .filter((inv) => inv.status !== 'voided' && inv.visitId === visitId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  async function handleCreateInvoice() {
    // QA-008: the backend requires a visitId (plus branch + member, from org context
    // inside the hook). And there must be a billable line — the CTA is gated on it,
    // so this can no longer 422 with NO_BILLABLE_TREATMENTS.
    if (!visitId || !hasBillable) return;
    try {
      const inv = await createInvoice.mutateAsync({ visitId });
      setInvoiceDetailId(inv.id);
    } catch {
      // surfaced via createInvoice.isError below + a toast in the hook.
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
        ref={containerRef}
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
                <p className="text-sm text-muted-foreground">{patientName}</p>
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
                invoiceNumber={visitInvoice.invoiceNumber}
                status={visitInvoice.status}
                totalCents={visitInvoice.totalCents}
                balanceCents={visitInvoice.balanceCents}
                onViewDetail={() => setInvoiceDetailId(visitInvoice.id)}
              />
            ) : null}

            {/* Line items render independently of invoice loading (they come from the
                visit's treatments, not the invoices query). */}
            <>
              {/* Ready to bill — the payable set (performed | verified) */}
              {hasBillable && (
                <div className="px-5" data-testid="billable-section">
                  <SectionHead title="Ready to bill" />
                  {billable.map((item) => (
                    <LineItemRow key={item.id} item={item} />
                  ))}
                </div>
              )}

              {/* Payable subtotal — billable only */}
              {hasBillable && (
                <div
                  data-testid="subtotal-row"
                  className="mx-0 mt-3 flex items-center justify-between border-y border-border bg-lemon-soft px-5 py-3"
                >
                  <span className="text-sm font-semibold text-lemon-foreground">Subtotal</span>
                  <span
                    data-testid="subtotal-amount"
                    className="text-base font-bold tabular-nums text-lemon-foreground"
                  >
                    {formatCents(billableCents)}
                  </span>
                </div>
              )}

              {/* Estimate — planned work, NOT payable yet */}
              {hasEstimate && (
                <div className="px-5" data-testid="estimate-section">
                  <SectionHead title="Estimate" hint="not yet billable" />
                  {estimate.map((item) => (
                    <LineItemRow
                      key={item.id}
                      item={item}
                      onMarkPerformed={
                        visitId
                          ? () => {
                              setMarkActingId(item.id);
                              markDone(item.id, visitId, item.status as Parameters<typeof markDone>[2]);
                            }
                          : undefined
                      }
                      marking={isMarkDonePending && markActingId === item.id}
                      errored={isMarkDoneError && markActingId === item.id}
                    />
                  ))}
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span className="text-sm font-medium text-muted-foreground">Estimate total</span>
                    <span
                      data-testid="estimate-total"
                      className="text-sm font-semibold tabular-nums text-muted-foreground"
                    >
                      {formatCents(estimateCents)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Planned treatments are billed once marked performed.
                  </p>
                </div>
              )}

              {/* Nothing at all (wait for the invoice check so it doesn't flash) */}
              {!hasBillable && !hasEstimate && !visitInvoice && !invoicesLoading && (
                <div className="flex h-24 flex-col items-center justify-center gap-1 px-5 text-center">
                  <CreditCard className="h-6 w-6 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No treatment items yet. Add treatments on the odontogram to generate a payment.
                  </p>
                </div>
              )}
            </>
          </div>

          {/* Footer actions */}
          <div className="shrink-0 border-t border-border px-5 py-4">
            {visitInvoice ? (
              <button
                type="button"
                onClick={() => setInvoiceDetailId(visitInvoice.id)}
                data-testid="open-invoice-detail-btn"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-lemon py-3 text-base font-semibold text-lemon-foreground hover:bg-lemon-hover transition-colors min-h-[44px]"
              >
                <CreditCard className="h-4 w-4" />
                Record Payment
              </button>
            ) : hasBillable ? (
              <>
                <button
                  type="button"
                  onClick={handleCreateInvoice}
                  disabled={createInvoice.isPending || !visitId}
                  data-testid="create-invoice-btn"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-lemon py-3 text-base font-semibold text-lemon-foreground hover:bg-lemon-hover transition-colors min-h-[44px] disabled:opacity-50"
                >
                  <CreditCard className="h-4 w-4" />
                  {createInvoice.isPending ? 'Creating Invoice…' : 'Create Invoice & Pay'}
                </button>
                {createInvoice.isError && (
                  <p className="mt-2 text-center text-xs text-destructive" role="alert">
                    Could not create the invoice. Please try again.
                  </p>
                )}
              </>
            ) : (
              // No billable line → no Pay button that would 422. Explain + offer a
              // clean exit (the estimate above is the answer to "what now?").
              <>
                {hasEstimate && (
                  <p data-testid="no-billable-note" className="mb-2 text-center text-xs text-muted-foreground">
                    Nothing to bill yet — tap <span className="font-medium text-foreground">Mark done</span> on a
                    treatment above once it’s performed, and it becomes billable here.
                  </p>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  data-testid="estimate-done-btn"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-base font-semibold text-foreground hover:bg-muted transition-colors min-h-[44px]"
                >
                  Done
                </button>
              </>
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
