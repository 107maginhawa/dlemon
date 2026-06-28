/**
 * InvoiceDetail -- slide-over sheet for viewing/managing a single invoice
 *
 * Features: invoice header, line items table, totals, payments list,
 *           issue/void/record-payment actions
 *
 * Wireframe: docs/prd/context/wireframes/invoice-detail.html
 */

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { toast } from 'sonner';
import { toastError } from '@/lib/error-toast';
import {
  getDentalInvoiceOptions,
  getDentalInvoiceQueryKey,
  issueDentalInvoiceMutation,
  voidDentalInvoiceMutation,
  markUncollectibleMutation,
  recordDentalPaymentMutation,
  applyDentalDiscountMutation,
  voidDentalPaymentMutation,
  refundDentalPaymentMutation,
} from '@monobase/sdk-ts/generated/react-query';
import {
  type InvoiceData,
  showIssueButton, showVoidButton, showRecordButton, showMarkUncollectibleButton,
  showDiscountButton, canVoidPaymentRow, showCreatePlanButton,
  validatePaymentForm, buildPaymentPayload, validateDiscountForm,
  formatCents, getStatusBadgeClass, formatStatus,
  PAYMENT_METHODS, METHOD_LABELS,
} from './invoice-detail.helpers';
import { Skeleton } from '@monobase/ui';
import { useOrgContextStore } from '@/stores/org-context.store';
import { canApplyDiscount, canVoidPayment, type DentalRole } from '@/lib/rbac';
import { PaymentReceipt } from './payment-receipt';
import { PaymentPlanCreate } from './payment-plan-create';

export type { LineItem, Payment, InvoiceData } from './invoice-detail.helpers';
export {
  canIssue, canVoid, canRecord,
  showIssueButton, showVoidButton, showRecordButton,
  validatePaymentForm, buildPaymentPayload, calcChangeAmount,
  formatInvoiceDate,
} from './invoice-detail.helpers';
import { formatInvoiceDate } from './invoice-detail.helpers';

export interface InvoiceDetailProps {
  invoiceId: string;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  /** Called when the user clicks "View payment plan" */
  onViewPlan?: () => void;
  /**
   * Whether the current role may perform billing WRITE lifecycle actions
   * (issue / void). Defaults to `true` to preserve existing callers; the
   * billing route passes `canWriteBilling(role)` so roles like `staff_full`
   * and `billing_staff` see "Record payment" but NOT "Issue"/"Void"
   * (J-RBAC-001). Recording a payment is always allowed when the invoice
   * status permits it.
   */
  canWrite?: boolean;
  /**
   * Quick-pay: when the sheet is opened straight from the billing list's
   * "Record payment" row action, jump directly to the payment form so the
   * front desk doesn't have to find it in the footer first.
   */
  openToPayment?: boolean;
}

export function InvoiceDetail({ invoiceId, open, onClose, onUpdated, onViewPlan, canWrite = true, openToPayment = false }: InvoiceDetailProps) {
  useSheetA11y({ open, onClose: handleEscape });
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  // Quick-pay: auto-open the payment form when launched from the list row action.
  useEffect(() => {
    if (open && openToPayment) setShowPaymentForm(true);
  }, [open, openToPayment]);

  const panelRef = useRef<HTMLDivElement>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentErrors, setPaymentErrors] = useState<string[]>([]);
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const [showUncollectibleForm, setShowUncollectibleForm] = useState(false);
  const [uncollectibleError, setUncollectibleError] = useState<string | null>(null);
  // FR4.6: payment whose printable receipt is currently open (null = none).
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  // FIX-003: apply-discount form state (owner-only money write-down).
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [discountRate, setDiscountRate] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [discountErrors, setDiscountErrors] = useState<string[]>([]);
  // FIX-004: per-payment void state (which payment row is being voided + reason).
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);
  const [paymentVoidReason, setPaymentVoidReason] = useState('');
  const [paymentVoidError, setPaymentVoidError] = useState<string | null>(null);
  // BR-053: per-payment refund (owner-only, reason-required, optional book-as-credit).
  const [refundingPaymentId, setRefundingPaymentId] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundAsCredit, setRefundAsCredit] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  // FIX-005: payment-plan create dialog open state.
  const [showPlanCreate, setShowPlanCreate] = useState(false);
  // Footer overflow: rare/secondary actions collapse into a "More" menu so the
  // primary action (Record payment / Issue) isn't lost in a row of 7 buttons.
  const [moreOpen, setMoreOpen] = useState(false);

  // Focus trap (a11y): this is a hand-rolled overlay, so Tab can otherwise escape
  // the sheet to the page behind it. Keep focus inside the panel while open. Stand
  // down while a nested modal (plan-create / receipt) owns focus so we don't fight it.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (showPlanCreate || receiptPaymentId) return; // nested modal owns focus
      const root = panelRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, showPlanCreate, receiptPaymentId]);

  const qc = useQueryClient();
  // The recording staff member comes from the PIN-authenticated org context.
  // Without it the POST sends an empty recordedByMemberId and the backend
  // rejects it with 400 "Invalid UUID" (mirrors useWorkspacePayment / QA-008).
  const recordedByMemberId = useOrgContextStore((s) => s.memberId);
  // FIX-003/004: discount + payment-void are OWNER-ONLY (backend
  // assertBranchRole(['dentist_owner'])) — STRICTER than the canWrite prop
  // (owner||associate). Source role from the same org context as recordedByMemberId
  // so the affordances hide for non-owners (the backend is still the hard 403 gate).
  const role = useOrgContextStore((s) => s.role) as DentalRole | null;
  const canDiscount = role ? canApplyDiscount(role) : false;
  const canVoidPmt = role ? canVoidPayment(role) : false;

  // ---------------------------------------------------------------------------
  // GET invoice — replaces the manual useEffect+setState fetch
  // The SDK DentalInvoice type carries patientName/visitDate (modeled 2026-06-13) but
  // still not lineItems/payments (backend enrichments not in spec). We cast via `select` and convert
  // Date fields back to strings (the SDK transformer converts dueDate/issuedAt to
  // Date objects; InvoiceData consumers expect strings, per the pre-migration contract).
  // Same pattern as use-visits.ts.
  // ---------------------------------------------------------------------------
  const invoiceQuery = useQuery({
    ...getDentalInvoiceOptions({ path: { invoiceId } }),
    enabled: open && !!invoiceId,
    select: (data): InvoiceData => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = data as any;
      const toStr = (d: Date | string | undefined): string | undefined =>
        d == null ? undefined : d instanceof Date ? d.toISOString() : String(d);
      return {
        ...raw,
        dueDate: toStr(raw.dueDate),
        issueDate: toStr(raw.issuedAt ?? raw.issueDate),
        // Backend enrichments (payments[].createdAt) are plain JSON strings from the
        // server — no transformer touches nested arrays — so no conversion needed there.
      } as InvoiceData;
    },
  });

  const invoice = invoiceQuery.data ?? null;
  const loading = invoiceQuery.isLoading;
  const error = invoiceQuery.isError
    ? (invoiceQuery.error instanceof Error ? invoiceQuery.error.message : 'Failed to load invoice')
    : null;

  const invoiceQueryKey = getDentalInvoiceQueryKey({ path: { invoiceId } });

  function invalidateInvoice() {
    qc.invalidateQueries({ queryKey: invoiceQueryKey });
  }

  // ---------------------------------------------------------------------------
  // PATCH /issue
  // ---------------------------------------------------------------------------
  const issueMutation = useMutation({
    ...issueDentalInvoiceMutation(),
    onSuccess: () => {
      invalidateInvoice();
      onUpdated?.();
    },
    onError: (_err) => {
      // error surfaces via invoiceQuery.isError banner
    },
  });

  // ---------------------------------------------------------------------------
  // POST /void
  // Contract (API_CONTRACTS §void): reason is required (min 5) so the void is
  // auditable. Guard client-side before sending.
  // ---------------------------------------------------------------------------
  const voidMutation = useMutation({
    ...voidDentalInvoiceMutation(),
    onSuccess: () => {
      setShowVoidForm(false);
      setVoidReason('');
      invalidateInvoice();
      onUpdated?.();
    },
    onError: (err) => {
      setVoidError(err instanceof Error ? err.message : 'Failed');
    },
  });

  // ---------------------------------------------------------------------------
  // POST /uncollectible
  // BR-013: write off the invoice. Owner-only + transition guard enforced server-side.
  // ---------------------------------------------------------------------------
  const uncollectibleMutation = useMutation({
    ...markUncollectibleMutation(),
    onSuccess: () => {
      setShowUncollectibleForm(false);
      invalidateInvoice();
      onUpdated?.();
    },
    onError: (err) => {
      setUncollectibleError(err instanceof Error ? err.message : 'Failed');
    },
  });

  // ---------------------------------------------------------------------------
  // POST /payments
  // ---------------------------------------------------------------------------
  const recordPaymentMutation = useMutation({
    ...recordDentalPaymentMutation(),
    onSuccess: () => {
      setShowPaymentForm(false);
      setPaymentAmount('');
      setPaymentMethod('cash');
      setReceiptNumber('');
      invalidateInvoice();
      onUpdated?.();
      toast.success('Payment recorded');
    },
    onError: (err) => {
      setPaymentErrors([err instanceof Error ? err.message : 'Failed']);
      toastError(err, 'Could not record payment');
    },
  });

  // ---------------------------------------------------------------------------
  // POST /discount (FIX-003)
  // applyDentalDiscount returns the FULL updated invoice, but it lacks the
  // backend enrichments the sheet renders (lineItems/payments). Invalidate +
  // refetch the enriched GET so the totals re-render from coherent server truth.
  // ---------------------------------------------------------------------------
  const discountMutation = useMutation({
    ...applyDentalDiscountMutation(),
    onSuccess: () => {
      setShowDiscountForm(false);
      setDiscountRate('');
      setDiscountReason('');
      setDiscountErrors([]);
      invalidateInvoice();
      onUpdated?.();
    },
    onError: (err) => {
      setDiscountErrors([err instanceof Error ? err.message : 'Failed']);
    },
  });

  // ---------------------------------------------------------------------------
  // POST /payments/{paymentId}/void (FIX-004)
  // The void response carries only the payment row (no restored balance), so
  // invalidate + refetch the invoice for the corrected balance/status.
  // ---------------------------------------------------------------------------
  const paymentVoidMutation = useMutation({
    ...voidDentalPaymentMutation(),
    onSuccess: () => {
      setVoidingPaymentId(null);
      setPaymentVoidReason('');
      setPaymentVoidError(null);
      invalidateInvoice();
      onUpdated?.();
    },
    onError: (err) => {
      setPaymentVoidError(err instanceof Error ? err.message : 'Failed');
    },
  });

  // POST /payments/{paymentId}/refund (BR-053) — owner-only, reverses the
  // refunded amount from the invoice; invalidate for the corrected balance.
  const refundMutation = useMutation({
    ...refundDentalPaymentMutation(),
    onSuccess: () => {
      setRefundingPaymentId(null);
      setRefundAmount('');
      setRefundReason('');
      setRefundAsCredit(false);
      setRefundError(null);
      invalidateInvoice();
      onUpdated?.();
      toast.success('Payment refunded');
    },
    onError: (err) => {
      setRefundError(err instanceof Error ? err.message : 'Failed');
    },
  });

  function handleRefundPayment() {
    if (!refundingPaymentId) return;
    const amountCents = Math.round((Number(refundAmount) || 0) * 100);
    const reason = refundReason.trim();
    if (amountCents <= 0) { setRefundError('Enter a refund amount greater than zero.'); return; }
    if (reason.length < 3) { setRefundError('Enter a refund reason (at least 3 characters).'); return; }
    setRefundError(null);
    refundMutation.mutate({ path: { paymentId: refundingPaymentId }, body: { amountCents, reason, bookAsCredit: refundAsCredit } });
  }

  const saving =
    issueMutation.isPending ||
    voidMutation.isPending ||
    uncollectibleMutation.isPending ||
    recordPaymentMutation.isPending ||
    discountMutation.isPending ||
    paymentVoidMutation.isPending;

  if (!open) return null;

  function handleIssue() {
    if (!invoice) return;
    issueMutation.mutate({ path: { invoiceId } });
  }

  function handleVoid() {
    if (!invoice) return;
    const reason = voidReason.trim();
    if (reason.length < 5) {
      setVoidError('Please enter a void reason (at least 5 characters).');
      return;
    }
    setVoidError(null);
    voidMutation.mutate({ path: { invoiceId }, body: { reason } });
  }

  function handleMarkUncollectible() {
    if (!invoice) return;
    setUncollectibleError(null);
    uncollectibleMutation.mutate({ path: { invoiceId } });
  }

  function handleRecordPayment() {
    const amountCents = Math.round(parseFloat(paymentAmount || '0') * 100);
    const errs = validatePaymentForm({ amountCents, method: paymentMethod, receiptNumber });
    if (errs.length > 0) { setPaymentErrors(errs); return; }
    if (!recordedByMemberId) {
      setPaymentErrors(['No active staff member context — please re-select your profile and try again.']);
      return;
    }
    setPaymentErrors([]);
    const payload = buildPaymentPayload({ amountCents, method: paymentMethod, receiptNumber, recordedByMemberId });
    recordPaymentMutation.mutate({
      path: { invoiceId },
      body: {
        amountCents: payload.amountCents,
        method: payload.method as Parameters<typeof recordPaymentMutation.mutate>[0]['body']['method'],
        receiptNumber: payload.receiptNumber,
        recordedByMemberId: payload.recordedByMemberId,
      },
    });
  }

  function handleApplyDiscount() {
    if (!invoice) return;
    const percentageRate = parseFloat(discountRate || '0');
    const errs = validateDiscountForm({ percentageRate, reason: discountReason });
    if (errs.length > 0) { setDiscountErrors(errs); return; }
    setDiscountErrors([]);
    // percentageRate is a 0–100 PERCENTAGE (not cents/fraction) — sent raw.
    discountMutation.mutate({ path: { invoiceId }, body: { reason: discountReason.trim(), percentageRate } });
  }

  function handleVoidPayment() {
    if (!invoice || !voidingPaymentId) return;
    const reason = paymentVoidReason.trim();
    if (reason.length < 5) {
      setPaymentVoidError('Please enter a void reason (at least 5 characters).');
      return;
    }
    setPaymentVoidError(null);
    paymentVoidMutation.mutate({ path: { invoiceId, paymentId: voidingPaymentId }, body: { voidReason: reason } });
  }

  function handleClose() {
    setShowPaymentForm(false);
    setPaymentErrors([]);
    setShowVoidForm(false);
    setVoidReason('');
    setVoidError(null);
    setShowDiscountForm(false);
    setDiscountRate('');
    setDiscountReason('');
    setDiscountErrors([]);
    setVoidingPaymentId(null);
    setPaymentVoidReason('');
    setPaymentVoidError(null);
    setShowPlanCreate(false);
    setMoreOpen(false);
    onClose();
  }

  // Escape: collapse the More menu first if it's open; otherwise close the sheet.
  // useSheetA11y handles Escape in the capture phase with stopPropagation, so the
  // menu's own onKeyDown never fires — route Escape through here instead.
  function handleEscape() {
    if (moreOpen) {
      setMoreOpen(false);
      return;
    }
    handleClose();
  }

  // Secondary/rare footer actions, collapsed behind the "More" menu. Built from
  // the same show*() gates that previously rendered each footer button inline, so
  // RBAC + status gating is unchanged; only the placement (menu vs row) differs.
  type SecondaryAction = {
    key: string;
    label: string;
    onClick: () => void;
    destructive?: boolean;
    testid?: string;
    title?: string;
  };
  const secondaryActions: SecondaryAction[] = [];
  if (invoice) {
    if (onViewPlan) {
      secondaryActions.push({ key: 'view-plan', label: 'View payment plan', onClick: () => onViewPlan() });
    }
    if (showCreatePlanButton(invoice.status, canWrite, invoice.balanceCents)) {
      secondaryActions.push({ key: 'create-plan', label: 'Create payment plan', onClick: () => setShowPlanCreate(true) });
    }
    if (showDiscountButton(invoice.status, canDiscount) && !showDiscountForm) {
      secondaryActions.push({ key: 'discount', label: 'Apply discount', onClick: () => { setShowDiscountForm(true); setDiscountErrors([]); } });
    }
    if (showVoidButton(invoice.status, canWrite) && !showVoidForm) {
      secondaryActions.push({ key: 'void', label: 'Void', destructive: true, title: 'Cancel this whole invoice (e.g. created in error). A reason is recorded.', onClick: () => { setShowVoidForm(true); setVoidError(null); } });
    }
    if (showMarkUncollectibleButton(invoice.status, canWrite) && !showUncollectibleForm) {
      secondaryActions.push({ key: 'uncollectible', label: 'Mark uncollectible', testid: 'mark-uncollectible-btn', title: "Write this invoice off as unpayable (give up on collecting it). This can't be undone.", onClick: () => { setShowUncollectibleForm(true); setUncollectibleError(null); } });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Invoice Detail">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div
        ref={panelRef}
        data-testid="invoice-detail"
        className="relative w-full max-w-[640px] max-h-[calc(100vh-80px)] bg-background rounded-2xl shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-[52px] border-b flex-shrink-0">
          <h2 className="text-[17px] font-semibold tracking-tight">
            {invoice ? `Invoice ${invoice.invoiceNumber}` : 'Invoice Detail'}
          </h2>
          <button type="button" onClick={handleClose} aria-label="Close" className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          {loading && (
            <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading invoice">
              {/* Invoice info header */}
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <div className="space-y-2 text-right">
                  <Skeleton className="h-3 w-12 ml-auto" />
                  <Skeleton className="h-4 w-28 ml-auto" />
                </div>
              </div>
              {/* Line item rows */}
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
              {/* Totals */}
              <Skeleton className="h-24 rounded-xl" />
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          {invoice && !loading && (
            <>
              {/* Invoice info */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground/60">Invoice</p>
                  <p className="text-xl font-semibold tracking-tight tabular-nums">{invoice.invoiceNumber}</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold mt-1 ${getStatusBadgeClass(invoice.status)}`}>
                    {formatStatus(invoice.status)}
                  </span>
                </div>
                <div className="text-right text-[13px] space-y-1">
                  <div>
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/60 block">Bill To</span>
                    <span className="font-medium">{invoice.patientName ?? invoice.patientId}</span>
                  </div>
                  {invoice.visitDate && (
                    <div>
                      <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/60 block">Visit Date</span>
                      <span>{formatInvoiceDate(invoice.visitDate)}</span>
                    </div>
                  )}
                  {invoice.dueDate && (
                    <div>
                      <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/60 block">Due Date</span>
                      <span>{formatInvoiceDate(invoice.dueDate)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h3 className="text-[13px] font-semibold tracking-wider uppercase text-muted-foreground mb-3">Services & Procedures</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['#', 'Description', 'CDT', 'Tooth', 'Amount'].map((h, i) => (
                        <th key={h} className={`text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-3 py-2 border-b border-border ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems.map((item, idx) => (
                      <tr key={item.id} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="px-3 py-2.5 text-[13px] font-medium">{item.description}</td>
                        <td className="px-3 py-2.5">
                          {item.cdtCode && <span className="text-[11px] font-semibold text-info-foreground bg-info/15 px-1.5 py-0.5 rounded">{item.cdtCode}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-[13px] text-muted-foreground">{item.toothNumber ? `#${item.toothNumber}` : '--'}</td>
                        <td className="px-3 py-2.5 text-[13px] font-semibold text-right tabular-nums">{formatCents(item.priceCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="flex flex-col gap-1.5 mt-4 pt-4 border-t border-border">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">{formatCents(invoice.subtotalCents)}</span>
                  </div>
                  {invoice.discountCents > 0 && (
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="font-medium tabular-nums text-success-foreground">-{formatCents(invoice.discountCents)}</span>
                    </div>
                  )}
                  {invoice.taxCents > 0 && (
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="font-medium tabular-nums">{formatCents(invoice.taxCents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2.5 border-t border-border mt-1">
                    <span className="text-[15px] font-bold">Total</span>
                    <span className="text-xl font-bold tabular-nums">{formatCents(invoice.totalCents)}</span>
                  </div>
                </div>
              </div>

              {/* Payments */}
              <div>
                <h3 className="text-[13px] font-semibold tracking-wider uppercase text-muted-foreground mb-3">Payments Received</h3>
                {invoice.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {['Receipt #', 'Date', 'Method', 'Amount', ''].map((h, i) => (
                          <th key={h || 'actions'} className={`text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-3 py-2 border-b border-border ${i === 3 ? 'text-right' : i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.payments.map((pmt) => (
                        <tr key={pmt.id} className={pmt.isVoid ? 'opacity-60' : undefined}>
                          <td className="px-3 py-2.5 text-xs font-semibold text-lemon-foreground">{pmt.receiptNumber}</td>
                          <td className="px-3 py-2.5 text-[13px] tabular-nums">{new Date(pmt.createdAt).toLocaleDateString()}</td>
                          <td className="px-3 py-2.5 text-[13px]">{METHOD_LABELS[pmt.method] ?? pmt.method}</td>
                          <td className="px-3 py-2.5 text-[13px] font-semibold text-right tabular-nums">{formatCents(pmt.amountCents)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2.5">
                              {/* FIX-004: a voided payment stays in the list as a reversal row. */}
                              {pmt.isVoid && (
                                <span
                                  className="text-[11px] font-semibold uppercase tracking-wide text-destructive"
                                  title={pmt.voidReason ?? undefined}
                                >
                                  Voided
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setReceiptPaymentId(pmt.id)}
                                className="text-xs text-foreground/70 hover:text-foreground transition-colors coarse:inline-flex coarse:items-center coarse:min-h-[44px]"
                              >
                                Receipt
                              </button>
                              {canVoidPaymentRow(canVoidPmt, pmt) && (
                                <button
                                  type="button"
                                  data-testid={`void-payment-${pmt.id}`}
                                  disabled={saving}
                                  title="Reverse this payment entry — use when it was posted in error (no money changes hands)."
                                  onClick={() => { setVoidingPaymentId(pmt.id); setPaymentVoidReason(''); setPaymentVoidError(null); }}
                                  className="text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50 coarse:inline-flex coarse:items-center coarse:min-h-[44px]"
                                >
                                  Void
                                </button>
                              )}
                              {/* BR-053: refund is owner-only (same gate as void) on a non-void payment. */}
                              {canVoidPmt && !pmt.isVoid && (
                                <button
                                  type="button"
                                  data-testid={`refund-payment-${pmt.id}`}
                                  disabled={saving}
                                  title="Give money back to the patient for this payment (cash refund or store as credit)."
                                  onClick={() => { setRefundingPaymentId(pmt.id); setRefundAmount((pmt.amountCents / 100).toFixed(2)); setRefundReason(''); setRefundAsCredit(false); setRefundError(null); }}
                                  className="text-xs text-foreground/70 hover:text-foreground transition-colors disabled:opacity-50 coarse:inline-flex coarse:items-center coarse:min-h-[44px]"
                                >
                                  Refund
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                  <span className="text-sm font-semibold text-muted-foreground">Balance Remaining</span>
                  {/* Reserve red for genuinely overdue money; a normal owed balance is neutral ink, paid is green. */}
                  <span className={`text-2xl font-bold tabular-nums ${invoice.balanceCents <= 0 ? 'text-success-foreground' : invoice.status === 'overdue' ? 'text-destructive-emphasis' : 'text-foreground'}`}>
                    {formatCents(invoice.balanceCents)}
                  </span>
                </div>
              </div>

              {/* Record payment inline form */}
              {showPaymentForm && (
                <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
                  <h4 className="text-sm font-semibold">Record payment</h4>
                  {paymentErrors.length > 0 && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                      {paymentErrors.map((e) => <p key={e}>{e}</p>)}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="pay-amount">Amount *</label>
                    <input id="pay-amount" type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Method *</label>
                    <div className="flex border border-border rounded-xl overflow-hidden bg-secondary/30 p-0.5 gap-0.5" role="group">
                      {PAYMENT_METHODS.map((m) => (
                        <button key={m} type="button" onClick={() => setPaymentMethod(m)} aria-pressed={paymentMethod === m}
                          className={`flex-1 h-9 coarse:h-11 text-[13px] font-medium rounded-lg transition-colors ${paymentMethod === m ? 'bg-lemon text-lemon-foreground font-semibold' : 'text-muted-foreground hover:bg-background'}`}>
                          {METHOD_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="pay-receipt">Receipt # *</label>
                    <input id="pay-receipt" type="text" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="e.g. R-A-0001" className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setShowPaymentForm(false); setPaymentErrors([]); }} className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Cancel</button>
                    <button type="button" onClick={handleRecordPayment} disabled={saving} className="flex-1 h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50">
                      {saving ? 'Recording...' : 'Record'}
                    </button>
                  </div>
                </div>
              )}

              {/* Void reason form — the void contract requires an auditable reason */}
              {showVoidForm && (
                <div className="rounded-xl border border-destructive/30 p-4 flex flex-col gap-3">
                  <h4 className="text-sm font-semibold text-destructive">Void invoice</h4>
                  {voidError && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">{voidError}</div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="void-reason">Reason *</label>
                    <input id="void-reason" type="text" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Duplicate invoice" className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setShowVoidForm(false); setVoidReason(''); setVoidError(null); }} className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Cancel</button>
                    <button type="button" onClick={handleVoid} disabled={saving} className="flex-1 h-11 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors disabled:opacity-50">
                      {saving ? 'Voiding...' : 'Confirm void'}
                    </button>
                  </div>
                </div>
              )}

              {/* BR-013: write-off confirmation — terminal, owner-only */}
              {showUncollectibleForm && (
                <div data-testid="uncollectible-confirm" className="rounded-xl border border-border p-4 flex flex-col gap-3">
                  <h4 className="text-sm font-semibold text-foreground">Mark uncollectible</h4>
                  <p className="text-sm text-muted-foreground">This writes off the invoice as uncollectible. This cannot be undone.</p>
                  {uncollectibleError && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">{uncollectibleError}</div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setShowUncollectibleForm(false); setUncollectibleError(null); }} className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Cancel</button>
                    <button type="button" onClick={handleMarkUncollectible} disabled={saving} className="flex-1 h-11 rounded-xl border border-border bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors disabled:opacity-50">
                      {saving ? 'Writing off...' : 'Confirm write-off'}
                    </button>
                  </div>
                </div>
              )}

              {/* FIX-003: apply-discount inline form — owner-only money write-down.
                   percentageRate is a 0–100 PERCENTAGE; the backend recalculates
                   totals and returns the updated invoice. */}
              {showDiscountForm && (
                <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
                  <h4 className="text-sm font-semibold">Apply discount</h4>
                  {discountErrors.length > 0 && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                      {discountErrors.map((e) => <p key={e}>{e}</p>)}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="discount-rate">Discount %</label>
                    <input id="discount-rate" type="number" step="0.01" min="0" max="100" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} placeholder="e.g. 20" className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="discount-reason">Discount reason *</label>
                    <input id="discount-reason" type="text" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="e.g. Senior citizen discount" className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setShowDiscountForm(false); setDiscountErrors([]); setDiscountRate(''); setDiscountReason(''); }} className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Cancel</button>
                    <button type="button" onClick={handleApplyDiscount} disabled={saving} className="flex-1 h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50">
                      {saving ? 'Applying...' : 'Apply'}
                    </button>
                  </div>
                </div>
              )}

              {/* FIX-004: per-payment void form — owner-only, reason-bearing soft-delete. */}
              {voidingPaymentId && (
                <div className="rounded-xl border border-destructive/30 p-4 flex flex-col gap-3">
                  <h4 className="text-sm font-semibold text-destructive">Void payment</h4>
                  {paymentVoidError && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">{paymentVoidError}</div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="payment-void-reason">Void reason *</label>
                    <input id="payment-void-reason" type="text" value={paymentVoidReason} onChange={(e) => setPaymentVoidReason(e.target.value)} placeholder="e.g. Posted in error" className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setVoidingPaymentId(null); setPaymentVoidReason(''); setPaymentVoidError(null); }} className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Cancel</button>
                    <button type="button" data-testid="confirm-payment-void" onClick={handleVoidPayment} disabled={saving} className="flex-1 h-11 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors disabled:opacity-50">
                      {saving ? 'Voiding...' : 'Confirm void'}
                    </button>
                  </div>
                </div>
              )}

              {/* BR-053: per-payment refund form — owner-only, reason-required. */}
              {refundingPaymentId && (
                <div className="rounded-xl border border-border p-4 flex flex-col gap-3" data-testid="refund-payment-form">
                  <h4 className="text-sm font-semibold">Refund payment</h4>
                  {refundError && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">{refundError}</div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="refund-amount">Amount *</label>
                    <input id="refund-amount" data-testid="refund-amount" type="number" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="0.00" className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="refund-reason">Reason *</label>
                    <input id="refund-reason" data-testid="refund-reason" type="text" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="e.g. Treatment cancelled" className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none" />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" data-testid="refund-as-credit" checked={refundAsCredit} onChange={(e) => setRefundAsCredit(e.target.checked)} className="h-4 w-4 rounded border-border" />
                    Book as patient credit instead of cash refund
                  </label>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setRefundingPaymentId(null); setRefundError(null); }} className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Cancel</button>
                    <button type="button" data-testid="confirm-payment-refund" onClick={handleRefundPayment} disabled={saving || refundMutation.isPending} className="flex-1 h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50">
                      {refundMutation.isPending ? 'Refunding...' : 'Confirm refund'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {invoice && !loading && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t flex-shrink-0 [&>button]:whitespace-nowrap">
            {showIssueButton(invoice.status, canWrite) && (
              <button type="button" onClick={handleIssue} disabled={saving} className="h-11 px-5 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50">Issue invoice</button>
            )}
            {showRecordButton(invoice.status) && !showPaymentForm && (
              <button type="button" onClick={() => setShowPaymentForm(true)} className="h-11 px-5 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors">Record payment</button>
            )}

            {/* Secondary/rare actions collapse into one "More" menu (keeps the
                primary action prominent instead of a 7-button wall). */}
            {secondaryActions.length > 0 && (
              <div className="relative" onKeyDown={(e) => { if (e.key === 'Escape') setMoreOpen(false); }}>
                <button
                  type="button"
                  data-testid="invoice-more-btn"
                  aria-haspopup="true"
                  aria-expanded={moreOpen}
                  disabled={saving}
                  onClick={() => setMoreOpen((o) => !o)}
                  className="h-11 px-4 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  More
                </button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-40" aria-hidden onClick={() => setMoreOpen(false)} />
                    <div className="absolute bottom-full right-0 mb-2 z-50 min-w-[208px] rounded-xl border border-border bg-background shadow-lg p-1">
                      {secondaryActions.map((a) => (
                        <button
                          key={a.key}
                          type="button"
                          data-testid={a.testid}
                          title={a.title}
                          disabled={saving}
                          onClick={() => { a.onClick(); setMoreOpen(false); }}
                          className={`flex w-full items-center min-h-[44px] px-3 rounded-lg text-sm text-left transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${a.destructive ? 'text-destructive hover:bg-destructive/10' : 'hover:bg-secondary'}`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <button type="button" onClick={handleClose} className="ml-auto h-11 px-5 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Close</button>
          </div>
        )}
      </div>

      {/* FIX-005: create payment plan dialog */}
      {showPlanCreate && invoice && (
        <PaymentPlanCreate
          invoiceId={invoiceId}
          patientId={invoice.patientId}
          balanceCents={invoice.balanceCents}
          open={showPlanCreate}
          onClose={() => setShowPlanCreate(false)}
          onCreated={() => { invalidateInvoice(); onUpdated?.(); }}
        />
      )}

      {/* FR4.6: printable payment receipt overlay */}
      {receiptPaymentId && invoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Payment receipt">
          <div className="absolute inset-0 bg-black/40 no-print" onClick={() => setReceiptPaymentId(null)} />
          <div className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl bg-background shadow-2xl p-5">
            <div className="no-print flex justify-end mb-2">
              <button type="button" onClick={() => setReceiptPaymentId(null)} aria-label="Close receipt" className="w-7 h-7 coarse:w-11 coarse:h-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
            </div>
            <PaymentReceipt invoiceId={invoice.id} paymentId={receiptPaymentId} />
          </div>
        </div>
      )}
    </div>
  );
}
