/**
 * PaymentPlanCreate -- dialog to split an invoice balance into an installment plan
 *
 * FIX-005: the headline PH installment feature. Owner/associate gates the entry point
 * (createDentalPaymentPlan = dentist_owner + dentist_associate); the backend derives
 * the plan total from the invoice balance, so this dialog sends NO amount — only the
 * installment count (2–24), frequency, and start date.
 */

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createDentalPaymentPlanMutation } from '@monobase/sdk-ts/generated/react-query';
import type { PlanFrequency } from '@monobase/sdk-ts/generated';
import { getErrorMessage } from '@/lib/error-toast';
import { formatCents } from '@/lib/format-currency';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';

const FREQUENCIES: { value: PlanFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

// Mirror the backend create gates client-side. numberOfInstallments must be an
// integer 2–24 (backend 422 INVALID_INSTALLMENT_COUNT); frequency + startDate required.
export function validatePlanForm(form: { numberOfInstallments: number; frequency: string; startDate: string }): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(form.numberOfInstallments) || form.numberOfInstallments < 2 || form.numberOfInstallments > 24) {
    errors.push('Number of installments must be between 2 and 24');
  }
  if (!form.frequency) errors.push('Frequency is required');
  if (!form.startDate) errors.push('Start date is required');
  return errors;
}

export interface PaymentPlanCreateProps {
  invoiceId: string;
  patientId: string;
  balanceCents: number;
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function PaymentPlanCreate({ invoiceId, patientId, balanceCents, open, onClose, onCreated }: PaymentPlanCreateProps) {
  const { containerRef } = useSheetA11y({ open, onClose });
  const [installments, setInstallments] = useState('6');
  const [frequency, setFrequency] = useState<PlanFrequency>('monthly');
  const [startDate, setStartDate] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const createMutation = useMutation({
    ...createDentalPaymentPlanMutation(),
    onSuccess: () => {
      setErrors([]);
      onCreated?.();
      onClose();
    },
    onError: (err) => {
      // getErrorMessage reads the flat SdkError envelope (err.body.{code,message}),
      // so backend codes like PLAN_EXISTS / NO_BALANCE / INVALID_INSTALLMENT_COUNT
      // surface legibly instead of the synthetic "SDK request failed" message.
      setErrors([getErrorMessage(err, 'Failed to create payment plan')]);
    },
  });

  if (!open) return null;

  const n = parseInt(installments || '0', 10);
  const perInstallment = Number.isInteger(n) && n >= 2 && n <= 24 ? Math.floor(balanceCents / n) : 0;

  function handleCreate() {
    const errs = validatePlanForm({ numberOfInstallments: n, frequency, startDate });
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    // No amount in the body — the backend derives totalCents from the invoice balance.
    createMutation.mutate({
      path: { invoiceId },
      body: { patientId, numberOfInstallments: n, frequency, startDate: new Date(startDate) },
    });
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Create Payment Plan">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div data-testid="payment-plan-create" className="relative w-full max-w-[440px] bg-background rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-[52px] border-b flex-shrink-0">
          <h2 className="text-[17px] font-semibold tracking-tight">Create Payment Plan</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm">✕</button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">
          {errors.length > 0 && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {errors.map((e) => <p key={e}>{e}</p>)}
            </div>
          )}

          {/* Balance is split server-side — shown read-only so the user knows the total. */}
          <div className="flex justify-between items-center rounded-xl border border-border px-3 py-2.5">
            <span className="text-[13px] text-muted-foreground">Balance to split</span>
            <span className="text-[15px] font-bold tabular-nums">{formatCents(balanceCents)}</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="plan-installments">Number of installments *</label>
            <input id="plan-installments" type="number" min="2" max="24" step="1" value={installments} onChange={(e) => setInstallments(e.target.value)} className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none" />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Frequency *</label>
            <div className="flex border border-border rounded-xl overflow-hidden bg-secondary/30 p-0.5 gap-0.5" role="group" aria-label="Frequency">
              {FREQUENCIES.map((f) => (
                <button key={f.value} type="button" onClick={() => setFrequency(f.value)} aria-pressed={frequency === f.value}
                  className={`flex-1 h-9 text-[13px] font-medium rounded-lg transition-colors ${frequency === f.value ? 'bg-lemon text-lemon-foreground font-semibold' : 'text-muted-foreground hover:bg-background'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="plan-start-date">Start date *</label>
            <input id="plan-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none" />
          </div>

          {perInstallment > 0 && (
            <p className="text-[13px] text-muted-foreground">
              ≈ <span className="font-semibold tabular-nums text-foreground">{formatCents(perInstallment)}</span> per installment
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 px-5 h-16 border-t flex-shrink-0">
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Cancel</button>
          <button type="button" onClick={handleCreate} disabled={createMutation.isPending} className="h-11 px-5 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50">
            {createMutation.isPending ? 'Creating...' : 'Create Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
