/**
 * PatientStatement — printable/emailable itemized account statement (Phase 3.2).
 *
 * Opens over the patient profile: renders the statement (summary + invoices +
 * payments) in the shared PrintableDocument (A4) for print, plus an "Email
 * statement" action that reuses the dunning send endpoint (BR-050). Read-only.
 */
import React from 'react';
import { usePatientStatement } from '../hooks/use-patient-statement';
import { useSendStatement } from '@/features/billing/hooks/use-collections';
import { PrintableDocument } from '@/components/print/printable-document';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';

function money(cents: number): string {
  return `${CURRENCY_SYMBOL}${(cents / 100).toLocaleString(APP_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(value?: string | Date): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(APP_LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface PatientStatementProps {
  patientId: string;
  branchId?: string | null;
  onClose: () => void;
}

export function PatientStatement({ patientId, branchId, onClose }: PatientStatementProps) {
  const { statement, isLoading, error } = usePatientStatement(patientId);
  const { send, sendingPatientId, lastSent } = useSendStatement({ branchId });

  const emailed = lastSent?.patientId === patientId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Patient statement"
      data-testid="patient-statement-modal"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl my-8 rounded-2xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="no-print flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Account statement</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { void send(patientId); }}
              disabled={sendingPatientId === patientId}
              data-testid="statement-email-btn"
              className="h-9 px-4 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none"
            >
              {sendingPatientId === patientId ? 'Sending…' : emailed ? 'Emailed ✓' : 'Email statement'}
            </button>
            <button
              type="button"
              onClick={onClose}
              data-testid="statement-close-btn"
              className="h-9 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="text-sm text-muted-foreground" data-testid="statement-loading">Loading statement…</div>
          ) : error || !statement ? (
            <div className="text-sm text-destructive">Failed to load statement.</div>
          ) : (
            <PrintableDocument title={`Statement — ${statement.patientName}`} layout="a4" printLabel="Print">
              <div className="flex flex-col gap-6 p-2" data-testid="patient-statement-doc">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-lg font-bold">{statement.patientName}</h1>
                    <p className="text-xs text-muted-foreground">Statement generated {fmtDate(statement.generatedAt)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding</span>
                    <div className="text-xl font-bold tabular-nums" data-testid="statement-outstanding">
                      {money(statement.summary.outstandingBalanceCents)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Total billed</span><div className="font-semibold tabular-nums">{money(statement.summary.totalBilledCents)}</div></div>
                  <div><span className="text-muted-foreground">Total paid</span><div className="font-semibold tabular-nums">{money(statement.summary.totalPaidCents)}</div></div>
                  <div><span className="text-muted-foreground">Invoices</span><div className="font-semibold tabular-nums">{statement.summary.totalInvoices}</div></div>
                </div>

                <section>
                  <h3 className="text-sm font-semibold mb-2">Invoices</h3>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="text-left py-1.5 border-b border-border">Invoice</th>
                        <th className="text-left py-1.5 border-b border-border">Issued</th>
                        <th className="text-right py-1.5 border-b border-border">Total</th>
                        <th className="text-right py-1.5 border-b border-border">Paid</th>
                        <th className="text-right py-1.5 border-b border-border">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.invoices.length === 0 ? (
                        <tr><td colSpan={5} className="py-3 text-center text-muted-foreground">No invoices.</td></tr>
                      ) : statement.invoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-border/60">
                          <td className="py-1.5 font-medium">{inv.invoiceNumber ?? inv.id.slice(0, 8)}</td>
                          <td className="py-1.5 text-muted-foreground">{fmtDate(inv.issuedAt)}</td>
                          <td className="py-1.5 text-right tabular-nums">{money(inv.totalCents)}</td>
                          <td className="py-1.5 text-right tabular-nums">{money(inv.paidCents)}</td>
                          <td className="py-1.5 text-right tabular-nums font-medium">{money(inv.balanceCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section>
                  <h3 className="text-sm font-semibold mb-2">Payments</h3>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="text-left py-1.5 border-b border-border">Date</th>
                        <th className="text-left py-1.5 border-b border-border">Method</th>
                        <th className="text-left py-1.5 border-b border-border">Receipt</th>
                        <th className="text-right py-1.5 border-b border-border">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.payments.length === 0 ? (
                        <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">No payments.</td></tr>
                      ) : statement.payments.map((p) => (
                        <tr key={p.id} className={`border-b border-border/60 ${p.isVoid ? 'line-through text-muted-foreground' : ''}`}>
                          <td className="py-1.5">{fmtDate(p.recordedAt)}</td>
                          <td className="py-1.5">{p.method}</td>
                          <td className="py-1.5 text-muted-foreground">{p.receiptNumber ?? '—'}</td>
                          <td className="py-1.5 text-right tabular-nums">{money(p.amountCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </div>
            </PrintableDocument>
          )}
        </div>
      </div>
    </div>
  );
}
