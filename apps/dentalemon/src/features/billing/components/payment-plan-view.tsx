/**
 * PaymentPlanView -- modal for viewing a payment plan with installment schedule
 *
 * Features: plan header with progress bar, stat cards, installment table
 *
 * Wireframe: docs/prd/context/wireframes/payment-plan.html
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDentalPaymentPlanOptions } from '@monobase/sdk-ts/generated/react-query';
import { Skeleton } from '@monobase/ui';
import { formatCents } from '@/lib/format-currency';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Installment {
  id: string;
  number: number;
  dueDate: string;
  amountCents: number;
  paidDate?: string;
  method?: string;
  status: string;
}

// The view's display shape. The SDK now carries installments[]; paidCents,
// remainingCents, installmentsCount, and nextDueDate are DERIVED from it in `select`
// (FIX-005) rather than read from absent wire fields.
interface PaymentPlan {
  id: string;
  invoiceId: string;
  status: string;
  frequency: string;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  installmentsCount: number;
  amountPerInstallmentCents: number;
  startDate: string;
  nextDueDate?: string;
  installments: Installment[];
}

export interface PaymentPlanViewProps {
  invoiceId: string;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Pure logic helpers (exported for testing)
// ---------------------------------------------------------------------------

export function formatFrequency(frequency: string): string {
  const map: Record<string, string> = {
    monthly: 'Monthly',
    weekly: 'Weekly',
    biweekly: 'Bi-Weekly',
  };
  return map[frequency] ?? frequency;
}

export function getPlanStatusClass(status: string): string {
  switch (status) {
    case 'on_track':
      return 'bg-green-100 text-green-700';
    case 'behind':
      return 'bg-red-100 text-red-700';
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'defaulted':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-500';
  }
}

export function calcProgress(paidCents: number, totalCents: number): number {
  if (totalCents <= 0) return 0;
  return Math.round((paidCents / totalCents) * 100);
}

export function isInstallmentOverdue(installment: { status: string }): boolean {
  return installment.status === 'overdue';
}

function formatPlanStatus(status: string): string {
  // FIX-005: the key was 'onTrack' (camelCase) but the status enum is 'on_track'
  // (snake) — so a real plan rendered the raw 'on_track'. Latent until the view was
  // populated by the create flow. Keyed on the actual PaymentPlanStatus values.
  const map: Record<string, string> = {
    on_track: 'On Track',
    behind: 'Behind',
    completed: 'Completed',
    defaulted: 'Defaulted',
  };
  return map[status] ?? status;
}

// InstallmentStatus enum = pending | paid | overdue | waived ('waived' = forgiven).
function getInstallmentNumClass(status: string): string {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-700';
    case 'overdue':
      return 'bg-orange-100 text-orange-700';
    case 'pending':
      return 'bg-orange-50 text-orange-600';
    case 'waived':
      return 'bg-gray-100 text-gray-500';
    default:
      return 'bg-gray-100 text-muted-foreground';
  }
}

function getInstallmentBadgeClass(status: string): string {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-700';
    case 'overdue':
      return 'bg-red-100 text-red-700';
    case 'pending':
      return 'bg-orange-50 text-orange-600';
    case 'waived':
      return 'bg-gray-100 text-gray-500';
    default:
      return 'bg-gray-100 text-muted-foreground';
  }
}

function formatInstallmentStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending',
    paid: 'Paid',
    overdue: 'Overdue',
    waived: 'Waived',
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaymentPlanView({ invoiceId, open, onClose }: PaymentPlanViewProps) {
  const { containerRef } = useSheetA11y({ open, onClose });
  const planQuery = useQuery({
    ...getDentalPaymentPlanOptions({ path: { invoiceId } }),
    enabled: open && !!invoiceId,
    // FIX-005: the wire returns the plan + installments[] (now declared in the SDK
    // type), but NOT the plan-level paidCents/remainingCents/installmentsCount/
    // nextDueDate or a per-installment `number`/`method`. DERIVE them from
    // installments[] (the lighter §15 option) — no contract surface, no `as unknown`
    // cast, and the schedule renders from typed truth.
    select: (data): PaymentPlan => {
      const raw = data.installments ?? [];
      const toIso = (d: Date | string | undefined | null): string | undefined =>
        d == null ? undefined : d instanceof Date ? d.toISOString() : String(d);
      const paidCents = raw.reduce((sum, i) => sum + (i.paidCents ?? 0), 0);
      const remainingCents = Math.max(0, data.totalCents - paidCents);
      const installments: Installment[] = raw.map((i) => ({
        id: i.id,
        number: i.installmentNumber,
        dueDate: toIso(i.dueDate) ?? '',
        amountCents: i.amountCents,
        paidDate: toIso(i.paidDate),
        status: i.status,
      }));
      // A paid OR waived installment is settled → not "next due".
      const unpaidDueMs = raw
        .filter((i) => i.status !== 'paid' && i.status !== 'waived')
        .map((i) => new Date(i.dueDate).getTime())
        .sort((a, b) => a - b);
      const nextDueDate = unpaidDueMs.length ? new Date(unpaidDueMs[0]!).toISOString() : undefined;
      return {
        id: data.id,
        invoiceId: data.invoiceId,
        status: data.status,
        frequency: data.frequency,
        totalCents: data.totalCents,
        paidCents,
        remainingCents,
        installmentsCount: data.numberOfInstallments,
        amountPerInstallmentCents: data.amountPerInstallmentCents,
        startDate: toIso(data.startDate) ?? '',
        nextDueDate,
        installments,
      };
    },
  });

  const plan = planQuery.data ?? null;
  const loading = planQuery.isLoading;
  const error = planQuery.isError
    ? (planQuery.error instanceof Error ? planQuery.error.message : 'Failed to load payment plan')
    : null;

  if (!open) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Payment Plan">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        data-testid="payment-plan-view"
        className="relative w-full max-w-[720px] max-h-[calc(100vh-80px)] bg-background rounded-2xl shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-[52px] border-b flex-shrink-0">
          <h2 className="text-[17px] font-semibold tracking-tight">Payment Plan</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          {loading && (
            <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading payment plan">
              {/* Plan header */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
              </div>
              {/* Installment table */}
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {plan && !loading && (
            <>
              {/* Plan Header */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/50">Payment Plan</p>
                  <p className="text-xl font-bold tracking-tight mt-1">
                    {formatFrequency(plan.frequency)} Plan
                  </p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold mt-2 ${getPlanStatusClass(plan.status)}`}>
                    {formatPlanStatus(plan.status)}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="text-xl font-bold tabular-nums">{formatCents(plan.totalCents)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="font-semibold tabular-nums text-green-700">{formatCents(plan.paidCents)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-semibold tabular-nums text-amber-600">{formatCents(plan.remainingCents)}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2">
                    <div
                      className="w-full h-2 rounded-full bg-secondary overflow-hidden"
                      role="progressbar"
                      aria-valuenow={calcProgress(plan.paidCents, plan.totalCents)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${calcProgress(plan.paidCents, plan.totalCents)}% paid`}
                    >
                      <div
                        className="h-full rounded-full bg-lemon transition-all duration-300"
                        style={{ width: `${calcProgress(plan.paidCents, plan.totalCents)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[11px] font-semibold text-lemon-foreground tabular-nums">
                        {calcProgress(plan.paidCents, plan.totalCents)}% paid
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {formatCents(plan.remainingCents)} left
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-background border border-border rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/50">Installments</span>
                  <span className="text-xl font-bold tabular-nums">{plan.installmentsCount}</span>
                  <span className="text-xs text-muted-foreground">{formatFrequency(plan.frequency).toLowerCase()}</span>
                </div>
                <div className="bg-background border border-border rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/50">Per Installment</span>
                  <span className="text-xl font-bold tabular-nums">{formatCents(plan.amountPerInstallmentCents)}</span>
                  <span className="text-xs text-muted-foreground">per {plan.frequency === 'monthly' ? 'month' : plan.frequency === 'weekly' ? 'week' : 'period'}</span>
                </div>
                <div className="bg-background border border-border rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/50">Started</span>
                  <span className="text-[15px] font-bold tabular-nums pt-0.5">{new Date(plan.startDate).toLocaleDateString()}</span>
                </div>
                <div className="bg-background border border-border rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/50">Next Due</span>
                  <span className="text-[15px] font-bold tabular-nums pt-0.5 text-amber-600">
                    {plan.nextDueDate ? new Date(plan.nextDueDate).toLocaleDateString() : '--'}
                  </span>
                </div>
              </div>

              {/* Installment Schedule */}
              <div className="bg-background rounded-2xl border border-border overflow-hidden">
                <div className="text-[13px] font-semibold tracking-wider uppercase text-muted-foreground px-5 py-3 border-b border-border">
                  Installment Schedule
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-2.5 border-b border-border pl-5">#</th>
                      <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-2.5 border-b border-border">Due Date</th>
                      <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-2.5 border-b border-border">Amount</th>
                      <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-2.5 border-b border-border">Paid Date</th>
                      <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-2.5 border-b border-border">Method</th>
                      <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground px-4 py-2.5 border-b border-border pr-5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.installments.map((inst) => (
                      <tr key={inst.id} className="hover:bg-lemon-soft transition-colors border-b border-border last:border-b-0">
                        <td className="px-4 h-12 align-middle pl-5">
                          <span className={`w-6 h-6 rounded-full text-[11px] font-bold inline-flex items-center justify-center ${getInstallmentNumClass(inst.status)}`}>
                            {inst.number}
                          </span>
                        </td>
                        <td className={`px-4 h-12 align-middle text-[13px] tabular-nums ${isInstallmentOverdue(inst) ? 'font-semibold text-orange-600' : ''}`}>
                          {new Date(inst.dueDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 h-12 align-middle text-[13px] font-semibold tabular-nums">
                          {formatCents(inst.amountCents)}
                        </td>
                        <td className="px-4 h-12 align-middle text-[13px] tabular-nums text-muted-foreground">
                          {inst.paidDate ? new Date(inst.paidDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 h-12 align-middle text-[13px] text-muted-foreground">
                          {inst.method ?? '—'}
                        </td>
                        <td className="px-4 h-12 align-middle pr-5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${getInstallmentBadgeClass(inst.status)}`}>
                            {formatInstallmentStatus(inst.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center px-5 h-14 border-t flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-5 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
