/**
 * InvoiceDetail -- slide-over sheet for viewing/managing a single invoice
 *
 * Features: invoice header, line items table, totals, payments list,
 *           issue/void/record-payment actions
 *
 * Wireframe: docs/prd/context/wireframes/invoice-detail.html
 */

import React, { useState, useEffect } from 'react';
import { apiBaseUrl } from '@/lib/config';
import {
  type InvoiceData,
  showIssueButton, showVoidButton, showRecordButton,
  validatePaymentForm, buildPaymentPayload,
  formatCents, getStatusBadgeClass, formatStatus,
  PAYMENT_METHODS, METHOD_LABELS,
} from './invoice-detail.helpers';

export type { LineItem, Payment, InvoiceData } from './invoice-detail.helpers';
export {
  canIssue, canVoid, canRecord,
  showIssueButton, showVoidButton, showRecordButton,
  validatePaymentForm, buildPaymentPayload, calcChangeAmount,
} from './invoice-detail.helpers';

const API = apiBaseUrl;

export interface InvoiceDetailProps {
  invoiceId: string;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  /** Called when the user clicks "View Payment Plan" */
  onViewPlan?: () => void;
  /**
   * Whether the current role may perform billing WRITE lifecycle actions
   * (issue / void). Defaults to `true` to preserve existing callers; the
   * billing route passes `canWriteBilling(role)` so roles like `staff_full`
   * and `billing_staff` see "Record Payment" but NOT "Issue"/"Void"
   * (J-RBAC-001). Recording a payment is always allowed when the invoice
   * status permits it.
   */
  canWrite?: boolean;
}

export function InvoiceDetail({ invoiceId, open, onClose, onUpdated, onViewPlan, canWrite = true }: InvoiceDetailProps) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentErrors, setPaymentErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);

  useEffect(() => {
    if (open && invoiceId) loadInvoice();
  }, [open, invoiceId]);

  if (!open) return null;

  async function loadInvoice() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/dental/billing/invoices/${invoiceId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load invoice');
      const data = await res.json();
      setInvoice(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleIssue() {
    if (!invoice) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/dental/billing/invoices/${invoiceId}/issue`, { method: 'PATCH', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to issue invoice');
      await loadInvoice();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleVoid() {
    if (!invoice) return;
    // Contract (API_CONTRACTS §void): reason is required (min 5) so the void is
    // auditable. Guard client-side before sending.
    const reason = voidReason.trim();
    if (reason.length < 5) {
      setVoidError('Please enter a void reason (at least 5 characters).');
      return;
    }
    setVoidError(null);
    setSaving(true);
    try {
      const res = await fetch(`${API}/dental/billing/invoices/${invoiceId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Failed to void invoice');
      setShowVoidForm(false);
      setVoidReason('');
      await loadInvoice();
      onUpdated?.();
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleRecordPayment() {
    const amountCents = Math.round(parseFloat(paymentAmount || '0') * 100);
    const errs = validatePaymentForm({ amountCents, method: paymentMethod, receiptNumber });
    if (errs.length > 0) { setPaymentErrors(errs); return; }
    setPaymentErrors([]);
    setSaving(true);
    try {
      const payload = buildPaymentPayload({ amountCents, method: paymentMethod, receiptNumber, recordedByMemberId: '' });
      const res = await fetch(`${API}/dental/billing/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to record payment');
      setShowPaymentForm(false);
      setPaymentAmount('');
      setPaymentMethod('cash');
      setReceiptNumber('');
      await loadInvoice();
      onUpdated?.();
    } catch (err) {
      setPaymentErrors([err instanceof Error ? err.message : 'Failed']);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setShowPaymentForm(false);
    setPaymentErrors([]);
    setShowVoidForm(false);
    setVoidReason('');
    setVoidError(null);
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Invoice Detail">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div
        data-testid="invoice-detail"
        className="relative w-full max-w-[640px] max-h-[calc(100vh-80px)] bg-background rounded-2xl shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-[52px] border-b flex-shrink-0">
          <h2 className="text-[17px] font-semibold tracking-tight">
            {invoice ? `Invoice ${invoice.invoiceNumber}` : 'Invoice Detail'}
          </h2>
          <button type="button" onClick={handleClose} aria-label="Close" className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          {invoice && !loading && (
            <>
              {/* Invoice info */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground/50">Invoice</p>
                  <p className="text-xl font-semibold tracking-tight tabular-nums">{invoice.invoiceNumber}</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold mt-1 ${getStatusBadgeClass(invoice.status)}`}>
                    {formatStatus(invoice.status)}
                  </span>
                </div>
                <div className="text-right text-[13px] space-y-1">
                  <div>
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/50 block">Bill To</span>
                    <span className="font-medium">{invoice.patientName ?? invoice.patientId}</span>
                  </div>
                  {invoice.visitDate && (
                    <div>
                      <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/50 block">Visit Date</span>
                      <span>{invoice.visitDate}</span>
                    </div>
                  )}
                  {invoice.dueDate && (
                    <div>
                      <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/50 block">Due Date</span>
                      <span>{invoice.dueDate}</span>
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
                          {item.cdtCode && <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{item.cdtCode}</span>}
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
                      <span className="font-medium tabular-nums text-green-700">-{formatCents(invoice.discountCents)}</span>
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
                        {['Receipt #', 'Date', 'Method', 'Amount'].map((h, i) => (
                          <th key={h} className={`text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-3 py-2 border-b border-border ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.payments.map((pmt) => (
                        <tr key={pmt.id}>
                          <td className="px-3 py-2.5 text-xs font-semibold text-[#4A4018]">{pmt.receiptNumber}</td>
                          <td className="px-3 py-2.5 text-[13px] tabular-nums">{new Date(pmt.createdAt).toLocaleDateString()}</td>
                          <td className="px-3 py-2.5 text-[13px]">{METHOD_LABELS[pmt.method] ?? pmt.method}</td>
                          <td className="px-3 py-2.5 text-[13px] font-semibold text-right tabular-nums">{formatCents(pmt.amountCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                  <span className="text-sm font-semibold text-muted-foreground">Balance Remaining</span>
                  <span className={`text-2xl font-bold tabular-nums ${invoice.balanceCents > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {formatCents(invoice.balanceCents)}
                  </span>
                </div>
              </div>

              {/* Record Payment inline form */}
              {showPaymentForm && (
                <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
                  <h4 className="text-sm font-semibold">Record Payment</h4>
                  {paymentErrors.length > 0 && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                      {paymentErrors.map((e) => <p key={e}>{e}</p>)}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="pay-amount">Amount *</label>
                    <input id="pay-amount" type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Method *</label>
                    <div className="flex border border-border rounded-xl overflow-hidden bg-secondary/30 p-0.5 gap-0.5" role="group">
                      {PAYMENT_METHODS.map((m) => (
                        <button key={m} type="button" onClick={() => setPaymentMethod(m)} aria-pressed={paymentMethod === m}
                          className={`flex-1 h-9 text-[13px] font-medium rounded-lg transition-colors ${paymentMethod === m ? 'bg-[#FFE97D] text-[#4A4018] font-semibold' : 'text-muted-foreground hover:bg-background'}`}>
                          {METHOD_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="pay-receipt">Receipt # *</label>
                    <input id="pay-receipt" type="text" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="e.g. R-A-0001" className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setShowPaymentForm(false); setPaymentErrors([]); }} className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Cancel</button>
                    <button type="button" onClick={handleRecordPayment} disabled={saving} className="flex-1 h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50">
                      {saving ? 'Recording...' : 'Record'}
                    </button>
                  </div>
                </div>
              )}

              {/* Void reason form — the void contract requires an auditable reason */}
              {showVoidForm && (
                <div className="rounded-xl border border-red-200 p-4 flex flex-col gap-3">
                  <h4 className="text-sm font-semibold text-red-600">Void Invoice</h4>
                  {voidError && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">{voidError}</div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="void-reason">Reason *</label>
                    <input id="void-reason" type="text" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Duplicate invoice" className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setShowVoidForm(false); setVoidReason(''); setVoidError(null); }} className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Cancel</button>
                    <button type="button" onClick={handleVoid} disabled={saving} className="flex-1 h-11 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50">
                      {saving ? 'Voiding...' : 'Confirm Void'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {invoice && !loading && (
          <div className="flex items-center gap-3 px-5 h-16 border-t flex-shrink-0">
            {showIssueButton(invoice.status, canWrite) && (
              <button type="button" onClick={handleIssue} disabled={saving} className="h-11 px-5 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50">Issue Invoice</button>
            )}
            {showRecordButton(invoice.status) && !showPaymentForm && (
              <button type="button" onClick={() => setShowPaymentForm(true)} className="h-11 px-5 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors">Record Payment</button>
            )}
            {onViewPlan && (
              <button type="button" onClick={onViewPlan} className="h-11 px-5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">View Payment Plan</button>
            )}
            {showVoidButton(invoice.status, canWrite) && !showVoidForm && (
              <button type="button" onClick={() => { setShowVoidForm(true); setVoidError(null); }} disabled={saving} className="h-11 px-5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50">Void</button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={handleClose} className="h-11 px-5 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
