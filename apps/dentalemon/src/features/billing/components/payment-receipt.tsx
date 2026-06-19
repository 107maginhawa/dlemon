/**
 * PaymentReceipt — printable payment receipt (AHA FIX-007, FR4.6).
 *
 * Cash-practice trust artifact. Renders the structured receipt from
 * getDentalPaymentReceipt on the shared PrintableDocument primitive (80mm).
 * EC5: a voided payment's reprint carries a VOIDED watermark + the void reason
 * so a reprinted receipt can never be mistaken for a live one.
 */
import React from 'react';
import { PrintableDocument } from '@/components/print/printable-document';
import { formatCents } from '@/lib/format-currency';
import { METHOD_LABELS } from './invoice-detail.helpers';
import { usePaymentReceipt } from '../hooks/use-payment-receipt';

export interface PaymentReceiptProps {
  invoiceId: string;
  paymentId: string;
  onPrint?: () => void;
}

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function PaymentReceipt({ invoiceId, paymentId, onPrint }: PaymentReceiptProps) {
  const { receipt, isLoading, error } = usePaymentReceipt(invoiceId, paymentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
        {error?.message ?? 'Receipt could not be loaded.'}
      </div>
    );
  }

  const methodLabel = METHOD_LABELS[receipt.payment.method] ?? receipt.payment.method;

  return (
    <PrintableDocument title={`Receipt ${receipt.receiptNumber}`} layout="receipt" onPrint={onPrint}>
      <div className="relative flex flex-col gap-3 p-4 text-sm">
        {receipt.isVoid && (
          <div
            data-testid="receipt-void-watermark"
            aria-label="VOIDED"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="text-5xl font-black tracking-widest text-destructive/30 rotate-[-20deg] select-none">
              VOIDED
            </span>
          </div>
        )}

        {/* BIR header (BR-055) */}
        <div className="text-center">
          {receipt.clinic?.registeredName && (
            <p className="text-sm font-bold">{receipt.clinic.registeredName}</p>
          )}
          {receipt.clinic?.businessStyle && (
            <p className="text-xs text-muted-foreground">{receipt.clinic.businessStyle}</p>
          )}
          {receipt.clinic?.address && (
            <p className="text-xs text-muted-foreground">{receipt.clinic.address}</p>
          )}
          {receipt.clinic?.tin && (
            <p className="text-xs text-muted-foreground">
              TIN: {receipt.clinic.tin}
              {receipt.clinic.isVatRegistered ? ' (VAT Reg.)' : ' (Non-VAT)'}
            </p>
          )}
          <h2 className="text-base font-bold mt-1">Official Receipt</h2>
          <p className="text-xs text-muted-foreground">OR No. <span>{receipt.orNumber ?? receipt.receiptNumber}</span></p>
        </div>

        <div className="border-t border-dashed border-border" />

        {/* Patient + invoice */}
        <div className="flex flex-col gap-1">
          <Row label="Patient">{receipt.patient.name}</Row>
          <Row label="Invoice">{receipt.invoice.invoiceNumber}</Row>
          <Row label="Date">{fmtDate(receipt.payment.recordedAt)}</Row>
          <Row label="Method">{methodLabel}</Row>
        </div>

        <div className="border-t border-dashed border-border" />

        {/* Amount */}
        <div className="flex items-center justify-between">
          <span className="font-semibold">Amount Paid</span>
          <span className="text-lg font-bold tabular-nums">{formatCents(receipt.payment.amountCents)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Invoice balance</span>
          <span className="tabular-nums">{formatCents(receipt.invoice.balanceCents)}</span>
        </div>

        {receipt.isVoid && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
            This payment was voided{receipt.voidedAt ? ` on ${fmtDate(receipt.voidedAt)}` : ''}.
            {receipt.voidReason ? ` Reason: ${receipt.voidReason}` : ''}
          </div>
        )}

        {/* VAT breakdown (BR-055) — only for VAT-registered clinics */}
        {receipt.clinic?.isVatRegistered && receipt.tax && (
          <>
            <div className="border-t border-dashed border-border" />
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">VATable Sales</span>
                <span className="tabular-nums">{formatCents(receipt.tax.vatableCents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">VAT ({Math.round(receipt.tax.vatRate * 100)}%)</span>
                <span data-testid="receipt-vat-amount" className="tabular-nums">{formatCents(receipt.tax.vatCents)}</span>
              </div>
            </div>
          </>
        )}

        <div className="border-t border-dashed border-border" />
        {receipt.taxStatement && (
          <p className="text-center text-xs font-medium text-muted-foreground">{receipt.taxStatement}</p>
        )}
        <p className="text-center text-[10px] text-muted-foreground">
          Generated {fmtDate(receipt.generatedAt)}
        </p>
      </div>
    </PrintableDocument>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
