/**
 * PaymentPlanView — render/derive coherence (FIX-005)
 *
 * getDentalPaymentPlan returns the plan WITH its installments[] (now declared in the
 * contract), but NOT plan-level paidCents/remainingCents/installmentsCount/nextDueDate
 * or a per-installment `number`/`method`. The view must DERIVE these from installments[]
 * (sum paidCents, count, next unpaid due date, installmentNumber→number) instead of
 * reading undefined fields (which rendered ₱NaN / blank / '--'). RED before the
 * select-mapper fix.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentPlanView } from './payment-plan-view';

// Wire shape of getDentalPaymentPlan: { ...plan, installments } — installment 1 paid,
// 2 & 3 pending. Derived: count 3, paid ₱100.00, remaining ₱200.00, next due = inst 2.
const PLAN_WIRE = {
  id: 'plan-1',
  invoiceId: 'inv-1',
  patientId: 'p-1',
  totalCents: 30000,
  numberOfInstallments: 3,
  frequency: 'monthly',
  startDate: '2026-02-01T00:00:00.000Z',
  amountPerInstallmentCents: 10000,
  status: 'on_track',
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  installments: [
    { id: 'i-1', planId: 'plan-1', installmentNumber: 1, dueDate: '2026-02-01T00:00:00.000Z', amountCents: 10000, paidCents: 10000, paidDate: '2026-02-01T00:00:00.000Z', status: 'paid' },
    { id: 'i-2', planId: 'plan-1', installmentNumber: 2, dueDate: '2026-03-01T00:00:00.000Z', amountCents: 10000, paidCents: 0, status: 'pending' },
    { id: 'i-3', planId: 'plan-1', installmentNumber: 3, dueDate: '2026-04-01T00:00:00.000Z', amountCents: 10000, paidCents: 0, status: 'pending' },
  ],
};

// Plan whose only non-paid installment is WAIVED (forgiven) → nothing "next due".
const PLAN_WAIVED = {
  ...PLAN_WIRE,
  numberOfInstallments: 2,
  installments: [
    { id: 'i-1', planId: 'plan-1', installmentNumber: 1, dueDate: '2026-02-01T00:00:00.000Z', amountCents: 15000, paidCents: 15000, paidDate: '2026-02-01T00:00:00.000Z', status: 'paid' },
    { id: 'i-2', planId: 'plan-1', installmentNumber: 2, dueDate: '2026-03-01T00:00:00.000Z', amountCents: 15000, paidCents: 0, status: 'waived' },
  ],
};

function installFetch(plan: unknown = PLAN_WIRE) {
  const original = global.fetch;
  global.fetch = mock(async () =>
    new Response(JSON.stringify(plan), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ) as unknown as typeof fetch;
  return { restore: () => { global.fetch = original; } };
}

afterEach(cleanup);

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(React.createElement(QueryClientProvider, { client: qc },
    React.createElement(PaymentPlanView, { invoiceId: 'inv-1', open: true, onClose: () => {} })));
}

// Read a stat value = the element immediately following a label. Some labels also
// appear as installment status badges (e.g. "Paid"), so pick the occurrence whose
// next sibling actually holds the value.
const statValue = (label: string): string => {
  for (const el of screen.getAllByText(label)) {
    const t = el.nextElementSibling?.textContent ?? '';
    if (t) return t;
  }
  return '';
};

describe('PaymentPlanView — derives plan-level figures from installments[]', () => {
  test('Paid / Remaining / Installments / Next Due derive coherently from the wire', async () => {
    const f = installFetch();
    try {
      renderView();
      await screen.findByText('Installment Schedule');

      // Σ installments[].paidCents = 10000 → ₱100.00; remaining = 30000 − 10000 = ₱200.00.
      await waitFor(() => expect(statValue('Paid')).toBe('₱100.00'));
      expect(statValue('Remaining')).toBe('₱200.00');
      // installmentsCount derived from numberOfInstallments (not the absent field).
      expect(statValue('Installments')).toBe('3');
      // nextDueDate = earliest UNPAID installment due date → a real date, not '--'.
      expect(statValue('Next Due')).not.toBe('--');
      // Status renders as "On Track" (the map was mis-keyed 'onTrack' → showed raw 'on_track').
      expect(screen.getByText('On Track')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('renders every installment row with its derived number badge', async () => {
    const f = installFetch();
    try {
      renderView();
      await screen.findByText('Installment Schedule');
      const rows = await screen.findAllByRole('row');
      // 1 header + 3 installment rows — all installments[] rendered.
      expect(rows.length).toBe(4);
      // Derived number badges (installmentNumber → number) render, scoped to the table
      // ('3' also appears as the Installments stat value outside the table).
      const table = rows[0].closest('table')!;
      expect(within(table).getByText('1')).not.toBeNull();
      expect(within(table).getByText('2')).not.toBeNull();
      expect(within(table).getByText('3')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('a WAIVED installment renders its label and is excluded from Next Due', async () => {
    const f = installFetch(PLAN_WAIVED);
    try {
      renderView();
      await screen.findByText('Installment Schedule');
      // 'waived' is a real InstallmentStatus enum value — render it humanized, not raw.
      await waitFor(() => expect(screen.getByText('Waived')).not.toBeNull());
      // Only paid + waived installments remain → nothing is "next due".
      expect(statValue('Next Due')).toBe('--');
    } finally {
      f.restore();
    }
  });
});
