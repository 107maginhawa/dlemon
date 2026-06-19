/**
 * PatientCredits — credit balance + add/apply actions (Phase 4.1).
 *
 * Shows the patient's available credit, an inline "Add credit" form, and (when
 * there's credit + an outstanding invoice) an "Apply to invoice" form. Apply is
 * server-capped (BR-052) — the UI surfaces the 422 reason rather than guessing.
 */
import React, { useState } from 'react';
import { usePatientCredits } from '../hooks/use-patient-credits';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';

function money(cents: number): string {
  return `${CURRENCY_SYMBOL}${(cents / 100).toLocaleString(APP_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function toCents(pesos: string): number {
  const n = Number(pesos);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export interface OutstandingInvoiceOption {
  id: string;
  invoiceNumber?: string | null;
  balanceCents: number;
}

export interface PatientCreditsProps {
  patientId: string;
  outstandingInvoices: OutstandingInvoiceOption[];
  onChanged?: () => void;
}

export function PatientCredits({ patientId, outstandingInvoices, onChanged }: PatientCreditsProps) {
  const { balanceCents, isLoading, addCredit, isAdding, applyCredit, isApplying, applyError } = usePatientCredits(patientId);

  const [addPesos, setAddPesos] = useState('');
  const [source, setSource] = useState('manual');
  const [applyPesos, setApplyPesos] = useState('');
  const [applyInvoiceId, setApplyInvoiceId] = useState('');
  // Fall back to the first outstanding invoice — the list may load after mount,
  // so a stale empty useState initializer would otherwise disable Apply forever.
  const selectedInvoiceId = applyInvoiceId || outstandingInvoices[0]?.id || '';

  async function handleAdd() {
    const cents = toCents(addPesos);
    if (cents <= 0) return;
    try {
      await addCredit({ amountCents: cents, source });
      setAddPesos('');
      onChanged?.();
    } catch { /* surfaced by mutation */ }
  }

  async function handleApply() {
    const cents = toCents(applyPesos);
    if (cents <= 0 || !selectedInvoiceId) return;
    try {
      await applyCredit({ invoiceId: selectedInvoiceId, amountCents: cents });
      setApplyPesos('');
      onChanged?.();
    } catch { /* surfaced via applyError */ }
  }

  return (
    <div className="rounded-xl border border-border bg-card mt-4" data-testid="patient-credits">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Patient Credit</h3>
        <span className="text-sm font-bold tabular-nums" data-testid="patient-credit-balance">
          {isLoading ? '…' : money(balanceCents)}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Add credit */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            inputMode="decimal"
            value={addPesos}
            onChange={(e) => setAddPesos(e.target.value)}
            placeholder="Amount"
            data-testid="add-credit-amount"
            className="w-28 h-9 rounded-lg border border-border px-3 text-sm tabular-nums bg-background focus-visible:ring-2 focus-visible:ring-ring outline-none"
          />
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Credit source"
            data-testid="add-credit-source"
            className="h-9 rounded-lg border border-border px-2 text-sm bg-background focus-visible:ring-2 focus-visible:ring-ring outline-none"
          >
            <option value="manual">Manual</option>
            <option value="overpayment">Overpayment</option>
            <option value="refund">Refund</option>
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isAdding || toCents(addPesos) <= 0}
            data-testid="add-credit-btn"
            className="h-9 px-4 rounded-lg bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none"
          >
            {isAdding ? 'Adding…' : 'Add credit'}
          </button>
        </div>

        {/* Apply credit */}
        {balanceCents > 0 && outstandingInvoices.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            <input
              inputMode="decimal"
              value={applyPesos}
              onChange={(e) => setApplyPesos(e.target.value)}
              placeholder="Apply"
              data-testid="apply-credit-amount"
              className="w-28 h-9 rounded-lg border border-border px-3 text-sm tabular-nums bg-background focus-visible:ring-2 focus-visible:ring-ring outline-none"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setApplyInvoiceId(e.target.value)}
              aria-label="Invoice to apply credit"
              data-testid="apply-credit-invoice"
              className="h-9 rounded-lg border border-border px-2 text-sm bg-background focus-visible:ring-2 focus-visible:ring-ring outline-none"
            >
              {outstandingInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {(inv.invoiceNumber ?? inv.id.slice(0, 8))} · {money(inv.balanceCents)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying || toCents(applyPesos) <= 0 || !selectedInvoiceId}
              data-testid="apply-credit-btn"
              className="h-9 px-4 rounded-lg border border-border text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none"
            >
              {isApplying ? 'Applying…' : 'Apply'}
            </button>
          </div>
        )}

        {applyError && (
          <div className="text-sm text-destructive" data-testid="apply-credit-error">
            {applyError.message || 'Could not apply credit.'}
          </div>
        )}
      </div>
    </div>
  );
}
