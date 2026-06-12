/**
 * InvoiceDetail — Create Payment Plan entry point (FIX-005 wiring)
 *
 * Pins that the footer affordance is reachable and opens the create dialog (the
 * dialog's own validation/POST behaviour is covered in payment-plan-create.test.tsx).
 */

import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceDetail } from './invoice-detail';
import { useOrgContextStore } from '@/stores/org-context.store';

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';

function issuedInvoice() {
  return {
    id: 'inv-1', invoiceNumber: 'INV-0001', status: 'issued', patientId: 'p-1', patientName: 'Juan dela Cruz',
    visitDate: '2024-01-10', dueDate: '2024-02-10',
    lineItems: [{ id: 'li-1', description: 'Composite Filling', cdtCode: 'D2391', toothNumber: 16, priceCents: 250000 }],
    payments: [], subtotalCents: 250000, discountCents: 0, taxCents: 0, totalCents: 250000, paidCents: 0, balanceCents: 250000,
  };
}

function installFetch() {
  const original = global.fetch;
  global.fetch = mock(async () =>
    new Response(JSON.stringify(issuedInvoice()), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ) as unknown as typeof fetch;
  return { restore: () => { global.fetch = original; } };
}

beforeEach(() => {
  useOrgContextStore.setState({ memberId: MEMBER_ID, branchId: 'b-1', orgId: 'o-1', role: 'dentist_owner' });
});
afterEach(() => {
  cleanup();
  useOrgContextStore.setState({ memberId: null, branchId: null, orgId: null, role: null });
});

function renderDetail(canWrite = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(React.createElement(QueryClientProvider, { client: qc },
    React.createElement(InvoiceDetail, { invoiceId: 'inv-1', open: true, onClose: () => {}, canWrite })));
}

describe('InvoiceDetail — Create Payment Plan entry point', () => {
  test('a writer sees Create Payment Plan on an issued invoice with a balance, and it opens the dialog', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDetail(true);
      const btn = await screen.findByRole('button', { name: /create payment plan/i });
      await user.click(btn);
      // The create dialog (balance to split + Create Plan action) opens.
      expect(await screen.findByTestId('payment-plan-create')).not.toBeNull();
      expect(screen.getByRole('button', { name: /create plan/i })).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('a non-writer (canWrite=false) does NOT see Create Payment Plan', async () => {
    const f = installFetch();
    try {
      renderDetail(false);
      // Record Payment is role-independent for an issued invoice → "loaded" signal.
      await screen.findByRole('button', { name: /record payment/i });
      expect(screen.queryByRole('button', { name: /create payment plan/i })).toBeNull();
    } finally {
      f.restore();
    }
  });
});
