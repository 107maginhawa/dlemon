/**
 * InvoiceDetail — auto-close on full payment.
 *
 * Recording a payment that fully settles the invoice (amount == outstanding
 * balance) dismisses the sheet (calls onClose) — so the deposit flow lands the
 * user back on the workspace instead of stranding them on a paid invoice. A
 * PARTIAL payment must leave the sheet open so the next payment can be recorded.
 */
import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceDetail } from './invoice-detail';
import { useOrgContextStore } from '@/stores/org-context.store';

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';

// Issued, fully outstanding (₱2,500). No prior payments.
function issuedInvoice() {
  return {
    id: 'inv-1', invoiceNumber: 'INV-0001', status: 'issued', patientId: 'p-1', patientName: 'Juan dela Cruz',
    visitDate: '2024-01-10', dueDate: null,
    lineItems: [{ id: 'li-1', description: 'Crown', cdtCode: 'D2740', toothNumber: 14, priceCents: 250000 }],
    payments: [],
    subtotalCents: 250000, discountCents: 0, taxCents: 0, totalCents: 250000, paidCents: 0, balanceCents: 250000,
  };
}

function installFetch() {
  const calls: Array<{ url: string; method: string }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    calls.push({ url, method });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.endsWith('/payments') && method === 'POST') {
      return json({ id: 'pay-1', invoiceId: 'inv-1', amountCents: 0, method: 'cash', receiptNumber: 'R-A-0001', createdAt: '2024-01-12T00:00:00.000Z', isVoid: false }, 201);
    }
    return json(issuedInvoice());
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

beforeEach(() => { useOrgContextStore.setState({ memberId: MEMBER_ID, branchId: 'b-1', orgId: 'o-1', role: 'dentist_owner' }); });
afterEach(() => { cleanup(); useOrgContextStore.setState({ memberId: null, branchId: null, orgId: null, role: null }); });

function renderDetail(onClose: () => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(React.createElement(QueryClientProvider, { client: qc },
    React.createElement(InvoiceDetail, { invoiceId: 'inv-1', open: true, onClose })));
}

async function recordPayment(user: ReturnType<typeof userEvent.setup>, amount: string) {
  await user.click(await screen.findByRole('button', { name: 'Record Payment' }));
  const amountInput = await screen.findByLabelText(/Amount/i);
  await user.clear(amountInput);
  await user.type(amountInput, amount);
  await user.type(screen.getByLabelText(/Receipt/i), 'R-A-0001');
  await user.click(screen.getByRole('button', { name: 'Record', exact: true }));
}

describe('InvoiceDetail — auto-close on full payment', () => {
  test('a FULL payment (== balance) dismisses the sheet', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    const f = installFetch();
    try {
      renderDetail(onClose);
      await recordPayment(user, '2500'); // ₱2,500 == outstanding balance
      await waitFor(() => expect(f.calls.some((c) => c.method === 'POST' && c.url.endsWith('/payments'))).toBe(true));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    } finally { f.restore(); }
  });

  test('a PARTIAL payment (< balance) leaves the sheet open', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    const f = installFetch();
    try {
      renderDetail(onClose);
      await recordPayment(user, '1000'); // ₱1,000 < ₱2,500 balance
      await waitFor(() => expect(f.calls.some((c) => c.method === 'POST' && c.url.endsWith('/payments'))).toBe(true));
      // Give any erroneous close a chance to fire, then assert it did NOT.
      await new Promise((r) => setTimeout(r, 80));
      expect(onClose).not.toHaveBeenCalled();
    } finally { f.restore(); }
  });
});
